import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logError } from "./shared/db/db";

export const numbers = [
  { name: "Vi", number: "000000000000", email: "vi@example.com" },
  { name: "Deb", number: "000000000000", email: "deb@example.com" },
  { name: "Dav", number: "000000000000", email: "dav@example.com" },
];

const sns = new SNSClient({
  region: "eu-west-2",
});

const ses = new SESClient({
  region: "eu-west-2",
});

export async function sendSMS(
  phoneNumber: string,
  message: string,
  title?: string
) {
  const fullMessage = title ? `[${title}]\n\n${message}` : message;

  const params = {
    Message: fullMessage,
    PhoneNumber: phoneNumber,
    MessageAttributes: {
      "AWS.SNS.SMS.SenderID": {
        DataType: "String",
        StringValue: "SECURITY",
      },
    },
  };
  try {
    await sns.send(new PublishCommand(params));
  } catch (error) {
    await logError("eventService:Dummy-publish:sendSMS", error as Error);
    console.error("Failed to send SMS:", error);
    throw error;
  }
}

export async function sendEmailSES(to: string, subject: string, body: string) {
  const params = {
    Destination: { ToAddresses: [to] },
    Message: {
      Body: { Text: { Data: body } },
      Subject: { Data: subject },
    },
    Source: "Security@lesas.dev",
  };

  try {
    const result = await ses.send(new SendEmailCommand(params));
    console.log("Email sent! Message ID:", result.MessageId);
  } catch (error) {
    await logError("eventService:Dummy-publish:sendEmailSES", error as Error);
    console.error("Failed to send email:", error);
    throw error;
  }
}
