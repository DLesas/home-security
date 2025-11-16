import board
import pwmio
import digitalio
import time
import alarm

class LocalAlarm:
    """
    Manages a simple local alarm component, like a piezo buzzer, with a built-in timeout.
    """
    def __init__(self, pin_name: str, timeout_s: int):
        """
        Initializes the LocalAlarm on a given pin with a max duration.
        Args:
            pin_name (str): The name of the board pin the buzzer is connected to (e.g., "GP5").
            timeout_s (int): The maximum number of seconds the alarm will sound.
        """
        self.buzzer_pin = getattr(board, pin_name)
        self.pwm = None
        self.timeout_s = timeout_s
        self.alarm_start_time = None
        self.is_sounding = False

    def start(self):
        """
        Turns the buzzer on and records the start time for the timeout.
        """
        if not self.is_sounding:
            print("Local alarm STARTED.")
            if not self.pwm:
                self.pwm = pwmio.PWMOut(self.buzzer_pin, frequency=5000, duty_cycle=65535)
            self.pwm.duty_cycle = 65535
            self.is_sounding = True
            self.alarm_start_time = time.monotonic()

    def stop(self):
        """
        Turns the buzzer off and clears the start time.
        """
        if self.is_sounding:
            print("Local alarm STOPPED.")
            if self.pwm:
                self.pwm.duty_cycle = 0
                self.pwm.deinit()
                self.pwm = None
                
                # Extra pin cleanup
                pin = digitalio.DigitalInOut(self.buzzer_pin)
                pin.direction = digitalio.Direction.INPUT
                pin.pull = digitalio.Pull.DOWN
                pin.deinit()
                
            self.is_sounding = False
            self.alarm_start_time = None

    def get_timeout_alarm(self):
        """
        If the alarm is sounding, returns a TimeAlarm object that will trigger
        when the timeout is reached. Otherwise, returns None.
        """
        if not self.is_sounding or self.alarm_start_time is None:
            return None

        elapsed = time.monotonic() - self.alarm_start_time
        if elapsed >= self.timeout_s - 5:
            self.stop()
            return None
        
        remaining_time = self.timeout_s - elapsed
        return alarm.time.TimeAlarm(monotonic_time=time.monotonic() + remaining_time) 