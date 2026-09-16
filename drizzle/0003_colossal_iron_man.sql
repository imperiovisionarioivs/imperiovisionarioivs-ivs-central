CREATE TYPE "public"."charge_status" AS ENUM('pendente', 'pago', 'atrasado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."charge_type" AS ENUM('mensalidade', 'anual', 'ajuste', 'outro');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('rascunho', 'enviado', 'assinado', 'encerrado');--> statement-breakpoint
CREATE TYPE "public"."subscription_cycle" AS ENUM('mensal', 'anual');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ativa', 'pausada', 'cancelada');--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"proposal_id" integer,
	"title" text DEFAULT '' NOT NULL,
	"status" "contract_status" DEFAULT 'rascunho' NOT NULL,
	"value_cents" integer,
	"signed_at" timestamp with time zone,
	"signer_name" text DEFAULT '' NOT NULL,
	"signature_provider" text DEFAULT '' NOT NULL,
	"signature_reference" text DEFAULT '' NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"end_date" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_id" integer,
	"created_by_name" text DEFAULT 'Sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"subscription_id" integer,
	"type" charge_type DEFAULT 'outro' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"value_cents" integer NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"status" charge_status DEFAULT 'pendente' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_by_id" integer,
	"created_by_name" text DEFAULT 'Sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"contract_id" integer,
	"name" text DEFAULT '' NOT NULL,
	"monthly_value_cents" integer NOT NULL,
	"billing_cycle" "subscription_cycle" DEFAULT 'mensal' NOT NULL,
	"annual_discount_months" integer DEFAULT 2 NOT NULL,
	"status" "subscription_status" DEFAULT 'ativa' NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"created_by_id" integer,
	"created_by_name" text DEFAULT 'Sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_charges" ADD CONSTRAINT "financial_charges_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_charges" ADD CONSTRAINT "financial_charges_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_charges" ADD CONSTRAINT "financial_charges_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contracts_client_idx" ON "contracts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "financial_charges_client_idx" ON "financial_charges" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "financial_charges_subscription_idx" ON "financial_charges" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_client_idx" ON "subscriptions" USING btree ("client_id");