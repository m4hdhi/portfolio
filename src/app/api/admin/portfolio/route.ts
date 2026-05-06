import fs from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-auth";

const contentPath = path.join(process.cwd(), "src/data/portfolio-content.json");

async function requireAdmin() {
  const cookieStore = await cookies();
  return isValidAdminSession(cookieStore.get(COOKIE_NAME)?.value);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await fs.readFile(contentPath, "utf-8");
  return NextResponse.json(JSON.parse(raw));
}

export async function PUT(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const content = await request.json();
  await fs.writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`);
  return NextResponse.json({ ok: true });
}
