"use client";

import type { CodeChange } from "@/fixtures/codeChangeDemo";
import { LEVELS, LEVEL_ORDER } from "@/lib/levels";

type Props = {
  change: CodeChange;
  selected: string | null;
  onSelect: (path: string) => void;
};

const W = 720;
const H = 440;
const CX = W / 2;
const CY = H / 2;
const NODE_W = 176;
const NODE_H = 46;

const fileName = (p: string) => p.split("/").pop() ?? p;

// The changed file sits in the middle; every affected file is placed around it.
export function ImpactMap({ change, selected, onSelect }: Props) {
  const impacts = [...change.impacts].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
  const n = impacts.length;
  const nodes = impacts.map((imp, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { imp, x: CX + Math.cos(angle) * 250, y: CY + Math.sin(angle) * 160 };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Map of files affected by the change">
      {nodes.map(({ imp, x, y }) => (
        <line
          key={`e-${imp.path}`}
          x1={CX}
          y1={CY}
          x2={x}
          y2={y}
          stroke={LEVELS[imp.level].stroke}
          strokeWidth={selected === imp.path ? 4 : 2}
          strokeDasharray={imp.level === "safe" ? "6 6" : undefined}
          opacity={selected && selected !== imp.path ? 0.35 : 0.9}
        />
      ))}

      <g>
        <rect x={CX - 100} y={CY - 32} width={200} height={64} rx={14} fill="#0f172a" />
        <text x={CX} y={CY - 6} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={600} letterSpacing={1}>
          YOU CHANGED
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" fill="#fff" fontSize={15} fontWeight={700} fontFamily="ui-monospace, monospace">
          {fileName(change.path)}
        </text>
      </g>

      {nodes.map(({ imp, x, y }) => {
        const s = LEVELS[imp.level];
        const on = selected === imp.path;
        return (
          <g
            key={imp.path}
            onClick={() => onSelect(imp.path)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(imp.path)}
            tabIndex={0}
            role="button"
            aria-label={`${imp.path}: ${s.label}`}
            className="cursor-pointer outline-none"
          >
            <rect
              x={x - NODE_W / 2}
              y={y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={10}
              fill={s.fill}
              stroke={s.stroke}
              strokeWidth={on ? 3.5 : 1.5}
            />
            <text x={x} y={y - 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="#0f172a" fontFamily="ui-monospace, monospace">
              {fileName(imp.path)}
            </text>
            <text x={x} y={y + 13} textAnchor="middle" fontSize={11} fontWeight={700} fill={s.stroke}>
              {s.label.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
