// Rearranging equations by direct manipulation, after Graspable Math
// (graspablemath.com): drag a term across the equals sign and its sign
// flips, drag a factor across and it divides the other side, drop one
// term onto another to combine them, an exponent onto its base to
// multiply it out, a log's base onto its argument to evaluate it.

import _ from "lodash";
import { Children, isValidElement, useState } from "react";
import { demo } from "../demo";
import { DemoDraggable, DemoNotes } from "../demo/ui";
import { type DragFrame, type DragInitContext } from "../DragBehavior";
import { Draggable } from "../draggable";
import {
  type DragSpec,
  type DragSpecBuilder,
  type DragSpecData,
  modifier,
} from "../DragSpec";
import { Vec2 } from "../math/vec2";
import { Modifier } from "../op";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";
import { makeId } from "../utils";
import { assert } from "../utils/assert";

// # Expressions

type Num = { kind: "num"; id: string; value: number };
type Var = { kind: "var"; id: string; name: string };
type Term = { sign: 1 | -1; expr: Expr };
type Sum = { kind: "sum"; id: string; terms: Term[] };
type Prod = { kind: "prod"; id: string; factors: Expr[] };
type Frac = { kind: "frac"; id: string; num: Expr; den: Expr };
type Pow = { kind: "pow"; id: string; base: Expr; exp: Expr };
/** log_base(arg). */
type Log = { kind: "log"; id: string; base: Expr; arg: Expr };
/** Numbers are never negative: signs live on the terms of sums. */
type Expr = Num | Var | Sum | Prod | Frac | Pow | Log;

type Side = "lhs" | "rhs";
type State = {
  lhs: Expr;
  rhs: Expr;
  /**
   * Only in previews: a term or factor that's about to be folded into
   * another, drawn as a puff of cloud under the pointer.
   */
  puff?: Puff;
};
/**
 * The node, its sign if it's a term, its size (smaller in a superscript),
 * and where to draw it: where the node it's folding into is now.
 */
type Puff = {
  expr: Expr;
  sign: 1 | -1 | null;
  size: number;
  at: { x: number; y: number };
};

const newId = () => `n-${makeId()}`;
const num = (value: number, id = newId()): Num => ({ kind: "num", id, value });
const isNum = (e: Expr, value: number) => e.kind === "num" && e.value === value;
const otherSide = (side: Side): Side => (side === "lhs" ? "rhs" : "lhs");

const termsOf = (e: Expr): Term[] =>
  e.kind === "sum" ? e.terms : [{ sign: 1, expr: e }];
const factorsOf = (e: Expr): Expr[] => (e.kind === "prod" ? e.factors : [e]);

// The constructors keep expressions in normal form: no sums or
// products of fewer than two things (except a lone negated term), no
// sums directly inside sums or products inside products, no "/1" or
// "^1".

function mkSum(terms: Term[], id: string): Expr {
  const flat = terms.flatMap((t): Term[] =>
    t.expr.kind === "sum"
      ? t.expr.terms.map(
          (u) => ({ sign: t.sign * u.sign, expr: u.expr }) as Term,
        )
      : [t],
  );
  if (flat.length === 0) return num(0);
  if (flat.length === 1 && flat[0].sign === 1) return flat[0].expr;
  return { kind: "sum", id, terms: flat };
}

function mkProd(factors: Expr[], id: string): Expr {
  const flat = factors.flatMap(factorsOf);
  if (flat.length === 0) return num(1);
  if (flat.length === 1) return flat[0];
  return { kind: "prod", id, factors: flat };
}

function mkFrac(numer: Expr, den: Expr, id: string): Expr {
  if (isNum(den, 1)) return numer;
  return { kind: "frac", id, num: numer, den };
}

function mkPow(base: Expr, exp: Expr, id: string): Expr {
  if (isNum(exp, 1)) return base;
  return { kind: "pow", id, base, exp };
}

function normalize(e: Expr): Expr {
  switch (e.kind) {
    case "num":
    case "var":
      return e;
    case "sum":
      return mkSum(
        e.terms.map((t) => ({ sign: t.sign, expr: normalize(t.expr) })),
        e.id,
      );
    case "prod":
      return mkProd(e.factors.map(normalize), e.id);
    case "frac":
      return mkFrac(normalize(e.num), normalize(e.den), e.id);
    case "pow":
      return mkPow(normalize(e.base), normalize(e.exp), e.id);
    case "log":
      return { ...e, base: normalize(e.base), arg: normalize(e.arg) };
  }
}

function mapExpr(e: Expr, id: string, f: (e: Expr) => Expr): Expr {
  if (e.id === id) return f(e);
  switch (e.kind) {
    case "num":
    case "var":
      return e;
    case "sum":
      return {
        ...e,
        terms: e.terms.map((t) => ({ ...t, expr: mapExpr(t.expr, id, f) })),
      };
    case "prod":
      return { ...e, factors: e.factors.map((x) => mapExpr(x, id, f)) };
    case "frac":
      return { ...e, num: mapExpr(e.num, id, f), den: mapExpr(e.den, id, f) };
    case "pow":
      return { ...e, base: mapExpr(e.base, id, f), exp: mapExpr(e.exp, id, f) };
    case "log":
      return { ...e, base: mapExpr(e.base, id, f), arg: mapExpr(e.arg, id, f) };
  }
}

/** `state` with node `id` (on either side) replaced by `replacement`. */
function replaceNode(state: State, id: string, replacement: Expr): State {
  return {
    lhs: normalize(mapExpr(state.lhs, id, () => replacement)),
    rhs: normalize(mapExpr(state.rhs, id, () => replacement)),
  };
}

function setSide(state: State, side: Side, e: Expr): State {
  return { ...state, [side]: normalize(e) };
}

function cloneFresh(e: Expr): Expr {
  switch (e.kind) {
    case "num":
    case "var":
      return { ...e, id: newId() };
    case "sum":
      return {
        ...e,
        id: newId(),
        terms: e.terms.map((t) => ({ ...t, expr: cloneFresh(t.expr) })),
      };
    case "prod":
      return { ...e, id: newId(), factors: e.factors.map(cloneFresh) };
    case "frac":
      return {
        ...e,
        id: newId(),
        num: cloneFresh(e.num),
        den: cloneFresh(e.den),
      };
    case "pow":
      return {
        ...e,
        id: newId(),
        base: cloneFresh(e.base),
        exp: cloneFresh(e.exp),
      };
    case "log":
      return {
        ...e,
        id: newId(),
        base: cloneFresh(e.base),
        arg: cloneFresh(e.arg),
      };
  }
}

/** A key that's equal for expressions equal up to ids and the order of factors. */
function exprKey(e: Expr): string {
  switch (e.kind) {
    case "num":
      return String(e.value);
    case "var":
      return e.name;
    case "sum":
      return `(${e.terms.map((t) => (t.sign < 0 ? "-" : "+") + exprKey(t.expr)).join("")})`;
    case "prod":
      return `[${e.factors.map(exprKey).sort().join("*")}]`;
    case "frac":
      return `{${exprKey(e.num)}/${exprKey(e.den)}}`;
    case "pow":
      return `<${exprKey(e.base)}^${exprKey(e.exp)}>`;
    case "log":
      return `log<${exprKey(e.base)}>(${exprKey(e.arg)})`;
  }
}

function insertAt<X>(xs: X[], i: number, x: X): X[] {
  return [...xs.slice(0, i), x, ...xs.slice(i)];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// # Algebra

/** A term as coefficient × the rest, if it's that simple. */
function splitCoefficient(e: Expr) {
  const factors = factorsOf(e);
  if (factors.some((f) => f.kind === "sum" || f.kind === "frac")) return null;
  const nums = factors.filter((f): f is Num => f.kind === "num");
  return {
    coef: _.reduce(nums, (acc, f) => acc * f.value, 1),
    coefId: nums[0]?.id ?? null,
    rest: factors.filter((f) => f.kind !== "num"),
  };
}

/**
 * Drop term `t` onto term `u` of the same sum: if they're like terms,
 * the terms that replace `u` (none if they cancel).
 */
function combineTerms(t: Term, u: Term): Term[] | null {
  const a = splitCoefficient(t.expr);
  const b = splitCoefficient(u.expr);
  if (!a || !b) return null;
  if (a.rest.map(exprKey).sort().join() !== b.rest.map(exprKey).sort().join())
    return null;
  const c = t.sign * a.coef + u.sign * b.coef;
  if (c === 0) return [];
  const coef =
    b.rest.length > 0 && Math.abs(c) === 1
      ? []
      : [num(Math.abs(c), b.coefId ?? newId())];
  const expr = mkProd(
    [...coef, ...b.rest],
    u.expr.kind === "prod" ? u.expr.id : newId(),
  );
  return [{ sign: c < 0 ? -1 : 1, expr }];
}

/**
 * `e` as base^n, for a whole number n (so x is x^1). Not for numbers,
 * which multiply out instead.
 */
function powerOf(e: Expr): { base: Expr; n: number } | null {
  if (e.kind === "num") return null;
  if (e.kind === "pow") {
    return e.exp.kind === "num" ? { base: e.base, n: e.exp.value } : null;
  }
  return { base: e, n: 1 };
}

/**
 * Drop factor `f` onto factor `g` of the same product: their product as
 * one factor, if numbers multiply or powers of one base add exponents.
 */
function mergeFactors(f: Expr, g: Expr): Expr | null {
  if (f.kind === "num" && g.kind === "num") return num(f.value * g.value, g.id);
  const a = powerOf(f);
  const b = powerOf(g);
  if (!a || !b || exprKey(a.base) !== exprKey(b.base)) return null;
  const n = a.n + b.n;
  if (g.kind === "pow") return { ...g, exp: num(n, g.exp.id) };
  return { kind: "pow", id: newId(), base: g, exp: num(n) };
}

/** `f` × `e`, folding each factor of `f` into a factor of `e` it merges with. */
function multiplyInto(f: Expr, e: Expr): Expr {
  if (e.kind === "frac") return mkFrac(multiplyInto(f, e.num), e.den, e.id);
  if (e.kind === "sum") return mkProd([f, e], newId());
  return factorsOf(f).reduce((acc, g) => multiplyFactor(g, acc), e);
}

function multiplyFactor(f: Expr, e: Expr): Expr {
  if (isNum(f, 1)) return e;
  if (isNum(e, 1)) return f;
  const factors = factorsOf(e);
  const prodId = e.kind === "prod" ? e.id : newId();
  for (let k = 0; k < factors.length; k++) {
    const merged = mergeFactors(f, factors[k]);
    if (merged) {
      return mkProd(
        factors.map((h, i) => (i === k ? merged : h)),
        prodId,
      );
    }
  }
  // Numbers go first, other factors after the numbers.
  const at =
    f.kind === "num" ? 0 : _.takeWhile(factors, (g) => g.kind === "num").length;
  return mkProd(insertAt(factors, at, f), prodId);
}

/**
 * Drop factor `f` onto the sum `g` it multiplies. A sum `f` multiplies
 * out term by term.
 */
function distribute(f: Expr, g: Sum): Expr {
  return mkSum(
    termsOf(f).flatMap((t, i) =>
      g.terms.map(
        (u): Term => ({
          sign: (t.sign * u.sign) as 1 | -1,
          // `g`'s terms keep their ids the first time round.
          expr: multiplyInto(
            cloneFresh(t.expr),
            i === 0 ? u.expr : cloneFresh(u.expr),
          ),
        }),
      ),
    ),
    g.id,
  );
}

/**
 * Drop factor `f` onto factor `g` across a fraction bar: what's left
 * of each (null if nothing), if anything cancels.
 */
function cancel(f: Expr, g: Expr): { f: Expr | null; g: Expr | null } | null {
  if (f.kind === "num" && g.kind === "num") {
    const k = gcd(f.value, g.value);
    if (k <= 1) return null;
    const left = (n: Num, id: string) =>
      n.value === k ? null : num(n.value / k, id);
    // What's left of `f` is new, so that `f` itself folds away.
    return { f: left(f, newId()), g: left(g, g.id) };
  }
  const a = powerOf(f);
  const b = powerOf(g);
  if (!a || !b || exprKey(a.base) !== exprKey(b.base)) return null;
  const k = Math.min(a.n, b.n);
  if (k === 0) return null;
  // Only a power can have exponent left over.
  const lower = (e: Expr, n: number) =>
    n === 0
      ? null
      : e.kind === "pow"
        ? mkPow(e.base, num(n, e.exp.id), e.id)
        : e;
  const left = lower(f, a.n - k);
  return { f: left && cloneFresh(left), g: lower(g, b.n - k) };
}

/** b^n as a number, if it's a whole one (and not too big). */
function evalPow(base: Expr, exp: Expr): number | null {
  if (base.kind !== "num") return null;
  if (exp.kind === "num") {
    const v = base.value ** exp.value;
    return v <= 1e6 ? v : null;
  }
  // An nth root, if it comes out even.
  if (exp.kind === "frac" && isNum(exp.num, 1) && exp.den.kind === "num") {
    const n = exp.den.value;
    const r = Math.round(base.value ** (1 / n));
    return r ** n === base.value ? r : null;
  }
  return null;
}

/** log_b(a), if it simplifies: to a whole number, or the exponent of a power of b. */
function evalLog(b: Expr, a: Expr): Expr | null {
  if (isNum(a, 1)) return num(0, a.id);
  if (a.kind === "pow" && exprKey(a.base) === exprKey(b)) return a.exp;
  if (exprKey(a) === exprKey(b)) return num(1, a.id);
  if (b.kind !== "num" || a.kind !== "num" || b.value < 2) return null;
  let k = 0;
  for (let v = 1; v < a.value; v *= b.value) k++;
  return b.value ** k === a.value ? num(k, a.id) : null;
}

/** Ways to write `e` ÷ `f`. */
function dividedBy(e: Expr, f: Expr): Expr[] {
  if (e.kind === "sum" && e.terms.length === 1) {
    return dividedBy(e.terms[0].expr, f).map((x) =>
      mkSum([{ sign: -1, expr: x }], e.id),
    );
  }
  if (e.kind === "frac") {
    const den = factorsOf(e.den);
    const denId = e.den.kind === "prod" ? e.den.id : newId();
    return _.range(den.length + 1).map((j) =>
      mkFrac(e.num, mkProd(insertAt(den, j, f), denId), e.id),
    );
  }
  return [mkFrac(e, f, newId())];
}

/** Ways to write `e` × `f`. */
function multipliedBy(e: Expr, f: Expr): Expr[] {
  if (e.kind === "sum" && e.terms.length === 1) {
    return multipliedBy(e.terms[0].expr, f).map((x) =>
      mkSum([{ sign: -1, expr: x }], e.id),
    );
  }
  if (e.kind === "frac") {
    const numer = factorsOf(e.num);
    const numId = e.num.kind === "prod" ? e.num.id : newId();
    return _.range(numer.length + 1).map((j) =>
      mkFrac(mkProd(insertAt(numer, j, f), numId), e.den, e.id),
    );
  }
  const prodId = newId();
  if (e.kind === "sum") return [mkProd([f, e], prodId), mkProd([e, f], prodId)];
  const factors = factorsOf(e);
  const id = e.kind === "prod" ? e.id : prodId;
  return _.range(factors.length + 1).map((j) =>
    mkProd(insertAt(factors, j, f), id),
  );
}

// # Drag specs

type Ctx = {
  state: State;
  d: DragSpecBuilder<State>;
  /** Nothing is being dragged (so hover highlights make sense). */
  idle: boolean;
  /** Drawing a puff: the node itself is invisible, leaving only its cloud. */
  hidden?: boolean;
  /** Type size, as a fraction of the full size (smaller in superscripts). */
  size: number;
};

/** Where a node is drawn: its origin, and the left and right of its box. */
type NodeBox = { x: number; y: number; left: number; right: number };

function findNode(svg: Svgx, id: string, x = 0, y = 0): NodeBox | null {
  for (const [, tx, ty] of (svg.props.transform ?? "").matchAll(
    /translate\(([^,]+),([^)]+)\)/g,
  )) {
    x += Number(tx);
    y += Number(ty);
  }
  const children = Children.toArray(svg.props.children).filter(isValidElement);
  if (svg.props.id === id) {
    // A node's first child is the rect covering it (see `layout`).
    const { props } = children[0] as Svgx;
    const left = x + Number(props.x);
    return { x, y, left, right: left + Number(props.width) };
  }
  for (const child of children) {
    const found = findNode(child as Svgx, id, x, y);
    if (found) return found;
  }
  return null;
}

/** Looks up where nodes are drawn in the current state. */
type Where = (id: string) => NodeBox;

function nodeFinder(ctx: Ctx): Where {
  const svg = _.once(() => drawEquation(ctx));
  return (id) => {
    const box = findNode(svg(), id);
    assert(box !== null, `node ${id} isn't drawn`);
    return box;
  };
}

/**
 * Drop the dragged node on the node `targetId` to get `merged`, which
 * the dragged node is folded into. Over the target, it's a puff.
 */
function mergeTarget(
  ctx: Ctx,
  where: Where,
  targetId: string,
  dragged: Omit<Puff, "at" | "size">,
  merged: State,
): DragSpec<State> {
  const { x, y } = where(targetId);
  const puff = { ...dragged, size: ctx.size, at: { x, y } };
  const preview = { ...merged, puff };
  return ctx.d
    .dropTarget(targetId, preview, { boundsState: ctx.state })
    .onDrop(merged);
}

/** Counts the wrapped spec out of a `closest` (infinite gap) except when `when(pointer)`. */
const onlyWhen = modifier(
  class<T extends object> extends Modifier<T> {
    readonly name = "onlyWhen";

    constructor(
      ctx: DragInitContext<T>,
      inner: DragSpecData<T>,
      readonly when: (pointer: Vec2) => boolean,
    ) {
      super(ctx, inner);
    }

    frame(frame: DragFrame) {
      const result = this.inner.run(frame);
      return this.when(frame.pointer) ? result : { ...result, gap: Infinity };
    }
  },
);

/**
 * Moving item `idx` of a row (of nodes `ids`) to each position `j`, as
 * `stateAt(j)`. A move that passes over items it could merge with only
 * counts once the pointer's past them, so heading for a merge doesn't
 * shove the target out of the way.
 */
function reorders(
  { d }: Ctx,
  where: Where,
  ids: string[],
  idx: number,
  mergeable: Set<number>,
  stateAt: (j: number) => State,
): (State | DragSpec<State>)[] {
  return _.range(ids.length).map((j) => {
    const passed = (j < idx ? _.range(j, idx) : _.range(idx + 1, j + 1))
      .filter((k) => mergeable.has(k))
      .map((k) => where(ids[k]));
    if (passed.length === 0) return stateAt(j);
    const left = _.min(passed.map((b) => b.left))!;
    const right = _.max(passed.map((b) => b.right))!;
    return d
      .fixed(stateAt(j))
      .with(onlyWhen((p: Vec2) => (j < idx ? p.x < left : p.x > right)));
  });
}

/**
 * Drag term `idx` of `terms` (a sum's, or a lone side's): reorder it,
 * move it to the other side (if `across` is the side it's on), or drop
 * it on a like term.
 */
function termDrag(
  ctx: Ctx,
  terms: Term[],
  idx: number,
  setTerms: (terms: Term[]) => State,
  across: Side | null,
): DragSpec<State> {
  const { state, d } = ctx;
  const where = nodeFinder(ctx);
  const t = terms[idx];
  const without = terms.filter((_t, i) => i !== idx);
  const targets: (State | DragSpec<State>)[] = [];
  const mergeable = new Set<number>();

  terms.forEach((u, k) => {
    if (k === idx) return;
    const combined = combineTerms(t, u);
    if (!combined) return;
    const next = terms.flatMap((v, i) =>
      i === idx ? [] : i === k ? combined : [v],
    );
    mergeable.add(k);
    targets.push(
      mergeTarget(
        ctx,
        where,
        u.expr.id,
        { expr: t.expr, sign: t.sign },
        setTerms(next),
      ),
    );
  });

  targets.push(
    ...reorders(
      ctx,
      where,
      terms.map((u) => u.expr.id),
      idx,
      mergeable,
      (j) => setTerms(insertAt(without, j, t)),
    ),
  );

  if (across) {
    const o = otherSide(across);
    const there = state[o];
    const thereTerms = isNum(there, 0) ? [] : termsOf(there);
    const sumId = there.kind === "sum" ? there.id : newId();
    const moved: Term = { sign: t.sign === 1 ? -1 : 1, expr: t.expr };
    const base = setTerms(without);
    for (let j = 0; j <= thereTerms.length; j++) {
      targets.push(
        setSide(base, o, mkSum(insertAt(thereTerms, j, moved), sumId)),
      );
    }
  }

  return d.closest(targets).whenFar(state).withFloating();
}

/** A list of factors that multiply together: a product's, or one side of a fraction bar. */
type FactorList = {
  factors: Expr[];
  set: (factors: Expr[]) => State;
  /**
   * If a factor can move across the equals sign: the side it's on, and
   * whether it's above the bar (so it divides the other side) or below.
   */
  across: { side: Side; part: "num" | "den" } | null;
  /** The factors across the fraction bar, which can cancel with these. */
  opposite: {
    factors: Expr[];
    setBoth: (mine: Expr[], theirs: Expr[]) => State;
  } | null;
};

/**
 * Drag factor `idx` of `list`: reorder it, move it across the equals
 * sign, multiply it onto a number or into a sum, or cancel it against
 * a factor across the bar.
 */
function factorDrag(ctx: Ctx, list: FactorList, idx: number): DragSpec<State> {
  const { state, d } = ctx;
  const { factors } = list;
  const where = nodeFinder(ctx);
  const f = factors[idx];
  const without = factors.filter((_f, i) => i !== idx);
  const targets: (State | DragSpec<State>)[] = [];
  const mergeable = new Set<number>();

  factors.forEach((g, k) => {
    if (k === idx) return;
    const merged = g.kind === "sum" ? distribute(f, g) : mergeFactors(f, g);
    if (!merged) return;
    const next = factors.flatMap((h, i) =>
      i === idx ? [] : i === k ? [merged] : [h],
    );
    mergeable.add(k);
    targets.push(
      mergeTarget(ctx, where, g.id, { expr: f, sign: null }, list.set(next)),
    );
  });

  if (list.opposite) {
    const opp = list.opposite;
    opp.factors.forEach((g, k) => {
      const c = cancel(f, g);
      if (!c) return;
      const mine = factors.flatMap((h, i) =>
        i === idx ? (c.f ? [c.f] : []) : [h],
      );
      const theirs = opp.factors.flatMap((h, i) =>
        i === k ? (c.g ? [c.g] : []) : [h],
      );
      targets.push(
        mergeTarget(
          ctx,
          where,
          g.id,
          { expr: f, sign: null },
          opp.setBoth(mine, theirs),
        ),
      );
    });
  }

  targets.push(
    ...reorders(
      ctx,
      where,
      factors.map((g) => g.id),
      idx,
      mergeable,
      (j) => list.set(insertAt(without, j, f)),
    ),
  );

  // Never divide by zero.
  if (list.across && !isNum(f, 0)) {
    const { side, part } = list.across;
    const o = otherSide(side);
    const base = list.set(without);
    const options =
      part === "num" ? dividedBy(state[o], f) : multipliedBy(state[o], f);
    for (const there of options) targets.push(setSide(base, o, there));
  }

  return d.closest(targets).whenFar(state).withFloating();
}

/**
 * Drag the exponent of `pow`: onto its base to work it out (or write
 * it as a product), across the equals sign as a root (if `pow` is
 * `side`, and the root is odd, so there's only one), or out in front of
 * `log`, if `pow` is its argument.
 */
function expDrag(
  ctx: Ctx,
  pow: Pow,
  side: Side | null,
  log: Log | null,
): DragSpec<State> {
  const { state, d } = ctx;
  const { base, exp } = pow;
  const targets: (State | DragSpec<State>)[] = [];
  const n = exp.kind === "num" ? exp.value : null;
  const v = evalPow(base, exp);
  const worked =
    v !== null
      ? num(v, base.id)
      : n !== null && n >= 2 && n <= 5
        ? mkProd([base, ..._.range(n - 1).map(() => cloneFresh(base))], newId())
        : null;
  if (worked) {
    targets.push(
      mergeTarget(
        ctx,
        nodeFinder(ctx),
        base.id,
        { expr: exp, sign: null },
        replaceNode(state, pow.id, worked),
      ),
    );
  }
  if (side && n !== null && n % 2 === 1) {
    const o = otherSide(side);
    const root = mkPow(state[o], mkFrac(num(1), exp, newId()), newId());
    targets.push(setSide(setSide(state, side, base), o, root));
  }
  if (log) {
    const pulled = mkProd([exp, { ...log, arg: base }], newId());
    targets.push(replaceNode(state, log.id, pulled));
  }
  return d.closest(targets).whenFar(state).withFloating();
}

/** Drag the base of `pow`, which is `side`, across: b^A = C becomes A = log_b(C). */
function powBaseDrag(ctx: Ctx, pow: Pow, side: Side): DragSpec<State> {
  const { state, d } = ctx;
  const o = otherSide(side);
  const log: Log = { kind: "log", id: newId(), base: pow.base, arg: state[o] };
  const target = setSide(setSide(state, side, pow.exp), o, log);
  return d.closest([target]).whenFar(state).withFloating();
}

/**
 * Drag the base of `log`: onto its argument to work it out, or across
 * the equals sign (if `log` is `side`): log_b(A) = C becomes A = b^C.
 */
function logBaseDrag(ctx: Ctx, log: Log, side: Side | null): DragSpec<State> {
  const { state, d } = ctx;
  const targets: (State | DragSpec<State>)[] = [];
  const v = evalLog(log.base, log.arg);
  if (v) {
    targets.push(
      mergeTarget(
        ctx,
        nodeFinder(ctx),
        log.arg.id,
        { expr: log.base, sign: null },
        replaceNode(state, log.id, v),
      ),
    );
  }
  if (side) {
    const o = otherSide(side);
    const pow = mkPow(log.base, state[o], newId());
    targets.push(setSide(setSide(state, side, log.arg), o, pow));
  }
  return d.closest(targets).whenFar(state).withFloating();
}

// # Layout

const FONT = 34;
const EM = FONT;
const FONT_FAMILY = `"Times New Roman", Times, serif`;
const INK = "#1f2937";
const W = 640;
const H = 240;
const BASELINE = 128;
const EQ_X = W / 2;
const EQ_GAP = 0.55 * EM;

// Metrics, in ems.
const ASC = 0.72;
const DESC = 0.24;
const DIGIT_W = 0.5;
const LETTER_W = 0.5;
const PAREN_W = 0.36;
const BAR_AXIS = 0.27;
const BAR_GAP = 0.1;
const BAR_OVERHANG = 0.12;
const LOG_W = 1.3;
/** The size of superscripts and subscripts, relative to what they're on. */
const SCRIPT = 0.62;

const textProps = (size: number) =>
  ({
    fontSize: FONT * size,
    fontFamily: FONT_FAMILY,
    fill: INK,
    textAnchor: "middle",
    pointerEvents: "none",
  }) as const;

/** A glyph drawn before a node: a term's sign, or a multiplication dot. */
type Lead = { text: string; w: number };
const NO_LEAD: Lead = { text: "", w: 0 };
const dotLead = (size: number): Lead => ({ text: "·", w: 0.42 * EM * size });
function termLead(sign: 1 | -1, i: number, size: number): Lead {
  const em = EM * size;
  if (i === 0) return sign < 0 ? { text: "−", w: 0.68 * em } : NO_LEAD;
  return { text: sign < 0 ? "−" : "+", w: 1.1 * em };
}

/** Juxtaposing this after a number would read as one number. */
const leadsWithDigit = (e: Expr): boolean =>
  e.kind === "num" || (e.kind === "pow" && leadsWithDigit(e.base));

type Place = {
  lead: Lead;
  /** What dragging this node does, if anything. */
  drag: (() => DragSpec<State>) | null;
  /** This node is part of a term that moves as a whole. */
  inert: boolean;
  /** This node moves as a whole: its parts aren't draggable. */
  atomic: boolean;
  /** This node is its side of the equation (up to sign). */
  sideLevel: boolean;
  /** For a sum that's a factor. */
  parens?: boolean;
  /** For a product above or below a fraction bar. */
  factorList?: FactorList;
  /** This node is the argument of `log`. */
  log?: Log;
  /** Draw a cloud behind this node. */
  puff?: boolean;
};

type Box = {
  w: number;
  asc: number;
  desc: number;
  draw: (x: number, y: number) => Svgx;
};

/** Content of a node, drawn from (0, baseline). */
type Inner = { w: number; asc: number; desc: number; draw: () => Svgx[] };

/**
 * Opacity for a glyph. (Hidden nodes hide glyph by glyph: a node's own
 * opacity would carry down to its cloud, which is a layer inside it.)
 */
const visible = (ctx: Ctx, shown: boolean) => (shown && !ctx.hidden ? 1 : 0);

function layout(e: Expr, p: Place, ctx: Ctx, side: Side): Box {
  const inner = layoutInner(e, p, ctx, side);
  const em = EM * ctx.size;
  const w = p.lead.w + inner.w;
  const asc = Math.max(ASC * em, inner.asc);
  const desc = Math.max(DESC * em, inner.desc);
  return {
    w,
    asc,
    desc,
    // The node's origin is where its content starts, with the lead to
    // its left, so a term stays put under the pointer when its sign
    // changes width.
    draw: (x, y) => (
      <g
        id={e.id}
        transform={translate(x + p.lead.w, y)}
        dragologyOnDrag={p.drag ?? undefined}
      >
        {/* Catches the pointer for the whole node, including parts
            (inert or not draggable) that let it through. */}
        <rect
          x={-p.lead.w}
          y={-asc}
          width={w}
          height={asc + desc}
          rx={6}
          fill="transparent"
          className={ctx.idle ? "hover:fill-sky-500/10" : undefined}
          pointerEvents={p.drag ? "all" : "none"}
        />
        <text
          transform={translate(-p.lead.w / 2, 0)}
          {...textProps(ctx.size)}
          opacity={visible(ctx, !!p.lead.text)}
        >
          {p.lead.text || "+"}
        </text>
        {inner.draw()}
        {p.puff && (
          <g id={`${e.id}-puff`} dragologyZIndex={-1}>
            {drawPoof(inner.w / 2, -0.3 * em, em)}
          </g>
        )}
      </g>
    ),
  };
}

/** A lumpy cluster of bumps (x, y, r, in ems), off-center on purpose. */
const POOF_BUMPS = [
  [-0.2, 0.04, 0.16],
  [-0.04, -0.11, 0.2],
  [0.17, -0.03, 0.17],
  [0.09, 0.13, 0.13],
  [-0.09, 0.13, 0.11],
];
/** Little wisps flying off it. */
const POOF_WISPS = [
  [0.47, -0.26, 0.09],
  [-0.47, -0.2, 0.065],
  [0.39, 0.24, 0.055],
];

/** A cartoon puff of smoke, the size of a character, centered at (`cx`, `cy`). */
function drawPoof(cx: number, cy: number, em: number): Svgx {
  const circle = (
    [x, y, r]: number[],
    props: React.SVGProps<SVGCircleElement>,
  ) => <circle transform={translate(x * em, y * em)} r={r * em} {...props} />;
  const outline = { fill: "none", stroke: "#94a3b8", strokeWidth: 3 };
  const fill = { fill: "#f8fafc" };
  return (
    <g transform={translate(cx, cy)} opacity={0.75}>
      {/* Stroked circles under filled ones leave just the outline of
          their union. */}
      {POOF_BUMPS.map((b) => circle(b, outline))}
      {POOF_BUMPS.map((b) => circle(b, fill))}
      {POOF_WISPS.map((b) =>
        circle(b, { ...outline, ...fill, strokeWidth: 2 }),
      )}
    </g>
  );
}

function layoutInner(e: Expr, p: Place, ctx: Ctx, side: Side): Inner {
  const childInert = p.inert || p.atomic;
  const { state } = ctx;
  const em = EM * ctx.size;
  const text = textProps(ctx.size);

  switch (e.kind) {
    case "num":
    case "var": {
      const label = e.kind === "num" ? String(e.value) : e.name;
      const w = (e.kind === "num" ? label.length * DIGIT_W : LETTER_W) * em;
      return {
        w,
        asc: ASC * em,
        desc: DESC * em,
        draw: () => [
          <text
            transform={translate(w / 2, 0)}
            {...text}
            fontStyle={e.kind === "var" ? "italic" : "normal"}
            opacity={visible(ctx, true)}
          >
            {label}
          </text>,
        ],
      };
    }

    case "sum": {
      const multi = e.terms.length >= 2;
      const setTerms = (ts: Term[]) =>
        replaceNode(state, e.id, mkSum(ts, e.id));
      const across = p.sideLevel ? side : null;
      const kids = e.terms.map((t, i) =>
        layout(
          t.expr,
          {
            lead: termLead(t.sign, i, ctx.size),
            drag: childInert
              ? null
              : () => termDrag(ctx, e.terms, i, setTerms, across),
            inert: childInert,
            atomic: multi,
            sideLevel: p.sideLevel && !multi,
          },
          ctx,
          side,
        ),
      );
      const pw = p.parens ? PAREN_W * em : 0;
      const xs = kids.reduce<number[]>(
        (acc, k) => [...acc, acc[acc.length - 1] + k.w],
        [pw],
      );
      const w = xs[xs.length - 1] + pw;
      const asc = _.max(kids.map((k) => k.asc))!;
      const desc = _.max(kids.map((k) => k.desc))!;
      return {
        w,
        asc,
        desc,
        draw: () => [
          <text
            transform={translate((PAREN_W * em) / 2, 0)}
            {...text}
            opacity={visible(ctx, !!p.parens)}
          >
            (
          </text>,
          <text
            transform={translate(w - (PAREN_W * em) / 2, 0)}
            {...text}
            opacity={visible(ctx, !!p.parens)}
          >
            )
          </text>,
          ...kids.map((k, i) => k.draw(xs[i], 0)),
        ],
      };
    }

    case "prod": {
      const list: FactorList = p.factorList ?? {
        factors: e.factors,
        set: (fs) => replaceNode(state, e.id, mkProd(fs, e.id)),
        across: p.sideLevel ? { side, part: "num" } : null,
        opposite: null,
      };
      const kids = e.factors.map((f, i) =>
        layout(
          f,
          {
            lead: i > 0 && leadsWithDigit(f) ? dotLead(ctx.size) : NO_LEAD,
            drag: childInert ? null : () => factorDrag(ctx, list, i),
            inert: childInert,
            atomic: false,
            sideLevel: false,
            parens: f.kind === "sum",
          },
          ctx,
          side,
        ),
      );
      const xs = kids.reduce<number[]>(
        (acc, k) => [...acc, acc[acc.length - 1] + k.w],
        [0],
      );
      return {
        w: xs[xs.length - 1],
        asc: _.max(kids.map((k) => k.asc))!,
        desc: _.max(kids.map((k) => k.desc))!,
        draw: () => kids.map((k, i) => k.draw(xs[i], 0)),
      };
    }

    case "frac": {
      const numId = () => (e.num.kind === "prod" ? e.num.id : newId());
      const denId = () => (e.den.kind === "prod" ? e.den.id : newId());
      const across = (part: "num" | "den") =>
        p.sideLevel ? { side, part } : null;
      const numList: FactorList = {
        factors: factorsOf(e.num),
        set: (fs) =>
          replaceNode(state, e.id, mkFrac(mkProd(fs, numId()), e.den, e.id)),
        across: across("num"),
        opposite: {
          factors: factorsOf(e.den),
          setBoth: (mine, theirs) =>
            replaceNode(
              state,
              e.id,
              mkFrac(mkProd(mine, numId()), mkProd(theirs, denId()), e.id),
            ),
        },
      };
      const denList: FactorList = {
        factors: factorsOf(e.den),
        set: (fs) =>
          replaceNode(state, e.id, mkFrac(e.num, mkProd(fs, denId()), e.id)),
        across: across("den"),
        opposite: {
          factors: factorsOf(e.num),
          setBoth: (mine, theirs) =>
            replaceNode(
              state,
              e.id,
              mkFrac(mkProd(theirs, numId()), mkProd(mine, denId()), e.id),
            ),
        },
      };
      const part = (x: Expr, list: FactorList) =>
        layout(
          x,
          x.kind === "prod"
            ? {
                lead: NO_LEAD,
                drag: null,
                inert: childInert,
                atomic: false,
                sideLevel: false,
                factorList: list,
              }
            : {
                lead: NO_LEAD,
                drag: childInert ? null : () => factorDrag(ctx, list, 0),
                inert: childInert,
                atomic: false,
                sideLevel: false,
              },
          ctx,
          side,
        );
      const top = part(e.num, numList);
      const bottom = part(e.den, denList);
      const barW = Math.max(top.w, bottom.w) + 2 * BAR_OVERHANG * em;
      const barY = -BAR_AXIS * em;
      const topY = barY - BAR_GAP * em - top.desc;
      const bottomY = barY + BAR_GAP * em + bottom.asc;
      const pad = 0.06 * em;
      return {
        w: barW + 2 * pad,
        asc: -topY + top.asc,
        desc: bottomY + bottom.desc,
        draw: () => [
          <line
            x1={pad}
            y1={barY}
            x2={pad + barW}
            y2={barY}
            stroke={INK}
            strokeWidth={2 * ctx.size}
            opacity={visible(ctx, true)}
            pointerEvents="none"
          />,
          top.draw(pad + (barW - top.w) / 2, topY),
          bottom.draw(pad + (barW - bottom.w) / 2, bottomY),
        ],
      };
    }

    case "pow": {
      const script = { ...ctx, size: ctx.size * SCRIPT };
      const onSide = p.sideLevel && state[side].id === e.id ? side : null;
      // A sum draws its own parens; anything but a number or letter
      // needs them.
      const wrap = !["num", "var", "sum"].includes(e.base.kind);
      const pw = wrap ? PAREN_W * em : 0;
      const base = layout(
        e.base,
        {
          lead: NO_LEAD,
          drag:
            !childInert && onSide && e.base.kind === "num"
              ? () => powBaseDrag(ctx, e, onSide)
              : null,
          inert: childInert,
          atomic: false,
          sideLevel: false,
          parens: e.base.kind === "sum",
        },
        ctx,
        side,
      );
      const exp = layout(
        e.exp,
        {
          lead: NO_LEAD,
          drag: childInert
            ? null
            : () => expDrag(script, e, onSide, p.log ?? null),
          inert: childInert,
          atomic: true,
          sideLevel: false,
        },
        script,
        side,
      );
      const expX = 2 * pw + base.w + 0.04 * em;
      const expY = -Math.max(
        0.42 * em,
        base.asc - 0.3 * em,
        exp.desc + 0.2 * em,
      );
      return {
        w: expX + exp.w,
        asc: Math.max(base.asc, exp.asc - expY),
        desc: Math.max(base.desc, exp.desc + expY),
        draw: () => [
          <text
            transform={translate((PAREN_W * em) / 2, 0)}
            {...text}
            opacity={visible(ctx, wrap)}
          >
            (
          </text>,
          <text
            transform={translate(pw + base.w + (PAREN_W * em) / 2, 0)}
            {...text}
            opacity={visible(ctx, wrap)}
          >
            )
          </text>,
          base.draw(pw, 0),
          exp.draw(expX, expY),
        ],
      };
    }

    case "log": {
      const script = { ...ctx, size: ctx.size * SCRIPT };
      const onSide = p.sideLevel && state[side].id === e.id ? side : null;
      const base = layout(
        e.base,
        {
          lead: NO_LEAD,
          drag: childInert ? null : () => logBaseDrag(script, e, onSide),
          inert: childInert,
          atomic: true,
          sideLevel: false,
        },
        script,
        side,
      );
      const arg = layout(
        e.arg,
        {
          lead: NO_LEAD,
          drag: null,
          inert: childInert,
          atomic: false,
          sideLevel: false,
          log: e,
        },
        ctx,
        side,
      );
      const baseX = (LOG_W + 0.02) * em;
      const baseY = 0.3 * em;
      const pw = PAREN_W * em;
      const argX = baseX + base.w + 0.04 * em + pw;
      return {
        w: argX + arg.w + pw,
        asc: arg.asc,
        desc: Math.max(arg.desc, baseY + base.desc),
        draw: () => [
          <text
            transform={translate((LOG_W * em) / 2, 0)}
            {...text}
            opacity={visible(ctx, true)}
          >
            log
          </text>,
          <text
            transform={translate(argX - pw / 2, 0)}
            {...text}
            opacity={visible(ctx, true)}
          >
            (
          </text>,
          <text
            transform={translate(argX + arg.w + pw / 2, 0)}
            {...text}
            opacity={visible(ctx, true)}
          >
            )
          </text>,
          base.draw(baseX, baseY),
          arg.draw(argX, 0),
        ],
      };
    }
  }
}

function layoutSide(ctx: Ctx, side: Side): Box {
  const { state } = ctx;
  const e = state[side];
  const place: Place = {
    lead: NO_LEAD,
    drag:
      e.kind === "sum"
        ? null
        : () =>
            termDrag(
              ctx,
              [{ sign: 1, expr: e }],
              0,
              (ts) => setSide(state, side, mkSum(ts, newId())),
              side,
            ),
    inert: false,
    atomic: false,
    sideLevel: true,
  };
  return layout(e, place, ctx, side);
}

/** A cloud where the node in `puff` would be. */
function drawPuff(ctx: Ctx, { expr, sign, size, at }: Puff): Svgx {
  const lead =
    sign === null
      ? NO_LEAD
      : { text: sign < 0 ? "−" : "+", w: 0.68 * EM * size };
  const place: Place = {
    lead,
    drag: null,
    inert: true,
    atomic: true,
    sideLevel: false,
    parens: expr.kind === "sum",
    puff: true,
  };
  // `draw` takes the left edge of the lead; `at` is the content's start.
  return layout(expr, place, { ...ctx, hidden: true, size }, "lhs").draw(
    at.x - lead.w,
    at.y,
  );
}

/** A number: n, −n, or a fraction in lowest terms. */
function isNumber(e: Expr): boolean {
  switch (e.kind) {
    case "num":
      return true;
    case "sum":
      return e.terms.length === 1 && isNumber(e.terms[0].expr);
    case "frac":
      return (
        e.num.kind === "num" &&
        e.den.kind === "num" &&
        gcd(e.num.value, e.den.value) === 1
      );
    default:
      return false;
  }
}

const isSolved = ({ lhs, rhs }: State) =>
  (lhs.kind === "var" && isNumber(rhs)) ||
  (rhs.kind === "var" && isNumber(lhs));

function drawEquation(ctx: Ctx): Svgx {
  ctx = { ...ctx, size: 1 };
  const { state } = ctx;
  const lhs = layoutSide(ctx, "lhs");
  const rhs = layoutSide(ctx, "rhs");
  // A glow around the whole equation once it's solved (and settled).
  const pad = 0.5 * EM;
  const glowX = EQ_X - EQ_GAP - lhs.w - pad;
  const glowW = lhs.w + rhs.w + 2 * EQ_GAP + 2 * pad;
  const glowY = BASELINE - Math.max(lhs.asc, rhs.asc) - pad / 2;
  const glowH = Math.max(lhs.asc, rhs.asc) + Math.max(lhs.desc, rhs.desc) + pad;
  return (
    <g>
      <g opacity={isSolved(state) && ctx.idle ? 1 : 0} pointerEvents="none">
        <rect
          x={glowX}
          y={glowY}
          width={glowW}
          height={glowH}
          rx={glowH / 2}
          fill="#fbbf24"
          opacity={0.6}
          style={{ filter: "blur(14px)" }}
        />
        <rect
          x={glowX + pad / 2}
          y={glowY + pad / 4}
          width={glowW - pad}
          height={glowH - pad / 2}
          rx={glowH / 2}
          fill="#fffbeb"
          style={{ filter: "blur(5px)" }}
        />
      </g>
      {lhs.draw(EQ_X - EQ_GAP - lhs.w, BASELINE)}
      <text transform={translate(EQ_X, BASELINE)} {...textProps(1)}>
        =
      </text>
      {rhs.draw(EQ_X + EQ_GAP, BASELINE)}
      {state.puff && drawPuff(ctx, state.puff)}
    </g>
  );
}

const draggable: Draggable<State> = ({ state, d, draggedId }) =>
  drawEquation({ state, d, idle: draggedId === null, size: 1 });

// # Parsing (for the starting equations)

function parse(src: string): State {
  const toks = src.replace(/\s+/g, "").match(/\d+|log|[a-z]|[-+*/()=^_]/g)!;
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];

  function sum(): Expr {
    const terms: Term[] = [];
    let sign: 1 | -1 = 1;
    if (peek() === "-") {
      next();
      sign = -1;
    }
    terms.push({ sign, expr: term() });
    while (peek() === "+" || peek() === "-") {
      sign = next() === "-" ? -1 : 1;
      terms.push({ sign, expr: term() });
    }
    return mkSum(terms, newId());
  }
  function term(): Expr {
    const factors = [factor()];
    while (peek() !== undefined && /^(\d+|[a-z]+|\(|\*)$/.test(peek())) {
      if (peek() === "*") next();
      factors.push(factor());
    }
    let e = mkProd(factors, newId());
    while (peek() === "/") {
      next();
      e = mkFrac(e, factor(), newId());
    }
    return e;
  }
  function factor(): Expr {
    const base = atom();
    if (peek() !== "^") return base;
    next();
    return mkPow(base, atom(), newId());
  }
  function atom(): Expr {
    const t = next();
    if (t === "(") {
      const e = sum();
      next();
      return e;
    }
    if (t === "log") {
      next(); // _
      const base = atom();
      return { kind: "log", id: newId(), base, arg: atom() };
    }
    if (/^\d+$/.test(t)) return num(Number(t));
    return { kind: "var", id: newId(), name: t };
  }

  const lhs = sum();
  next();
  return { lhs, rhs: sum() };
}

const EQUATIONS = [
  "2x + 3 = 11",
  "3x - 5 = x + 7",
  "x/4 + 1 = 3",
  "2(x + 1) = 10",
  "(x + 6)/3 = 2x - 3",
  "(x + 3)^2 = x^2 + 15",
  "2x^3 = 54",
  "x^5/x^2 = 8",
  "2^(x + 1) = 32",
  "log_3(x) = 4",
  "log_2(x^3) = 6",
].map((src) => ({ src, state: parse(src) }));

/** An equation's source, with its exponents and subscripts set as such. */
function prettySource(src: string) {
  return src
    .replace(/-/g, "−")
    .split(/(\^\([^)]*\)|\^\w+|_\w+)/)
    .map((part, i) =>
      part.startsWith("^") ? (
        <sup key={i}>{part.slice(1).replace(/^\((.*)\)$/, "$1")}</sup>
      ) : part.startsWith("_") ? (
        <sub key={i}>{part.slice(1)}</sub>
      ) : (
        part
      ),
    );
}

// # Component

export default demo(
  () => {
    const [which, setWhich] = useState(0);
    const [attempt, setAttempt] = useState(0);
    return (
      <div>
        <DemoNotes>
          <p>
            Solve for <i>x</i> by dragging, after{" "}
            <a href="https://graspablemath.com" className="underline">
              Graspable Math
            </a>
            . Drag a term along its side to reorder it, or across the <b>=</b>{" "}
            to subtract it from both sides. Drag a factor across to divide (or,
            from under a fraction bar, multiply) the other side. Drop a term on
            a like term to add them, a number on a number to multiply them, a
            factor on a parenthesized sum to multiply it out (grab a sum by its
            parentheses), a power on a power of the same base to add exponents,
            or a factor on its match across a fraction bar to cancel.
          </p>
          <p>
            Drop an exponent on its base to work it out or write it as a
            product, drag it across the <b>=</b> to take a root, or drag it out
            of a log to the front. Drag the base of a power across to take a
            log, the base of a log across to exponentiate, or drop a log's base
            on its argument to work it out.
          </p>
        </DemoNotes>
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          {EQUATIONS.map(({ src }, i) => (
            <button
              key={src}
              className={
                "px-2 py-1 text-sm rounded border font-serif " +
                (i === which
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
              }
              onClick={() => {
                setWhich(i);
                setAttempt((n) => n + 1);
              }}
            >
              {prettySource(src)}
            </button>
          ))}
          <button
            className="px-2 py-1 text-sm rounded border bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
            onClick={() => setAttempt((n) => n + 1)}
          >
            reset
          </button>
        </div>
        <DemoDraggable
          key={`${which}-${attempt}`}
          draggable={draggable}
          initialState={EQUATIONS[which].state}
          width={W}
          height={H}
        />
      </div>
    );
  },
  {
    fuzz: EQUATIONS.map(({ src, state }) => ({
      name: src,
      draggable,
      initialState: state,
    })),
    tags: [
      "d.closest",
      "d.dropTarget",
      "spec.whenFar",
      "spec.withFloating",
      "math",
    ],
  },
);
