import * as Plot from "@observablehq/plot";
import { demo } from "../../demo";
import { DemoDraggable, DemoLink, DemoNotes } from "../../demo/ui";
import { Draggable } from "../../draggable";
import { translate } from "../../svgx/helpers";
import { keyed, plotSvgx } from "./plot";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const DRINKS = ["Espresso", "Latte", "Tea", "Cocoa"];
const COLORS = ["#4269d0", "#efb118", "#ff725c", "#6cc5b0"];

const SALES: Record<string, number[]> = {
  Espresso: [32, 30, 28, 31],
  Latte: [45, 41, 38, 52],
  Tea: [18, 24, 30, 22],
  Cocoa: [26, 12, 6, 34],
};

type Datum = { quarter: string; drink: string; sales: number };
const DATA: Datum[] = DRINKS.flatMap((drink) =>
  QUARTERS.map((quarter, i) => ({ quarter, drink, sales: SALES[drink][i] })),
);

type State = {
  /** Drinks from the bottom of the stack to the top. */
  order: string[];
};

const initialState: State = { order: DRINKS };

const PLOT_W = 340;
const PLOT_H = 280;

function moveTo(order: string[], drink: string, j: number): string[] {
  const rest = order.filter((x) => x !== drink);
  return [...rest.slice(0, j), drink, ...rest.slice(j)];
}

const draggable: Draggable<State> = ({ state, d }) => {
  const reorder = (drink: string) =>
    d.between(
      state.order.map((_, j) => ({ order: moveTo(state.order, drink, j) })),
    );

  const chart = plotSvgx(
    {
      width: PLOT_W,
      height: PLOT_H,
      color: { domain: DRINKS, range: COLORS },
      y: { grid: true, label: "Sales" },
      x: { label: null },
      marks: [
        Plot.barY(DATA, {
          x: "quarter",
          y: "sales",
          fill: "drink",
          order: state.order,
          ...keyed(DATA, (d) => `bar-${d.quarter}-${d.drink}`),
        }),
        Plot.ruleY([0]),
      ],
    },
    {
      attach: (key) => ({
        dragologyOnDrag: () => reorder(key.split("-")[2]).withSnapRadius(5),
        style: { cursor: "grab" },
      }),
    },
  );

  // The legend reads top to bottom, like the stack.
  const legend = (
    <g transform={translate(PLOT_W + 20, 30)}>
      {[...state.order].reverse().map((drink, i) => (
        <g
          id={`legend-${drink}`}
          transform={translate(0, i * 20)}
          dragologyOnDrag={() => reorder(drink).withSnapRadius(2)}
          style={{ cursor: "grab" }}
        >
          <rect width={90} height={20} rx={4} fill="white" />
          <rect
            transform={translate(6, 5)}
            width={12}
            height={12}
            fill={COLORS[DRINKS.indexOf(drink)]}
          />
          <text transform={translate(24, 15)} fontSize={12}>
            {drink}
          </text>
        </g>
      ))}
    </g>
  );

  return (
    <g>
      {chart}
      {legend}
    </g>
  );
};

export default demo(
  () => (
    <>
      <DemoNotes>
        A stacked bar chart made with{" "}
        <DemoLink href="https://observablehq.com/plot/">
          Observable Plot
        </DemoLink>
        . Drag segments to change the stack order. The draggable legend is made
        by hand, since Observable Plot's is drawn with HTML. [Observable Plot
        integration is experimental!]
      </DemoNotes>
      <DemoDraggable
        draggable={draggable}
        initialState={initialState}
        width={PLOT_W + 130}
        height={PLOT_H}
      />
    </>
  ),
  { tags: ["d.closest", "reordering", "Observable Plot"] },
);
