import { DemoDraggable } from "../../demo/ui";
import { Draggable, translate, Vec2 } from "../../lib";

// Drag node B onto A's right to attach it. The edge exists only in the
// attached state. (Rotations-rebalancing: "three edges dangle"; knot: new
// crossings "fade in at their final spots before the strand arrives".)

type State = { attached: boolean };
const A = Vec2(40, 40);
const B_FREE = Vec2(60, 110);
const B_ATTACHED = Vec2(140, 40);

// Problem: an element present in only one state has nothing to pair with, so
// it cross-fades IN PLACE at its final coordinates while B is still travelling.
// The edge floats detached from B for the whole drag.
const problem: Draggable<State> = ({ state, d }) => {
  const b = state.attached ? B_ATTACHED : B_FREE;
  return (
    <g>
      {state.attached && (
        <line
          id="edge"
          {...A.xy1()}
          {...b.xy2()}
          stroke="#9ca3af"
          strokeWidth={3}
        />
      )}
      <circle id="a" transform={translate(A)} r={12} fill="#60a5fa" />
      <circle
        id="b"
        transform={translate(b)}
        r={12}
        fill="#f87171"
        dragologyOnDrag={() =>
          d.between([{ attached: false }, { attached: true }])
        }
      />
    </g>
  );
};

// Fix (the "ghost edge" idiom): draw the edge in both states, invisible in
// the one where it doesn't exist, so its endpoints interpolate with the nodes.
const fixed: Draggable<State> = ({ state, d }) => {
  const b = state.attached ? B_ATTACHED : B_FREE;
  return (
    <g>
      <line
        id="edge"
        {...A.xy1()}
        {...b.xy2()}
        stroke="#9ca3af"
        strokeWidth={3}
        opacity={state.attached ? 1 : 0}
      />
      <circle id="a" transform={translate(A)} r={12} fill="#60a5fa" />
      <circle
        id="b"
        transform={translate(b)}
        r={12}
        fill="#f87171"
        dragologyOnDrag={() =>
          d.between([{ attached: false }, { attached: true }])
        }
      />
    </g>
  );
};

export default function Repro() {
  const common = { initialState: { attached: false }, width: 180, height: 140 };
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: drag B to the right slowly
        </div>
        <DemoDraggable draggable={problem} {...common} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          fixed: ghost edge in both states
        </div>
        <DemoDraggable draggable={fixed} {...common} />
      </div>
    </div>
  );
}
