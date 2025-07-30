from persistentState import PersistentState
from system import DeviceManager
import time
import alarm
import os
from microcontroller import reset
from doorSensor.doorSensor import DoorSensor
from localAlarm import LocalAlarm
from alarmRelay.alarmRelay import alarmRelay
from adafruit_httpserver import REQUEST_HANDLED_RESPONSE_SENT


FATAL_FLAG_FILE = "fatal_error.flag"

def main():
    """
    Single entry point for all CircuitPython devices.
    Initializes the system and runs the appropriate device logic
    based on the DEVICE_MODULE setting in config.env.
    """

    persistent_state = PersistentState()    
    # On boot, check if we're recovering from a fatal error.
    if persistent_state.has_state("fatal_error"):
        error_timestamp = float(persistent_state.get_state("fatal_error"))
        print(f"Woke up from a fatal error recovery sleep. Removing flag and continuing boot. Error timestamp: {error_timestamp}")
        persistent_state.remove_state("fatal_error")
        # We don't need to reset() here, because waking from deep sleep is already a reset.
        # We can now proceed with the normal boot process.

    manager = None
    try:
        manager = DeviceManager()
        manager.bootstrap()

        device_module = manager.config.device_module

        # ======================================================================
        # DOOR SENSOR LOGIC
        # ======================================================================
        if device_module == "sensor":
            local_alarm = LocalAlarm(manager.config.buzzer_pin, manager.config.local_alarm_timeout_s)
            
            door_sensor = DoorSensor(
                manager.logger, manager.led, manager.device, manager.device_wifi, 
                manager.networking, local_alarm, manager.config.door_switch_pin, 
                manager.config.time_to_sleep_s
            )

            while True:
                woke_by = alarm.wake_alarm
                if isinstance(woke_by, alarm.time.TimeAlarm) and local_alarm.is_sounding:
                    local_alarm.stop()

                manager.device_wifi.check_connection()
                door_sensor.read_all_stats()
                door_sensor.send_data()
                
                needs_clearing = manager.logger.check_log_files()
                if needs_clearing:
                    manager.networking.send_logs()
                
                # Use smart sleep to choose between light/deep sleep based on armed status
                door_sensor.smart_sleep()
        
        # ======================================================================
        # ALARM RELAY LOGIC
        # ======================================================================
        elif device_module == "alarm":
            alarm_relay = alarmRelay(
                manager.logger, manager.led, manager.device, manager.device_wifi, 
                manager.networking, manager.config.relay_pin, manager.config.server_listen_port
            )
            
            server = alarm_relay.start_server()
            start_time = time.monotonic()
            
            while True:
                if time.monotonic() - start_time > manager.config.ping_interval_s:
                    alarm_relay.send_ping()
                    start_time = time.monotonic()

                pool_result = server.poll()
                if pool_result == REQUEST_HANDLED_RESPONSE_SENT:
                    manager.device.collect_garbage()

                needs_clearing = manager.logger.check_log_files()
                if needs_clearing:
                    manager.networking.send_logs()
        
        else:
            print(f"FATAL: Unknown DEVICE_MODULE '{device_module}' in config.env")
            if manager:
                manager.led.set_fatal_error()
            while True: time.sleep(1)


    except Exception as e:
        print(f"FATAL ERROR in main: {e}")
        # This is a catastrophic failure, try to log it and enter a safe state
        if manager:
            try:
                manager.logger.log_issue("Critical", "main", "main", f"FATAL ERROR: {e}")
                manager.networking.send_logs()
            except:
                pass
            
            # Turn the LED on solid to indicate a fatal error
            manager.led.turn_on_led()
            
            # Create a flag file to signal a fatal error on the next boot
            persistent_state.add_persistent_state("fatal_error", time.monotonic())

            # Create a wakeup alarm for the reboot delay
            reboot_alarm = alarm.time.TimeAlarm(monotonic_time=time.monotonic() + manager.config.fatal_error_reboot_delay_s)
            
            # Go to deep sleep. On wakeup, the code will restart from the top,
            # find the flag file, log the recovery, and proceed normally.
            print(f"Entering deep sleep for {manager.config.fatal_error_reboot_delay_s} seconds before attempting recovery...")
            alarm.exit_and_deep_sleep_until_alarms(reboot_alarm)

        # Fallback loop in case manager failed to initialize
        while True:
            time.sleep(1)


if __name__ == "__main__":
    main()