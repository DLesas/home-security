from devices import alarms
import requests as r
import win32com.client as win32
import boto3

test = False

# Create an SNS client


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


def send_mail(body: str, subject: str):
    # Ensure the Outlook object is created in the current thread context
    outlook = win32.Dispatch("outlook.application")
    mail = outlook.CreateItem(0)
    if test:
        mail.To = "dlesas@hotmail.com"
    else:
        mail.To = "dlesas@hotmail.com; deborah@leabeater.co.uk; david.leabeater57@icloud.com; victoria.leabeater@gmail.com"
    #mail.To = "dlesas@hotmail.com"
    mail.Subject = subject
    mail.Body = body
    mail.Send()


def send_SMS(body: str):
    sns_client = boto3.client('sns')
    phones = ['+447810570861', '+447825514688', '+447771594191', '+447854972536'] # '07854972536'
    testPhone = '+447810570861'
    if test:
        try:
            response = sns_client.publish(
                PhoneNumber=testPhone,
                Message=body
            )
        except Exception as e:
            print(e)
    else:
        for phone in phones:
            try:
                response = sns_client.publish(
                    PhoneNumber=phone,
                    Message=body
                )
            except Exception as e:
                print(e)


