"use client";

import { useState, useTransition } from "react";
import { createSignatureLinkAction } from "./actions";

type Candidate = { id: string; name: string };

export default function SignatureLinkPanel({
  occurrenceId,
  role,
  roleLabel,
  vehiclePlaca,
  fixedCandidate,
  candidates,
  hasActiveLink,
}: {
  occurrenceId: string;
  role: "CONDUTOR" | "SUPERVISOR" | "GERENTE";
  roleLabel: string;
  vehiclePlaca: string;
  fixedCandidate: Candidate | null;
  candidates: Candidate[];
  hasActiveLink: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(
    fixedCandidate?.id ?? candidates[0]?.id ?? ""
  );
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    const userId = fixedCandidate?.id ?? selectedId;
    if (!userId) {
      setError("Selecione quem vai assinar.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createSignatureLinkAction({ occurrenceId, role, userId });
      if (res.error) {
        setError(res.error);
        return;
      }
      setLink(`${window.location.origin}/assinar/${res.token}`);
    });
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de clipboard — a pessoa pode selecionar o texto do
      // campo manualmente, o input já fica com o link visível.
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 hover:underline"
      >
        {hasActiveLink ? "Reenviar link" : "Enviar link (WhatsApp)"}
      </button>
    );
  }

  const whatsappHref = link
    ? `https://wa.me/?text=${encodeURIComponent(
        `Olá! Segue o link para assinar o relato da ocorrência do veículo ${vehiclePlaca} (${roleLabel}): ${link}`
      )}`
    : "#";

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {!fixedCandidate && candidates.length > 0 && !link && (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-500"
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {!fixedCandidate && candidates.length === 0 && (
        <p className="mb-2 text-xs text-red-600">
          Nenhum usuário com o perfil &quot;{roleLabel}&quot; cadastrado.
        </p>
      )}
      {fixedCandidate && !link && (
        <p className="mb-2 text-xs text-slate-600">
          Link será gerado para {fixedCandidate.name}.
        </p>
      )}

      {!link ? (
        (fixedCandidate || candidates.length > 0) && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isPending ? "Gerando…" : "Gerar link"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        )
      ) : (
        <div className="space-y-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copiado!" : "Copiar link"}
            </button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Abrir WhatsApp
            </a>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setLink(null);
              }}
              className="text-xs text-slate-500 hover:underline"
            >
              Fechar
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Válido por 30 dias, uso único — quem abrir não precisa fazer login.
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
