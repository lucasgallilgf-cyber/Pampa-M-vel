"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { submitChecklistAction, ChecklistFormState } from "./actions";
import { formatKm, nextRevisionKm, REVISION_MILESTONES } from "@/lib/domain";

type ItemDef = { id: string; label: string; category: string; order: number };
type Vehicle = {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  kmAtual: number;
  filialNome: string | null;
};

type ItemUiState = { status: "OK" | "AVARIA"; notes: string; photos: File[] };

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
    Object.fromEntries(
      itemDefs.map((d) => [d.id, { status: "OK", notes: "", photos: [] }])
    )
  );
  const [km, setKm] = useState(String(vehicle.kmAtual));
  const [relato, setRelato] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [revisaoFeita, setRevisaoFeita] = useState(false);
  const [revisaoKmOverride, setRevisaoKmOverride] = useState<number | null>(
    null
  );
  const [revisaoObservacao, setRevisaoObservacao] = useState("");

  const kmNum = parseInt(km, 10);
  const revisaoKmSugerido = nextRevisionKm(
    Number.isNaN(kmNum) ? vehicle.kmAtual : kmNum
  );
  const revisaoKm = revisaoKmOverride ?? revisaoKmSugerido;

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
  function setPhotos(id: string, photos: File[]) {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], photos } }));
  }

  // Margem de segurança abaixo do limite de ~4,5MB que a Vercel aplica no
  // nível de rede para o corpo inteiro da requisição (nome dos campos,
  // fronteiras do multipart etc. também contam, por isso a margem).
  const MAX_TOTAL_UPLOAD_BYTES = 3.5 * 1024 * 1024;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);

    const semFoto = itemDefs.find(
      (d) => items[d.id].status === "AVARIA" && items[d.id].photos.length === 0
    );
    if (semFoto) {
      setClientError(
        `Adicione pelo menos uma foto do item "${semFoto.label}" (marcado como avaria).`
      );
      return;
    }

    if (avariaCount > 0 && relato.trim().length === 0) {
      setClientError(
        "Descreva o que aconteceu no campo \"Relato do ocorrido\" antes de enviar."
      );
      return;
    }

    const original = new FormData(e.currentTarget);
    setIsCompressing(true);
    try {
      const compressed = new FormData();
      let totalPhotoBytes = 0;
      for (const [key, value] of original.entries()) {
        compressed.append(key, value);
      }

      for (const def of itemDefs) {
        for (const file of items[def.id].photos) {
          const compressedFile = await compressImage(file);
          totalPhotoBytes += compressedFile.size;
          compressed.append(`photos_${def.id}`, compressedFile);
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

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={revisaoFeita}
            onChange={(e) => setRevisaoFeita(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Revisão preventiva feita nesta conferência
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Marque se o veículo passou pela revisão de manutenção agora — isso
          atualiza o painel de Revisões e já calcula o próximo marco (10 em
          10 mil km).
        </p>

        {revisaoFeita && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="revisaoFeita" value="on" />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Km da revisão
              </label>
              <select
                name="revisaoKmAlvo"
                value={revisaoKm}
                onChange={(e) => setRevisaoKmOverride(Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                {REVISION_MILESTONES.map((m) => (
                  <option key={m} value={m}>
                    {formatKm(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Observação (opcional)
              </label>
              <input
                type="text"
                name="revisaoObservacao"
                value={revisaoObservacao}
                onChange={(e) => setRevisaoObservacao(e.target.value)}
                placeholder="Ex: troca de óleo e filtros na oficina X"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>
        )}
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
                              Fotos (obrigatório, pode adicionar várias)
                            </label>
                            <PhotoPicker
                              files={itemState.photos}
                              onChange={(photos) => setPhotos(def.id, photos)}
                              accent="red"
                            />
                          </div>
                        </div>
                      )}

                      {itemState.status === "OK" && (
                        <div className="mt-2">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Fotos (opcional, pode adicionar várias)
                          </label>
                          <PhotoPicker
                            files={itemState.photos}
                            onChange={(photos) => setPhotos(def.id, photos)}
                            accent="slate"
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

      {avariaCount > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50/60 p-4">
          <label className="mb-1 block text-sm font-medium text-red-800">
            Relato do ocorrido (obrigatório)
          </label>
          <p className="mb-2 text-xs text-red-700">
            Conte com suas palavras o que aconteceu — isso vira o documento
            que o supervisor e o gerente vão ler e assinar junto com você.
          </p>
          <textarea
            name="relato"
            value={relato}
            onChange={(e) => setRelato(e.target.value)}
            required
            rows={4}
            placeholder="Ex: durante a conferência notei que o para-choque dianteiro está amassado, aparentemente de uma batida no estacionamento…"
            className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
          />
        </div>
      )}

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

// Picker de fotos que ACUMULA os arquivos escolhidos em vez de substituir a
// seleção anterior. O <input type="file"> nativo, sozinho, esquece a foto
// já escolhida assim que o usuário abre o seletor de novo — o que atrapalha
// muito no celular, já que tirar uma foto pela câmera é sempre uma
// interação por vez (não dá pra tirar várias fotos seguidas num único
// toque). Aqui cada vez que o usuário escolhe algo (seja pela câmera, seja
// pela galeria) o resultado é somado à lista, com miniaturas e botão de
// remover individualmente.
function PhotoPicker({
  files,
  onChange,
  accent,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  accent: "red" | "slate";
}) {
  const previews = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files]
  );
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) onChange([...files, ...picked]);
    e.target.value = "";
  }
  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  const buttonClass =
    accent === "red"
      ? "border-red-300 bg-red-600 text-white hover:bg-red-700"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {files.map((file, i) => (
        <div
          key={i}
          className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previews[i]}
            alt={`Foto ${i + 1}`}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label="Remover foto"
            className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-black/60 text-xs font-bold text-white hover:bg-black/80"
          >
            ×
          </button>
        </div>
      ))}
      <label
        className={`flex h-14 w-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border text-[10px] font-medium leading-tight ${buttonClass}`}
      >
        <span className="text-lg leading-none">+</span>
        Foto
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handlePick}
          className="hidden"
        />
      </label>
    </div>
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
