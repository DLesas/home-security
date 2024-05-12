## Stack

- React
- Next.js
- Lucia
- NEON (client database)
- S3 Bucket (Metrics/Logging)
- Drizzle (ORM)
- Tailwind (css)
- Next UI (UI Framework)
- Framer Motion (UI Animation)
- React Email (Creating Emails)
- SendGrid (Sending Emails)
- Zod (Validation)
- Zustand (Global state management)
- TanStack Query (Query/Mutations)

## TODO

- implement haveIbeenpwned free pasword checking (done)
- Configure lucia auth custom drizzle adapter (done? needs validating)
- need to change db batching into db transactions (done)
- convert postgres email column from TEXT datatype to CITEXT datatype (done)
- implement Logging to Postgres (done)
- implement verification code page (done)
- on verification page and further pages ensure user has a session and necessary JWT from primary sign up flow
- implement JWT injection in relevant pages
- finalise comapny sign up
- set themes on react toast pop up
- reimplement dark mode toggle to use global store
- install postgis to database and implement drizzle adapter for it (done)
- implement ratelimiting using redis/upstash (done)

## SQL Seed

- implement pg_stat_statements in SQL seed for all future tenants as this will determine tenant usage
- implement some sort of auditing to check who last edited a column


## Architecture

- Logs: postgres (14 days?) -> cron job -> S3
- Usage_Metrics: pg_stat_statements extension to be installed in all tenant databases

