import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile } from "remotion";
import { AppleToggles, Checklist, GlassWidgets, MatchCut, Orbit, Spotlight, Timeline, FONT } from "./Effects";

const FPS = 30;
const s = (t: number) => Math.round(t * FPS);
export const DEMO_DUR = s(52);

// [inicio(s), fim(s)]
const T = {
  widgets: [1.3, 7.0],
  todo: [7.5, 16.0],
  spot: [19.0, 23.2],
  toggles: [22.6, 30.0],
  orbit: [30.0, 36.8],
  timeline: [42.0, 48.4],
  match: [48.5, 51.2],
} as const;
const span = (k: keyof typeof T) => ({ from: s(T[k][0]), durationInFrames: s(T[k][1] - T[k][0]) });
const dur = (k: keyof typeof T) => s(T[k][1] - T[k][0]);

const fx: [string, number, number][] = [
  ...Object.values(T).map((t): [string, number, number] => ["whoosh", s(t[0]) - 3, 0.35]),
  ["pop", s(1.45), 0.4], ["pop", s(1.7), 0.4], ["pop", s(1.95), 0.4],
  ["tick", s(11.9), 0.5], ["tick", s(13.9), 0.5], ["tick", s(15.1), 0.5],
  ["tick", s(23.0), 0.5], ["tick", s(25.8), 0.5], ["tick", s(29.0), 0.5],
  ...Array.from({ length: 11 }, (_, i): [string, number, number] => ["shutter", s(48.5) + i * 7, 0.3]),
];

export const EfeitosDemo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily: FONT }}>
    <OffthreadVideo src={staticFile("demo/amora.mp4")} />
    <Sequence {...span("widgets")}>
      <GlassWidgets dur={dur("widgets")} items={[
        { kind: "stat", value: 3, label: "conjuntos novos", x: 70, y: 260, delay: 4 },
        { kind: "ring", pct: 1, label: "Do P ao GG", x: 600, y: 330, delay: 11 },
        { kind: "bars", label: "a partir de", value: "R$ 144,99", x: 640, y: 1130, delay: 18 },
      ]} />
    </Sequence>
    <Sequence {...span("todo")}>
      <Checklist dur={dur("todo")} title="Conjunto trama" items={[
        { label: "Trama artesanal", at: s(11.9 - 7.5) },
        { label: "Forrado", at: s(13.9 - 7.5) },
        { label: "Com bojo", at: s(15.1 - 7.5) },
      ]} />
    </Sequence>
    <Sequence {...span("spot")}><Spotlight dur={dur("spot")} x={520} y={900} /></Sequence>
    <Sequence {...span("toggles")}>
      <AppleToggles dur={dur("toggles")} items={[
        { label: "Silicone interno", at: s(0.4), color: "#FF6B8A" },
        { label: "Ajuste perfeito", at: s(25.8 - 22.6), color: "#B48CFF" },
        { label: "Fica certinho", at: s(29.0 - 22.6), color: "#FFB347" },
      ]} />
    </Sequence>
    <Sequence {...span("orbit")}>
      <Orbit dur={dur("orbit")} cx={560} cy={620} images={["thumbs/t8.jpg", "thumbs/t18.jpg", "thumbs/t31.jpg", "thumbs/t44.jpg", "thumbs/t50.jpg", "thumbs/t70.jpg"]} />
    </Sequence>
    <Sequence {...span("timeline")}><Timeline dur={dur("timeline")} title="Reposição chegando" /></Sequence>
    <Sequence {...span("match")}>
      <MatchCut dur={dur("match")} word="NOVIDADE" pages={[
        { site: "REVISTA MODA", before: "A grande", after: "do verão é o crochê" },
        { site: "BLOG ESTILO", before: "Toda semana uma", after: "na arara", bg: "#F3EEE6" },
        { site: "JORNAL DA MODA", before: "Conjuntos são a", after: "da estação" },
        { site: "TENDÊNCIAS", before: "Mais uma", after: "esperando por você", bg: "#EEF1F4" },
      ]} />
    </Sequence>
    {fx.map(([n, f, v], i) => (
      <Sequence key={i} from={f} durationInFrames={60}><Audio src={staticFile(`sfx/${n}.wav`)} volume={v} /></Sequence>
    ))}
  </AbsoluteFill>
);
