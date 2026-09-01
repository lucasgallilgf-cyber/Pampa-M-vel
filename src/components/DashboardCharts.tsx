"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  LabelList,
} from "recharts";

const COLOR_BLUE = "#2a78d6";
const COLOR_ORANGE = "#eb6834";
const COLOR_MUTED = "#898781";
const COLOR_GRID = "#e1e0d9";
const COLOR_TEXT = "#52514e";

type FilialRow = {
  filialNome: string;
  conferidos: number;
  pendentes: number;
  avariasAbertas: number;
};

type PeriodRow = { mes: string; conferidos: number; avarias: number };

function shortFilial(nome: string) {
  return nome.replace(/^Filial - /, "").replace(/^Matriz - /, "");
}

function formatMonth(mes: string) {
  const [y, m] = mes.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export function FilialBarChart({ data }: { data: FilialRow[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: shortFilial(d.filialNome),
  }));

  // Mostra o total (conferidos + pendentes) em cima de cada barra empilhada.
  // Usa "content" em vez do formatter padrão do LabelList porque o total
  // depende dos dois valores da barra, não só do valor da série "pendentes"
  // a que o LabelList está anexado.
  function renderTotalLabel(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    index?: number;
  }) {
    const { index } = props;
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    if (
      index == null ||
      Number.isNaN(x) ||
      Number.isNaN(y) ||
      Number.isNaN(width)
    )
      return null;
    const row = chartData[index];
    if (!row) return null;
    const total = row.conferidos + row.pendentes;
    if (total === 0) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill={COLOR_TEXT}
      >
        {total}
      </text>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} barCategoryGap={16} margin={{ top: 20 }}>
        <CartesianGrid
          vertical={false}
          stroke={COLOR_GRID}
          strokeDasharray="0"
        />
        <XAxis
          dataKey="label"
          tick={{ fill: COLOR_TEXT, fontSize: 12 }}
          axisLine={{ stroke: COLOR_GRID }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: COLOR_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15) || 1]}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e1e0d9",
            fontSize: 13,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: COLOR_TEXT }}
          formatter={(v) =>
            v === "conferidos" ? "Conferidos" : "Pendentes"
          }
        />
        <Bar
          dataKey="conferidos"
          stackId="a"
          fill={COLOR_BLUE}
          radius={[0, 0, 0, 0]}
          maxBarSize={24}
        />
        <Bar
          dataKey="pendentes"
          stackId="a"
          fill={COLOR_ORANGE}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        >
          <LabelList dataKey="pendentes" content={renderTotalLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PeriodLineChart({ data }: { data: PeriodRow[] }) {
  const chartData = data.map((d) => ({ ...d, label: formatMonth(d.mes) }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData}>
        <CartesianGrid
          vertical={false}
          stroke={COLOR_GRID}
          strokeDasharray="0"
        />
        <XAxis
          dataKey="label"
          tick={{ fill: COLOR_TEXT, fontSize: 12 }}
          axisLine={{ stroke: COLOR_GRID }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: COLOR_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e1e0d9",
            fontSize: 13,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: COLOR_TEXT }}
          formatter={(v) => (v === "conferidos" ? "Conferidos" : "Avarias")}
        />
        <Line
          type="monotone"
          dataKey="conferidos"
          stroke={COLOR_BLUE}
          strokeWidth={2}
          dot={{ r: 4, fill: COLOR_BLUE, strokeWidth: 2, stroke: "#fcfcfb" }}
        />
        <Line
          type="monotone"
          dataKey="avarias"
          stroke={COLOR_ORANGE}
          strokeWidth={2}
          dot={{ r: 4, fill: COLOR_ORANGE, strokeWidth: 2, stroke: "#fcfcfb" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
