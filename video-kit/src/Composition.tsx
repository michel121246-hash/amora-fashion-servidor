import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/fonts";

const FONT = "Jakarta";
for (const w of ["400", "500", "600", "700", "800"]) {
  loadFont({
    family: FONT,
    url: staticFile(`fonts/plus-jakarta-sans-latin-${w}-normal.woff2`),
    weight: w,
  });
}

const NAVY = "#0B1626";
const NAVY2 = "#13294B";
const ORANGE = "#FF6A00";
const GREEN = "#34D399";
const WHITE = "#F5F7FA";
const MUTED = "rgba(245,247,250,0.62)";

const FPS = 30;
const S = {
  hook: [0, 105],
  pass: [105, 240],
  seats: [240, 365],
  pkg: [365, 495],
  money: [495, 610],
  end: [610, 750],
} as const;
const TOTAL = 750;

// ---------- audio
const sec = (s: number) => Math.round(s * FPS);
// [placeAt(s), voStart(s), voEnd(s)]
const VO: [number, number, number][] = [
  [0.4, 0.0, 1.98],
  [3.7, 2.0, 5.98],
  [8.2, 6.3, 9.72],
  [12.3, 9.8, 13.92],
  [16.6, 14.15, 17.32],
  [20.4, 17.6, 21.2],
];
type Fx = [string, number, number]; // file, frame, volume
const FX: Fx[] = [
  ["boom", 0, 0.55],
  ...[105, 240, 365, 495, 610].map((f): Fx => ["whoosh", f - 4, 0.45]),
  ...[40, 46, 52, 58].map((f): Fx => ["pop", f, 0.4]),
  ...[133, 147, 160, 173, 187, 203].map((f): Fx => ["tick", f, 0.35]),
  ...Array.from({ length: 12 }, (_, i): Fx => ["tick", 240 + 20 + i * 6, 0.22]),
  ["pop", 240 + 40, 0.4],
  ["pop", 240 + 48, 0.4],
  ["shutter", 365 + 16, 0.6],
  ["printer", 365 + 30, 0.35],
  ["ding", 365 + 79, 0.45],
  ["pop", 365 + 50, 0.4],
  ["pop", 365 + 60, 0.4],
  ...Array.from({ length: 10 }, (_, i): Fx => ["coin", 495 + 18 + i * 5, 0.22]),
  ["ding", 495 + 70, 0.3],
  ["chime", 610 + 26, 0.5],
];

const Sound: React.FC = () => (
  <>
    {VO.map(([at, a, b], i) => (
      <Sequence key={`vo${i}`} from={sec(at)} durationInFrames={sec(b - a)}>
        <Audio src={staticFile("vo.mp3")} trimBefore={sec(a)} trimAfter={sec(b)} volume={1} />
      </Sequence>
    ))}
    {FX.map(([n, f, v], i) => (
      <Sequence key={`fx${i}`} from={f} durationInFrames={75}>
        <Audio src={staticFile(`sfx/${n}.wav`)} volume={v} />
      </Sequence>
    ))}
  </>
);

// ---------- helpers
const useSpring = (delay = 0, config = { damping: 200 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
};

const Check: React.FC<{ size?: number; color?: string }> = ({ size = 28, color = GREEN }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" stroke={color} strokeWidth="1.6" opacity={0.9} />
    <path d="M7 12.5l3.2 3.2L17 9" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Arrow: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const glass: React.CSSProperties = {
  background: "linear-gradient(160deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035))",
  border: "1.5px solid rgba(255,255,255,0.16)",
  borderRadius: 40,
  backdropFilter: "blur(28px)",
  boxShadow: "0 40px 90px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
};

// Scene wrapper: fade/blur in & out
const Scene: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  const inn = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const out = interpolate(f, [dur - 12, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const o = Math.min(inn, out);
  return (
    <AbsoluteFill
      style={{
        opacity: o,
        filter: `blur(${(1 - o) * 14}px)`,
        transform: `scale(${0.96 + 0.04 * inn + (1 - out) * 0.04})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// Word-by-word blur reveal
export const Reveal: React.FC<{ text: string; delay?: number; style?: React.CSSProperties; stagger?: number }> = ({
  text,
  delay = 0,
  style,
  stagger = 4,
}) => {
  const f = useCurrentFrame();
  return (
    <span style={style}>
      {text.split(" ").map((w, i) => {
        const p = interpolate(f, [delay + i * stagger, delay + i * stagger + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: p,
              filter: `blur(${(1 - p) * 10}px)`,
              transform: `translateY(${(1 - p) * 24}px)`,
              marginRight: "0.26em",
            }}
          >
            {w}
          </span>
        );
      })}
    </span>
  );
};

const Chip: React.FC<{ label: string; delay: number; accent?: boolean }> = ({ label, delay, accent }) => {
  const p = useSpring(delay, { damping: 16, stiffness: 140 } as never);
  return (
    <div
      style={{
        ...glass,
        borderRadius: 999,
        padding: "18px 30px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontSize: 34,
        fontWeight: 600,
        color: WHITE,
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${(1 - p) * 40}px) scale(${0.85 + 0.15 * p})`,
        border: accent ? `1.5px solid ${ORANGE}` : glass.border,
      }}
    >
      <Check size={34} color={accent ? ORANGE : GREEN} />
      {label}
    </div>
  );
};

// ---------- background
export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const orb = (x: number, y: number, r: number, c: string, sp: number, ph: number) => (
    <div
      style={{
        position: "absolute",
        left: x + Math.sin(t * sp + ph) * 60,
        top: y + Math.cos(t * sp * 0.8 + ph) * 50,
        width: r,
        height: r,
        borderRadius: "50%",
        background: c,
        filter: "blur(120px)",
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 0%, ${NAVY2} 0%, ${NAVY} 60%, #070E19 100%)` }}>
      {orb(-200, 200, 700, "rgba(56,104,190,0.35)", 0.4, 0)}
      {orb(600, 1300, 620, "rgba(255,106,0,0.22)", 0.5, 2)}
      {orb(500, -150, 500, "rgba(120,160,255,0.18)", 0.3, 4)}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(255,255,255,0.045) 1.5px, transparent 1.5px)",
          backgroundSize: "90px 90px",
          backgroundPosition: `0 ${(f * 0.6) % 90}px`,
          maskImage: "radial-gradient(70% 55% at 50% 45%, black 20%, transparent 80%)",
        }}
      />
    </AbsoluteFill>
  );
};

// Brand lockup at top (like "bling | plano Elite")
const TopBrand: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [6, 22, S.end[0] - 10, S.end[0]], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        opacity: o,
        fontFamily: FONT,
      }}
    >
      <Img src={staticFile("logo-icon-dark.png")} style={{ height: 52 }} />
      <span style={{ color: WHITE, fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>Meu Bagageiro</span>
      <span style={{ width: 2, height: 36, background: "rgba(255,255,255,0.35)" }} />
      <span style={{ color: MUTED, fontSize: 34, fontWeight: 500 }}>sistema completo</span>
    </div>
  );
};

const Title: React.FC<{ a: string; b: string; top?: number; delay?: number }> = ({ a, b, top = 300, delay = 4 }) => (
  <div style={{ position: "absolute", top, width: "100%", textAlign: "center", fontFamily: FONT, padding: "0 80px" }}>
    <div style={{ fontSize: 70, fontWeight: 700, color: WHITE, letterSpacing: -2, lineHeight: 1.08 }}>
      <Reveal text={a} delay={delay} />
    </div>
    <div style={{ fontSize: 40, fontWeight: 500, color: MUTED, marginTop: 20 }}>
      <Reveal text={b} delay={delay + 10} stagger={2} />
    </div>
  </div>
);

// ---------- scenes
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const chips = [
    { l: "Passageiros", x: 120, y: 1240, d: 40 },
    { l: "Poltronas", x: 600, y: 1340, d: 46 },
    { l: "Bagagens", x: 170, y: 1460, d: 52 },
    { l: "Financeiro", x: 590, y: 1560, d: 58 },
  ];
  return (
    <Scene dur={S.hook[1] - S.hook[0]}>
      <div style={{ position: "absolute", top: 640, width: "100%", textAlign: "center", fontFamily: FONT }}>
        <div style={{ fontSize: 118, fontWeight: 700, color: WHITE, letterSpacing: -4, lineHeight: 1 }}>
          <Reveal text="Sua excursão" delay={8} stagger={6} />
        </div>
        <div style={{ fontSize: 138, fontWeight: 800, color: ORANGE, letterSpacing: -5, lineHeight: 1.1 }}>
          <Reveal text="evoluiu." delay={22} />
        </div>
        <div style={{ fontSize: 40, fontWeight: 500, color: MUTED, marginTop: 30 }}>
          <Reveal text="Seu jeito de administrar também." delay={34} stagger={3} />
        </div>
      </div>
      {chips.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: c.x,
            top: c.y + Math.sin((f + i * 20) / 18) * 10,
            fontFamily: FONT,
          }}
        >
          <Chip label={c.l} delay={c.d} />
        </div>
      ))}
    </Scene>
  );
};

const PASSENGERS = [
  ["07", "Ana Paula", "Pago"],
  ["08", "Roberto C.", "Pago"],
  ["11", "Juliana M.", "A pagar"],
  ["12", "Maria Silva", "Pago"],
  ["15", "Carlos E.", "Pago"],
  ["16", "Fernanda L.", "Pix"],
  ["19", "Patrícia R.", "Pago"],
  ["22", "José A.", "A pagar"],
  ["23", "Luciana T.", "Pago"],
  ["27", "Marcos V.", "Pago"],
];

const Passengers: React.FC = () => {
  const f = useCurrentFrame();
  const dur = S.pass[1] - S.pass[0];
  const pos = interpolate(f, [10, dur - 20], [0.5, 6.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const ROW = 150;
  return (
    <Scene dur={dur}>
      <Title a="Passageiros organizados" b="Chega de caderno e WhatsApp" />
      <div
        style={{
          position: "absolute",
          top: 1080,
          left: 0,
          width: "100%",
          perspective: 1400,
          fontFamily: FONT,
        }}
      >
        {PASSENGERS.map(([seat, name, st], i) => {
          const d = i - pos;
          const ad = Math.abs(d);
          const o = interpolate(ad, [0, 1, 2.6], [1, 0.55, 0], { extrapolateRight: "clamp" });
          const sc = interpolate(ad, [0, 2], [1.06, 0.8], { extrapolateRight: "clamp" });
          const center = ad < 0.5;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: d * ROW,
                width: 800,
                marginLeft: -400,
                marginTop: -55,
                height: 110,
                ...glass,
                borderRadius: 999,
                border: center ? `1.5px solid rgba(255,106,0,0.8)` : glass.border,
                display: "flex",
                alignItems: "center",
                gap: 26,
                padding: "0 38px",
                opacity: o,
                transform: `rotateX(${-d * 16}deg) scale(${sc})`,
              }}
            >
              <div
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 22,
                  background: center ? ORANGE : "rgba(255,255,255,0.1)",
                  color: "#fff",
                  fontSize: 32,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {seat}
              </div>
              <div style={{ flex: 1, fontSize: 40, fontWeight: 600, color: WHITE }}>{name}</div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: st === "A pagar" ? "#FBBF24" : GREEN,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {st !== "A pagar" && <Check size={30} />}
                {st}
              </div>
            </div>
          );
        })}
      </div>
    </Scene>
  );
};

const Seats: React.FC = () => {
  const f = useCurrentFrame();
  const dur = S.seats[1] - S.seats[0];
  const card = useSpring(6, { damping: 18 } as never);
  const rows = 11;
  const filled = Math.round(interpolate(f, [20, 90], [0, 32], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  // deterministic fill order
  const order = Array.from({ length: 44 }, (_, i) => i).sort((a, b) => ((a * 37) % 44) - ((b * 37) % 44));
  const isFilled = new Set(order.slice(0, filled));
  return (
    <Scene dur={dur}>
      <Title a="Mapa de poltronas" b="Cada passageiro no seu lugar" />
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 190,
          width: 700,
          ...glass,
          padding: "46px 56px",
          fontFamily: FONT,
          transform: `translateY(${(1 - card) * 120}px) rotateX(${(1 - card) * 20}deg)`,
          opacity: card,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 34 }}>
          <div style={{ color: WHITE, fontSize: 36, fontWeight: 700 }}>São Paulo → Brás</div>
          <div style={{ color: ORANGE, fontSize: 32, fontWeight: 800 }}>{filled}/44</div>
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ display: "flex", justifyContent: "center", gap: 18, marginBottom: 16 }}>
            {[0, 1, -1, 2, 3].map((c) =>
              c === -1 ? (
                <div key="aisle" style={{ width: 60 }} />
              ) : (
                <div
                  key={c}
                  style={{
                    width: 78,
                    height: 56,
                    borderRadius: 14,
                    background: isFilled.has(r * 4 + c) ? ORANGE : "rgba(255,255,255,0.08)",
                    border: "1.5px solid rgba(255,255,255,0.14)",
                    boxShadow: isFilled.has(r * 4 + c) ? "0 0 24px rgba(255,106,0,0.55)" : "none",
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {r * 4 + c + 1}
                </div>
              ),
            )}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: 1590, width: "100%", display: "flex", justifyContent: "center", gap: 22, fontFamily: FONT }}>
        <Chip label="Mapa visual" delay={40} />
        <Chip label="Sem poltrona dupla" delay={48} accent />
      </div>
    </Scene>
  );
};

export const QR: React.FC<{ size: number }> = ({ size }) => {
  const n = 21;
  const cells: React.ReactNode[] = [];
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let on: boolean;
      if (finder(x, y)) {
        const lx = x >= n - 7 ? x - (n - 7) : x;
        const ly = y >= n - 7 ? y - (n - 7) : y;
        on = lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
      } else on = ((x * 7 + y * 13 + x * y * 3) % 5) < 2;
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
    }
  return (
    <svg width={size} height={size} viewBox={`-1 -1 ${n + 2} ${n + 2}`} style={{ background: "#fff", borderRadius: 16 }}>
      <g fill="#0B1626">{cells}</g>
    </svg>
  );
};

const Package: React.FC = () => {
  const f = useCurrentFrame();
  const dur = S.pkg[1] - S.pkg[0];
  const card = useSpring(6, { damping: 18 } as never);
  const label = interpolate(f, [30, 62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const delivered = f > 78;
  const flash = interpolate(f, [16, 20, 30], [0, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Scene dur={dur}>
      <Title a="Bagagens com QR code" b="Foto, etiqueta e baixa na entrega" />
      <div
        style={{
          position: "absolute",
          top: 600,
          left: 140,
          width: 800,
          ...glass,
          padding: 48,
          fontFamily: FONT,
          opacity: card,
          transform: `translateY(${(1 - card) * 120}px)`,
        }}
      >
        <div style={{ display: "flex", gap: 36 }}>
          <div
            style={{
              width: 250,
              height: 250,
              borderRadius: 28,
              background: "linear-gradient(145deg,#C8925A,#9A6634)",
              position: "relative",
              overflow: "hidden",
              boxShadow: "inset 0 -20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ position: "absolute", left: 0, right: 0, top: 108, height: 34, background: "rgba(240,220,180,0.55)" }} />
            <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: MUTED, fontSize: 28, fontWeight: 600, letterSpacing: 2 }}>PACOTE</div>
            <div style={{ color: WHITE, fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>#0234</div>
            <div style={{ color: MUTED, fontSize: 32, fontWeight: 500, marginTop: 8 }}>Maria Silva · Poltrona 12</div>
            <div
              style={{
                marginTop: 26,
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 24px",
                borderRadius: 999,
                background: delivered ? "rgba(52,211,153,0.16)" : "rgba(251,191,36,0.16)",
                color: delivered ? GREEN : "#FBBF24",
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              {delivered && <Check size={32} />}
              {delivered ? "Entregue" : "Recebido"}
            </div>
          </div>
        </div>
      </div>
      {/* printed label */}
      <div
        style={{
          position: "absolute",
          top: 1000 + (1 - label) * -120,
          left: 300,
          width: 480,
          background: "#FBFBF8",
          borderRadius: 24,
          padding: 30,
          display: "flex",
          gap: 26,
          alignItems: "center",
          boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
          opacity: label,
          transform: `rotate(${(1 - label) * -6 - 2}deg)`,
          fontFamily: FONT,
        }}
      >
        <QR size={170} />
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#6B7280" }}>MEU BAGAGEIRO</div>
          <div style={{ fontSize: 50, fontWeight: 800, color: NAVY }}>#0234</div>
          <div style={{ fontSize: 26, fontWeight: 600, color: "#374151" }}>Maria S. · P12</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1420, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, fontFamily: FONT }}>
        <Chip label="Etiqueta Bluetooth" delay={50} />
        <Chip label="Aviso automático ao passageiro" delay={60} accent />
      </div>
    </Scene>
  );
};

const brl = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR");

const Money: React.FC = () => {
  const f = useCurrentFrame();
  const dur = S.money[1] - S.money[0];
  const card = useSpring(6, { damping: 18 } as never);
  const p = interpolate(f, [18, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const bars = [0.35, 0.5, 0.42, 0.66, 0.58, 0.82, 1];
  const rows: [string, number, string][] = [
    ["Passagens", 6380, WHITE],
    ["Bagagens", 1240, WHITE],
    ["Despesas", -2750, "#F87171"],
  ];
  return (
    <Scene dur={dur}>
      <Title a="Lucro de cada viagem" b="Sem fazer conta no papel" />
      <div
        style={{
          position: "absolute",
          top: 600,
          left: 140,
          width: 800,
          ...glass,
          padding: 52,
          fontFamily: FONT,
          opacity: card,
          transform: `translateY(${(1 - card) * 120}px)`,
        }}
      >
        <div style={{ color: MUTED, fontSize: 30, fontWeight: 600, letterSpacing: 2 }}>LUCRO DA VIAGEM</div>
        <div style={{ color: GREEN, fontSize: 104, fontWeight: 800, letterSpacing: -3, marginTop: 6 }}>{brl(4870 * p)}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 22, height: 220, marginTop: 30 }}>
          {bars.map((b, i) => {
            const bp = interpolate(f, [20 + i * 5, 50 + i * 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)) });
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${b * 100 * bp}%`,
                  borderRadius: 16,
                  background: i === bars.length - 1 ? `linear-gradient(180deg, ${ORANGE}, #C24E00)` : "rgba(255,255,255,0.16)",
                }}
              />
            );
          })}
        </div>
        <div style={{ height: 1.5, background: "rgba(255,255,255,0.12)", margin: "34px 0 20px" }} />
        {rows.map(([l, v, c], i) => {
          const o = interpolate(f, [40 + i * 8, 54 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 36, fontWeight: 600, color: MUTED, padding: "10px 0", opacity: o, transform: `translateX(${(1 - o) * 30}px)` }}>
              <span>{l}</span>
              <span style={{ color: c, fontWeight: 700 }}>{v < 0 ? "− " + brl(-v) : brl(v)}</span>
            </div>
          );
        })}
      </div>
    </Scene>
  );
};

const End: React.FC = () => {
  const f = useCurrentFrame();
  const dur = S.end[1] - S.end[0];
  const lg = useSpring(4, { damping: 14 } as never);
  const cta = useSpring(26, { damping: 14 } as never);
  const pulse = 1 + Math.sin(Math.max(0, f - 40) / 6) * 0.02;
  return (
    <Scene dur={dur + 20}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, flexDirection: "column" }}>
        <Img src={staticFile("logo-icon-dark.png")} style={{ width: 420, opacity: lg, transform: `scale(${0.7 + 0.3 * lg}) translateX(${(1 - lg) * -80}px)` }} />
        <div style={{ color: WHITE, fontSize: 92, fontWeight: 800, letterSpacing: -3, marginTop: 20, opacity: lg }}>Meu Bagageiro</div>
        <div style={{ color: MUTED, fontSize: 40, fontWeight: 500, marginTop: 10 }}>
          <Reveal text="Controle completo da sua excursão" delay={12} stagger={3} />
        </div>
        <div
          style={{
            marginTop: 70,
            background: ORANGE,
            borderRadius: 999,
            padding: "30px 56px",
            display: "flex",
            alignItems: "center",
            gap: 18,
            color: "#fff",
            fontSize: 44,
            fontWeight: 800,
            boxShadow: "0 20px 60px rgba(255,106,0,0.45)",
            opacity: cta,
            transform: `translateY(${(1 - cta) * 50}px) scale(${pulse})`,
          }}
        >
          Teste grátis por 7 dias <Arrow size={44} />
        </div>
        <div style={{ color: MUTED, fontSize: 30, fontWeight: 500, marginTop: 30, opacity: cta }}>Sem cartão de crédito · Cancele quando quiser</div>
      </AbsoluteFill>
    </Scene>
  );
};

export const MeuBagageiro: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <Background />
    <Sequence from={S.hook[0]} durationInFrames={S.hook[1] - S.hook[0]}><Hook /></Sequence>
    <Sequence from={S.pass[0]} durationInFrames={S.pass[1] - S.pass[0]}><Passengers /></Sequence>
    <Sequence from={S.seats[0]} durationInFrames={S.seats[1] - S.seats[0]}><Seats /></Sequence>
    <Sequence from={S.pkg[0]} durationInFrames={S.pkg[1] - S.pkg[0]}><Package /></Sequence>
    <Sequence from={S.money[0]} durationInFrames={S.money[1] - S.money[0]}><Money /></Sequence>
    <Sequence from={S.end[0]} durationInFrames={S.end[1] - S.end[0]}><End /></Sequence>
    <TopBrand />
    <Sound />
  </AbsoluteFill>
);

export const MyComposition = () => (
  <Composition id="MeuBagageiro" component={MeuBagageiro} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
