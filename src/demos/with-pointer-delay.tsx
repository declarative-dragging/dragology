import { useMemo, useState } from "react";
import { demo } from "../demo";
import {
  ConfigPanel,
  ConfigSlider,
  DemoDraggable,
  DemoNotes,
  DemoWithConfig,
} from "../demo/ui";
// Only public API, to show that a modifier can live outside the library.
import {
  type DragFrame,
  type Draggable,
  type DragInitContext,
  type DragSpecData,
  Modifier,
  modifier,
  type OpOverlayVisProps,
  type OpTreeViewProps,
  OverlayVis,
  param,
  path,
  translate,
  Vec2,
} from "../lib";

/** Lags the pointer by `delayMs` before feeding it to the wrapped spec. */
const pointerDelay = modifier(
  class<T extends object> extends Modifier<T> {
    readonly name = "pointerDelay";

    log: { time: number; pointer: Vec2 }[] = [];

    constructor(
      ctx: DragInitContext<T>,
      inner: DragSpecData<T>,
      readonly delayMs: number,
    ) {
      super(ctx, inner);
    }

    frame(frame: DragFrame) {
      const now = performance.now();
      this.log.push({ time: now, pointer: frame.pointer });

      const targetTime = now - this.delayMs;
      while (this.log.length > 1 && this.log[1].time <= targetTime) {
        this.log.shift();
      }

      return this.inner.run({ pointer: this.log[0].pointer });
    }

    treeView(props: OpTreeViewProps) {
      return this.wrapperView(props, `${this.delayMs}ms`);
    }

    overlayVis({ active, opacity }: OpOverlayVisProps) {
      // Empty if this op hasn't run yet.
      if (this.log.length === 0) return null;
      const delayedPointer = this.log[0].pointer;
      return (
        <g>
          <OverlayVis op={this.inner.op} active={active} />
          <g opacity={opacity}>
            <polyline
              points={path(...this.log.map(({ pointer }) => pointer))}
              fill="none"
              stroke="magenta"
              strokeWidth={1}
            />
            {this.log.map(({ pointer }, i) => (
              <circle key={i} {...pointer.cxy()} r={1.5} fill="magenta" />
            ))}
            <circle {...delayedPointer.cxy()} r={4} fill="magenta" />
          </g>
        </g>
      );
    }
  },
);

type State = {
  x: number;
  y: number;
  config: {
    delayMs: number;
  };
};

const RADIUS = 15;
const initialState: State = { x: 200, y: 200, config: undefined as any };

const draggable: Draggable<State> = ({ state, d }) => {
  return (
    <circle
      transform={translate(state)}
      r={RADIUS}
      dragologyOnDrag={() =>
        d
          .vary(state, [param("x"), param("y")])
          .with(pointerDelay(state.config.delayMs))
      }
    />
  );
};

export default demo(
  () => {
    const [delayMs, setDelayMs] = useState(250);
    const stateOverride = useMemo(() => ({ config: { delayMs } }), [delayMs]);
    return (
      <div>
        <DemoNotes>
          <p>
            Demonstration of defining a new modifier outside the library, with
            its public API: <code>pointerDelay</code> lags the pointer before
            feeding it to the spec it wraps. It's a <code>Modifier</code>{" "}
            subclass, turned into a helper by <code>modifier(...)</code> and
            attached with <code>.with(pointerDelay(ms))</code>. It also draws
            itself in the debug tree view and overlay (the overlay shows the
            buffered pointer positions). (This reveals a current framework
            limitation: you can't keep running a behavior after drop.)
          </p>
        </DemoNotes>
        <DemoWithConfig>
          <DemoDraggable
            draggable={draggable}
            initialState={initialState}
            width={400}
            height={400}
            stateOverride={stateOverride}
          />
          <ConfigPanel>
            <ConfigSlider
              label="Delay"
              value={delayMs}
              onChange={setDelayMs}
              min={0}
              max={1000}
              step={10}
              formatValue={(v) => `${v}ms`}
            />
          </ConfigPanel>
        </DemoWithConfig>
      </div>
    );
  },
  {
    // The fuzzer's drags take no time, so with any delay every drop
    // lands where the drag started.
    fuzz: [
      {
        name: "no delay",
        draggable,
        initialState: { ...initialState, config: { delayMs: 0 } },
      },
    ],
    tags: ["Modifier", "spec.with", "d.vary"],
  },
);
