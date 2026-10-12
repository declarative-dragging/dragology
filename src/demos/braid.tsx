import _ from "lodash";
import { useEffect, useRef, useState } from "react";
import { demo } from "../demo";
import { ConfigSelect, DemoDraggable, DemoNotes } from "../demo/ui";
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
 * while you turn one strand around another at the end. */
type Col = Letter & { gap?: "blank" | "closed" | "pending"; p?: number };

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
  /** The last letter is a crossing still being turned in the
   * cross-section, past halfway: the drag that made it can still turn
   * it back. Only means anything mid-drag; see `turnSpec`. */
  open?: true;
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
const heightFor = (n: number) => 52 + n * RS + 56;

const draggable: Draggable<State> = ({
  state: rawState,
  d,
  draggedId,
  setState,
}) => {
  const { n } = rawState;
  // `cols` is the layout (may include zero-width closed columns left by
  // a cancel drop); `word` is the logical word all the math and drag
  // specs use, and `state` is the cleaned state they build on.
  const cols = rawState.word;
  const word: Letter[] = cols
    .filter(inWord)
    .map(({ i, sign }) => ({ i, sign }));
  const state: State = { n, word };
  const byColumn = (s: State, braid: number): State => ({
    ...s,
    wiresByColumn: { braid },
  });
  const perm = permFromWord(n, word);
  const L = word.length;

  const COLS = colsFor(n);
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
  // perspective puts above the top row)
  const diagramOrigin = Vec2(48, 52);
  const rawLen = cols.length; // layout columns (incl. blank and closed)
  // (room on the right for the end labels and the cross-section)
  const CW = (WIDTH - diagramOrigin.x - 44 - PANEL_W - 16) / COLS; // column width
  const wireX0 = 0;
  const wireX1 = wireX0 + COLS * CW;
  const rowY = (r: number) => r * RS;
  const colW = (j: number) =>
    j >= rawLen
      ? CW
      : isClosed(cols[j])
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
  const columns = (() => {
    const seen = new Set<string>();
    const take = (a: number, b: number) => {
      let pairId = pairKey(a, b);
      while (seen.has(pairId)) pairId += "x";
      seen.add(pairId);
      return pairId;
    };
    let jl = 0;
    const out = cols.map((c, j) => ({
      c,
      j,
      jl: inWord(c) ? jl++ : -1,
      pairId: take(xs[j].a, xs[j].b),
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

  const wirePieces = (v: number) => {
    const pieces: { key: string; d: string; z: number }[] = [];
    let r = v - 1;
    let from = `${wireX0 - 14} ${rowY(r)}`;
    const piece = (x: number, w: number, r1: number, z: number) => {
      const y0 = rowY(r);
      const y1 = rowY(r1);
      pieces.push({
        key: String(pieces.length),
        d: `M ${from} L ${x} ${y0} C ${x + w / 2} ${y0} ${x + w / 2} ${y1} ${x + w} ${y1}`,
        z,
      });
      from = `${x + w} ${y1}`;
      r = r1;
    };
    cols.forEach((c, j) => {
      if (!rawState.wiresByColumn && r !== c.i && r !== c.i + 1) return;
      // (a pending crossing ends partway, where its half-turn has got to)
      const r1 = isPending(c)
        ? r +
          (rowAfterCol(r, { ...c, gap: undefined }) - r) * assertDefined(c.p)
        : rowAfterCol(r, c);
      piece(colX(j), colW(j), r1, pieceZ(v, j));
    });
    // (keyed apart from the column pieces, so that a column piece added
    // at the end doesn't take over the free run)
    pieces.push({
      key: "free",
      d: `M ${from} L ${wireX1 + 14} ${rowY(r)}`,
      z: 0,
    });
    return pieces;
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
  const panelX = wireX1 + 44;
  const PERSPECTIVE = 0.5;
  const midRow = (n - 1) / 2;
  const project = (row: number, depth: number) => {
    const u = 0.5 - depth / (2 * DEPTH); // 0 front, 1 back
    const s = (1 + PERSPECTIVE / 2) / (1 + PERSPECTIVE * u);
    return {
      pos: Vec2(
        panelX +
          PANEL_W -
          (PANEL_W * u * (1 + PERSPECTIVE)) / (1 + PERSPECTIVE * u),
        rowY(midRow + (row - midRow) * s),
      ),
      scale: s,
    };
  };

  // How far a turning point swings toward the back and the front, in
  // the pointer's coordinates. Turn drags hold the pointer's x within
  // this, so pulling far to the side doesn't drive the turn.
  const arcX0 = diagramOrigin.x + project(0, -0.5).pos.x;
  const arcX1 = diagramOrigin.x + project(0, 0.5).pos.x;

  // Turning a point in the cross-section writes a crossing at the end of
  // the word. Past halfway the crossing is written, and the drag chains
  // to that state, marked `open`: from there it can turn the crossing
  // back (unwinding it, the only way a panel drag removes a letter), or
  // turn on around a neighbor from the new rows. Turning on settles the
  // open crossing, so turning back after that writes a new one. The
  // chains switch between specs that draw the moment of switching the
  // same, so nothing jumps.
  /** Vary the progress of crossing `l` written after `base`, starting
   * at `p`; dropped short of halfway, it's `settled`. */
  const turnVary = (base: Letter[], l: Letter, p: number, settled: State) => {
    const k = base.length;
    const turning: State = {
      n,
      word: [...base, { ...l, gap: "pending", p }],
    };
    const done: State = { n, word: [...base, l], open: true };
    return d
      .vary(turning, [param("word", k, "p")], {
        constraint: (s) => inOrder([0, assertDefined(s.word[k].p), 1]),
      })
      .onDrop((s) => (assertDefined(s.word[k].p) > 0.5 ? done : settled))
      .withChaining({ transition: false });
  };

  /** The open crossing that dragging point `v` (element `id`) can turn
   * back, if any. Only in a chained drag: a state dropped with the flag
   * still on is settled as far as the next drag goes. */
  const openFor = (v: number, id: string) => {
    if (!rawState.open || draggedId !== id) return undefined;
    const { a, b } = assertDefined(xs.at(-1));
    return v === a || v === b ? word.at(-1) : undefined;
  };

  /** Turn the open crossing `l` back. The optimizer starts at halfway,
   * where the drag chained into the open state, so it starts where the
   * point is. */
  const unwindSpec = (l: Letter) => {
    const prev = word.slice(0, -1);
    return turnVary(prev, l, 0.5, { n, word: prev });
  };

  /** Turn strand `v` half a turn around its neighbor in row `r2`, passing
   * in front of it or behind. (Turning back the way the last crossing
   * went writes its inverse, except while that crossing is `open`: then
   * it would trace the same arc as unwinding it, and the two would trade
   * places at every frame, each trade chaining.) */
  const turnSpec = (
    v: number,
    r2: number,
    front: boolean,
    open: Letter | undefined,
  ) => {
    if (!canAppend(1)) return null;
    const row = perm.indexOf(v);
    const l: Letter = {
      i: Math.min(row, r2),
      sign: row < r2 === front ? 1 : -1,
    };
    if (open && l.i === open.i && l.sign !== open.sign) return null;
    return turnVary(word, l, 0, state);
  };

  // Hover highlights on handles, but not mid-drag, when other handles
  // pass under the pointer. (Handles are layers, lifted out of any group
  // a class could go on, so each one carries it.)
  const hitClass = draggedId === null ? "braid-hit" : undefined;

  // ### Word
  // One letter under each crossing, so letters travel with their
  // crossings.
  const wordY = rowY(n - 1) + 34;

  return (
    <g>
      <style>{`
        .braid-hit:hover { opacity: 0.35 !important; }
      `}</style>
      {/* ## Diagram */}
      <g transform={translate(diagramOrigin)}>
        {_.range(1, n + 1).map((v) => (
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
        {_.range(1, n + 1).flatMap((v) =>
          // (each level's halos go below all of its strokes, so a piece's
          // halo doesn't nick the end of the piece before it)
          wirePieces(v).flatMap(({ key, d: path, z }) => [
            <path
              id={`wire-${v}-${key}-halo`}
              dragologyZIndex={2 * z}
              d={path}
              fill="none"
              stroke="white"
              strokeWidth={HALO}
              strokeLinecap="butt"
            />,
            <path
              id={`wire-${v}-${key}`}
              dragologyZIndex={2 * z + 1}
              d={path}
              fill="none"
              stroke={colorOf(v).stroke}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />,
          ]),
        )}
        {/* crossing handles: commute past a neighbor, or (the middle
            crossing of a braid) move a row */}
        {columns.letters.map(({ c, j, jl, pairId }) => {
          const id = `cross-${pairId}`;
          const moves = crossingMoves(n, word, jl);
          const center = Vec2(colX(j) + CW / 2, (c.i + 0.5) * RS);
          return (
            <g
              id={id}
              transform={translate(center)}
              dragologyZIndex={6}
              dragologyOnDrag={() =>
                moves.length === 0
                  ? d.fixed(state)
                  : d.closest(
                      moves.map(({ word: w, braid }) => {
                        const moved = { ...state, word: w };
                        return braid
                          ? d.between([
                              byColumn(state, jl - 1),
                              byColumn(moved, jl - 1),
                            ])
                          : d.between([state, moved]);
                      }),
                    )
              }
              style={{ cursor: moves.length === 0 ? "not-allowed" : "grab" }}
            >
              <circle
                r={Math.min(CW, RS) / 2 - 1}
                fill={moves.length === 0 ? "#9ca3af" : "#2563eb"}
                opacity={draggedId === id ? 0.35 : 0}
                className={hitClass}
              />
            </g>
          );
        })}
        {/* strand handles (see `strandHandles`) */}
        {_.range(1, n + 1).map((v) => (
          <g>
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
      </g>
      {/* ## Word, under the crossings */}
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
          letterGlyph(`word-letter-${pairId}`, c, colX(j) + CW / 2, 1),
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
          const top = -0.75;
          const bottom = n - 0.25;
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
                  {...project(r, DEPTH).pos.xy1()}
                  {...project(r, -DEPTH).pos.xy2()}
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
          const { pos, scale } = project(row, depth);
          return (
            <g
              id={id}
              transform={translate(pos)}
              dragologyZIndex={draggedId === id ? 8 : 7}
              dragologyOnDrag={() => {
                const r = perm.indexOf(v);
                const open = openFor(v, id);
                return d
                  .closest([
                    // Reaching the end of the turn settles it. (This wins
                    // ties with the other branches there, which all look
                    // the same.)
                    open &&
                      d
                        .fixed(state)
                        .changeGap((g) => g - 1)
                        .withChaining({ transition: false }),
                    open && unwindSpec(open),
                    ...[true, false].flatMap((front) => [
                      r > 0 && turnSpec(v, r - 1, front, open),
                      r < n - 1 && turnSpec(v, r + 1, front, open),
                    ]),
                  ])
                  .changeFrame(({ pointer }) => ({
                    pointer: Vec2(clamp(pointer.x, arcX0, arcX1), pointer.y),
                  }));
              }}
              style={{ cursor: full ? "not-allowed" : "grab" }}
            >
              <circle
                r={11 * scale}
                fill={colorOf(v).fill}
                opacity={draggedId === id ? 0.8 : 0}
                className={hitClass}
              />
              <circle
                r={6.5 * scale}
                fill={colorOf(v).stroke}
                stroke="white"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
        {/* the moment shown, when hovering */}
        {rawState.hoverX !== undefined && (
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
                fill={colorOf(v).stroke}
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

export default demo(
  () => {
    const [n, setN] = useState(4);
    const [resetCount, setResetCount] = useState(0);
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
        <div className="flex flex-wrap items-start gap-6 bg-gray-50 rounded p-3 mb-3 text-xs">
          <ConfigSelect
            label="n"
            value={n}
            onChange={setN}
            options={[2, 3, 4, 5, 6]}
          />
          <button
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-100"
            onClick={() => setResetCount((c) => c + 1)}
          >
            reset
          </button>
        </div>
        <DemoDraggable
          key={`${n}-${resetCount}`}
          draggable={draggable}
          initialState={{
            n,
            // start somewhere interesting; reset goes to the trivial braid
            word: resetCount === 0 ? initialWord(n) : [],
          }}
          width={WIDTH}
          height={heightFor(n)}
        />
      </div>
    );
  },
  {
    fuzz: [2, 3, 4].map((n) => ({
      name: `n${n}`,
      draggable,
      initialState: { n, word: initialWord(n) },
    })),
    tags: [
      "d.between",
      "d.closest",
      "d.fixed",
      "d.vary",
      "spec.withChaining [transition]",
      "spec.onDrop",
      "spec.changeFrame",
      "spec.changeGap",
      "math",
    ],
  },
);
