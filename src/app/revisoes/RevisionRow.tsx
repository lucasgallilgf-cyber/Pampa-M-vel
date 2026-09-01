"use client";

import { useState, useTransition } from "react";
import Badge from "@/components/Badge";
import { formatKm, REVISION_STATUS_LABELS, REVISION_STATUS_STYLES } from "@/lib/domain";
import { upsertVehicleRevisionAction } from "./actions";

export type RevisionRowData = {
  vehicleId: string;
  placa: string;
  modelo: string;
  marca: string;
  filialNome: string | null;
  kmAtual: number;
  kmAlvo: number;
  status: "PENDENTE" | "FEITO";
  dataRevisao: string | Date | null;
  kmRevisao: number | null;
  observacao: string | null;
};

function dateInputValue(d: string | Date | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

export default function RevisionRow({ row }: { row: RevisionRowData }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await upsertVehicleRevisionAction(
        { error: null },
        formData
      );
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-4 py-2.5 text-slate-600">{row.filialNome ?? "—"}</td>
        <td className="px-4 py-2.5 font-medium text-slate-900">{row.placa}</td>
        <td className="px-4 py-2.5 text-slate-600">
          {row.marca} {row.modelo}
        </td>
        <td className="px-4 py-2.5 text-slate-600">{formatKm(row.kmAtual)}</td>
        <td className="px-4 py-2.5 text-slate-600">{formatKm(row.kmAlvo)}</td>
        <td className="px-4 py-2.5">
          <button type="button" onClick={() => setEditing((v) => !v)}>
            <Badge className={REVISION_STATUS_STYLES[row.status]}>
              {REVISION_STATUS_LABELS[row.status]}
            </Badge>
          </button>
        </td>
        <td className="px-4 py-2.5 text-slate-600">
          {row.dataRevisao ? (
            new Date(row.dataRevisao).toLocaleDateString("pt-BR")
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="max-w-[220px] truncate px-4 py-2.5 text-slate-600">
          {row.observacao || <span className="text-slate-400">—</span>}
        </td>
        <td className="px-4 py-2.5 text-right">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="font-medium text-slate-700 hover:underline"
          >
            {editing ? "Fechar" : "Editar"}
          </button>
        </td>
      </tr>

      {editing && (
        <tr className="bg-slate-50">
          <td colSpan={9} className="px-4 py-4">
            <form
              onSubmit={handleSubmit}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="vehicleId" value={row.vehicleId} />
              <input type="hidden" name="kmAlvo" value={row.kmAlvo} />

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={row.status}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="FEITO">Feito</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Data da revisão
                </label>
                <input
                  type="date"
                  name="dataRevisao"
                  defaultValue={dateInputValue(row.dataRevisao)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  KM da revisão
                </label>
                <input
                  type="number"
                  name="kmRevisao"
                  min={0}
                  defaultValue={row.kmRevisao ?? row.kmAtual}
                  className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Observação
                </label>
                <input
                  type="text"
                  name="observacao"
                  defaultValue={row.observacao ?? ""}
                  placeholder="Ex: agendar, ordem de serviço nº…"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isPending ? "Salvando…" : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm text-slate-500 hover:underline"
              >
                Cancelar
              </button>
            </form>

            {error && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
