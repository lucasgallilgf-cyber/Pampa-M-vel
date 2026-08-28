"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importVehiclesAction, ImportState } from "./actions";

const initialState: ImportState = { error: null };
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export default function ImportForm() {
  const [state, formAction] = useActionState(importVehiclesAction, initialState);

  return (
    <div className="space-y-6">
      <form
        action={formAction}
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
          (nome completo, opcional — se o nome não bater com nenhum usuário já
          cadastrado, um usuário Condutor novo é criado automaticamente).
          Placas já cadastradas não duplicam: se o veículo existente ainda não
          tiver condutor, ele é vinculado; senão a linha é só ignorada. Pode
          reenviar a mesma planilha quantas vezes precisar. Tamanho máximo:
          4MB.
        </p>

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
            {!!state.atualizados && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                {state.atualizados} condutor vinculado
                {state.atualizados !== 1 && "s"}
              </span>
            )}
            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
              {state.duplicados} ignorado{state.duplicados !== 1 && "s"} (já
              existia)
            </span>
            <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
              {state.comErro} com erro
            </span>
            {!!state.condutoresCriados && (
              <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20">
                {state.condutoresCriados} condutor
                {state.condutoresCriados !== 1 && "es"} novo
                {state.condutoresCriados !== 1 && "s"} cadastrado
                {state.condutoresCriados !== 1 && "s"}
              </span>
            )}
          </div>
          {!!state.condutoresCriados && (
            <p className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              {state.condutoresCriados === 1
                ? "1 condutor da planilha não tinha cadastro e foi criado automaticamente como usuário Condutor"
                : `${state.condutoresCriados} condutores da planilha não tinham cadastro e foram criados automaticamente como usuários Condutor`}
              , sem login funcional ainda. Vá em{" "}
              <a href="/usuarios" className="underline">
                /usuarios
              </a>{" "}
              e defina um e-mail e senha reais para cada um antes que possam
              entrar pelo celular.
            </p>
          )}
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
                      {r.status === "atualizado" && (
                        <span className="text-emerald-700">Condutor vinculado</span>
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
