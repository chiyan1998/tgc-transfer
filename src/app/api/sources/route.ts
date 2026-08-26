import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { sourcesRepo, subscriptionsRepo, fetchLogsRepo } from "@/server/db/repositories/sources";
import { fetchSource } from "@/server/ingest";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const sources = subscriptionsRepo.listByUser(user.id).map((s) => ({
    ...s,
    lastFetch: fetchLogsRepo.lastForSource(s.id) ?? null,
  }));
  return NextResponse.json({ data: { sources, isAdmin: user.role === "admin" } });
}

const body = z.object({
  kind: z.enum(["journal", "arxiv", "nber", "book"]),
  identifier: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  publisher: z.string().max(256).optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数校验失败" }, { status: 422 });

  const source = sourcesRepo.upsert(parsed.data);
  subscriptionsRepo.subscribe(user.id, source.id);

  // 首次订阅立即抓取（回填 30 天），不阻塞响应
  if (!source.last_fetched_at) {
    fetchSource(sourcesRepo.findById(source.id)!).catch(() => undefined);
  }
  return NextResponse.json({ data: { source } }, { status: 201 });
}
