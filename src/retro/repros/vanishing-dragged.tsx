import { DemoDraggable } from "../../demo/ui";
import { Draggable, DragSpec, DragSpecBuilder, translate } from "../../lib";

// Drag the item into the trash to delete it. The drop state has no dragged
// element. (regex-nfa's `voided` hidden copies; lambda's "K can't be
// dragged"; proof-by-dragging chaining onto the undo button.)

type State = { item: boolean };

const scene =
  (
    spec: (d: DragSpecBuilder<State>, s: State) => DragSpec<State>,
  ): Draggable<State> =>
  ({ state, d }) => (
    <g>
      <rect
        id="trash"
        transform={translate(140, 30)}
        width={40}
        height={40}
        rx={6}
        fill="#fee2e2"
        stroke="#f87171"
      />
      {state.item && (
        <circle
          id="item"
          transform={translate(40, 50)}
          r={12}
          fill="#34d399"
          dragologyOnDrag={() => spec(d, state)}
        />
      )}
    </g>
  );

// With floating, the library "floats from memory": the item follows the
// pointer even though the candidate's rendering has no item, and is gone on
// drop.
const floating = scene((d, s) =>
  d.dropTarget("trash", { item: false }).whenFar(s).withFloating(),
);

// Without floating, the candidate has nowhere to draw the dragged element.
const notFloating = scene((d, s) =>
  d.dropTarget("trash", { item: false }).whenFar(s),
);

export default function Repro() {
  const common = { initialState: { item: true }, width: 200, height: 100 };
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          withFloating: drag the item over the trash
        </div>
        <DemoDraggable draggable={floating} {...common} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          without floating: same drag
        </div>
        <DemoDraggable draggable={notFloating} {...common} />
      </div>
    </div>
  );
}
