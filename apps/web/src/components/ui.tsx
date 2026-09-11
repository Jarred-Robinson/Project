import type { ReactNode } from "react";
import { BADGES, PALETTE as C, ZONE_COLORS } from "@rotation/shared";

export { C };

export function zoneColor(category: string) {
  return ZONE_COLORS[category] || C.line;
}

export const iCls = "w-full rounded px-2 py-1.5 text-sm";
export const iSty = { border: `1px solid ${C.line}`, background: "#FAFBFA", color: C.ink };

export function Badge({ type }: { type: string }) {
  const s = BADGES[type] || BADGES.none;
  return (
    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: s.bg, color: s.fg, letterSpacing: "0.05em" }}>
      {s.label}
    </span>
  );
}

export function Panel({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="rounded-xl border" style={{ background: C.panel, borderColor: C.line }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b flex-wrap gap-2" style={{ borderColor: C.line }}>
        <div className="text-xs font-mono tracking-widest" style={{ color: C.sub }}>
          {title}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-mono mb-1" style={{ color: C.sub }}>
        {label}
      </div>
      {children}
    </label>
  );
}

export function Btn({
  onClick,
  children,
  tone = "teal",
  disabled,
  wide,
  type = "button",
}: {
  onClick?: () => void;
  children: ReactNode;
  tone?: "teal" | "ghost" | "red" | "amber" | "slate";
  disabled?: boolean;
  wide?: boolean;
  type?: "button" | "submit";
}) {
  const t =
    {
      teal: { bg: C.teal, fg: "#F4F7F6" },
      ghost: { bg: C.tealSoft, fg: C.teal },
      red: { bg: C.redSoft, fg: C.red },
      amber: { bg: C.amberSoft, fg: C.amber },
      slate: { bg: C.slate, fg: C.sub },
    }[tone] || { bg: C.teal, fg: "#fff" };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`text-xs font-mono px-3 py-1.5 rounded${wide ? " w-full" : ""}`}
      style={{ background: t.bg, color: t.fg, opacity: disabled ? 0.45 : 1, letterSpacing: "0.06em" }}
    >
      {children}
    </button>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        className={iCls}
        style={{ ...iSty, paddingLeft: "1.9rem" }}
        value={value}
        placeholder={placeholder || "Search…"}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: C.sub }}>
        ⌕
      </span>
      {value && (
        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: C.sub }} onClick={() => onChange("")}>
          ✕
        </button>
      )}
    </div>
  );
}

export function Toggle({
  on,
  onClick,
  onLabel,
  offLabel,
  tone = "amber",
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  onLabel?: string;
  offLabel?: string;
  tone?: "amber" | "teal" | "red";
  disabled?: boolean;
}) {
  const t = { amber: { bg: C.amberSoft, fg: C.amber }, teal: { bg: C.tealSoft, fg: C.teal }, red: { bg: C.redSoft, fg: C.red } }[tone];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-xs font-mono px-2 py-1 rounded border"
      style={{
        background: on ? t.bg : C.slate,
        color: on ? t.fg : C.sub,
        borderColor: on ? t.fg : C.line,
        opacity: disabled ? 0.5 : 1,
        letterSpacing: "0.05em",
      }}
    >
      {on ? onLabel || "ON" : offLabel || onLabel || "OFF"}
    </button>
  );
}

export function Chip({ children, bg, fg }: { children: ReactNode; bg?: string; fg?: string }) {
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: bg || C.slate, color: fg || C.sub, letterSpacing: "0.05em" }}>
      {children}
    </span>
  );
}

export function ZoneLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono mt-2 pt-2 border-t" style={{ color: C.sub, borderColor: C.line }}>
      {Object.entries(ZONE_COLORS).map(([cat, col]) => (
        <span key={cat} className="flex items-center gap-1">
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9999, background: col }} />
          {cat}
        </span>
      ))}
    </div>
  );
}

export function match(txt: unknown, q: string) {
  return !q || String(txt || "").toLowerCase().includes(q.toLowerCase());
}
