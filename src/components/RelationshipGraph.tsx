"use client";

/**
 * Ego relationship graph: the server sits at the center, surrounded by the
 * servers it co-occurs with (inner ring) and the consumer repos that reference
 * it (outer ring). Hand-rolled radial SVG — deterministic layout, no physics
 * lib, interactive hover to isolate a node's edge.
 *
 * Data is the public demand-side graph (§5.3). Opted-out consumers appear as
 * un-named, non-linked nodes (the count survives, the identity does not — §10.7).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface GraphNode {
  id: string;
  label: string;
  kind: string; // server kind, or "consumer"
  weight: number;
  fill: string;
  href?: string | null; // internal server href, or external repo url, or null
  external?: boolean;
}

export interface GraphData {
  center: { label: string; fill: string };
  servers: GraphNode[];
  consumers: GraphNode[];
}

const W = 680;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const R_SERVERS = 135;
const R_CONSUMERS = 220;

function ring(count: number, radius: number, phase = 0) {
  // Evenly distribute `count` points on a circle, starting at `phase` radians.
  return Array.from({ length: count }, (_, i) => {
    const a = phase + (i / Math.max(1, count)) * Math.PI * 2;
    return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
  });
}

export function RelationshipGraph({ data }: { data: GraphData }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  const serverPts = ring(data.servers.length, R_SERVERS, -Math.PI / 2);
  const consumerPts = ring(data.consumers.length, R_CONSUMERS, -Math.PI / 2 + 0.18);

  const maxServerW = Math.max(1, ...data.servers.map((s) => s.weight));

  const nodes: { node: GraphNode; x: number; y: number; r: number }[] = [
    ...data.servers.map((node, i) => ({
      node,
      x: serverPts[i].x,
      y: serverPts[i].y,
      r: 6 + 8 * (node.weight / maxServerW),
    })),
    ...data.consumers.map((node, i) => ({
      node,
      x: consumerPts[i].x,
      y: consumerPts[i].y,
      r: 5,
    })),
  ];

  const dim = (id: string) => hover !== null && hover !== id;

  function activate(node: GraphNode) {
    if (!node.href) return;
    if (node.external) window.open(node.href, "_blank", "noopener,noreferrer");
    else router.push(node.href);
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto h-auto w-full max-w-3xl"
        role="img"
        aria-label="Relationship graph centered on this server"
      >
        {/* orbit guides */}
        <g className="stroke-zinc-200 dark:stroke-zinc-800" fill="none">
          <circle cx={CX} cy={CY} r={R_SERVERS} strokeDasharray="2 5" />
          <circle cx={CX} cy={CY} r={R_CONSUMERS} strokeDasharray="2 5" />
        </g>

        {/* edges */}
        <g>
          {nodes.map(({ node, x, y }) => (
            <line
              key={`e-${node.id}`}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke={node.fill}
              strokeWidth={node.kind === "consumer" ? 1 : 1.5}
              strokeOpacity={dim(node.id) ? 0.06 : node.kind === "consumer" ? 0.2 : 0.35}
              strokeDasharray={node.kind === "consumer" ? "3 3" : undefined}
            />
          ))}
        </g>

        {/* outer nodes */}
        <g>
          {nodes.map(({ node, x, y, r }) => (
            <g
              key={node.id}
              transform={`translate(${x} ${y})`}
              className={node.href ? "cursor-pointer" : "cursor-default"}
              onMouseEnter={() => setHover(node.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => activate(node)}
              opacity={dim(node.id) ? 0.25 : 1}
            >
              <circle
                r={r}
                fill={node.fill}
                fillOpacity={node.kind === "consumer" ? 0.55 : 0.85}
                stroke={node.kind === "consumer" ? node.fill : "white"}
                strokeWidth={node.kind === "consumer" ? 1 : 1.5}
              />
              {hover === node.id && (
                <text
                  x={x > CX ? r + 5 : -(r + 5)}
                  y={4}
                  textAnchor={x > CX ? "start" : "end"}
                  paintOrder="stroke"
                  className="pointer-events-none select-none fill-zinc-900 stroke-white text-[12px] font-medium [stroke-width:3px] dark:fill-zinc-100 dark:stroke-zinc-950"
                >
                  {node.label}
                  {node.kind !== "consumer" && node.weight > 1 ? ` · ${node.weight}` : ""}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* center */}
        <g transform={`translate(${CX} ${CY})`}>
          <circle r={20} fill={data.center.fill} stroke="white" strokeWidth={2} />
          <text
            y={36}
            textAnchor="middle"
            className="fill-zinc-900 text-[13px] font-semibold dark:fill-zinc-100"
          >
            {data.center.label}
          </text>
        </g>
      </svg>

      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span>● center: this server</span>
        <span>━ inner ring: co-occurring servers (size = shared repos)</span>
        <span>┄ outer ring: consumer repos</span>
        <span className="text-zinc-400">— hover a node for its name, click to open</span>
      </div>
    </div>
  );
}
