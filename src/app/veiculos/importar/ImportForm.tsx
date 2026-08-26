"use client";

import { useActionState, useState, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import { importVehiclesFromUrlAction, ImportState } from "./actions";

const initialState: ImportState = { error: null };

export default function ImportForm() {
  const [state, formAction, isPending] = useActionState(
    importVehiclesFromUrlAction,
    initialState
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setUploadError("Selecione um arquivo de planilha (.xlsx, .xls ou .csv).");
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
      });
      const fd = new FormData();
      fd.set("fileUrl", blob.url);
      fd.set("fileName", file.name);
      formAction(fd);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? `Falha ao enviar o arquivo: ${err.message}`
          : "Falha ao enviar o arquivo."
      );
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || isPending;
  const error = uploadError ?? state.error;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Arquivo da planilha (.xlsx, .xls ou .csv)
        </label>
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls,.csv"
          required
          className="block w-full text-sm text-slate-600"
        />
        <p className="mt-2 text-xs text-slate-500">
          A primeira linha deve conter os cabeçalhos. Colunas reconhecidas:{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">placa</code>,{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">marca</code>,{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">modelo</code>,{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">ano</code>,{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">filial</code>{" "}
          (nome ou código já cadastrado),{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">km</code> e{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">condutor</code>{" "}
          (nome completo, opcional). Placas já cadastradas são ignoradas — pode
          reenviar a mesma planilha depois de corrigir erros sem duplicar nada.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {uploading ? "Enviando…" : isPending ? "Importando…" : "Importar"}
          </button>
        </div>
      </form>

      {state.done && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Resultado da importação
          </h2>
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              {state.criados} criado{state.criados !== 1 && "s"}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
              {state.duplicados} ignorado{state.duplicados !== 1 && "s"} (já
              existia)
            </span>
            <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
              {state.comErro} com erro
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Linha</th>
                  <th className="px-3 py-2">Placa</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.rows?.map((r) => (
                  <tr key={r.linha}>
                    <td className="px-3 py-2 text-slate-500">{r.linha}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {r.placa}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "criado" && (
                        <span className="text-emerald-700">Criado</span>
                      )}
                      {r.status === "duplicado" && (
                        <span className="text-amber-700">Ignorado</span>
                      )}
                      {r.status === "erro" && (
                        <span className="text-red-700">Erro</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {r.mensagem ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
