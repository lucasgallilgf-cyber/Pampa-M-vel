"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOccurrenceAction, resolveOccurrenceAction } from "./actions";
import { SIGNATURE_ORDER, SIGNATURE_ROLE_LABELS } from "@/lib/domain";
import type { SessionPayload } from "@/lib/auth";
import SignaturePad from "./SignaturePad";

type Signature = {
  id: string;
  role: "CONDUTOR" | "SUPERVISOR" | "GERENTE";
  userNameSnap: string;
  signatureImageUrl?: string | null;
  signedAt: string | Date;
};

export default function SignaturePanel({
  occurrenceId,
  signatures,
  session,
  status,
}: {
  occurrenceId: string;
  signatures: Signature[];
  session: SessionPayload;
  status: "PENDENTE" | "EM_ANDAMENTO" | "RESOLVIDA";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [signingRole, setSigningRole] = useState<string | null>(null);

  const signedRoles = new Set(signatures.map((s) => s.role));
  const allSigned = SIGNATURE_ORDER.every((r) => signedRoles.has(r));

  function handleConfirmSignature(
    role: "CONDUTOR" | "SUPERVISOR" | "GERENTE",
    file: File
  ) {
    setError(null);
    setPendingRole(role);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("occurrenceId", occurrenceId);
      fd.set("role", role);
      fd.set("signatureImage", file);
      const res = await signOccurrenceAction(fd);
      setPendingRole(null);
      if (res.error) {
        setError(res.error);
      } else {
        setSigningRole(null);
        router.refresh();
      }
    });
  }

  function handleResolve() {
    setError(null);
    setPendingRole("resolve");
    startTransition(async () => {
      const res = await resolveOccurrenceAction(occurrenceId, resolutionNotes);
      setPendingRole(null);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const canResolve =
    ["ADMIN", "SUPERVISOR", "GERENTE"].includes(session.role) &&
    status !== "RESOLVIDA";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Fluxo de ciência (assinaturas)
      </h2>
      <p className="mb-3 mt-1 text-xs text-slate-500">
        Esta ocorrência precisa da ciência, em ordem, do condutor, do
        supervisor administrativo e do gerente. Cada um assina desenhando a
        própria assinatura no celular ou computador quando chegar sua vez.
      </p>
      <ol className="space-y-3">
        {SIGNATURE_ORDER.map((role, idx) => {
          const sig = signatures.find((s) => s.role === role);
          const priorSigned = SIGNATURE_ORDER.slice(0, idx).every((r) =>
            signedRoles.has(r)
          );
          const canSignThis =
            !sig &&
            priorSigned &&
            (session.role === "ADMIN" || session.role === role) &&
            status !== "RESOLVIDA";

          return (
            <li
              key={role}
              className="rounded-lg border border-slate-100 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {idx + 1}. {SIGNATURE_ROLE_LABELS[role]}
                  </p>
                  {sig ? (
                    <p className="text-xs text-slate-500">
                      Assinado por {sig.userNameSnap} em{" "}
                      {new Date(sig.signedAt).toLocaleString("pt-BR")}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {priorSigned
                        ? "Aguardando assinatura"
                        : "Aguardando etapa anterior"}
                    </p>
                  )}
                </div>
                {sig ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    Assinado
                  </span>
                ) : canSignThis && signingRole !== role ? (
                  <button
                    onClick={() => setSigningRole(role)}
                    disabled={isPending}
                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Assinar
                  </button>
                ) : (
                  !sig && <span className="shrink-0 text-xs text-slate-300">—</span>
                )}
              </div>

              {sig?.signatureImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sig.signatureImageUrl}
                  alt={`Assinatura de ${sig.userNameSnap}`}
                  className="mt-2 h-16 rounded border border-slate-100 bg-white"
                />
              )}

              {canSignThis && signingRole === role && (
                <div className="mt-3">
                  <SignaturePad
                    pending={isPending && pendingRole === role}
                    onCancel={() => setSigningRole(null)}
                    onConfirm={(file) => handleConfirmSignature(role, file)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {allSigned && status !== "RESOLVIDA" && (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Todas as assinaturas foram registradas. A ocorrência está em
          andamento até a manutenção ser concluída e marcada como resolvida
          abaixo.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {canResolve && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Observações da resolução (opcional)
          </label>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={2}
            placeholder="Ex: reparo realizado na oficina X…"
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <button
            onClick={handleResolve}
            disabled={isPending}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pendingRole === "resolve" ? "Salvando…" : "Marcar como resolvida"}
          </button>
        </div>
      )}
    </div>
  );
}
