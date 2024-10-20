from .wifi import require_connection

class TimeClock:
    def __init__(self, Logger, Led, Wifi):
        self.Wifi = Wifi
        self.Logger = logger
        self.Led = Led
    
    @require_connection
    def set_time_ntp(self):
        ntp = adafruit_ntp.NTP(self.Wifi.pool, server='pool.ntp.org', tz_offset=0, cache_seconds=3600)
        rtc.RTC().datetime = ntp.datetime
        