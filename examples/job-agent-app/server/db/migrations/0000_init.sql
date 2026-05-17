CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT 'me' NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"description" text,
	"payload" jsonb,
	"status" text DEFAULT 'saved' NOT NULL,
	"rating" integer,
	"reasoning" text,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"letter" jsonb,
	"tailor" jsonb,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY DEFAULT 'me' NOT NULL,
	"resume" text DEFAULT '' NOT NULL,
	"intro_letter" text DEFAULT '' NOT NULL,
	"hints" text DEFAULT '' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parsed_profile" jsonb,
	"provider_override" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
