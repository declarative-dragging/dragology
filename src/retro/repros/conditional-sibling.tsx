import { DemoDraggable } from "../../demo/ui";
import { Draggable, DragSpec, DragSpecBuilder, translate } from "../../lib";

// A knob that slides between two positions. When it's "on", a badge appears
// before its label. (Proof-by-dragging's conditional parens; permutation-lab's
// rect-vs-circle handles; stock-and-flow's conditional rects: six crashes
// across the sessions, all this shape.)

type State = { on: boolean };

const knob =
  (
    body: (on: boolean) => React.ReactNode,
    spec: (d: DragSpecBuilder<State>) => DragSpec<State>,
  ): Draggable<State> =>
  ({ state, d }) => (
    <g
      id="knob"
      transform={translate(state.on ? 120 : 20, 20)}
      dragologyOnDrag={() => spec(d)}
    >
      {body(state.on)}
    </g>
  );

const toggle = (d: DragSpecBuilder<State>) =>
  d.between([{ on: false }, { on: true }]);

// Problem: the badge <rect> only exists when on, so the children shift index
// between the two states and the interpolator pairs the <rect> with the
// <text>: "Cannot lerp between different element types: rect and text".
const problem = knob(
  (on) => (
    <g>
      {on && <rect width={10} height={10} fill="#22c55e" />}
      <text transform={translate(14, 10)} fontSize={12}>
        {on ? "on" : "off"}
      </text>
    </g>
  ),
  toggle,
);

// Fix 1: always render it and toggle opacity. (Fix 2: give it an id.)
const fixed = knob(
  (on) => (
    <g>
      <rect width={10} height={10} fill="#22c55e" opacity={on ? 1 : 0} />
      <text transform={translate(14, 10)} fontSize={12}>
        {on ? "on" : "off"}
      </text>
    </g>
  ),
  toggle,
);

export default function Repro() {
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: drag the label
        </div>
        <DemoDraggable
          draggable={problem}
          initialState={{ on: false }}
          width={180}
          height={50}
        />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">fixed: always rendered</div>
        <DemoDraggable
          draggable={fixed}
          initialState={{ on: false }}
          width={180}
          height={50}
        />
      </div>
    </div>
  );
}
