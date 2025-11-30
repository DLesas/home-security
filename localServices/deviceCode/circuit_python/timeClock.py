from deviceWifi import require_connection
import adafruit_ntp
import rtc


class TimeClock:
    def __init__(self, Logger, Led, deviceWifi):
        self.Logger = Logger
        self.deviceWifi = deviceWifi
        self.Led = Led
    
    @require_connection
    def set_time_ntp(self):
        try:
            self.Led.blink(2)
            self.Led.turn_on_led()
            ntp = adafruit_ntp.NTP(self.deviceWifi.pool, server='pool.ntp.org', tz_offset=0, cache_seconds=3600)
            rtc.RTC().datetime = ntp.datetime
            self.Logger.log_issue("Info", self.__class__.__name__, "set_time_ntp", f"Time successfully set via NTP: {rtc.RTC().datetime}")
            print("Time successfully set via NTP.")
        except Exception as e:
            self.Logger.log_issue("Error", self.__class__.__name__, "set_time_ntp", f"Failed to set time from NTP: {e}")
            print(f"Failed to set time from NTP: {e}")
        finally:
            self.Led.turn_off_led()
        