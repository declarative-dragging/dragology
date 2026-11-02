// A tiny app that uses dragology the way someone who installed it from npm
// would: everything comes from the "dragology" package, never from ../../src.
import {
  Draggable,
  DraggableRenderer,
  inOrder,
  param,
  translate,
} from "dragology";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// d.between: a toggle switch.
type ToggleState = { status: "on" | "off" };

const toggle: Draggable<ToggleState> = ({ state, d }) => (
  <g transform={translate(20, 20)}>
    <rect
      width={120}
      height={60}
      rx={30}
      fill={state.status === "on" ? "#22c55e" : "#d1d5db"}
    />
    <circle
      id="knob"
      transform={state.status === "on" ? translate(90, 30) : translate(30, 30)}
      r={26}
      fill="white"
      dragologyOnDrag={() => d.between([{ status: "off" }, { status: "on" }])}
    />
  </g>
);

// d.vary with a constraint: a slider.
type SliderState = { value: number };

const slider: Draggable<SliderState> = ({ state, d }) => (
  <g transform={translate(20, 50)}>
    <line x1={0} y1={0} x2={240} y2={0} stroke="#9ca3af" strokeWidth={4} />
    <circle
      id="thumb"
      transform={translate(state.value, 0)}
      r={14}
      fill="#3b82f6"
      dragologyOnDrag={() =>
        d.vary(state, param("value"), {
          constraint: (s) => inOrder([0, s.value, 240]),
        })
      }
    />
  </g>
);

// d.closest(...).withFloating(): a reorderable list.
type ListState = { items: string[] };

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

const list: Draggable<ListState> = ({ state, d, draggedId }) => (
  <g transform={translate(20, 20)}>
    {state.items.map((item, i) => (
      <g
        id={`item-${item}`}
        transform={translate(0, i * 50)}
        dragologyZIndex={draggedId === `item-${item}` ? "/1" : false}
        dragologyOnDrag={() =>
          d
            .closest(
              state.items.map((_, j) => ({
                items: moveItem(state.items, i, j),
              })),
            )
            .withFloating()
        }
      >
        <rect width={160} height={40} rx={6} fill="#e0e7ff" stroke="#6366f1" />
        <text transform={translate(12, 26)} fontSize={16}>
          {item}
        </text>
      </g>
    ))}
  </g>
);

function App() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: 16 }}>
      <h1>Dragology consumer</h1>
      <h2>Toggle</h2>
      <DraggableRenderer
        draggable={toggle}
        initialState={{ status: "off" }}
        width={160}
        height={100}
      />
      <h2>Slider</h2>
      <DraggableRenderer
        draggable={slider}
        initialState={{ value: 60 }}
        width={280}
        height={100}
      />
      <h2>List</h2>
      <DraggableRenderer
        draggable={list}
        initialState={{ items: ["apple", "banana", "cherry", "date"] }}
        width={200}
        height={240}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
