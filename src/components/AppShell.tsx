import Link from "next/link";
import { SessionPayload, ROLE_LABELS } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

const NAV_ITEMS: {
  href: string;
  label: string;
  roles: SessionPayload["role"][];
}[] = [
  {
    href: "/",
    label: "Dashboard",
    roles: ["ADMIN", "GERENTE", "SUPERVISOR", "CONDUTOR"],
  },
  {
    href: "/veiculos",
    label: "Veículos",
    roles: ["ADMIN", "GERENTE", "SUPERVISOR"],
  },
  {
    href: "/meu-veiculo",
    label: "Meu veículo",
    roles: ["CONDUTOR"],
  },
  {
    href: "/ocorrencias",
    label: "Avarias",
    roles: ["ADMIN", "GERENTE", "SUPERVISOR", "CONDUTOR"],
  },
  {
    href: "/manutencao",
    label: "Manutenção",
    roles: ["ADMIN", "GERENTE", "SUPERVISOR"],
  },
  {
    href: "/usuarios",
    label: "Usuários",
    roles: ["ADMIN"],
  },
  {
    href: "/filiais",
    label: "Filiais",
    roles: ["ADMIN"],
  },
];

export default function AppShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  const items = NAV_ITEMS.filter((i) => i.roles.includes(session.role));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm text-white">
                F
              </span>
              <span className="hidden sm:inline">Controle de Frota</span>
            </Link>
            <nav className="flex items-center gap-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">
                {session.name}
              </p>
              <p className="text-xs leading-tight text-slate-500">
                {ROLE_LABELS[session.role]}
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
