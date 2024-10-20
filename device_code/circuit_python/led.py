class Led:
    def __init__(self):
        self.led = digitalio.DigitalInOut(board.LED)
        self.led.direction = digitalio.Direction.OUTPUT
        self.fatal_error = False
   
    def blink(self, times: int, delay: float = 0.1):
        """
        Blink the LED at a specified rate.

        Args:
            times (int): Number of blinks.
        Returns:
            Timer: The initialized timer object for blinking.
        """
        for _ in range(times):
            self.led.value = not self.led.value
            time.sleep(delay)
            self.led.value = not self.led.value
            time.sleep(delay)

    def turn_off_led(self):
        """
        Turn off the LED.
        """
        if self.fatal_error:
            return
        self.led.value = False

    def turn_on_led(self):
        """
        Turn on the LED.
        """
        self.led.value = True