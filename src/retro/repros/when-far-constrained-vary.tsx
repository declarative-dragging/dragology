import { DemoDraggable } from "../../demo/ui";
import { Draggable, inOrder, param, translate } from "../../lib";

// A bead slides along a track; pulling it off the far right end removes it.
// (The ZX demo's Hopf rule: pull a bead through its twin to cancel both.)

type State = { x: number; gone: boolean };
const W = 200;

const draggable: Draggable<State> = ({ state, d }) => (
  <g transform={translate(20, 40)}>
    <line x2={W} stroke="#d1d5db" strokeWidth={4} />
    {!state.gone && (
      <circle
        id="bead"
        transform={translate(state.x, 0)}
        r={10}
        fill="#f472b6"
        dragologyOnDrag={() =>
          d
            .vary(state, param("x"), {
              constraint: (s) => inOrder([0, s.x, W]),
            })
            // Meant as "when pulled past the right end". But whenFar only knows
            // the pointer is far from wherever the constrained vary can put the
            // bead, so pulling straight down (or past the left end) also fires.
            .whenFar({ ...state, gone: true })
        }
      />
    )}
  </g>
);

export default function Repro() {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">
        pull the bead straight down ~60px; it vanishes
      </div>
      <DemoDraggable
        draggable={draggable}
        initialState={{ x: 100, gone: false }}
        width={240}
        height={120}
      />
    </div>
  );
}
