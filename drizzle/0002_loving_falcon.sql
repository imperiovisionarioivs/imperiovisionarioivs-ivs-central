CREATE TYPE "public"."proposal_status" AS ENUM('rascunho', 'enviada', 'aceita', 'recusada');--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"root_id" integer NOT NULL,
	"revision_number" integer DEFAULT 1 NOT NULL,
	"is_latest" boolean DEFAULT true NOT NULL,
	"status" "proposal_status" DEFAULT 'rascunho' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"value_cents" integer,
	"valid_until" text DEFAULT '' NOT NULL,
	"created_by_id" integer,
	"created_by_name" text DEFAULT 'Sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposals_client_idx" ON "proposals" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "proposals_root_idx" ON "proposals" USING btree ("root_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_latest_per_root_idx" ON "proposals" USING btree ("root_id") WHERE "proposals"."is_latest" = true;