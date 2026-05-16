import { pgTable, text, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';

/**
 * Single-user app for v1 — every row carries user_id = 'me'. Adding multi-tenant
 * support later means adding a users table + auth + scoping these queries.
 */

export const profile = pgTable('profile', {
  userId: text('user_id').primaryKey().default('me'),
  resume: text('resume').notNull().default(''),
  introLetter: text('intro_letter').notNull().default(''),
  hints: text('hints').notNull().default(''),
  preferences: jsonb('preferences')
    .$type<{
      titleKeywords?: string[];
      locations?: string[];
      excludeKeywords?: string[];
      remoteOnly?: boolean;
      minSalary?: number;
    }>()
    .notNull()
    .default({}),
  parsedProfile: jsonb('parsed_profile'),
  providerOverride: text('provider_override').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(), // `${source}-${externalId|url}` — matches the existing client-side jobId
  userId: text('user_id').notNull().default('me'),
  source: text('source').notNull(),
  externalId: text('external_id'),
  url: text('url').notNull(),
  title: text('title').notNull(),
  company: text('company').notNull(),
  location: text('location'),
  description: text('description'),
  payload: jsonb('payload'), // techStack, requirements, niceToHaves, salary, remote, postedAt, etc.
  status: text('status').notNull().default('saved'),
  rating: integer('rating'),
  reasoning: text('reasoning'),
  strengths: jsonb('strengths').$type<string[]>().notNull().default([]),
  gaps: jsonb('gaps').$type<string[]>().notNull().default([]),
  letter: jsonb('letter').$type<{ subject: string; body: string } | null>(),
  tailor: jsonb('tailor'),
  savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
