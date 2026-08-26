import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Issues short-lived client tokens so the browser can upload files straight
 * to Vercel Blob storage, bypassing Vercel's ~4.5MB request body limit for
 * serverless functions (that limit applies to this route's own tiny JSON
 * exchange, not to the file — the file itself never passes through here).
 * Used by the planilha (spreadsheet) import flow.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
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
      onUploadCompleted: async () => {
        // No server-side action needed here — the browser gets the blob URL
        // back directly and hands it to importVehiclesFromUrlAction.
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
