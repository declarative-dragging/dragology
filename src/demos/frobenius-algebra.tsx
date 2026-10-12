import { produce } from "immer";
import _ from "lodash";
import { useState } from "react";
import { demo } from "../demo";
import { DemoDraggable, DemoNotes } from "../demo/ui";
import { dragSpecToBehavior } from "../DragBehavior";
import { Draggable } from "../draggable";
import { and, DragSpec, DragSpecBuilder, inOrder, param } from "../DragSpec";
import { Vec2 } from "../math/vec2";
import { path, scale, translate } from "../svgx/helpers";

// # Frobenius algebras as direct manipulation
//
// A Frobenius algebra has four generators, drawn as dots on strings
// running top to bottom: multiplication μ (two strings in, one out),
// unit η (none in, one out), comultiplication δ (one in, two out),
// and counit ε (one in, none out). No commutativity, so the strings
// are planar: the two inputs of μ (and the two outputs of δ) are
// ordered left to right. Every drag is an axiom:
//
// - drag a generator vertically past an unrelated one: interchange
//   (`d.vary` on y, with `during` re-laying-out the other levels);
// - drag a μ that feeds another μ sideways across it: associativity
//   (dually for δ: coassociativity). Crossing is detected by a custom
//   spec in a `closest` with the free-move `vary`;
// - drop a unit on the μ it feeds (or the μ on the unit): unit law,
//   both vanish. Dually, counit law for ε and δ;
// - drag the δ of a connected μ–δ pair up past the μ (or the μ down
//   past the δ): the Frobenius law. Which side you cross on picks
//   which of the two zigzag forms you get; crossing back gives the
//   "H" form δ∘μ again.
//
// Each puzzle is a diagram plus a goal diagram; the badge lights up
// when the two are isomorphic as port graphs.

// ## State

type Gen = "mult" | "comult" | "unit" | "counit";

type GenNode = { type: "gen"; gen: Gen; x: number; y: number };
type Boundary = { type: "boundary"; side: "in" | "out"; x: number };
type Node = GenNode | Boundary;

/** Every wire runs from an `out` port (above) to an `in` port (below). */
type Port = { node: string; i: number };
type Wire = { from: Port; to: Port };

type PuzzleId =
  | "unit"
  | "assoc"
  | "frobenius"
  | "snake"
  | "double-snake"
  | "playground";

type State = {
  puzzle: PuzzleId;
  nodes: Record<string, Node>;
  wires: Record<string, Wire>;
};

const ARITY: Record<Gen, { ins: number; outs: number }> = {
  mult: { ins: 2, outs: 1 },
  comult: { ins: 1, outs: 2 },
  unit: { ins: 0, outs: 1 },
  counit: { ins: 1, outs: 0 },
};

const SYMBOL: Record<Gen, string> = {
  mult: "μ",
  comult: "δ",
  unit: "η",
  counit: "ε",
};

// ## Layout constants

const DIAG_W = 320;
const GOAL_W = 150;
const W = DIAG_W + GOAL_W;
const H = 540;
const TOP = 34;
const ROW_H = 52;
const X_MIN = 30;
const X_MAX = DIAG_W - 30;
const DOT_R = 7;
/** horizontal spread between a generator's two input (or output) ports */
const PORT_DX = 9;

const INK = "#374151";

// ## Layout
//
// Generators each get their own level. At rest, levels are
// TOP + ROW_H, TOP + 2*ROW_H, ... in order of y. While one node
// floats (during a drag), the others are laid out as if it weren't
// there, and everything at or below the floater's level is pushed
// down one level to make room.

function genIds(state: State): string[] {
  return Object.keys(state.nodes).filter(
    (id) => state.nodes[id].type === "gen",
  );
}

function relayout(state: State, floatingId?: string): State {
  const others = _.sortBy(
    genIds(state).filter((id) => id !== floatingId),
    (id) => (state.nodes[id] as GenNode).y,
    (id) => id,
  );
  const floater =
    floatingId && state.nodes[floatingId]
      ? (state.nodes[floatingId] as GenNode)
      : undefined;
  return produce(state, (s) => {
    others.forEach((id, slot) => {
      const collapsedY = TOP + (slot + 1) * ROW_H;
      const node = s.nodes[id] as GenNode;
      // Judged against the node's *incoming* y, so a node only swaps
      // sides when the floater passes through where it's drawn.
      const pushed = floater !== undefined && floater.y < node.y;
      node.y = pushed ? collapsedY + ROW_H : collapsedY;
    });
  });
}

function outputY(state: State): number {
  return TOP + (genIds(state).length + 1) * ROW_H;
}

function portPos(state: State, port: Port, kind: "in" | "out"): Vec2 {
  const node = state.nodes[port.node];
  if (node.type === "boundary") {
    return Vec2(node.x, node.side === "in" ? TOP : outputY(state));
  }
  const n = kind === "in" ? ARITY[node.gen].ins : ARITY[node.gen].outs;
  return Vec2(node.x + (port.i - (n - 1) / 2) * PORT_DX, node.y);
}

function wireGeom(state: State, wire: Wire): [Vec2, Vec2, Vec2, Vec2] {
  const a = portPos(state, wire.from, "out");
  const b = portPos(state, wire.to, "in");
  const stiff = Math.max(Math.abs(b.y - a.y) / 2, 20);
  return [a, a.add(Vec2(0, stiff)), b.sub(Vec2(0, stiff)), b];
}

function wirePath(state: State, wire: Wire): string {
  const [p0, p1, p2, p3] = wireGeom(state, wire);
  return path("M", p0, "C", p1, p2, p3);
}

// ## Graph helpers

const samePort = (p: Port, q: Port) => p.node === q.node && p.i === q.i;

/** The wire leaving out-port `i` of `node`. Every port is wired. */
function wireFrom(state: State, node: string, i: number): string {
  const found = Object.keys(state.wires).find((wid) =>
    samePort(state.wires[wid].from, { node, i }),
  );
  if (!found) throw new Error(`no wire from ${node}:out${i}`);
  return found;
}

/** The wire entering in-port `i` of `node`. */
function wireTo(state: State, node: string, i: number): string {
  const found = Object.keys(state.wires).find((wid) =>
    samePort(state.wires[wid].to, { node, i }),
  );
  if (!found) throw new Error(`no wire to ${node}:in${i}`);
  return found;
}

function wiresAt(state: State, nodeId: string): [string, Wire][] {
  return Object.entries(state.wires).filter(
    ([, w]) => w.from.node === nodeId || w.to.node === nodeId,
  );
}

function gen(state: State, id: string): Gen | undefined {
  const n = state.nodes[id];
  return n.type === "gen" ? n.gen : undefined;
}

function nodeY(state: State, id: string): number {
  const n = state.nodes[id];
  return n.type === "gen"
    ? n.y
    : n.side === "in"
      ? TOP - ROW_H
      : outputY(state) + ROW_H;
}

/** Nodes directly above / below `id` along wires. */
function parents(state: State, id: string): string[] {
  return wiresAt(state, id)
    .filter(([, w]) => w.to.node === id)
    .map(([, w]) => w.from.node);
}
function children(state: State, id: string): string[] {
  return wiresAt(state, id)
    .filter(([, w]) => w.from.node === id)
    .map(([, w]) => w.to.node);
}

/** Clean up after a rewrite. */
function tidy(state: State): State {
  return relayout(state);
}

const clampX = (x: number) => _.clamp(x, X_MIN, X_MAX);

// ## Rewrites

/**
 * Unit law: `unit` feeds `mult`. Both vanish; the mult's other input
 * becomes its output.
 */
function unitLaw(state: State, unit: string, mult: string): State {
  const feed = wireFrom(state, unit, 0);
  const k = state.wires[feed].to.i;
  const other = wireTo(state, mult, 1 - k);
  const out = wireFrom(state, mult, 0);
  return tidy(
    produce(state, (s) => {
      s.wires[out].from = s.wires[other].from;
      delete s.wires[other];
      delete s.wires[feed];
      delete s.nodes[unit];
      delete s.nodes[mult];
    }),
  );
}

/** Counit law: `comult` feeds `counit`. Dual of the unit law. */
function counitLaw(state: State, counit: string, comult: string): State {
  const feed = wireTo(state, counit, 0);
  const k = state.wires[feed].from.i;
  const other = wireFrom(state, comult, 1 - k);
  const inp = wireTo(state, comult, 0);
  return tidy(
    produce(state, (s) => {
      s.wires[inp].to = s.wires[other].to;
      delete s.wires[other];
      delete s.wires[feed];
      delete s.nodes[counit];
      delete s.nodes[comult];
    }),
  );
}

/**
 * A unit (or counit) and the generator it annihilates with, in
 * either order: the pair `[unit, mult]` or `[counit, comult]`.
 */
function unitPartners(state: State, id: string): [string, string, State][] {
  const g = gen(state, id);
  const out: [string, string, State][] = [];
  if (g === "unit") {
    const m = state.wires[wireFrom(state, id, 0)].to.node;
    if (gen(state, m) === "mult") out.push([id, m, unitLaw(state, id, m)]);
  } else if (g === "mult") {
    for (const i of [0, 1]) {
      const u = state.wires[wireTo(state, id, i)].from.node;
      if (gen(state, u) === "unit") out.push([u, id, unitLaw(state, u, id)]);
    }
  } else if (g === "counit") {
    const c = state.wires[wireTo(state, id, 0)].from.node;
    if (gen(state, c) === "comult") {
      out.push([id, c, counitLaw(state, id, c)]);
    }
  } else if (g === "comult") {
    for (const i of [0, 1]) {
      const e = state.wires[wireFrom(state, id, i)].to.node;
      if (gen(state, e) === "counit") {
        out.push([e, id, counitLaw(state, e, id)]);
      }
    }
  }
  return out;
}

/**
 * Associativity. `sat` is a μ whose output feeds in-port `k` of the
 * μ `hub`. Reading the three dangling inputs left to right, they
 * are [sat.in0, sat.in1, hub.in1] when k = 0 and [hub.in0, sat.in0,
 * sat.in1] when k = 1; the rewrite keeps the wires in that order
 * and moves the satellite to the other side.
 */
function assoc(state: State, sat: string, hub: string): State {
  const link = wireFrom(state, sat, 0);
  const k = state.wires[link].to.i;
  const ports = (k: number): Port[] =>
    k === 0
      ? [
          { node: sat, i: 0 },
          { node: sat, i: 1 },
          { node: hub, i: 1 },
        ]
      : [
          { node: hub, i: 0 },
          { node: sat, i: 0 },
          { node: sat, i: 1 },
        ];
  const wids = ports(k).map((p) => wireTo(state, p.node, p.i));
  const xs = wids.map((wid) => portPos(state, state.wires[wid].from, "out").x);
  return tidy(
    produce(state, (s) => {
      ports(1 - k).forEach((p, j) => (s.wires[wids[j]].to = p));
      s.wires[link].to = { node: hub, i: 1 - k };
      const satNode = s.nodes[sat] as GenNode;
      const hubNode = s.nodes[hub] as GenNode;
      // the satellite sits over its two inputs; the hub stays put
      // unless that would make the link cross
      satNode.x = clampX(k === 0 ? (xs[1] + xs[2]) / 2 : (xs[0] + xs[1]) / 2);
      hubNode.x = clampX(
        k === 0 ? (xs[0] + satNode.x) / 2 : (satNode.x + xs[2]) / 2,
      );
    }),
  );
}

/** Coassociativity: `sat` is a δ fed by out-port `k` of the δ `hub`. */
function coassoc(state: State, sat: string, hub: string): State {
  const link = wireTo(state, sat, 0);
  const k = state.wires[link].from.i;
  const ports = (k: number): Port[] =>
    k === 0
      ? [
          { node: sat, i: 0 },
          { node: sat, i: 1 },
          { node: hub, i: 1 },
        ]
      : [
          { node: hub, i: 0 },
          { node: sat, i: 0 },
          { node: sat, i: 1 },
        ];
  const wids = ports(k).map((p) => wireFrom(state, p.node, p.i));
  const xs = wids.map((wid) => portPos(state, state.wires[wid].to, "in").x);
  return tidy(
    produce(state, (s) => {
      ports(1 - k).forEach((p, j) => (s.wires[wids[j]].from = p));
      s.wires[link].from = { node: hub, i: 1 - k };
      const satNode = s.nodes[sat] as GenNode;
      const hubNode = s.nodes[hub] as GenNode;
      satNode.x = clampX(k === 0 ? (xs[1] + xs[2]) / 2 : (xs[0] + xs[1]) / 2);
      hubNode.x = clampX(
        k === 0 ? (xs[0] + satNode.x) / 2 : (satNode.x + xs[2]) / 2,
      );
    }),
  );
}

/**
 * The (co)associativity partner of `id`: `[sat, hub, side]`, where
 * `side` is -1 if the satellite is on the hub's left, +1 on its
 * right.
 */
function assocPartner(
  state: State,
  id: string,
): { sat: string; hub: string; side: -1 | 1; result: State } | undefined {
  const g = gen(state, id);
  if (g === "mult") {
    const down = state.wires[wireFrom(state, id, 0)].to;
    if (gen(state, down.node) === "mult") {
      const side = down.i === 0 ? -1 : 1;
      return {
        sat: id,
        hub: down.node,
        side,
        result: assoc(state, id, down.node),
      };
    }
    for (const i of [0, 1]) {
      const up = state.wires[wireTo(state, id, i)].from.node;
      if (gen(state, up) === "mult") {
        const side = i === 0 ? -1 : 1;
        return { sat: up, hub: id, side, result: assoc(state, up, id) };
      }
    }
  } else if (g === "comult") {
    const up = state.wires[wireTo(state, id, 0)].from;
    if (gen(state, up.node) === "comult") {
      const side = up.i === 0 ? -1 : 1;
      return {
        sat: id,
        hub: up.node,
        side,
        result: coassoc(state, id, up.node),
      };
    }
    for (const i of [0, 1]) {
      const down = state.wires[wireFrom(state, id, i)].to.node;
      if (gen(state, down) === "comult") {
        const side = i === 0 ? -1 : 1;
        return { sat: down, hub: id, side, result: coassoc(state, down, id) };
      }
    }
  }
  return undefined;
}

/**
 * The Frobenius law relates three shapes of a μ–δ pair joined by one
 * wire. Naming the four dangling wires a, b (inputs, left to right)
 * and c, d (outputs):
 *
 *   H:  a, b → μ → δ → c, d                   (δ∘μ)
 *   ZL: δ above, on the left: a → δ → c and (δ.out1, b) → μ → d
 *   ZR: δ above, on the right: b → δ → d and (a, δ.out0) → μ → c
 */
type FrobForm = "H" | "ZL" | "ZR";

function frobForm(state: State, m: string, c: string): FrobForm | undefined {
  const between = wiresAt(state, m).filter(
    ([, w]) => w.from.node === c || w.to.node === c,
  );
  if (between.length !== 1) return undefined;
  const [, w] = between[0];
  if (w.from.node === m) return "H";
  if (w.from.i === 1 && w.to.i === 0) return "ZL";
  if (w.from.i === 0 && w.to.i === 1) return "ZR";
  return undefined;
}

/** The four dangling wires of a μ–δ pair, in the order a, b, c, d. */
function frobWires(
  state: State,
  m: string,
  c: string,
  form: FrobForm,
): [string, string, string, string] {
  switch (form) {
    case "H":
      return [
        wireTo(state, m, 0),
        wireTo(state, m, 1),
        wireFrom(state, c, 0),
        wireFrom(state, c, 1),
      ];
    case "ZL":
      return [
        wireTo(state, c, 0),
        wireTo(state, m, 1),
        wireFrom(state, c, 0),
        wireFrom(state, m, 0),
      ];
    case "ZR":
      return [
        wireTo(state, m, 0),
        wireTo(state, c, 0),
        wireFrom(state, m, 0),
        wireFrom(state, c, 1),
      ];
  }
}

function frobenius(state: State, m: string, c: string, to: FrobForm): State {
  const from = frobForm(state, m, c)!;
  const [a, b, cc, d] = frobWires(state, m, c, from);
  const [link] = wiresAt(state, m).find(
    ([, w]) => w.from.node === c || w.to.node === c,
  )!;
  const ax = portPos(state, state.wires[a].from, "out").x;
  const bx = portPos(state, state.wires[b].from, "out").x;
  const cx = portPos(state, state.wires[cc].to, "in").x;
  const dx = portPos(state, state.wires[d].to, "in").x;
  return tidy(
    produce(state, (s) => {
      const M = s.nodes[m] as GenNode;
      const C = s.nodes[c] as GenNode;
      const mid = (M.y + C.y) / 2;
      switch (to) {
        case "H":
          s.wires[a].to = { node: m, i: 0 };
          s.wires[b].to = { node: m, i: 1 };
          s.wires[cc].from = { node: c, i: 0 };
          s.wires[d].from = { node: c, i: 1 };
          s.wires[link] = { from: { node: m, i: 0 }, to: { node: c, i: 0 } };
          M.x = C.x = clampX((ax + bx + cx + dx) / 4);
          M.y = mid - 1;
          C.y = mid + 1;
          break;
        case "ZL":
          s.wires[a].to = { node: c, i: 0 };
          s.wires[b].to = { node: m, i: 1 };
          s.wires[cc].from = { node: c, i: 0 };
          s.wires[d].from = { node: m, i: 0 };
          s.wires[link] = { from: { node: c, i: 1 }, to: { node: m, i: 0 } };
          C.x = clampX((ax + cx) / 2);
          M.x = clampX((bx + dx) / 2);
          C.y = mid - 1;
          M.y = mid + 1;
          break;
        case "ZR":
          s.wires[a].to = { node: m, i: 0 };
          s.wires[b].to = { node: c, i: 0 };
          s.wires[cc].from = { node: m, i: 0 };
          s.wires[d].from = { node: c, i: 1 };
          s.wires[link] = { from: { node: c, i: 0 }, to: { node: m, i: 1 } };
          M.x = clampX((ax + cx) / 2);
          C.x = clampX((bx + dx) / 2);
          C.y = mid - 1;
          M.y = mid + 1;
          break;
      }
    }),
  );
}

/** The μ–δ pair `id` belongs to, if it's in one of the three forms. */
function frobPartner(
  state: State,
  id: string,
): { m: string; c: string; form: FrobForm } | undefined {
  const g = gen(state, id);
  if (g !== "mult" && g !== "comult") return undefined;
  for (const [, w] of wiresAt(state, id)) {
    const other = w.from.node === id ? w.to.node : w.from.node;
    if (gen(state, other) !== (g === "mult" ? "comult" : "mult")) continue;
    const m = g === "mult" ? id : other;
    const c = g === "mult" ? other : id;
    const form = frobForm(state, m, c);
    if (form) return { m, c, form };
  }
  return undefined;
}

// ## Graph isomorphism (good enough for tiny diagrams)
//
// Boundaries keep their names; generators are refined by their
// neighborhoods (with port numbers) a few times, then the whole
// thing is serialized.

function graphKey(state: State): string {
  let labels: Record<string, string> = {};
  for (const [id, n] of Object.entries(state.nodes)) {
    labels[id] = n.type === "boundary" ? `B:${id}` : `G:${n.gen}`;
  }
  const edgeKey = (w: Wire) =>
    `${labels[w.from.node]}.${w.from.i}>${labels[w.to.node]}.${w.to.i}`;
  for (let round = 0; round < 4; round++) {
    const next: Record<string, string> = {};
    for (const id of Object.keys(state.nodes)) {
      const nbrs = wiresAt(state, id)
        .map(([, w]) => (w.from.node === id ? "v" : "^") + edgeKey(w))
        .sort();
      next[id] = `${labels[id]}(${nbrs.join(",")})`;
    }
    labels = next;
  }
  const nodes = Object.values(labels).sort();
  const edges = Object.values(state.wires).map(edgeKey).sort();
  return nodes.join(";") + "//" + edges.join(";");
}

// ## Drag specs

const HIT_R = 30;

/**
 * Fires when the dragged node's *center* is within HIT_R of where
 * `target` was drawn at drag start (the relayout rule keeps it there
 * until the floater passes through it).
 */
function nearNodeSpec(
  d: DragSpecBuilder<State>,
  state: State,
  target: string,
  result: State,
): DragSpec<State> {
  const t = state.nodes[target] as GenNode;
  const spot = Vec2(t.x, t.y);
  return d.custom((ctx) => {
    const inner = dragSpecToBehavior<State>(d.fixed(result), ctx);
    return (frame) => {
      const center = frame.pointer.sub(ctx.anchorPos);
      return {
        ...inner(frame),
        gap: center.dist(spot) < HIT_R ? 0 : Infinity,
        activePath: "near-node",
      };
    };
  });
}

/** Fires once the dragged node's center satisfies `crossed`. */
function crossingSpec(
  d: DragSpecBuilder<State>,
  result: State,
  label: string,
  crossed: (center: Vec2) => boolean,
): DragSpec<State> {
  return d.custom((ctx) => {
    const inner = dragSpecToBehavior<State>(d.fixed(result), ctx);
    return (frame) => ({
      ...inner(frame),
      gap: crossed(frame.pointer.sub(ctx.anchorPos)) ? 0 : Infinity,
      activePath: label,
    });
  });
}

const CROSS = 8;

function genSpec(
  d: DragSpecBuilder<State>,
  state: State,
  id: string,
): DragSpec<State> {
  const me = state.nodes[id] as GenNode;
  const branches: DragSpec<State>[] = [];
  const xBounds: [number, number] = [X_MIN, X_MAX];
  // A node can't be dragged above its parents or below its children
  // (strings run downward), except where a crossing rule takes over.
  const yBounds: [number, number] = [
    Math.max(...parents(state, id).map((p) => nodeY(state, p))) + ROW_H / 2,
    Math.min(...children(state, id).map((c) => nodeY(state, c))) - ROW_H / 2,
  ];

  for (const [u, m, result] of unitPartners(state, id)) {
    const target = u === id ? m : u;
    branches.push(nearNodeSpec(d, state, target, result));
  }

  const ap = assocPartner(state, id);
  if (ap) {
    const otherId = ap.sat === id ? ap.hub : ap.sat;
    const other = state.nodes[otherId] as GenNode;
    // the satellite crosses toward the hub's other side; the hub
    // crosses the other way
    const dir = (ap.sat === id ? -ap.side : ap.side) as -1 | 1;
    branches.push(
      crossingSpec(
        d,
        ap.result,
        ap.sat === id ? "assoc" : "assoc-hub",
        (c) => (c.x - other.x) * dir > CROSS,
      ),
    );
    if (dir > 0) xBounds[0] = Math.max(xBounds[0], other.x + 2);
    else xBounds[1] = Math.min(xBounds[1], other.x - 2);
  }

  const fp = frobPartner(state, id);
  if (fp) {
    const otherId = fp.m === id ? fp.c : fp.m;
    const other = state.nodes[otherId] as GenNode;
    const goingUp = other.y < me.y;
    const passed = (c: Vec2) =>
      goingUp ? c.y < other.y - CROSS : c.y > other.y + CROSS;
    if (fp.form === "H") {
      // which zigzag you get depends on which side you cross on;
      // in ZL the δ is left of the μ, in ZR right of it
      const leftForm: FrobForm = fp.c === id ? "ZL" : "ZR";
      const rightForm: FrobForm = fp.c === id ? "ZR" : "ZL";
      branches.push(
        crossingSpec(
          d,
          frobenius(state, fp.m, fp.c, leftForm),
          "frobenius-left",
          (c) => passed(c) && c.x < other.x,
        ),
        crossingSpec(
          d,
          frobenius(state, fp.m, fp.c, rightForm),
          "frobenius-right",
          (c) => passed(c) && c.x >= other.x,
        ),
      );
    } else {
      branches.push(
        crossingSpec(d, frobenius(state, fp.m, fp.c, "H"), "frobenius", passed),
      );
    }
  }

  const move = d
    .vary(state, [param("nodes", id, "x"), param("nodes", id, "y")], {
      constraint: (s) => {
        const n = s.nodes[id] as GenNode;
        return and(
          ...inOrder([xBounds[0], n.x, xBounds[1]]),
          ...inOrder([yBounds[0], n.y, yBounds[1]]),
        );
      },
    })
    .during((s) => relayout(s, id));

  return d
    .closest([...branches, move])
    .withBranchTransition(150)
    .onDrop((s) => tidy(s));
}

// ## Rendering

type RenderCtx = {
  d: DragSpecBuilder<State>;
  draggedId: string | null;
};

function renderDiagram(state: State, ctx: RenderCtx | null, prefix = "") {
  const P = (id: string) => prefix + id;
  const draggedId = ctx?.draggedId ?? null;

  // Which nodes light up as drop targets for the current drag?
  const targets = new Set<string>();
  if (draggedId) {
    const m = /^gen-(.+)$/.exec(draggedId);
    if (m && state.nodes[m[1]]) {
      for (const [u, mu] of unitPartners(state, m[1])) {
        targets.add(u === m[1] ? mu : u);
      }
    }
  }

  const outY = outputY(state);

  return (
    <g>
      {/* boundary rails */}
      <line x1={0} y1={TOP} x2={DIAG_W} y2={TOP} stroke="#e5e7eb" />
      <line
        id={P("out-rail")}
        transform={translate(0, outY)}
        x1={0}
        y1={0}
        x2={DIAG_W}
        y2={0}
        stroke="#e5e7eb"
      />

      {/* wires */}
      {Object.entries(state.wires).map(([wid, wire]) => (
        <path
          id={P(`wire-${wid}`)}
          d={wirePath(state, wire)}
          fill="none"
          stroke={INK}
          strokeWidth={2}
          dragologyZIndex={-1}
        />
      ))}

      {/* nodes */}
      {Object.entries(state.nodes).map(([id, node]) => {
        if (node.type === "boundary") {
          return (
            <g
              id={P(`bdry-${id}`)}
              transform={translate(node.x, node.side === "in" ? TOP : outY)}
            >
              <circle r={2.5} fill={INK} />
            </g>
          );
        }
        const isDragged = draggedId === `gen-${id}`;
        return (
          <g
            id={P(`gen-${id}`)}
            className="frob-gen"
            transform={translate(node.x, node.y)}
            dragologyZIndex={isDragged ? "/1" : false}
            dragologyOnDrag={ctx ? () => genSpec(ctx.d, state, id) : undefined}
          >
            <circle r={20} fill="transparent" />
            {targets.has(id) && (
              <circle
                id={P(`halo-${id}`)}
                r={18}
                fill="#e5e7eb"
                fillOpacity={0.6}
                stroke={INK}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dragologyZIndex={-1}
              />
            )}
            <circle r={DOT_R} fill={INK} />
            <text
              transform={translate(DOT_R + 4, -DOT_R - 2)}
              fontSize={11}
              fontFamily="ui-serif, Georgia, serif"
              fontStyle="italic"
              fill="#9ca3af"
              style={{ userSelect: "none", pointerEvents: "none" }}
            >
              {SYMBOL[node.gen]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

const draggable: Draggable<State> = ({ state, d, draggedId }) => {
  const puzzle = PUZZLES[state.puzzle];
  const proved = puzzle.goal
    ? graphKey(state) === GOAL_KEYS[state.puzzle]
    : false;
  const goalScale = 0.42;
  const goalH = puzzle.goal ? (outputY(puzzle.goal) + TOP) * goalScale : 0;

  return (
    <g>
      <style>{`.frob-gen { cursor: grab; }`}</style>
      {renderDiagram(state, { d, draggedId })}
      {puzzle.goal && (
        <g transform={translate(DIAG_W + 8, 12)}>
          <rect
            id="goal-frame"
            dragologyZIndex={-2}
            width={GOAL_W - 16}
            height={goalH + 44}
            rx={8}
            fill={proved ? "#ecfdf5" : "#f9fafb"}
            stroke={proved ? "#10b981" : "#e5e7eb"}
            strokeWidth={proved ? 2 : 1}
          />
          <text
            transform={translate(10, 18)}
            fontSize={11}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fill="#6b7280"
            style={{ userSelect: "none" }}
          >
            GOAL
          </text>
          {proved && (
            <text
              id="goal-proved"
              transform={translate(GOAL_W - 26, 18)}
              textAnchor="end"
              fontSize={11}
              fontWeight="bold"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fill="#059669"
              style={{ userSelect: "none" }}
            >
              PROVED ∎
            </text>
          )}
          <g
            transform={
              translate((GOAL_W - 16 - DIAG_W * goalScale) / 2, 30) +
              scale(goalScale)
            }
          >
            {renderDiagram(puzzle.goal, null, "goal-")}
          </g>
        </g>
      )}
    </g>
  );
};

// ## Puzzles
//
// Each is a diagram to start from and (usually) a diagram to reach.
// Level numbers in `y` are just orderings; `relayout` spaces them.
// Wires are written `[from, to]`, where a bare id means port 0.

type Puzzle = {
  title: string;
  blurb: string;
  start: State;
  goal: State | null;
};

const bd = (side: "in" | "out", x: number): Boundary => ({
  type: "boundary",
  side,
  x,
});
const g = (gen: Gen, x: number, y: number): GenNode => ({
  type: "gen",
  gen,
  x,
  y,
});
type PortSpec = string | [string, number];
const port = (p: PortSpec): Port =>
  typeof p === "string" ? { node: p, i: 0 } : { node: p[0], i: p[1] };
const wires = (list: [PortSpec, PortSpec][]): Record<string, Wire> =>
  Object.fromEntries(
    list.map(([from, to], i) => [`w${i}`, { from: port(from), to: port(to) }]),
  );

const unitStart: State = tidy({
  puzzle: "unit",
  nodes: {
    a: bd("in", 130),
    b: bd("in", 230),
    out: bd("out", 160),
    eta: g("unit", 70, 1),
    u: g("mult", 100, 2),
    l: g("mult", 160, 3),
  },
  wires: wires([
    ["eta", ["u", 0]],
    ["a", ["u", 1]],
    ["u", ["l", 0]],
    ["b", ["l", 1]],
    ["l", "out"],
  ]),
});

const multGoal = (puzzle: PuzzleId): State =>
  tidy({
    puzzle,
    nodes: {
      a: bd("in", 110),
      b: bd("in", 210),
      out: bd("out", 160),
      m: g("mult", 160, 1),
    },
    wires: wires([
      ["a", ["m", 0]],
      ["b", ["m", 1]],
      ["m", "out"],
    ]),
  });

const assocStart: State = tidy({
  puzzle: "assoc",
  nodes: {
    a: bd("in", 70),
    b: bd("in", 140),
    c: bd("in", 250),
    o1: bd("out", 70),
    o2: bd("out", 140),
    o3: bd("out", 250),
    u: g("mult", 105, 1),
    l: g("mult", 160, 2),
    d1: g("comult", 160, 3),
    d2: g("comult", 105, 4),
  },
  wires: wires([
    ["a", ["u", 0]],
    ["b", ["u", 1]],
    ["u", ["l", 0]],
    ["c", ["l", 1]],
    ["l", "d1"],
    [["d1", 0], "d2"],
    [["d1", 1], "o3"],
    [["d2", 0], "o1"],
    [["d2", 1], "o2"],
  ]),
});

const assocGoal: State = tidy({
  puzzle: "assoc",
  nodes: {
    a: bd("in", 70),
    b: bd("in", 180),
    c: bd("in", 250),
    o1: bd("out", 70),
    o2: bd("out", 180),
    o3: bd("out", 250),
    u: g("mult", 215, 1),
    l: g("mult", 160, 2),
    d1: g("comult", 160, 3),
    d2: g("comult", 215, 4),
  },
  wires: wires([
    ["a", ["l", 0]],
    ["b", ["u", 0]],
    ["c", ["u", 1]],
    ["u", ["l", 1]],
    ["l", "d1"],
    [["d1", 0], "o1"],
    [["d1", 1], "d2"],
    [["d2", 0], "o2"],
    [["d2", 1], "o3"],
  ]),
});

const frobStart: State = tidy({
  puzzle: "frobenius",
  nodes: {
    a: bd("in", 110),
    b: bd("in", 210),
    c: bd("out", 110),
    d: bd("out", 210),
    m: g("mult", 160, 1),
    k: g("comult", 160, 2),
  },
  wires: wires([
    ["a", ["m", 0]],
    ["b", ["m", 1]],
    ["m", "k"],
    [["k", 0], "c"],
    [["k", 1], "d"],
  ]),
});

const frobGoal: State = tidy({
  puzzle: "frobenius",
  nodes: {
    a: bd("in", 110),
    b: bd("in", 210),
    c: bd("out", 110),
    d: bd("out", 210),
    k: g("comult", 110, 1),
    m: g("mult", 210, 2),
  },
  wires: wires([
    ["a", "k"],
    [["k", 0], "c"],
    [
      ["k", 1],
      ["m", 0],
    ],
    ["b", ["m", 1]],
    ["m", "d"],
  ]),
});

/** id ⊗ (δ∘η), then (ε∘μ) ⊗ id: a zigzag made of a cup and a cap. */
const snakeStart: State = tidy({
  puzzle: "snake",
  nodes: {
    a: bd("in", 90),
    out: bd("out", 230),
    eta: g("unit", 230, 1),
    k: g("comult", 230, 2),
    m: g("mult", 160, 3),
    eps: g("counit", 160, 4),
  },
  wires: wires([
    ["eta", "k"],
    ["a", ["m", 0]],
    [
      ["k", 0],
      ["m", 1],
    ],
    ["m", "eps"],
    [["k", 1], "out"],
  ]),
});

const identityGoal = (puzzle: PuzzleId, x: number): State =>
  tidy({
    puzzle,
    nodes: { a: bd("in", x), out: bd("out", x) },
    wires: wires([["a", "out"]]),
  });

/** A snake whose output runs into a mirror-image snake. */
const doubleSnakeStart: State = tidy({
  puzzle: "double-snake",
  nodes: {
    a: bd("in", 90),
    out: bd("out", 90),
    eta1: g("unit", 230, 1),
    k1: g("comult", 230, 2),
    m1: g("mult", 160, 3),
    eps1: g("counit", 160, 4),
    eta2: g("unit", 90, 5),
    k2: g("comult", 90, 6),
    m2: g("mult", 160, 7),
    eps2: g("counit", 160, 8),
  },
  wires: wires([
    ["eta1", "k1"],
    ["a", ["m1", 0]],
    [
      ["k1", 0],
      ["m1", 1],
    ],
    ["m1", "eps1"],
    ["eta2", "k2"],
    [
      ["k2", 1],
      ["m2", 0],
    ],
    [
      ["k1", 1],
      ["m2", 1],
    ],
    ["m2", "eps2"],
    [["k2", 0], "out"],
  ]),
});

const playgroundStart: State = tidy({
  puzzle: "playground",
  nodes: {
    a: bd("in", 60),
    b: bd("in", 130),
    c: bd("in", 260),
    o1: bd("out", 60),
    o2: bd("out", 160),
    o3: bd("out", 260),
    u: g("mult", 95, 1),
    eta: g("unit", 230, 2),
    l: g("mult", 130, 3),
    k: g("comult", 130, 4),
    k2: g("comult", 230, 5),
    eps: g("counit", 200, 6),
  },
  wires: wires([
    ["a", ["u", 0]],
    ["b", ["u", 1]],
    ["u", ["l", 0]],
    ["c", ["k2", 0]],
    [["k2", 0], "eps"],
    [["k2", 1], "o3"],
    ["eta", ["l", 1]],
    ["l", "k"],
    [["k", 0], "o1"],
    [["k", 1], "o2"],
  ]),
});

const PUZZLES: Record<PuzzleId, Puzzle> = {
  unit: {
    title: "(1·a)·b = a·b",
    blurb:
      "Drop the unit η onto the μ it feeds (or the μ onto it): both vanish. " +
      "Try sliding the upper μ across the lower one first, for associativity.",
    start: unitStart,
    goal: multGoal("unit"),
  },
  assoc: {
    title: "Reassociate",
    blurb:
      "Slide the upper μ sideways across the lower μ (associativity), and " +
      "the lower δ across the upper δ (coassociativity).",
    start: assocStart,
    goal: assocGoal,
  },
  frobenius: {
    title: "Frobenius law",
    blurb:
      "Drag the δ up past the μ, crossing on its left. (Crossing on the " +
      "right gives the other zigzag; dragging back down restores δ∘μ.)",
    start: frobStart,
    goal: frobGoal,
  },
  snake: {
    title: "Snake",
    blurb:
      "A cup (δ∘η) and a cap (ε∘μ) make a zigzag. Drag the δ down past the " +
      "μ (Frobenius), then drop the unit on the μ and the counit on the δ.",
    start: snakeStart,
    goal: identityGoal("snake", 160),
  },
  "double-snake": {
    title: "Double snake",
    blurb: "Two zigzags in a row. Straighten both.",
    start: doubleSnakeStart,
    goal: identityGoal("double-snake", 160),
  },
  playground: {
    title: "Playground",
    blurb: "No goal – poke at the generators.",
    start: playgroundStart,
    goal: null,
  },
};

const GOAL_KEYS = _.mapValues(PUZZLES, (p) => (p.goal ? graphKey(p.goal) : ""));

const PUZZLE_ORDER: PuzzleId[] = [
  "unit",
  "assoc",
  "frobenius",
  "snake",
  "double-snake",
  "playground",
];

export default demo(
  () => {
    const [puzzleId, setPuzzleId] = useState<PuzzleId>("unit");
    const [attempt, setAttempt] = useState(0);
    const puzzle = PUZZLES[puzzleId];
    return (
      <>
        <DemoNotes>
          <p className="mb-2 font-bold">⚠️ Just a seed!</p>
          <p>
            String diagrams for a (non-commutative) Frobenius algebra, where
            every drag is an axiom. <b>Drag generators</b> past unrelated ones
            (interchange), <b>slide a μ across the μ it feeds</b>{" "}
            (associativity; dually for δ), <b>drop a unit on its μ</b> or a
            counit on its δ (unit laws), and{" "}
            <b>drag the δ of a μ–δ pair past the μ</b> (Frobenius law).
          </p>
        </DemoNotes>
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          {PUZZLE_ORDER.map((id) => (
            <button
              key={id}
              className={
                "px-2 py-1 text-sm rounded border " +
                (id === puzzleId
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
              }
              onClick={() => {
                setPuzzleId(id);
                setAttempt((n) => n + 1);
              }}
            >
              {PUZZLES[id].title}
            </button>
          ))}
          <button
            className="px-2 py-1 text-sm rounded border bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
            onClick={() => setAttempt((n) => n + 1)}
          >
            reset
          </button>
        </div>
        <DemoNotes>{puzzle.blurb}</DemoNotes>
        <DemoDraggable
          key={`${puzzleId}-${attempt}`}
          draggable={draggable}
          initialState={puzzle.start}
          width={W}
          height={H}
        />
      </>
    );
  },
  {
    fuzz: PUZZLE_ORDER.map((id) => ({
      name: id,
      draggable,
      initialState: PUZZLES[id].start,
    })),
    tags: [
      "d.closest",
      "d.custom",
      "d.vary",
      "spec.during",
      "spec.onDrop",
      "spec.withBranchTransition",
    ],
  },
);
