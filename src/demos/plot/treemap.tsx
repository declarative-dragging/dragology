import * as Plot from "@observablehq/plot";
import { hierarchy, HierarchyRectangularNode, treemap } from "d3-hierarchy";
import { useMemo, useState } from "react";
import { demo } from "../../demo";
import {
  ConfigCheckbox,
  ConfigPanel,
  ConfigSelect,
  DemoDraggable,
  DemoLink,
  DemoNotes,
  DemoWithConfig,
} from "../../demo/ui";
import { Draggable } from "../../draggable";
import { keyed, plotSvgx } from "./plot";

const FOLDERS = ["Photos", "Music", "Documents", "Games"];
const COLORS: Record<string, string> = {
  Photos: "#4269d0",
  Music: "#efb118",
  Documents: "#ff725c",
  Games: "#6cc5b0",
};

const FILE_SIZES: Record<string, number> = {
  "beach.raw": 42,
  "wedding.zip": 64,
  "cat.png": 9,
  "album.flac": 38,
  "podcast.mp3": 21,
  "demo.wav": 14,
  "thesis.pdf": 12,
  "taxes.xlsx": 5,
  "slides.key": 26,
  "notes.txt": 3,
  "saves.dat": 18,
  "mods.zip": 33,
};

/** Each folder's files, in order. */
type State = { files: Record<string, string[]> };

const initialState: State = {
  files: {
    Photos: ["wedding.zip", "beach.raw", "cat.png"],
    Music: ["album.flac", "podcast.mp3", "demo.wav"],
    Documents: ["slides.key", "thesis.pdf", "taxes.xlsx", "notes.txt"],
    Games: ["mods.zip", "saves.dat"],
  },
};

type Config = {
  /** Lay out files in the order the state lists them, and let drags
   * put a file anywhere in a folder. Otherwise, files are laid out
   * biggest first, and drags only choose the folder. */
  reorder: boolean;
  spec: SpecKind;
};

const SPEC_KINDS = ["closest", "closest + floating", "between"] as const;
type SpecKind = (typeof SPEC_KINDS)[number];

const defaultConfig: Config = { reorder: false, spec: "closest + floating" };

const W = 480;
const H = 320;
const HEADER = 18;

type Node = { name: string; size?: number; children?: Node[] };
type Rect = HierarchyRectangularNode<Node>;

function layout(
  state: State,
  config: Config,
): { folders: Rect[]; files: Rect[] } {
  const root = hierarchy<Node>({
    name: "root",
    children: FOLDERS.map((folder) => ({
      name: folder,
      children: state.files[folder].map((file) => ({
        name: file,
        size: FILE_SIZES[file],
      })),
    })),
  }).sum((n) => n.size ?? 0);
  // Folders keep a fixed order, so moving a file doesn't shuffle them.
  if (!config.reorder) {
    root.sort((a, b) => (a.depth === 2 ? b.value! - a.value! : 0));
  }
  const laidOut = treemap<Node>()
    .size([W, H])
    .paddingInner(3)
    .paddingTop(HEADER)(root);
  return { folders: laidOut.children ?? [], files: laidOut.leaves() };
}

/** A label's inset from its rect's corner, as a fraction of its font size. */
const INSET = 0.4;

/**
 * The biggest font size, up to Plot's 10px, at which a file's name
 * (roughly 0.6em per character, 1em tall) fits in its rect.
 */
function labelSize(n: Rect): number {
  const byWidth = (n.x1 - n.x0) / (0.6 * n.data.name.length + 2 * INSET);
  const byHeight = (n.y1 - n.y0) / (1 + 2 * INSET);
  return Math.max(0, Math.min(10, byWidth, byHeight));
}

function moveFile(
  state: State,
  file: string,
  folder: string,
  index: number,
): State {
  const files = Object.fromEntries(
    FOLDERS.map((f) => [f, state.files[f].filter((x) => x !== file)]),
  );
  files[folder].splice(index, 0, file);
  return { files };
}

const draggableFactory =
  (config: Config): Draggable<State> =>
  ({ state, d, draggedId }) => {
    const { folders, files } = layout(state, config);
    const folderOf = (n: Rect) => n.parent!.data.name;

    const dragFile = (file: string) => () => {
      const from = FOLDERS.find((f) => state.files[f].includes(file))!;
      // Emptying a folder would shrink it to nothing, leaving no way to
      // drag a file back into it, so the last file in a folder stays put.
      const folders = state.files[from].length === 1 ? [from] : FOLDERS;
      const targets = folders.flatMap((folder) => {
        const others = state.files[folder].filter((x) => x !== file);
        const indices = config.reorder
          ? others.map((_, i) => i).concat(others.length)
          : [others.length];
        return indices.map((i) => moveFile(state, file, folder, i));
      });
      switch (config.spec) {
        case "closest":
          return d.closest(targets);
        case "closest + floating":
          return d.closest(targets).withFloating();
        case "between":
          return d.between(targets);
      }
    };

    return plotSvgx(
      {
        width: W,
        height: H,
        margin: 0,
        x: { type: "identity", axis: null },
        y: { type: "identity", axis: null },
        marks: [
          Plot.rect(folders, {
            x1: "x0",
            y1: "y0",
            x2: "x1",
            y2: "y1",
            fill: (n: Rect) => COLORS[n.data.name],
            fillOpacity: 0.15,
            ...keyed(folders, (n) => `folder-${n.data.name}`),
          }),
          Plot.text(folders, {
            x: (n: Rect) => n.x0 + 4,
            y: (n: Rect) => n.y0 + 4,
            text: (n: Rect) => n.data.name,
            textAnchor: "start",
            lineAnchor: "top",
            fontWeight: "bold",
            ...keyed(folders, (n) => `folder-label-${n.data.name}`),
          }),
          Plot.rect(files, {
            x1: "x0",
            y1: "y0",
            x2: "x1",
            y2: "y1",
            fill: (n: Rect) => COLORS[folderOf(n)],
            ...keyed(files, (n) => `file-rect-${n.data.name}`),
          }),
          Plot.text(files, {
            x: (n: Rect) => n.x0 + INSET * labelSize(n),
            y: (n: Rect) => n.y0 + INSET * labelSize(n),
            text: (n: Rect) => n.data.name,
            fontSize: labelSize,
            textAnchor: "start",
            lineAnchor: "top",
            fill: "white",
            ...keyed(files, (n) => `file-label-${n.data.name}`),
          }),
        ],
      },
      {
        // Each file's rect and label go in a group, `file-<name>`, which
        // is what's dragged.
        group: (key) => {
          const file = key.match(/^file-(?:rect|label)-(.*)$/)?.[1];
          return file === undefined ? undefined : `file-${file}`;
        },
        attach: (key) => {
          if (key.includes("label-")) return { pointerEvents: "none" };
          if (key.startsWith("file-") && !key.startsWith("file-rect-"))
            return {
              dragologyOnDrag: dragFile(key.slice("file-".length)),
              dragologyZIndex: draggedId === key ? "/1" : false,
              style: { cursor: "grab" },
            };
        },
      },
    );
  };

export default demo(
  () => {
    const [config, setConfig] = useState(defaultConfig);
    const draggable = useMemo(() => draggableFactory(config), [config]);
    return (
      <DemoWithConfig>
        <div>
          <DemoNotes>
            A treemap of files in folders, laid out by{" "}
            <DemoLink href="https://d3js.org/d3-hierarchy/treemap">
              d3-hierarchy
            </DemoLink>{" "}
            and drawn with{" "}
            <DemoLink href="https://observablehq.com/plot/">
              Observable Plot
            </DemoLink>
            . Because an unpredictable layout algorithm drives rendering,
            dragging is pretty unpredictable here. [Observable Plot integration
            is experimental!]
          </DemoNotes>
          <DemoDraggable
            draggable={draggable}
            initialState={initialState}
            width={W}
            height={H}
          />
        </div>
        <ConfigPanel>
          <ConfigCheckbox
            value={config.reorder}
            onChange={(reorder) => setConfig((c) => ({ ...c, reorder }))}
          >
            Drag to reorder within folders
          </ConfigCheckbox>
          <ConfigSelect
            label="Drag spec"
            value={config.spec}
            onChange={(spec) => setConfig((c) => ({ ...c, spec }))}
            options={SPEC_KINDS}
          />
        </ConfigPanel>
      </DemoWithConfig>
    );
  },
  {
    tags: ["d.closest", "spec.withFloating", "d.between", "Observable Plot"],
    fuzz: [false, true].flatMap((reorder) =>
      SPEC_KINDS.map((spec) => ({
        name: `${reorder ? "reorder" : "folders only"}, ${spec}`,
        draggable: draggableFactory({ reorder, spec }),
        initialState,
      })),
    ),
  },
);
