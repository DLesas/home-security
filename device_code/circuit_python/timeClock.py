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
        ntp = adafruit_ntp.NTP(self.deviceWifi.pool, server='pool.ntp.org', tz_offset=0, cache_seconds=3600)
        rtc.RTC().datetime = ntp.datetime
        