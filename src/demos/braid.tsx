import _ from "lodash";
import { useEffect, useMemo, useRef, useState } from "react";
import { demo } from "../demo";
import {
  ConfigCheckbox,
  ConfigSelect,
  DemoDraggable,
  DemoNotes,
} from "../demo/ui";
import { Draggable } from "../draggable";
import { inOrder, param } from "../DragSpec";
import { Vec2 } from "../math/vec2";
import { translate } from "../svgx/helpers";
import { clamp } from "../utils";
import { assertDefined } from "../utils/assert";

// # Braid group
//
// One braid β ∈ B_n, as a diagram and as a word in the Artin generators
// σ_1 … σ_{n-1} and their inverses, with a cross-section alongside: the
// strands as points moving in a plane. The state is the word; the
// diagram literally draws it, and the moves available on the diagram are
// exactly the relations of B_n:
//
// - σ_i σ_k = σ_k σ_i for |i−k| ≥ 2 (far-apart crossings commute),
// - σ_i σ_k σ_i = σ_k σ_i σ_k for |i−k| = 1 (Reidemeister III), in the
//   mixed-sign forms too, whenever a strand passes over or under both of
//   the other two,
// - σ_i σ_i⁻¹ = e (Reidemeister II).
//
// Unlike in the permutation group, σ_i σ_i is not the identity, so the
// apex of a double crossing can only be pulled back when the two
// crossings have opposite signs: the same strand passes over both times.
//
// Which strand passes over is chosen by which strand you drag: the
// dragged strand goes in front. Drag A across B for A over B, or B
// across A for A under B. That gives a gesture for every crossing with
// no modifier keys. In the cross-section, a crossing is a half-turn of
// two points around each other, and you choose the direction of the
// turn.
//
// Convention: letters act on *positions*. σ_i crosses the strands in
// rows i and i+1 (0-indexed), and the strand in row i (the upper one,
// before the crossing) passes over when the sign is +1, under when it's
// −1. `permFromWord` applies the letters left to right to the identity;
// the result lists the strand in each row at the right end.
//
// ## Closure
//
// Closed up, each strand's right end loops around below the diagram and
// back to its left end, and the braid is drawn as a link, its closure.
// By Markov's theorem, two braids close up to the same link exactly when
// they're related by the braid relations and two more moves, which the
// closure adds:
//
// - conjugation, β ~ αβα⁻¹: the last crossing can be dragged on around
//   its loop and in at the front, or the first one back around to the
//   end. With the cancelling pairs, that makes every conjugation.
// - stabilization, β ~ β σ_n^{±1} ∈ B_{n+1}: the bottom strand can be
//   pulled down at the right end of the diagram into a new strand, with
//   a new loop, that it crosses once at the end of the word (σ_n): a
//   Reidemeister I kink in the closure. Pulled down at the left end, the
//   crossing goes at the front instead (σ_n⁻¹, which conjugation can take
//   around to the end). Pulling that innermost loop back in is
//   destabilization.
//
// Strands are colored by the link component they belong to, and the
// colors are kept in the state, so a move that renumbers the strands
// (they're numbered by row at the left end) keeps them.

type Sign = 1 | -1;

/** σ_i^sign. */
type Letter = { i: number; sign: Sign };

/** A column of the diagram: a letter, or a gap standing in for one, or
 * a crossing in progress.
 *
 * Gaps only exist mid-drag. Cancelling σ_i σ_i⁻¹ first turns the two
 * columns *blank* (full width, no crossing: nothing to the right shifts
 * while you drag), then the drop *closes* them (zero width, so the drop
 * animation is a plain horizontal slide of everything to their right).
 * Inserting σ_i σ_i⁻¹ runs the same in reverse, from two closed columns.
 * A gap remembers the letter it stands in for, so the two strands that
 * crossed there keep a (flat) piece each; see `wirePieces`.
 * In a gap, `sign` says which row's strand passes over, so both gaps of
 * a pair carry the sign of the pair's first letter (nothing swaps in a
 * gap, so the same strand is in the same row at both). Closed columns
 * are dropped from the logical word as soon as the next interaction
 * builds a new state.
 *
 * A *pending* column is a crossing `p` of the way done (0 to 1): its two
 * strands have moved `p` of the way across to each other's rows, and the
 * column is that fraction of its width. (`p` is measured in rows, not
 * turn angle, so that a strand's end moves steadily with it: under an
 * angle, it barely moves at the start and end of the turn, and dragging
 * it stalls there and then lurches.) It's only ever the last column,
 * while you turn one strand around another at the end.
 *
 * A *flat* letter is a crossing with no width, which swaps its strands
 * all the same. It's only ever the first letter, starting a
 * stabilization at the front of the word (see `stabilizeSpec`), where
 * the strands have to be numbered as they will be once it's in. */
type Col = Letter & {
  gap?: "blank" | "closed" | "pending";
  p?: number;
  flat?: true;
};

const isLetter = (c: Col) => c.gap === undefined;
const isClosed = (c: Col) => c.gap === "closed";
const isPending = (c: Col) => c.gap === "pending";
/** Is the column part of the logical word (as a letter or a blank)? */
const inWord = (c: Col) => !isClosed(c) && !isPending(c);

type State = {
  n: number;
  word: Col[];
  /** Layout hint for the diagram: draw strands with one piece per column
   * instead of one per crossing (see `wirePieces`), for a braid
   * move on the letters starting at `braid`. Set on both ends of a
   * braid-move drag; dropped, like closed columns, as soon as the next
   * interaction builds a new state. */
  wiresByColumn?: { braid: number };
  /** Where the pointer is along the diagram, when it's over it: the
   * cross-section shows that moment. */
  hoverX?: number;
  /** Also mark that moment on the diagram, with a line and the points
   * where it cuts the strands. (A display option, set from outside.) */
  showMoment?: boolean;
  /** Draw the closure, with the Markov moves. */
  closure?: true;
  /** The color of each strand's component, for the closure; see
   * `recolor`. */
  palette?: number[];
  /** Mid-(de)stabilization, at one end of the drag: the last row lies
   * on the one above it, with the strand that runs along it hidden, so
   * that it's drawn the same as the braid without them. */
  newRow?: { strand: number };
  /** Mid-conjugation: the word's last crossing is `t` of the way around
   * its loop to the front (0 to 1), where the word with that crossing
   * moved to the front takes over. `id` is the dragged handle's. Only
   * ever mid-drag; see `orbitSpec`. */
  orbit?: { t: number; id: string };
};

// ## Braid math

/** The strand in each row after `word` (strands are numbered 1..n by
 * their row at the left end). */
function permFromWord(n: number, word: Col[]): number[] {
  const arr = _.range(1, n + 1);
  for (const c of word) {
    if (!isLetter(c)) continue;
    [arr[c.i], arr[c.i + 1]] = [arr[c.i + 1], arr[c.i]];
  }
  return arr;
}

/** The row a strand in row `r` is in after column `c`. */
const rowAfterCol = (r: number, c: Col) =>
  !isLetter(c) || (r !== c.i && r !== c.i + 1) ? r : r === c.i ? c.i + 1 : c.i;

/** For each column, the strands in its two rows (upper, lower) just
 * before it, and which of them passes over. */
function crossings(
  n: number,
  cols: Col[],
): { a: number; b: number; over: number }[] {
  const arr = _.range(1, n + 1);
  return cols.map((c) => {
    const a = arr[c.i];
    const b = arr[c.i + 1];
    if (isLetter(c)) [arr[c.i], arr[c.i + 1]] = [b, a];
    return { a, b, over: c.sign === 1 ? a : b };
  });
}

const pairKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;

/** Is `word[start..start+2]` a braid σ_i^± σ_k^± σ_i^± with |i−k| = 1
 * that Reidemeister III applies to? The three strands must be layered
 * consistently: some strand passes over both of the others (so the
 * over-relation isn't a cycle). The strand that passes by the middle
 * crossing may be the one in between. */
function isBraidAt(n: number, word: Letter[], start: number): boolean {
  if (start < 0 || start + 2 >= word.length) return false;
  const [p, q, r] = word.slice(start, start + 3);
  if (p.i !== r.i || Math.abs(p.i - q.i) !== 1) return false;
  const overs = crossings(n, word)
    .slice(start, start + 3)
    .map((x) => x.over);
  return overs.some((v) => overs.filter((u) => u === v).length === 2);
}

/** Apply the braid move at `word[start..]`: the generators go
 * i k i → k i k, and the signs are set so that each pair of strands
 * keeps the same one on top. */
function braidAt(n: number, word: Letter[], start: number): Letter[] {
  const overOf = new Map(
    crossings(n, word)
      .slice(start, start + 3)
      .map((x) => [pairKey(x.a, x.b), x.over]),
  );
  const [p, q] = word.slice(start, start + 2);
  const w = word.slice();
  w[start] = { i: q.i, sign: 1 };
  w[start + 1] = { i: p.i, sign: 1 };
  w[start + 2] = { i: q.i, sign: 1 };
  const ys = crossings(n, w);
  for (let k = start; k < start + 3; k++) {
    const { a, b } = ys[k];
    w[k] = { i: w[k].i, sign: overOf.get(pairKey(a, b)) === a ? 1 : -1 };
  }
  return w;
}

/** Do consecutive columns `a`, `b` cancel (σ_i σ_i⁻¹, or the two gaps
 * standing in for such a pair)? */
const cancels = (a: Col | undefined, b: Col | undefined) =>
  a !== undefined &&
  b !== undefined &&
  a.i === b.i &&
  (a.gap !== undefined) === (b.gap !== undefined) &&
  (a.gap !== undefined || a.sign !== b.sign);

/** Words reachable from `word` by one relation that moves the crossing
 * at index `j`: a commutation with a neighbor, or a braid move. A braid
 * move is only offered from the middle crossing, which moves one row
 * vertically. The end crossings also change places in a braid move, but
 * each would jump two columns and a row, which doesn't read as dragging
 * that crossing anywhere. (The strand that bypasses the middle crossing
 * can also be dragged across it; see the strand handles.) */
function crossingMoves(
  n: number,
  word: Letter[],
  j: number,
): { word: Letter[]; braid: boolean }[] {
  const i = word[j].i;
  const commutes = (k: number) =>
    k >= 0 && k < word.length && Math.abs(word[k].i - i) >= 2;
  const swapped = (a: number, b: number) => {
    const w = word.slice();
    [w[a], w[b]] = [w[b], w[a]];
    return w;
  };
  const moves: { word: Letter[]; braid: boolean }[] = [];
  if (commutes(j - 1)) moves.push({ word: swapped(j - 1, j), braid: false });
  if (commutes(j + 1)) moves.push({ word: swapped(j, j + 1), braid: false });
  if (isBraidAt(n, word, j - 1))
    moves.push({ word: braidAt(n, word, j - 1), braid: true });
  return moves;
}

/** A color for each strand's link component in the closure (a strand
 * that ends in row r continues as strand r+1), keeping the colors in
 * `hint` where it can: a component takes the hinted color of its
 * lowest-numbered strand, unless an earlier component has it. Gaps count
 * as the letters they stand in for (pairs of them cancel anyway), so
 * mid-drag states are colored like the states they lead to. */
function recolor(n: number, cols: Col[], hint: number[] | undefined) {
  const arr = _.range(1, n + 1);
  for (const c of cols) {
    if (isPending(c) && assertDefined(c.p) <= 0.5) continue;
    [arr[c.i], arr[c.i + 1]] = [arr[c.i + 1], arr[c.i]];
  }
  const palette: number[] = [];
  const used = new Set<number>();
  for (let v = 1; v <= n; v++) {
    if (palette[v - 1] !== undefined) continue;
    const hinted = hint?.[v - 1];
    const color =
      hinted !== undefined && !used.has(hinted)
        ? hinted
        : assertDefined(_.range(COLORS.length).find((k) => !used.has(k)));
    used.add(color);
    for (let u = v; palette[u - 1] === undefined; u = arr.indexOf(u) + 1) {
      palette[u - 1] = color;
    }
  }
  return palette;
}

/** The colors of the strands once letter `x` moves from one end of the
 * word to the other: the two strands in its rows trade numbers. */
function swapColors(palette: number[] | undefined, x: Letter) {
  const p = palette?.slice();
  if (p) [p[x.i], p[x.i + 1]] = [p[x.i + 1], p[x.i]];
  return p;
}

/** The word with its last letter moved to the front, colors and all. */
function rotated(word: Letter[], palette: number[] | undefined) {
  const x = assertDefined(word.at(-1));
  return { word: [x, ...word.slice(0, -1)], palette: swapColors(palette, x) };
}

/** A path of lines and arcs, measured by length along it. */
type Seg =
  | { kind: "line"; a: Vec2; b: Vec2; len: number }
  | { kind: "arc"; c: Vec2; r: number; a0: number; a1: number; len: number };

class Track {
  readonly segs: Seg[] = [];
  length = 0;
  private at0: Vec2;

  constructor(start: Vec2) {
    this.at0 = start;
  }

  private get end(): Vec2 {
    const s = this.segs.at(-1);
    return s ? this.segAt(s, s.len) : this.at0;
  }

  lineTo(b: Vec2) {
    const a = this.end;
    const len = a.dist(b);
    this.segs.push({ kind: "line", a, b, len });
    this.length += len;
    return this;
  }

  /** An arc around `c` from angle a0 to a1 (radians, y down). */
  arc(c: Vec2, r: number, a0: number, a1: number) {
    const len = r * Math.abs(a1 - a0);
    this.segs.push({ kind: "arc", c, r, a0, a1, len });
    this.length += len;
    return this;
  }

  private segAt(s: Seg, d: number): Vec2 {
    if (s.kind === "line") return s.a.lerp(s.b, s.len === 0 ? 0 : d / s.len);
    const a = s.a0 + (s.a1 - s.a0) * (s.len === 0 ? 0 : d / s.len);
    return Vec2(s.c.x + s.r * Math.cos(a), s.c.y + s.r * Math.sin(a));
  }

  at(d: number): Vec2 {
    let rest = _.clamp(d, 0, this.length);
    for (const s of this.segs) {
      if (rest <= s.len) return this.segAt(s, rest);
      rest -= s.len;
    }
    return this.end;
  }

  /** Points along the track from d0 to d1 (d0 ≤ d1): the ends, the
   * corners between, and enough points around arcs to draw them. */
  points(d0: number, d1: number): Vec2[] {
    const pts = [this.at(d0)];
    let start = 0;
    for (const s of this.segs) {
      const lo = Math.max(d0, start);
      const hi = Math.min(d1, start + s.len);
      if (hi > lo && s.kind === "arc") {
        const steps = Math.ceil((hi - lo) / 4);
        for (let k = 1; k < steps; k++) {
          pts.push(this.segAt(s, lo - start + ((hi - lo) * k) / steps));
        }
      }
      if (start + s.len > lo && start + s.len < d1) {
        pts.push(this.segAt(s, s.len));
      }
      start += s.len;
    }
    pts.push(this.at(d1));
    return pts;
  }
}

const polyline = (pts: Vec2[]) => pts.map((p) => `L ${p.x} ${p.y}`).join(" ");

/** The bezier parameter's samples across a crossing drawn along two
 * tracks: how far along it is (`f`) and how far across (`q`), matching
 * the cubic a column draws, from (0, 0) via (½, 0) and (½, 1) to
 * (1, 1). */
const CROSS_SAMPLES = _.range(0, 17).map((k) => {
  const s = k / 16;
  return { f: 1.5 * s * (1 - s) + s * s * s, q: 3 * s * s - 2 * s * s * s };
});

// ## Rendering

const COLORS = [
  { fill: "#fecaca", stroke: "#dc2626" },
  { fill: "#fde68a", stroke: "#d97706" },
  { fill: "#bbf7d0", stroke: "#16a34a" },
  { fill: "#bfdbfe", stroke: "#2563eb" },
  { fill: "#ddd6fe", stroke: "#7c3aed" },
  { fill: "#fbcfe8", stroke: "#db2777" },
];
const colorOf = (v: number) => COLORS[(v - 1) % COLORS.length];

const WIDTH = 680;
const RS = 28; // row spacing
const STROKE = 3;
const GAP = 3; // white gap on each side of an over strand

/** How far through its half-turn a crossing is, `f` of the way across
 * its column, as drawn: each strand's curve is a cubic from (0, y0) via
 * (½, y0) and (½, y1) to (1, y1), so find the curve parameter at x = f,
 * and the angle that puts the strand at that height. */
function thetaAt(f: number): number {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 30; k++) {
    const s = (lo + hi) / 2;
    if (1.5 * s * (1 - s) + s * s * s < f) lo = s;
    else hi = s;
  }
  const s = (lo + hi) / 2;
  const q = 3 * s * s - 2 * s * s * s;
  return Math.acos(_.clamp(1 - 2 * q, -1, 1));
}

/** σ with its index as a subscript and, for an inverse, −1 as a
 * superscript above it, centered at x. */
function letterGlyph(id: string, l: Letter, x: number, opacity: number) {
  const inv = l.sign === -1;
  return (
    <g id={id} transform={translate(x - (inv ? 9 : 6), 0)} opacity={opacity}>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={17}
        fontFamily="Georgia, serif"
        fontStyle="italic"
        fill="#1f2937"
      >
        σ
      </text>
      <text
        transform={translate(6, 6)}
        dominantBaseline="central"
        fontSize={11}
        fontFamily="Georgia, serif"
        fill="#1f2937"
      >
        {l.i + 1}
      </text>
      <text
        transform={translate(6, -7)}
        dominantBaseline="central"
        fontSize={11}
        fontFamily="Georgia, serif"
        fill="#1f2937"
        opacity={inv ? 1 : 0}
      >
        −1
      </text>
    </g>
  );
}

/** Reports where the pointer is over the SVG, in this element's
 * coordinates (or null when it leaves), while no button is down.
 * Draggable elements are layers, pulled out of any group a handler could
 * go on, so this listens on the SVG itself. It ignores moves with a
 * button down, which are drags: mid-drag, this component isn't
 * re-rendered, so `onHover` still closes over the state from before the
 * drag, and setting that state would cut the drag short. */
function HoverTracker({ onHover }: { onHover: (pt: Vec2 | null) => void }) {
  const ref = useRef<SVGGElement>(null);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  useEffect(() => {
    const g = ref.current;
    const svg = g?.ownerSVGElement;
    if (!g || !svg) return;
    const move = (e: PointerEvent) => {
      if (e.buttons !== 0) return;
      const m = g.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      onHoverRef.current(Vec2(p.x, p.y));
    };
    const leave = () => onHoverRef.current(null);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerleave", leave);
    return () => {
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <g ref={ref} />;
}

/** The diagram has a fixed number of columns for a given n, so the
 * column width never changes and transitions stay pure slides. Drags
 * that would append past the last column are refused. */
const colsFor = (n: number) => Math.max(12, 2 * n + 4);

const PANEL_W = 100; // the cross-section's width
// Half the plane's depth, in rows. Depth is foreshortened against rows,
// so this is set to draw a crossing's half-turn (a circle in the plane)
// about 0.8 times as wide as it is tall. (At the depth-0 line, a unit of
// `u` spans 0.96 of the width; see `project`.)
const DEPTH = (0.96 * PANEL_W) / (2 * 0.8 * RS);
/** A turn in the cross-section snaps to its end, and chains on, from
 * this close (in px). */
const SNAP_PX = 4;
const heightFor = (n: number) => 52 + n * RS + 56;

// The closure's loops: each row's runs STUB to the right of the diagram,
// down, back along under it and up its left side, and in. The bottom
// row's loop is innermost and each one above it is LS further out. The
// top corners have radius RT; the bottom ones share their centers. The
// diagram has room for MAX_N rows of loops, so stabilizing never
// changes the layout.
const MAX_N = 6;
const CLOSURE_COLS = 14;
const LS = 12;
const STUB = 14;
const RT = 8;
const RB = 8;
const LOOP_MARGIN = STUB + (MAX_N - 1) * LS + 4;
const CLOSURE_HEIGHT = 52 + (MAX_N - 1) * (RS + LS) + RT + RB + 2 + 16;

const draggable: Draggable<State> = ({
  state: givenState,
  d,
  draggedId,
  setState,
}) => {
  // Past halfway, a conjugation is drawn as the word with the crossing
  // moved to the front, coming in from behind.
  const rawState: State =
    givenState.orbit && givenState.orbit.t >= 0.5
      ? {
          ...givenState,
          ...rotated(givenState.word as Letter[], givenState.palette),
        }
      : givenState;
  const { n, closure, orbit } = rawState;
  // `cols` is the layout (may include zero-width closed columns left by
  // a cancel drop); `word` is the logical word all the math and drag
  // specs use, and `state` is the cleaned state they build on.
  const cols = rawState.word;
  const word: Letter[] = cols
    .filter(inWord)
    .map(({ i, sign }) => ({ i, sign }));
  const palette = closure ? recolor(n, cols, rawState.palette) : undefined;
  const state: State = { n, word, closure, palette };
  const byColumn = (s: State, braid: number): State => ({
    ...s,
    wiresByColumn: { braid },
  });
  const perm = permFromWord(n, word);
  const L = word.length;
  const strandColor = (v: number) =>
    palette ? COLORS[palette[v - 1]] : colorOf(v);
  // (a strand coming out of the row above hides until it's out)
  const strandOpacity = (v: number) => (rawState.newRow?.strand === v ? 0 : 1);

  const COLS = closure ? CLOSURE_COLS : colsFor(n);
  const CAP = COLS - 1; // letters, leaving one spare column
  const canAppend = (k: number) => L + k <= CAP;
  // Full, as shown: a crossing being turned counts once it's past
  // halfway, which is when it's written.
  const full =
    L + (cols.some((c) => isPending(c) && assertDefined(c.p) > 0.5) ? 1 : 0) >=
    CAP;

  // ### Rewrites
  /** Insert the cancelling pair `l`, `l⁻¹` before logical letter k. The
   * drag starts from `withClosedAt`, which has two zero-width columns
   * there and is drawn the same as `state`, so the pair widens from
   * nothing. */
  const withClosedAt = (k: number, l: Letter): State => ({
    ...state,
    word: [
      ...word.slice(0, k),
      { ...l, gap: "closed" },
      { ...l, gap: "closed" },
      ...word.slice(k),
    ],
  });
  const insertAt = (k: number, l: Letter): State => ({
    ...state,
    word: [
      ...word.slice(0, k),
      l,
      { i: l.i, sign: -l.sign as Sign },
      ...word.slice(k),
    ],
  });
  /** Cancel the pair at k, k+1, leaving blanks (drawn flat) so nothing
   * to the right moves mid-drag. Drag with `.onDrop(closeBlanks)`. */
  const gappedAt = (k: number): State => ({
    ...state,
    word: word.map((l, m) =>
      m === k || m === k + 1 ? { ...word[k], gap: "blank" } : l,
    ),
  });
  // blanks become zero-width closed columns, so the drop animation is a
  // horizontal slide
  const closeBlanks = (s: State): State => ({
    ...s,
    word: s.word.map((l) => (l.gap === "blank" ? { ...l, gap: "closed" } : l)),
  });
  /** The letter written when the strand in row `r` crosses into row
   * `r2` (= r ± 1) in front of the strand there. */
  const crossingFrom = (r: number, r2: number): Letter => ({
    i: Math.min(r, r2),
    sign: r < r2 ? 1 : -1,
  });

  // ### Strand handles
  // Where strand `v` can be grabbed, walking the logical word (with
  // blanks kept, for pairing). Handles are placed by logical index `k`,
  // so their ids line up across states with and without closed columns,
  // and each sits at the right edge of its column, in row `row`.
  //
  // - apex: the apex of a cancelling pair at k, k+1; drag it back across
  //   to cancel. (In a longer alternating run, each adjacent pair has
  //   one. The apex of σ_i σ_i is not a handle: that's a full twist, not
  //   the identity.)
  // - blank: where the apex handle lands mid-cancel, over two blank
  //   columns. Not draggable.
  // - straight: a straight bit before column k (or at the end); drag it
  //   across a neighbor to pass in front of it and back. In a braid at
  //   k-1..k+1, one strand crosses both outer crossings and passes
  //   straight by the middle one (in the row of the outer crossings that
  //   the middle one doesn't touch); on that side, dragging it across the
  //   middle crossing is the braid move instead. It lands at the same
  //   column, two rows over, so the handle id carries over.
  type StrandHandle =
    | { kind: "apex"; k: number; row: number }
    | { kind: "blank"; k: number; row: number }
    | {
        kind: "straight";
        k: number;
        row: number;
        braidSide: "above" | "below" | null;
      };
  const wordCols = cols.filter(inWord);
  const strandHandles = (v: number): StrandHandle[] => {
    const handles: StrandHandle[] = [];
    let r = v - 1;
    let k = 0;
    while (k <= L) {
      const col = k < L ? wordCols[k] : undefined;
      const letter = col && isLetter(col) ? word[k] : null;
      const next = letter ? rowAfterCol(r, letter) : r;
      if (letter && next !== r && cancels(col, wordCols[k + 1])) {
        handles.push({ kind: "apex", k, row: next });
        r = next;
        k += 1;
        continue;
      }
      if (col && !isLetter(col) && cancels(col, wordCols[k + 1])) {
        handles.push({ kind: "blank", k, row: r });
        k += 2;
        continue;
      }
      const braidSide =
        letter &&
        isBraidAt(n, word, k - 1) &&
        (r === word[k - 1].i || r === word[k - 1].i + 1) &&
        r !== letter.i &&
        r !== letter.i + 1
          ? r < letter.i
            ? "below"
            : "above"
          : null;
      if (next === r && (canAppend(2) || braidSide)) {
        handles.push({ kind: "straight", k, row: r, braidSide });
      }
      r = next;
      k += 1;
    }
    return handles;
  };

  // ### The diagram
  // (room above for the cross-section's near corner, which the
  // perspective puts above the top row, and around the closure for its
  // loops)
  const diagramOrigin = Vec2(closure ? LOOP_MARGIN + 4 : 48, 52);
  const rawLen = cols.length; // layout columns (incl. blank and closed)
  // (room on the right for the end labels or loops, and the cross-section)
  const rightMargin = closure ? LOOP_MARGIN + 12 : 44;
  const CW = (WIDTH - diagramOrigin.x - rightMargin - PANEL_W - 16) / COLS; // column width
  const wireX0 = 0;
  const wireX1 = wireX0 + COLS * CW;
  // (how far the last row is below the one above it, in rows)
  const grow = rawState.newRow ? 0 : 1;
  const rowY = (r: number) =>
    RS * (Math.min(r, n - 2) + Math.max(0, r - (n - 2)) * grow);

  // #### Loops
  const lastRow = n - 1;
  const yB0 = rowY(lastRow) + RT + RB + 2;
  /** How far row r's loop is outside the innermost one (the bottom
   * row's; mid-stabilization, the bottom two start out together). */
  const loopOff = (r: number) => {
    const l = lastRow - r;
    return (l <= 1 ? l * grow : l - 1 + grow) * LS;
  };
  /** Row r's loop, from (xStart, its row) on the right around to (xEnd,
   * row `rEnd`) on the left. (Only a crossing being turned in the
   * cross-section, at the end of the word, ends strands between rows.
   * Their loops take them back in at the nearest row.) */
  const loopTrack = (r: number, xStart: number, xEnd: number, rEnd = r) => {
    const y = rowY(r);
    const yEnd = rowY(rEnd);
    const off = loopOff(r);
    const xR = wireX1 + STUB + off;
    const xL = wireX0 - STUB - off;
    const yB = yB0 + off;
    const rb = RB + off;
    return new Track(Vec2(xStart, y))
      .lineTo(Vec2(xR - RT, y))
      .arc(Vec2(xR - RT, y + RT), RT, -Math.PI / 2, 0)
      .lineTo(Vec2(xR, yB - rb))
      .arc(Vec2(xR - rb, yB - rb), rb, 0, Math.PI / 2)
      .lineTo(Vec2(xL + rb, yB))
      .arc(Vec2(xL + rb, yB - rb), rb, Math.PI / 2, Math.PI)
      .lineTo(Vec2(xL, yEnd + RT))
      .arc(Vec2(xL + RT, yEnd + RT), RT, Math.PI, (3 * Math.PI) / 2)
      .lineTo(Vec2(xEnd, yEnd));
  };

  // #### Conjugation
  // The crossing on its way around (`orbit`) is drawn along the loops of
  // its two rows, the same distance along each, but it stays in the word
  // as the last letter (before halfway) or the first (after), so that
  // everything else is drawn just as in that word, ids and all: dropped,
  // it slides back into its column. Its loops start at the right edge of
  // the rest of the word. At the front, it has a column of its own
  // (`shift` wide) that opens up as it comes in, pushing the word over.
  const disp = (() => {
    if (!orbit) return null;
    const into = orbit.t >= 0.5;
    const j = into ? 0 : rawLen - 1;
    const { i } = cols[j];
    const restW = (rawLen - 1) * CW;
    const lens = [i, i + 1].map(
      (r) => loopTrack(r, wireX0 + restW, wireX0).length,
    );
    const midLen = (lens[0] + lens[1]) / 2;
    const shift = into ? _.clamp(CW - (1 - orbit.t) * (midLen - CW), 0, CW) : 0;
    const x0 = wireX0 + shift;
    const tracks = [i, i + 1].map((r) => loopTrack(r, x0 + restW, x0));
    const s0 = lens.map((len) => orbit.t * (len - CW));
    /** The crossing drawn along the tracks, from track k to the other. */
    const crossPts = (k: number) =>
      CROSS_SAMPLES.map(({ f, q }) =>
        tracks[k]
          .at(s0[k] + f * CW)
          .lerp(tracks[1 - k].at(s0[1 - k] + f * CW), q),
      );
    const center = tracks[0]
      .at(s0[0] + CW / 2)
      .lerp(tracks[1].at(s0[1] + CW / 2), 0.5);
    // how far along the loops the right edge of the diagram is
    const seam = wireX1 - (x0 + restW);
    return { into, j, i, shift, tracks, s0, crossPts, center, seam };
  })();

  const colW = (j: number) =>
    disp?.into && j === 0
      ? disp.shift
      : j >= rawLen
        ? CW
        : isClosed(cols[j]) || cols[j].flat
          ? 0
          : isPending(cols[j])
            ? assertDefined(cols[j].p) * CW
            : CW;
  const colX = (j: number) =>
    wireX0 +
    _.sum(_.range(Math.min(j, rawLen)).map(colW)) +
    Math.max(0, j - rawLen) * CW;
  const xs = crossings(n, cols);
  /** The right edge of logical column k's layout column. */
  const realCols = _.range(rawLen).filter((j) => inWord(cols[j]));
  const edgeX = (k: number) => colX(k < L ? realCols[k] : rawLen) + CW;

  // Each column with its stable id: the pair of strands in its rows
  // (suffixed if a pair meets twice). Gaps take ids too, so a pair's id
  // survives its cancellation. `j` is the layout column, `jl` the index
  // in the logical word.
  //
  // A crossing's handle is numbered without the closed columns, though:
  // a drag starts from the cleaned state, which has none, and its
  // handle has to be there. (A closed column stays on after a drop,
  // until the next drag.)
  const columns = (() => {
    const numberer = () => {
      const seen = new Set<string>();
      return (a: number, b: number) => {
        let pairId = pairKey(a, b);
        while (seen.has(pairId)) pairId += "x";
        seen.add(pairId);
        return pairId;
      };
    };
    const take = numberer();
    const takeHandle = numberer();
    let jl = 0;
    const out = cols.map((c, j) => ({
      c,
      j,
      jl: inWord(c) ? jl++ : -1,
      pairId: take(xs[j].a, xs[j].b),
      handleId: isClosed(c) ? "" : takeHandle(xs[j].a, xs[j].b),
    }));
    return {
      letters: out.filter(({ c }) => isLetter(c)),
      pending: out.find(({ c }) => isPending(c)),
    };
  })();

  // A strand is drawn as pieces, each a straight run up to a column and
  // then a cubic across it, plus a straight free run to the end. Piece k
  // of a strand interpolates with its piece k, so every drag keeps each
  // strand's number of pieces. Which columns get pieces decides what a
  // drag looks like halfway:
  //
  // - By crossing (the default): one piece per crossing the strand takes
  //   part in, in order. When a crossing commutes past its neighbor, its
  //   piece slides sideways at full height, rather than two columns each
  //   bending halfway. Blank and closed columns get flat pieces, so
  //   cancelling or inserting a pair keeps the same structure.
  // - By column (`wiresByColumn`): one piece per column. In a braid move
  //   the crossings stay in their columns and change rows, so every
  //   column bends at once; halfway, the two outer strands cross
  //   diagonally with the third passing straight through the triple
  //   point.
  //
  // Each piece is its own layer, drawn over a white halo that cuts
  // whatever is below it, so a strand is broken exactly where something
  // in front of it actually passes, at every point of a drag. Pieces
  // stack by `pieceZ`, which has to agree at both ends of every drag
  // (the stacking isn't blended; it switches from one end's to the
  // other's partway). A gap column carries the sign of the letter it
  // stands in for, so it stacks like that letter; that's why appending
  // and undoing at the end go through a closed column too.
  const HALO = STROKE + 2 * GAP;

  // In the braid's three columns, the three strands stack by how many of
  // the other two each passes over (a braid move only applies when that
  // is a consistent order), which is the same at both ends of the move.
  // Elsewhere, the strand on top of a column's crossing is raised.
  const braidWindow = rawState.wiresByColumn
    ? _.range(rawState.wiresByColumn.braid, rawState.wiresByColumn.braid + 3)
    : [];
  const braidStrands = new Set(braidWindow.flatMap((j) => [xs[j].a, xs[j].b]));
  const braidRank = _.countBy(braidWindow.map((j) => xs[j].over));
  const pieceZ = (v: number, j: number) =>
    braidWindow.includes(j) && braidStrands.has(v)
      ? (braidRank[v] ?? 0)
      : j < rawLen && xs[j].over === v
        ? 1
        : 0;

  /** Strand v's pieces, and the row it ends in (between rows mid-turn). */
  const wirePieces = (v: number) => {
    const pieces: { key: string; d: string; z: number }[] = [];
    let r = v - 1;
    // the path since the last piece
    let from = `M ${closure ? wireX0 : wireX0 - 14} ${rowY(r)}`;
    const push = (d: string, z: number) =>
      pieces.push({ key: String(pieces.length), d, z });
    // (set once the strand is on a loop, past the conjugated crossing)
    let onTrack: Track | null = null;
    let trackFrom = 0;
    for (const [j, c] of cols.entries()) {
      if (!rawState.wiresByColumn && r !== c.i && r !== c.i + 1) continue;
      // (a pending crossing ends partway, where its half-turn has got to)
      const r1 = isPending(c)
        ? r +
          (rowAfterCol(r, { ...c, gap: undefined }) - r) * assertDefined(c.p)
        : rowAfterCol(r, c);
      const z = pieceZ(v, j);
      if (disp && j === disp.j) {
        const k = r === disp.i ? 0 : 1;
        const other = disp.tracks[1 - k];
        const pts = disp.crossPts(k);
        const after = disp.s0[1 - k] + CW;
        if (disp.into) {
          // just the crossing, then on around the loop to the next piece
          push(`M ${pts[0].x} ${pts[0].y} ${polyline(pts.slice(1))}`, z);
          from = `M ${pts.at(-1)!.x} ${pts.at(-1)!.y} ${polyline(other.points(after, other.length))}`;
        } else {
          // the run out along the loop to the crossing, and the crossing
          const run = disp.tracks[k].points(0, disp.s0[k]);
          push(`${from} ${polyline(run)} ${polyline(pts)}`, z);
          from = `M ${pts.at(-1)!.x} ${pts.at(-1)!.y}`;
          onTrack = other;
          trackFrom = after;
        }
        r = r1;
        continue;
      }
      const x = colX(j);
      const w = colW(j);
      const y0 = rowY(r);
      const y1 = rowY(r1);
      push(
        `${from} L ${x} ${y0} C ${x + w / 2} ${y0} ${x + w / 2} ${y1} ${x + w} ${y1}`,
        z,
      );
      from = `M ${x + w} ${y1}`;
      r = r1;
    }
    // (keyed apart from the column pieces, so that a column piece added
    // at the end doesn't take over the free run)
    pieces.push({
      key: "free",
      d: onTrack
        ? `${from} ${polyline(onTrack.points(trackFrom, Math.max(trackFrom, disp!.seam)))}`
        : `${from} L ${closure ? wireX1 : wireX1 + 14} ${rowY(r)}`,
      z: 0,
    });
    return { pieces, endRow: r };
  };

  /** The closure's loop out of row r (at the right; between rows
   * mid-turn), on to its left end. */
  const loopPath = (r: number) => {
    const k = disp ? r - disp.i : -1;
    let pts: Vec2[];
    if (disp && (k === 0 || k === 1)) {
      const tr = disp.tracks[k];
      const s = disp.s0[k];
      pts = disp.into
        ? tr.points(disp.seam, Math.max(disp.seam, s))
        : tr.points(Math.max(disp.seam, s + CW), tr.length);
    } else {
      const tr = loopTrack(r, wireX1, wireX0, Math.round(r));
      pts = tr.points(0, tr.length);
    }
    return `M ${pts[0].x} ${pts[0].y} ${polyline(pts.slice(1))}`;
  };

  // ### Cross-section
  //
  // The braid lives in 3D: time runs left to right, rows top to bottom,
  // and depth toward the viewer, who sees the diagram from the front. At
  // each moment the strands are points in the (row, depth) plane. A
  // crossing is a half-turn of its two points around their midpoint, the
  // over strand passing in front; `configAt` times the turn to match the
  // drawn curves, so the points' rows are where the strands cross the
  // vertical line at x.
  const configAt = (x: number) => {
    const arr = _.range(1, n + 1); // the strand in each row
    let turning: { j: number; theta: number } | null = null;
    for (let j = 0; j < rawLen; j++) {
      const c = cols[j];
      const x0 = colX(j);
      if (x < x0) break;
      if (isPending(c)) {
        turning = { j, theta: Math.acos(1 - 2 * assertDefined(c.p)) };
        break;
      }
      if (!isLetter(c)) continue;
      if (disp && !disp.into && j === disp.j) {
        // (the crossing going out around the loops is only as far through
        // as it has got by the right edge)
        const done = _.clamp((disp.seam - _.mean(disp.s0)) / CW, 0, 1);
        if (done < 1) {
          turning = { j, theta: thetaAt(done) };
          break;
        }
      }
      if (x >= x0 + colW(j)) {
        [arr[c.i], arr[c.i + 1]] = [arr[c.i + 1], arr[c.i]];
        continue;
      }
      turning = { j, theta: thetaAt((x - x0) / colW(j)) };
      break;
    }
    const pos = new Map<number, { row: number; depth: number }>();
    arr.forEach((v, r) => pos.set(v, { row: r, depth: 0 }));
    if (turning) {
      const { i } = cols[turning.j];
      const { over } = xs[turning.j];
      const cos = Math.cos(turning.theta);
      const sin = Math.sin(turning.theta);
      [arr[i], arr[i + 1]].forEach((v, k) =>
        pos.set(v, {
          row: i + 0.5 + (k === 0 ? -0.5 : 0.5) * cos,
          depth: (v === over ? 0.5 : -0.5) * sin,
        }),
      );
    }
    return pos;
  };
  const endConfig = configAt(Infinity);
  const shownConfig =
    rawState.hoverX === undefined ? endConfig : configAt(rawState.hoverX);

  // The plane is drawn in perspective, turned so its front edge (toward
  // the viewer) is on the right and nearer, its back on the left,
  // foreshortened. The depth-0 line is drawn at full scale, so resting
  // points line up with the strands' rows.
  const panelX = wireX1 + rightMargin;
  const PERSPECTIVE = 0.5;
  const midY = (rowY(0) + rowY(lastRow)) / 2;
  /** Where height y (as in the diagram) at a depth is drawn. */
  const project = (y: number, depth: number) => {
    const u = 0.5 - depth / (2 * DEPTH); // 0 front, 1 back
    const s = (1 + PERSPECTIVE / 2) / (1 + PERSPECTIVE * u);
    return {
      pos: Vec2(
        panelX +
          PANEL_W -
          (PANEL_W * u * (1 + PERSPECTIVE)) / (1 + PERSPECTIVE * u),
        midY + (y - midY) * s,
      ),
      scale: s,
    };
  };

  // Turn drags hold the pointer's x within the snap radius of the line
  // the points rest on: enough to say which way around, and close
  // enough that at the end of a turn (where the arc comes in sideways,
  // so the point lags a pointer held out to the side) the point still
  // snaps to the end and chains on.
  const restX = diagramOrigin.x + project(0, 0).pos.x;
  const arcX0 = restX - SNAP_PX;
  const arcX1 = restX + SNAP_PX;

  // Turning a point in the cross-section writes a crossing at the end of
  // the word. The turn's progress is the pending column's `p`: dropping
  // past halfway commits it, and reaching the end snaps to it and
  // chains into the written word, so one drag can keep turning.
  // (Turning back the way the last crossing went writes its inverse.)
  const turnSpec = (v: number, r2: number, front: boolean) => {
    if (!canAppend(1)) return null;
    const row = perm.indexOf(v);
    const l: Letter = {
      i: Math.min(row, r2),
      sign: row < r2 === front ? 1 : -1,
    };
    const k = L;
    const turning: State = {
      ...state,
      word: [...word, { ...l, gap: "pending", p: 0 }],
    };
    const done: State = { ...state, word: [...word, l] };
    return d
      .vary(turning, [param("word", k, "p")], {
        constraint: (s) => inOrder([0, assertDefined(s.word[k].p), 1]),
      })
      .onDrop((s) => (assertDefined(s.word[k].p) > 0.5 ? done : state))
      .withSnapRadius(SNAP_PX, { chain: true });
  };

  // ### Markov moves
  /** Conjugate by dragging crossing `id`, the last letter of `sWord`
   * (colored by `sPalette`), around its loops, starting `t` of the way
   * from the end of the word (0) to the front (1). Dropped, it goes to
   * whichever is nearer. */
  const orbitSpec = (
    sWord: Letter[],
    sPalette: number[] | undefined,
    t: number,
    id: string,
  ) =>
    d
      .vary(
        { ...state, word: sWord, palette: sPalette, orbit: { t, id } },
        param("orbit", "t"),
        { constraint: (s) => inOrder([0, assertDefined(s.orbit).t, 1]) },
      )
      .onDrop(({ orbit: o, ...s }) =>
        assertDefined(o).t < 0.5
          ? s
          : { ...s, ...rotated(s.word as Letter[], s.palette) },
      );

  // Stabilizing pulls the bottom strand down, at either end of the
  // braid, into a new row and around a new innermost loop, crossing the
  // new strand coming out of it at that end of the word. The strand
  // pulled passes in front: at the right end, the one going into the new
  // row (σ_n, appended); at the left end, the new one coming out of it
  // (σ_n⁻¹, prepended). It starts from a state drawn just like this one,
  // with the new row (and its loop) on top of the bottom one, its strand
  // hidden, and the crossing in a column with no width: closed at the
  // end, flat at the front (where it renumbers the strands).
  // Destabilizing undoes that kink, Reidemeister I style, by pulling the
  // innermost loop back in, when the bottom row's strand crosses only
  // once, at either end of the word. (It doesn't matter which strand
  // passes in front.)
  const stabilizeSpec = (atEnd: boolean) => {
    if (!palette || n >= MAX_N || !canAppend(1)) return null;
    const l: Letter = { i: n - 1, sign: atEnd ? 1 : -1 };
    const color = palette[(atEnd ? perm[n - 1] : n) - 1];
    const grown: State = {
      ...state,
      n: n + 1,
      word: atEnd ? [...word, l] : [l, ...word],
      palette: [...palette, color],
    };
    const start: State = {
      ...grown,
      word: atEnd
        ? [...word, { ...l, gap: "closed" }]
        : [{ ...l, flat: true }, ...word],
      newRow: { strand: atEnd ? n + 1 : n },
    };
    return d.between([start, grown]).onDrop((s) => (s.newRow ? state : s));
  };
  /** Which end of the word the bottom row's only crossing is at, if it
   * has only one, at an end. */
  const kinkEnd = (() => {
    if (!palette || n < 2) return null;
    const ks = _.range(L).filter((k) => word[k].i === n - 2);
    return ks.length !== 1
      ? null
      : ks[0] === L - 1
        ? "end"
        : ks[0] === 0
          ? "front"
          : null;
  })();
  const destabilizeSpec = () => {
    if (!palette || kinkEnd === null) return null;
    const atEnd = kinkEnd === "end";
    const k = atEnd ? L - 1 : 0;
    const shrunk: State = {
      ...state,
      word: word.map((l, m) =>
        m !== k ? l : atEnd ? { ...l, gap: "closed" } : { ...l, flat: true },
      ),
      newRow: { strand: atEnd ? n : n - 1 },
    };
    const gone: State = {
      ...state,
      n: n - 1,
      word: atEnd ? word.slice(0, -1) : word.slice(1),
      palette: palette.slice(0, -1),
    };
    return d.between([state, shrunk]).onDrop((s) => (s.newRow ? gone : s));
  };

  // Hover highlights on handles, but not mid-drag, when other handles
  // pass under the pointer. (Handles are layers, lifted out of any group
  // a class could go on, so each one carries it.)
  const hitClass = draggedId === null ? "braid-hit" : undefined;

  // ### Word
  // One letter under each crossing (over it, in the closure, whose loops
  // are underneath), so letters travel with their crossings.
  const wordY = closure ? -34 : rowY(n - 1) + 34;

  const strands = _.range(1, n + 1).map((v) => ({ v, ...wirePieces(v) }));

  return (
    <g>
      <style>{`
        .braid-hit:hover { opacity: 0.35 !important; }
        .braid-pt:hover .braid-pt-halo { opacity: 0.35 !important; }
      `}</style>
      {/* ## Diagram */}
      <g transform={translate(diagramOrigin)}>
        {/* in the closure, a faint box marks off the braid from its loops */}
        {closure && (
          <rect
            transform={translate(wireX0, rowY(0) - 0.5 * RS)}
            width={wireX1 - wireX0}
            height={rowY(lastRow) - rowY(0) + 0.9 * RS}
            rx={4}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={1}
          />
        )}
        {/* (in the closure, the strands' ends are joined, and their
            numbers don't say much) */}
        {!closure &&
          _.range(1, n + 1).map((v) => (
            <g>
              <text
                transform={translate(wireX0 - 22, rowY(v - 1))}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fill="#6b7280"
                fontFamily="system-ui, sans-serif"
              >
                {v}
              </text>
              {/* the strand's end label (moving with a crossing being
                turned in the cross-section) */}
              <text
                id={`wire-end-${v}`}
                transform={translate(wireX1 + 22, rowY(endConfig.get(v)!.row))}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={600}
                fill={colorOf(v).stroke}
                fontFamily="system-ui, sans-serif"
              >
                {v}
              </text>
            </g>
          ))}
        {strands.flatMap(({ v, pieces }) =>
          // (each level's halos go below all of its strokes, so a piece's
          // halo doesn't nick the end of the piece before it)
          pieces.flatMap(({ key, d: path, z }) => [
            <path
              id={`wire-${v}-${key}-halo`}
              dragologyZIndex={2 * z}
              d={path}
              fill="none"
              stroke="white"
              strokeWidth={HALO}
              strokeLinecap="butt"
              opacity={strandOpacity(v)}
            />,
            <path
              id={`wire-${v}-${key}`}
              dragologyZIndex={2 * z + 1}
              d={path}
              fill="none"
              stroke={strandColor(v).stroke}
              strokeWidth={STROKE}
              strokeLinecap="round"
              opacity={strandOpacity(v)}
            />,
          ]),
        )}
        {/* the closure's loops, each keyed by the row it leaves from (the
            nearest, mid-turn) and colored by the strand it continues. (A
            crossing on its way around the loops is drawn in a strand
            piece, so the loops themselves never cross.) */}
        {closure &&
          strands.flatMap(({ v, endRow }) => {
            const r = Math.round(endRow);
            const path = loopPath(endRow);
            return [
              <path
                id={`loop-${r}-halo`}
                d={path}
                fill="none"
                stroke="white"
                strokeWidth={HALO}
                strokeLinecap="butt"
                opacity={strandOpacity(v)}
              />,
              <path
                id={`loop-${r}`}
                dragologyZIndex={1}
                d={path}
                fill="none"
                stroke={strandColor(v).stroke}
                strokeWidth={STROKE}
                strokeLinecap="round"
                opacity={strandOpacity(v)}
              />,
            ];
          })}
        {/* crossing handles: commute past a neighbor, or (the middle
            crossing of a braid) move a row */}
        {columns.letters.map(({ c, j, jl, handleId }) => {
          // (the crossing on its way around the loops keeps the dragged
          // handle's id, which another crossing of the word it's drawn
          // in might have)
          const id =
            disp && j === disp.j
              ? assertDefined(orbit).id
              : `cross-${handleId}${orbit?.id === `cross-${handleId}` ? "-o" : ""}`;
          const moves = crossingMoves(n, word, jl);
          // In the closure, the last crossing can go on around its loops
          // to the front, and the first one back around to the end.
          const orbits = !palette
            ? []
            : [
                jl === L - 1 && orbitSpec(word, palette, 0, id),
                jl === 0 &&
                  L > 1 &&
                  orbitSpec(
                    [...word.slice(1), c],
                    swapColors(palette, c),
                    1,
                    id,
                  ),
              ].filter((s) => s !== false);
          const center =
            disp && j === disp.j
              ? disp.center
              : Vec2(colX(j) + CW / 2, (rowY(c.i) + rowY(c.i + 1)) / 2);
          const stuck = moves.length === 0 && orbits.length === 0;
          return (
            <g
              id={id}
              transform={translate(center)}
              dragologyZIndex={6}
              dragologyOnDrag={() =>
                stuck
                  ? d.fixed(state)
                  : d.closest([
                      ...moves.map(({ word: w, braid }) => {
                        const moved = { ...state, word: w };
                        return braid
                          ? d.between([
                              byColumn(state, jl - 1),
                              byColumn(moved, jl - 1),
                            ])
                          : d.between([state, moved]);
                      }),
                      ...orbits,
                    ])
              }
              style={{ cursor: stuck ? "not-allowed" : "grab" }}
            >
              <circle
                r={Math.min(CW, RS) / 2 - 1}
                fill={stuck ? "#9ca3af" : "#2563eb"}
                opacity={draggedId === id ? 0.35 : 0}
                className={hitClass}
              />
            </g>
          );
        })}
        {/* strand handles (see `strandHandles`) */}
        {_.range(1, n + 1).map((v) => (
          <g dragologyKey={`strand-handles-${v}`}>
            {strandHandles(v).map((h) => {
              const id = `strand-${v}-${h.k}`;
              const at = translate(edgeX(h.k), rowY(h.row));
              if (h.kind === "blank") return <g id={id} transform={at} />;
              if (h.kind === "apex") {
                return (
                  <g
                    id={id}
                    transform={at}
                    dragologyZIndex={6}
                    dragologyOnDrag={() =>
                      d.between([state, gappedAt(h.k)]).onDrop(closeBlanks)
                    }
                    style={{ cursor: "ns-resize" }}
                  >
                    <rect
                      transform={translate(-RS * 0.35, -RS * 0.35)}
                      width={RS * 0.7}
                      height={RS * 0.7}
                      rx={4}
                      fill="#dc2626"
                      opacity={draggedId === id ? 0.35 : 0}
                      className={hitClass}
                    />
                  </g>
                );
              }
              // A straight bit. A hop starts from a state with two
              // zero-width columns here (drawn identically to the current
              // state), so the pair widens from nothing and everything to
              // the right slides over, instead of columns morphing in
              // place. The handle sits at the column's right edge, which
              // is where the new apex ends up, so the drag is purely
              // vertical; the hit rect covers the column.
              const { k, row: r, braidSide } = h;
              return (
                <g
                  id={id}
                  transform={at}
                  dragologyZIndex={6}
                  dragologyOnDrag={() => {
                    const braided = () =>
                      d.between([
                        byColumn(state, k - 1),
                        byColumn(
                          { ...state, word: braidAt(n, word, k - 1) },
                          k - 1,
                        ),
                      ]);
                    const hop = (r2: number) => {
                      const l = crossingFrom(r, r2);
                      return d.between([withClosedAt(k, l), insertAt(k, l)]);
                    };
                    // The branches only trade places where the strand
                    // crosses its start row, where both look like `state`,
                    // so switch instantly: their wire paths have different
                    // segment structures (zero-width columns on different
                    // wires, or by-column layout), and blending them
                    // kinks the neighbors.
                    return d
                      .closest([
                        braidSide === "above"
                          ? braided()
                          : r > 0 && canAppend(2) && hop(r - 1),
                        braidSide === "below"
                          ? braided()
                          : r < n - 1 && canAppend(2) && hop(r + 1),
                      ])
                      .withBranchTransition(false);
                  }}
                  style={{ cursor: "ns-resize" }}
                >
                  <rect
                    transform={translate(-CW * 0.9, -RS * 0.3)}
                    width={CW * 0.8}
                    height={RS * 0.6}
                    rx={4}
                    fill="#dc2626"
                    opacity={draggedId === id ? 0.35 : 0}
                    className={hitClass}
                  />
                </g>
              );
            })}
          </g>
        ))}
        {/* the stabilization handles, at each end of the bottom row, and
            the destabilization one, along the bottom of the innermost loop
            (there even when they can't be dragged, as where the dragged
            one lands) */}
        {palette &&
          [true, false].map((atEnd) => {
            const id = atEnd ? "curl-right" : "curl-left";
            const stabilize = stabilizeSpec(atEnd);
            // (on the left, clear of the first column's handles)
            const [x0, x1] = atEnd ? [-CW * 0.7, STUB - 2] : [-STUB + 2, 4];
            return (
              <g
                id={id}
                transform={translate(atEnd ? wireX1 : wireX0, rowY(lastRow))}
                dragologyZIndex={6}
                dragologyOnDrag={stabilize ? () => stabilize : undefined}
                style={{ cursor: stabilize ? "ns-resize" : undefined }}
              >
                <rect
                  transform={translate(x0, -RS * 0.3)}
                  width={x1 - x0}
                  height={RS * 0.6}
                  rx={4}
                  fill="#dc2626"
                  opacity={draggedId === id ? 0.35 : 0}
                  className={stabilize ? hitClass : undefined}
                />
              </g>
            );
          })}
        {palette &&
          (() => {
            const destabilize = destabilizeSpec();
            const x0 = wireX0 - STUB + RB;
            const x1 = wireX1 + STUB - RB;
            return (
              <g
                id="inner-loop"
                transform={translate((x0 + x1) / 2, yB0)}
                dragologyZIndex={6}
                dragologyOnDrag={destabilize ? () => destabilize : undefined}
                style={{ cursor: destabilize ? "ns-resize" : undefined }}
              >
                <rect
                  transform={translate(-(x1 - x0) / 2, -LS * 0.4)}
                  width={x1 - x0}
                  height={LS * 0.8}
                  rx={4}
                  fill="#dc2626"
                  opacity={draggedId === "inner-loop" ? 0.35 : 0}
                  className={destabilize ? hitClass : undefined}
                />
              </g>
            );
          })()}
      </g>
      {/* ## Word, by the crossings */}
      <g transform={translate(diagramOrigin.add(Vec2(0, wordY)))}>
        <text
          transform={translate(-30, 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={17}
          fontFamily="Georgia, serif"
          fontStyle="italic"
          fill="#1f2937"
        >
          β
        </text>
        {L === 0 && !columns.pending && (
          <text
            transform={translate(CW / 2, 0)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={17}
            fontFamily="Georgia, serif"
            fontStyle="italic"
            fill="#9ca3af"
          >
            e
          </text>
        )}
        {columns.letters.map(({ c, j, pairId }) =>
          disp && j === disp.j
            ? // (fading out as the crossing leaves the diagram for the
              // loops)
              letterGlyph(
                `word-letter-${pairId}`,
                c,
                disp.center.x,
                _.clamp(
                  1 -
                    Math.max(
                      wireX0 - disp.center.x,
                      disp.center.x - wireX1,
                      Math.abs(disp.center.y - (rowY(c.i) + rowY(c.i + 1)) / 2),
                    ) /
                      16,
                  0,
                  1,
                ),
              )
            : letterGlyph(
                `word-letter-${pairId}`,
                c,
                colX(j) + CW / 2,
                c.flat ? 0 : 1,
              ),
        )}
        {/* a crossing in progress fades in as it turns */}
        {columns.pending &&
          letterGlyph(
            `word-letter-${columns.pending.pairId}`,
            columns.pending.c,
            colX(columns.pending.j) + colW(columns.pending.j) / 2,
            assertDefined(columns.pending.c.p),
          )}
      </g>
      {/* ## Cross-section */}
      <g transform={translate(diagramOrigin)}>
        {(() => {
          const top = rowY(0) - 0.75 * RS;
          const bottom = rowY(lastRow) + 0.75 * RS;
          const corners = [
            project(top, DEPTH).pos,
            project(top, -DEPTH).pos,
            project(bottom, -DEPTH).pos,
            project(bottom, DEPTH).pos,
          ];
          // When the diagram has no column left for another crossing, the
          // points can't be turned: the plane turns amber and says so.
          const below = Vec2(
            panelX + PANEL_W / 2,
            Math.max(corners[2].y, corners[3].y) + 16,
          );
          return (
            <g>
              <path
                d={`M ${corners.map((c) => `${c.x} ${c.y}`).join(" L ")} Z`}
                fill={full ? "#fff7ed" : "#f8fafc"}
                stroke={full ? "#fb923c" : "#cbd5e1"}
                strokeWidth={full ? 1.5 : 1}
              />
              <g
                transform={translate(below)}
                opacity={full ? 1 : 0}
                fontFamily="system-ui, sans-serif"
                fontSize={11}
                textAnchor="middle"
              >
                <text fontWeight={600} fill="#c2410c">
                  Braid is full
                </text>
              </g>
              {_.range(n).map((r) => (
                <line
                  dragologyKey={`grid-${r}`}
                  {...project(rowY(r), DEPTH).pos.xy1()}
                  {...project(rowY(r), -DEPTH).pos.xy2()}
                  opacity={strandOpacity(r + 1)}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
              ))}
              <line
                {...project(top, 0).pos.xy1()}
                {...project(bottom, 0).pos.xy2()}
                stroke="#cbd5e1"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            </g>
          );
        })()}
        {/* the points: drag one around a neighbor, in front or behind, to
            add that crossing */}
        {_.range(1, n + 1).map((v) => {
          const id = `pt-${v}`;
          const { row, depth } = shownConfig.get(v)!;
          const { pos, scale } = project(rowY(row), depth);
          return (
            <g
              id={id}
              transform={translate(pos)}
              opacity={strandOpacity(v)}
              dragologyZIndex={draggedId === id ? 8 : 7}
              dragologyOnDrag={() => {
                const r = perm.indexOf(v);
                return d
                  .closest(
                    [true, false].flatMap((front) => [
                      r > 0 && turnSpec(v, r - 1, front),
                      r < n - 1 && turnSpec(v, r + 1, front),
                    ]),
                  )
                  .changeFrame(({ pointer }) => ({
                    pointer: Vec2(clamp(pointer.x, arcX0, arcX1), pointer.y),
                  }));
              }}
              style={{ cursor: full ? "not-allowed" : "grab" }}
              // (the hover highlight is the halo, but hovering the dot
              // on top of it should count too, so the group takes the
              // hover)
              className={draggedId === null ? "braid-pt" : undefined}
            >
              <circle
                r={11 * scale}
                fill={strandColor(v).fill}
                opacity={draggedId === id ? 0.8 : 0}
                className="braid-pt-halo"
              />
              <circle
                r={6.5 * scale}
                fill={strandColor(v).stroke}
                stroke="white"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
        {/* the moment shown, when hovering */}
        {rawState.hoverX !== undefined && rawState.showMoment && (
          <g
            id="hover-cursor"
            dragologyZIndex={6}
            style={{ pointerEvents: "none" }}
          >
            <line
              x1={rawState.hoverX}
              y1={rowY(-0.7)}
              x2={rawState.hoverX}
              y2={rowY(n - 0.3)}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {_.range(1, n + 1).map((v) => (
              <circle
                transform={translate(
                  rawState.hoverX!,
                  rowY(shownConfig.get(v)!.row),
                )}
                r={4}
                fill={strandColor(v).stroke}
                stroke="white"
                strokeWidth={1.5}
              />
            ))}
          </g>
        )}
        <HoverTracker
          onHover={(pt) => {
            if (draggedId !== null) return;
            const x =
              pt &&
              pt.x >= wireX0 - 14 &&
              pt.x <= wireX1 &&
              pt.y >= rowY(-0.7) &&
              pt.y <= rowY(n - 0.3)
                ? pt.x
                : undefined;
            if (x === rawState.hoverX) return;
            setState({ ...rawState, hoverX: x }, { transition: false });
          }}
        />
      </g>
    </g>
  );
};

/** A braid to start from, with a commutation (σ₁ σ₃⁻¹), a braid move
 * (σ₂ σ₁ σ₂) and, for n ≥ 5, a crossing to drag around, all available
 * right away. With two strands there's only σ₁: a full twist next to a
 * pair that cancels. */
const INITIAL_WORDS: Record<number, [number, Sign][]> = {
  1: [],
  2: [
    [0, 1],
    [0, 1],
    [0, -1],
  ],
  3: [
    [0, 1],
    [1, 1],
    [0, 1],
    [1, -1],
  ],
  4: [
    [0, 1],
    [2, -1],
    [1, 1],
    [0, 1],
    [1, 1],
  ],
  5: [
    [0, 1],
    [2, -1],
    [3, 1],
    [1, 1],
    [0, 1],
    [1, 1],
  ],
  6: [
    [0, 1],
    [2, -1],
    [4, 1],
    [3, 1],
    [1, 1],
    [0, 1],
    [1, 1],
  ],
};
const initialWord = (n: number): Letter[] =>
  INITIAL_WORDS[n].map(([i, sign]) => ({ i, sign }));

/** Closed braids to start from: links drawn with as few strands as they
 * can be, and drawn with more, to be reduced by Markov moves. Letters
 * are generator numbers, negative for inverses. */
const PRESETS: { name: string; reduced: boolean; n: number; word: number[] }[] =
  [
    { name: "unknot", reduced: true, n: 1, word: [] },
    { name: "Hopf link", reduced: true, n: 2, word: [1, 1] },
    { name: "trefoil", reduced: true, n: 2, word: [1, 1, 1] },
    { name: "cinquefoil", reduced: true, n: 2, word: [1, 1, 1, 1, 1] },
    { name: "figure-eight", reduced: true, n: 3, word: [1, -2, 1, -2] },
    {
      name: "Borromean rings",
      reduced: true,
      n: 3,
      word: [1, -2, 1, -2, 1, -2],
    },
    {
      name: "(3, 4) torus knot",
      reduced: true,
      n: 3,
      word: [1, 2, 1, 2, 1, 2, 1, 2],
    },
    // stabilized: destabilize three times
    { name: "unknot", reduced: false, n: 4, word: [1, -2, 3] },
    // σ₁ (σ₁² σ₂) σ₁⁻¹: conjugate, cancel, destabilize
    { name: "Hopf link", reduced: false, n: 3, word: [1, 1, 1, 2, -1] },
    // (σ₁σ₂)²: a braid move, conjugate, destabilize
    { name: "trefoil", reduced: false, n: 3, word: [1, 2, 1, 2] },
    // σ₂ ((σ₁σ₂⁻¹)² σ₃) σ₂⁻¹
    {
      name: "figure-eight",
      reduced: false,
      n: 4,
      word: [2, 1, -2, 1, -2, 3, -2],
    },
  ];
const presetWord = (word: number[]): Letter[] =>
  word.map((g) => ({ i: Math.abs(g) - 1, sign: g > 0 ? 1 : -1 }));

export default demo(
  () => {
    const [n, setN] = useState(4);
    const [closure, setClosure] = useState(false);
    const [preset, setPreset] = useState<number | null>(null);
    const [resetCount, setResetCount] = useState(0);
    const [showMoment, setShowMoment] = useState(false);
    const stateOverride = useMemo(() => ({ showMoment }), [showMoment]);
    const presetButtons = (reduced: boolean) =>
      PRESETS.map((p, k) =>
        p.reduced !== reduced ? null : (
          <button
            key={k}
            className={`text-xs border rounded px-2 py-1 ${
              preset === k
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 bg-white hover:bg-gray-100"
            }`}
            onClick={() => {
              setN(p.n);
              setClosure(true);
              setPreset(k);
              setResetCount((c) => c + 1);
            }}
          >
            {p.name}
            {!reduced && ` (${p.n} strands)`}
          </button>
        ),
      );
    return (
      <div>
        <DemoNotes>
          One braid, as a diagram and as a word in the generators σ<sub>i</sub>,
          with its strands seen end-on alongside. Every drag on the diagram is a
          relation of the braid group, so the braid never changes; only its word
          does. Drag a crossing past a far-away neighbor to commute them. In a
          braid σ<sub>i</sub>σ<sub>j</sub>σ<sub>i</sub> (strands layered
          consistently), drag the middle crossing vertically, or drag the
          bypassing strand across it. Drag a straight bit of strand across its
          neighbor to pass in front of it and back (the strand you drag passes
          in front); drag the apex of such a pair back to cancel it. The apex of
          a <i>full twist</i> σ<sub>i</sub>σ<sub>i</sub> won&apos;t budge: that
          is not the identity here. Hover over the diagram to see the strands as
          points moving in a plane, each crossing a half-turn of two points
          around each other. Add crossings at the end by turning a point around
          its neighbor, in front or behind.
        </DemoNotes>
        <DemoNotes>
          Close the braid up to see it as a link. Every drag on the diagram is
          then a Markov move or a relation, so the link never changes; only its
          braid does. Strands are colored by the component of the link they
          belong to. Drag the last crossing on around its loops and in at the
          front to conjugate (or the first one back around). Pull the bottom
          strand down at either end of the braid to stabilize, adding a strand,
          a loop, and a crossing at that end of the word, where the strand you
          pull passes in front. When the bottom strand crosses only once, at
          either end, pull the innermost loop back in to destabilize.
        </DemoNotes>
        {/* (each row's buttons wrap under each other, beside their label,
            or under it on a narrow screen) */}
        <div className="flex flex-col gap-3 bg-gray-50 rounded p-3 mb-3 text-xs">
          {(
            [
              ["fewest strands:", true],
              ["reducible:", false],
            ] as const
          ).map(([label, reduced]) => (
            <div
              key={label}
              className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2"
            >
              <span className="text-gray-600 sm:w-28 shrink-0">{label}</span>
              <div className="flex flex-wrap gap-2">
                {presetButtons(reduced)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-start gap-6 bg-gray-50 rounded p-3 mb-3 text-xs">
          <ConfigSelect
            label="n"
            value={n}
            onChange={(v) => {
              setN(v);
              setPreset(null);
            }}
            options={[1, 2, 3, 4, 5, 6]}
          />
          <ConfigCheckbox
            label="close the braid"
            value={closure}
            onChange={(v) => {
              setClosure(v);
              setPreset(null);
            }}
          />
          <ConfigCheckbox
            label="show the slice"
            value={showMoment}
            onChange={setShowMoment}
          />
          <button
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-100"
            onClick={() => setResetCount((c) => c + 1)}
          >
            reset
          </button>
        </div>
        <DemoDraggable
          key={`${n}-${closure}-${resetCount}`}
          draggable={draggable}
          initialState={{
            n,
            // start somewhere interesting; reset goes back to the preset, or
            // else to the trivial braid
            word:
              preset !== null
                ? presetWord(PRESETS[preset].word)
                : resetCount === 0
                  ? initialWord(n)
                  : [],
            ...(closure && { closure }),
          }}
          width={WIDTH}
          height={closure ? CLOSURE_HEIGHT : heightFor(n)}
          stateOverride={stateOverride}
        />
      </div>
    );
  },
  {
    fuzz: [2, 3, 4]
      .flatMap((n) => [
        { name: `n${n}`, draggable, initialState: { n, word: initialWord(n) } },
        {
          name: `n${n}-closure`,
          draggable,
          initialState: { n, word: initialWord(n), closure: true as const },
        },
      ])
      .concat(
        [0, 7, 10].map((k) => ({
          name: `preset-${k}`,
          draggable,
          initialState: {
            n: PRESETS[k].n,
            word: presetWord(PRESETS[k].word),
            closure: true as const,
          },
        })),
      ),
    tags: [
      "d.between",
      "d.closest",
      "d.fixed",
      "d.vary",
      "spec.onDrop",
      "spec.withSnapRadius [chain]",
      "spec.changeFrame",
      "math",
    ],
  },
);
