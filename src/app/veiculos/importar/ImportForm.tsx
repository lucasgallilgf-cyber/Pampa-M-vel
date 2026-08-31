"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { importVehiclesAction, ImportState } from "./actions";

const initialState: ImportState = { error: null };
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function tooBigMessage(file: File) {
  return `Esse arquivo tem ${(file.size / 1024 / 1024).toFixed(
    1
  )}MB — o limite é 4MB. Remova abas/colunas que não sejam necessárias ou divida em planilhas menores.`;
}

export default function ImportForm() {
  const [state, formAction] = useActionState(importVehiclesAction, initialState);
  // A Vercel corta, no nível de rede, qualquer envio acima de ~4,5MB antes
  // mesmo de chegar no código do site — nesse caso o navegador só mostra um
  // erro genérico de "página não carregou", sem nenhuma mensagem amigável.
  // Por isso o tamanho é checado aqui, assim que o arquivo é escolhido, para
  // nunca deixar um arquivo grande demais sequer começar a ser enviado.
  const [clientError, setClientError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.size > MAX_FILE_BYTES) {
      setClientError(tooBigMessage(file));
      e.target.value = "";
    } else {
      setClientError(null);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem(
      "file"
    ) as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (file && file.size > MAX_FILE_BYTES) {
      e.preventDefault();
      setClientError(tooBigMessage(file));
    }
  }

  return (
    <div className="space-y-6">
      <form
        action={formAction}
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
          onChange={handleFileChange}
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
          <code className="rounded bg-slate-100 px-1 py-0.5">km</code>,{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">condutor</code>{" "}
          (nome completo, opcional — salvo só como texto informativo no
          veículo, sem criar nem vincular usuário/login) e{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">
            centro de custo
          </code>{" "}
          (opcional). Placas já cadastradas não duplicam: a linha é apenas
          ignorada. Pode reenviar a mesma planilha quantas vezes precisar.
          Tamanho máximo: 4MB.
        </p>

        {clientError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {clientError}
          </p>
        )}
        {state.error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="mt-4">
          <SubmitButton />
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Importando…" : "Importar"}
    </button>
  );
}
