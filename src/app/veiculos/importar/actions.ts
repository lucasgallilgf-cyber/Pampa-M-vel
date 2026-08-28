"use server";

import * as XLSX from "xlsx";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { vehicles, filiais, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type ImportRowResult = {
  linha: number;
  placa: string;
  status: "criado" | "duplicado" | "erro";
  mensagem?: string;
};

export type ImportState = {
  error: string | null;
  done?: boolean;
  criados?: number;
  duplicados?: number;
  comErro?: number;
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

// Vercel enforces a hard ~4.5MB request body limit on serverless functions
// at the platform level — next.config's bodySizeLimit does not affect it.
// A direct-to-blob client upload was tried to sidestep that, but the
// browser-to-blob-storage leg of that flow got stuck indefinitely for this
// user (very likely a network/firewall block on a different domain than
// the app itself — nothing our server ever sees or logs). Reverted to a
// plain upload straight to this server action, capped well under the
// platform limit so it always fits in one request.
const MAX_IMPORT_FILE_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * Vehicles are imported from a file the browser posts directly to this
 * server action (multipart/form-data, no separate storage hop).
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

  const [allFiliais, condutores, allVehicles] = await Promise.all([
    db.select().from(filiais),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, "CONDUTOR"), eq(users.active, true))),
    db.select({ placa: vehicles.placa }).from(vehicles),
  ]);
  const existingPlacas = new Set(allVehicles.map((v) => v.placa.toUpperCase()));

  const filialByKey = new Map<string, (typeof allFiliais)[number]>();
  for (const f of allFiliais) {
    filialByKey.set(normalizeHeader(f.nome), f);
    filialByKey.set(normalizeHeader(f.codigo), f);
  }
  const condutorByName = new Map<string, string>();
  for (const c of condutores) {
    condutorByName.set(normalizeHeader(c.name), c.id);
  }

  const results: ImportRowResult[] = [];
  const toInsert: (typeof vehicles.$inferInsert)[] = [];
  const seenInBatch = new Set<string>();

  rawRows.forEach((row, idx) => {
    const linha = idx + 2; // +1 for header row, +1 for 1-based
    const placa = findField(row, "placa").toUpperCase().replace(/\s+/g, "");
    const marca = findField(row, "marca");
    const modelo = findField(row, "modelo");
    const anoStr = findField(row, "ano");
    const filialStr = findField(row, "filial");
    const kmStr = findField(row, "km");
    const condutorStr = findField(row, "condutor");

    if (!placa || !marca || !modelo || !filialStr) {
      results.push({
        linha,
        placa: placa || "(vazio)",
        status: "erro",
        mensagem: "Faltam campos obrigatórios (placa, marca, modelo, filial).",
      });
      return;
    }
    if (existingPlacas.has(placa) || seenInBatch.has(placa)) {
      results.push({ linha, placa, status: "duplicado", mensagem: "Placa já cadastrada — linha ignorada." });
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

    const km = kmStr ? parseInt(kmStr.replace(/\D/g, ""), 10) : 0;
    const ano = anoStr ? parseInt(anoStr.replace(/\D/g, ""), 10) : null;
    const condutorId = condutorStr
      ? condutorByName.get(normalizeHeader(condutorStr)) ?? null
      : null;

    seenInBatch.add(placa);
    toInsert.push({
      placa,
      marca,
      modelo,
      anoFabricacao: Number.isNaN(ano as number) ? null : ano,
      filialId: filial.id,
      kmAtual: Number.isNaN(km) ? 0 : km,
      assignedCondutorId: condutorId,
    });
    results.push({
      linha,
      placa,
      status: "criado",
      mensagem:
        condutorStr && !condutorId
          ? `Condutor "${condutorStr}" não encontrado — veículo criado sem condutor designado.`
          : undefined,
    });
  });

  if (toInsert.length > 0) {
    await db.insert(vehicles).values(toInsert);
  }

  const criados = results.filter((r) => r.status === "criado").length;
  const duplicados = results.filter((r) => r.status === "duplicado").length;
  const comErro = results.filter((r) => r.status === "erro").length;

  return {
    error: null,
    done: true,
    criados,
    duplicados,
    comErro,
    rows: results,
  };
}
