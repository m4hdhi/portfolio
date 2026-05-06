import { cookies } from "next/headers";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-auth";

const contentPath = path.join(process.cwd(), "src/data/portfolio-content.json");

export async function GET() {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await fs.readFile(contentPath, "utf-8");
  const content = JSON.parse(raw) as { settings?: { websocketUrl?: string } };

  return NextResponse.json({
    env: {
      resendApiKey: Boolean(process.env.RESEND_API_KEY),
      websocketUrl: content.settings?.websocketUrl || process.env.NEXT_PUBLIC_WS_URL || "",
      websocketEnvFallback: process.env.NEXT_PUBLIC_WS_URL || "",
      umamiDomain: process.env.UMAMI_DOMAIN || "",
      umamiSiteIdConfigured: Boolean(process.env.UMAMI_SITE_ID),
      adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
      adminSessionSecretConfigured: Boolean(process.env.ADMIN_SESSION_SECRET),
      realtimeAdminSecretConfigured: Boolean(process.env.ADMIN_SECRET),
    },
  });
}
