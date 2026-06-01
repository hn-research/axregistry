/**
 * GET /embed/<id-parts> — a tiny, self-contained HTML adoption card meant to be
 * dropped into an <iframe> anywhere (docs, dashboards, READMEs that allow HTML).
 * No site chrome, inline styles only, framing allowed. ?theme=light|dark.
 *
 * Shows the live observed-repo count + a trend sparkline. Public signal only.
 */

import { getServerRecord, observedRepoCount, getAdoptionHistory } from "@/lib/queries";
import { partsToId, idToHref } from "@/lib/serverPath";
import { KIND_FILL } from "@/lib/kindStyle";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function sparkPath(points: number[], w: number, h: number, pad = 3): string {
  if (points.length < 2) return "";
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  return points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (p - min) / span);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export async function GET(req: Request, ctx: { params: Promise<{ parts: string[] }> }) {
  const { parts } = await ctx.params;
  const id = partsToId(parts);
  const url = new URL(req.url);
  const light = url.searchParams.get("theme") === "light";

  const html = (inner: string) =>
    new Response(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ax-registry</title></head><body style="margin:0">${inner}</body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" } },
    );

  if (!id) return html(`<div style="font:13px system-ui;padding:12px;color:#888">Unknown server.</div>`);
  const record = await getServerRecord(id);
  if (!record) return html(`<div style="font:13px system-ui;padding:12px;color:#888">Unknown server.</div>`);

  const { server } = record;
  const [repos, history] = await Promise.all([
    observedRepoCount(server.id),
    getAdoptionHistory(server.id),
  ]);
  const trend = history.map((h) => h.repos);

  const fg = light ? "#18181b" : "#f4f4f5";
  const sub = light ? "#71717a" : "#a1a1aa";
  const bg = light ? "#ffffff" : "#0d0e11";
  const border = light ? "#e4e4e7" : "rgba(255,255,255,0.12)";
  const accent = KIND_FILL[server.kind] ?? "#818cf8";
  const href = idToHref(server.id);
  const spark = sparkPath(trend, 120, 36);

  const sparkSvg = spark
    ? `<svg viewBox="0 0 120 36" width="120" height="36" style="display:block"><path d="${spark}" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : "";

  const card = `
<a href="${esc(`${SITE_URL}${href}`)}" target="_blank" rel="noopener" style="
  display:flex;align-items:center;gap:14px;text-decoration:none;
  font:13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  background:${bg};color:${fg};border:1px solid ${border};border-radius:10px;
  padding:12px 14px;max-width:340px;box-sizing:border-box">
  <span style="width:8px;height:8px;border-radius:2px;background:${accent};flex:none"></span>
  <span style="min-width:0;flex:1">
    <span style="display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(server.displayName)}</span>
    <span style="color:${sub}">${repos.toLocaleString()} public repos observed</span>
  </span>
  ${sparkSvg}
</a>`;

  return html(card);
}
