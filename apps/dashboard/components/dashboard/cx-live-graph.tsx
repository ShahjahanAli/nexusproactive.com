'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Button } from '@/components/dashboard/ui/button';

type GraphNodeKind = 'cx_agent' | 'customer' | 'specialist' | 'human';
type GraphEdgeKind = 'owns' | 'consult' | 'escalation' | 'peer';

interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  sublabel?: string;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: GraphEdgeKind;
  label?: string;
  active?: boolean;
}

interface LiveGraph {
  generated_at: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  enabled: boolean;
}

const KIND_COLOR: Record<GraphNodeKind, string> = {
  cx_agent: '#34d399',
  customer: '#60a5fa',
  specialist: '#a78bfa',
  human: '#fbbf24',
};

const EDGE_COLOR: Record<GraphEdgeKind, string> = {
  owns: '#71717a',
  consult: '#8b5cf6',
  escalation: '#f59e0b',
  peer: '#10b981',
};

function layoutNodes(nodes: GraphNode[], width: number, height: number) {
  const columns: Record<GraphNodeKind, GraphNode[]> = {
    cx_agent: [],
    customer: [],
    specialist: [],
    human: [],
  };
  for (const n of nodes) columns[n.kind].push(n);

  const xFor: Record<GraphNodeKind, number> = {
    cx_agent: width * 0.14,
    customer: width * 0.42,
    specialist: width * 0.68,
    human: width * 0.9,
  };

  const pos = new Map<string, { x: number; y: number }>();
  (Object.keys(columns) as GraphNodeKind[]).forEach((kind) => {
    const list = columns[kind];
    const n = Math.max(list.length, 1);
    list.forEach((node, i) => {
      const y = (height * (i + 1)) / (n + 1);
      pos.set(node.id, { x: xFor[kind], y });
    });
  });
  return pos;
}

export function CxLiveGraphView() {
  const [graph, setGraph] = useState<LiveGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/cx-agents/live-graph', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as {
      graph?: LiveGraph;
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Failed to load graph');
      return;
    }
    setGraph(data.graph ?? null);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [auto, load]);

  const width = 960;
  const nodes = graph?.nodes ?? [];

  const kindCounts = useMemo(() => {
    const counts: Record<GraphNodeKind, number> = {
      cx_agent: 0,
      customer: 0,
      specialist: 0,
      human: 0,
    };
    for (const n of nodes) counts[n.kind] += 1;
    return counts;
  }, [nodes]);

  // Grow the canvas with the busiest column so names never collide.
  const height = useMemo(() => {
    const tallest = Math.max(...(Object.values(kindCounts) as number[]), 1);
    return Math.min(1400, Math.max(400, (tallest + 1) * 96));
  }, [kindCounts]);

  const positions = useMemo(() => layoutNodes(nodes, width, height), [nodes, height]);

  const selectedNode = graph?.nodes.find((n) => n.id === selected);
  const relatedEdges =
    graph?.edges.filter((e) => e.from === selected || e.to === selected) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-zinc-500">
          Lines show who each CX Agent is working with right now — customer chats, specialists,
          and human agents. Refreshes every 5 seconds.
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />
            Live
          </label>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && !graph ? (
        <p className="text-sm text-zinc-500">Loading graph…</p>
      ) : graph && !graph.enabled ? (
        <Panel>
          <PanelBody>
            <p className="text-sm text-amber-200">
              Live graph is disabled on your plan. Ask your platform admin to enable{' '}
              <span className="font-mono text-xs">cx_live_graph_enabled</span>.
            </p>
          </PanelBody>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          <Panel>
            <PanelHeader
              title="Live connections"
              subtitle={
                graph?.generated_at
                  ? `Updated ${new Date(graph.generated_at).toLocaleTimeString()}`
                  : undefined
              }
            />
            <PanelBody className="overflow-x-auto p-2 sm:p-4">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-auto w-full min-h-[360px] rounded-lg"
                role="img"
                aria-label="CX Agents live connection graph"
              >
                {/* Explicit canvas so label contrast never depends on the page theme. */}
                <rect x={0} y={0} width={width} height={height} rx={10} fill="#09090b" />
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#52525b" />
                  </marker>
                </defs>

                {(graph?.edges ?? []).map((e) => {
                  const a = positions.get(e.from);
                  const b = positions.get(e.to);
                  if (!a || !b) return null;
                  const highlight =
                    selected && (e.from === selected || e.to === selected);
                  return (
                    <g key={e.id}>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={EDGE_COLOR[e.kind]}
                        strokeWidth={e.active || highlight ? 2.5 : 1.25}
                        strokeOpacity={highlight || !selected ? 0.9 : 0.2}
                        markerEnd="url(#arrow)"
                      />
                      {e.label && (highlight || e.active) && (
                        <text
                          x={(a.x + b.x) / 2}
                          y={(a.y + b.y) / 2 - 6}
                          fill="#d4d4d8"
                          stroke="#09090b"
                          strokeWidth={3}
                          paintOrder="stroke"
                          fontSize="11"
                          textAnchor="middle"
                          className="font-mono"
                        >
                          {e.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {nodes.map((n) => {
                  const p = positions.get(n.id);
                  if (!p) return null;
                  const isSel = selected === n.id;
                  const showSublabel = Boolean(n.sublabel) && (isSel || kindCounts[n.kind] <= 6);
                  const dim = Boolean(
                    selected &&
                      !isSel &&
                      !relatedEdges.some((e) => e.from === n.id || e.to === n.id),
                  );
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${p.x}, ${p.y})`}
                      className="cursor-pointer"
                      onClick={() => setSelected(isSel ? null : n.id)}
                    >
                      <title>
                        {n.label}
                        {n.sublabel ? ` — ${n.sublabel}` : ''}
                      </title>
                      {/* Dim the marker, not the name — labels stay readable when filtering. */}
                      <circle
                        r={isSel ? 22 : 18}
                        fill="#18181b"
                        stroke={KIND_COLOR[n.kind]}
                        strokeWidth={isSel ? 3 : 2}
                        opacity={dim ? 0.3 : 1}
                      />
                      <circle r={6} fill={KIND_COLOR[n.kind]} opacity={dim ? 0.3 : 1} />
                      <text
                        y={36}
                        fill={isSel ? '#ffffff' : '#f4f4f5'}
                        stroke="#09090b"
                        strokeWidth={3.5}
                        paintOrder="stroke"
                        fontSize="12.5"
                        fontWeight={600}
                        textAnchor="middle"
                        opacity={dim ? 0.72 : 1}
                        className="font-sans"
                      >
                        {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
                      </text>
                      {showSublabel && n.sublabel && (
                        <text
                          y={52}
                          fill="#a1a1aa"
                          stroke="#09090b"
                          strokeWidth={3}
                          paintOrder="stroke"
                          fontSize="10.5"
                          textAnchor="middle"
                          opacity={dim ? 0.6 : 1}
                          className="font-mono"
                        >
                          {n.sublabel.length > 24
                            ? `${n.sublabel.slice(0, 23)}…`
                            : n.sublabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] text-zinc-500">
                {(Object.keys(KIND_COLOR) as GraphNodeKind[]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: KIND_COLOR[k] }}
                    />
                    {k.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Details" />
            <PanelBody>
              {!selectedNode ? (
                <p className="text-sm text-zinc-500">
                  Click a node to inspect connections.
                </p>
              ) : (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-zinc-100">{selectedNode.label}</p>
                    <p className="font-mono text-[11px] text-zinc-500">
                      {selectedNode.kind}
                      {selectedNode.sublabel ? ` · ${selectedNode.sublabel}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                      Links ({relatedEdges.length})
                    </p>
                    <ul className="space-y-1.5 text-xs text-zinc-400">
                      {relatedEdges.length === 0 && <li>No links</li>}
                      {relatedEdges.map((e) => (
                        <li key={e.id}>
                          <span className="text-zinc-500">{e.kind}</span> →{' '}
                          {e.from === selected ? e.to : e.from}
                          {e.label ? ` (${e.label})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      )}
    </div>
  );
}
