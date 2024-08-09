import 'server-only'

import sgMail, { MailDataRequired } from "@sendgrid/mail";
sgMail.setApiKey(process.env.NEXT_PRIVATE_SENDGRID_API_KEY!);

let nodemailer = require("nodemailer");
let aws = require("@aws-sdk/client-ses");
let { defaultProvider } = require("@aws-sdk/credential-provider-node");

const ses = new aws.SES({
  apiVersion: "2010-12-01",
  region: "eu-west-2",
  defaultProvider,
});

// create Nodemailer SES transporter
let transporter = nodemailer.createTransport({
  SES: { ses, aws },
});

type SendEmailFunc = (
  to: string,
  subject: string,
  body: string,
) => Promise<"success" | Error>;

/**
 * Sends an email to the specified recipient via sendgrid.
 *
 * @param {string} to - The email address of the recipient.
 * @param {string} subject - The subject of the email.
 * @param {string} body - The body of the email.
 * @return {Promise<"success" | Error>} A promise that resolves to "success" if the email is sent successfully, or rejects with an error if there was a failure.
 */
export const sendMail: SendEmailFunc = async (to, subject, body) => {
  const msg: MailDataRequired = {
    to,
    from: process.env.EMAIL_SENT_FROM!,
    subject,
    html: body,
  };
  try {
    await sgMail.send(msg);
    console.info(`Message send success: ${to}`);
    return "success";
  } catch (error) {
    throw new Error(`Message send failed: ${to}: ${error}`);
  }
};

/**
 * Sends an email using Nodemailer to the specified recipient.
 *
 * @param {string} to - The email address of the recipient.
 * @param {string} subject - The subject of the email.
 * @param {string} body - The body of the email.
 * @return {Promise<"success" | Error>} A promise that resolves to "success" if the email is sent successfully, or rejects with an error if there was a failure.
 */
export const sendMailNodemailer: SendEmailFunc = async (to, subject, body) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_SENT_FROM!,
      to,
      subject,
      html: body,
    });
    console.info(`Message send success: ${to}`);
    return "success";
  } catch (error) {
    throw new Error(`Message send failed: ${to}: ${error}`);
  }
};
