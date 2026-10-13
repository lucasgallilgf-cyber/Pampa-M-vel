"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/imageCompress";
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

// Fotos da câmera do celular costumam vir com vários MB cada. Antes de
// enviar, cada foto é reduzida no próprio aparelho até caber num tamanho
// alvo (ver compressImage) — fotos de item OK ficam bem leves (são só
// registro), fotos de avaria mantêm mais detalhe. Depois, cada foto vai
// DIRETO do celular para o armazenamento (Vercel Blob), uma a uma, sem
// passar pelo servidor do site — então não existe mais limite de ~4,5MB por
// checklist; o formulário só envia as URLs das fotos já salvas.
const TARGET_BYTES_OK = 160 * 1024;
const TARGET_BYTES_AVARIA = 350 * 1024;
const UPLOAD_CONCURRENCY = 3;

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
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  // Fotos já enviadas (por arquivo) — se o envio falhar no meio e o usuário
  // tentar de novo, só reenvia o que faltou.
  const uploadedUrls = useRef(new WeakMap<File, string>());
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
      const jobs: { file: File; avaria: boolean; defId: string }[] = [];
      for (const def of itemDefs) {
        for (const file of items[def.id].photos) {
          jobs.push({
            file,
            avaria: items[def.id].status === "AVARIA",
            defId: def.id,
          });
        }
      }

      const pending = jobs.filter((j) => !uploadedUrls.current.has(j.file));
      let done = jobs.length - pending.length;
      setUploadProgress(jobs.length > 0 ? { done, total: jobs.length } : null);

      let failed: string | null = null;
      let next = 0;
      async function worker() {
        while (failed === null && next < pending.length) {
          const job = pending[next++];
          try {
            const small = await compressImage(
              job.file,
              job.avaria ? TARGET_BYTES_AVARIA : TARGET_BYTES_OK
            );
            const path = `inspecoes/${vehicle.id}/${crypto.randomUUID()}.jpg`;
            let lastErr: unknown = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const blob = await upload(path, small, {
                  access: "public",
                  handleUploadUrl: "/api/blob-upload",
                  contentType: small.type || "image/jpeg",
                });
                uploadedUrls.current.set(job.file, blob.url);
                lastErr = null;
                break;
              } catch (err) {
                lastErr = err;
              }
            }
            if (lastErr) throw lastErr;
            done += 1;
            setUploadProgress({ done, total: jobs.length });
          } catch (err) {
            failed =
              err instanceof Error && err.message
                ? err.message
                : "falha de conexão";
          }
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, pending.length) }, worker)
      );

      if (failed !== null) {
        setClientError(
          `Não foi possível enviar todas as fotos (${failed}). As que já subiram ficam guardadas — verifique a conexão e toque em "Concluir conferência" de novo.`
        );
        return;
      }

      const payload = new FormData();
      for (const [key, value] of original.entries()) {
        payload.append(key, value);
      }
      for (const job of jobs) {
        const url = uploadedUrls.current.get(job.file);
        if (url) payload.append(`photoUrls_${job.defId}`, url);
      }

      formAction(payload);
    } finally {
      setIsCompressing(false);
      setUploadProgress(null);
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
        <SubmitButton
          compressing={isCompressing}
          pending={isPending}
          progress={uploadProgress}
        />
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
  progress,
}: {
  compressing: boolean;
  pending: boolean;
  progress: { done: number; total: number } | null;
}) {
  const busy = compressing || pending;
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {compressing
        ? progress
          ? `Enviando fotos ${progress.done}/${progress.total}…`
          : "Preparando…"
        : pending
          ? "Salvando…"
          : "Concluir conferência"}
    </button>
  );
}
