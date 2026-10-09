import { DemoDraggable } from "../../demo/ui";
import { Draggable, inOrder, param, translate } from "../../lib";

// Two sliders. Drag each knob all the way to the right end, then try to drag
// it back. (stock-and-flow's parameter sliders; task b34d26.)

type State = { v: number };
const W = 200;

const slider =
  (knobX: (v: number) => number): Draggable<State> =>
  ({ state, d }) => (
    <g transform={translate(20, 20)}>
      <line x2={W} stroke="#d1d5db" strokeWidth={4} />
      <circle
        id="knob"
        transform={translate(knobX(state.v), 0)}
        r={10}
        fill="white"
        stroke="#9ca3af"
        dragologyOnDrag={() =>
          d.vary(state, param("v"), {
            constraint: (s) => inOrder([0, s.v, W]),
          })
        }
      />
    </g>
  );

// Problem: the knob's position is clamped to the track. At v = W the
// optimizer's sensitivity probe (v + 1e-3) sees no movement, scales the
// parameter as nearly inert, and the knob can't be dragged back.
const clamped = slider((v) => Math.min(Math.max(v, 0), W));

// Fix: don't clamp the dragged element's position; let the constraint bound
// the value.
const unclamped = slider((v) => v);

export default function Repro() {
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: clamped knob position
        </div>
        <DemoDraggable
          draggable={clamped}
          initialState={{ v: 100 }}
          width={240}
          height={40}
        />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">fixed: unclamped</div>
        <DemoDraggable
          draggable={unclamped}
          initialState={{ v: 100 }}
          width={240}
          height={40}
        />
      </div>
    </div>
  );
}
