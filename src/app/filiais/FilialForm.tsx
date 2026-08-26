"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createFilialAction, FilialFormState } from "./actions";

const initialState: FilialFormState = { error: null };

export default function FilialForm() {
  const [state, formAction] = useActionState(createFilialAction, initialState);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Nova filial
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Nome
          </label>
          <input
            type="text"
            name="nome"
            required
            placeholder="Ex: Filial - Sorriso"
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Código
          </label>
          <input
            type="text"
            name="codigo"
            required
            maxLength={10}
            placeholder="Ex: SRT"
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-slate-500"
          />
        </div>
        <SubmitButton />
      </div>
      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Adicionar filial"}
    </button>
  );
}
