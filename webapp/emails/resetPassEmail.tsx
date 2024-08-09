import { Button, Section, Text } from '@react-email/components'
import React from 'react'
import ActionEmail from './shared/actionEmail'

interface ConfirmEmailProps {
  resetUrl: string
  firstName: string
}

export default function pinEmail({ firstName, resetUrl }: ConfirmEmailProps) {
  return (
    <ActionEmail>
      <Text style={heroText}>
        Hi {firstName}, your confirmation code is below, it is valid for the
        next 30 minutes - please enter it in your open browser window and we'll
        help you get signed in.
      </Text>
      <Section className="flex flex-row justify-center" style={codeBox}>
        <Button
          className="rounded-md bg-blue-200 p-2 px-4"
          href={resetUrl ? resetUrl : 'lol'}
        >
          {' '}
          reset password{' '}
        </Button>
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
