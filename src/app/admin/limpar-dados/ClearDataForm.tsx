"use client";

import { useState } from "react";
import { useActionState } from "react";
import { clearExampleDataAction, ClearDataState } from "./actions";

const initialState: ClearDataState = { error: null };
const CONFIRM_PHRASE = "LIMPAR DADOS";

export default function ClearDataForm() {
  const [state, formAction, isPending] = useActionState(
    clearExampleDataAction,
    initialState
  );
  const [confirmText, setConfirmText] = useState("");
  const matches = confirmText.trim() === CONFIRM_PHRASE;

  if (state.done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        Dados de exemplo removidos. Filiais, veículos e usuários de teste
        foram apagados — sua conta continua ativa. Agora é só cadastrar as
        filiais reais e importar a planilha de veículos.
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Isso vai apagar TODAS as filiais, veículos, usuários (exceto sua conta) e o histórico de checklists/avarias cadastrados até agora. Essa ação não pode ser desfeita. Confirmar?"
          )
        ) {
          e.preventDefault();
        }
      }}
      className="rounded-xl border border-red-200 bg-red-50 p-5"
    >
      <label className="mb-1 block text-sm font-medium text-red-900">
        Para confirmar, digite{" "}
        <code className="rounded bg-white px-1 py-0.5 text-red-700">
          {CONFIRM_PHRASE}
        </code>{" "}
        abaixo
      </label>
      <input
        type="text"
        name="confirmText"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoComplete="off"
        className="w-64 rounded-lg border border-red-300 px-3 py-2 text-sm outline-none focus:border-red-500"
      />

      {state.error && (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-4">
        <button
          type="submit"
          disabled={!matches || isPending}
          className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Apagando…" : "Apagar dados de exemplo"}
        </button>
      </div>
    </form>
  );
}
