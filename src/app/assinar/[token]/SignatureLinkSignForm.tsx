"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/app/ocorrencias/[id]/SignaturePad";
import { signViaLinkAction } from "./actions";

export default function SignatureLinkSignForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleConfirm(file: File) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("token", token);
      fd.set("signatureImage", file);
      const res = await signViaLinkAction(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setDone(true);
        router.refresh();
      }
    });
  }

  if (done) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        Assinatura registrada com sucesso. Pode fechar esta página.
      </p>
    );
  }

  return (
    <div>
      <SignaturePad
        pending={isPending}
        onCancel={() => {}}
        onConfirm={handleConfirm}
      />
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
