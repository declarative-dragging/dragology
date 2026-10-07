import _ from "lodash";
import { useState } from "react";
import { amb, produceAmb } from "../amb";
import { demo } from "../demo";
import {
  ConfigCheckbox,
  ConfigPanel,
  DemoDraggable,
  DemoNotes,
  DemoWithConfig,
} from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

// # Data

const DIMENSIONS = {
  region: ["North", "South", "West"],
  product: ["Widgets", "Gadgets", "Gizmos"],
  quarter: ["Q1", "Q2", "Q3", "Q4"],
} as const;
type Dimension = keyof typeof DIMENSIONS;
const DIMENSION_ORDER = Object.keys(DIMENSIONS) as Dimension[];

const MEASURES = ["sales", "units"] as const;
type Measure = (typeof MEASURES)[number];
// Used for cells when there is nothing in the Values zone.
type CellMeasure = Measure | "count";

type Field = Dimension | Measure;

function isDimension(field: Field): field is Dimension {
  return field in DIMENSIONS;
}

type Record_ = { [D in Dimension]: string } & { [M in Measure]: number };

// Deterministic pseudo-random data (LCG), so the demo is stable.
function makeRecords(): Record_[] {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const records: Record_[] = [];
  for (const region of DIMENSIONS.region) {
    for (const product of DIMENSIONS.product) {
      for (const quarter of DIMENSIONS.quarter) {
        const units = 5 + Math.floor(rand() * 60);
        const price = 8 + Math.floor(rand() * 12);
        records.push({ region, product, quarter, units, sales: units * price });
      }
    }
  }
  return records;
}
const RECORDS = makeRecords();

// # State

type Zone = "rows" | "cols" | "values" | "unused";
const ZONE_ORDER: Zone[] = ["unused", "rows", "cols", "values"];
const ZONE_LABELS: { [Z in Zone]: string } = {
  unused: "Fields",
  rows: "Rows",
  cols: "Columns",
  values: "Values",
};

type State = {
  zones: { [Z in Zone]: Field[] };
};

export const initialState: State = {
  zones: {
    unused: ["units"],
    rows: ["region", "product"],
    cols: ["quarter"],
    values: ["sales"],
  },
};

function allowedZones(field: Field): Zone[] {
  return isDimension(field) ? ["unused", "rows", "cols"] : ["unused", "values"];
}

// # Pivoting

/** A tuple of values for the given dimensions, e.g. ["North", "Widgets"]. */
type Tuple = string[];

/** All tuples for the given dimensions, in nested domain order. */
function tuplesFor(dims: Dimension[]): Tuple[] {
  return dims.reduce<Tuple[]>(
    (acc, dim) => acc.flatMap((t) => DIMENSIONS[dim].map((v) => [...t, v])),
    [[]],
  );
}

function matches(rec: Record_, dims: Dimension[], tuple: Tuple): boolean {
  return dims.every((dim, i) => rec[dim] === tuple[i]);
}

function aggregate(
  rowDims: Dimension[],
  rowTuple: Tuple,
  colDims: Dimension[],
  colTuple: Tuple,
  measure: CellMeasure,
): number {
  let total = 0;
  for (const rec of RECORDS) {
    if (matches(rec, rowDims, rowTuple) && matches(rec, colDims, colTuple)) {
      total += measure === "count" ? 1 : rec[measure];
    }
  }
  return total;
}

/**
 * A stable id fragment for a group of records, independent of whether
 * its dimensions live in Rows or Columns. This is what lets a cell
 * keep its identity (and so animate) when the table re-pivots.
 */
function groupId(
  rowDims: Dimension[],
  rowTuple: Tuple,
  colDims: Dimension[],
  colTuple: Tuple,
): string {
  const assignments: Partial<{ [D in Dimension]: string }> = {};
  rowDims.forEach((dim, i) => (assignments[dim] = rowTuple[i]));
  colDims.forEach((dim, i) => (assignments[dim] = colTuple[i]));
  return DIMENSION_ORDER.filter((dim) => dim in assignments)
    .map((dim) => `${dim}-${assignments[dim]}`)
    .join("-");
}

/** Id fragment for a header cell: the path of dims/values above it. */
function pathId(dims: Dimension[], tuple: Tuple): string {
  return dims.map((dim, i) => `${dim}-${tuple[i]}`).join("-");
}

// # Layout constants

const CANVAS_W = 720;
const CANVAS_H = 800;

const CHIP_W = 64;
const CHIP_H = 22;
const CHIP_GAP = 4;
const ZONE_PAD = 6;
const ZONE_GAP = 12;
const ZONE_MIN_W = 70;
const ZONE_LABEL_Y = 11;
const ZONE_BOX_Y = 16;
const ZONE_BOX_H = CHIP_H + ZONE_PAD * 2;
const SNAP_IN = 40;
const SNAP_OUT = 56;

const TABLE_Y = ZONE_BOX_Y + ZONE_BOX_H + 18;
const ROW_H = 18;
// In-table mode, header rows are taller than data rows, to fit a chip.
const IN_TABLE_HEADER_H = 26;
const CHIP_INSET_X = 4;
const CHIP_INSET_Y = (IN_TABLE_HEADER_H - CHIP_H) / 2;
const ROW_HEADER_W = 76;
const MAX_CELL_W = 64;
const MIN_CELL_W = 8;
const MIN_TEXT_CELL_W = 32;

const DIM_COLOR = "#bfdbfe";
const DIM_STROKE = "#3b82f6";
const MEASURE_COLOR = "#fed7aa";
const MEASURE_STROKE = "#f97316";

const MEASURE_HUES: { [M in CellMeasure]: [number, number, number] } = {
  sales: [59, 130, 246],
  units: [249, 115, 22],
  count: [107, 114, 128],
};

function heat(measure: CellMeasure, t: number): string {
  const [r, g, b] = MEASURE_HUES[measure];
  const mix = (c: number) => Math.round(255 + (c - 255) * t * 0.55);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function chipColors(field: Field) {
  return isDimension(field)
    ? { fill: DIM_COLOR, stroke: DIM_STROKE }
    : { fill: MEASURE_COLOR, stroke: MEASURE_STROKE };
}

// # Rendering

type Config = {
  /** Put the Rows, Columns, and Values chips in the table's corner, beside
   * the headers they control, rather than in zones above the table. */
  inTable: boolean;
};

export const makeDraggable =
  ({ inTable }: Config): Draggable<State> =>
  ({ state, d, draggedId }) => {
    const rowDims = state.zones.rows as Dimension[];
    const colDims = state.zones.cols as Dimension[];
    const measures: CellMeasure[] =
      state.zones.values.length > 0
        ? (state.zones.values as Measure[])
        : ["count"];

    // ## Table geometry
    //
    // By default, every zone is a box above the table. In-table mode keeps
    // only the Fields pool up there and puts the other chips in the table's
    // corner, beside the headers they control. From the top, its header rows
    // are:
    //   - one row per column field, its chip right-aligned against it (or
    //     one empty row, holding the Columns slot, when there are none)
    //   - the measure row, with the Values chips
    //   - the row-field row, with one chip atop each row-header column

    const rowTuples = tuplesFor(rowDims);
    const colTuples = tuplesFor(colDims);
    const headerRowH = inTable ? IN_TABLE_HEADER_H : ROW_H;
    const numRowHeaderCols = Math.max(1, rowDims.length);
    const numColLevelRows = inTable
      ? Math.max(1, colDims.length)
      : colDims.length;
    const showMeasureRow =
      inTable || measures.length > 1 || colDims.length === 0;
    const measureRowY = numColLevelRows * headerRowH;
    const rowFieldRowY = measureRowY + (showMeasureRow ? headerRowH : 0);
    const headerH = rowFieldRowY + (inTable ? headerRowH : 0);

    const chipsW = (n: number) =>
      Math.max(1, n) * CHIP_W + Math.max(0, n - 1) * CHIP_GAP;
    const cornerW = Math.max(
      numRowHeaderCols * ROW_HEADER_W,
      inTable ? chipsW(state.zones.values.length) + CHIP_INSET_X * 2 : 0,
    );
    const rowHeaderW = cornerW / numRowHeaderCols;

    const numLeafCols = colTuples.length * measures.length;
    const cellW = _.clamp(
      (CANVAS_W - cornerW) / numLeafCols,
      MIN_CELL_W,
      MAX_CELL_W,
    );
    const showCellText = cellW >= MIN_TEXT_CELL_W;

    // Zones drawn as boxes above the table, laid out left to right.
    const boxZones: Zone[] = inTable ? ["unused"] : ZONE_ORDER;
    const zoneWidths = _.mapValues(state.zones, (fields) =>
      Math.max(ZONE_MIN_W, chipsW(fields.length) + ZONE_PAD * 2),
    );
    const zoneXs: { [Z in Zone]?: number } = {};
    let x = 0;
    for (const zone of boxZones) {
      zoneXs[zone] = x;
      x += zoneWidths[zone] + ZONE_GAP;
    }

    /** Where the chip at index `i` of `zone` sits, in canvas coordinates. */
    const chipPos = (zone: Zone, i: number): [number, number] => {
      if (zoneXs[zone] !== undefined) {
        return [
          zoneXs[zone] + ZONE_PAD + i * (CHIP_W + CHIP_GAP),
          ZONE_BOX_Y + ZONE_PAD,
        ];
      }
      switch (zone) {
        case "cols":
          return [
            cornerW - CHIP_INSET_X - CHIP_W,
            TABLE_Y + i * headerRowH + CHIP_INSET_Y,
          ];
        case "values": {
          const n = state.zones.values.length;
          return [
            cornerW - CHIP_INSET_X - chipsW(n) + i * (CHIP_W + CHIP_GAP),
            TABLE_Y + measureRowY + CHIP_INSET_Y,
          ];
        }
        case "rows":
          return [
            i * rowHeaderW + CHIP_INSET_X,
            TABLE_Y + rowFieldRowY + CHIP_INSET_Y,
          ];
        case "unused":
          throw new Error("the Fields pool is always a box");
      }
    };

    const chipSpec = (field: Field) => {
      const zones = allowedZones(field);
      const candidates = produceAmb(state, (draft) => {
        for (const zone of ZONE_ORDER) {
          _.pull(draft.zones[zone], field);
        }
        const zone = amb(zones);
        const idx = amb(_.range(draft.zones[zone].length + 1));
        draft.zones[zone].splice(idx, 0, field);
      });
      // Slots act as islands: the table only re-pivots once the chip is
      // near one. Far from every slot, the current state stays put, so
      // dragging across a zone doesn't flip the table halfway.
      return d
        .closest(candidates)
        .whenFar(state, { gapIn: SNAP_IN, gapOut: SNAP_OUT })
        .withBranchTransition(150)
        .withFloating({ ghost: { opacity: 0.3 } });
    };

    // Per-measure maxima, for the heat coloring.
    const cellValues = new Map<string, number>();
    const measureMax: { [M in CellMeasure]?: number } = {};
    rowTuples.forEach((rt) =>
      colTuples.forEach((ct) =>
        measures.forEach((m) => {
          const v = aggregate(rowDims, rt, colDims, ct, m);
          cellValues.set(`${groupId(rowDims, rt, colDims, ct)}-${m}`, v);
          measureMax[m] = Math.max(measureMax[m] ?? 0, v);
        }),
      ),
    );

    // Header cells at each level, with their span.
    const headerCells = (dims: Dimension[], tuples: Tuple[]) => {
      const cells: {
        level: number;
        id: string;
        label: string;
        start: number;
        span: number;
      }[] = [];
      dims.forEach((_dim, level) => {
        let start = 0;
        while (start < tuples.length) {
          const prefix = tuples[start].slice(0, level + 1);
          let end = start;
          while (
            end < tuples.length &&
            _.isEqual(tuples[end].slice(0, level + 1), prefix)
          ) {
            end++;
          }
          cells.push({
            level,
            id: pathId(dims.slice(0, level + 1), prefix),
            label: prefix[level],
            start,
            span: end - start,
          });
          start = end;
        }
      });
      return cells;
    };

    const rowHeaderCells = headerCells(rowDims, rowTuples);
    const colHeaderCells = headerCells(colDims, colTuples);

    const headerFill = (level: number) =>
      level === 0 ? "#e5e7eb" : level === 1 ? "#eef0f3" : "#f5f6f8";

    return (
      <g>
        {/* ## Zone boxes */}
        {boxZones.map((zone) => (
          <g id={`zone-${zone}`} transform={translate(zoneXs[zone]!, 0)}>
            <text x={0} y={ZONE_LABEL_Y} fontSize={11} fill="#6b7280">
              {ZONE_LABELS[zone]}
            </text>
            <rect
              x={0}
              y={ZONE_BOX_Y}
              width={zoneWidths[zone]}
              height={ZONE_BOX_H}
              rx={5}
              fill={zone === "unused" ? "#fafafa" : "#f3f4f6"}
              stroke="#d1d5db"
              strokeDasharray={zone === "unused" ? "3 3" : undefined}
            />
          </g>
        ))}

        {/* ## Empty slots: where the first chip of an empty zone would go */}
        {(inTable ? (["cols", "values", "rows"] as const) : []).map((zone) => (
          <g
            id={`slot-${zone}`}
            transform={translate(...chipPos(zone, 0))}
            opacity={state.zones[zone].length === 0 ? 1 : 0}
            dragologyZIndex={1}
          >
            <rect
              x={0}
              y={0}
              width={CHIP_W}
              height={CHIP_H}
              rx={CHIP_H / 2}
              fill="white"
              stroke="#9ca3af"
              strokeDasharray="3 3"
            />
            <text
              x={CHIP_W / 2}
              y={CHIP_H / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fontStyle="italic"
              fill="#9ca3af"
            >
              {ZONE_LABELS[zone].toLowerCase()}
            </text>
          </g>
        ))}

        {/* ## Chips */}
        {ZONE_ORDER.map((zone) =>
          state.zones[zone].map((field, i) => {
            const isDragged = draggedId === `chip-${field}`;
            const { fill, stroke } = chipColors(field);
            return (
              <g
                id={`chip-${field}`}
                transform={translate(...chipPos(zone, i))}
                dragologyZIndex={isDragged ? "/1" : 2}
                dragologyOnDrag={() => chipSpec(field)}
                style={{ cursor: "grab" }}
              >
                <rect
                  x={0}
                  y={0}
                  width={CHIP_W}
                  height={CHIP_H}
                  rx={CHIP_H / 2}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isDragged ? 2 : 1}
                />
                <text
                  x={CHIP_W / 2}
                  y={CHIP_H / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fill="#1f2937"
                >
                  {field}
                </text>
              </g>
            );
          }),
        )}

        {/* ## Table */}
        <g transform={translate(0, TABLE_Y)}>
          <g id="corner">
            <rect
              x={0}
              y={0}
              width={cornerW + (inTable ? numLeafCols * cellW : 0)}
              height={headerH}
              fill="#f9fafb"
              stroke="#d1d5db"
            />
          </g>
          {/* Names of the row fields (in-table mode, their chips are there) */}
          {!inTable &&
            rowDims.map((dim, i) => (
              <g
                id={`corner-${dim}`}
                transform={translate(i * rowHeaderW, headerH - ROW_H)}
              >
                <text
                  x={6}
                  y={ROW_H / 2}
                  dominantBaseline="central"
                  fontSize={10}
                  fontStyle="italic"
                  fill="#6b7280"
                >
                  {dim}
                </text>
              </g>
            ))}

          {/* Column headers (dimension levels) */}
          {colHeaderCells.map((hc) => {
            const w = hc.span * measures.length * cellW;
            return (
              <g
                id={`ch-${hc.id}`}
                transform={translate(
                  cornerW + hc.start * measures.length * cellW,
                  hc.level * headerRowH,
                )}
              >
                <rect
                  x={0}
                  y={0}
                  width={w}
                  height={headerRowH}
                  fill={headerFill(hc.level)}
                  stroke="#d1d5db"
                />
                {w >= MIN_TEXT_CELL_W && (
                  <text
                    x={w / 2}
                    y={headerRowH / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fontWeight="bold"
                    fill="#374151"
                  >
                    {hc.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Column headers (measure level) */}
          {showMeasureRow &&
            colTuples.map((ct, ci) =>
              measures.map((m, mi) => (
                <g
                  id={`ch-${pathId(colDims, ct)}-m-${m}`}
                  transform={translate(
                    cornerW + (ci * measures.length + mi) * cellW,
                    measureRowY,
                  )}
                >
                  <rect
                    x={0}
                    y={0}
                    width={cellW}
                    height={headerRowH}
                    fill={headerFill(colDims.length)}
                    stroke="#d1d5db"
                  />
                  {showCellText && (
                    <text
                      x={cellW / 2}
                      y={headerRowH / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10}
                      fontStyle={m === "count" ? "italic" : undefined}
                      fill="#374151"
                    >
                      {m}
                    </text>
                  )}
                </g>
              )),
            )}

          {/* Row headers */}
          {rowDims.length === 0 && (
            <g id="rh-all" transform={translate(0, headerH)}>
              <rect
                x={0}
                y={0}
                width={rowHeaderW}
                height={ROW_H}
                fill="#e5e7eb"
                stroke="#d1d5db"
              />
              <text
                x={6}
                y={ROW_H / 2}
                dominantBaseline="central"
                fontSize={10}
                fontWeight="bold"
                fill="#374151"
              >
                All
              </text>
            </g>
          )}
          {rowHeaderCells.map((hc) => (
            <g
              id={`rh-${hc.id}`}
              transform={translate(
                hc.level * rowHeaderW,
                headerH + hc.start * ROW_H,
              )}
            >
              <rect
                x={0}
                y={0}
                width={rowHeaderW}
                height={hc.span * ROW_H}
                fill={headerFill(hc.level)}
                stroke="#d1d5db"
              />
              <text
                x={6}
                y={ROW_H / 2}
                dominantBaseline="central"
                fontSize={10}
                fontWeight="bold"
                fill="#374151"
              >
                {hc.label}
              </text>
            </g>
          ))}

          {/* Cells */}
          {rowTuples.map((rt, ri) =>
            colTuples.map((ct, ci) =>
              measures.map((m, mi) => {
                const gid = groupId(rowDims, rt, colDims, ct);
                const v = cellValues.get(`${gid}-${m}`)!;
                const t = measureMax[m] ? v / measureMax[m]! : 0;
                return (
                  <g
                    id={`cell-${gid}-${m}`}
                    transform={translate(
                      cornerW + (ci * measures.length + mi) * cellW,
                      headerH + ri * ROW_H,
                    )}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={cellW}
                      height={ROW_H}
                      fill={heat(m, t)}
                      stroke="#e5e7eb"
                    />
                    {showCellText && (
                      <text
                        x={cellW - 5}
                        y={ROW_H / 2}
                        textAnchor="end"
                        dominantBaseline="central"
                        fontSize={10}
                        fill="#1f2937"
                      >
                        {v.toLocaleString()}
                      </text>
                    )}
                  </g>
                );
              }),
            ),
          )}
        </g>
      </g>
    );
  };

export const draggable = makeDraggable({ inTable: false });
const inTableDraggable = makeDraggable({ inTable: true });

export default demo(
  () => {
    const [inTable, setInTable] = useState(false);
    return (
      <div>
        <DemoNotes>
          A pivot table. Drag field chips between <i>Rows</i>, <i>Columns</i>,{" "}
          <i>Values</i>, and the unused <i>Fields</i> pool, or reorder them
          within a zone. The table re-pivots live as a preview. Cells are keyed
          by their group (which dimension values they aggregate), so a cell
          keeps its identity — and glides to its new spot — when a dimension
          moves between Rows and Columns.
        </DemoNotes>
        <DemoWithConfig>
          <DemoDraggable
            draggable={inTable ? inTableDraggable : draggable}
            initialState={initialState}
            width={CANVAS_W}
            height={CANVAS_H}
          />
          <ConfigPanel>
            <ConfigCheckbox
              label="Chips in table headers"
              value={inTable}
              onChange={setInTable}
            />
          </ConfigPanel>
        </DemoWithConfig>
      </div>
    );
  },
  {
    fuzz: [
      { name: "zones", draggable, initialState },
      { name: "in table", draggable: inTableDraggable, initialState },
    ],
    tags: [
      "d.closest",
      "spec.withFloating [ghost]",
      "spec.withBranchTransition",
      "spec.whenFar",
      "reordering",
    ],
  },
);
