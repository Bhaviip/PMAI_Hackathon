"use client";

import type { CodeChange, Level, ProjectFile } from "@/fixtures/codeChangeDemo";
import { LEVELS, LEVEL_ORDER } from "@/lib/levels";

type Props = {
  change: CodeChange;
  kinds: Map<string, ProjectFile["kind"]>;
  selected: string | null;
  focusLevel: Level | null;
  onSelect: (path: string) => void;
};

const W = 760;
const H = 500;
const CX = W / 2;
const CY = H / 2;
const NODE_W = 212;
const NODE_H = 62;
const KIND_TAG: Record<ProjectFile["kind"], string> = { code: "CODE", test: "TEST", doc: "DOC" };

const MAX_NODES = 8;

const fileName = (p: string) => p.split("/").pop() ?? p;

// Shortens long names in the middle so the extension stays visible.
const fit = (name: string, max: number) =>
  name.length <= max ? name : `${name.slice(0, max - 7)}…${name.slice(-6)}`;

// The changed file sits in the middle; every affected file is placed around it,
// most severe first, starting at the top and going clockwise.
export function ImpactMap({ change, kinds, selected, focusLevel, onSelect }: Props) {
  // The map shows the most severe files; the full list sits below it.
  const sorted = [...change.impacts].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
  const impacts = sorted.slice(0, MAX_NODES);
  const hidden = sorted.length - impacts.length;
  const n = impacts.length;
  const nodes = impacts.map((imp, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    // Flatten the diagonals so neighbouring cards near the top and bottom don't overlap.
    const sin = Math.sin(angle);
    const y = Math.sign(sin) * Math.abs(sin) ** 1.6;
    return { imp, x: CX + Math.cos(angle) * 254, y: CY + y * 186, angle };
  });
  const dimmed = (level: Level) => focusLevel !== null && focusLevel !== level;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label="Map of files affected by the change">
      <defs>
        <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill="#e2e8f0" />
        </pattern>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.08" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="url(#dots)" rx={16} />

      {nodes.map(({ imp, x, y, angle }) => {
        // Bend each edge slightly so the map reads as a network, not a wheel.
        const mx = (CX + x) / 2 + Math.cos(angle + Math.PI / 2) * 22;
        const my = (CY + y) / 2 + Math.sin(angle + Math.PI / 2) * 22;
        const on = selected === imp.path;
        return (
          <path
            key={`e-${imp.path}`}
            d={`M ${CX} ${CY} Q ${mx} ${my} ${x} ${y}`}
            fill="none"
            stroke={LEVELS[imp.level].stroke}
            strokeWidth={on ? 3 : 1.75}
            strokeDasharray={imp.level === "safe" ? "5 6" : undefined}
            strokeLinecap="round"
            opacity={dimmed(imp.level) ? 0.15 : on ? 1 : 0.55}
            className="transition-opacity"
          />
        );
      })}

      <g filter="url(#shadow)">
        <rect x={CX - 112} y={CY - 38} width={224} height={76} rx={16} fill="#4f46e5" />
        <text x={CX} y={CY - 9} textAnchor="middle" fill="#c7d2fe" fontSize={10.5} fontWeight={700} letterSpacing={1.2}>
          {change.pr.number !== undefined ? `CHANGED IN #${change.pr.number}` : "YOUR CHANGE"}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" fill="#fff" fontSize={16} fontWeight={700} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
          {change.edits.length > 1
            ? `${change.edits.length} files`
            : fit(fileName(change.edits[0]?.path ?? ""), 20)}
        </text>
      </g>

      {nodes.map(({ imp, x, y }) => {
        const s = LEVELS[imp.level];
        const on = selected === imp.path;
        const kind = kinds.get(imp.path) ?? "code";
        const left = x - NODE_W / 2;
        const top = y - NODE_H / 2;
        return (
          <g
            key={imp.path}
            onClick={() => onSelect(imp.path)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(imp.path);
              }
            }}
            tabIndex={0}
            role="button"
            aria-pressed={on}
            aria-label={`${imp.path}: ${s.label}`}
            className="cursor-pointer outline-none transition-opacity focus-visible:[&>rect:first-of-type]:stroke-indigo-500"
            opacity={dimmed(imp.level) ? 0.35 : 1}
            filter="url(#shadow)"
          >
            <title>{imp.path}</title>
            <rect x={left} y={top} width={NODE_W} height={NODE_H} rx={12} fill={on ? s.tint : "#fff"} stroke={on ? s.stroke : "#e2e8f0"} strokeWidth={on ? 2.5 : 1} />
            <rect x={left} y={top} width={6} height={NODE_H} rx={3} fill={s.stroke} />
            <text x={left + 18} y={top + 25} fontSize={10.5} fontWeight={700} fill="#94a3b8" letterSpacing={0.8}>
              {KIND_TAG[kind]}
            </text>
            <text x={left + 18 + KIND_TAG[kind].length * 8.2 + 7} y={top + 25} fontSize={15} fontWeight={600} fill="#0f172a" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
              {fit(fileName(imp.path), 20 - KIND_TAG[kind].length)}
            </text>
            <circle cx={left + 22} cy={top + 44} r={4.5} fill={s.stroke} />
            <text x={left + 33} y={top + 48.5} fontSize={13.5} fontWeight={600} fill="#475569">
              {s.label}
            </text>
          </g>
        );
      })}
      {hidden > 0 && (
        <text x={W - 16} y={H - 14} textAnchor="end" fontSize={13} fontWeight={600} fill="#64748b">
          +{hidden} more in the list below
        </text>
      )}
    </svg>
  );
}
