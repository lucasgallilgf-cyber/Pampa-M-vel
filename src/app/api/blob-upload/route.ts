import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession, requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

// Mesmo critério do storage.ts: o store público (BLOB2_*) tem prioridade.
// handleUpload usa BLOB_READ_WRITE_TOKEN por padrão, que pode ser o do store
// antigo (privado) — por isso o token é passado explicitamente.
const BLOB_TOKEN =
  process.env.BLOB2_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

const PHOTO_ROLES = ["ADMIN", "SUPERVISOR", "CONDUTOR"];
// Fotos já chegam comprimidas (~100-400KB) do navegador; o teto alto só
// cobre o caso de a compressão ter falhado e a original ir direto.
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * Emite tokens de curta duração para o navegador enviar arquivos direto ao
 * Vercel Blob, sem passar pelo limite de ~4,5MB de corpo de requisição das
 * funções serverless (esse limite vale pra esta rota, que só troca um JSON
 * pequeno — o arquivo em si nunca passa por aqui).
 *
 * Dois usos:
 *  - fotos do checklist (pathname "inspecoes/..."): ADMIN, SUPERVISOR e
 *    CONDUTOR, só imagens;
 *  - importação de planilha: só ADMIN, só planilhas.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: BLOB_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        if (pathname.startsWith("inspecoes/")) {
          const session = await getSession();
          if (!session || !PHOTO_ROLES.includes(session.role)) {
            throw new Error("Não autorizado a enviar fotos.");
          }
          return {
            allowedContentTypes: [
              "image/jpeg",
              "image/png",
              "image/webp",
              "image/heic",
              "image/heif",
            ],
            addRandomSuffix: true,
            maximumSizeInBytes: MAX_PHOTO_BYTES,
          };
        }

        await requireUser(["ADMIN"]);
        return {
          allowedContentTypes: [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv",
            "application/octet-stream",
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: 20 * 1024 * 1024,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha no upload." },
      { status: 400 }
    );
  }
}
