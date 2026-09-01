"use client";

import { useActionState } from "react";
import { deleteInspectionAction, DeleteInspectionState } from "./actions";

const initialState: DeleteInspectionState = { error: null };

export default function DeleteInspectionButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(
    deleteInspectionAction,
    initialState
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !confirm(
              "Excluir esta conferência? Isso apaga todos os itens, fotos e a ocorrência gerada por ela (se houver). Essa ação não pode ser desfeita."
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {isPending ? "Excluindo…" : "Excluir conferência"}
        </button>
      </form>
      {state.error && (
        <span className="max-w-[260px] text-right text-xs text-red-600">
          {state.error}
        </span>
      )}
    </div>
  );
}
