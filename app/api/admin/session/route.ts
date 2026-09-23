import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE, ADMIN_COOKIE_PATH, ADMIN_SESSION_SECONDS,
  clearFailedLogins, createAdminSession, hasAdminRequest, hasSameOrigin,
  isLoginBlocked, recordFailedLogin, verifyAdminPassword,
} from "@/lib/blog-admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  try {
    const input = await request.json() as { username?: unknown; password?: unknown };
    if (typeof input.username !== "string" || typeof input.password !== "string") {
      return NextResponse.json({ error: "Credenciales inválidas." }, { status: 400 });
    }
    if (await isLoginBlocked(request)) {
      return NextResponse.json({ error: "Demasiados intentos. Volvé a probar en 15 minutos." }, { status: 429 });
    }
    if (!verifyAdminPassword(input.username, input.password)) {
      await recordFailedLogin(request);
      return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }
    await clearFailedLogins(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: ADMIN_COOKIE_PATH,
      maxAge: ADMIN_SESSION_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("Admin login failed", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request) || !hasAdminRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete({ name: ADMIN_COOKIE, path: ADMIN_COOKIE_PATH });
  return response;
}
