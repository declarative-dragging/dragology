import { useState } from "react";
import { DemoDraggable } from "../../demo/ui";
import { Draggable, translate } from "../../lib";

// (1) A draggable group whose only visible child has an id.
// (Catalan's Dyck humps were undraggable through every fuzz run; stock-and-flow's
// stock bodies; layout-editor's axis handle.)
type Pos = { x: number };
const box =
  (bodyId: string | undefined): Draggable<Pos> =>
  ({ state, d }) => (
    <g
      id="box"
      transform={translate(state.x, 20)}
      dragologyOnDrag={() => d.between([{ x: 20 }, { x: 120 }])}
    >
      {/* Problem: an id'd child is extracted as its own layer, rendered outside
          its parent in the DOM, so presses on it never reach the group. */}
      <rect id={bodyId} width={40} height={30} rx={4} fill="#fcd34d" />
    </g>
  );

// (2) A click handler on a child of a draggable element never fires: the
// renderer only holds off the drag when the DRAGGED element or its ancestors
// have one. (stock-and-flow's double-click-to-rename; task 04f7ac.)
function ChildClick({ handlerOn }: { handlerOn: "child" | "dragged" }) {
  const [clicks, setClicks] = useState(0);
  const count = () => setClicks((c) => c + 1);
  const draggable: Draggable<Pos> = ({ state, d }) => (
    <g
      id="box"
      transform={translate(state.x, 20)}
      dragologyOnDrag={() => d.between([{ x: 20 }, { x: 120 }])}
      onClick={handlerOn === "dragged" ? count : undefined}
    >
      <rect width={40} height={30} rx={4} fill="#fcd34d" />
      <text
        transform={translate(20, 20)}
        textAnchor="middle"
        fontSize={12}
        onClick={handlerOn === "child" ? count : undefined}
      >
        {clicks}
      </text>
    </g>
  );
  return (
    <DemoDraggable
      draggable={draggable}
      initialState={{ x: 20 }}
      width={180}
      height={70}
    />
  );
}

export default function Repro() {
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: body has an id; try to drag
        </div>
        <DemoDraggable
          draggable={box("body")}
          initialState={{ x: 20 }}
          width={180}
          height={70}
        />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          fixed: no id on the body
        </div>
        <DemoDraggable
          draggable={box(undefined)}
          initialState={{ x: 20 }}
          width={180}
          height={70}
        />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: onClick on the child text
        </div>
        <ChildClick handlerOn="child" />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          works: onClick on the dragged group
        </div>
        <ChildClick handlerOn="dragged" />
      </div>
    </div>
  );
}
