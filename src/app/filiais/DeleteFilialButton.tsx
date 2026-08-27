"use client";

import { useState } from "react";
import { useActionState } from "react";
import { deleteFilialAction, DeleteFilialState } from "./actions";

const initialState: DeleteFilialState = { error: null };

type OutraFilial = { id: string; nome: string };

export default function DeleteFilialButton({
  id,
  nome,
  veiculos,
  usuarios,
  outrasFiliais,
}: {
  id: string;
  nome: string;
  veiculos: number;
  usuarios: number;
  outrasFiliais: OutraFilial[];
}) {
  const [state, formAction, isPending] = useActionState(deleteFilialAction, initialState);
  const [showMove, setShowMove] = useState(false);
  const hasLinks = veiculos > 0 || usuarios > 0;

  if (hasLinks && outrasFiliais.length === 0) {
    return (
      <span className="text-xs text-slate-400">
        Cadastre outra filial para poder excluir esta.
      </span>
    );
  }

  if (hasLinks && !showMove) {
    return (
      <button
        type="button"
        onClick={() => setShowMove(true)}
        className="font-medium text-red-600 hover:underline"
      >
        Excluir
      </button>
    );
  }

  if (hasLinks && showMove) {
    return (
      <div className="flex flex-col items-end gap-1">
        <form
          action={formAction}
          className="flex items-center gap-1"
          onSubmit={(e) => {
            const select = e.currentTarget.elements.namedItem(
              "destinoFilialId"
            ) as HTMLSelectElement | null;
            const destino = select?.value;
            const destinoNome = select?.selectedOptions[0]?.textContent ?? "";
            if (!destino) {
              e.preventDefault();
              return;
            }
            if (
              !confirm(
                `Mover ${veiculos} veículo(s) e ${usuarios} usuário(s) de "${nome}" para "${destinoNome}" e excluir "${nome}"?`
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <select
            name="destinoFilialId"
            required
            defaultValue=""
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-500"
          >
            <option value="" disabled>
              Mover vínculos para…
            </option>
            {outrasFiliais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="font-medium text-red-600 hover:underline disabled:opacity-60"
          >
            {isPending ? "Movendo…" : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => setShowMove(false)}
            className="text-slate-400 hover:underline"
          >
            Cancelar
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

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
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
        <span className="max-w-[220px] text-right text-xs text-red-600">
          {state.error}
        </span>
      )}
    </div>
  );
}
