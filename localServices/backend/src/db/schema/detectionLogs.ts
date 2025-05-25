import { pgTable, serial, text, timestamp, real } from 'drizzle-orm/pg-core';

export const detectionLogs = pgTable('detectionLogs', {
  id: serial('id').primaryKey(),
  detectedClass: text('detectedClass').notNull(),
  model: text('model').notNull(),
  confidence: real('confidence').notNull(),
  dateTime: timestamp('date_time', { withTimezone: true })
    .notNull()
    .defaultNow()
});
