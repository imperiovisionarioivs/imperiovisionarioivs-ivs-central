CREATE TYPE "public"."asset_category" AS ENUM('dominio', 'hospedagem', 'site', 'landing_page', 'painel', 'instagram', 'facebook', 'google_meu_negocio', 'google_analytics', 'search_console', 'google_ads', 'meta_ads', 'whatsapp_business', 'email_profissional', 'design', 'drive_arquivos', 'codigo_repositorio', 'outro');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('a_configurar', 'em_configuracao', 'ativo', 'em_manutencao', 'pendente_cliente', 'cancelado');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" "asset_category" DEFAULT 'outro' NOT NULL,
	"status" "asset_status" DEFAULT 'a_configurar' NOT NULL,
	"main_link" text DEFAULT '' NOT NULL,
	"admin_link" text DEFAULT '' NOT NULL,
	"vault_link" text DEFAULT '' NOT NULL,
	"login_email" text DEFAULT '' NOT NULL,
	"domain_identifier" text DEFAULT '' NOT NULL,
	"platform" text DEFAULT '' NOT NULL,
	"technical_info" text DEFAULT '' NOT NULL,
	"renewal_date" text DEFAULT '' NOT NULL,
	"recurring_value_cents" integer,
	"backup_confirmed" boolean DEFAULT false NOT NULL,
	"client_approval" boolean DEFAULT false NOT NULL,
	"responsible_id" integer,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_id" integer,
	"created_by_name" text DEFAULT 'Sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_client_idx" ON "assets" USING btree ("client_id");