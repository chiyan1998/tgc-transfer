import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-utils";
import { ARXIV_CATEGORIES } from "@/server/ingest/adapters/arxiv";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ data: { categories: ARXIV_CATEGORIES } });
}
