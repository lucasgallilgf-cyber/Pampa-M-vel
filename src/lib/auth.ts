import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listUserFiliaisIds } from "./queries";

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

// Sentinel filialId que nunca bate com uma filial real — usado quando um
// SUPERVISOR não tem nenhuma filial cadastrada (nem principal, nem
// adicional), pra ele ver a lista vazia em vez de ver tudo (undefined nas
// queries desativa o filtro por completo, o que seria o oposto do queremos).
const NO_FILIAL_SENTINEL = "__sem_filial_cadastrada__";

/**
 * Filiais que um SUPERVISOR pode ver/filtrar: a "filial principal" do
 * cadastro + qualquer uma marcada em "outras filiais que este usuário
 * também gerencia". Busca sempre no banco (não fica salvo no token de
 * sessão) pra uma mudança no cadastro valer imediatamente, sem precisar
 * esperar o usuário logar de novo.
 *
 * Retorna `null` pra ADMIN/GERENTE — sinal de "sem restrição", livre pra
 * ver/filtrar qualquer filial.
 */
export async function getAllowedFilialIds(
  session: SessionPayload
): Promise<string[] | null> {
  if (session.role !== "SUPERVISOR") return null;
  const extras = await listUserFiliaisIds(session.id);
  const ids = new Set(extras);
  if (session.filialId) ids.add(session.filialId);
  return Array.from(ids);
}

/**
 * A partir das filiais permitidas (`null` = sem restrição) e do que foi
 * pedido no filtro da tela, decide quais filiais efetivamente usar na
 * consulta: sem restrição, respeita o pedido (ou nenhum, pra "todas");
 * restrito, só aceita um pedido que esteja dentro do permitido — senão
 * (nada pedido, ou pedido fora do permitido) usa o conjunto inteiro
 * permitido, pra mostrar os dados combinados de todas as filiais dele.
 */
export function resolveFilialFilter(
  allowedFilialIds: string[] | null,
  requested?: string
): string[] | undefined {
  if (allowedFilialIds === null) {
    return requested ? [requested] : undefined;
  }
  if (allowedFilialIds.length === 0) {
    return [NO_FILIAL_SENTINEL];
  }
  if (requested && allowedFilialIds.includes(requested)) {
    return [requested];
  }
  return allowedFilialIds;
}

/** Usado nas páginas de detalhe (veículo, conferência, ocorrência) pra
 * bloquear acesso direto por URL a algo fora das filiais permitidas do
 * SUPERVISOR. */
export function canAccessFilial(
  allowedFilialIds: string[] | null,
  filialId: string | null | undefined
): boolean {
  if (allowedFilialIds === null) return true;
  return !!filialId && allowedFilialIds.includes(filialId);
}
