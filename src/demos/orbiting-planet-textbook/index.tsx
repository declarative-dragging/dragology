import { DemoDraggable } from "../../demo/ui";
import { Draggable } from "../../draggable";
import { param } from "../../DragSpec";

import { demo } from "../../demo";
import { rotateDeg, translate } from "../../svgx/helpers";

import deepField from "./deep-field.webp";
import saturn from "./saturn.webp";
import sunBlue from "./sun-blue.webp";
import sunRed from "./sun-red.webp";
import sunYellow from "./sun-yellow.webp";

// orbiting-planet, restyled as a 1990s "Utopian Scholastic" classroom
// plate: an encyclopedia-style white page with a vivid deep-space
// panel, cut-out photographs of suns and a planet with leader-line
// captions, a plastic ruler, a fact file and a "Did you know?" burst.
// The drag behavior is the same as orbiting-planet's.
//
// The photos are NASA's, all public domain, cut out and recolored:
// deep-field.webp: Hubble Ultra Deep Field (PIA12110)
// saturn.webp: Cassini (PIA06193)
// sun-yellow.webp: SDO (GSFC_20171208_Archive_e001209), recolored gold
// sun-red.webp: SDO, 304 Å (GSFC_20171208_Archive_e001770)
// sun-blue.webp: SDO, 335 Å (GSFC_20171208_Archive_e002035)

const W = 640;
const H = 560;

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS =
  "Futura, 'Century Gothic', 'Avenir Next', 'Trebuchet MS', sans-serif";

const INK = "#1b1f5e";
const PAPER = "#fdfbf4";

const PANEL = { x: 24, y: 84, w: 592, h: 340 };

const ORBIT_RADIUS = 70;

type Star = {
  x: number;
  y: number;
  name: string;
  kind: string;
  temp: string;
  year: string;
  blurb: [string, string];
  core: string;
  glow: string;
  photo: string;
  // Radius of the photo's solar disk.
  radius: number;
  // Where the caption's leader line ends, and where its text starts.
  anchor: [number, number];
  caption: [number, number];
};

const STARS: Star[] = [
  {
    x: 160,
    y: 245,
    name: "AURUM",
    kind: "Yellow dwarf",
    temp: "5,500 °C",
    year: "288 days",
    blurb: ["A calm, middle-aged sun,", "much like our own."],
    core: "#ffd23f",
    glow: "#ffb000",
    photo: sunYellow,
    radius: 18,
    anchor: [112, 176],
    caption: [44, 112],
  },
  {
    x: 440,
    y: 170,
    name: "RUBER",
    kind: "Red giant",
    temp: "3,200 °C",
    year: "410 days",
    blurb: ["An old star, swollen to", "100 times its first size."],
    core: "#ff6a3d",
    glow: "#e2312b",
    photo: sunRed,
    radius: 24,
    anchor: [512, 250],
    caption: [512, 262],
  },
  {
    x: 372,
    y: 345,
    name: "CAERULEA",
    kind: "Blue giant",
    temp: "20,000 °C",
    year: "97 days",
    blurb: ["Young, fierce and hot,", "it burns out quickly."],
    core: "#8fd3ff",
    glow: "#1f6fd6",
    photo: sunBlue,
    radius: 15,
    anchor: [292, 368],
    caption: [150, 362],
  },
];

type State = {
  currentStar: number;
  angle: number;
};

const initialState: State = {
  currentStar: 0,
  angle: 0,
};

const SPARKLES = [
  [70, 380],
  [300, 120],
  [560, 395],
  [255, 230],
  [585, 190],
];

function starburst(spikes: number, outer: number, inner: number): string {
  return Array.from({ length: spikes * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes;
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

function degrees(angle: number): number {
  const deg = Math.round((angle * 180) / Math.PI) % 360;
  return deg < 0 ? deg + 360 : deg;
}

function glowGradient(i: number) {
  const { glow } = STARS[i];
  return (
    <radialGradient id={`us-glow-${i}`}>
      <stop offset="0" stopColor={glow} stopOpacity={0.85} />
      <stop offset="0.4" stopColor={glow} stopOpacity={0.3} />
      <stop offset="1" stopColor={glow} stopOpacity={0} />
    </radialGradient>
  );
}

const defs = (
  <defs>
    <linearGradient id="us-space" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stopColor="#0a0f3c" />
      <stop offset="0.55" stopColor="#16206b" />
      <stop offset="1" stopColor="#2a1a6e" />
    </linearGradient>
    <radialGradient id="us-nebula-pink">
      <stop offset="0" stopColor="#ff4fa3" stopOpacity={0.45} />
      <stop offset="1" stopColor="#ff4fa3" stopOpacity={0} />
    </radialGradient>
    <radialGradient id="us-nebula-teal">
      <stop offset="0" stopColor="#2de0c8" stopOpacity={0.3} />
      <stop offset="1" stopColor="#2de0c8" stopOpacity={0} />
    </radialGradient>
    {/* Dragology doesn't walk inside <defs>, so a list here would need
        React keys; these are written out instead. */}
    {glowGradient(0)}
    {glowGradient(1)}
    {glowGradient(2)}
  </defs>
);

/** The page, the space panel and everything else that never changes. */
const backdrop = (
  <g>
    <rect width={W} height={H} fill={PAPER} />

    {/* Header */}
    <text
      transform={translate(PANEL.x, 26)}
      fontFamily={SANS}
      fontSize={9.5}
      fontWeight="bold"
      letterSpacing={2.5}
      fill="#e2412b"
    >
      PLATE 7 · THE HEAVENS
    </text>
    <text
      transform={translate(PANEL.x, 56)}
      fontFamily={SERIF}
      fontSize={28}
      fontWeight="bold"
      fill={INK}
    >
      Worlds &amp; Their Suns
    </text>
    {["#e2412b", "#ffc20e", "#2bb24c", "#1f6fd6", "#7b3fbf"].map((c, i) => (
      <rect
        transform={translate(PANEL.x + i * 24, 66)}
        width={24}
        height={5}
        fill={c}
      />
    ))}
    <text
      transform={translate(PANEL.x + 132, 71)}
      fontFamily={SERIF}
      fontSize={11}
      fontStyle="italic"
      fill="#55597f"
    >
      An illustrated guide to how a planet chooses its star
    </text>

    {/* Space panel */}
    <g transform={translate(PANEL.x, PANEL.y)}>
      <rect width={PANEL.w} height={PANEL.h} fill="#000000" />
      <image
        href={deepField}
        width={PANEL.w}
        height={PANEL.h}
        preserveAspectRatio="xMidYMid slice"
      />
      <rect
        width={PANEL.w}
        height={PANEL.h}
        fill="url(#us-space)"
        opacity={0.55}
      />
      <ellipse
        transform={translate(110, 300)}
        rx={190}
        ry={110}
        fill="url(#us-nebula-pink)"
      />
      <ellipse
        transform={translate(520, 70) + rotateDeg(-25)}
        rx={170}
        ry={90}
        fill="url(#us-nebula-teal)"
      />
      {Array.from({ length: 15 }, (_, i) => (
        <line
          x1={(i + 1) * 37}
          y1={0}
          x2={(i + 1) * 37}
          y2={PANEL.h}
          stroke="#ffffff"
          strokeOpacity={0.06}
        />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <line
          x1={0}
          y1={(i + 1) * 34}
          x2={PANEL.w}
          y2={(i + 1) * 34}
          stroke="#ffffff"
          strokeOpacity={0.06}
        />
      ))}
    </g>
    {SPARKLES.map(([x, y]) => (
      <polygon
        transform={translate(x, y)}
        points={starburst(4, 6, 1.2)}
        fill="#ffffff"
        opacity={0.9}
      />
    ))}
    <rect
      transform={translate(PANEL.x + 5, PANEL.y + 5)}
      width={PANEL.w - 10}
      height={PANEL.h - 10}
      fill="none"
      stroke="#e8c25a"
      strokeOpacity={0.6}
      strokeWidth={0.75}
    />
    <text
      transform={translate(PANEL.x + PANEL.w - 14, PANEL.y + PANEL.h - 14)}
      textAnchor="end"
      fontFamily={SANS}
      fontSize={8}
      letterSpacing={2}
      fill="#e8c25a"
      opacity={0.8}
    >
      FIG. 1
    </text>
    <text
      transform={translate(PANEL.x + 14, PANEL.y + PANEL.h - 14)}
      fontFamily={SANS}
      fontSize={7}
      letterSpacing={1.5}
      fill="#e8c25a"
      opacity={0.8}
    >
      PHOTOGRAPHS: NASA
    </text>

    {/* Ruler */}
    <g transform={translate(PANEL.x, 444)}>
      <rect
        width={286}
        height={30}
        rx={3}
        fill="#ffd84d"
        stroke="#c79a00"
        strokeWidth={1}
      />
      {Array.from({ length: 51 }, (_, i) => (
        <line
          x1={8 + i * 5.4}
          y1={0}
          x2={8 + i * 5.4}
          y2={i % 10 === 0 ? 12 : i % 5 === 0 ? 9 : 5}
          stroke="#5a4500"
          strokeWidth={0.8}
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <text
          transform={translate(8 + i * 54, 23)}
          textAnchor="middle"
          fontFamily={SANS}
          fontSize={8}
          fill="#5a4500"
        >
          {String(i * 20)}
        </text>
      ))}
    </g>
    <text
      transform={translate(PANEL.x, 488)}
      fontFamily={SANS}
      fontSize={8}
      letterSpacing={1.5}
      fill="#55597f"
    >
      SCALE: MILLIONS OF KILOMETRES
    </text>

    {/* How to use */}
    <text
      transform={translate(PANEL.x, 514)}
      fontFamily={SANS}
      fontSize={9.5}
      fontWeight="bold"
      letterSpacing={2}
      fill="#2bb24c"
    >
      TRY IT YOURSELF
    </text>
    <text
      transform={translate(PANEL.x, 530)}
      fontFamily={SERIF}
      fontSize={12}
      fill={INK}
    >
      Drag the planet Orbis around its sun. Bring it
    </text>
    <text
      transform={translate(PANEL.x, 545)}
      fontFamily={SERIF}
      fontSize={12}
      fill={INK}
    >
      near another sun and it will change orbits.
    </text>

    {/* Did you know? */}
    <g transform={translate(570, 98) + rotateDeg(10)}>
      <polygon
        points={starburst(14, 50, 41)}
        fill="#ffc20e"
        stroke="#e2412b"
        strokeWidth={2}
      />
      <text
        transform={translate(0, -9)}
        textAnchor="middle"
        fontFamily={SANS}
        fontSize={8.5}
        fontWeight="bold"
        letterSpacing={0}
        fill="#e2412b"
      >
        DID YOU KNOW?
      </text>
      <text
        transform={translate(0, 5)}
        textAnchor="middle"
        fontFamily={SERIF}
        fontSize={9}
        fontStyle="italic"
        fill={INK}
      >
        Some planets
      </text>
      <text
        transform={translate(0, 16)}
        textAnchor="middle"
        fontFamily={SERIF}
        fontSize={9}
        fontStyle="italic"
        fill={INK}
      >
        orbit two suns!
      </text>
    </g>
  </g>
);

function factRow(y: number, label: string, value: string, indent = 0) {
  return (
    <g transform={translate(0, y)}>
      <text fontFamily={SANS} fontSize={8} letterSpacing={1.5} fill="#7a7d9c">
        {label}
      </text>
      <text
        transform={translate(100 + indent, 0)}
        fontFamily={SERIF}
        fontSize={13}
        fontWeight="bold"
        fill={INK}
      >
        {value}
      </text>
    </g>
  );
}

/** Saturn (standing in for Orbis), centered on the origin. */
const PLANET_W = 58;
const PLANET_H = (PLANET_W * 163) / 400;
const planetBody = (
  <image
    transform={translate(-PLANET_W / 2, -PLANET_H / 2)}
    href={saturn}
    width={PLANET_W}
    height={PLANET_H}
  />
);

const draggable: Draggable<State> = ({ state, d }) => {
  const host = STARS[state.currentStar];
  const planetX = host.x + ORBIT_RADIUS * Math.cos(state.angle);
  const planetY = host.y + ORBIT_RADIUS * Math.sin(state.angle);

  return (
    <g>
      {defs}
      {backdrop}

      {/* Orbits, with a tick every 30° */}
      {STARS.map((s, i) => {
        const active = i === state.currentStar;
        return (
          <g transform={translate(s.x, s.y)}>
            <circle
              r={ORBIT_RADIUS}
              fill="none"
              stroke="#9fb6ff"
              strokeOpacity={active ? 0 : 0.45}
              strokeDasharray="3 4"
            />
            <circle
              r={ORBIT_RADIUS}
              fill="none"
              stroke="#ffe27a"
              strokeOpacity={active ? 0.9 : 0}
              strokeWidth={1.5}
            />
            {Array.from({ length: 12 }, (_, k) => {
              const a = (k * Math.PI) / 6;
              const len = k % 3 === 0 ? 5 : 2.5;
              return (
                <line
                  x1={(ORBIT_RADIUS - len) * Math.cos(a)}
                  y1={(ORBIT_RADIUS - len) * Math.sin(a)}
                  x2={(ORBIT_RADIUS + len) * Math.cos(a)}
                  y2={(ORBIT_RADIUS + len) * Math.sin(a)}
                  stroke={active ? "#ffe27a" : "#9fb6ff"}
                  strokeOpacity={active ? 0.9 : 0.45}
                />
              );
            })}
          </g>
        );
      })}

      {/* Leader lines and captions */}
      {STARS.map((s, i) => {
        const active = i === state.currentStar;
        const [ax, ay] = s.anchor;
        const len = Math.hypot(ax - s.x, ay - s.y);
        const sx = s.x + ((ax - s.x) / len) * (s.radius + 6);
        const sy = s.y + ((ay - s.y) / len) * (s.radius + 6);
        const [cx, cy] = s.caption;
        return (
          <g>
            <line
              x1={sx}
              y1={sy}
              x2={ax}
              y2={ay}
              stroke="#ffffff"
              strokeOpacity={0.75}
              strokeWidth={0.75}
            />
            <circle transform={translate(ax, ay)} r={2} fill="#ffffff" />
            <g transform={translate(cx, cy)}>
              <text
                fontFamily={SANS}
                fontSize={11}
                fontWeight="bold"
                letterSpacing={2}
                fill="#ffffff"
              >
                {s.name}
              </text>
              <text
                transform={translate(0, 13)}
                fontFamily={SANS}
                fontSize={8.5}
                letterSpacing={1}
                fill={s.core}
              >
                {s.kind.toUpperCase()}
              </text>
              <text
                transform={translate(0, 27)}
                fontFamily={SERIF}
                fontSize={10}
                fontStyle="italic"
                fill="#d6dcff"
              >
                {s.blurb[0]}
              </text>
              <text
                transform={translate(0, 39)}
                fontFamily={SERIF}
                fontSize={10}
                fontStyle="italic"
                fill="#d6dcff"
              >
                {s.blurb[1]}
              </text>
              <text
                transform={translate(0, 53)}
                fontFamily={SANS}
                fontSize={7.5}
                fontWeight="bold"
                letterSpacing={1.5}
                fill="#ffe27a"
                opacity={active ? 1 : 0}
              >
                ★ ORBIS'S SUN
              </text>
            </g>
          </g>
        );
      })}

      {/* Suns */}
      {STARS.map((s, i) => (
        <g transform={translate(s.x, s.y)}>
          <circle r={s.radius * 2.6} fill={`url(#us-glow-${i})`} />
          {/* The disk fills 78% of the photo's width. */}
          <image
            transform={translate(-s.radius / 0.78, -s.radius / 0.78)}
            href={s.photo}
            width={(2 * s.radius) / 0.78}
            height={(2 * s.radius) / 0.78}
          />
        </g>
      ))}

      {/* Fact file */}
      <g transform={translate(340, 444)}>
        <rect
          width={276}
          height={104}
          fill="#ffffff"
          stroke={INK}
          strokeWidth={1}
        />
        <rect width={276} height={20} fill="#1a9e8f" />
        <text
          transform={translate(10, 14)}
          fontFamily={SANS}
          fontSize={10}
          fontWeight="bold"
          letterSpacing={3}
          fill="#ffffff"
        >
          FACT FILE: ORBIS
        </text>
        <g transform={translate(10, 40)}>
          {factRow(0, "HOST STAR", host.name, 16)}
          {/* All three photos, so that switching hosts can fade between
              them (an image's href can't be blended). */}
          {STARS.map((s, i) => (
            <image
              transform={translate(100, -12)}
              href={s.photo}
              width={12}
              height={12}
              opacity={i === state.currentStar ? 1 : 0}
            />
          ))}
          {factRow(20, "SURFACE", host.temp)}
          {factRow(40, "ONE YEAR", host.year)}
          {factRow(60, "POSITION", `${degrees(state.angle)}° of 360°`)}
        </g>
      </g>

      {/* Planet */}
      <g
        id="planet"
        transform={translate(planetX, planetY)}
        dragologyZIndex={1}
        dragologyOnDrag={() =>
          d.closest(
            STARS.map((_, starIdx) =>
              d.vary(
                { currentStar: starIdx, angle: state.angle },
                param("angle"),
              ),
            ),
          )
        }
      >
        <circle r={26} fill="transparent" />
        {planetBody}
        <text
          transform={translate(20, -12)}
          fontFamily={SANS}
          fontSize={8.5}
          fontWeight="bold"
          letterSpacing={1.5}
          fill="#ffffff"
        >
          ORBIS
        </text>
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
  { tags: ["d.closest", "d.vary", "multiple continuous targets"] },
);
