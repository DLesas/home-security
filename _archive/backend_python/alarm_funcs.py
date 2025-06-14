from devices import alarms
import requests as r
import win32com.client as win32
import boto3
import time

test = False
if test:
    print('testing mode activated')

# Create an SNS client
sns_client = boto3.client("sns")

triggering = False  # This is a global variable that is used to determine if the alarm should be triggered. If it is true, the alarm will be triggered. If it is false, the alarm sequence will be turned off entierly.


def turnOffAlarmsUseCase():
    global triggering
    triggering = False
    turnOffAlarms()


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
        if not test:
            while ret == 0:
                res = r.get(f"http://{ip}" + "/alarm/on")
                try:
                    retu = res.json()
                    print(retu)
                    ret = retu["state"]
                except Exception as e:
                    print(e)


def turnOnAlarmsUseCase():
    global triggering
    triggering = True
    print("alarm temporarily on for warning")
    turnOnAlarms()
    initial_t_end = time.time() + 0.5
    while time.time() < initial_t_end:
        if triggering is False:
            turnOffAlarms()
            break
    turnOffAlarms()
    print("alarm off for 3 seconds for warning")
    seconnd_t_end = time.time() + 3
    while time.time() < seconnd_t_end:
        if triggering is False:
            break
    if triggering:
        print("alarm fully on")
        turnOnAlarms()
    triggering = False


def send_mail(body: str, subject: str):
    # Ensure the Outlook object is created in the current thread context
    outlook = win32.Dispatch("outlook.application")
    newMail = outlook.CreateItem(0)
    if test:
        newMail.To = "REDACTED"
    else:
        newMail.To = "REDACTED"
    # mail.To = "***REMOVED_EMAIL***"
    newMail.Subject = subject
    newMail.Body = body
    newMail.Send()


def send_SMS(body: str):
    phones = [
        "REDACTED",
        "REDACTED",
    ]
    testPhone = "REDACTED"
    if test:
        pass
        # try:
        #     response = sns_client.publish(PhoneNumber=testPhone, Message=body)
        # except Exception as e:
        #     print(e)
    else:
        for phone in phones:
            try:
                response = sns_client.publish(PhoneNumber=phone, Message=body)
            except Exception as e:
                print(e)
