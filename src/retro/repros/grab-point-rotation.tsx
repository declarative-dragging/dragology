import { DemoDraggable } from "../../demo/ui";
import { Draggable, rotateDeg, translate } from "../../lib";

// A bar that flips between horizontal and vertical. Grab it near one END.
// (The Aztec-diamond domino flip.) Turn on the "Overlay" toggle below to see
// where each spec puts its drop target.

type State = { vertical: boolean };
const C = translate(80, 60);

const bar =
  (
    transforms: (s: State) => { outer: string; inner: string },
  ): Draggable<State> =>
  ({ state, d }) => {
    const { outer, inner } = transforms(state);
    return (
      <g
        id="bar"
        transform={outer}
        dragologyOnDrag={() =>
          d.between([state, { vertical: !state.vertical }])
        }
      >
        <g transform={inner}>
          <rect x={-50} y={-10} width={100} height={20} rx={4} fill="#a78bfa" />
        </g>
      </g>
    );
  };

// Rotation on the dragged (id'd) element: the grab offset is kept in the
// element's local frame, so it rotates with it. Grabbed at the right end, the
// target for "vertical" is the BOTTOM end, swung around the center. (What the
// tilings agent didn't expect: "a target at y,x".)
const rotationOnDragged = bar((s) => ({
  outer: C + rotateDeg(s.vertical ? 90 : 0),
  inner: "",
}));

// Rotation on an inner group: the grab point stays put in the dragged
// element's frame, so the target is "same point, bar turned under it".
const rotationInside = bar((s) => ({
  outer: C,
  inner: rotateDeg(s.vertical ? 90 : 0),
}));

export default function Repro() {
  const common = { initialState: { vertical: false }, width: 160, height: 120 };
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          rotation on the dragged element
        </div>
        <DemoDraggable draggable={rotationOnDragged} {...common} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          rotation on an inner group
        </div>
        <DemoDraggable draggable={rotationInside} {...common} />
      </div>
    </div>
  );
}
