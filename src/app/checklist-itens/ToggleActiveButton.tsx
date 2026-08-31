"use client";

import { useActionState } from "react";
import { toggleChecklistItemActiveAction, ToggleActiveState } from "./actions";

const initialState: ToggleActiveState = { error: null };

export default function ToggleActiveButton({
  id,
  label,
  active,
}: {
  id: string;
  label: string;
  active: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    toggleChecklistItemActiveAction,
    initialState
  );

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (active) {
            // Só confirma ao desativar — reativar não precisa de aviso.
            if (
              !confirm(
                `Desativar "${label}"? Ele deixa de aparecer nos próximos checklists (o histórico já registrado não é afetado).`
              )
            ) {
              e.preventDefault();
            }
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="nextActive" value={(!active).toString()} />
        <button
          type="submit"
          disabled={isPending}
          className={`font-medium hover:underline disabled:opacity-60 ${
            active ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {isPending ? "Salvando…" : active ? "Desativar" : "Reativar"}
        </button>
      </form>
      {state.error && (
        <span className="max-w-[220px] text-right text-xs text-red-600">
          {state.error}
        </span>
      )}
    </span>
  );
}
