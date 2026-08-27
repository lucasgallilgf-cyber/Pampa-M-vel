"use client";

import { useActionState } from "react";
import { deleteFilialAction, DeleteFilialState } from "./actions";

const initialState: DeleteFilialState = { error: null };

export default function DeleteFilialButton({
  id,
  nome,
  veiculos,
  usuarios,
}: {
  id: string;
  nome: string;
  veiculos: number;
  usuarios: number;
}) {
  const [state, formAction, isPending] = useActionState(deleteFilialAction, initialState);
  const hasLinks = veiculos > 0 || usuarios > 0;

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (hasLinks) return; // let the server action return its block message
          if (!confirm(`Excluir a filial "${nome}"? Essa ação não pode ser desfeita.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={isPending}
          className="font-medium text-red-600 hover:underline disabled:opacity-60"
        >
          {isPending ? "Excluindo…" : "Excluir"}
        </button>
      </form>
      {state.error && (
        <span className="max-w-[240px] text-right text-xs text-red-600">
          {state.error}
        </span>
      )}
    </span>
  );
}
