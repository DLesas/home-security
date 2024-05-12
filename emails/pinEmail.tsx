import { Section, Text } from '@react-email/components'
import React from 'react'
import ActionEmail from './shared/actionEmail'

interface ConfirmEmailProps {
  firstName: string
  validationCode: string
}

export default function pinEmail({
  firstName,
  validationCode,
}: ConfirmEmailProps) {
  return (
    // TODO: Insert link to confirm email page in case user is not logged in
    <ActionEmail>
      <Text style={heroText}>
        Hi {firstName}, your confirmation code is below, it is valid for the
        next 30 minutes - please enter it in your open browser window and we'll
        help you get signed in.
      </Text>
      <Section style={codeBox}>
        <Text style={confirmationCodeText}>
          {validationCode ? validationCode : 'preview lol'}
        </Text>
      </Section>
      <Text style={text}>
        If you didn't request this email, there's nothing to worry about, you
        can safely ignore it.
      </Text>
    </ActionEmail>
  )
}

const heroText = {
  fontSize: '20px',
  lineHeight: '28px',
  marginBottom: '30px',
}

const codeBox = {
  background: 'rgb(245, 244, 245)',
  borderRadius: '4px',
  marginBottom: '30px',
  padding: '40px 10px',
}

const confirmationCodeText = {
  fontSize: '30px',
  textAlign: 'center' as const,
  verticalAlign: 'middle',
}

const text = {
  color: '#000',
  fontSize: '14px',
  lineHeight: '24px',
}
