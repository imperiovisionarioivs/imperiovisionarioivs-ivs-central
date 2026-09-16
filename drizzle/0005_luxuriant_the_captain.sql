CREATE TYPE "public"."expense_category" AS ENUM('equipe_folha', 'ferramentas_software', 'midia_paga', 'impostos_taxas', 'escritorio_infra', 'comissoes', 'outro');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('ativo', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('pix', 'cartao_credito', 'cartao_debito', 'boleto', 'dinheiro', 'transferencia', 'outro');--> statement-breakpoint
ALTER TYPE "public"."charge_status" ADD VALUE 'parcial' BEFORE 'pago';--> statement-breakpoint
CREATE TABLE "charge_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"charge_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" DEFAULT 'outro' NOT NULL,
	"installments" integer,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"paid_at" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by_id" integer,
	"created_by_name" text DEFAULT 'Sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "expense_category" DEFAULT 'outro' NOT NULL,
	"description" text NOT NULL,
	"value_cents" integer NOT NULL,
	"expense_date" text NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"status" "expense_status" DEFAULT 'ativo' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_id" integer,
	"created_by_name" text DEFAULT 'Sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "charge_payments" ADD CONSTRAINT "charge_payments_charge_id_financial_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."financial_charges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_payments" ADD CONSTRAINT "charge_payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charge_payments_charge_idx" ON "charge_payments" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expense_date");