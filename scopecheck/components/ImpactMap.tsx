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

// Drawing size in SVG units; the SVG scales to fit its container.
const W = 760;
const H = 500;
// Center point, where the changed file sits.
const CX = W / 2;
const CY = H / 2;
// Size of each affected-file card.
const NODE_W = 212;
const NODE_H = 60;
// More than this many cards would overlap; the rest are only in the list below the map.
const MAX_NODES = 8;
// Palette, matching app/globals.css (SVG attributes can't use Tailwind classes).
const INK = "#1d1b17";
const LINE = "#e4e0d6";
const MUTED = "#6b665c";
const MONO = { fontFamily: "var(--font-mono)" };
const SANS = { fontFamily: "var(--font-sans)" };

const fileName = (p: string) => p.split("/").pop() ?? p;

// Shortens long names in the middle so the extension stays visible.
const fit = (name: string, max: number) =>
  name.length <= max ? name : `${name.slice(0, max - 7)}…${name.slice(-6)}`;

// The changed file sits in the middle; the most severe affected files are placed
// around it, starting at the top and going clockwise. The full list sits below.
export function ImpactMap({ change, kinds, selected, focusLevel, onSelect }: Props) {
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
            stroke={on ? LEVELS[imp.level].stroke : "#cfc9bc"}
            strokeWidth={on ? 2 : 1.25}
            strokeDasharray={imp.level === "safe" ? "3 5" : undefined}
            opacity={dimmed(imp.level) ? 0.25 : 1}
          />
        );
      })}

      <g>
        <rect x={CX - 108} y={CY - 34} width={216} height={68} rx={6} fill={INK} />
        <text x={CX} y={CY - 8} textAnchor="middle" fill="#a39e93" fontSize={12} style={SANS}>
          {change.pr.number !== undefined ? `changed in #${change.pr.number}` : "your change"}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" fill="#f6f4ef" fontSize={16} fontWeight={500} style={MONO}>
          {change.edits.length > 1 ? `${change.edits.length} files` : fit(fileName(change.edits[0]?.path ?? ""), 20)}
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
            className="cursor-pointer outline-none focus-visible:[&>rect:first-of-type]:stroke-[#23395d]"
            opacity={dimmed(imp.level) ? 0.35 : 1}
          >
            <title>{imp.path}</title>
            <rect x={left} y={top} width={NODE_W} height={NODE_H} rx={6} fill={on ? "#f5ecd2" : "#fdfcf9"} stroke={on ? INK : LINE} strokeWidth={on ? 1.5 : 1} />
            <rect x={left} y={top + 10} width={3} height={NODE_H - 20} fill={s.stroke} />
            <text x={left + 16} y={top + 25} fontSize={14.5} fontWeight={500} fill={INK} style={MONO}>
              {fit(fileName(imp.path), 20)}
            </text>
            <text x={left + 16} y={top + 45} fontSize={12.5} style={SANS}>
              <tspan fill={s.stroke} fontWeight={600}>
                {s.label}
              </tspan>
              <tspan fill={MUTED}> · {kind}</tspan>
            </text>
          </g>
        );
      })}
      {hidden > 0 && (
        <text x={W - 16} y={H - 14} textAnchor="end" fontSize={13} fill={MUTED} style={SANS}>
          +{hidden} more in the list below
        </text>
      )}
    </svg>
  );
}
