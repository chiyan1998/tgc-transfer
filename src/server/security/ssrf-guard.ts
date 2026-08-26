/**
 * 出站 SSRF 防护（design/architecture.md §7 第 4 层）：
 * 所有服务端代发的请求（抓取、PDF 下载、元数据查询）必须经此校验。
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOST_SUFFIXES = [
  ".local",
  ".internal",
  ".localhost",
  ".arpa",
];

function ipToLong(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) return true; // 简化：拒绝 IPv6（上游均为 IPv4 公共服务）
  const n = ipToLong(ip);
  const ranges: [number, number][] = [
    [ipToLong("10.0.0.0"), ipToLong("10.255.255.255")],
    [ipToLong("172.16.0.0"), ipToLong("172.31.255.255")],
    [ipToLong("192.168.0.0"), ipToLong("192.168.255.255")],
    [ipToLong("127.0.0.0"), ipToLong("127.255.255.255")],
    [ipToLong("169.254.0.0"), ipToLong("169.254.255.255")],
    [ipToLong("0.0.0.0"), ipToLong("0.255.255.255")],
  ];
  return ranges.some(([lo, hi]) => n >= lo && n <= hi);
}

export class SsrfError extends Error {
  constructor(url: string) {
    super(`blocked outbound url: ${new URL(url).host}`);
    this.name = "SsrfError";
  }
}

/** 校验 URL 合法性：仅 http/https、80/443、非内网主机 */
export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(rawUrl);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SsrfError(rawUrl);
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") throw new SsrfError(rawUrl);
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) throw new SsrfError(rawUrl);

  if (isIP(host)) {
    if (isPrivateIp(host)) throw new SsrfError(rawUrl);
    return;
  }
  const { address } = await lookup(host);
  if (isPrivateIp(address)) throw new SsrfError(rawUrl);
}

/** 安全 fetch：校验后请求，禁止跟随重定向（防止 302 到内网），默认 30s 超时 */
export async function safeFetch(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  await assertSafeUrl(url);
  const { timeoutMs, ...rest } = init ?? {};
  return fetch(url, {
    ...rest,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs ?? 30_000),
    headers: { "User-Agent": "TGC-Transfer/1.0 (academic aggregator)", ...(rest.headers ?? {}) },
  });
}

/** 跟随重定向的安全版（每一跳都重新校验），用于元数据类请求 */
export async function safeFetchFollow(url: string, maxRedirects = 5, init?: RequestInit): Promise<Response> {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await safeFetch(current, init);
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return res;
      current = new URL(next, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}
