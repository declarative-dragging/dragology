import { DemoDraggable } from "../../demo/ui";
import { Draggable, DragSpec, DragSpecBuilder, translate } from "../../lib";

// Two stacked nodes. Drag the top one onto the bottom one to merge them;
// in the merged state the survivor moves up to the top slot.
// (The ZX demo's spider fusion; the proof demo's rewriting targets.)

type State = { merged: boolean };

const TOP = 20;
const BOTTOM = 70;

const nodes =
  (
    spec: (d: DragSpecBuilder<State>, s: State) => DragSpec<State>,
  ): Draggable<State> =>
  ({ state, d }) => (
    <g transform={translate(40, 0)}>
      {!state.merged && (
        <circle
          id="top"
          transform={translate(0, TOP)}
          r={14}
          fill="#86efac"
          dragologyOnDrag={() => spec(d, state)}
        />
      )}
      <circle
        id="bottom"
        transform={translate(0, state.merged ? TOP : BOTTOM)}
        r={14}
        fill="#4ade80"
      />
    </g>
  );

// Problem: dropTarget measures "bottom" in the state it would drop into. There,
// "bottom" sits at the top slot, right under the pointer at press, so the merge
// previews on mouse-down.
const problem = nodes((d, s) =>
  d.dropTarget("bottom", { merged: true }).whenFar(s),
);

// Fix: measure the target where the user sees it, in the current state.
const fixed = nodes((d, s) =>
  d.dropTarget("bottom", { merged: true }, { boundsState: s }).whenFar(s),
);

export default function Repro() {
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: press the top node and don't move
        </div>
        <DemoDraggable
          draggable={problem}
          initialState={{ merged: false }}
          width={80}
          height={100}
        />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          fixed: <code>boundsState: state</code>
        </div>
        <DemoDraggable
          draggable={fixed}
          initialState={{ merged: false }}
          width={80}
          height={100}
        />
      </div>
    </div>
  );
}
