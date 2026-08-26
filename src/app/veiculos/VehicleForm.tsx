"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createVehicleAction, updateVehicleAction, VehicleFormState } from "./actions";

const initialState: VehicleFormState = { error: null };

type Filial = { id: string; nome: string };
type Condutor = { id: string; name: string };
type ExistingVehicle = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  anoFabricacao: number | null;
  filialId: string;
  kmAtual: number;
  assignedCondutorId: string | null;
  active: boolean;
};

export default function VehicleForm({
  filiais,
  condutores,
  vehicle,
}: {
  filiais: Filial[];
  condutores: Condutor[];
  vehicle?: ExistingVehicle;
}) {
  const action = vehicle ? updateVehicleAction : createVehicleAction;
  const [state, formAction] = useActionState(action, initialState);
  const isEdit = !!vehicle;

  return (
    <form
      action={formAction}
      className="mx-auto max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      {isEdit && <input type="hidden" name="id" value={vehicle!.id} />}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Placa
          </label>
          <input
            type="text"
            name="placa"
            required
            maxLength={8}
            defaultValue={vehicle?.placa}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Ano de fabricação
          </label>
          <input
            type="number"
            name="anoFabricacao"
            min={1980}
            max={2100}
            defaultValue={vehicle?.anoFabricacao ?? undefined}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Marca
          </label>
          <input
            type="text"
            name="marca"
            required
            defaultValue={vehicle?.marca}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Modelo
          </label>
          <input
            type="text"
            name="modelo"
            required
            defaultValue={vehicle?.modelo}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Filial
          </label>
          <select
            name="filialId"
            required
            defaultValue={vehicle?.filialId ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="" disabled>
              Selecione…
            </option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Quilometragem atual
          </label>
          <input
            type="number"
            name="kmAtual"
            min={0}
            required
            defaultValue={vehicle?.kmAtual ?? 0}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Condutor designado
        </label>
        <select
          name="assignedCondutorId"
          defaultValue={vehicle?.assignedCondutorId ?? ""}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        >
          <option value="">—</option>
          {condutores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Só o condutor designado pode iniciar o checklist deste veículo pelo
          celular (além de administradores e supervisores).
        </p>
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={vehicle!.active}
            className="h-4 w-4 rounded border-slate-300"
          />
          Veículo ativo na frota
        </label>
      )}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton isEdit={isEdit} />
        <Link
          href={isEdit ? `/veiculos/${vehicle!.id}` : "/veiculos"}
          className="text-sm text-slate-500 hover:underline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar veículo"}
    </button>
  );
}
