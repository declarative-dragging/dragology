// An operator and a modifier defined as a library user would, with only
// what lib.ts exports.
import { expect, it } from "vitest";
import {
  type DragFrame,
  type Draggable,
  type DragInitContext,
  type DragSpecData,
  dragSpecToBehavior,
  getElementPositionCheap,
  Modifier,
  modifier,
  operator,
  Operator,
  type OpResult,
  renderStateReadOnly,
  translate,
  Vec2,
} from "./lib";

/** Jump to whichever state puts the dragged element nearest the pointer. */
class NearestOp<T extends object> extends Operator<T> {
  readonly name = "nearest";
  readonly positions: Vec2[];

  constructor(
    ctx: DragInitContext<T>,
    readonly states: T[],
  ) {
    super(ctx);
    this.positions = states.map((s) => getElementPositionCheap(ctx, s)!);
  }

  frame(frame: DragFrame): OpResult<T> {
    const dists = this.positions.map((p) => p.dist(frame.pointer));
    const i = dists.indexOf(Math.min(...dists));
    return {
      preview: () => renderStateReadOnly(this.ctx, this.states[i]),
      dropState: this.states[i],
      gap: dists[i],
      activePath: String(i),
    };
  }

  treeView() {
    return null;
  }

  overlayVis() {
    return null;
  }
}
const nearest = operator(NearestOp);

/** Move the pointer `dx` to the right before the wrapped spec sees it. */
class ShiftPointer<T extends object> extends Modifier<T> {
  readonly name = "shiftPointer";

  constructor(
    ctx: DragInitContext<T>,
    inner: DragSpecData<T>,
    readonly dx: number,
  ) {
    super(ctx, inner);
  }

  frame(frame: DragFrame) {
    return this.inner.run({ pointer: frame.pointer.add(Vec2(this.dx, 0)) });
  }
}
const shiftPointer = modifier(ShiftPointer);

type S = { x: number };

const draggable: Draggable<S> = ({ state }) => (
  <g>
    <circle id="dot" transform={translate(state.x, 0)} r={5} />
  </g>
);

const ctx: DragInitContext<S> = {
  draggable,
  draggedPath: "dot/",
  draggedId: "dot",
  anchorPos: Vec2(0),
  startState: { x: 0 },
  debug: { varyVisualizer: false },
};

it("runs a user-defined operator", () => {
  const spec = nearest<S>([{ x: 0 }, { x: 100 }]);
  const result = dragSpecToBehavior(spec, ctx)({ pointer: Vec2(70, 0) });
  expect(result.dropState).toEqual({ x: 100 });
  expect(result.activePath).toBe("nearest/1");
});

it("runs a user-defined modifier around it", () => {
  const spec = nearest<S>([{ x: 0 }, { x: 100 }]).with(shiftPointer(30));
  // 30 is nearer 0, but shifted to 60 it's nearer 100
  const result = dragSpecToBehavior(spec, ctx)({ pointer: Vec2(30, 0) });
  expect(result.dropState).toEqual({ x: 100 });
  expect(result.activePath).toBe("shiftPointer/nearest/1");
  // the modifier's argument is type-checked
  // @ts-expect-error
  shiftPointer("30");
});
