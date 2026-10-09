import { DemoDraggable } from "../../demo/ui";
import { Draggable, DragSpec, DragSpecBuilder, translate } from "../../lib";

// Three cells, 40px apart; drag one onto another to swap them.
// (The tableaux demo's "Fillings" panel.)

type State = { order: string[] };
const PITCH = 40;

const swapsOf = (state: State, i: number): State[] =>
  state.order.flatMap((_, j) => {
    if (j === i) return [];
    const order = [...state.order];
    [order[i], order[j]] = [order[j], order[i]];
    return [{ order }];
  });

const cells =
  (
    spec: (d: DragSpecBuilder<State>, s: State, i: number) => DragSpec<State>,
  ): Draggable<State> =>
  ({ state, d }) => (
    <g transform={translate(20, 20)}>
      {state.order.map((label, i) => (
        <g
          id={`cell-${label}`}
          transform={translate(i * PITCH, 0)}
          dragologyOnDrag={() => spec(d, state, i)}
        >
          <rect width={30} height={30} rx={4} fill="#dbeafe" stroke="#60a5fa" />
          <text transform={translate(15, 20)} textAnchor="middle" fontSize={14}>
            {label}
          </text>
        </g>
      ))}
    </g>
  );

// Problem: `state` isn't a candidate. At pointer-down the nearest candidate
// is the swap with a neighbour (40px away, inside whenFar's default 50px),
// so the swap previews before the pointer has moved.
const problem = cells((d, s, i) =>
  d.closest(swapsOf(s, i)).whenFar(s).withFloating(),
);

// Fix: the unchanged state is a candidate too.
const fixed = cells((d, s, i) =>
  d.closest([s, ...swapsOf(s, i)]).withFloating(),
);

export default function Repro() {
  return (
    <div className="flex gap-8 flex-wrap">
      <div>
        <div className="text-xs text-gray-500 mb-1">
          problem: press a cell and don't move
        </div>
        <DemoDraggable
          draggable={problem}
          initialState={{ order: ["a", "b", "c"] }}
          width={160}
          height={70}
        />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          fixed: <code>state</code> is a candidate
        </div>
        <DemoDraggable
          draggable={fixed}
          initialState={{ order: ["a", "b", "c"] }}
          width={160}
          height={70}
        />
      </div>
    </div>
  );
}
