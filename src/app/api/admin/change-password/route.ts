import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, changeAdminPassword, isValidAdminSession } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const result = changeAdminPassword(String(body.currentPassword || ""), String(body.nextPassword || ""));

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
