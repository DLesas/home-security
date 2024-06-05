from devices import alarms
import requests as r


def turnOffAlarms():
    for alarm in alarms:
        print("alarm off")
        ip = alarm["potentialIP"]
        ret = 1
        while ret == 1:
            res = r.get(f"http://{ip}" + "/alarm/off")
            try:
                retu = res.json()
                print(retu)
                ret = retu["state"]
            except Exception as e:
                print(e)


def turnOnAlarms():
    for alarm in alarms:
        print("alarm on")
        # ip = alarm["potentialIP"]
        # ret = 0
        # while ret == 0:
        #     res = r.get(f"http://{ip}" + "/alarm/on")
        #     try:
        #         retu = res.json()
        #         print(retu)
        #         ret = retu["state"]
        #     except Exception as e:
        #         print(e)
