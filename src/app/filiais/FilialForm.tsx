"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  createFilialAction,
  updateFilialAction,
  FilialFormState,
} from "./actions";

const initialState: FilialFormState = { error: null };

type ExistingFilial = {
  id: string;
  nome: string;
  codigo: string;
  empresa?: string | null;
};

export default function FilialForm({ filial }: { filial?: ExistingFilial }) {
  const isEdit = !!filial;
  const action = isEdit ? updateFilialAction : createFilialAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {isEdit ? "Editar filial" : "Nova filial"}
      </h2>
      {isEdit && <input type="hidden" name="id" value={filial!.id} />}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Nome
          </label>
          <input
            type="text"
            name="nome"
            required
            defaultValue={filial?.nome}
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
            defaultValue={filial?.codigo}
            placeholder="Ex: SRT"
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Empresa
          </label>
          <input
            type="text"
            name="empresa"
            defaultValue={filial?.empresa ?? ""}
            placeholder="Ex: Pampa Transportes"
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <SubmitButton isEdit={isEdit} />
        {isEdit && (
          <Link
            href="/filiais"
            className="text-sm text-slate-500 hover:underline"
          >
            Cancelar
          </Link>
        )}
      </div>
      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Adicionar filial"}
    </button>
  );
}
