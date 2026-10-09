import { DemoDraggable } from "../../demo/ui";
import { Draggable, translate, Vec2 } from "../../lib";

// A polyline path that gains a segment when you drag its end to the next
// stop. (Permutation lab's wires and permutohedron walk: "Path interpolation
// ... is really bad and not what we're looking for at all.")

type State = { n: number }; // number of segments drawn
const STOPS = [Vec2(20, 60), Vec2(70, 20), Vec2(120, 60), Vec2(170, 20)];

const draw = (pts: Vec2[]) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

// Problem: one <path> whose command count changes. d3-interpolate-path
// re-samples the whole path, so the existing segments smear while the new
// one grows.
const onePath: Draggable<State> = ({ state, d }) => {
  const pts = STOPS.slice(0, state.n + 1);
  return (
    <g>
      <path d={draw(pts)} fill="none" stroke="#6366f1" strokeWidth={3} />
      <circle
        id="tip"
        transform={translate(pts[pts.length - 1])}
        r={8}
        fill="#6366f1"
        dragologyOnDrag={() =>
          d.closest(
            [state.n - 1, state.n + 1]
              .filter((n) => n >= 1 && n < STOPS.length)
              .map((n) => d.between([state, { n }])),
          )
        }
      />
    </g>
  );
};

// Fix: constant structure. One id'd <line> per possible segment; a segment
// that doesn't exist yet is zero-length at the tip.
const perSegment: Draggable<State> = ({ state, d }) => {
  const pts = STOPS.slice(0, state.n + 1);
  const tip = pts[pts.length - 1];
  return (
    <g>
      {STOPS.slice(1).map((p, i) => {
        const a = i < state.n ? STOPS[i] : tip;
        const b = i < state.n ? p : tip;
        return (
          <line
            id={`seg-${i}`}
            {...a.xy1()}
            {...b.xy2()}
            stroke="#6366f1"
            strokeWidth={3}
          />
        );
      })}
      <circle
        id="tip"
        transform={translate(tip)}
        r={8}
        fill="#6366f1"
        dragologyOnDrag={() =>
          d.closest(
            [state.n - 1, state.n + 1]
              .filter((n) => n >= 1 && n < STOPS.length)
              .map((n) => d.between([state, { n }])),
          )
        }
      />
    </g>
  );
};

export default function Repro() {
  const common = { initialState: { n: 1 }, width: 200, height: 80 };
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: one path, drag the tip onward
        </div>
        <DemoDraggable draggable={onePath} {...common} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          fixed: one line per segment
        </div>
        <DemoDraggable draggable={perSegment} {...common} />
      </div>
    </div>
  );
}
