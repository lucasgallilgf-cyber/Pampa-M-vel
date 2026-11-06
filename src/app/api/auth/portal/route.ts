import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { filiais, users } from "@/db/schema";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

/**
 * Acesso único vindo do Portal Pampa (portal-pampa.vercel.app).
 *
 * O portal manda um "passe" assinado (JWT HS256 com PORTAL_SSO_SECRET, válido
 * por 2 minutos) com e-mail, nome, filial do login e se a pessoa é admin do
 * portal. Aqui ele é validado e vira uma sessão normal do Frota:
 *  - usuário existente (e ativo) entra com o papel que já tem no Frota;
 *  - usuário que ainda não existe é criado como SUPERVISOR da filial;
 *  - quem não é admin do portal fica preso à filial do login
 *    (portalFilialId na sessão → getAllowedFilialIds devolve só ela).
 */

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function erro(msg: string, status = 403) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Controle de Frota</title>
<body style="font-family:system-ui,Arial,sans-serif;background:#f5f6f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px">
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;max-width:440px;color:#1f2937">
<h1 style="font-size:1.2rem;margin:0 0 8px;color:#1c3a5e">Não foi possível entrar pelo Portal</h1>
<p style="color:#6b7280;line-height:1.5;margin:0 0 16px">${msg}</p>
<a href="https://portal-pampa.vercel.app" style="color:#1c3a5e;font-weight:600">← Voltar ao Portal Pampa</a></div></body>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const secret = process.env.PORTAL_SSO_SECRET;
  const t = req.nextUrl.searchParams.get("t");
  if (!secret || !t) return erro("Acesso pelo portal não configurado.", 400);

  let p: { email?: string; nome?: string; filial?: string; admin?: boolean };
  try {
    ({ payload: p } = await jwtVerify(t, new TextEncoder().encode(secret), {
      issuer: "portal-pampa",
      audience: "frota-checklist",
    }));
  } catch {
    return erro("O link de acesso expirou. Volte ao portal e clique no módulo de novo.", 401);
  }

  const email = String(p.email || "").trim().toLowerCase();
  const filialNome = String(p.filial || "");
  const portalAdmin = p.admin === true;
  if (!email) return erro("Passe de acesso inválido.", 400);

  // Filial do login no portal → filial do Frota (compara nome ou código, sem acento/maiúsculas)
  const todas = await db.select({ id: filiais.id, nome: filiais.nome, codigo: filiais.codigo }).from(filiais);
  const sigla = norm(filialNome.split("—")[0]);
  const doLogin = todas.filter((f) => [sigla, "jcb " + sigla, norm(filialNome)].includes(norm(f.nome)) || norm(f.codigo) === sigla);
  const filial = doLogin[0];
  if (!filial && !portalAdmin) {
    return erro(`A filial "${filialNome}" do portal não existe no Controle de Frota. Os nomes das filiais precisam ser iguais nos dois sistemas.`);
  }

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user && !user.active) return erro("Seu usuário está desativado no Controle de Frota.");
  if (!user) {
    const nome = String(p.nome || "").trim() || email.split("@")[0];
    [user] = await db
      .insert(users)
      .values({
        name: nome,
        email,
        passwordHash: await hash(randomBytes(24).toString("hex"), 10),
        role: portalAdmin ? "ADMIN" : "SUPERVISOR",
        filialId: filial?.id ?? null,
      })
      .returning();
  }

  const token = await signSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    filialId: user.filialId,
    portalFilialIds: portalAdmin ? null : doLogin.map((f) => f.id),
  });

  const res = NextResponse.redirect(new URL(user.role === "CONDUTOR" ? "/meu-veiculo" : "/", req.url));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
