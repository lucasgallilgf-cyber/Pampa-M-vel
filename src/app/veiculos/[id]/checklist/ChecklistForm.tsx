"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { submitChecklistAction, ChecklistFormState } from "./actions";
import { formatKm } from "@/lib/domain";

type ItemDef = { id: string; label: string; category: string; order: number };
type Vehicle = {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  kmAtual: number;
  filialNome: string | null;
};

type ItemUiState = { status: "OK" | "AVARIA"; notes: string };

const initialState: ChecklistFormState = { error: null };

export default function ChecklistForm({
  vehicle,
  itemDefs,
  categories,
}: {
  vehicle: Vehicle;
  itemDefs: ItemDef[];
  categories: string[];
}) {
  const [state, formAction] = useActionState(
    submitChecklistAction,
    initialState
  );
  const [items, setItems] = useState<Record<string, ItemUiState>>(() =>
    Object.fromEntries(itemDefs.map((d) => [d.id, { status: "OK", notes: "" }]))
  );
  const [km, setKm] = useState(String(vehicle.kmAtual));

  const avariaCount = useMemo(
    () => Object.values(items).filter((i) => i.status === "AVARIA").length,
    [items]
  );

  function setStatus(id: string, status: "OK" | "AVARIA") {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], status } }));
  }
  function setNotes(id: string, notes: string) {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], notes } }));
  }

  return (
    <form action={formAction} className="mx-auto max-w-3xl">
      <input type="hidden" name="vehicleId" value={vehicle.id} />

      <div className="mb-6">
        <Link
          href={`/veiculos/${vehicle.id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {vehicle.placa}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Checklist mensal
        </h1>
        <p className="text-sm text-slate-500">
          {vehicle.marca} {vehicle.modelo} · {vehicle.filialNome}
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Quilometragem atual
        </label>
        <input
          type="number"
          name="km"
          required
          min={vehicle.kmAtual}
          value={km}
          onChange={(e) => setKm(e.target.value)}
          className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <p className="mt-1 text-xs text-slate-500">
          Última registrada: {formatKm(vehicle.kmAtual)}
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <div
            key={category}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-100 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-700">
                {category}
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {itemDefs
                .filter((d) => d.category === category)
                .map((def) => {
                  const itemState = items[def.id];
                  return (
                    <div key={def.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-800">{def.label}</p>
                        <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300">
                          <button
                            type="button"
                            onClick={() => setStatus(def.id, "OK")}
                            className={`px-3 py-1 text-xs font-medium transition ${
                              itemState.status === "OK"
                                ? "bg-emerald-600 text-white"
                                : "bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(def.id, "AVARIA")}
                            className={`px-3 py-1 text-xs font-medium transition ${
                              itemState.status === "AVARIA"
                                ? "bg-red-600 text-white"
                                : "bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            Avaria
                          </button>
                        </div>
                      </div>
                      <input
                        type="hidden"
                        name={`status_${def.id}`}
                        value={itemState.status}
                      />

                      {itemState.status === "AVARIA" && (
                        <div className="mt-3 space-y-2 rounded-lg bg-red-50/60 p-3">
                          <textarea
                            name={`notes_${def.id}`}
                            value={itemState.notes}
                            onChange={(e) => setNotes(def.id, e.target.value)}
                            placeholder="Descreva a avaria…"
                            rows={2}
                            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
                          />
                          <div>
                            <label className="mb-1 block text-xs font-medium text-red-700">
                              Fotos (obrigatório)
                            </label>
                            <input
                              type="file"
                              name={`photos_${def.id}`}
                              accept="image/*"
                              capture="environment"
                              multiple
                              required
                              className="block w-full text-xs text-slate-600"
                            />
                            <p className="mt-1 text-[11px] text-slate-500">
                              Toque para tirar a foto com a câmera do celular
                              (ou escolher da galeria).
                            </p>
                          </div>
                        </div>
                      )}

                      {itemState.status === "OK" && (
                        <div className="mt-2">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Foto (opcional)
                          </label>
                          <input
                            type="file"
                            name={`photos_${def.id}`}
                            accept="image/*"
                            capture="environment"
                            multiple
                            className="block w-full text-xs text-slate-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="text-sm">
          {avariaCount > 0 ? (
            <span className="font-medium text-red-600">
              {avariaCount} avaria{avariaCount !== 1 && "s"} identificada
              {avariaCount !== 1 && "s"}
            </span>
          ) : (
            <span className="font-medium text-emerald-600">
              Tudo OK até agora
            </span>
          )}
        </div>
        <SubmitButton />
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
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
      className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Concluir conferência"}
    </button>
  );
}
