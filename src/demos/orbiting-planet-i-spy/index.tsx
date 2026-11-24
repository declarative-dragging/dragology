import { DemoDraggable } from "../../demo/ui";
import { Draggable } from "../../draggable";
import { param } from "../../DragSpec";

import { demo } from "../../demo";
import { rotateDeg, scale, translate } from "../../svgx/helpers";

import balloonRed from "./balloon-red.webp";
import balloonYellow from "./balloon-yellow.webp";
import basketball from "./basketball.webp";
import camera from "./camera.webp";
import cat from "./cat.webp";
import dinosaur from "./dinosaur.webp";
import dog from "./dog.webp";
import emac from "./emac.webp";
import hotdog from "./hotdog.webp";
import moth from "./moth.webp";
import percolator from "./percolator.webp";
import pizza from "./pizza.webp";
import records from "./records.webp";
import sky from "./sky.webp";
import sunflower from "./sunflower.webp";
import teacup from "./teacup.webp";
import telephone from "./telephone.webp";
import toadstool from "./toadstool.webp";

// orbiting-planet as a 1990s "Utopian Scholastic" magazine-ad collage:
// cut-out photos of everyday things floating in a blue sky, with an
// "I Spy" rhyme. Every thing can be dragged around the sky or onto the
// rings around a pizza, a sunflower and a basketball, where it orbits
// as the planet does in orbiting-planet-with-background. Some pairs,
// on the same ring and within 90° of each other, talk.
//
// The cut-outs come from Wikimedia Commons (found through pngaz.com),
// trimmed, resized and given a drop shadow:
// sky.webp: Shiniglider, CC0 ("Cumulus and Stratocumulus clouds spotted
//   in Bangkok, Thailand.jpg")
// pizza.webp: Clampu, CC BY-SA 4.0 ("Pizza Pepperoni Transparent.png")
// sunflower.webp: public domain ("Sunflower Metalhead64 edited.png")
// basketball.webp: public domain ("Basketball.png")
// cat.webp: Matt Buck, CC BY-SA 4.0 ("Asian tabby cat transparent.png")
// telephone.webp: CC0 ("Rotary dial telephone.svg")
// emac.webp: Tyler9xp, CC BY 2.0 ("EMac.png")
// teacup.webp: CC0 ("Teacup.png")
// camera.webp: CC0 ("Twin-lens reflex camera.svg")
// percolator.webp: Jonatan Svensson Glad, CC BY-SA 4.0 ("Percolator
//   taken in 2014 (transparent).png")
// balloon-red.webp, balloon-yellow.webp: CC0 ("Red toy balloon.svg",
//   "Yellow toy balloon.svg")
// toadstool.webp: Tiia Monto, CC BY 4.0 ("Amanita muscaria.png")
// dinosaur.webp: TotalDino, CC BY-SA 4.0 ("Edmontosaurus TD.png")
// moth.webp: Fir0002, CC BY-SA 3.0 ("Polyphemus moth transparent
//   bkgrnd.png")
// dog.webp: public domain ("Tibetan mastiff (transparent background).png")
// records.webp: CC0 ("Discos-LP.png")
// hotdog.webp: public domain ("Hot dog with mustard.png")

const W = 640;
const H = 560;

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS =
  "Futura, 'Century Gothic', 'Avenir Next', 'Trebuchet MS', sans-serif";
const COMIC = "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive";

const INK = "#1b1f5e";

const ORBIT_RADIUS = 82;
/** On a ring, a thing shrinks to fit in a box this big. */
const RING_FIT = 72;

/** A cut-out photo: its file, and its size in pixels. */
type Pic = { href: string; size: [number, number] };

/** Draws a cut-out `width` wide, centered on the origin. */
function pic({ href, size: [iw, ih] }: Pic, width: number) {
  const height = (width * ih) / iw;
  return (
    <image
      transform={translate(-width / 2, -height / 2)}
      href={href}
      width={width}
      height={height}
    />
  );
}

type Sun = {
  x: number;
  y: number;
  pic: Pic;
  width: number;
};

const SUNS: Sun[] = [
  { x: 165, y: 215, pic: { href: pizza, size: [296, 296] }, width: 118 },
  { x: 460, y: 150, pic: { href: sunflower, size: [296, 275] }, width: 120 },
  { x: 385, y: 360, pic: { href: basketball, size: [274, 276] }, width: 92 },
];

/**
 * Where a thing is: on the ring around `SUNS[sun]` at `angle`, or, if
 * `sun` is null, floating at (`x`, `y`). Every field is always there,
 * so that `d.vary` can name any of them.
 */
type Place = { sun: number | null; angle: number; x: number; y: number };

const free = (x: number, y: number): Place => ({ sun: null, angle: 0, x, y });

/** A draggable thing: its photo, its width and tilt, where it starts. */
type Thing = { pic: Pic; width: number; tilt: number; start: Place };

const THINGS = {
  cat: {
    pic: { href: cat, size: [166, 256] },
    width: 46,
    tilt: 0,
    start: { sun: 0, angle: 0, x: 0, y: 0 },
  },
  balloonRed: {
    pic: { href: balloonRed, size: [158, 256] },
    width: 62,
    tilt: -14,
    start: free(44, 60),
  },
  balloonYellow: {
    pic: { href: balloonYellow, size: [158, 256] },
    width: 54,
    tilt: 16,
    start: free(320, 38),
  },
  hotdog: {
    pic: { href: hotdog, size: [236, 136] },
    width: 90,
    tilt: -18,
    start: free(418, 28),
  },
  emac: {
    pic: { href: emac, size: [250, 256] },
    width: 92,
    tilt: 12,
    start: free(300, 140),
  },
  teacup: {
    pic: { href: teacup, size: [236, 217] },
    width: 84,
    tilt: 20,
    start: free(588, 52),
  },
  camera: {
    pic: { href: camera, size: [172, 236] },
    width: 58,
    tilt: -14,
    start: free(36, 230),
  },
  moth: {
    pic: { href: moth, size: [226, 187] },
    width: 92,
    tilt: -24,
    start: free(586, 262),
  },
  dinosaur: {
    pic: { href: dinosaur, size: [316, 134] },
    width: 140,
    tilt: -10,
    start: free(196, 352),
  },
  telephone: {
    pic: { href: telephone, size: [263, 276] },
    width: 100,
    tilt: -18,
    start: free(64, 390),
  },
  records: {
    pic: { href: records, size: [276, 189] },
    width: 104,
    tilt: 14,
    start: free(552, 390),
  },
  dog: {
    pic: { href: dog, size: [256, 189] },
    width: 100,
    tilt: 6,
    start: free(218, 466),
  },
  toadstool: {
    pic: { href: toadstool, size: [226, 188] },
    width: 74,
    tilt: -12,
    start: free(104, 488),
  },
  percolator: {
    pic: { href: percolator, size: [189, 236] },
    width: 56,
    tilt: 15,
    start: free(314, 490),
  },
} satisfies Record<string, Thing>;

type ThingId = keyof typeof THINGS;
const THING_IDS = Object.keys(THINGS) as ThingId[];

function thingHeight(id: ThingId) {
  const { pic, width } = THINGS[id];
  return (width * pic.size[1]) / pic.size[0];
}

type State = { places: Record<ThingId, Place> };

const initialState: State = {
  places: Object.fromEntries(
    THING_IDS.map((id) => [id, THINGS[id].start]),
  ) as Record<ThingId, Place>,
};

/** Where a thing is drawn, and how much it's shrunk. */
function placement(id: ThingId, place: Place) {
  if (place.sun === null) return { x: place.x, y: place.y, scale: 1 };
  const sun = SUNS[place.sun];
  return {
    x: sun.x + ORBIT_RADIUS * Math.cos(place.angle),
    y: sun.y + ORBIT_RADIUS * Math.sin(place.angle),
    scale: Math.min(1, RING_FIT / Math.max(THINGS[id].width, thingHeight(id))),
  };
}

/** Pairs that talk when they're on the same ring, within 90°. */
const CHATS: { a: ThingId; b: ThingId; sayA: string[]; sayB: string[] }[] = [
  { a: "dog", b: "cat", sayA: ["Truce?"], sayB: ["Never."] },
  { a: "cat", b: "moth", sayA: ["Hold still…"], sayB: ["No thank you!"] },
  {
    a: "cat",
    b: "balloonRed",
    sayA: ["Must… pop…"],
    sayB: ["Don't you dare!"],
  },
  { a: "dog", b: "hotdog", sayA: ["Cousin?"], sayB: ["Distant."] },
  {
    a: "percolator",
    b: "teacup",
    sayA: ["Coffee's better."],
    sayB: ["How vulgar."],
  },
  {
    a: "telephone",
    b: "emac",
    sayA: ["Nobody calls", "anymore."],
    sayB: ["Try e-mail!"],
  },
  {
    a: "moth",
    b: "emac",
    sayA: ["Fun fact: I was the", "first computer bug!"],
    sayB: ["Shoo!"],
  },
  {
    a: "records",
    b: "emac",
    sayA: ["Vinyl is forever."],
    sayB: ["I've got", "10,000 MP3s."],
  },
  {
    a: "balloonRed",
    b: "balloonYellow",
    sayA: ["Up, up…"],
    sayB: ["…and away!"],
  },
  {
    a: "camera",
    b: "dinosaur",
    sayA: ["Say cheese!"],
    sayB: ["Herbivore,", "thanks."],
  },
  {
    a: "dinosaur",
    b: "toadstool",
    sayA: ["Lunch?"],
    sayB: ["Wouldn't", "recommend it."],
  },
];

function chatting(a: Place, b: Place): boolean {
  if (a.sun === null || a.sun !== b.sun) return false;
  const turn = 2 * Math.PI;
  const diff = (((a.angle - b.angle) % turn) + turn) % turn;
  return Math.min(diff, turn - diff) <= Math.PI / 2 + 1e-9;
}

const BUBBLE_LINE = 12;
const BUBBLE_CHAR = 5.7;

/**
 * A speech bubble whose tail points at the origin. It extends to the
 * right if `dir` is 1, to the left if -1. Every bubble is always drawn,
 * faded out when it's not being said, so that it fades in and out
 * rather than popping.
 */
function bubble(lines: string[], dir: number, shown: boolean) {
  const w = Math.max(...lines.map((l) => l.length)) * BUBBLE_CHAR + 18;
  const h = lines.length * BUBBLE_LINE + 10;
  const left = dir > 0 ? -14 : 14 - w;
  const top = -h - 9;
  const tail = `${dir * 4},${-10} ${dir * 15},${-10} 0,0`;
  return (
    <g opacity={shown ? 1 : 0}>
      <polygon points={tail} fill="#ffffff" stroke={INK} strokeWidth={1.25} />
      <rect
        transform={translate(left, top)}
        width={w}
        height={h}
        rx={9}
        fill="#ffffff"
        stroke={INK}
        strokeWidth={1.25}
      />
      <polygon
        points={`${dir * 5.5},${-11.5} ${dir * 13.5},${-11.5} ${dir * 2},${-3}`}
        fill="#ffffff"
      />
      {lines.map((line, i) => (
        <text
          transform={translate(left + 9, top + 14 + i * BUBBLE_LINE)}
          fontFamily={COMIC}
          fontSize={10}
          fill={INK}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

const RHYME = [
  "I spy a pizza, a ball, and a bloom,",
  "a moth, two balloons, and a red-spotted 'shroom,",
  "a dog, a dinosaur, records, a phone,",
  "and a cat who keeps circling a sun of her own.",
];

const defs = (
  <defs>
    <radialGradient id="ispy-halo">
      <stop offset="0" stopColor="#fff6b0" stopOpacity={0.95} />
      <stop offset="0.5" stopColor="#ffe066" stopOpacity={0.45} />
      <stop offset="1" stopColor="#ffe066" stopOpacity={0} />
    </radialGradient>
  </defs>
);

/** The sky and the rhyme card. */
const backdrop = (
  <g>
    <image
      href={sky}
      width={W}
      height={H}
      preserveAspectRatio="xMidYMid slice"
    />

    {/* Rhyme card */}
    <g transform={translate(352, 440) + rotateDeg(-2)}>
      <rect
        transform={translate(4, 5)}
        width={276}
        height={108}
        fill="#0d1b3a"
        opacity={0.25}
      />
      <rect width={276} height={108} fill="#fffdf6" />
      <rect width={58} height={20} fill="#e2412b" />
      <text
        transform={translate(9, 14.5)}
        fontFamily={SANS}
        fontSize={11}
        fontWeight="bold"
        letterSpacing={2.5}
        fill="#ffffff"
      >
        I SPY
      </text>
      {RHYME.map((line, i) => (
        <text
          transform={translate(12, 38 + i * 15)}
          fontFamily={SERIF}
          fontSize={11.5}
          fontStyle="italic"
          fill={INK}
        >
          {line}
        </text>
      ))}
      <text
        transform={translate(12, 100)}
        fontFamily={SANS}
        fontSize={8}
        fontWeight="bold"
        letterSpacing={1.2}
        fill="#2bb24c"
      >
        PUT TWO THINGS ON ONE RING. WHO TALKS?
      </text>
    </g>

    <text
      transform={translate(8, H - 7)}
      fontFamily={SANS}
      fontSize={7}
      letterSpacing={1}
      fill="#ffffff"
      opacity={0.85}
    >
      PHOTOS: WIKIMEDIA COMMONS CONTRIBUTORS (CC0, CC BY, CC BY-SA)
    </text>
  </g>
);

const draggable: Draggable<State> = ({ state, d, draggedId }) => {
  const placed = Object.fromEntries(
    THING_IDS.map((id) => [id, placement(id, state.places[id])]),
  ) as Record<ThingId, ReturnType<typeof placement>>;

  const dragSpec = (id: ThingId) => {
    const { x, y } = placed[id];
    const withPlace = (place: Place): State => ({
      places: { ...state.places, [id]: place },
    });
    return d
      .closest(
        SUNS.map((sun, i) =>
          d.vary(
            withPlace({
              sun: i,
              angle: Math.atan2(y - sun.y, x - sun.x),
              x,
              y,
            }),
            param("places", id, "angle"),
          ),
        ),
      )
      .whenFar(
        d.vary(withPlace(free(x, y)), [
          param("places", id, "x"),
          param("places", id, "y"),
        ]),
      )
      .withBranchTransition(150);
  };

  // Bubbles over the same thing stack upward.
  const stacked: Partial<Record<ThingId, number>> = {};
  const bubbles = CHATS.flatMap(({ a, b, sayA, sayB }) => {
    const shown = chatting(state.places[a], state.places[b]);
    // The left one's bubble extends left, the right one's right, unless
    // that would run off the canvas.
    const aIsLeft = placed[a].x <= placed[b].x;
    return (
      [
        [a, sayA, aIsLeft ? -1 : 1],
        [b, sayB, aIsLeft ? 1 : -1],
      ] as const
    ).map(([id, lines, side]) => {
      const p = placed[id];
      const dir = p.x < 110 ? 1 : p.x > W - 110 ? -1 : side;
      const lift = shown ? (stacked[id] ?? 0) : 0;
      if (shown) {
        stacked[id] = lift + lines.length * BUBBLE_LINE + 16;
      }
      const top = p.y - (thingHeight(id) * p.scale) / 2 - lift;
      return <g transform={translate(p.x, top)}>{bubble(lines, dir, shown)}</g>;
    });
  });

  return (
    <g>
      {defs}
      {backdrop}

      {/* Orbits: dotted, or solid with a halo on the sun if anything is
          on them. Two circles rather than one with a changing dash
          pattern, which couldn't be blended. */}
      {SUNS.map((s, i) => {
        const occupied = THING_IDS.some((id) => state.places[id].sun === i);
        return (
          <g transform={translate(s.x, s.y)}>
            <circle
              r={ORBIT_RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={occupied ? 0 : 0.85}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="0.1 7"
            />
            <circle
              r={ORBIT_RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={occupied ? 0.95 : 0}
              strokeWidth={2}
            />
            <circle
              r={s.width * 0.85}
              fill="url(#ispy-halo)"
              opacity={occupied ? 1 : 0}
            />
            {pic(s.pic, s.width)}
          </g>
        );
      })}

      {THING_IDS.map((id) => {
        const p = placed[id];
        const domId = `thing-${id}`;
        return (
          <g
            id={domId}
            transform={
              translate(p.x, p.y) + rotateDeg(THINGS[id].tilt) + scale(p.scale)
            }
            dragologyZIndex={draggedId === domId ? "/1" : false}
            dragologyOnDrag={() => dragSpec(id)}
          >
            {pic(THINGS[id].pic, THINGS[id].width)}
          </g>
        );
      })}

      <g id="bubbles" dragologyZIndex="/2" pointerEvents="none">
        {bubbles}
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
    tags: [
      "d.closest",
      "d.vary",
      "spec.whenFar",
      "multiple continuous targets",
    ],
  },
);
