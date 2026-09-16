CREATE TYPE "public"."priority" AS ENUM('alta', 'media', 'baixa');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'comercial', 'producao');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('nao_contatado', 'visitado', 'whatsapp_enviado', 'reuniao', 'proposta', 'fechado', 'perdido');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"actor_id" integer,
	"actor_name" text DEFAULT 'Sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"niche" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"stage" "stage" DEFAULT 'nao_contatado' NOT NULL,
	"priority" "priority" DEFAULT 'media' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"site_status" text DEFAULT 'Não verificado' NOT NULL,
	"instagram" text DEFAULT '' NOT NULL,
	"instagram_status" text DEFAULT 'Pendente' NOT NULL,
	"google_rating" integer,
	"google_reviews" integer,
	"google_visibility" text DEFAULT 'Pendente' NOT NULL,
	"diagnosis" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"next_action" text DEFAULT '' NOT NULL,
	"next_action_date" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"owner_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'comercial' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");