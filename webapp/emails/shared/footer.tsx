import { Column, Img, Link, Row, Section, Text } from '@react-email/components'

export default function footer() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : ''

  return (
    <>
      <Section>
        <Row style={footerLogos}>
          <Column style={{ width: '66%' }}>
            <Img
              src={`${baseUrl}/static/slack-logo.png`}
              width="120"
              height="36"
              alt="Slack"
            />
          </Column>
          <Column>
            <Section>
              <Row>
                <Column>
                  <Link href="/">
                    <Img
                      src={`${baseUrl}/static/slack-twitter.png`}
                      width="32"
                      height="32"
                      alt="Slack"
                      style={socialMediaIcon}
                    />
                  </Link>
                </Column>
                <Column>
                  <Link href="/">
                    <Img
                      src={`${baseUrl}/static/slack-facebook.png`}
                      width="32"
                      height="32"
                      alt="Slack"
                      style={socialMediaIcon}
                    />
                  </Link>
                </Column>
                <Column>
                  <Link href="/">
                    <Img
                      src={`${baseUrl}/static/slack-linkedin.png`}
                      width="32"
                      height="32"
                      alt="Slack"
                      style={socialMediaIcon}
                    />
                  </Link>
                </Column>
              </Row>
            </Section>
          </Column>
        </Row>
      </Section>

      <Section>
        <Link
          style={footerLink}
          href="https://slackhq.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Our blog
        </Link>
        &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
        <Link
          style={footerLink}
          href="https://slack.com/legal"
          target="_blank"
          rel="noopener noreferrer"
        >
          Policies
        </Link>
        &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
        <Link
          style={footerLink}
          href="https://slack.com/help"
          target="_blank"
          rel="noopener noreferrer"
        >
          Help center
        </Link>
        &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
        <Link
          style={footerLink}
          href="https://slack.com/community"
          target="_blank"
          rel="noopener noreferrer"
          data-auth="NotApplicable"
          data-linkindex="6"
        >
          Slack Community
        </Link>
        <Text style={footerText}>
          ©2022 Slack Technologies, LLC, a Salesforce company. <br />
          500 Howard Street, San Francisco, CA 94105, USA <br />
          <br />
          All rights reserved.
        </Text>
      </Section>
    </>
  )
}

const footerText = {
  fontSize: '12px',
  color: '#b7b7b7',
  lineHeight: '15px',
  textAlign: 'left' as const,
  marginBottom: '50px',
}

const footerLink = {
  color: '#b7b7b7',
  textDecoration: 'underline',
}

const footerLogos = {
  marginBottom: '32px',
  paddingLeft: '8px',
  paddingRight: '8px',
  width: '100%',
}

const socialMediaIcon = {
  display: 'inline',
  marginLeft: '32px',
}
