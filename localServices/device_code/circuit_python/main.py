from persistentState import PersistentState
from system import DeviceManager
import time
import alarm
import os
from microcontroller import reset
from doorSensor import DoorSensor
from localAlarm import LocalAlarm
from alarmRelay import alarmRelay
from adafruit_httpserver import REQUEST_HANDLED_RESPONSE_SENT


FATAL_FLAG_FILE = "fatal_error.flag"

def main():
    """
    Single entry point for all CircuitPython devices.
    Initializes the system and runs the appropriate device logic
    based on the DEVICE_MODULE setting in config.env.
    """

    manager = DeviceManager()
     
    # On boot, check if we're recovering from a fatal error.
    if manager.persistent_state.has_state("fatal_error"):
        error_timestamp = float(manager.persistent_state.get_state("fatal_error"))
        print(f"Woke up from a fatal error recovery sleep. Removing flag and continuing boot. Error timestamp: {error_timestamp}")
        manager.persistent_state.remove_persistent_state("fatal_error")
        # We don't need to reset() here, because waking from deep sleep is already a reset.
        # We can now proceed with the normal boot process.
    try:
        manager.bootstrap()
        device_module = manager.config.device_module

        # ======================================================================
        # DOOR SENSOR LOGIC
        # ======================================================================
        if device_module == "sensor":
            local_alarm = LocalAlarm(manager.config.buzzer_pin, manager.config.local_alarm_timeout_s)
            
            door_sensor = DoorSensor(
                manager.logger, manager.led, manager.device, manager.device_wifi, 
                manager.networking, local_alarm, manager.persistent_state, manager.config.door_switch_pin, 
                manager.config.ping_interval_s, manager.config.should_deep_sleep
            )
            manager.led.blink(5, delay=1)
            while True:
                woke_by = alarm.wake_alarm
                
                # Check which alarm woke up the Pico
                if woke_by is None:
                    print("Woke up from normal boot (no alarm)")
                elif isinstance(woke_by, alarm.pin.PinAlarm):
                    if woke_by.pin == door_sensor.switch_pin:
                        if woke_by.value:
                            print(f"Woke up from DOOR OPEN alarm (pin {woke_by.pin} went HIGH)")
                        else:
                            print(f"Woke up from DOOR CLOSE alarm (pin {woke_by.pin} went LOW)")
                    else:
                        print(f"Woke up from unknown pin alarm: {woke_by.pin}")
                elif isinstance(woke_by, alarm.time.TimeAlarm):
                    # Check if this was an alarm timeout or ping timeout
                    if local_alarm.is_sounding:
                        print("Woke up from ALARM TIMEOUT - stopping local alarm")
                        local_alarm.stop()
                    else:
                        print(f"Woke up from PING TIMEOUT after {manager.config.ping_interval_s}s")
                else:
                    print(f"Woke up from unknown alarm type: {type(woke_by)}")

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
            manager.persistent_state.add_persistent_state("fatal_error", time.monotonic())

            # Create a wakeup alarm for the reboot delay
            reboot_alarm = alarm.time.TimeAlarm(monotonic_time=time.monotonic() + manager.config.fatal_error_reboot_delay_s)
            
            # Choose sleep mode based on should_deep_sleep setting
            if manager.config.should_deep_sleep:
                print(f"Entering deep sleep for {manager.config.fatal_error_reboot_delay_s} seconds before attempting recovery...")
                alarm.exit_and_deep_sleep_until_alarms(reboot_alarm)
            else:
                print(f"Entering light sleep for {manager.config.fatal_error_reboot_delay_s} seconds before attempting recovery...")
                alarm.light_sleep_until_alarms(reboot_alarm)

        # Fallback: restart microcontroller if manager failed to initialize
        print("Manager failed to initialize - restarting microcontroller...")
        reset()


if __name__ == "__main__":
    main()