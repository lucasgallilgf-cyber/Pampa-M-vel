import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { createId } from "./id";

// O store original ("frota-checklist-blob") foi criado como Private, e o
// modo de acesso de um store não pode ser mudado depois de criado. Como o
// app inteiro assume acesso público (exibe as fotos direto via <img>, sem
// URL assinada), foi criado um segundo store público
// ("frota-checklist-blob-public", variáveis com prefixo BLOB2_) e o token
// dele é usado com prioridade. BLOB_READ_WRITE_TOKEN fica como fallback só
// para não quebrar caso as variáveis BLOB2_* sejam removidas no futuro.
const BLOB_TOKEN =
  process.env.BLOB2_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Stores an uploaded photo and returns a public URL.
 * In production (Vercel), uses Vercel Blob when a read-write token is set.
 * Otherwise falls back to writing into /public/uploads (local dev only —
 * the filesystem is not persistent/writable on Vercel serverless).
 */
export async function storePhoto(file: File, folder: string): Promise<string> {
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const filename = `${folder}/${createId()}.${ext}`;

  if (BLOB_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
      token: BLOB_TOKEN,
    });
    return blob.url;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Armazenamento de fotos não configurado: adicione um Vercel Blob store ao projeto (Storage → Blob) para habilitar upload de fotos em produção."
    );
  }

  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const localName = `${createId()}.${ext}`;
  await writeFile(path.join(dir, localName), buffer);
  return `/uploads/${folder}/${localName}`;
}
