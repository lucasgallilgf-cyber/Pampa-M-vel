"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { submitChecklistAction, ChecklistFormState } from "./actions";
import { formatKm } from "@/lib/domain";

type ItemDef = { id: string; label: string; category: string; order: number };
type Vehicle = {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  kmAtual: number;
  filialNome: string | null;
};

type ItemUiState = { status: "OK" | "AVARIA"; notes: string };

const initialState: ChecklistFormState = { error: null };

// Fotos tiradas direto da câmera do celular costumam vir com vários MB cada
// (às vezes 8-10MB). Enviar várias assim de uma vez em uma conexão de
// celular é lento e propenso a falhar no meio do envio (aparecendo como
// "página não carregou", sem nenhum erro do lado do servidor). Por isso,
// antes de montar o FormData de envio, cada foto é redimensionada e
// recomprimida no próprio aparelho — isso normalmente reduz o arquivo para
// algumas dezenas/centenas de KB, sem perda perceptível de qualidade para o
// propósito de registrar o estado do veículo.
//
// O checklist tem ~26 itens — mesmo comprimida, uma foto em quase todo item
// ainda pode somar mais do que o limite de ~4,5MB que a Vercel aplica no
// nível de rede (antes mesmo de o envio chegar no código do site). Por isso
// o tamanho aqui é mais conservador que o usado na importação de planilha
// (que lida com um único arquivo), e o total após comprimir também é
// checado antes de enviar (ver MAX_TOTAL_UPLOAD_BYTES no handleSubmit).
async function compressImage(
  file: File,
  maxDim = 1280,
  quality = 0.6
): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);

    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // Se algo der errado ao comprimir (formato não suportado etc.), envia o
    // arquivo original em vez de bloquear o checklist.
    return file;
  }
}

export default function ChecklistForm({
  vehicle,
  itemDefs,
  categories,
}: {
  vehicle: Vehicle;
  itemDefs: ItemDef[];
  categories: string[];
}) {
  const [state, formAction, isPending] = useActionState(
    submitChecklistAction,
    initialState
  );
  const [items, setItems] = useState<Record<string, ItemUiState>>(() =>
    Object.fromEntries(itemDefs.map((d) => [d.id, { status: "OK", notes: "" }]))
  );
  const [km, setKm] = useState(String(vehicle.kmAtual));
  const [isCompressing, setIsCompressing] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const avariaCount = useMemo(
    () => Object.values(items).filter((i) => i.status === "AVARIA").length,
    [items]
  );

  function setStatus(id: string, status: "OK" | "AVARIA") {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], status } }));
  }
  function setNotes(id: string, notes: string) {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], notes } }));
  }

  // Margem de segurança abaixo do limite de ~4,5MB que a Vercel aplica no
  // nível de rede para o corpo inteiro da requisição (nome dos campos,
  // fronteiras do multipart etc. também contam, por isso a margem).
  const MAX_TOTAL_UPLOAD_BYTES = 3.5 * 1024 * 1024;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const original = new FormData(e.currentTarget);
    setIsCompressing(true);
    setClientError(null);
    try {
      const compressed = new FormData();
      let totalPhotoBytes = 0;
      for (const [key, value] of original.entries()) {
        if (
          value instanceof File &&
          value.size > 0 &&
          value.type.startsWith("image/")
        ) {
          const compressedFile = await compressImage(value);
          totalPhotoBytes += compressedFile.size;
          compressed.append(key, compressedFile);
        } else {
          compressed.append(key, value);
        }
      }

      if (totalPhotoBytes > MAX_TOTAL_UPLOAD_BYTES) {
        setClientError(
          `As fotos deste checklist somam ${(
            totalPhotoBytes /
            1024 /
            1024
          ).toFixed(
            1
          )}MB, mesmo já compactadas — acima do que dá para enviar de uma vez (limite de rede de ~4MB). Remova algumas fotos (principalmente as de itens marcados como OK, que são opcionais) e tente enviar de novo.`
        );
        return;
      }

      formAction(compressed);
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
      <input type="hidden" name="vehicleId" value={vehicle.id} />

      <div className="mb-6">
        <Link
          href={`/veiculos/${vehicle.id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {vehicle.placa}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Checklist mensal
        </h1>
        <p className="text-sm text-slate-500">
          {vehicle.marca} {vehicle.modelo} · {vehicle.filialNome}
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Quilometragem atual
        </label>
        <input
          type="number"
          name="km"
          required
          min={vehicle.kmAtual}
          value={km}
          onChange={(e) => setKm(e.target.value)}
          className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <p className="mt-1 text-xs text-slate-500">
          Última registrada: {formatKm(vehicle.kmAtual)}
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <div
            key={category}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-100 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-700">
                {category}
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {itemDefs
                .filter((d) => d.category === category)
                .map((def) => {
                  const itemState = items[def.id];
                  return (
                    <div key={def.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-800">{def.label}</p>
                        <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300">
                          <button
                            type="button"
                            onClick={() => setStatus(def.id, "OK")}
                            className={`px-3 py-1 text-xs font-medium transition ${
                              itemState.status === "OK"
                                ? "bg-emerald-600 text-white"
                                : "bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(def.id, "AVARIA")}
                            className={`px-3 py-1 text-xs font-medium transition ${
                              itemState.status === "AVARIA"
                                ? "bg-red-600 text-white"
                                : "bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            Avaria
                          </button>
                        </div>
                      </div>
                      <input
                        type="hidden"
                        name={`status_${def.id}`}
                        value={itemState.status}
                      />

                      {itemState.status === "AVARIA" && (
                        <div className="mt-3 space-y-2 rounded-lg bg-red-50/60 p-3">
                          <textarea
                            name={`notes_${def.id}`}
                            value={itemState.notes}
                            onChange={(e) => setNotes(def.id, e.target.value)}
                            placeholder="Descreva a avaria…"
                            rows={2}
                            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
                          />
                          <div>
                            <label className="mb-1 block text-xs font-medium text-red-700">
                              Fotos (obrigatório)
                            </label>
                            <input
                              type="file"
                              name={`photos_${def.id}`}
                              accept="image/*"
                              multiple
                              required
                              className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-red-700"
                            />
                            <p className="mt-1 text-[11px] text-slate-500">
                              Toque para tirar uma foto na hora ou escolher
                              uma já salva na galeria.
                            </p>
                          </div>
                        </div>
                      )}

                      {itemState.status === "OK" && (
                        <div className="mt-2">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Foto (opcional)
                          </label>
                          <input
                            type="file"
                            name={`photos_${def.id}`}
                            accept="image/*"
                            multiple
                            className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="text-sm">
          {avariaCount > 0 ? (
            <span className="font-medium text-red-600">
              {avariaCount} avaria{avariaCount !== 1 && "s"} identificada
              {avariaCount !== 1 && "s"}
            </span>
          ) : (
            <span className="font-medium text-emerald-600">
              Tudo OK até agora
            </span>
          )}
        </div>
        <SubmitButton compressing={isCompressing} pending={isPending} />
      </div>

      {clientError && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {clientError}
        </p>
      )}
      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function SubmitButton({
  compressing,
  pending,
}: {
  compressing: boolean;
  pending: boolean;
}) {
  const busy = compressing || pending;
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {compressing ? "Preparando fotos…" : pending ? "Salvando…" : "Concluir conferência"}
    </button>
  );
}
