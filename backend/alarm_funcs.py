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
        ip = alarm["potentialIP"]
        ret = 0
        while ret == 0:
            res = r.get(f"http://{ip}" + "/alarm/on")
            try:
                retu = res.json()
                print(retu)
                ret = retu["state"]
            except Exception as e:
                print(e)

def send_mail(body: str, subject: str):
    # Ensure the Outlook object is created in the current thread context
    outlook = win32.Dispatch("outlook.application")
    mail = outlook.CreateItem(0)
    mail.To = "***REMOVED_EMAIL***; ***REMOVED_EMAIL***; ***REMOVED_EMAIL***; ***REMOVED_EMAIL***"
    mail.Subject = subject
    mail.Body = body
    mail.Send()

