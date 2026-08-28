"use server";

import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { hashSync } from "bcryptjs";
import { db } from "@/db";
import { vehicles, filiais, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type ImportRowResult = {
  linha: number;
  placa: string;
  status: "criado" | "atualizado" | "duplicado" | "erro";
  mensagem?: string;
};

export type ImportState = {
  error: string | null;
  done?: boolean;
  criados?: number;
  atualizados?: number;
  duplicados?: number;
  comErro?: number;
  condutoresCriados?: number;
  rows?: ImportRowResult[];
};

const initialState: ImportState = { error: null };

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizeHeader(s: string) {
  return stripAccents(s).toLowerCase().trim().replace(/[\s_-]+/g, "");
}

const HEADER_ALIASES: Record<string, string[]> = {
  placa: ["placa"],
  marca: ["marca"],
  modelo: ["modelo"],
  ano: ["ano", "anofabricacao", "anodefabricacao", "anofab"],
  filial: ["filial", "unidade", "filialcodigo", "codigofilial"],
  km: ["km", "kmatual", "quilometragem", "kmatualkm"],
  condutor: ["condutor", "motorista", "condutordesignado", "nomedocondutor"],
  centroCusto: ["centrodecusto", "centrocusto", "cc", "ccusto"],
};

function findField(
  row: Record<string, unknown>,
  field: keyof typeof HEADER_ALIASES
): string {
  const aliases = HEADER_ALIASES[field];
  for (const key of Object.keys(row)) {
    const norm = normalizeHeader(key);
    if (aliases.includes(norm)) {
      const val = row[key];
      return val == null ? "" : String(val).trim();
    }
  }
  return "";
}

// Turns a person's name into the local part of a placeholder e-mail, e.g.
// "João Pedro de França" -> "joao.pedro.de.franca". Condutores created this
// way have no real e-mail yet — an admin fills that in later via /usuarios.
function slugifyName(name: string): string {
  const slug = stripAccents(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return slug || "condutor";
}

function makeUniqueEmail(name: string, taken: Set<string>): string {
  const base = slugifyName(name);
  let candidate = `${base}@pendente.frota`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}${n}@pendente.frota`;
    n++;
  }
  taken.add(candidate);
  return candidate;
}

// Vercel enforces a hard ~4.5MB request body limit on serverless functions
// at the platform level — next.config's bodySizeLimit does not affect it.
// A direct-to-blob client upload was tried to sidestep that, but the
// browser-to-blob-storage leg of that flow got stuck indefinitely for this
// user (very likely a network/firewall block on a different domain than
// the app itself — nothing our server ever sees or logs). Reverted to a
// plain upload straight to this server action, capped well under the
// platform limit so it always fits in one request.
const MAX_IMPORT_FILE_BYTES = 4 * 1024 * 1024; // 4MB

type NewVehicleRow = {
  linha: number;
  placa: string;
  marca: string;
  modelo: string;
  ano: number | null;
  filialId: string;
  km: number;
  condutorStr: string;
  centroCusto: string | null;
};

type BackfillRow = {
  linha: number;
  placa: string;
  vehicleId: string;
  filialId: string;
  condutorStr: string;
};

/**
 * Vehicles are imported from a file the browser posts directly to this
 * server action (multipart/form-data, no separate storage hop).
 *
 * Two things happen automatically around the "condutor" column:
 *   - A name with no matching user account gets a CONDUTOR user created on
 *     the spot (same filial as the vehicle, a placeholder @pendente.frota
 *     e-mail, a random password) — no separate manual step to register
 *     every driver before importing. Those accounts can't log in for real
 *     yet; an admin edits each one in /usuarios to set a real e-mail and
 *     password once ready.
 *   - Re-uploading a spreadsheet whose vehicles already exist (same placa)
 *     doesn't just skip them: any of those vehicles that still has no
 *     condutor assigned gets linked to the name in that row (creating the
 *     user first if needed, same as above). This is what makes it safe to
 *     fix a spreadsheet and re-run the exact same import — plates already
 *     in the system get their condutor backfilled instead of doing nothing.
 */
export async function importVehiclesAction(
  _prevState: ImportState,
  formData: FormData
): Promise<ImportState> {
  await requireUser(["ADMIN"]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...initialState, error: "Selecione um arquivo de planilha (.xlsx, .xls ou .csv)." };
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return {
      ...initialState,
      error: `Esse arquivo tem ${(file.size / 1024 / 1024).toFixed(1)}MB — o limite é 4MB. Remova abas/colunas que não sejam necessárias ou divida em planilhas menores.`,
    };
  }

  let rawRows: Record<string, unknown>[];
  try {
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    // CSV needs to go through file.text() so it's decoded as UTF-8 text first
    // — feeding raw bytes to XLSX.read as type "array" makes it fall back to
    // a codepage that mangles accented characters (e.g. "Cuiabá" becomes
    // "CuiabÃ¡"). Binary formats (.xlsx/.xls) don't have this problem since
    // SheetJS parses their internal UTF-8/UTF-16 encoding directly.
    const workbook = isCsv
      ? XLSX.read(await file.text(), { type: "string" })
      : XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { ...initialState, error: "A planilha não tem nenhuma aba com dados." };
    }
    const sheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch {
    return {
      ...initialState,
      error: "Não foi possível ler o arquivo. Confirme que é um .xlsx, .xls ou .csv válido.",
    };
  }

  if (rawRows.length === 0) {
    return { ...initialState, error: "A planilha não tem linhas de dados." };
  }

  const [allFiliais, allUsers, allVehicles] = await Promise.all([
    db.select().from(filiais),
    db.select({ id: users.id, name: users.name, email: users.email }).from(users),
    db
      .select({
        id: vehicles.id,
        placa: vehicles.placa,
        filialId: vehicles.filialId,
        assignedCondutorId: vehicles.assignedCondutorId,
      })
      .from(vehicles),
  ]);
  const takenEmails = new Set(allUsers.map((u) => u.email.toLowerCase()));

  const filialByKey = new Map<string, (typeof allFiliais)[number]>();
  for (const f of allFiliais) {
    filialByKey.set(normalizeHeader(f.nome), f);
    filialByKey.set(normalizeHeader(f.codigo), f);
  }
  // Any existing user can be a condutor match by name, not only ones already
  // flagged CONDUTOR — an admin might have registered them as something else.
  const condutorByName = new Map<string, string>();
  for (const u of allUsers) {
    condutorByName.set(normalizeHeader(u.name), u.id);
  }
  const existingVehicleByPlaca = new Map<string, (typeof allVehicles)[number]>();
  for (const v of allVehicles) {
    existingVehicleByPlaca.set(v.placa.toUpperCase(), v);
  }

  const results: ImportRowResult[] = [];
  const seenInBatch = new Set<string>();
  const newVehicleRows: NewVehicleRow[] = [];
  const backfillRows: BackfillRow[] = [];

  // Pass 1: classify every row — a brand-new vehicle to create, an existing
  // one whose condutor can be backfilled, or a duplicate/error to report as
  //-is. No DB writes happen here yet.
  rawRows.forEach((row, idx) => {
    const linha = idx + 2; // +1 for header row, +1 for 1-based
    const placa = findField(row, "placa").toUpperCase().replace(/\s+/g, "");
    const marca = findField(row, "marca");
    const modelo = findField(row, "modelo");
    const anoStr = findField(row, "ano");
    const filialStr = findField(row, "filial");
    const kmStr = findField(row, "km");
    const condutorStr = findField(row, "condutor");
    const centroCustoStr = findField(row, "centroCusto");

    if (!placa || !marca || !modelo || !filialStr) {
      results.push({
        linha,
        placa: placa || "(vazio)",
        status: "erro",
        mensagem: "Faltam campos obrigatórios (placa, marca, modelo, filial).",
      });
      return;
    }

    const filial = filialByKey.get(normalizeHeader(filialStr));
    if (!filial) {
      results.push({
        linha,
        placa,
        status: "erro",
        mensagem: `Filial "${filialStr}" não encontrada (cadastre-a antes em /filiais).`,
      });
      return;
    }

    const existing = existingVehicleByPlaca.get(placa);
    if (existing || seenInBatch.has(placa)) {
      if (existing && !existing.assignedCondutorId && condutorStr) {
        backfillRows.push({
          linha,
          placa,
          vehicleId: existing.id,
          filialId: existing.filialId,
          condutorStr,
        });
      } else {
        results.push({ linha, placa, status: "duplicado", mensagem: "Placa já cadastrada — linha ignorada." });
      }
      return;
    }

    const km = kmStr ? parseInt(kmStr.replace(/\D/g, ""), 10) : 0;
    const ano = anoStr ? parseInt(anoStr.replace(/\D/g, ""), 10) : null;

    seenInBatch.add(placa);
    newVehicleRows.push({
      linha,
      placa,
      marca,
      modelo,
      ano: Number.isNaN(ano as number) ? null : ano,
      filialId: filial.id,
      km: Number.isNaN(km) ? 0 : km,
      condutorStr,
      centroCusto: centroCustoStr || null,
    });
  });

  // Every condutor name in either group that doesn't match an existing user
  // gets created now, once per distinct name, before it's used below.
  const newCondutorInfo = new Map<string, { nome: string; filialId: string }>();
  for (const r of [...newVehicleRows, ...backfillRows]) {
    if (!r.condutorStr) continue;
    const key = normalizeHeader(r.condutorStr);
    if (condutorByName.has(key) || newCondutorInfo.has(key)) continue;
    newCondutorInfo.set(key, { nome: r.condutorStr, filialId: r.filialId });
  }

  let condutoresCriados = 0;

  await db.transaction(async (tx) => {
    if (newCondutorInfo.size > 0) {
      const entries = [...newCondutorInfo.entries()];
      const values = entries.map(([, info]) => ({
        name: info.nome,
        email: makeUniqueEmail(info.nome, takenEmails),
        passwordHash: hashSync(randomBytes(9).toString("hex"), 10),
        role: "CONDUTOR" as const,
        filialId: info.filialId,
      }));
      const inserted = await tx.insert(users).values(values).returning({ id: users.id });
      entries.forEach(([key], i) => {
        condutorByName.set(key, inserted[i].id);
      });
      condutoresCriados = inserted.length;
    }

    if (newVehicleRows.length > 0) {
      await tx.insert(vehicles).values(
        newVehicleRows.map((r) => ({
          placa: r.placa,
          marca: r.marca,
          modelo: r.modelo,
          anoFabricacao: r.ano,
          filialId: r.filialId,
          kmAtual: r.km,
          assignedCondutorId: r.condutorStr
            ? condutorByName.get(normalizeHeader(r.condutorStr)) ?? null
            : null,
          centroCusto: r.centroCusto,
        }))
      );
    }

    for (const r of backfillRows) {
      const condutorId = condutorByName.get(normalizeHeader(r.condutorStr)) ?? null;
      if (!condutorId) continue;
      await tx
        .update(vehicles)
        .set({ assignedCondutorId: condutorId })
        .where(eq(vehicles.id, r.vehicleId));
    }
  });

  for (const r of newVehicleRows) {
    const isNewCondutor =
      !!r.condutorStr && newCondutorInfo.has(normalizeHeader(r.condutorStr));
    results.push({
      linha: r.linha,
      placa: r.placa,
      status: "criado",
      mensagem: isNewCondutor
        ? `Condutor "${r.condutorStr}" não tinha cadastro — criado automaticamente como usuário Condutor (defina e-mail e senha reais em /usuarios antes que ele possa entrar pelo celular).`
        : undefined,
    });
  }
  for (const r of backfillRows) {
    const isNewCondutor = newCondutorInfo.has(normalizeHeader(r.condutorStr));
    results.push({
      linha: r.linha,
      placa: r.placa,
      status: "atualizado",
      mensagem: isNewCondutor
        ? `Veículo já cadastrado — condutor "${r.condutorStr}" não tinha cadastro, foi criado e vinculado a este veículo.`
        : `Veículo já cadastrado — condutor "${r.condutorStr}" vinculado.`,
    });
  }

  // Rows were appended out of spreadsheet order (errors/duplicates during
  // the first pass, then created and backfilled rows afterward) — put them
  // back in line-number order so the result table reads like the file.
  results.sort((a, b) => a.linha - b.linha);

  const criados = results.filter((r) => r.status === "criado").length;
  const atualizados = results.filter((r) => r.status === "atualizado").length;
  const duplicados = results.filter((r) => r.status === "duplicado").length;
  const comErro = results.filter((r) => r.status === "erro").length;

  return {
    error: null,
    done: true,
    criados,
    atualizados,
    duplicados,
    comErro,
    condutoresCriados,
    rows: results,
  };
}
