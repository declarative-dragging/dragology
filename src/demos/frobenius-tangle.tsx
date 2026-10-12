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

// # Commutative Frobenius algebras: tangles
//
// Diagrams flow left to right, from inputs on the left bank to
// outputs on the right. There are two generators: μ (two in, one
// out; drawn hollow) and δ (one in, two out; drawn solid). A node's
// two inputs (or outputs) are ordered, upper port first, and wires
// may cross. Each axiom is a gesture:
//
// - drag a node anywhere: isotopy (`d.vary` on x and y);
// - click a μ to swap its inputs, or a δ to swap its outputs:
//   commutativity (and cocommutativity);
// - drop a μ onto the μ it feeds, or the other way round:
//   associativity, ((a b) c) ↔ (a (b c)). Dually for δ;
// - drop a μ onto a δ it's wired to, or the other way round: the
//   Frobenius law. From the H (μ then δ), the dropped node lands on
//   top or bottom according to whether it came in from above or
//   below; from either zigzag, the drop gives back the H.
//
// Every connected diagram equals one in a normal form: its inputs
// merge, then g handles (a δ whose two wires a μ merges straight
// back), then the outputs split off. g, the number of independent
// loops, never changes; the puzzle is to untangle down to that form,
// with no twists left over.

// ## State

type Gen = "mult" | "comult";
type GenNode = { type: "gen"; gen: Gen; x: number; y: number };
type Boundary = { type: "boundary"; side: "in" | "out"; y: number };
type Node = GenNode | Boundary;

/** Every wire runs from an out port to an in port; port 0 is the upper. */
type Port = { node: string; i: number };
type Wire = { from: Port; to: Port };

type PuzzleId = "frobenius" | "cross" | "weave" | "lattice" | "braid";

type State = {
  puzzle: PuzzleId;
  nodes: Record<string, Node>;
  wires: Record<string, Wire>;
};

const ARITY: Record<Gen, { ins: number; outs: number }> = {
  mult: { ins: 2, outs: 1 },
  comult: { ins: 1, outs: 2 },
};

// ## Layout constants

const DIAG_W = 460;
const GOAL_W = 170;
const W = DIAG_W + GOAL_W;
const H = 360;
const BANK = 22;
const X_MIN = BANK + 16;
const X_MAX = DIAG_W - BANK - 16;
const Y_MIN = 16;
const Y_MAX = H - 16;
const NODE_R = 7;
/** how far from horizontal a node's two ports on one side splay */
const SPLAY = (35 * Math.PI) / 180;

const INK = "#3f3f46";
const BANK_FILL = "#f3f4f6";
const BANK_STROKE = "#d1d5db";

// ## Graph helpers

function gen(state: State, id: string): Gen | undefined {
  const n = state.nodes[id];
  return n.type === "gen" ? n.gen : undefined;
}

const samePort = (p: Port, q: Port) => p.node === q.node && p.i === q.i;

function wireFrom(state: State, node: string, i: number): string {
  const found = Object.keys(state.wires).find((wid) =>
    samePort(state.wires[wid].from, { node, i }),
  );
  if (!found) throw new Error(`no wire from ${node}:out${i}`);
  return found;
}

function wireTo(state: State, node: string, i: number): string {
  const found = Object.keys(state.wires).find((wid) =>
    samePort(state.wires[wid].to, { node, i }),
  );
  if (!found) throw new Error(`no wire to ${node}:in${i}`);
  return found;
}

function wiresAt(state: State, id: string): [string, Wire][] {
  return Object.entries(state.wires).filter(
    ([, w]) => w.from.node === id || w.to.node === id,
  );
}

function neighbors(state: State, id: string): string[] {
  return _.uniq(
    wiresAt(state, id).map(([, w]) =>
      w.from.node === id ? w.to.node : w.from.node,
    ),
  );
}

function isAcyclic(state: State): boolean {
  const indeg: Record<string, number> = _.mapValues(state.nodes, () => 0);
  for (const w of Object.values(state.wires)) indeg[w.to.node]++;
  const queue = Object.keys(indeg).filter((id) => indeg[id] === 0);
  let seen = 0;
  while (queue.length) {
    const id = queue.pop()!;
    seen++;
    for (const w of Object.values(state.wires)) {
      if (w.from.node === id && --indeg[w.to.node] === 0) {
        queue.push(w.to.node);
      }
    }
  }
  return seen === Object.keys(state.nodes).length;
}

// ## Geometry

function nodePos(state: State, id: string): Vec2 {
  const n = state.nodes[id];
  if (n.type === "gen") return Vec2(n.x, n.y);
  return Vec2(n.side === "in" ? BANK : DIAG_W - BANK, n.y);
}

/** Where a port sits, and the direction its wire leaves in. */
function portEnd(
  state: State,
  port: Port,
  side: "in" | "out",
): { pos: Vec2; dir: Vec2 } {
  const p = nodePos(state, port.node);
  const n = state.nodes[port.node];
  if (n.type === "boundary") {
    return { pos: p, dir: Vec2(side === "out" ? 1 : -1, 0) };
  }
  const count = side === "in" ? ARITY[n.gen].ins : ARITY[n.gen].outs;
  // port 0 is the upper one (negative y)
  const offset = count === 1 ? 0 : port.i === 0 ? -1 : 1;
  const angle = side === "out" ? offset * SPLAY : Math.PI - offset * SPLAY;
  const dir = Vec2(Math.cos(angle), Math.sin(angle));
  return { pos: p.add(dir.mul(NODE_R)), dir };
}

function wirePath(state: State, wire: Wire): string {
  const a = portEnd(state, wire.from, "out");
  const b = portEnd(state, wire.to, "in");
  const k = Math.max(22, a.pos.dist(b.pos) / 3);
  return path(
    "M",
    a.pos,
    "C",
    a.pos.add(a.dir.mul(k)),
    b.pos.add(b.dir.mul(k)),
    b.pos,
  );
}

// ## Rewrites

/** Commutativity: swap a μ's inputs, or a δ's outputs. */
function swap(state: State, id: string): State {
  return produce(state, (s) => {
    const end = gen(state, id) === "mult" ? "to" : "from";
    for (const w of Object.values(s.wires)) {
      if (w[end].node === id) w[end].i = 1 - w[end].i;
    }
  });
}

/**
 * After a rewrite of the pair `a`, `b`: each sits level with the
 * average of its other neighbors, and the wire between them runs
 * left to right. If `upper` is given, it's kept above the other.
 */
function settle(s: State, a: string, b: string, upper?: string) {
  const link = Object.values(s.wires).find(
    (w) =>
      (w.from.node === a && w.to.node === b) ||
      (w.from.node === b && w.to.node === a),
  )!;
  const A = s.nodes[a] as GenNode;
  const B = s.nodes[b] as GenNode;
  for (const id of [a, b]) {
    const others = neighbors(s, id).filter((n) => n !== a && n !== b);
    if (others.length === 0) continue;
    (s.nodes[id] as GenNode).y = _.meanBy(others, (n) => nodePos(s, n).y);
  }
  const [lo, hi] = _.sortBy([A.x, B.x]);
  const mid = (lo + hi) / 2;
  const half = Math.max((hi - lo) / 2, 24);
  const src = s.nodes[link.from.node] as GenNode;
  const tgt = s.nodes[link.to.node] as GenNode;
  src.x = _.clamp(mid - half, X_MIN, X_MAX);
  tgt.x = _.clamp(mid + half, X_MIN, X_MAX);
  if (upper) {
    const U = s.nodes[upper] as GenNode;
    const L = (upper === a ? B : A) as GenNode;
    if (U.y > L.y - 30) {
      const m = (U.y + L.y) / 2;
      U.y = m - 15;
      L.y = m + 15;
    }
  }
}

/**
 * Associativity. `sat` is a μ whose output feeds in-port `k` of the
 * μ `hub`. Reading the three dangling inputs top to bottom, they are
 * [sat.0, sat.1, hub.1] when k = 0 and [hub.0, sat.0, sat.1] when
 * k = 1; the rewrite keeps them in that order and moves the
 * satellite to the other side. Coassociativity is the same with
 * wires reversed.
 */
function assoc(state: State, sat: string, hub: string): State {
  const g = gen(state, sat)!;
  // for δ, everything is mirrored: "inputs" are the out ports
  const inEnd = g === "mult" ? "to" : "from";
  const wireAt = (node: string, i: number) =>
    g === "mult" ? wireTo(state, node, i) : wireFrom(state, node, i);
  const link = g === "mult" ? wireFrom(state, sat, 0) : wireTo(state, sat, 0);
  const k = state.wires[link][inEnd].i;
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
  const wids = ports(k).map((p) => wireAt(p.node, p.i));
  return produce(state, (s) => {
    ports(1 - k).forEach((p, j) => (s.wires[wids[j]][inEnd] = p));
    s.wires[link][inEnd] = { node: hub, i: 1 - k };
    settle(s, sat, hub);
  });
}

/** The associativity partner of `id`, as [sat, hub], if any. */
function assocPair(state: State, id: string): [string, string][] {
  const g = gen(state, id);
  if (!g) return [];
  const out: [string, string][] = [];
  for (const [, w] of wiresAt(state, id)) {
    if (gen(state, w.from.node) !== g || gen(state, w.to.node) !== g) continue;
    // for μ the satellite is upstream; for δ it's downstream
    out.push(
      g === "mult" ? [w.from.node, w.to.node] : [w.to.node, w.from.node],
    );
  }
  return out;
}

/**
 * The Frobenius law relates three shapes of a μ–δ pair joined by one
 * wire. Naming the four dangling wires a, b (inputs, top to bottom)
 * and c, d (outputs):
 *
 *   H:  a, b → μ → δ → c, d
 *   ZL: δ on top: a → δ → c, and (δ.1, b) → μ → d
 *   ZR: μ on top: (a, δ.0) → μ → c, and b → δ → d
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
  return produce(state, (s) => {
    switch (to) {
      case "H":
        s.wires[a].to = { node: m, i: 0 };
        s.wires[b].to = { node: m, i: 1 };
        s.wires[cc].from = { node: c, i: 0 };
        s.wires[d].from = { node: c, i: 1 };
        s.wires[link] = { from: { node: m, i: 0 }, to: { node: c, i: 0 } };
        settle(s, m, c);
        break;
      case "ZL":
        s.wires[a].to = { node: c, i: 0 };
        s.wires[b].to = { node: m, i: 1 };
        s.wires[cc].from = { node: c, i: 0 };
        s.wires[d].from = { node: m, i: 0 };
        s.wires[link] = { from: { node: c, i: 1 }, to: { node: m, i: 0 } };
        settle(s, m, c, c);
        break;
      case "ZR":
        s.wires[a].to = { node: m, i: 0 };
        s.wires[b].to = { node: c, i: 0 };
        s.wires[cc].from = { node: m, i: 0 };
        s.wires[d].from = { node: c, i: 1 };
        s.wires[link] = { from: { node: c, i: 0 }, to: { node: m, i: 1 } };
        settle(s, m, c, m);
        break;
    }
  });
}

// ## Goal check
//
// The goal is a particular diagram, twists and all, so the check is
// an isomorphism that respects port order. Boundaries keep their
// names and every port is wired, so the match is forced: walk out
// from the boundaries, pairing up nodes port by port, and fail on
// the first disagreement.

function matches(state: State, goal: State): boolean {
  if (
    Object.keys(state.nodes).length !== Object.keys(goal.nodes).length ||
    Object.keys(state.wires).length !== Object.keys(goal.wires).length
  ) {
    return false;
  }
  /** goal node → state node */
  const pairing = new Map<string, string>();
  const paired = new Set<string>();
  const queue: string[] = [];
  const pair = (g: string, s: string): boolean => {
    if (pairing.has(g)) return pairing.get(g) === s;
    if (paired.has(s) || gen(goal, g) !== gen(state, s)) return false;
    pairing.set(g, s);
    paired.add(s);
    queue.push(g);
    return true;
  };
  for (const [id, n] of Object.entries(goal.nodes)) {
    if (n.type === "boundary" && !pair(id, id)) return false;
  }
  while (queue.length) {
    const g = queue.pop()!;
    const s = pairing.get(g)!;
    for (const [, gw] of wiresAt(goal, g)) {
      const end = gw.from.node === g ? "from" : "to";
      const other = end === "from" ? "to" : "from";
      const sw = Object.values(state.wires).find((w) =>
        samePort(w[end], { node: s, i: gw[end].i }),
      );
      if (!sw || sw[other].i !== gw[other].i) return false;
      if (!pair(gw[other].node, sw[other].node)) return false;
    }
  }
  return pairing.size === Object.keys(goal.nodes).length;
}

/** Independent loops: wires − nodes + 1 (for a connected diagram). */
function genus(state: State): number {
  return Object.keys(state.wires).length - Object.keys(state.nodes).length + 1;
}

/** The normal form with these boundaries and genus, laid out in a row. */
function normalForm(state: State): State {
  const boundaries = _.pickBy(
    state.nodes,
    (n): n is Boundary => n.type === "boundary",
  );
  const side = (s: "in" | "out") =>
    _.sortBy(
      Object.keys(boundaries).filter((id) => boundaries[id].side === s),
      (id) => boundaries[id].y,
    );
  const ins = side("in");
  const outs = side("out");
  const g = genus(state);
  const count = ins.length - 1 + 2 * g + outs.length - 1;
  const xs = _.range(count).map(
    (i) => X_MIN + 20 + ((X_MAX - X_MIN - 40) * (i + 0.5)) / count,
  );
  const nodes: Record<string, Node> = { ...boundaries };
  const wires: Record<string, Wire> = {};
  let n = 0;
  const node = (g: Gen) => {
    const id = `n${n}`;
    nodes[id] = { type: "gen", gen: g, x: xs[n], y: H / 2 };
    n++;
    return id;
  };
  const wire = (from: Port, to: Port) => {
    wires[`w${Object.keys(wires).length}`] = { from, to };
  };
  let cur: Port = { node: ins[0], i: 0 };
  for (const input of ins.slice(1)) {
    const m = node("mult");
    wire(cur, { node: m, i: 0 });
    wire({ node: input, i: 0 }, { node: m, i: 1 });
    cur = { node: m, i: 0 };
  }
  for (let i = 0; i < g; i++) {
    const d = node("comult");
    const m = node("mult");
    wire(cur, { node: d, i: 0 });
    wire({ node: d, i: 0 }, { node: m, i: 0 });
    wire({ node: d, i: 1 }, { node: m, i: 1 });
    cur = { node: m, i: 0 };
  }
  for (const output of outs.slice(0, -1)) {
    const d = node("comult");
    wire(cur, { node: d, i: 0 });
    wire({ node: d, i: 0 }, { node: output, i: 0 });
    cur = { node: d, i: 1 };
  }
  wire(cur, { node: outs[outs.length - 1], i: 0 });
  return { puzzle: state.puzzle, nodes, wires };
}

// ## Drag specs

const HIT_R = 24;

/**
 * Fires when the dragged node's *center* is within HIT_R of where
 * `target` sits, and `where` (given the center) holds.
 */
function dropOnSpec(
  d: DragSpecBuilder<State>,
  state: State,
  target: string,
  result: State,
  label: string,
  where: (center: Vec2, spot: Vec2) => boolean = () => true,
): DragSpec<State> {
  const spot = nodePos(state, target);
  return d.custom((ctx) => {
    const inner = dragSpecToBehavior<State>(d.fixed(result), ctx);
    return (frame) => {
      const center = frame.pointer.sub(ctx.anchorPos);
      const hit = center.dist(spot) < HIT_R && where(center, spot);
      return { ...inner(frame), gap: hit ? 0 : Infinity, activePath: label };
    };
  });
}

/** Every rewrite you get by dropping `id` on a neighbor. */
function dropTargets(
  d: DragSpecBuilder<State>,
  state: State,
  id: string,
): { target: string; spec: DragSpec<State> }[] {
  const out: { target: string; spec: DragSpec<State> }[] = [];
  for (const [sat, hub] of assocPair(state, id)) {
    const result = assoc(state, sat, hub);
    if (!isAcyclic(result)) continue;
    const target = sat === id ? hub : sat;
    out.push({
      target,
      spec: dropOnSpec(d, state, target, result, `assoc-${target}`),
    });
  }
  const g = gen(state, id);
  for (const other of neighbors(state, id)) {
    const og = gen(state, other);
    if (!g || !og || og === g) continue;
    const m = g === "mult" ? id : other;
    const c = g === "mult" ? other : id;
    const form = frobForm(state, m, c);
    if (!form) continue;
    const results: [FrobForm, (c: Vec2, s: Vec2) => boolean][] =
      form === "H"
        ? [
            // the dragged node lands on top if it came in from above
            [g === "comult" ? "ZL" : "ZR", (c, s) => c.y <= s.y],
            [g === "comult" ? "ZR" : "ZL", (c, s) => c.y > s.y],
          ]
        : [["H", () => true]];
    for (const [to, where] of results) {
      const result = frobenius(state, m, c, to);
      if (!isAcyclic(result)) continue;
      out.push({
        target: other,
        spec: dropOnSpec(d, state, other, result, `frob-${to}`, where),
      });
    }
  }
  return out;
}

function nodeSpec(
  d: DragSpecBuilder<State>,
  state: State,
  id: string,
): DragSpec<State> {
  const move = d.vary(
    state,
    [param("nodes", id, "x"), param("nodes", id, "y")],
    {
      constraint: (s) => {
        const n = s.nodes[id] as GenNode;
        return and(
          ...inOrder([X_MIN, n.x, X_MAX]),
          ...inOrder([Y_MIN, n.y, Y_MAX]),
        );
      },
    },
  );
  return d
    .closest([...dropTargets(d, state, id).map((t) => t.spec), move])
    .withBranchTransition(150);
}

// ## Rendering

type RenderCtx = {
  d: DragSpecBuilder<State>;
  draggedId: string | null;
  setState: (s: State) => void;
};

function renderDiagram(state: State, ctx: RenderCtx | null, prefix = "") {
  const P = (id: string) => prefix + id;
  const draggedId = ctx?.draggedId ?? null;

  // Which nodes light up as drop targets for the current drag?
  const targets = new Set<string>();
  if (ctx && draggedId) {
    const m = /^node-(.+)$/.exec(draggedId);
    if (m && state.nodes[m[1]]) {
      for (const t of dropTargets(ctx.d, state, m[1])) targets.add(t.target);
    }
  }

  return (
    <g>
      {/* banks */}
      <rect width={BANK} height={H} fill={BANK_FILL} />
      <line x1={BANK} y1={0} x2={BANK} y2={H} stroke={BANK_STROKE} />
      <rect
        transform={translate(DIAG_W - BANK, 0)}
        width={BANK}
        height={H}
        fill={BANK_FILL}
      />
      <line
        x1={DIAG_W - BANK}
        y1={0}
        x2={DIAG_W - BANK}
        y2={H}
        stroke={BANK_STROKE}
      />

      {Object.entries(state.wires).map(([wid, wire]) => (
        <path
          id={P(`wire-${wid}`)}
          d={wirePath(state, wire)}
          fill="none"
          stroke={INK}
          strokeWidth={2.5}
          strokeLinecap="round"
          dragologyZIndex={-1}
        />
      ))}

      {Object.entries(state.nodes).map(([id, node]) => {
        if (node.type === "boundary") {
          return (
            <g id={P(`bdry-${id}`)} transform={translate(nodePos(state, id))}>
              <circle r={3} fill={INK} />
            </g>
          );
        }
        const isDragged = draggedId === `node-${id}`;
        return (
          <g
            id={P(`node-${id}`)}
            className="frob-node"
            transform={translate(node.x, node.y)}
            dragologyZIndex={isDragged ? "/1" : false}
            dragologyOnDrag={ctx ? () => nodeSpec(ctx.d, state, id) : undefined}
            onClick={ctx ? () => ctx.setState(swap(state, id)) : undefined}
          >
            <circle r={18} fill="transparent" />
            {targets.has(id) && (
              <circle
                id={P(`halo-${id}`)}
                r={16}
                fill="#fde68a"
                fillOpacity={0.5}
                stroke="#d97706"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dragologyZIndex={-1}
              />
            )}
            <circle
              r={NODE_R}
              fill={node.gen === "mult" ? "white" : INK}
              stroke={INK}
              strokeWidth={2.5}
            />
          </g>
        );
      })}
    </g>
  );
}

const draggable: Draggable<State> = ({ state, d, draggedId, setState }) => {
  const proved = matches(state, GOALS[state.puzzle]);
  const goalScale = (GOAL_W - 24) / DIAG_W;
  const loops = genus(state);
  return (
    <g>
      <style>{`.frob-node { cursor: grab; }`}</style>
      {renderDiagram(state, { d, draggedId, setState })}
      <g transform={translate(DIAG_W + 8, 12)}>
        <rect
          id="goal-frame"
          dragologyZIndex={-2}
          width={GOAL_W - 16}
          height={H * goalScale + 40}
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
          {`GOAL · ${loops} loop${loops === 1 ? "" : "s"}`}
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
            DONE ∎
          </text>
        )}
        <g transform={translate(4, 30) + scale(goalScale)}>
          {renderDiagram(GOALS[state.puzzle], null, "goal-")}
        </g>
      </g>
    </g>
  );
};

// ## Puzzles

type Puzzle = { title: string; blurb: string; start: State };

const bd = (side: "in" | "out", y: number): Boundary => ({
  type: "boundary",
  side,
  y,
});
const mu = (x: number, y: number): GenNode => ({
  type: "gen",
  gen: "mult",
  x,
  y,
});
const de = (x: number, y: number): GenNode => ({
  type: "gen",
  gen: "comult",
  x,
  y,
});

/**
 * Build a puzzle from a list of [from, to] node ids. Ports are
 * assigned so wires leave and enter each node in the order of their
 * other ends' heights, which keeps the start free of needless
 * twists.
 */
function puzzle(
  id: PuzzleId,
  nodes: Record<string, Node>,
  list: [string, string][],
): State {
  const base: State = { puzzle: id, nodes, wires: {} };
  const wires: Record<string, Wire> = Object.fromEntries(
    list.map(([from, to], i) => [
      `w${i}`,
      { from: { node: from, i: 0 }, to: { node: to, i: 0 } },
    ]),
  );
  for (const nid of Object.keys(nodes)) {
    for (const end of ["from", "to"] as const) {
      const other = end === "from" ? "to" : "from";
      const mine = Object.keys(wires).filter(
        (wid) => wires[wid][end].node === nid,
      );
      _.sortBy(
        mine,
        (wid) => nodePos(base, wires[wid][other].node).y,
        (wid) => wid,
      ).forEach((wid, i) => (wires[wid][end].i = i));
    }
  }
  return { ...base, wires };
}

/** The zigzag form of the Frobenius law. */
const frobeniusStart = puzzle(
  "frobenius",
  {
    a: bd("in", 120),
    b: bd("in", 240),
    c: bd("out", 120),
    e: bd("out", 240),
    d: de(160, 120),
    m: mu(300, 240),
  },
  [
    ["a", "d"],
    ["d", "c"],
    ["d", "m"],
    ["b", "m"],
    ["m", "e"],
  ],
);

/** Two splits, two merges, wires crossed between them. */
const crossStart = puzzle(
  "cross",
  {
    in1: bd("in", 100),
    in2: bd("in", 260),
    out1: bd("out", 100),
    out2: bd("out", 260),
    d1: de(140, 100),
    d2: de(140, 260),
    m1: mu(320, 100),
    m2: mu(320, 260),
  },
  [
    ["in1", "d1"],
    ["in2", "d2"],
    ["d1", "m1"],
    ["d1", "m2"],
    ["d2", "m1"],
    ["d2", "m2"],
    ["m1", "out1"],
    ["m2", "out2"],
  ],
);

/** One wire splits into four strands that cross and merge back. */
const weaveStart = puzzle(
  "weave",
  {
    in1: bd("in", 180),
    out1: bd("out", 180),
    d1: de(100, 180),
    d2: de(180, 100),
    d3: de(180, 260),
    m1: mu(280, 100),
    m2: mu(280, 260),
    m3: mu(360, 180),
  },
  [
    ["in1", "d1"],
    ["d1", "d2"],
    ["d1", "d3"],
    ["d2", "m1"],
    ["d2", "m2"],
    ["d3", "m1"],
    ["d3", "m2"],
    ["m1", "m3"],
    ["m2", "m3"],
    ["m3", "out1"],
  ],
);

/** Traced from a hand-drawn lattice: 4 δs, 5 μs, two in, one out. */
const px = (x: number) => BANK + (x - 110) * 0.243;
const py = (y: number) => 68 + (y - 140) * 0.243;
const latticeStart = puzzle(
  "lattice",
  {
    in1: bd("in", py(510)),
    in2: bd("in", py(770)),
    out1: bd("out", py(645)),
    d1: de(px(450), py(430)),
    d2: de(px(450), py(850)),
    d3: de(px(690), py(225)),
    d4: de(px(690), py(1055)),
    m1: mu(px(1010), py(220)),
    m2: mu(px(1010), py(1065)),
    m3: mu(px(1250), py(415)),
    m4: mu(px(1250), py(865)),
    m5: mu(px(1550), py(645)),
  },
  [
    ["in1", "d1"],
    ["in2", "d2"],
    ["d1", "d3"],
    ["d1", "m2"],
    ["d2", "d4"],
    ["d2", "m1"],
    ["d3", "m1"],
    ["d3", "m4"],
    ["d4", "m2"],
    ["d4", "m3"],
    ["m1", "m3"],
    ["m2", "m4"],
    ["m3", "m5"],
    ["m4", "m5"],
    ["m5", "out1"],
  ],
);

/**
 * Three strands, each split in two; neighbors merge, the last with
 * the first (around the back); and again.
 */
const braidStart = (() => {
  const ys = [90, 180, 270];
  const nodes: Record<string, Node> = {};
  const list: [string, string][] = [];
  ys.forEach((y, i) => {
    nodes[`in${i}`] = bd("in", y);
    nodes[`out${i}`] = bd("out", y);
  });
  let feeds = ys.map((_y, i) => `in${i}`);
  [80, 230].forEach((x, round) => {
    const ds = ys.map((y, i) => {
      const id = `d${round}${i}`;
      nodes[id] = de(x, y);
      list.push([feeds[i], id]);
      return id;
    });
    feeds = ys.map((y, i) => {
      const id = `m${round}${i}`;
      nodes[id] = mu(x + 80, y);
      list.push([ds[i], id], [ds[(i + 1) % ys.length], id]);
      return id;
    });
  });
  feeds.forEach((f, i) => list.push([f, `out${i}`]));
  return puzzle("braid", nodes, list);
})();

const PUZZLES: Record<PuzzleId, Puzzle> = {
  frobenius: {
    title: "Frobenius",
    blurb:
      "The zigzag form of the Frobenius law. Drop the μ (hollow) onto the " +
      "δ (solid), or the δ onto the μ, to get δ∘μ.",
    start: frobeniusStart,
  },
  cross: {
    title: "Cross",
    blurb:
      "Two splits whose strands cross over to two merges: one loop. " +
      "Untangle it into a merge, a handle, and a split.",
    start: crossStart,
  },
  weave: {
    title: "Weave",
    blurb:
      "One wire splits into four strands that cross and merge back: three " +
      "loops. Pull it out into a chain of three handles.",
    start: weaveStart,
  },
  lattice: {
    title: "Lattice",
    blurb: "Nine nodes woven into a lattice, with four loops.",
    start: latticeStart,
  },
  braid: {
    title: "Braid",
    blurb:
      "Three strands, split and re-merged with their neighbors twice " +
      "over: four loops, three in, three out.",
    start: braidStart,
  },
};

const GOALS = _.mapValues(PUZZLES, (p) => normalForm(p.start));

const PUZZLE_ORDER: PuzzleId[] = [
  "frobenius",
  "cross",
  "weave",
  "lattice",
  "braid",
];

export default demo(
  () => {
    const [puzzleId, setPuzzleId] = useState<PuzzleId>("frobenius");
    const [attempt, setAttempt] = useState(0);
    const puzzle = PUZZLES[puzzleId];
    return (
      <>
        <DemoNotes>
          <p className="mb-2 font-bold">⚠️ Just a seed!</p>
          <p>
            String diagrams for a commutative Frobenius algebra, flowing left to
            right: <b>μ</b> (hollow) merges two wires, <b>δ</b> (solid) splits
            one. <b>Drag</b> nodes around freely; <b>click</b> a node to swap
            its two inputs or outputs (commutativity);{" "}
            <b>drop a μ on the μ it feeds</b> to reassociate (likewise δ);{" "}
            <b>drop a μ on a δ</b> it's wired to, or vice versa, for the
            Frobenius law (from δ∘μ, come in from above or below to pick which
            zigzag).
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
    tags: ["d.closest", "d.custom", "d.vary", "spec.withBranchTransition"],
  },
);
