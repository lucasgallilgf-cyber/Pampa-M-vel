"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createChecklistItemAction, ChecklistItemFormState } from "./actions";

const initialState: ChecklistItemFormState = { error: null };

export default function ChecklistItemForm({
  categories,
}: {
  categories: string[];
}) {
  const [state, formAction] = useActionState(
    createChecklistItemAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Limpa os campos depois de criar com sucesso, para facilitar cadastrar
  // vários itens em sequência sem precisar apagar o texto na mão.
  useEffect(() => {
    if (!state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Novo item de checklist
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Nome do item
          </label>
          <input
            type="text"
            name="label"
            required
            placeholder="Ex: Cinto de segurança"
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Categoria
          </label>
          <input
            type="text"
            name="category"
            required
            list="categorias-existentes"
            placeholder="Ex: Pneus e rodas"
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <datalist id="categorias-existentes">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <SubmitButton />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Escolha uma categoria já existente na lista para juntar o item a ela,
        ou digite um nome novo para criar uma nova categoria.
      </p>
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
      {pending ? "Adicionando…" : "Adicionar item"}
    </button>
  );
}
