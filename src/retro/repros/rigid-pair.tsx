import { DemoDraggable } from "../../demo/ui";
import { Draggable, rotateDeg, translate, Vec2 } from "../../lib";

// A domino made of two squares. Flipping it rotates the pair 90° about its
// center. (Aztec diamond: "I cannot emphasize enough how much this doesn't
// work.")

type State = { vertical: boolean };
const C = Vec2(70, 60);
const HALF = 22;

// Problem: each square is positioned by its own translate, so d.between
// slides each square's center in a straight line. Mid-drag the two squares
// pass through each other; the partner disappears under the dragged one.
const independent: Draggable<State> = ({ state, d }) => {
  const offset = state.vertical ? Vec2(0, HALF) : Vec2(HALF, 0);
  return (
    <g>
      {[-1, 1].map((sign) => (
        <rect
          id={`sq-${sign}`}
          transform={translate(C.add(offset.mul(sign)))}
          x={-20}
          y={-20}
          width={40}
          height={40}
          rx={4}
          fill={sign < 0 ? "#60a5fa" : "#f87171"}
          dragologyOnDrag={() =>
            d.between([state, { vertical: !state.vertical }])
          }
        />
      ))}
    </g>
  );
};

// Fix: a shared parent carries the rotation; the squares are fixed inside it.
// Component-wise lerp of the parent's `rotate` turns the pair rigidly.
const shared: Draggable<State> = ({ state, d }) => (
  <g transform={translate(C) + rotateDeg(state.vertical ? 90 : 0)}>
    {[-1, 1].map((sign) => (
      <rect
        id={`sq-${sign}`}
        transform={translate(HALF * sign, 0)}
        x={-20}
        y={-20}
        width={40}
        height={40}
        rx={4}
        fill={sign < 0 ? "#60a5fa" : "#f87171"}
        dragologyOnDrag={() =>
          d.between([state, { vertical: !state.vertical }])
        }
      />
    ))}
  </g>
);

export default function Repro() {
  const common = { initialState: { vertical: false }, width: 140, height: 120 };
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: drag a square halfway
        </div>
        <DemoDraggable draggable={independent} {...common} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          fixed: shared rotating parent
        </div>
        <DemoDraggable draggable={shared} {...common} />
      </div>
    </div>
  );
}
