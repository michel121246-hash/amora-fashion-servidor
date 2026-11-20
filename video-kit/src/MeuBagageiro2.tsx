// Meu Bagageiro — video 2: os 7 efeitos (match-cut, spotlight, orbit, todo, toggles, glass widgets, timeline)
// Narracao reaproveitada (vo.mp3, ja paga) + SFX locais. Custo zero.
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Background, QR, Reveal } from "./Composition";
import { AppleToggles, Checklist, GlassWidgets, MatchCut, Orbit, Spotlight, Timeline, glass, FONT } from "./Effects";

const FPS = 30;
const s = (t: number) => Math.round(t * FPS);
const ORANGE = "#FF6A00";
const WHITE = "#F5F7FA";
const MUTED = "rgba(245,247,250,0.66)";

// cenas [inicio, fim] em segundos
const SC = {
  match: [0, 2.6],
  hero: [2.6, 5.2],
  pass: [5.2, 10.0],
  seats: [10.0, 14.2],
  bags: [14.2, 19.0],
  money: [19.0, 23.0],
  end: [23.0, 27.5],
} as const;
type K = keyof typeof SC;
export const MB2_DUR = s(27.5);
const at = (k: K) => ({ from: s(SC[k][0]), durationInFrames: s(SC[k][1] - SC[k][0]) });
const D = (k: K) => s(SC[k][1] - SC[k][0]);

// narracao paga, reaproveitada: [colocar em, trecho inicio, trecho fim]
const VO: [number, number, number][] = [
  [2.9, 0.0, 1.98],
  [5.5, 2.0, 5.98],
  [10.3, 6.3, 9.72],
  [14.5, 9.8, 13.92],
  [19.3, 14.15, 17.32],
  [23.3, 17.6, 21.2],
];

const Fade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" }), interpolate(f, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return <AbsoluteFill style={{ opacity: o, filter: `blur(${(1 - o) * 10}px)` }}>{children}</AbsoluteFill>;
};

const Title: React.FC<{ a: string; b?: string; top?: number }> = ({ a, b, top = 250 }) => (
  <div style={{ position: "absolute", top, width: "100%", textAlign: "center", fontFamily: FONT, padding: "0 70px" }}>
    <div style={{ fontSize: 76, fontWeight: 800, color: WHITE, letterSpacing: -2.5, lineHeight: 1.05 }}><Reveal text={a} delay={3} /></div>
    {b && <div style={{ fontSize: 38, fontWeight: 500, color: MUTED, marginTop: 16 }}><Reveal text={b} delay={12} stagger={2} /></div>}
  </div>
);

const Brand: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [s(2.7), s(3.1), s(22.8), s(23.0)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 110, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 18, opacity: o, fontFamily: FONT }}>
      <Img src={staticFile("logo-icon-dark.png")} style={{ height: 48 }} />
      <span style={{ color: WHITE, fontSize: 34, fontWeight: 700 }}>Meu Bagageiro</span>
      <span style={{ width: 2, height: 34, background: "rgba(255,255,255,0.35)" }} />
      <span style={{ color: MUTED, fontSize: 32, fontWeight: 500 }}>excursões de compras</span>
    </div>
  );
};

// ---- cenas
const Hero: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lg = spring({ frame: f - 2, fps, config: { damping: 12 } });
  return (
    <Fade dur={D("hero")}>
      <Spotlight dur={D("hero") + 30} x={540} y={900} w={620} h={760} dark={0.7} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, flexDirection: "column" }}>
        <Img src={staticFile("logo-icon-dark.png")} style={{ width: 460, transform: `scale(${0.5 + 0.5 * lg}) translateX(${(1 - lg) * -200}px)`, opacity: lg }} />
        <div style={{ fontSize: 112, fontWeight: 700, color: WHITE, letterSpacing: -4, marginTop: 40 }}><Reveal text="Sua excursão" delay={8} stagger={6} /></div>
        <div style={{ fontSize: 140, fontWeight: 800, color: ORANGE, letterSpacing: -5, lineHeight: 1.05 }}><Reveal text="evoluiu." delay={20} /></div>
      </AbsoluteFill>
    </Fade>
  );
};

const PEOPLE = [
  ["AP", "Ana Paula", "07", "#F472B6"], ["MS", "Maria Silva", "12", "#60A5FA"], ["CE", "Carlos E.", "15", "#34D399"],
  ["JM", "Juliana M.", "11", "#FBBF24"], ["RC", "Roberto C.", "08", "#A78BFA"], ["FL", "Fernanda L.", "16", "#FB923C"],
];
const Avatar: React.FC<{ i: string; seat: string; c: string }> = ({ i, seat, c }) => (
  <div style={{ width: "100%", height: "100%", background: `linear-gradient(160deg, ${c}, #13294B)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
    <div style={{ width: 96, height: 96, borderRadius: 48, background: "rgba(255,255,255,0.92)", color: "#0B1626", fontSize: 40, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i}</div>
    <div style={{ marginTop: 14, color: "#fff", fontSize: 26, fontWeight: 800 }}>P{seat}</div>
  </div>
);

const Passengers: React.FC = () => (
  <Fade dur={D("pass")}>
    <Title a="Passageiros organizados" b="sem caderno e sem WhatsApp" />
    <Orbit dur={D("pass") + 20} cx={540} cy={760} rx={400} ry={110} lap={170}
      nodes={PEOPLE.map(([i, , seat, c]) => <Avatar key={i} i={i} seat={seat} c={c} />)} />
    <Checklist dur={D("pass") + 20} title="Embarque · São Paulo → Brás" x={150} y={1130} items={[
      { label: "Ana Paula · poltrona 07", at: s(1.0) },
      { label: "Maria Silva · poltrona 12", at: s(1.8) },
      { label: "Carlos E. · poltrona 15", at: s(2.6) },
      { label: "Juliana M. · poltrona 11", at: s(3.4) },
    ]} />
  </Fade>
);

const Seats: React.FC = () => (
  <Fade dur={D("seats")}>
    <Title a="Mapa de poltronas" b="cada um no seu lugar" />
    <AppleToggles dur={D("seats") + 20} y={560} items={[
      { label: "Poltrona 07 · Ana", at: s(0.5), color: "#F472B6" },
      { label: "Poltrona 12 · Maria", at: s(1.2), color: "#60A5FA" },
      { label: "Poltrona 15 · Carlos", at: s(1.9), color: "#34D399" },
      { label: "Poltrona 16 · Fernanda", at: s(2.6), color: "#FB923C" },
    ]} />
    <GlassWidgets dur={D("seats") + 20} items={[
      { kind: "stat", value: 32, suffix: "/44", label: "poltronas ocupadas", x: 150, y: 1260, delay: 18 },
      { kind: "ring", pct: 0.73, label: "73% lotado", x: 600, y: 1290, delay: 26 },
    ]} />
  </Fade>
);

const Bags: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = spring({ frame: f - 4, fps, config: { damping: 14 } });
  const flash = interpolate(f, [s(0.5), s(0.6), s(0.9)], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Fade dur={D("bags")}>
      <Spotlight dur={D("bags") + 30} x={540} y={760} w={560} h={600} dark={0.65} />
      <Title a="Bagagem com QR code" b="foto, etiqueta e aviso na hora" />
      <div style={{ position: "absolute", left: 190, top: 560, width: 700, ...glass, padding: 34, display: "flex", gap: 30, alignItems: "center", fontFamily: FONT,
        transform: `translateY(${(1 - c) * 100}px) scale(${0.9 + 0.1 * c})`, opacity: c }}>
        <div style={{ width: 200, height: 200, borderRadius: 24, background: "linear-gradient(145deg,#C8925A,#9A6634)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 86, height: 28, background: "rgba(240,220,180,0.55)" }} />
          <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
        </div>
        <div style={{ background: "#FBFBF8", borderRadius: 18, padding: 16, display: "flex", gap: 16, alignItems: "center",
          transform: `translateY(${interpolate(f, [s(1.0), s(1.8)], [-40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px)`,
          opacity: interpolate(f, [s(1.0), s(1.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <QR size={140} />
          <div><div style={{ fontSize: 20, fontWeight: 700, color: "#6B7280" }}>PACOTE</div><div style={{ fontSize: 44, fontWeight: 800, color: "#0B1626" }}>#0234</div><div style={{ fontSize: 22, fontWeight: 600, color: "#374151" }}>Maria · P12</div></div>
        </div>
      </div>
      <Checklist dur={D("bags") + 20} title="Pacote #0234" x={150} y={1060} items={[
        { label: "Foto do pacote", at: s(0.6) },
        { label: "QR code gerado", at: s(1.4) },
        { label: "Etiqueta impressa", at: s(2.2) },
        { label: "Passageiro avisado", at: s(3.0) },
      ]} />
    </Fade>
  );
};

const Money: React.FC = () => (
  <Fade dur={D("money")}>
    <Title a="Lucro de cada viagem" b="sem fazer conta no papel" />
    <GlassWidgets dur={D("money") + 20} items={[
      { kind: "stat", value: 4870, prefix: "R$ ", label: "lucro da viagem", x: 120, y: 540, delay: 4 },
      { kind: "bars", label: "passagens", value: "R$ 6.380", x: 600, y: 600, delay: 12 },
      { kind: "ring", pct: 1, label: "Tudo pago", x: 170, y: 830, delay: 20 },
    ]} />
    <Timeline dur={D("money") + 20} title="Viagem São Paulo → Brás" y={1120} />
  </Fade>
);

const End: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lg = spring({ frame: f - 2, fps, config: { damping: 13 } });
  const cta = spring({ frame: f - s(2.3), fps, config: { damping: 13 } });
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <AbsoluteFill style={{ alignItems: "center", fontFamily: FONT, flexDirection: "column", paddingTop: 230 }}>
        <Img src={staticFile("logo-icon-dark.png")} style={{ width: 380, opacity: lg, transform: `scale(${0.6 + 0.4 * lg})` }} />
        <div style={{ color: WHITE, fontSize: 88, fontWeight: 800, letterSpacing: -3, marginTop: 12, opacity: lg }}>Meu Bagageiro</div>
        <div style={{ color: MUTED, fontSize: 38, fontWeight: 500, marginTop: 6 }}><Reveal text="Controle completo da sua excursão" delay={8} stagger={3} /></div>
      </AbsoluteFill>
      <AppleToggles dur={D("end") + 60} y={930} items={[
        { label: "Teste grátis 7 dias", at: s(0.8), color: ORANGE },
        { label: "Sem cartão de crédito", at: s(1.3), color: "#60A5FA" },
        { label: "Cancele quando quiser", at: s(1.8), color: "#34D399" },
      ]} />
      <div style={{ position: "absolute", top: 1420, width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ background: ORANGE, borderRadius: 999, padding: "30px 60px", color: "#fff", fontSize: 46, fontWeight: 800,
          boxShadow: "0 20px 60px rgba(255,106,0,0.5)", opacity: cta, transform: `translateY(${(1 - cta) * 50}px) scale(${1 + Math.sin(Math.max(0, f - s(2.6)) / 6) * 0.02})` }}>
          Comece seu teste grátis →
        </div>
      </div>
    </AbsoluteFill>
  );
};

type Fx = [string, number, number];
const FX: Fx[] = [
  ...Array.from({ length: 8 }, (_, i): Fx => ["shutter", i * 9, 0.3]),
  ["boom", s(2.6), 0.55],
  ...([SC.pass[0], SC.seats[0], SC.bags[0], SC.money[0], SC.end[0]] as number[]).map((t): Fx => ["whoosh", s(t) - 4, 0.42]),
  ...[1.0, 1.8, 2.6, 3.4].map((t): Fx => ["tick", s(SC.pass[0] + t), 0.45]),
  ...[0.5, 1.2, 1.9, 2.6].map((t): Fx => ["pop", s(SC.seats[0] + t), 0.35]),
  ["coin", s(SC.seats[0] + 0.6), 0.2], ["shutter", s(SC.bags[0] + 0.5), 0.6], ["printer", s(SC.bags[0] + 1.0), 0.3],
  ...[0.6, 1.4, 2.2, 3.0].map((t): Fx => ["tick", s(SC.bags[0] + t), 0.45]),
  ["ding", s(SC.bags[0] + 3.0), 0.4],
  ...Array.from({ length: 8 }, (_, i): Fx => ["coin", s(SC.money[0]) + 6 + i * 4, 0.2]),
  ...[0.8, 1.3, 1.8].map((t): Fx => ["pop", s(SC.end[0] + t), 0.35]),
  ["chime", s(SC.end[0] + 2.3), 0.5],
];

export const MeuBagageiro2: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <Background />
    <Sequence {...at("match")}>
      <MatchCut dur={D("match")} word="EXCURSÃO" every={9} meta="Controle" pages={[
        { site: "CADERNO", before: "Lista da", after: "escrita à mão", bg: "#FBF6E9" },
        { site: "PLANILHA", before: "Contas da", after: "no Excel", bg: "#EEF4EE" },
        { site: "WHATSAPP", before: "Grupo da", after: "com 300 mensagens", bg: "#E7F3EC" },
        { site: "PAPEL", before: "Mapa da", after: "rabiscado", bg: "#F4F1EC" },
        { site: "BLOCO", before: "Pacotes da", after: "sem controle", bg: "#FBF6E9" },
        { site: "CADERNO", before: "Lucro da", after: "no chute", bg: "#F4F1EC" },
      ]} />
    </Sequence>
    <Sequence {...at("hero")}><Hero /></Sequence>
    <Sequence {...at("pass")}><Passengers /></Sequence>
    <Sequence {...at("seats")}><Seats /></Sequence>
    <Sequence {...at("bags")}><Bags /></Sequence>
    <Sequence {...at("money")}><Money /></Sequence>
    <Sequence {...at("end")}><End /></Sequence>
    <Brand />
    {VO.map(([p, a, b], i) => (
      <Sequence key={`v${i}`} from={s(p)} durationInFrames={s(b - a)}>
        <Audio src={staticFile("vo.mp3")} trimBefore={s(a)} trimAfter={s(b)} />
      </Sequence>
    ))}
    {FX.map(([n, f, v], i) => (
      <Sequence key={`f${i}`} from={Math.max(0, f)} durationInFrames={75}><Audio src={staticFile(`sfx/${n}.wav`)} volume={v} /></Sequence>
    ))}
  </AbsoluteFill>
);
