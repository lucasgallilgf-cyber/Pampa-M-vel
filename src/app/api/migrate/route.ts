import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { INCREMENTAL_MIGRATIONS } from "@/db/migration-sql";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Safe, re-runnable schema-update endpoint for a database that already has
 * real data in it. Unlike /api/setup (which truncates every table and
 * reloads demo data — never call it again once real usage has started),
 * this route ONLY applies additive statements from INCREMENTAL_MIGRATIONS
 * (e.g. "ADD COLUMN IF NOT EXISTS ..."). It never deletes or overwrites a
 * single row.
 *
 * Usage: POST /api/migrate  with header  x-setup-secret: <SETUP_SECRET>
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

  const log: string[] = [];

  for (const migration of INCREMENTAL_MIGRATIONS) {
    for (const statement of migration.statements) {
      try {
        await db.execute(sql.raw(statement));
        log.push(`[${migration.id}] aplicado: ${statement}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `Falha em ${migration.id}: ${msg}`, log },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ ok: true, log });
}
