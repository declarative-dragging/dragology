import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { param } from "../DragSpec";
import { Vec2 } from "../math/vec2";
import { path, translate } from "../svgx/helpers";

// orbiting-planet-with-background, drawn as a plate from an idealized
// natural-philosophy treatise: vellum, iron-gall ink, gold leaf, and Byrne's
// Euclid primaries, with a Latin caption and an English gloss that follow the
// state.

const W = 560;
const H = 600;

const VELLUM = "#f3ead6";
const VELLUM_DEEP = "#e6d6b4";
const INK = "#2b2118";
const INK_FAINT = "#2b211855";
const GOLD = "#b8862b";
const VERMILION = "#c23b22";
const ULTRAMARINE = "#2b4a9b";
const OCHRE = "#d9a21b";

const SERIF =
  '"Cormorant Garamond", "EB Garamond", "Hoefler Text", Baskerville, "Palatino Linotype", Palatino, Georgia, serif';

const STARS = [
  { pos: Vec2(150, 260), color: VERMILION, numeral: "I", name: "AVRORA" },
  { pos: Vec2(405, 215), color: ULTRAMARINE, numeral: "II", name: "MERIDIES" },
  { pos: Vec2(330, 425), color: OCHRE, numeral: "III", name: "VESPER" },
];
const ORDINALS = ["primum", "secundum", "tertium"];
const ENGLISH_ORDINALS = ["first", "second", "third"];

const ORBIT_RADIUS = 70;
const STAR_RADIUS = 13;
const PLANET_RADIUS = 7;

type State =
  | { mode: "orbiting"; currentStar: number; angle: number }
  | { mode: "free"; x: number; y: number };

const initialState: State = {
  mode: "orbiting",
  currentStar: 0,
  angle: 0,
};

function toRoman(n: number): string {
  if (n === 0) return "nullum";
  const table: [number, string][] = [
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [value, glyph] of table) {
    while (n >= value) {
      out += glyph;
      n -= value;
    }
  }
  return out;
}

/** Whole degrees in [0, 360), from an angle in radians (clockwise on screen). */
function degreesOf(angle: number): number {
  const deg = Math.round((angle * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}

/** Alternating long and short rays around a sun, as one closed path. */
function sunRays(n: number, inner: number, long: number, short: number) {
  const pts: Vec2[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? (i % 4 === 0 ? long : short) : inner;
    pts.push(Vec2(r * Math.cos(a), r * Math.sin(a)));
  }
  return path("M", ...pts.flatMap((p, i) => (i === 0 ? [p] : ["L", p])), "Z");
}

/** Degree ticks around an orbit: every 10°, longer every 30°. */
function orbitTicks(r: number) {
  const parts: (Vec2 | string)[] = [];
  for (let deg = 0; deg < 360; deg += 10) {
    const a = (deg * Math.PI) / 180;
    const len = deg % 30 === 0 ? 6 : 3;
    const dir = Vec2(Math.cos(a), Math.sin(a));
    parts.push("M", dir.mul(r), "L", dir.mul(r + len));
  }
  return path(...parts);
}

/** A small four-pointed compass star, for the corners of the plate. */
function compassStar(at: Vec2, size: number) {
  const s = size;
  const t = size * 0.28;
  return (
    <g transform={translate(at)}>
      <path
        d={path(
          "M",
          Vec2(0, -s),
          "L",
          Vec2(t, -t),
          "L",
          Vec2(s, 0),
          "L",
          Vec2(t, t),
          "L",
          Vec2(0, s),
          "L",
          Vec2(-t, t),
          "L",
          Vec2(-s, 0),
          "L",
          Vec2(-t, -t),
          "Z",
        )}
        fill={GOLD}
        stroke={INK}
        strokeWidth={0.6}
      />
      <circle r={size * 0.18} fill={VELLUM} stroke={INK} strokeWidth={0.6} />
    </g>
  );
}

function caption(state: State): { latin: string; english: string } {
  if (state.mode === "free") {
    return {
      latin: "Corpus vagum, nulli lumini subiectum.",
      english: "The body wanders, subject to no light.",
    };
  }
  const deg = degreesOf(state.angle);
  return {
    latin: `Corpus circa lumen ${ORDINALS[state.currentStar]}, ad gradum ${toRoman(deg)}.`,
    english: `The body circles the ${ENGLISH_ORDINALS[state.currentStar]} light, at ${deg}°.`,
  };
}

const draggable: Draggable<State> = ({ state, d }) => {
  const planet =
    state.mode === "orbiting"
      ? STARS[state.currentStar].pos.add(
          Vec2(Math.cos(state.angle), Math.sin(state.angle)).mul(ORBIT_RADIUS),
        )
      : Vec2(state.x, state.y);
  const { latin, english } = caption(state);

  return (
    <g fontFamily={SERIF}>
      <defs>
        <radialGradient id="scholastic-vellum" cx="50%" cy="45%" r="75%">
          <stop offset="55%" stopColor={VELLUM} />
          <stop offset="100%" stopColor={VELLUM_DEEP} />
        </radialGradient>
      </defs>

      {/* The plate: vellum, a gold rule inside an ink rule, corner stars */}
      <rect width={W} height={H} fill="url(#scholastic-vellum)" />
      <rect
        transform={translate(14, 14)}
        width={W - 28}
        height={H - 28}
        fill="none"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect
        transform={translate(19, 19)}
        width={W - 38}
        height={H - 38}
        fill="none"
        stroke={GOLD}
        strokeWidth={0.8}
      />
      {compassStar(Vec2(19, 19), 9)}
      {compassStar(Vec2(W - 19, 19), 9)}
      {compassStar(Vec2(19, H - 19), 9)}
      {compassStar(Vec2(W - 19, H - 19), 9)}

      {/* Title */}
      <g transform={translate(W / 2, 0)}>
        <text
          transform={translate(0, 52)}
          textAnchor="middle"
          fontSize={10}
          letterSpacing={3}
          fill={VERMILION}
        >
          PROPOSITIO · VII
        </text>
        <text
          transform={translate(0, 80)}
          textAnchor="middle"
          fontSize={24}
          letterSpacing={7}
          fill={INK}
        >
          TABVLA ORBIVM
        </text>
        <text
          transform={translate(0, 101)}
          textAnchor="middle"
          fontSize={13}
          fontStyle="italic"
          fill={INK}
          opacity={0.75}
        >
          de corpore vago et tribus luminibus
        </text>
        <path
          d={path(
            "M",
            Vec2(-120, 116),
            "L",
            Vec2(-8, 116),
            "M",
            Vec2(8, 116),
            "L",
            Vec2(120, 116),
          )}
          stroke={INK}
          strokeWidth={0.6}
        />
        <path
          d={path(
            "M",
            Vec2(0, 111),
            "L",
            Vec2(5, 116),
            "L",
            Vec2(0, 121),
            "L",
            Vec2(-5, 116),
            "Z",
          )}
          fill={GOLD}
          stroke={INK}
          strokeWidth={0.5}
        />
      </g>

      {/* Construction: the triangle of the three lights */}
      <path
        d={path("M", STARS[0].pos, "L", STARS[1].pos, "L", STARS[2].pos, "Z")}
        fill="none"
        stroke={INK_FAINT}
        strokeWidth={0.6}
        strokeDasharray="1 4"
      />

      {/* Orbits, each a limb with degree ticks; the claimed one in its color */}
      {STARS.map((s, i) => {
        const claimed = state.mode === "orbiting" && state.currentStar === i;
        return (
          <g transform={translate(s.pos)}>
            <circle
              r={ORBIT_RADIUS}
              fill="none"
              stroke={claimed ? s.color : INK}
              strokeOpacity={claimed ? 0.9 : 0.45}
              strokeWidth={claimed ? 1.4 : 0.8}
            />
            <circle
              r={ORBIT_RADIUS - 4}
              fill="none"
              stroke={INK}
              strokeOpacity={0.25}
              strokeWidth={0.5}
            />
            <path
              d={orbitTicks(ORBIT_RADIUS)}
              stroke={INK}
              strokeOpacity={0.5}
              strokeWidth={0.6}
            />
          </g>
        );
      })}

      {/* Radius vectors from each light to the body, shown for the claimant */}
      {STARS.map((s, i) => {
        const claimed = state.mode === "orbiting" && state.currentStar === i;
        return (
          <line
            {...s.pos.xy1()}
            {...planet.xy2()}
            stroke={s.color}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={claimed ? 0.8 : 0}
          />
        );
      })}

      {/* The three lights: gilded rays around a disc of the light's color */}
      {STARS.map((s) => (
        <g transform={translate(s.pos)}>
          <path
            d={sunRays(12, STAR_RADIUS + 1, STAR_RADIUS + 12, STAR_RADIUS + 6)}
            fill={GOLD}
            stroke={INK}
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
          <circle
            r={STAR_RADIUS}
            fill={s.color}
            stroke={INK}
            strokeWidth={0.8}
          />
          <circle
            r={STAR_RADIUS - 4}
            fill="none"
            stroke={VELLUM}
            strokeOpacity={0.6}
            strokeWidth={0.6}
          />
          <text
            transform={translate(0, ORBIT_RADIUS + 24)}
            textAnchor="middle"
            fontSize={11}
            letterSpacing={2.5}
            fill={INK}
          >
            <tspan fill={VERMILION}>{s.numeral}</tspan> · {s.name}
          </text>
        </g>
      ))}

      {/* Commentary, Latin with an English gloss. Set flush left with a
          hanging pilcrow, so that only the ends of the lines move as the
          numerals change. */}
      <g transform={translate(72, H - 62)}>
        <text
          transform={translate(-7, 0)}
          textAnchor="end"
          fontSize={15}
          fill={VERMILION}
        >
          ¶
        </text>
        <text textAnchor="start" fontSize={15} fontStyle="italic" fill={INK}>
          {latin}
        </text>
        <text
          transform={translate(0, 20)}
          textAnchor="start"
          fontSize={11}
          letterSpacing={0.5}
          fill={INK}
          opacity={0.6}
        >
          {english}
        </text>
      </g>

      {/* The wandering body */}
      <g
        id="planet"
        transform={translate(planet)}
        dragologyZIndex={1}
        dragologyOnDrag={() => {
          const angle = state.mode === "orbiting" ? state.angle : 0;
          return d
            .closest(
              STARS.map((_, starIdx) =>
                d.vary(
                  { mode: "orbiting" as const, currentStar: starIdx, angle },
                  param("angle"),
                ),
              ),
            )
            .whenFar(
              d.vary({ mode: "free", x: planet.x, y: planet.y }, [
                param("x"),
                param("y"),
              ]),
              { gap: 50 },
            );
        }}
      >
        <circle r={PLANET_RADIUS + 6} fill="transparent" />
        <circle
          r={PLANET_RADIUS}
          fill={state.mode === "free" ? VELLUM : INK}
          stroke={INK}
          strokeWidth={1.2}
        />
        <circle
          r={PLANET_RADIUS + 3}
          fill="none"
          stroke={GOLD}
          strokeWidth={0.8}
        />
      </g>
    </g>
  );
};

export default demo(
  () => (
    <DemoDraggable
      draggable={draggable}
      initialState={initialState}
      width={W}
      height={H}
    />
  ),
  {
    tags: ["d.closest", "d.vary", "spec.whenFar", "aesthetics"],
  },
);
