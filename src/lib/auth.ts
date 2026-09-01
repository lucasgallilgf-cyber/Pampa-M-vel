import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "frota_session";
const alg = "HS256";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado.");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "GERENTE" | "SUPERVISOR" | "CONDUTOR";
  filialId: string | null;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Use in server components/pages. Redirects to /login if not authenticated,
 * or to / if authenticated but role not allowed. */
export async function requireUser(
  allowedRoles?: SessionPayload["role"][]
): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect("/");
  }
  return session;
}

// Kept here for backwards compatibility with existing server-side imports.
// Client components must import ROLE_LABELS from "@/lib/domain" directly —
// this module pulls in next/headers and cannot be bundled into client code.
export { ROLE_LABELS } from "./domain";

// Sentinel filialId that never matches a real row — used so a SUPERVISOR
// without filial cadastrada vê a lista vazia em vez de ver tudo (undefined
// nas queries desativa o filtro por completo).
const NO_FILIAL_SENTINEL = "__sem_filial_cadastrada__";

/**
 * SUPERVISOR só pode ver/filtrar pela própria filial (a "filial principal"
 * do cadastro) — nunca as demais, mesmo tentando trocar o filtro pela URL.
 * As outras roles (ADMIN, GERENTE) continuam livres para escolher qualquer
 * filial ou "todas", então `requested` só é respeitado nesse caso.
 */
export function scopedFilialId(
  session: SessionPayload,
  requested?: string
): string | undefined {
  if (session.role === "SUPERVISOR") {
    return session.filialId ?? NO_FILIAL_SENTINEL;
  }
  return requested;
}

/** Usado nas páginas de detalhe (veículo, conferência, ocorrência) pra
 * bloquear acesso direto por URL a algo fora da filial do SUPERVISOR. */
export function canAccessFilial(
  session: SessionPayload,
  filialId: string | null | undefined
): boolean {
  if (session.role !== "SUPERVISOR") return true;
  return !!filialId && filialId === session.filialId;
}
