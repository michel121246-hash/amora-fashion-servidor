// Biblioteca de efeitos para Reels (talking-head), inspirada nos comandos /effects:
// glass-widgets, orbits, spotlight, todo, timeline, match-cut, apple-toggles.
// Cada efeito e um componente; coloque dentro de <Sequence from=... durationInFrames=...>.
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";

export const FONT = "Jakarta";
export const C = { white: "#F5F7FA", muted: "rgba(245,247,250,0.66)", green: "#34C759", accent: "#FF6A00" };

export const glass: React.CSSProperties = {
  background: "linear-gradient(160deg, rgba(40,36,48,0.55), rgba(20,18,26,0.38))",
  border: "1.5px solid rgba(255,255,255,0.35)",
  borderRadius: 34,
  backdropFilter: "blur(26px) saturate(1.4)",
  boxShadow: "0 30px 70px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.45)",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// entrada/saida padrao de um efeito (frames locais)
export const useLife = (dur: number, inF = 12, outF = 10) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 15, stiffness: 140 } });
  const out = interpolate(f, [dur - outF, dur], [1, 0], clamp);
  return { s, o: Math.min(interpolate(f, [0, inF * 0.6], [0, 1], clamp), out), out, f };
};

export const CheckIcon: React.FC<{ size?: number; on?: number }> = ({ size = 34, on = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill={on > 0.5 ? C.green : "rgba(255,255,255,0.15)"} stroke="rgba(255,255,255,0.6)" strokeWidth={on > 0.5 ? 0 : 1.5} />
    <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray={20} strokeDashoffset={20 * (1 - on)} />
  </svg>
);

// 1) GLASS WIDGETS — cards de vidro flutuando ao redor da pessoa
export type Widget =
  | { kind: "stat"; value: number; prefix?: string; suffix?: string; label: string; x: number; y: number; delay: number }
  | { kind: "bars"; label: string; value: string; x: number; y: number; delay: number }
  | { kind: "ring"; pct: number; label: string; x: number; y: number; delay: number };

export const GlassWidgets: React.FC<{ dur: number; items: Widget[] }> = ({ dur, items }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(f, [dur - 10, dur], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {items.map((w, i) => {
        const s = spring({ frame: f - w.delay, fps, config: { damping: 13, stiffness: 120 } });
        const float = Math.sin((f + i * 23) / 20) * 10;
        const prog = interpolate(f - w.delay, [0, 28], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        return (
          <div key={i} style={{ position: "absolute", left: w.x, top: w.y + float, ...glass, padding: "24px 30px", minWidth: 230,
            opacity: Math.min(s * 1.3, 1) * out, transform: `scale(${0.6 + 0.4 * s}) rotate(${(1 - s) * (i % 2 ? 8 : -8)}deg)` }}>
            {w.kind === "stat" && (<>
              <div style={{ color: C.white, fontSize: 72, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
                {w.prefix}{Math.round(w.value * prog).toLocaleString("pt-BR")}{w.suffix}</div>
              <div style={{ color: C.muted, fontSize: 26, fontWeight: 600, marginTop: 6 }}>{w.label}</div></>)}
            {w.kind === "bars" && (<>
              <div style={{ color: C.muted, fontSize: 24, fontWeight: 600 }}>{w.label}</div>
              <div style={{ color: C.white, fontSize: 52, fontWeight: 800 }}>{w.value}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 70, marginTop: 8 }}>
                {[0.3, 0.5, 0.4, 0.7, 0.6, 0.9, 1].map((b, k) => (
                  <div key={k} style={{ width: 22, borderRadius: 6, height: `${b * 100 * interpolate(f - w.delay - k * 2, [0, 20], [0, 1], clamp)}%`,
                    background: k === 6 ? C.accent : "rgba(255,255,255,0.55)" }} />))}
              </div></>)}
            {w.kind === "ring" && (
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <svg width={96} height={96} viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.25)" strokeWidth="4" fill="none" />
                  <circle cx="20" cy="20" r="16" stroke={C.green} strokeWidth="4" fill="none" strokeLinecap="round"
                    strokeDasharray={100.5} strokeDashoffset={100.5 * (1 - w.pct * prog)} transform="rotate(-90 20 20)" />
                </svg>
                <div style={{ color: C.white, fontSize: 34, fontWeight: 800 }}>{w.label}</div>
              </div>)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// 2) ORBITS — miniaturas girando em volta da cabeca (profundidade por escala/opacidade)
export const Orbit: React.FC<{ dur: number; images: string[]; cx?: number; cy?: number; rx?: number; ry?: number; lap?: number }> = ({
  dur, images, cx = 540, cy = 560, rx = 420, ry = 120, lap = 150,
}) => {
  const f = useCurrentFrame();
  const inO = interpolate(f, [0, 15], [0, 1], clamp);
  const out = interpolate(f, [dur - 12, dur], [1, 0], clamp);
  const grow = interpolate(f, [0, 20], [0.3, 1], { ...clamp, easing: Easing.out(Easing.back(1.5)) });
  return (
    <AbsoluteFill>
      {images.map((src, i) => {
        const a = (f / lap) * Math.PI * 2 + (i / images.length) * Math.PI * 2;
        const z = Math.sin(a); // -1 atras, +1 frente
        const sc = 0.72 + 0.28 * (z + 1) / 2;
        return (
          <div key={i} style={{ position: "absolute", left: cx + Math.cos(a) * rx * grow - 85, top: cy + z * ry * grow - 115,
            width: 170, height: 230, borderRadius: 22, overflow: "hidden", border: "4px solid #fff",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)", transform: `scale(${sc}) rotate(${Math.cos(a) * 8}deg)`,
            opacity: inO * out * (0.55 + 0.45 * (z + 1) / 2), zIndex: Math.round(z * 10) + 10 }}>
            <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// 3) SPOTLIGHT — escurece o fundo e deixa a pessoa iluminada (sem recorte: elipse suave)
export const Spotlight: React.FC<{ dur: number; x?: number; y?: number; w?: number; h?: number; dark?: number }> = ({
  dur, x = 540, y = 820, w = 520, h = 900, dark = 0.78,
}) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [0, 12], [0, 1], clamp), interpolate(f, [dur - 12, dur], [1, 0], clamp));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(${w}px ${h}px at ${x}px ${y}px, rgba(0,0,0,0) 45%, rgba(0,0,0,${dark}) 100%)`, opacity: o }}>
      <AbsoluteFill style={{ background: `radial-gradient(${w * 0.7}px ${h * 0.5}px at ${x}px ${y - 200}px, rgba(255,240,220,0.10), transparent 70%)` }} />
    </AbsoluteFill>
  );
};

// 4) TODO — checklist que vai sendo marcado enquanto a pessoa fala
export const Checklist: React.FC<{ dur: number; title: string; items: { label: string; at: number }[]; x?: number; y?: number }> = ({
  dur, title, items, x = 90, y = 1120,
}) => {
  const { s, o, f } = useLife(dur);
  const done = items.filter((it) => f >= it.at).length;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 620, ...glass, padding: "28px 32px", fontFamily: FONT, opacity: o,
      transform: `translateY(${(1 - s) * 60}px) scale(${0.9 + 0.1 * s})` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: done === items.length ? C.green : C.accent,
          boxShadow: `0 0 16px ${done === items.length ? C.green : C.accent}` }} />
        <div style={{ color: C.white, fontSize: 32, fontWeight: 700 }}>{title}</div>
        <div style={{ marginLeft: "auto", color: C.muted, fontSize: 26, fontWeight: 700 }}>{done}/{items.length}</div>
      </div>
      {items.map((it, i) => {
        const on = interpolate(f, [it.at, it.at + 8], [0, 1], clamp);
        const show = interpolate(f, [4 + i * 3, 12 + i * 3], [0, 1], clamp);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0", opacity: show }}>
            <CheckIcon size={38} on={on} />
            <span style={{ color: on > 0.5 ? C.white : C.muted, fontSize: 34, fontWeight: 600,
              textDecoration: "none", transform: `scale(${1 + 0.06 * Math.sin(on * Math.PI)})` }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// 5) TIMELINE — linha do tempo de edicao com agulha brilhando
export const Timeline: React.FC<{ dur: number; title?: string; y?: number }> = ({ dur, title = "Editando…", y = 1180 }) => {
  const { s, o, f } = useLife(dur);
  const p = interpolate(f, [8, dur - 12], [0.05, 0.95], clamp);
  const tracks = [
    { c: "#A78BFA", segs: [[0, 0.22], [0.25, 0.55], [0.58, 1]] },
    { c: "#60A5FA", segs: [[0.05, 0.4], [0.45, 0.8]] },
    { c: "#F472B6", segs: [[0, 1]] },
  ];
  return (
    <div style={{ position: "absolute", left: 70, top: y, width: 940, ...glass, background: "linear-gradient(160deg, rgba(20,16,40,0.78), rgba(20,16,40,0.6))",
      padding: "26px 30px", fontFamily: FONT, opacity: o, transform: `translateY(${(1 - s) * 70}px)` }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: C.white, fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
        <span>{title}</span><span style={{ color: "#C4B5FD" }}>{Math.round(p * 100)}%</span>
      </div>
      <div style={{ position: "relative" }}>
        {tracks.map((t, i) => (
          <div key={i} style={{ position: "relative", height: 44, marginBottom: 10 }}>
            {t.segs.map(([a, b], k) => (
              <div key={k} style={{ position: "absolute", left: `${a * 100}%`, width: `${(b - a) * 100 - 0.8}%`, top: 0, bottom: 0, borderRadius: 10,
                background: i === 2 ? "transparent" : t.c + "CC", border: `1.5px solid ${t.c}`, overflow: "hidden" }}>
                {i === 2 && (
                  <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 200 20">
                    <path d={Array.from({ length: 100 }, (_, j) => `M${j * 2} ${10 - 8 * Math.abs(Math.sin(j * 1.7) * Math.cos(j * 0.31))} L${j * 2} ${10 + 8 * Math.abs(Math.sin(j * 1.7) * Math.cos(j * 0.31))}`).join(" ")}
                      stroke={t.c} strokeWidth="1" />
                  </svg>)}
              </div>))}
          </div>
        ))}
        <div style={{ position: "absolute", left: `${p * 100}%`, top: -14, bottom: -4, width: 4, marginLeft: -2, background: "#fff",
          boxShadow: "0 0 14px #fff, 0 0 30px #C4B5FD", borderRadius: 2 }}>
          <div style={{ position: "absolute", top: -10, left: -9, width: 22, height: 22, borderRadius: 6, background: "#fff", transform: "rotate(45deg)" }} />
        </div>
      </div>
    </div>
  );
};

// 6) MATCH-CUT — cortes rapidos entre "paginas" fixando a mesma palavra no mesmo lugar
export const MatchCut: React.FC<{ dur: number; word: string; pages: { site: string; before: string; after: string; bg?: string }[]; every?: number }> = ({
  dur, word, pages, every = 7,
}) => {
  const f = useCurrentFrame();
  const i = Math.min(pages.length - 1, Math.floor(f / every));
  const pg = pages[i];
  const zoom = 1 + f * 0.0025;
  const o = interpolate(f, [dur - 6, dur], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: pg.bg ?? "#FBFAF7", fontFamily: FONT, opacity: o }}>
      <div style={{ position: "absolute", top: 120, left: 80, right: 80, display: "flex", justifyContent: "space-between", color: "#111", fontSize: 30, fontWeight: 800 }}>
        <span>{pg.site}</span><span style={{ color: "#999", fontWeight: 600 }}>{"Moda · " + (i + 1) + " min"}</span>
      </div>
      {[0, 1, 2, 3].map((k) => (
        <div key={k} style={{ position: "absolute", left: 80, right: 80 + (k % 2) * 160, top: 1240 + k * 60, height: 22, borderRadius: 11, background: "rgba(0,0,0,0.08)" }} />))}
      {[0, 1].map((k) => (
        <div key={k} style={{ position: "absolute", left: 80, right: 80 + k * 220, top: 660 + k * 60, height: 22, borderRadius: 11, background: "rgba(0,0,0,0.08)" }} />))}
      <div style={{ position: "absolute", top: 860, width: "100%", textAlign: "center", transform: `scale(${zoom})` }}>
        <div style={{ color: "#555", fontSize: 44, fontWeight: 600 }}>{pg.before}</div>
        <span style={{ display: "inline-block", margin: "18px 0", padding: "6px 22px", background: "#FFE14D", color: "#111", fontSize: 120, fontWeight: 800, letterSpacing: -3, borderRadius: 10 }}>{word}</span>
        <div style={{ color: "#555", fontSize: 44, fontWeight: 600 }}>{pg.after}</div>
      </div>
    </AbsoluteFill>
  );
};

// 7) APPLE TOGGLES — botoes do iPhone acendendo embaixo do rosto
export const AppleToggles: React.FC<{ dur: number; items: { label: string; at: number; color?: string }[]; y?: number }> = ({ dur, items, y = 1180 }) => {
  const { s, o, f } = useLife(dur);
  return (
    <div style={{ position: "absolute", left: 150, top: y, width: 780, ...glass, background: "rgba(28,28,30,0.72)", borderRadius: 30, padding: "8px 0",
      fontFamily: FONT, opacity: o, transform: `translateY(${(1 - s) * 60}px) scale(${0.92 + 0.08 * s})` }}>
      {items.map((it, i) => {
        const on = interpolate(f, [it.at, it.at + 7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "22px 34px", borderTop: i ? "1px solid rgba(255,255,255,0.12)" : "none" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: it.color ?? C.accent, marginRight: 22 }} />
            <span style={{ color: "#fff", fontSize: 36, fontWeight: 600, flex: 1 }}>{it.label}</span>
            <div style={{ width: 102, height: 62, borderRadius: 31, background: on > 0.5 ? C.green : "rgba(120,120,128,0.36)", position: "relative",
              transition: "none" }}>
              <div style={{ position: "absolute", top: 4, left: 4 + on * 40, width: 54, height: 54, borderRadius: 27, background: "#fff",
                boxShadow: "0 3px 8px rgba(0,0,0,0.3)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
