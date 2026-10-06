CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"account_id" string NOT NULL,
	"provider_id" string NOT NULL,
	"password" string,
	"access_token" string,
	"refresh_token" string,
	"id_token" string,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" string,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_accounts_provider_account_idx" UNIQUE("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" string NOT NULL,
	"count" int4 NOT NULL,
	"last_request" int8 NOT NULL,
	CONSTRAINT "auth_rate_limits_key_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"token" string NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" string,
	"user_agent" string,
	CONSTRAINT "auth_sessions_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" string NOT NULL,
	"value" string NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" bool DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" string;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" ("identifier");--> statement-breakpoint
-- Better Auth normalizes email addresses. Existing case collisions fail the
-- migration instead of silently linking two distinct accounts.
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
--> statement-breakpoint
INSERT INTO "auth_accounts" ("user_id", "account_id", "provider_id", "password")
SELECT "id", "id"::string, 'credential', "password" FROM "users" WHERE "deleted_at" IS NULL
ON CONFLICT ("provider_id", "account_id") DO NOTHING;
