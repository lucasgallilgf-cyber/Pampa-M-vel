"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/app/ocorrencias/[id]/SignaturePad";
import { signInspectionAction } from "./actions";

type Signature = {
  id: string;
  userNameSnap: string;
  signatureImageUrl?: string | null;
  signedAt: string | Date;
};

export default function SupervisorSignaturePanel({
  inspectionId,
  signature,
  canSign,
}: {
  inspectionId: string;
  signature: Signature | null;
  canSign: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm(file: File) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("inspectionId", inspectionId);
      fd.set("signatureImage", file);
      const res = await signInspectionAction(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setSigning(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Assinatura do supervisor
      </h2>

      {signature ? (
        <div className="mt-2">
          <p className="text-xs text-slate-500">
            Assinado por {signature.userNameSnap} em{" "}
            {new Date(signature.signedAt).toLocaleString("pt-BR")}
          </p>
          {signature.signatureImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signature.signatureImageUrl}
              alt={`Assinatura de ${signature.userNameSnap}`}
              className="mt-2 h-16 rounded border border-slate-100 bg-white"
            />
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-500">
            Esta conferência não teve avaria, mas ainda precisa da ciência de
            um supervisor.
          </p>
          {canSign ? (
            signing ? (
              <div className="mt-3">
                <SignaturePad
                  pending={isPending}
                  onCancel={() => setSigning(false)}
                  onConfirm={handleConfirm}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSigning(true)}
                className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                Assinar
              </button>
            )
          ) : (
            <p className="mt-2 text-xs text-slate-400">
              Aguardando assinatura de um supervisor.
            </p>
          )}
        </>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
