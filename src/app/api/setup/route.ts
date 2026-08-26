import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { MIGRATION_STATEMENTS } from "@/db/migration-sql";
import { seedDatabase } from "@/db/seed-logic";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ⚠️ DESTRUCTIVE. One-time bootstrap for a FRESHLY provisioned, EMPTY
 * production database: creates the schema and then TRUNCATES every core
 * table before loading demo data (150 vehicles, filiais, ~24 users). This
 * wipes all real data (real vehicles, users, checklists, occurrences) if run
 * again after the app has real usage — never call this a second time on a
 * database that matters. For any later, safe schema change use /api/migrate
 * instead, which never truncates or deletes anything.
 *
 * Usage: POST /api/setup  with headers
 *   x-setup-secret: <SETUP_SECRET>
 *   x-confirm-wipe: SIM
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SETUP_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SETUP_SECRET não configurado no ambiente." },
      { status: 500 }
    );
  }
  const provided = req.headers.get("x-setup-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (req.headers.get("x-confirm-wipe") !== "SIM") {
    return NextResponse.json(
      {
        error:
          "Esta rota apaga TODOS os dados (veículos, usuários, checklists, ocorrências) antes de recarregar os dados de demonstração. Para confirmar que é isso mesmo que você quer, envie também o header x-confirm-wipe: SIM. Para apenas atualizar o schema (sem apagar nada), use /api/migrate.",
      },
      { status: 400 }
    );
  }

  const log: string[] = [];
  const push = (m: string) => log.push(m);

  push("Aplicando schema...");
  let created = 0;
  let skipped = 0;
  for (const statement of MIGRATION_STATEMENTS) {
    try {
      await db.execute(sql.raw(statement));
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists/i.test(msg)) {
        skipped++;
      } else {
        return NextResponse.json(
          { error: `Falha ao aplicar schema: ${msg}`, log },
          { status: 500 }
        );
      }
    }
  }
  push(`Schema: ${created} statements aplicados, ${skipped} já existiam.`);

  try {
    const result = await seedDatabase(push);
    return NextResponse.json({ ok: true, log, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Falha no seed: ${msg}`, log }, { status: 500 });
  }
}
