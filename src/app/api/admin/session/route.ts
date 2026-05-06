import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  return NextResponse.json({ authenticated: isValidAdminSession(session) });
}
