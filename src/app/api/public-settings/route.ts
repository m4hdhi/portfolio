import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const contentPath = path.join(process.cwd(), "src/data/portfolio-content.json");

export async function GET() {
  const raw = await fs.readFile(contentPath, "utf-8");
  const content = JSON.parse(raw) as { settings?: { websocketUrl?: string } };

  return NextResponse.json(
    {
      websocketUrl: content.settings?.websocketUrl || process.env.NEXT_PUBLIC_WS_URL || "",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
