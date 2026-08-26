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
