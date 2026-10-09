import { DemoDraggable } from "../../demo/ui";
import { Draggable, DragSpec, DragSpecBuilder, translate } from "../../lib";

// A chip in zone A; zone B is 300px away. (Pivot table: "it jumps to the
// values pool when I reach the half-way point ... spooky-action-at-a-distance".)

type State = { zone: "A" | "B" };
const ZONE_X = { A: 20, B: 320 };

const chip =
  (
    spec: (d: DragSpecBuilder<State>, s: State) => DragSpec<State>,
  ): Draggable<State> =>
  ({ state, d }) => (
    <g>
      {(["A", "B"] as const).map((z) => (
        <rect
          id={`zone-${z}`}
          transform={translate(ZONE_X[z], 10)}
          width={80}
          height={50}
          rx={6}
          fill={state.zone === z ? "#dbeafe" : "#f3f4f6"}
          stroke="#d1d5db"
        />
      ))}
      <rect
        id="chip"
        transform={translate(ZONE_X[state.zone] + 15, 25)}
        width={50}
        height={20}
        rx={10}
        fill="#3b82f6"
        dragologyOnDrag={() => spec(d, state)}
      />
    </g>
  );

// Problem: closest picks by Voronoi, so the chip "lands" in B as soon as the
// pointer crosses the midpoint, 150px from either zone.
const problem = chip((d) =>
  d.closest([{ zone: "A" }, { zone: "B" }]).withFloating(),
);

// Fix: nothing happens until the chip is near a slot.
const fixed = chip((d, s) =>
  d
    .closest([{ zone: "A" }, { zone: "B" }])
    .whenFar(s, { gapIn: 40, gapOut: 56 })
    .withFloating(),
);

export default function Repro() {
  const common = {
    initialState: { zone: "A" as const },
    width: 420,
    height: 70,
  };
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: drag the chip slowly toward B
        </div>
        <DemoDraggable draggable={problem} {...common} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          fixed: whenFar(state) with hysteresis
        </div>
        <DemoDraggable draggable={fixed} {...common} />
      </div>
    </div>
  );
}
