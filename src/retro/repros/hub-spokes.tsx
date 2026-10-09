import { DemoDraggable } from "../../demo/ui";
import {
  Draggable,
  DragSpec,
  DragSpecBuilder,
  translate,
  Vec2,
} from "../../lib";

// A token at a hub with three spokes. Every graph-walking demo (Tamari
// lattice, permutohedron, sokoban, tree rotations) is this shape.

type State = { at: number }; // 0 = hub, 1..3 = spoke ends

const HUB = Vec2(80, 70);
const ENDS = [0, 1, 2].map((i) =>
  HUB.add(Vec2(55, 0).rotateDeg(-90 + i * 120 + 60)),
);
const posOf = (at: number) => (at === 0 ? HUB : ENDS[at - 1]);

const token =
  (
    spec: (d: DragSpecBuilder<State>, s: State) => DragSpec<State>,
  ): Draggable<State> =>
  ({ state, d }) => (
    <g>
      {ENDS.map((e, i) => (
        <line id={`spoke-${i}`} {...HUB.xy1()} {...e.xy2()} stroke="#d1d5db" />
      ))}
      <circle
        id="token"
        transform={translate(posOf(state.at))}
        r={10}
        fill="#fbbf24"
        dragologyOnDrag={() => spec(d, state)}
      />
    </g>
  );

const neighbours = (s: State): State[] =>
  s.at === 0 ? [{ at: 1 }, { at: 2 }, { at: 3 }] : [{ at: 0 }];

// (a) One between over hub + all spokes: the token drags freely inside the
// triangle of targets instead of along a spoke. "Super weird."
const multiBetween = token((d, s) => d.between([s, ...neighbours(s)]));

// (b) closest over two-point betweens, one per spoke. The token walks a
// spoke, but can spring to another spoke partway out.
const spokes = token((d, s) =>
  d.closest(neighbours(s).map((n) => d.between([s, n]))),
);

// (c) ...with lockPast: once 20px out along a spoke, commit to it.
const locked = token((d, s) =>
  d.closest(
    neighbours(s).map((n) => d.between([s, n])),
    { lockPast: 20 },
  ),
);

export default function Repro() {
  const common = { initialState: { at: 0 }, width: 160, height: 140 };
  return (
    <div className="flex gap-6 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          (a) one 4-state between
        </div>
        <DemoDraggable draggable={multiBetween} {...common} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          (b) closest of 2-state betweens
        </div>
        <DemoDraggable draggable={spokes} {...common} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">(c) + lockPast: 20</div>
        <DemoDraggable draggable={locked} {...common} />
      </div>
    </div>
  );
}
