"use client";

import { useActionState } from "react";
import { deleteVehicleAction, DeleteVehicleState } from "./actions";

const initialState: DeleteVehicleState = { error: null };

export default function DeleteVehicleButton({ id, placa }: { id: string; placa: string }) {
  const [state, formAction, isPending] = useActionState(deleteVehicleAction, initialState);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!confirm(`Excluir o veículo ${placa}? Essa ação não pode ser desfeita.`)) {
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
        <span className="max-w-[220px] text-right text-xs text-red-600">
          {state.error}
        </span>
      )}
    </span>
  );
}
