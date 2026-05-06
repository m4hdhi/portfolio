import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  createAdminSession,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!verifyAdminPassword(String(body.password || ""))) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
