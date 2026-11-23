import * as Plot from "@observablehq/plot";
import { demo } from "../../demo";
import { DemoDraggable, DemoLink, DemoNotes } from "../../demo/ui";
import { Draggable } from "../../draggable";
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

type State = { layout: "stacked" | "grouped" };

const initialState: State = { layout: "stacked" };

const W = 420;
const H = 280;

const draggable: Draggable<State> = ({ state, d }) => {
  const bars = keyed(DATA, (d) => `bar-${d.quarter}-${d.drink}`);
  const zeroRule = keyed([0], () => "zero-rule");
  const options: Plot.PlotOptions =
    state.layout === "stacked"
      ? {
          marks: [
            Plot.barY(DATA, {
              x: "quarter",
              y: "sales",
              fill: "drink",
              ...bars,
            }),
            Plot.ruleY([0], zeroRule),
          ],
        }
      : {
          fx: { label: null },
          x: { axis: null, domain: DRINKS },
          marks: [
            Plot.barY(DATA, {
              fx: "quarter",
              x: "drink",
              y: "sales",
              fill: "drink",
              ...bars,
            }),
            Plot.ruleY([0], zeroRule),
          ],
        };

  return plotSvgx(
    {
      width: W,
      height: H,
      color: { domain: DRINKS, range: COLORS },
      y: { grid: true, label: "Sales" },
      ...options,
      x: { label: null, ...options.x },
    },
    {
      attach: (key) =>
        key.startsWith("bar-")
          ? {
              dragologyOnDrag: () =>
                d.between([{ layout: "stacked" }, { layout: "grouped" }], {
                  sharpness: 3,
                }),
              style: { cursor: "grab" },
            }
          : undefined,
    },
  );
};

export default demo(
  () => (
    <>
      <DemoNotes>
        Drag a bar to transition between stacked and grouped bar charts (drawn
        with{" "}
        <DemoLink href="https://observablehq.com/plot/">
          Observable Plot
        </DemoLink>
        ). Kinda a weird gesture, especially for low bars where grouped can be
        higher than stacked. [Observable Plot integration is experimental!]
      </DemoNotes>
      <DemoDraggable
        draggable={draggable}
        initialState={initialState}
        width={W}
        height={H}
      />
    </>
  ),
  { tags: ["d.between", "Observable Plot"] },
);
