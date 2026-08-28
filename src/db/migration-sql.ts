// Auto-generated once via `drizzle-kit generate` (drizzle/0000_curious_harrier.sql).
// Embedded here (rather than read from disk) so the /api/setup route can run it
// from inside a Vercel serverless function without relying on filesystem access
// to the drizzle/ output directory at runtime.
export const MIGRATION_SQL = `
CREATE TYPE "public"."inspection_status" AS ENUM('OK', 'COM_AVARIA');
CREATE TYPE "public"."item_status" AS ENUM('OK', 'AVARIA', 'NAO_APLICAVEL');
CREATE TYPE "public"."occurrence_status" AS ENUM('PENDENTE', 'EM_ANDAMENTO', 'RESOLVIDA');
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'GERENTE', 'SUPERVISOR', 'CONDUTOR');
CREATE TYPE "public"."signature_role" AS ENUM('CONDUTOR', 'SUPERVISOR', 'GERENTE');
CREATE TABLE "checklist_item_defs" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
CREATE TABLE "filiais" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"codigo" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "filiais_codigo_unique" UNIQUE("codigo")
);
CREATE TABLE "inspection_items" (
	"id" text PRIMARY KEY NOT NULL,
	"inspection_id" text NOT NULL,
	"item_def_id" text NOT NULL,
	"status" "item_status" DEFAULT 'OK' NOT NULL,
	"notes" text
);
CREATE TABLE "inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"performed_by_id" text NOT NULL,
	"km" integer NOT NULL,
	"status" "inspection_status" DEFAULT 'OK' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "maintenance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"occurrence_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"description" text NOT NULL,
	"status" "occurrence_status" DEFAULT 'PENDENTE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"notes" text,
	CONSTRAINT "maintenance_records_occurrence_id_unique" UNIQUE("occurrence_id")
);
CREATE TABLE "occurrences" (
	"id" text PRIMARY KEY NOT NULL,
	"inspection_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"description" text NOT NULL,
	"status" "occurrence_status" DEFAULT 'PENDENTE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolution_notes" text,
	CONSTRAINT "occurrences_inspection_id_unique" UNIQUE("inspection_id")
);
CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"inspection_item_id" text,
	"occurrence_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"occurrence_id" text NOT NULL,
	"role" "signature_role" NOT NULL,
	"user_id" text NOT NULL,
	"user_name_snap" text NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"filial_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
CREATE TABLE "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"placa" text NOT NULL,
	"modelo" text NOT NULL,
	"marca" text NOT NULL,
	"ano_fabricacao" integer,
	"filial_id" text NOT NULL,
	"km_atual" integer DEFAULT 0 NOT NULL,
	"assigned_condutor_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_placa_unique" UNIQUE("placa")
);
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_item_def_id_checklist_item_defs_id_fk" FOREIGN KEY ("item_def_id") REFERENCES "public"."checklist_item_defs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "photos" ADD CONSTRAINT "photos_inspection_item_id_inspection_items_id_fk" FOREIGN KEY ("inspection_item_id") REFERENCES "public"."inspection_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "photos" ADD CONSTRAINT "photos_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_filial_id_filiais_id_fk" FOREIGN KEY ("filial_id") REFERENCES "public"."filiais"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_filial_id_filiais_id_fk" FOREIGN KEY ("filial_id") REFERENCES "public"."filiais"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_assigned_condutor_id_users_id_fk" FOREIGN KEY ("assigned_condutor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "inspection_items_inspection_idx" ON "inspection_items" USING btree ("inspection_id");
CREATE INDEX "inspections_vehicle_idx" ON "inspections" USING btree ("vehicle_id");
CREATE INDEX "inspections_created_idx" ON "inspections" USING btree ("created_at");
CREATE INDEX "occurrences_vehicle_idx" ON "occurrences" USING btree ("vehicle_id");
CREATE INDEX "occurrences_status_idx" ON "occurrences" USING btree ("status");
CREATE UNIQUE INDEX "signatures_occurrence_role_idx" ON "signatures" USING btree ("occurrence_id","role");
CREATE INDEX "vehicles_filial_idx" ON "vehicles" USING btree ("filial_id");
`;

export const MIGRATION_STATEMENTS = MIGRATION_SQL.split(";")
  .map((s) => s.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Incremental, additive-only migrations. Unlike MIGRATION_SQL above (which is
// only ever run once by /api/setup together with a full reseed), statements
// added here are applied by the separate, non-destructive /api/migrate route
// — they must never drop/truncate/rewrite existing data. Each statement uses
// "IF NOT EXISTS" (or an equivalent idempotent guard) so /api/migrate can be
// safely re-run at any time, including against a database that already has
// real production data in it.
export const INCREMENTAL_MIGRATIONS: { id: string; statements: string[] }[] = [
  {
    id: "0001_signature_image_url",
    statements: [
      `ALTER TABLE "signatures" ADD COLUMN IF NOT EXISTS "signature_image_url" text;`,
    ],
  },
  {
    id: "0002_filiais_empresa",
    statements: [
      `ALTER TABLE "filiais" ADD COLUMN IF NOT EXISTS "empresa" text;`,
    ],
  },
  {
    id: "0003_vehicles_centro_custo",
    statements: [
      `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "centro_custo" text;`,
    ],
  },
];
