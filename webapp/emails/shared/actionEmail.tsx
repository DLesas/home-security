import {
  Body,
  Container,
  Column,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Tailwind,
  Section,
  Text,
} from '@react-email/components'
import Footer from './footer'

interface SlackConfirmEmailProps {
  children: React.ReactNode
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : ''

const SlackConfirmEmail = ({ children }: SlackConfirmEmailProps) => (
  <Html>
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: '#007291',
            },
          },
        },
      }}
    >
      <Head />
      <Preview>Confirm your email address</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src={`${baseUrl}/static/slack-logo.png`}
              width="120"
              height="36"
              alt="Slack"
            />
          </Section>
          <Heading style={h1}>Confirm your email address</Heading>
          {children}
          <Footer></Footer>
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

export default SlackConfirmEmail


const main = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '0px 20px',
}

const logoContainer = {
  marginTop: '32px',
}

const h1 = {
  color: '#1d1c1d',
  fontSize: '36px',
  fontWeight: '700',
  margin: '30px 0',
  padding: '0',
  lineHeight: '42px',
}
