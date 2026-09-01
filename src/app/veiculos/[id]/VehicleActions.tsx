"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { transferVehicleAction, VehicleFormState } from "../actions";

const initialState: VehicleFormState = { error: null };

type Filial = { id: string; nome: string };

export default function VehicleActions({
  vehicleId,
  isAdmin,
  canChecklist,
  filiais,
  currentFilialId,
  currentCentroCusto,
  currentCondutorNome,
}: {
  vehicleId: string;
  isAdmin: boolean;
  canChecklist: boolean;
  filiais: Filial[];
  currentFilialId: string;
  currentCentroCusto: string | null;
  currentCondutorNome: string | null;
}) {
  const [transferring, setTransferring] = useState(false);
  const [state, formAction] = useActionState(transferVehicleAction, initialState);

  return (
    <div>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Link
            href={`/veiculos/${vehicleId}/editar`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Editar
          </Link>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTransferring((v) => !v)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {transferring ? "Cancelar" : "Transferir"}
          </button>
        )}
        {canChecklist && (
          <Link
            href={`/veiculos/${vehicleId}/checklist`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Iniciar checklist
          </Link>
        )}
      </div>

      {transferring && (
        <form
          action={formAction}
          className="mt-3 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 sm:w-80"
        >
          <input type="hidden" name="id" value={vehicleId} />
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Transferir veículo
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Filial de destino
              </label>
              <select
                name="filialId"
                required
                defaultValue={currentFilialId}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Centro de custo
              </label>
              <input
                type="text"
                name="centroCusto"
                defaultValue={currentCentroCusto ?? ""}
                placeholder="Ex: 1234"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Condutor
              </label>
              <input
                type="text"
                name="condutorNome"
                defaultValue={currentCondutorNome ?? ""}
                placeholder="Nome de quem dirige o veículo"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {state.error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <SubmitButton />
            <button
              type="button"
              onClick={() => setTransferring(false)}
              className="text-xs text-slate-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </form>
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
      className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Transferindo…" : "Confirmar transferência"}
    </button>
  );
}
