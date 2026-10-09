import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { DemoSettingsBar, DemoSettingsProvider } from "../demo/ui";
import { useTitle } from "../useTitle";

import ClampedSlider from "./repros/clamped-slider";
import clampedSliderSrc from "./repros/clamped-slider.tsx?raw";
import ClosestWithoutStay from "./repros/closest-without-stay";
import closestWithoutStaySrc from "./repros/closest-without-stay.tsx?raw";
import ConditionalSibling from "./repros/conditional-sibling";
import conditionalSiblingSrc from "./repros/conditional-sibling.tsx?raw";
import DropTargetCoincidence from "./repros/drop-target-coincidence";
import dropTargetCoincidenceSrc from "./repros/drop-target-coincidence.tsx?raw";
import EdgeOnlyInOneState from "./repros/edge-only-in-one-state";
import edgeOnlyInOneStateSrc from "./repros/edge-only-in-one-state.tsx?raw";
import GrabPointRotation from "./repros/grab-point-rotation";
import grabPointRotationSrc from "./repros/grab-point-rotation.tsx?raw";
import HubSpokes from "./repros/hub-spokes";
import hubSpokesSrc from "./repros/hub-spokes.tsx?raw";
import LayersStealEvents from "./repros/layers-steal-events";
import layersStealEventsSrc from "./repros/layers-steal-events.tsx?raw";
import PathCommandCount from "./repros/path-command-count";
import pathCommandCountSrc from "./repros/path-command-count.tsx?raw";
import RigidPair from "./repros/rigid-pair";
import rigidPairSrc from "./repros/rigid-pair.tsx?raw";
import SpookyClosest from "./repros/spooky-closest";
import spookyClosestSrc from "./repros/spooky-closest.tsx?raw";
import VanishingDragged from "./repros/vanishing-dragged";
import vanishingDraggedSrc from "./repros/vanishing-dragged.tsx?raw";
import WhenFarConstrainedVary from "./repros/when-far-constrained-vary";
import whenFarConstrainedVarySrc from "./repros/when-far-constrained-vary.tsx?raw";

// # Evidence plumbing
//
// Every claim below points at an archived Prusik transcript. `l` is the line
// in the transcript as Prusik's readable rendering of it numbers lines
// (`GET /api/repos/dragology-70f1f1/transcripts/<name>`): user prompts are
// `> ...` lines, assistant text is plain, tool calls are `[Tool] ...`.

const PRUSIK = "http://localhost:2000";

const SESSIONS = {
  knot: ["knot-reidemeister-demo", "115aaa1e-2353-4e8a-b574-2e84837f1140"],
  catalan: ["catalan-explorer", "7a63dbab-e3dc-488f-b2bd-e44424e2d4a9"],
  catalan2: ["demo-catalan", "f3629a01-e258-40d2-b37e-f753cf0d833c"],
  catalan3: [
    "otherother (catalan lockPast)",
    "555c0608-2d40-4ff2-b799-b4963a4fb18f",
  ],
  grab: ["geometry-grab-tracking", "f7b5e38e-c288-4b3d-ba48-51c8ba8028ff"],
  lockPast: [
    "between-commitment (lockPast)",
    "30178ab8-c317-4afc-8c2b-a65bed44d91d",
  ],
  perm: ["permutation-lab-demo", "1faa2319-6582-42d7-a9e2-eb27a7f6dce4"],
  permMatrix: [
    "permutation-lab-matrix-should",
    "187c6ec5-94e5-4b74-a1eb-b68e4b3e166a",
  ],
  permInvalid: ["prevent-invalid-drag", "dc3639d7-f5cb-40c5-9baa-70bde824000a"],
  permSquashed: [
    "fix-squashed-crossings",
    "1e108b0d-dbb8-4b9e-bb48-9da888af871d",
  ],
  permSolid: [
    "symmetric (permutohedron solid)",
    "074574f5-c078-4d6f-9454-24753ae815f9",
  ],
  lambda: ["lambda-beta-drag", "eeba8ef5-611f-4976-8e59-e719761cfa6c"],
  zx: ["zx-string-diagram", "d8e98e3d-ed17-43be-9e96-c77d92335ab0"],
  tilings: ["tilings-with-flips", "5248a240-7c61-427d-bf98-77a76f9bd8cd"],
  rotations: ["rotations-rebalancing", "690148a7-b0b6-4bbc-8dd4-6060007cb97b"],
  gantt: ["gantt-dependency-scheduler", "63c89749-4801-49f7-be08-20ff5826bc6d"],
  tableaux: ["tableaux-rsk-demo", "fadeab46-8065-4efa-ba47-ac3feca41221"],
  pivot: ["pivot-table-drag", "81a9cbbd-c043-4cb9-be5c-1e3340de63b6"],
  pivot2: [
    "other (pivot header chips)",
    "722569b0-5a0c-4f5f-8632-378592fcd32e",
  ],
  layout: ["flex-grid-layout-editor", "088f29de-28b2-45ec-b841-92ac51f128c3"],
  proof: ["proof-by-dragging", "89fbd7da-da40-46e1-b277-ec7ff2482071"],
  regex: ["regex-nfa-sync", "f9106c53-4617-4b6d-a041-6bd649ad160b"],
  git: ["git-graph-surgery", "61c9b61a-cd17-4e37-9c43-4d0e7049b4d7"],
  stock: ["glucose (stock-and-flow)", "4948fcf5-ca83-43cd-93c7-5088a63a0bbc"],
  integrate: [
    "integrate (component elements)",
    "b4002f6d-6e91-4d0e-9a2e-3aff78cfd24d",
  ],
  ops: [
    "implement-drag-spec (ops refactor)",
    "5dd81c51-29ef-4f45-ae75-d0634127032e",
  ],
  ops2: [
    "implement-drag-spec (review follow-ups)",
    "ba66d737-71b1-49f0-80be-ffe543670209",
  ],
  fuzzGaps: ["fuzz-state-gaps", "2dc7e3b1-b50e-4c1c-a926-40a7e092ed1d"],
  fuzzActions: ["fuzz-action-fix", "365c6a8d-4a68-49eb-b170-9170d5887b02"],
  lists2d: ["lists-2d-empty-row", "a55cd6d9-82ba-4b05-a262-0523508bca31"],
  treeMacro: ["tree-macro-gutter-dupe", "0cd74252-6c79-4a90-90b1-f7b6eb0be996"],
  ideas: [
    "demos (ideation + shepherding)",
    "f1df1edc-fe23-4bda-9bd3-e4df0406fbdf",
  ],
} as const;
type SessionKey = keyof typeof SESSIONS;

/** A quote from a transcript, linked to the conversation in Prusik. */
function Ev({
  t,
  l,
  who = "user",
  children,
}: {
  t: SessionKey;
  l: number | string;
  who?: "user" | "agent";
  children: ReactNode;
}) {
  const [name, id] = SESSIONS[t];
  return (
    <div className="my-1.5 pl-3 border-l-2 border-gray-200 text-[13px] text-gray-700">
      <span
        className={who === "user" ? "text-gray-900" : "text-gray-600 italic"}
      >
        {who === "agent" && (
          <span className="not-italic text-gray-400 mr-1">agent:</span>
        )}
        “{children}”
      </span>{" "}
      <a
        href={`${PRUSIK}/transcript/${id}`}
        target="_blank"
        rel="noreferrer"
        className="text-gray-400 hover:text-blue-600 font-mono text-[11px] whitespace-nowrap no-underline"
        title={`${name}--${id}`}
      >
        {name} L{l}
      </a>
    </div>
  );
}

/** A plain pointer into a transcript, without a quote. */
function Ref({ t, l }: { t: SessionKey; l: number | string }) {
  const [name, id] = SESSIONS[t];
  return (
    <a
      href={`${PRUSIK}/transcript/${id}`}
      target="_blank"
      rel="noreferrer"
      className="text-gray-400 hover:text-blue-600 font-mono text-[11px] whitespace-nowrap no-underline"
    >
      {name} L{l}
    </a>
  );
}

function Demo({ id, children }: { id: string; children?: ReactNode }) {
  return (
    <Link
      to={`/demos/${id}`}
      className="text-blue-600 hover:text-blue-800 no-underline"
    >
      {children ?? id}
    </Link>
  );
}

function Task({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a
      href={`${PRUSIK}/repo/dragology-70f1f1?task=${id}`}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 hover:text-blue-800 no-underline"
    >
      {children}{" "}
      <span className="font-mono text-[11px] text-gray-400">{id}</span>
    </a>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="text-[12.5px] bg-gray-100 text-gray-800 px-1 py-0.5 rounded">
      {children}
    </code>
  );
}

function File({ children }: { children: string }) {
  return <code className="text-[12px] text-indigo-700">{children}</code>;
}

/** A live minimal reproduction with its source. */
function Repro({
  title,
  src,
  children,
}: {
  title: string;
  src: string;
  children: ReactNode;
}) {
  const [showSrc, setShowSrc] = useState(false);
  // Drop the import lines; the page reader knows where DemoDraggable comes from.
  const body = src
    .replace(/^import[^\n]*\n(?:[^\n]*\n)*?(?=\n)/, "")
    .trimStart();
  return (
    <div className="my-4 rounded-lg border border-amber-200 bg-amber-50/40">
      <div className="flex items-baseline justify-between px-4 pt-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          repro: {title}
        </div>
        <button
          className="text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
          onClick={() => setShowSrc((s) => !s)}
        >
          {showSrc ? "hide source" : "show source"}
        </button>
      </div>
      <div className="px-4 py-3">{children}</div>
      {showSrc && (
        <pre className="m-0 px-4 py-3 text-[11.5px] leading-snug bg-white border-t border-amber-200 overflow-x-auto rounded-b-lg">
          {body}
        </pre>
      )}
    </div>
  );
}

const CATEGORY_STYLE: Record<string, string> = {
  "API gap": "bg-rose-100 text-rose-800",
  footgun: "bg-orange-100 text-orange-800",
  interpolation: "bg-violet-100 text-violet-800",
  perf: "bg-sky-100 text-sky-800",
  docs: "bg-emerald-100 text-emerald-800",
  tooling: "bg-gray-200 text-gray-700",
  bug: "bg-red-100 text-red-800",
  fixed: "bg-green-100 text-green-800",
  open: "bg-yellow-100 text-yellow-800",
};

function Problem({
  id,
  title,
  cats,
  children,
}: {
  id: string;
  title: ReactNode;
  cats: (keyof typeof CATEGORY_STYLE)[];
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-4">
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        <a
          href={`#${id}`}
          className="text-gray-300 hover:text-gray-500 no-underline mr-2"
        >
          #
        </a>
        {title}
        <span className="ml-2 inline-flex gap-1 align-middle">
          {cats.map((c) => (
            <span
              key={c}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${CATEGORY_STYLE[c]}`}
            >
              {c}
            </span>
          ))}
        </span>
      </h3>
      <div className="text-sm text-gray-800 leading-relaxed [&>p]:my-2 [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:my-0.5">
        {children}
      </div>
    </section>
  );
}

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="text-2xl font-semibold text-gray-900 mt-14 mb-2 pb-1 border-b border-gray-200 scroll-mt-4"
    >
      {children}
    </h2>
  );
}

function Fix({ children }: { children: ReactNode }) {
  return (
    <div className="my-2 pl-3 border-l-2 border-emerald-300 text-sm text-gray-700">
      <span className="text-emerald-700 font-medium">Possible fix: </span>
      {children}
    </div>
  );
}

const TOC: [string, string][] = [
  ["engage", "1. Nothing should happen until you move"],
  ["zones", "2. Tuning engagement and snapping"],
  ["spokes", "3. Walking a graph: hub and spokes"],
  ["grab", "4. Where is the grabbed point?"],
  ["structure", "5. Interpolating structure"],
  ["exists", "6. The dragged element must exist in every target"],
  ["layers", "7. Layers and pointer events"],
  ["vary", "8. vary pitfalls"],
  ["drop", "9. Drops, staging, and two-stage gestures"],
  ["surface", "10. Drawing during a drag; the op API"],
  ["perf", "11. Performance"],
  ["docs", "12. Docs gaps"],
  ["tooling", "13. Tooling"],
  ["tasks", "14. Open tasks and what I'd do first"],
];

export function RetroPage() {
  useTitle("Nursery retrospective — Dragology");
  return (
    <DemoSettingsProvider persist={false}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-5 py-10">
          <Link
            to="/demos"
            className="text-sm text-gray-600 hover:text-gray-800 no-underline"
          >
            ← Demos
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900 mt-4">
            What the nursery taught us about Dragology
          </h1>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            A retrospective over the 32 archived agent sessions that built the
            16 demos in the{" "}
            <Link to="/demos" className="text-blue-600 no-underline">
              Nursery
            </Link>{" "}
            (Sep 27 – Oct 7, 2026), plus the library work those sessions spun
            off (<Code>draggableLine</Code>, <Code>lockPast</Code>,{" "}
            <Code>withOverlay</Code>, <Code>grabPos</Code>, component elements,
            the ops refactor, the fuzzer). The question: where did agents
            struggle with the library, what did you have to correct, and what
            would make the next batch easier?
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Every problem says where we know about it from: a quote and a link
            to the Prusik transcript (<Code>Lnnn</Code> is the line in Prusik's
            readable rendering of the transcript). Where a problem is small
            enough, there's a live minimal reproduction with its source.
            Problems are grouped by theme, roughly most-to-least costly. Tags:{" "}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_STYLE["API gap"]}`}
            >
              API gap
            </span>{" "}
            can't be expressed;{" "}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_STYLE.footgun}`}
            >
              footgun
            </span>{" "}
            expressible but easy to get wrong;{" "}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_STYLE.fixed}`}
            >
              fixed
            </span>{" "}
            a library change already landed.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Toggle <b>Overlay</b> and <b>Drop zones</b> in the bar at the bottom
            to see what the specs in the repros are doing.
          </p>

          <nav className="mt-6 text-sm columns-2 gap-6">
            {TOC.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="block text-blue-700 hover:text-blue-900 no-underline py-0.5"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* ---------------------------------------------------------------- */}
          <H2 id="summary">The short version</H2>
          <ol className="text-sm text-gray-800 leading-relaxed list-decimal pl-5 [&_li]:my-1.5">
            <li>
              <b>The most-repeated crash</b> was the interpolator pairing non-id
              siblings by index (
              <Code>Cannot lerp between different element types</Code>): at
              least seven times across six sessions, always from a conditionally
              rendered sibling. Nobody read it as a library bug, but nobody
              avoided it either.{" "}
              <a href="#index-pairing" className="text-blue-600 no-underline">
                §5.1
              </a>
            </li>
            <li>
              <b>The most-repeated correction</b> was "something happened on
              mouse-down / at a distance": four demos reached for plain{" "}
              <Code>d.closest</Code> and got spooky engagement (tableaux, pivot,
              ZX, gantt). The fix is always "include <Code>state</Code>" or{" "}
              <Code>whenFar(state)</Code>, but the docs present
              <Code>whenFar</Code> as an exotic "islands in a sea" effect, not
              the default for zone-to-zone drags.{" "}
              <a href="#engage" className="text-blue-600 no-underline">
                §1
              </a>
            </li>
            <li>
              <b>The most expensive design loop</b> was graph walking (hub and
              spokes): the Tamari token took four iterations to reach{" "}
              <Code>closest</Code>-of-two-point-<Code>between</Code>s +
              snap-chaining + <Code>lockPast</Code>, with <Code>lockPast</Code>{" "}
              itself going through two designs. There are two chaining APIs and
              agents pick the wrong one first.{" "}
              <a href="#spokes" className="text-blue-600 no-underline">
                §3
              </a>
            </li>
            <li>
              <b>The thing agents most often wished the library did</b> is keep
              an element attached to a moving thing it isn't the child of: edges
              keyed by child "dangle", new crossings fade in at their final
              position, lines whose ends move can't be grabbed partway. Three
              demos invented the same "ghost / stand-in with a shared id" idiom
              independently.{" "}
              <a href="#structure" className="text-blue-600 no-underline">
                §5
              </a>
            </li>
            <li>
              <b>Two demos stopped being drag demos</b>, in whole or part,
              because a drop is one interpolation from preview to result (lambda
              β-reduction: "that's animation, not manipulation"; tableaux row
              insertion: "I think maybe you need to move away from Dragology for
              this one").{" "}
              <a href="#drop" className="text-blue-600 no-underline">
                §9
              </a>
            </li>
            <li>
              <b>Docs</b>: <Code>d.fixed</Code>, <Code>d.dropTarget</Code>,{" "}
              <Code>d.varyFunc</Code>, <Code>switchToStateAndFollow</Code>,{" "}
              <Code>reactTo</Code>, <Code>stickiness</Code>,{" "}
              <Code>lockPast</Code>, <Code>tether</Code>/<Code>ghost</Code>,{" "}
              <Code>
                withSnapRadius(…, {"{"}chain{"}"})
              </Code>
              , <Code>dragologyEmergeFrom</Code>, <Code>isTracking</Code> are
              all used by nursery demos and all absent from{" "}
              <File>docs/AGENTS.md</File>; every agent re-derived them from
              source.{" "}
              <a href="#docs" className="text-blue-600 no-underline">
                §12
              </a>
            </li>
          </ol>

          {/* ---------------------------------------------------------------- */}
          <H2 id="engage">1. Nothing should happen until you move</H2>
          <p className="text-sm text-gray-700">
            Four independent sessions produced drags that changed the preview at
            pointer-down or far from any target. Each time the agent's first
            reach was a bare <Code>d.closest(candidates)</Code>, and each time
            the fix was to make "stay where you are" a real option.
          </p>

          <Problem
            id="closest-no-stay"
            title="closest over “all other positions” swaps at pointer-down"
            cats={["footgun", "docs"]}
          >
            <p>
              Tableaux "Fillings": each cell's spec was{" "}
              <Code>d.closest(swaps).whenFar(state).withFloating()</Code> with{" "}
              <Code>swaps</Code> = every swap with another cell. The unchanged
              state wasn't a candidate and neighbours were inside{" "}
              <Code>whenFar</Code>'s 50px, so pressing a cell swapped it with a
              neighbour and lit up "broken rule" before any movement. You
              diagnosed it exactly.
            </p>
            <Ev t="tableaux" l={151}>
              when I put my pointer down on one of these boxes, it immediately
              causes a neighboring box to slip in and it says broken rule and
              this kind of conflicts with a basic assumption of drag-drop
              interactions, which is that something should only happen once you
              start moving. I imagine this is because you've left off the
              original position as a possible target.
            </Ev>
            <Repro
              title="closest without the start state"
              src={closestWithoutStaySrc}
            >
              <ClosestWithoutStay />
            </Repro>
            <p>
              Now in <File>src/demos/tableaux.tsx</File> as{" "}
              <Code>d.closest([state, ...swaps])</Code>. Note{" "}
              <Code>whenFar(state)</Code> did <i>not</i> save this; its gap was
              wider than the cell pitch.
            </p>
            <Fix>
              A dev-mode warning from <Code>closest</Code> when, on frame 0 with
              zero pointer displacement, the winning candidate's preview differs
              from the start state. And the docs' <Code>allOrders</Code> example
              should say why the current order is in the list.
            </Fix>
          </Problem>

          <Problem
            id="drop-state-coincidence"
            title="A target measured in the drop state can sit under the pointer at press"
            cats={["footgun", "fixed"]}
          >
            <p>
              ZX: dragging the top green spider onto the one below. In the fused
              state the levels collapse and the surviving spider moves up to
              exactly where the dragged one started, so the hit test saw gap 0
              at press and fusion ran on mouse-down. The proof demo hit the same
              thing from the other side: a <Code>d.dropTarget</Code> whose
              target is rewritten or removed by the drop can't be measured in
              the drop state at all, so that agent added{" "}
              <Code>boundsState</Code> to <Code>dropTarget</Code> (
              <File>src/ops/dropTarget.tsx</File>) before writing any demo code.
            </p>
            <Ev t="zx" l={261}>
              the drag of the top green spider down onto the plain green spider
              beneath it doesn't work, or rather it runs on mouse down, cuz in
              the target state the lower green spider moves up to where the
              plain green spider is originally. you might have similar issues
              elswhere? plz think these through a bit
            </Ev>
            <Ev t="proof" l={101} who="agent">
              <Code>d.dropTarget</Code> now takes an optional{" "}
              <Code>boundsState</Code>. Before, target bounds always came from
              rendering the drop state, which fails when the drop rewrites or
              removes the target.
            </Ev>
            <Repro
              title="dropTarget measured in the drop state"
              src={dropTargetCoincidenceSrc}
            >
              <DropTargetCoincidence />
            </Repro>
            <Fix>
              Default <Code>dropTarget</Code>'s bounds to the <i>start</i> state
              (what the user is aiming at), with the drop state as the opt-in.
              The ZX agent's audit also suggests a general guard: ignore
              gap-based branch switches until the pointer has moved a few pixels
              from the press. <Ref t="zx" l={276} />
            </Fix>
          </Problem>

          <Problem
            id="spooky"
            title="closest between far-apart zones flips at the Voronoi midpoint"
            cats={["footgun", "docs"]}
          >
            <p>
              Pivot table: Fields and Values pools are ~400px apart; the table
              sprouted a column as soon as the chip crossed the midpoint. Fixed
              with{" "}
              <Code>
                whenFar(state, {"{"} gapIn: 40, gapOut: 56 {"}"})
              </Code>
              , options that already existed.
            </p>
            <Ev t="pivot" l={113}>
              when I drag "units", it's sorta strange that it jumps to the
              "values" pool when I reach the half-way point. that feels kinda
              spooky-action-at-a-distance, know what I mean?
            </Ev>
            <Repro title="Voronoi closest across zones" src={spookyClosestSrc}>
              <SpookyClosest />
            </Repro>
            <Fix>
              Docs: "when candidates are in distinct zones, add{" "}
              <Code>.whenFar(state)</Code>" as the rule, not the exotic case.
              The <Code>allOrders</Code> idiom is fine for dense evenly-spaced
              slots and misleading otherwise.
            </Fix>
          </Problem>

          <Problem
            id="whenfar-starts-fg"
            title="whenFar starts in the foreground, and dropTarget fires on pass-through"
            cats={["footgun"]}
          >
            <p>
              Two smaller members of the family. <Code>whenFar</Code>'s memory
              initialises to "near", so frame 1 uses the larger{" "}
              <Code>gapOut</Code> and a branch just outside <Code>gapIn</Code>{" "}
              is engaged the instant the drag starts (
              <File>src/ops/whenFar.tsx</File>, <Code>inForeground = true</Code>
              ). And a <Code>dropTarget</Code> engages the moment the pointer
              enters the target, so sliding a Gantt bar along its lane past
              another bar briefly previews adding a dependency.
            </p>
            <Ev t="knot" l={1013} who="agent">
              <Code>whenFar</Code> starts in the foreground. On the first frame
              it uses <Code>gapOut</Code>
            </Ev>
            <Ev t="gantt" l={86} who="agent">
              Sliding a bar past another bar in the same lane momentarily
              previews a link, since the pointer enters that bar. It is
              consistent but might feel eager
            </Ev>
            <Fix>
              Decide frame 1 with <Code>gapIn</Code>. For{" "}
              <Code>dropTarget</Code>, a dwell or <Code>stickiness</Code> on the{" "}
              <Code>whenFar</Code> background would hold the free drag while the
              pointer is merely passing through.
            </Fix>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="zones">2. Tuning engagement and snapping</H2>

          <Problem
            id="within"
            title="Engagement thresholds can't be set per closest branch"
            cats={["API gap", "open"]}
          >
            <p>
              Knot: one{" "}
              <Code>
                closest([...moves, ...twists]).whenFar(bend, {"{"} gapIn: 12,
                gapOut: 28 {"}"})
              </Code>
              . The thresholds were tuned for sliding moves; the 6px twist rings
              inherited them and got a sticky zone reaching almost back to the
              strand. The only workaround is nesting <Code>whenFar</Code>s,
              which also silently gives the outer group priority. This is the
              one place you asked outright for API feedback and the agent ranked
              it #1 of nine.
            </p>
            <Ev t="knot" l={988}>
              why do twist targets have such large gapOuts? it's soooooo
              bigggggg. why not just use default gap?
            </Ev>
            <Ev t="knot" l={1006}>
              hmmmmm do you have any feedback on dragology's api here?
            </Ev>
            <Ev t="knot" l={1075}>
              I might want to call this '.within'. Then x.whenFar(y) would
              become x.within().otherwise(y)
            </Ev>
            <Ev t="knot" l={1093}>
              typically you don't need all this control. in fact I rather like
              having a default with no numbers.
            </Ev>
            <p>
              Filed as <Task id="c94384">.within() and .otherwise()</Task>. Not
              implemented; the oversized zones are still in{" "}
              <File>src/demos/knot/index.tsx</File>.
            </p>
          </Problem>

          <Problem
            id="snap-px"
            title="Snap radii are absolute pixels, so they're wrong whenever targets are close"
            cats={["footgun"]}
          >
            <p>
              Permutation lab copied{" "}
              <Code>
                withSnapRadius(10, {"{"} chain: true {"}"})
              </Code>{" "}
              everywhere; with rows 24px apart the interpolated part of a drag
              covered half the travel and then jumped. You asked whether other
              drags had the same problem; two more did. All went to 3px. Aztec
              diamond's 8px snap on a half-cell flip was "twitchy" and
              effectively one-shot (the only chained option afterwards was
              flipping back).
            </p>
            <Ev t="perm" l={251}>
              too snappy for the closeness of the points
            </Ev>
            <Ev t="perm" l={297}>
              Are there any other drags that are inappropriately snappy in the
              same way as the previous one I mentioned?
            </Ev>
            <Ev t="tilings" l={118} who="agent">
              after one flip the only chained option is usually flipping back,
              so in practice it rarely chains anywhere new.
            </Ev>
            <Fix>
              A snap radius relative to the distance to the nearest other
              target, or a default for <Code>chain: true</Code> that doesn't
              need a number.
            </Fix>
          </Problem>

          <Problem
            id="whenfar-vary"
            title="whenFar on a constrained vary fires for any direction the vary can't follow"
            cats={["footgun", "docs"]}
          >
            <p>
              ZX Hopf rule: <Code>whenFar(result)</Code> on a bead's constrained{" "}
              <Code>vary</Code>, meant as "pulled through the twin wire".{" "}
              <Code>whenFar</Code> only knows the pointer is far from wherever
              the foreground can put the element, so pulling the bead{" "}
              <i>away</i>, or off the end of the wire, also cancelled the pair.
              The snake yank had the identical flaw. Both were replaced with{" "}
              <Code>d.custom</Code> branches that test direction.
            </p>
            <Ev t="zx" l={224}>
              seems like I can grab either of the little circles and pull them
              in any direction far enough, and the two of them disappear.
              strange.
            </Ev>
            <Ev t="zx" l={235} who="agent">
              The Hopf branch was <Code>whenFar</Code> on the bead's constrained
              drag, which fires whenever the drag can't follow the pointer, for{" "}
              <i>any</i> reason
            </Ev>
            <Repro
              title="whenFar on a constrained vary"
              src={whenFarConstrainedVarySrc}
            >
              <WhenFarConstrainedVary />
            </Repro>
            <Fix>
              Say it loudly in the docs. Possibly a sibling of{" "}
              <Code>whenFar</Code> that takes a predicate on the pointer or
              preview (<Code>whenPast(line)</Code>), or let <Code>vary</Code>{" "}
              report which constraint is binding.
            </Fix>
          </Problem>

          <Problem
            id="teleport"
            title="A gap can't gate a drop whose result teleports the dragged element"
            cats={["footgun", "docs"]}
          >
            <p>
              Rotations: inserting a key into an AVL tree was{" "}
              <Code>
                d.fixed(inserted).withFloating().whenFar(…, {"{"} gap: 70 {"}"})
              </Code>
              . After rebalancing the key's rendered position can be far from
              where it was dropped, so the gap test failed and drops "didn't
              register". Switched to an invisible full-tree rect as a region{" "}
              <Code>dropTarget</Code>, a pattern then reused by heap, 2-3 tree,
              plane-partition and Gantt.
            </p>
            <Ev t="rotations" l={137} who="agent">
              Insertion panels use an invisible drop-region rect over the tree
              rather than a distance gap, since rebalancing can land the key
              anywhere.
            </Ev>
            <Fix>
              Docs: "if the drop result moves the dragged element unpredictably,
              gate with a region, not a gap".
            </Fix>
          </Problem>

          <Problem
            id="change-result-frame"
            title="Shaping a branch's gap needs a closure hack across changeFrame/changeResult"
            cats={["API gap"]}
          >
            <p>
              Knot wanted "overshoot keeps the move" and "a push engages only
              20px before the strand it crosses". <Code>between</Code>'s gap is
              distance to the hull of its targets; <Code>changeResult</Code>{" "}
              doesn't get the frame, so the agent captured the pointer in a
              closure inside <Code>changeFrame</Code> and read it in{" "}
              <Code>changeResult</Code>. Its first version made the zone
              unbounded, which you saw as a red beam across the whole canvas in
              the drop-zone view.
            </p>
            <Ev t="knot" l={899}>
              bug: with drop zones viz on, I took the unknot, grabbed the bottom
              ... what the hecks is going on here
            </Ev>
            <Ev t="knot" l={1011} who="agent">
              Controlling a branch's gap requires a hack ...{" "}
              <Code>changeResult</Code> doesn't receive the pointer, so I
              captured it in a closure inside <Code>changeFrame</Code>. That
              works only because of the order the wrappers happen to run in
            </Ev>
            <p>
              Still in <File>src/demos/knot/index.tsx</File> (
              <Code>moveSpec</Code>).
            </p>
            <Fix>
              Pass the frame to <Code>changeResult</Code>/<Code>changeGap</Code>
              ; or an "overshoot keeps the move" option on <Code>between</Code>.
            </Fix>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="spokes">3. Walking a graph: hub and spokes</H2>
          <p className="text-sm text-gray-700">
            Tamari lattice, permutohedron, sokoban, tree rotations, heap sift,
            jeu de taquin: a token at a node with several edges out. The library
            has the pieces but the right assembly took the longest to find of
            anything in the batch.
          </p>

          <Problem
            id="hub-spokes"
            title="A multi-state between is the wrong tool for spokes, and it took four iterations to find the right one"
            cats={["footgun", "docs", "fixed"]}
          >
            <p>
              Catalan's Tamari token went (1){" "}
              <Code>closest([state, ...neighbors]).withFloating()</Code> → you:
              use between; (2){" "}
              <Code>between([state, ...neighbors]).withChaining()</Code> →
              "super weird"; (3){" "}
              <Code>
                closest(edges.map(e =&gt; between([a, b]))).withSnapRadius(1,{" "}
                {"{"} chain: true {"}"})
              </Code>{" "}
              after you corrected the agent's plan to drop chaining; (4){" "}
              <Code>lockPast: 20</Code> a week later. Two chaining APIs exist (
              <Code>withChaining</Code>,{" "}
              <Code>
                withSnapRadius(…, {"{"}chain{"}"})
              </Code>
              ) and the agent reached for the wrong one.
            </p>
            <Ev t="catalan" l={237}>
              Dragging around the Tamari lattice is acting super weird.
              Partially 'cause you've got betweens with more than two arguments,
              which means that you can drag inside of a triangular region, but
              also it's doing some kind of chaining, so these triangular regions
              change unpredictably when you cross various thresholds
            </Ev>
            <Ev t="catalan" l={243}>
              If you move to the two point betweens I don't see a reason to not
              have chaining, although remember it's like chaining with snapping.
            </Ev>
            <Ev t="lockPast" l={12}>
              [voice memo: you drag out on one path and then you can snap onto a
              different path … what kind of combinators does this really want]
            </Ev>
            <Repro title="hub and spokes, three ways" src={hubSpokesSrc}>
              <HubSpokes />
            </Repro>
            <p>
              <Code>lockPast</Code> itself went through two designs:
              element-based (lock when the preview carries the token past r;
              unlock when it's back) and pointer-based (pointer must return to
              the press point). You preferred pointer-based because under
              element-based "the dot can spring from one spoke to another spoke
              with the pointer far away", found that fast swipes through a node
              skip it because the pointer is sampled per frame, rejected the
              segment-test fix as "too strict", and settled on element-based.{" "}
              <Ref t="lockPast" l={139} /> <Ref t="lockPast" l={153} />{" "}
              <Ref t="lockPast" l={164} />. The radius still needs tuning per
              demo (permutohedron edges are ~20px so <Code>lockPast: 20</Code>{" "}
              "would never lock", <Ref t="lockPast" l={315} />
              ).
            </p>
            <Fix>
              Sugar:{" "}
              <Code>
                d.spokes(targets, {"{"} lockPast? {"}"})
              </Code>{" "}
              (the agent's proposal, <Ref t="lockPast" l={51} />
              ), or a docs section "walking a graph" with the assembled pattern.
              One chaining API, not two.
            </Fix>
          </Problem>

          <Problem
            id="chain-edges"
            title="Chaining's edges: off-axis stalls, order-sensitivity with onDrop, and nothing left to hold"
            cats={["footgun", "API gap"]}
          >
            <ul>
              <li>
                Heap sift-up: parents are diagonal, so a straight-up drag stops
                after one chained swap.{" "}
                <Ev t="rotations" l={138} who="agent">
                  Heap sift moves are diagonal, so dragging straight up can stop
                  after one swap.
                </Ev>
              </li>
              <li>
                Lambda: putting <Code>.onDrop</Code> inside{" "}
                <Code>
                  withSnapRadius(…, {"{"}chain{"}"})
                </Code>{" "}
                made the snap compare against a position the drag never reaches;
                chaining silently stopped, and was then disabled.{" "}
                <Ev t="lambda" l={193} who="agent">
                  I had <Code>onDrop</Code> inside the snap radius, so the snap
                  check compared against the reduced term's position, which the
                  drag never reaches, and chaining silently stopped working.
                </Ev>
              </li>
              <li>
                Tableaux: an <Code>onDrop</Code> that removes the dragged
                element (the hole sliding off a corner) breaks chaining, because{" "}
                <Code>resolveChainNows</Code> looks for the dragged id in the
                post-<Code>onDrop</Code> state and asserts. The agent fell back
                to click-to-close and flagged it as a library limitation.{" "}
                <Ev t="tableaux" l={106} who="agent">
                  the renderer resolves chaining from the outer drop state, so
                  the chain then fails to find the hole element. Click-to-close
                  is the workaround.
                </Ev>
              </li>
              <li>
                Proof (your own later commit <Code>5788faa</Code>): when a link
                solves the sequent nothing remains to hold, so the drag chains
                onto <Code>"undo-button"</Code> with a <Code>d.fixed</Code>{" "}
                follow spec, "since a drag needs some element".
              </li>
            </ul>
            <Fix>
              Chain from the pre-<Code>onDrop</Code> preview, or let a chain
              step end the drag with a committed state when{" "}
              <Code>draggedId</Code> is absent.
            </Fix>
          </Problem>

          <Problem
            id="same-spot"
            title="closest can't tell apart targets that put the dragged element in the same place"
            cats={["footgun"]}
          >
            <p>
              Catalan tree nodes: both "rotate down" moves place the dragged
              node at the same x, so <Code>closest</Code> picked one
              arbitrarily; you caught it ("isn't dragging down ambiguous?") and
              the agent reverted to up-only, then wrote throwaway exhaustive
              checks to prove no two hump moves coincide. Same root cause behind
              the diagonal-flip direction being "unpredictable" before{" "}
              <Code>draggableLine</Code>, and behind hanoi #1's equidistant pegs
              in the fuzzer.
            </p>
            <Ev t="catalan2" l={134}>
              isn't dragging down ambiguous?
            </Ev>
            <Ev t="catalan" l={135}>
              there are actually two different motions that it could make …
              currently you just have some internal logic that picks a single
              end of the other diagonal which creates very unpredictable direct
              behavior
            </Ev>
            <Fix>
              Now that results carry <Code>grabPos</Code>, a dev-time warning
              when two <Code>closest</Code> branches coincide at drag start is
              cheap. The fuzzer version is filed as{" "}
              <Task id="e66278">check each drop state is reachable</Task>.
            </Fix>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="grab">4. Where is the grabbed point?</H2>

          <Problem
            id="draggable-line"
            title="Grab tracking is transform-only, so a point on a line whose ends move can't be followed"
            cats={["API gap", "fixed"]}
          >
            <p>
              Catalan diagonals flip by moving both endpoints. The library maps
              the grab point through the element's transform alone, so{" "}
              <Code>between</Code> targets landed "new endpoint + old grab
              offset", outside the quadrilateral; you saw it in the overlay. The
              agent's workaround was ten invisible grab segments per diagonal,
              and when you asked "lmk if there's something wrong with dragology"
              it said the library "can't directly express 'track this point
              along a line whose endpoints move'". The follow-up session built a{" "}
              <Code>dragologyAnchorFrame</Code> prop, then discovered{" "}
              <Code>translate + rotate + scale</Code> on a unit line already did
              it; you rejected the prop as "unnecessary complexity" and asked
              for a helper: <Code>draggableLine</Code>.
            </p>
            <Ev t="catalan" l={283}>
              I'm confused by drop targets I see in overlay on triangulation
              view. they are typically outside of the quadrilateral that's being
              flipped. that seems very strange
            </Ev>
            <Ev t="catalan" l={331} who="agent">
              Nothing is wrong with Dragology. … Dragology can't directly
              express "track this point along a line whose endpoints move."
            </Ev>
            <Ev t="grab" l={192} who="agent">
              I made a mistake: it wasn't impossible. … That premise only holds
              for <Code>translate</Code>.
            </Ev>
            <Ev t="grab" l={216}>
              yeah I think this is unnecessary complexity in the library. […
              dragging lines is] admittedly annoying, cuz you don't really WANT
              to draw them with transforms
            </Ev>
            <p>
              Landed as <Code>draggableLine</Code> (
              <File>src/svgx/helpers.ts</File>, docs) with a two-line pattern
              under <Code>between</Code>: invisible <Code>draggableLine</Code>{" "}
              grab line + visible <Code>x1…y2</Code> line, because a
              transform-positioned line swings on an arc mid-drag (its angle and
              length blend separately). The survey found <Demo id="dragon" /> as
              the other clear victim and ~10 demos already working around it
              with sampled handles. <Ref t="grab" l={105} /> Not covered: shapes
              that aren't lines (animate-algebra nodes whose size changes in a
              rewrite; git-graph text that shifts with lane).
            </p>
            <p>
              Related footgun: an element with <Code>dragologyOnDrag</Code> but
              no positioning transform throws{" "}
              <Code>Coincident targets detected in d.between</Code> on every
              drag, since its tracked position is identical in all states. The
              first Catalan build hit this on every element; the error doesn't
              say "does this have a <Code>translate</Code>?".{" "}
              <Ref t="catalan" l={315} />
            </p>
          </Problem>

          <Problem
            id="grab-local-frame"
            title="The grab offset lives in the dragged element's local frame, so rotation on the dragged element swings its targets"
            cats={["footgun", "docs"]}
          >
            <p>
              Aztec diamond: dominoes drawn as{" "}
              <Code>translate(center) + rotateDeg(angle)</Code> on the id'd
              element. In each rotated target the grab offset rotated with the
              domino around the block's pivot, so "when I start a drag at x,y,
              there's a target at y,x". The agent's headless check grabbed dead
              center and missed it. The final version then deliberately relies
              on this behaviour for the knob. Neither rule is in the docs.
            </p>
            <Ev t="tilings" l={150}>
              "every 2×2 block offers two targets, a quarter turn each way" this
              is not what I"m seeing! I'm seeing that when I start a drag at
              x,y, there's a target at y,x (basically)
            </Ev>
            <Ev t="tilings" l={172} who="agent">
              Dragology stores the grab point in the dragged element's local
              coordinate frame. My id'd domino element carried the rotation, so
              in each flipped state the grab point was rotated with the domino
            </Ev>
            <Repro
              title="grab offset under rotation (turn on Overlay)"
              src={grabPointRotationSrc}
            >
              <GrabPointRotation />
            </Repro>
            <p>
              A cousin: <Code>switchToStateAndFollow</Code> keeps the grab
              offset measured on the element you pressed, so an element created
              by dragging out of a palette appears offset from the pointer until
              you add{" "}
              <Code>
                .withInitContext({"{"} anchorPos: Vec2(0) {"}"})
              </Code>
              , which stock-and-flow needed three times.{" "}
              <Ref t="stock" l={215} />
            </p>
            <Fix>
              Document the local-frame rule next to the <Code>translate</Code>{" "}
              guidance, with both patterns. Default{" "}
              <Code>switchToStateAndFollow</Code> to anchoring the new element's
              origin.
            </Fix>
          </Problem>

          <Problem
            id="aimed-vs-rendered"
            title="Transforms blend component-wise, so points on rotating things move on arcs"
            cats={["interpolation"]}
          >
            <p>
              Same root cause, three sightings: the Catalan diagonal drawn as a
              rigid rotating line swept on an arc while the adjacent triangles'
              corners moved straight, so fills "peeled off the line" (zigzag); a
              visible <Code>draggableLine</Code> under <Code>between</Code>{" "}
              would bow away from the pointer; and <Code>between</Code>'s aimed
              position (projection) vs the rendered dot differ by up to R·(1−cos
              Δθ/2) for rotating betweens, which the agent first called "a pixel
              or so" and corrected after you pushed.
            </p>
            <Ev t="catalan" l={174}>
              I'd really like when you rotate a diagonal for the two triangles
              next to it to sort of stay attached to it in the transition rather
              than move in this weird zigzaggy way
            </Ev>
            <Ev t="grab" l={294}>
              huh does that mean there's a slight inaccuracy mid-drag? like this
              computes "progress" along a drag a bit differently than if it
              actually interpolated via the drawn line?
            </Ev>
            <Ev t="lockPast" l={203}>
              a pixel or so?
            </Ev>
            <Fix>
              An option to blend a designated point of a transform linearly
              ("move this point straight, blend orientation around it") would
              remove the two-line pattern. Speculative.
            </Fix>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="structure">5. Interpolating structure</H2>

          <Problem
            id="index-pairing"
            title="Non-id siblings pair by index: a conditionally rendered sibling crashes the lerp"
            cats={["footgun", "bug", "docs"]}
          >
            <p>
              <Code>
                Cannot lerp between different element types: g and text
              </Code>{" "}
              (proof, the one error you hit by hand);{" "}
              <Code>rect and circle</Code>, <Code>circle and path</Code>,{" "}
              <Code>g and text</Code> (permutation lab, three times);
              stock-and-flow (conditional rects, fixed via fuzz); permutohedron
              solid (a conditional label). Every one was{" "}
              <Code>{"{cond && <el/>}"}</Code> among id-less siblings. The docs'
              gotcha 9 covers variable-length lists but not this shape. Also in
              the same family: <Code>textAnchor</Code> that depends on state
              throws, so stock-and-flow centres labels by{" "}
              <i>guessing text width</i>; <Code>fontSize="75%"</Code> next to{" "}
              <Code>fontSize={"{9}"}</Code> throws; a toggled{" "}
              <Code>className</Code> can't be lerped (ZX, replaced with numeric
              opacity).
            </p>
            <Ev t="proof" l={114}>
              in distributivity, when i click the and, I get [screenshot of the
              error]
            </Ev>
            <Ev t="proof" l={179} who="agent">
              non-id children were shifting index between states, so the
              interpolator matched a <Code>&lt;g&gt;</Code> against a{" "}
              <Code>&lt;text&gt;</Code> at the same path. Specifically the paren
              text, the op pill's conditional rect, and the row's commas and
              turnstile.
            </Ev>
            <Ev t="stock" l={214} who="agent">
              <Code>textAnchor</Code> and string font sizes can't be
              interpolated.
            </Ev>
            <Repro title="conditional sibling" src={conditionalSiblingSrc}>
              <ConditionalSibling />
            </Repro>
            <Fix>
              Pair unkeyed siblings by element type before falling back to
              index, or fade in/out rather than throw. Snap enum-ish string
              props (<Code>textAnchor</Code>, <Code>dominantBaseline</Code>) to
              a side instead of throwing (<Code>unblendedFrom</Code> now exists
              for component props and text; extend it). Make the error name the
              ids on the path, which the permutation agent needed a custom
              vitest script to find (<Ref t="perm" l={84} />
              ). And a gotcha 9b in the docs with the <Code>opacity</Code>{" "}
              idiom.
            </Fix>
          </Problem>

          <Problem
            id="only-one-state"
            title="An element present in only one state fades in place, detached from the things it should follow"
            cats={["interpolation", "API gap"]}
          >
            <p>
              Rotations: edges keyed by child "dangle" through empty space as
              parents change; re-keying by (parent, child) made them cross-fade
              at a fixed position instead. Knot: new R2 crossings fade in at
              their final spots before the strand arrives. Both demos invented
              the same fix: draw a stand-in in the state where the thing doesn't
              exist (invisible "ghost edges" carried in every{" "}
              <Code>between</Code> target; zero-size <Code>ghostOf</Code>{" "}
              bridges sharing the crossing's id), so there's always something to
              interpolate from. Lambda went the other way and annotated the{" "}
              <i>start</i> state with <Code>emergeFrom</Code> pointers to make
              disappearing copies converge into the dragged node.
            </p>
            <Ev t="rotations" l={152}>
              yeah actually three edges dangle. the edge motion bums me out rn
            </Ev>
            <Ev t="knot" l={1253}>
              there's an awkward fade-in of approaching crossings ... any ideas
              how to improve this?
            </Ev>
            <Ev t="lambda" l={101} who="agent">
              I got that merge by annotating the starting state of the{" "}
              <Code>between</Code> with emerge pointers, which renders
              identically but makes the lerp converge them.
            </Ev>
            <Repro
              title="edge that exists in only one state"
              src={edgeOnlyInOneStateSrc}
            >
              <EdgeOnlyInOneState />
            </Repro>
            <p>
              Related: <Code>dragologyEmergeFrom</Code> is a permanent attribute
              (proof worried a later disappearance would shrink toward a stale
              origin, <Ref t="proof" l={109} />
              ), and its anchor must be fixed per slot or transforms differ in
              length between states (permutation, <Ref t="perm" l={453} />
              ). Neither it nor <Code>dragologyEmergeMode</Code> is documented.
            </p>
            <Fix>
              A connector primitive whose endpoints follow referenced layers (
              <Code>{'<line dragologyFrom="a" dragologyTo="b">'}</Code>) so an
              unmatched edge fades <i>on the moving nodes</i>; failing that,
              document the ghost idiom.
            </Fix>
          </Problem>

          <Problem
            id="rigid"
            title="between blends each element's own transform, so a rigid group doesn't rotate rigidly"
            cats={["footgun", "docs"]}
          >
            <p>
              Aztec diamond's first design:{" "}
              <Code>closest(flips.map(f =&gt; between([state, f])))</Code> over
              two independently translated dominoes, expecting the pair to
              rotate. Each centre slid straight, the two squares passed through
              each other, and the partner vanished under the dragged one. The
              agent had only verified post-drop transforms. Fixed by abandoning{" "}
              <Code>between</Code> for a <Code>varyFunc</Code> on a spin angle
              with the pair under one rotating parent, which also made full
              rotations trivial.
            </p>
            <Ev t="tilings" l={177}>
              I cannot emphasize enough how much this doesn't work. are you
              testing?
            </Ev>
            <Ev t="tilings" l={44} who="agent">
              Transforms lerp component-wise, so rotating dominoes will
              interpolate cleanly.
            </Ev>
            <Repro title="rigid pair" src={rigidPairSrc}>
              <RigidPair />
            </Repro>
          </Problem>

          <Problem
            id="path-d"
            title="A path whose command count changes smears entirely"
            cats={["interpolation", "API gap"]}
          >
            <p>
              Permutation lab, twice: wires as one <Code>&lt;path&gt;</Code>{" "}
              gained commands when a crossing was appended, so d3's path
              interpolation re-sampled the whole wire; the permutohedron walk (a
              polyline gaining a vertex) did the same. You said explicitly that
              the library could grow a feature; the agent proposed a
              shared-prefix path lerp and instead worked around it with
              fixed-structure paths (wires padded to 13 columns, walk as one
              id'd line per step).
            </p>
            <Ev t="perm" l={260}>
              Path interpolation in Permutahedron, when I drag the token, is
              really bad and not what we're looking for at all. Keep in mind we
              can add new features to Dragology if this is harder than it should
              be.
            </Ev>
            <Ev t="perm" l={272} who="agent">
              this is now the second time the 'path gains a command' smear has
              come up in this demo. A library-side option worth considering is
              an interpolation mode for paths that keeps shared prefix commands
              fixed and only morphs the appended tail
            </Ev>
            <Repro title="path gaining a segment" src={pathCommandCountSrc}>
              <PathCommandCount />
            </Repro>
            <Fix>
              A path lerp mode aligning commands by shared prefix; or document
              the fixed-structure idiom.
            </Fix>
          </Problem>

          <Problem
            id="slot-order"
            title="Lines and polygons blend by coordinate slot, so endpoints must be hand-ordered and sub-part correspondence hand-chosen"
            cats={["interpolation", "footgun"]}
          >
            <p>
              Catalan: tree edges drawn parent→child swapped ends during a
              rotation (roles trade), fixed with a per-edge{" "}
              <Code>edgeReversed</Code> flag toggled on each rotation; triangles
              zigzagged until each node recorded its "active" side so{" "}
              <Code>points</Code> were listed active-edge-first. Permutation
              lab: no single wire layout serves both commutation and braid
              moves, so the state carries a per-drag layout hint{" "}
              <Code>wiresByColumn: true</Code> set on both ends of the{" "}
              <Code>between</Code>.
            </p>
            <Ev t="catalan" l={160} who="agent">
              The tree-edge lines had the same endpoint-swap problem across a
              rotation, since parent and child trade roles. Each edge now
              carries a flag toggled on every rotation that decides which end is
              drawn first
            </Ev>
            <Ev t="permSquashed" l={167}>
              ok you did actually make "braid drags" worse, I think
            </Ev>
            <Fix>
              Vertices attached to named points (ids) instead of slots; or a
              per-drag "render variant" so layout hints don't live in persistent
              state.
            </Fix>
          </Problem>

          <Problem
            id="side-a"
            title="What can't be blended comes from one side, and which side wasn't principled"
            cats={["interpolation", "fixed"]}
          >
            <p>
              Text content picks side A, so lambda's readout showed the old term
              mid-drag. Multi-state <Code>between</Code> folded pairwise in list
              order, so unblendables came from the first-listed state: a mark
              dragged right next to C still read "A". The integrate session
              threaded an explicit <Code>unblendedFrom</Code> through the lerp
              (springs pass the target; weighted betweens pick the heaviest
              state) after you rejected reordering the fold as "a bad confusing
              delicate hack", and added the <Demo id="lerping-text" /> demo. The
              same session found that unlisted component props from the "nearer"
              side reset a controlled input's cursor mid-spring.
            </p>
            <Ev t="integrate" l={1288}>
              that sounds like a bad confusing delicate hack. I thought the
              reconciliation would be just to pass an option
            </Ev>
            <Ev t="integrate" l={1125}>
              woooooah bad news bud: typing midway through one of their
              textboxes resets cursor to the end
            </Ev>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="exists">6. The dragged element must exist in every target</H2>

          <Problem
            id="vanish"
            title="Deleting, discarding, copying: the dragged id has to be somewhere in every candidate"
            cats={["API gap", "footgun"]}
          >
            <p>
              Lambda: a β-step whose parameter is unused makes the argument
              vanish, so K and the Church booleans couldn't be offered until a
              non-term "waypoint" state was invented for the argument to sit on.
              Regex: dragging a node to the trash needed <Code>voided</Code>/
              <Code>voidedStar</Code> state fields whose only job is to render
              an invisible copy of the dragged node inside the trash so the
              candidate has a position. Copies (regex palette, git cherry-pick)
              need an id swap so the dragged element <i>is</i> the new thing;
              ghosts need fresh ids; and since one drop position means one
              thing, cherry-pick went on Alt. Each agent derived these alone.
            </p>
            <Ev t="lambda" l={108} who="agent">
              A redex whose parameter is unused is not offered, because the
              dragged argument would vanish and <Code>d.between</Code> needs it
              to survive.
            </Ev>
            <Ev t="git" l={95} who="agent">
              using an id swap so the dragged element is the pick and a fresh-id
              copy takes over the original's place
            </Ev>
            <Repro
              title="candidate without the dragged element"
              src={vanishingDraggedSrc}
            >
              <VanishingDragged />
            </Repro>
            <p>
              The repro shows the mechanics: a <Code>dropTarget</Code> doesn't
              care where the dragged element is, so deletion works either way
              (floating "from memory", with a{" "}
              <Code>// TODO: I feel like this shouldn't be necessary</Code> in{" "}
              <File>src/ops/withFloating.tsx</File>; or, without floating, the
              item stays home and fades out over the trash). What bit the demos
              is the ops that <i>measure</i> the dragged element:{" "}
              <Code>d.fixed</Code> reports <Code>gap: Infinity</Code> when it
              can't find it (<File>src/ops/fixed.tsx</File>), so a{" "}
              <Code>closest</Code> candidate in which the dragged thing is gone
              can never win, and <Code>between</Code> needs it in every target
              to blend toward. Hence regex's hidden copy inside the trash and
              lambda's waypoint states.
            </p>
            <Fix>
              Define the behaviour for a candidate lacking the dragged id
              (follow the pointer; fade at the drop) for the non-floating path
              too; a documented id-swap idiom for copies; a "delete zone"
              helper.
            </Fix>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="layers">7. Layers and pointer events</H2>

          <Problem
            id="id-steals"
            title="An id'd child is its own layer and silently steals the parent's pointer events"
            cats={["footgun", "bug"]}
          >
            <p>
              Catalan's Dyck humps were undraggable from the first commit
              through every headless check and fuzz run, because their two
              segments were wrapped in id'd groups; you found it by hand a week
              later. Stock-and-flow's stock body (id'd to be a drop target) took
              presses away from the stock; the fix was six transparent{" "}
              <Code>pointerEvents: "none"</Code> rects. Layout-editor's id'd
              axis handle ate the edge's grab. ZX's id'd goal-frame rect painted
              over the <Code>dragologyZIndex={"{-1}"}</Code> wires inside it.
            </p>
            <Ev t="catalan2" l={272}>
              are dyck paths supposed to be draggable?
            </Ev>
            <Ev t="catalan2" l={289} who="agent">
              An id'd element becomes its own layer and is pulled out of its
              parent in the DOM. So clicks on a segment never reach the hump{" "}
              <Code>&lt;g&gt;</Code> that holds <Code>dragologyOnDrag</Code>,
              and the hump itself has nothing left to click
            </Ev>
            <p>
              And the renderer only delays a drag for a click when the{" "}
              <i>dragged</i> element or its ancestors have a handler (
              <Code>ancestorOrSelfHasClickHandler</Code>), so stock-and-flow's
              double-click-to-rename on the name text never fired; worked around
              with <Code>data-rename</Code> attributes and a handler on the
              group. Filed as{" "}
              <Task id="04f7ac">
                clicks on descendants should hold off the drag
              </Task>
              .
            </p>
            <Ev t="stock" l={245} who="agent">
              My double-click handlers were on the text inside the stock, so the
              drag started on pointerdown and the click never fired.
            </Ev>
            <Repro title="layers vs pointer events" src={layersStealEventsSrc}>
              <LayersStealEvents />
            </Repro>
            <Fix>
              Forward a layer's pointer events to the nearest <i>logical</i>{" "}
              ancestor with <Code>dragologyOnDrag</Code>, or warn when an
              element with <Code>dragologyOnDrag</Code> has all its hit geometry
              inside id'd descendants. The fuzzer should hit-test through the
              layered DOM (it clearly doesn't; see §13).
            </Fix>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="vary">8. vary pitfalls</H2>

          <Problem
            id="clamp"
            title="A clamped element position has a flat region the optimizer can't climb out of"
            cats={["footgun", "bug", "open"]}
          >
            <p>
              Stock-and-flow slider knobs had their x clamped to the track.{" "}
              <Code>DistanceMinimizer.estimateScales</Code> probes sensitivity
              with a one-sided forward difference, so at the max the probe saw
              no movement, scaled the parameter as nearly inert, and the knob
              was stuck. You ruled: don't clamp. Filed as{" "}
              <Task id="b34d26">
                vary gets stuck where the position goes flat
              </Task>
              .
            </p>
            <Ev t="stock" l={291}>
              I dragged a slider (k_1) to the top of its range and now it won't
              slide anymore.
            </Ev>
            <Ev t="stock" l={323}>
              sure, but note in the task that it's better to not clamp stuff
              like you did
            </Ev>
            <Repro title="clamped slider" src={clampedSliderSrc}>
              <ClampedSlider />
            </Repro>
            <Fix>
              Central difference in the probe, and the "never clamp a dragged
              position" rule in the docs' vary section.
            </Fix>
          </Problem>

          <Problem
            id="vary-misc"
            title="Other vary traps: soft constraints, boolean validity, non-orthogonal params, Euler angles, param typing"
            cats={["footgun", "docs"]}
          >
            <ul>
              <li>
                Constraints are soft, so dropped values stray a hair outside
                range; stock-and-flow clamps params in <Code>tidy()</Code> on
                every transition.
              </li>
              <li>
                Knot validity ("no stray crossings") is a boolean and can't be a
                constraint, so it's clamped afterwards with <Code>.during</Code>
                , which sticks at the last valid state instead of sliding along
                the boundary.{" "}
                <Ev t="knot" l={1018} who="agent">
                  Validity can't be expressed as a constraint. 'No stray
                  crossings' is a yes-or-no check, and <Code>vary</Code>{" "}
                  constraints must be numeric.
                </Ev>
              </li>
              <li>
                ZX bead with two params (<Code>bow</Code>, <Code>beadT</Code>):
                a sideways pull was satisfied by sliding along a diagonal wire,
                so bow never grew and Hopf never fired; bow had to be redefined
                perpendicular to the chord. <Ref t="zx" l={200} />
              </li>
              <li>
                Permutohedron solid: yaw/pitch <Code>vary</Code> thrashed near
                the axis (you guessed gimbal lock) and dragging past the
                silhouette rotated the wrong way (the grabbed point had rolled
                to the back). Fixed with a quaternion, a 2-D spin, and a{" "}
                <Code>moreThan(faceFacing)</Code> constraint;{" "}
                <Demo id="scene-3d" /> still uses yaw/pitch.{" "}
                <Ev t="permSolid" l={158}>
                  permutohedron drag behaves erratically if the drag starts near
                  the axis of the starting square. is there some kinda gimbal
                  lock? idk
                </Ev>
              </li>
              <li>
                <Code>param</Code> typing: no inference inside a{" "}
                <Code>.map</Code> (knot, <Ref t="knot" l={1025} />
                ); tuple indices rejected (
                <Ref t="permSolid" l={168} />
                ); a 27-member tuple union explosion for deep paths into a
                recursive tree (layout-editor, <Code>numParam</Code> casting
                helper, <Ref t="layout" l={33} />
                ).
              </li>
            </ul>
            <Fix>
              Project onto constraints at drop. A <Code>validIf(pred)</Code>{" "}
              option. Document the trackball idiom and "make multi-params
              orthogonal in screen space". A{" "}
              <Code>param.unsafe(pathArray)</Code> escape hatch.
            </Fix>
          </Problem>

          <Problem
            id="vary-perf"
            title="vary re-renders the whole draggable 20–40× per frame"
            cats={["perf", "docs"]}
          >
            <p>
              Aztec at order 8 measured the optimizer redrawing the diagram
              18–36 times per frame and added a <Code>WeakMap</Code> cache of
              everything derived from the settled tiling. Stock-and-flow found
              the undocumented <Code>isTracking</Code> prop and returns only the
              dragged item while tracking (75 ms → 18 ms per frame headless);
              the parameter-sweep chart had to move <i>outside</i> the
              draggable. Layout-editor's whole-tree <Code>vary</Code> hit 30s
              script timeouts.
            </p>
            <Ev t="tilings" l={269} who="agent">
              the angle optimizer redraws the whole diagram 18 to 36 times per
              frame.
            </Ev>
            <Ev t="stock" l={209} who="agent">
              Using dragology's <Code>isTracking</Code> flag to skip simulation
              and render only the dragged item got it to about 18 ms.
            </Ev>
            <Fix>
              Document <Code>isTracking</Code>; longer term, let the optimizer
              track a layer by cached transform instead of re-rendering.
            </Fix>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="drop">9. Drops, staging, and two-stage gestures</H2>

          <Problem
            id="staged"
            title="A drop is one interpolation from preview to result; algorithms that happen in steps can't be shown"
            cats={["API gap"]}
          >
            <p>
              Lambda: the argument of a β-redex goes to zero, one or many
              places, so every design invented non-term waypoint states just to
              give the dragged element somewhere to be. You rejected the result
              and questioned the fit of drag-drop; the agent concluded the
              "consume, distribute, dissolve" story is "animation, not
              manipulation" and wished for drop transitions through intermediate
              states. Tableaux row insertion: a single-destination{" "}
              <Code>between</Code> felt pointless and the bumping cascade
              happened all at once where the prose describes steps 1-2-3; you
              told the agent to leave Dragology for that panel, and it's now a
              React stepper.
            </p>
            <Ev t="lambda" l={378}>
              hmmm idk if this demo makes any sense. I don't like how the drag
              to the binder looks. it's not meaningful to have a big term
              hovering in place over a variable like x. I don't like how the
              body changes as you drag, to replace variables. I thought that
              would happen post drop. I'm not sure how happy I am about using
              drag-drop for this at all.
            </Ev>
            <Ev t="lambda" l={396} who="agent">
              That's animation, not manipulation… the library could grow a
              feature for drop transitions that pass through intermediate
              states.
            </Ev>
            <Ev t="tableaux" l={173}>
              the dragging here seems kinda pointless -- there's only ever one
              destination for a drag? also, the process described in steps 1-2-3
              isn't actually shown as a step-by-step process; it happens all at
              once. I think maybe you need to move away from Dragology for this
              one.
            </Ev>
            <Fix>
              Staged drop transitions (
              <Code>withDropTransition([s1, s2, s3])</Code> or{" "}
              <Code>onDrop</Code> returning a sequence). Also worth writing down
              when a drag isn't the right tool: one destination, or binary flips
              (you asked whether tilings "really benefit from drag drop, or
              could this just be done with clicking",{" "}
              <Ref t="tilings" l={113} />
              ).
            </Fix>
          </Problem>

          <Problem
            id="two-stage"
            title="Two-stage gestures work only via rendering-identical placeholder states"
            cats={["API gap", "docs"]}
          >
            <p>
              Permutation lab's s·s cancel/insert: you wanted the drag to keep
              the horizontal space and the space to close after the drop. Cancel
              was <Code>.onDrop(compact)</Code>. Insert needed the gap to open
              at drag start <i>without</i> an animation; the agent first said it
              couldn't find a clean way, then started the drag from a state with
              two zero-width "closed" columns that draws identically to the
              current state. The same trick fixed the "smear, close and reopen"
              drop animation after a cancel. It works, but the state type grew{" "}
              <Code>closed</Code>/<Code>opening</Code> columns and{" "}
              <Code>wiresByColumn</Code> purely for layout.
            </p>
            <Ev t="perm" l={153}>
              See if dragology has the right API forces for this and if it
              doesn't we can talk about that.
            </Ev>
            <Ev t="perm" l={195} who="agent">
              Making it two-stage would need the gap to open at drag start
              without an animation, and I didn't find a clean way to express
              that.
            </Ev>
            <Ev t="perm" l={309}>
              the transition for adding a S squared by dragging a strand, it's a
              a terrible transition. Either all the stuff to the right should
              just slide nicely while we do the drag, or maybe the drag should
              create like a really tight little Reidemeister tube double cross
              and then there should be an animation afterwards
            </Ev>
            <Fix>
              A first-class "drag start state" (must render identically to the
              current state), or a notion of layout-only state stripped on drop.
              At least, document the idiom.
            </Fix>
          </Problem>

          <Problem
            id="during"
            title="during() recomputes from the base each frame, so mid-drag and at-rest behaviour disagree"
            cats={["footgun"]}
          >
            <p>
              Gantt: <Code>vary(start).during(propagate)</Code> pushed
              dependents forward each frame from the pre-drag state, so within a
              drag they followed in both directions, but on drop the pushed
              starts were committed and never came back. You found the implicit
              max(stored, inferred) model confusing; the agent removed stored
              starts entirely, derived them in the render function from a{" "}
              <Code>lag</Code>, and dropped <Code>during</Code>. The task brief
              itself had pointed at <Code>during</Code>.
            </p>
            <Ev t="gantt" l={91}>
              sometimes gives you absolute control over a task's start time… and
              sometimes infers start times… but without hystesis … that's
              just... more invisible and confusing than it needs to be.
            </Ev>
            <p>
              Also: knot's <Code>.onDrop(cleanup)</Code> re-fit curves so the
              drop jumped up to 198px from the last preview, fixed by
              normalising the <Code>between</Code> endpoints up front (
              <Code>conformed()</Code>). <Ref t="knot" l={1328} /> And lambda
              needed <Code>withDropTransition(450)</Code> because the default
              200ms was over before a multi-element collapse could be seen.{" "}
              <Ref t="lambda" l={364} />
            </p>
            <Fix>
              Docs: derive dependent values in the render function; an{" "}
              <Code>onDrop</Code> that changes geometry will jump.
            </Fix>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="surface">10. Drawing during a drag; the op API</H2>

          <Problem
            id="overlay"
            title="There was no way to draw during a drag (→ withOverlay)"
            cats={["API gap", "fixed"]}
          >
            <p>
              Knot: you wanted R1 twists to become small snap targets with "just
              a little mark at the drag target". The drawing is a pure function
              of state plus <Code>draggedId</Code>, and the targets exist only
              inside the spec. The agent built a user-space{" "}
              <Code>withMarks</Code> with <Code>changeResult</Code> plus
              internal <Code>layerSvg</Code>/<Code>layeredMerge</Code>, you
              judged it "pretty innocuous", and it became{" "}
              <Code>spec.withOverlay(svg)</Code>.
            </p>
            <Ev t="knot" l={855}>
              does dragology make this easy or hard to do? kinda feels tough,
              don't it? (drawing a special mark at a drag target?)
            </Ev>
            <Ev t="knot" l={860} who="agent">
              yes, dragology makes this awkward
            </Ev>
            <p>
              The same session also wanted the dot's position without rendering
              a preview (<Code>lockPast</Code> had to call{" "}
              <Code>preview()</Code>, forcing <Code>between</Code> blends even
              when <Code>whenFar</Code> showed its background); you asked "does
              'between' not return a point sans a preview?" and{" "}
              <Code>grabPos</Code> was added to results.{" "}
              <Ref t="lockPast" l={174} />
            </p>
            <Fix>
              Follow-ups the agent suggested: a function form{" "}
              <Code>withOverlay((result, frame) =&gt; svg)</Code>; styling the
              positions <Code>between</Code>/<Code>closest</Code> already
              compute per branch. <Ref t="knot" l={1118} />
            </Fix>
          </Problem>

          <Problem
            id="ops"
            title="User-space ops were second-class; the refactor fixed most of it"
            cats={["API gap", "fixed"]}
          >
            <p>
              Before the refactor, adding <Code>withOverlay</Code> touched six
              files, <Code>d.custom</Code> showed "not supported yet" in the
              tree view and drew no overlay,{" "}
              <Demo id="simple-triangle-custom" /> faked a{" "}
              <Code>tracedSpec</Code>, and <Demo id="with-pointer-delay" />
              's wrapper couldn't chain. Now: one class per op,{" "}
              <Code>modifier(class …)</Code> →
              <Code>.with(pointerDelay(ms))</Code>, user ops exported. Design
              decisions you drove: no call-site factories or{" "}
              <Code>(s) =&gt;</Code> lambdas, fresh instance per behaviour with
              memory as plain fields, getters for docs collocation, no generic
              debug-view fallbacks ("don't make up some generic behavior that
              doesn't match our desires"), <Code>name</Code> stays explicit
              (minification), op classes un-exported.
            </p>
            <Ev t="ops" l={188}>
              the thing I actually wanted to do was collocate all the parts of
              each op. like, we might have a file for between, and a file for
              withChaining, etc.
            </Ev>
            <Ev t="ops" l={1794}>
              man typescript puts me in the position of making the weirdest
              tradeoffs
            </Ev>
            <p>
              Left open: layered-SVG utilities (<Code>layeredMerge</Code> etc.)
              aren't exported, so a user op can't compose previews the way{" "}
              <Code>withOverlay</Code> does (<Ref t="ops2" l={778} />
              ); three exposure styles for <Code>d.*</Code> (plain function,
              getter, one-method interface for <Code>vary</Code>/
              <Code>substate</Code>/<Code>reactTo</Code>) (
              <Ref t="ops" l={1982} />
              ); ZX's <Code>d.custom</Code> hit tests still import{" "}
              <Code>dragSpecToBehavior</Code> and rebuild <Code>OpResult</Code>{" "}
              by hand (
              <Ref t="zx" l={199} />
              ), which suggests a <Code>d.when(predicate, state)</Code>{" "}
              primitive; peeking (side-effect-free frames, which the drop-zone
              view wants) wasn't pursued (<Ref t="ops" l={873} />
              ).
            </p>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="perf">11. Performance</H2>
          <Problem
            id="perf-list"
            title="Drag start renders every candidate; frames render every between"
            cats={["perf", "fixed"]}
          >
            <ul>
              <li>
                Knot: a <Code>closest</Code> of many <Code>between</Code>s
                lerped every candidate's full SVG every frame; the agent made{" "}
                <Code>between</Code> previews lazy (
                <File>src/ops/between.tsx</File>). Frames went from ~14ms; drag
                start was still 170–230ms from enumerating moves.{" "}
                <Ref t="knot" l={154} /> <Ref t="knot" l={1589} />
              </li>
              <li>
                Fuzzer measurements across demos: 10–30ms per simulated drag,
                attributed to <Code>between</Code>/<Code>closest</Code>{" "}
                rendering every candidate up front; behaviours can't be cached
                across drags because they carry memory.{" "}
                <Ref t="proof" l={565} />
              </li>
              <li>
                A React "Maximum update depth exceeded" dev warning on slow
                frames (&gt;~13ms), traced to <File>src/demo/ui.tsx</File>{" "}
                mirroring <Code>onDragStatus</Code> into state from an effect
                every frame. Seen in knot, aztec, and the renderer loop; never
                fixed. <Ref t="tilings" l={271} /> <Ref t="knot" l={1023} />
              </li>
            </ul>
            <Fix>
              Lazy <Code>closest</Code> candidates (render on first gap query);
              update the status mirror only when the active path changes.
            </Fix>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="docs">12. Docs gaps</H2>
          <Problem
            id="docs-list"
            title="What agents had to learn from source"
            cats={["docs"]}
          >
            <p>
              Used by nursery demos and absent from <File>docs/AGENTS.md</File>:{" "}
              <Code>d.fixed</Code> (one mention), <Code>d.dropTarget</Code> (+{" "}
              <Code>boundsState</Code>), <Code>d.varyFunc</Code>,{" "}
              <Code>d.switchToStateAndFollow</Code> (+{" "}
              <Code>withInitContext</Code>), <Code>d.reactTo</Code>,{" "}
              <Code>d.custom</Code>, <Code>closest</Code>'s{" "}
              <Code>stickiness</Code> and <Code>lockPast</Code>,{" "}
              <Code>
                withFloating({"{"} tether, ghost {"}"})
              </Code>
              ,{" "}
              <Code>
                withSnapRadius(px, {"{"} chain {"}"})
              </Code>{" "}
              vs <Code>withChaining</Code>, <Code>changeFrame</Code>/
              <Code>changeResult</Code>/<Code>changeGap</Code>,{" "}
              <Code>dragologyEmergeFrom</Code>/<Code>Mode</Code>,{" "}
              <Code>isTracking</Code>, <Code>Vec2</Code>'s full API and{" "}
              <File>src/math/xywh.ts</File> (knot re-implemented both until you
              asked "isn't the top of geometry.ts just vec2?",{" "}
              <Ref t="knot" l={584} />
              ).
            </p>
            <p>Idioms every agent re-derived, worth a "patterns" section:</p>
            <ul>
              <li>
                Include <Code>state</Code> in <Code>closest</Code>; zones →{" "}
                <Code>whenFar(state)</Code> (§1).
              </li>
              <li>
                1-D or constrained motion → <Code>between</Code>; free
                reordering → <Code>closest().withFloating()</Code> (
                <Ref t="permMatrix" l={1} />
                ).
              </li>
              <li>
                Graph walking: closest of two-point betweens + snap-chain +{" "}
                <Code>lockPast</Code> (§3).
              </li>
              <li>
                Conditional sibling → always render, toggle opacity, or give it
                an id (§5.1).
              </li>
              <li>
                Ghost edges / stand-ins with shared ids for things that exist in
                one state (§5.2).
              </li>
              <li>
                Rigid groups → shared parent transform (§5.3); fixed-structure
                paths (§5.4).
              </li>
              <li>
                Copies → id swap; deletions → hidden copy; one drop position =
                one meaning (§6).
              </li>
              <li>
                Never clamp a dragged position; trackball = quaternion + facing
                constraint (§8).
              </li>
              <li>
                Render every candidate state, including degenerate ones from{" "}
                <Code>stateWithout</Code> (lists-2d-sizes crashed on an empty
                row, <Ref t="lists2d" l={1} />
                ).
              </li>
              <li>
                App state (undo, presets) belongs outside the draggable; knot
                stored history in state until you asked (
                <Ref t="knot" l={1195} />
                ).
              </li>
              <li>
                Controls inside components:{" "}
                <Code>
                  setState(next, {"{"} transition: false {"}"})
                </Code>{" "}
                (now documented).
              </li>
            </ul>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="tooling">13. Tooling</H2>
          <Problem
            id="tooling-list"
            title="Where the harness let problems through"
            cats={["tooling"]}
          >
            <ul>
              <li>
                <b>The fuzzer doesn't hit-test.</b> Catalan's humps were
                undraggable through every run; the fuzzer finds{" "}
                <Code>dragologyOnDrag</Code> elements without pressing through
                the layered DOM. <Ref t="catalan2" l={285} />
              </li>
              <li>
                <b>Agents verified drops, not drags.</b> Aztec's collapsed pair
                shipped twice because only post-drop transforms were checked;
                the fix came from a frame-strip montage of real drags. A
                demo-infra "frame strip" (render a drag at t = 0, .25, .5, .75,
                1) would catch §5 problems before you do.{" "}
                <Ref t="tilings" l={188} />
              </li>
              <li>
                <b>Drop-zone view</b> reuses one behaviour instance across
                samples (its own TODO) so stateful thresholds leak, and its
                coarse grid misses zones under ~20px, so the knot's twist rings
                appeared and vanished between your screenshot and the agent's.{" "}
                <Ref t="knot" l={954} />
              </li>
              <li>
                <b>Fuzz targets replace the default run</b>, so a demo adding a
                config mode must re-list its default or lose coverage.{" "}
                <Ref t="catalan2" l={544} /> Config-panel-only states, modifier
                keys (<Code>reactTo</Code>), and HTML controls inside components
                (<Task id="60f2dd">fuzzer: drive HTML controls</Task>) are all
                invisible without hand-written targets.
              </li>
              <li>
                <b>Untested render paths</b>: the author-<Code>key</Code> throw
                broke every bluefish demo unseen because they're skipped by both
                tests and fuzzer; <Code>/studio</Code> and <Code>/study</Code>{" "}
                likewise. <Ref t="integrate" l={1397} />
              </li>
              <li>
                <b>DemoWithConfig</b> was viewport- not container-responsive;
                fixed, with the panel-above-when-wrapped question filed as{" "}
                <Task id="7d10e1">panel above the content when it wraps</Task>.
              </li>
              <li>
                <b>
                  <File>src/demo/list.ts</File>
                </b>{" "}
                is one ordered array and a merge hotspot; 5 of 12 shipped demos
                landed outside the Nursery and had to be moved.{" "}
                <Ref t="ideas" l={348} /> A demo could declare its section in{" "}
                <Code>demo()</Code> options.
              </li>
              <li>
                <b>Library-side bugs the fuzzer did catch</b>:{" "}
                <Code>getLocalBounds</Code> had no polygon/foreignObject cases,
                so <Code>dropTarget</Code> on those asserted (
                <Ref t="fuzzActions" l={90} />; <Code>path</Code>/
                <Code>text</Code> still unsupported); "Cannot lerp transforms
                with different lengths"; <Code>Duplicate id</Code> from a
                mis-located container (reached only at a 20s budget,{" "}
                <Ref t="treeMacro" l={36} />
                ); the <Code>fontSize</Code> 9-vs-75% throw.
              </li>
            </ul>
          </Problem>

          {/* ---------------------------------------------------------------- */}
          <H2 id="tasks">14. Open tasks and what I'd do first</H2>
          <div className="text-sm text-gray-800 leading-relaxed">
            <p>Already filed from these sessions, all still open:</p>
            <ul className="list-disc pl-5 [&_li]:my-0.5">
              <li>
                <Task id="c94384">.within() / .otherwise()</Task> (§2)
              </li>
              <li>
                <Task id="b34d26">vary stuck on flat position</Task> (§8)
              </li>
              <li>
                <Task id="04f7ac">clicks on descendants</Task> (§7)
              </li>
              <li>
                <Task id="a0d3ce">
                  keep the dragged element's cursor for the whole drag
                </Task>{" "}
                (permutation lab's <Code>ns-resize</Code> flickered to{" "}
                <Code>grab</Code>/<Code>grabbing</Code> depending on what's
                under the pointer, <Ref t="permMatrix" l={53} />)
              </li>
              <li>
                <Task id="e66278">fuzzer: shadowed drop candidates</Task> (§3)
              </li>
              <li>
                <Task id="7d10e1">DemoWithConfig wrap order</Task>,{" "}
                <Task id="60f2dd">fuzzer: HTML controls</Task> (§13)
              </li>
            </ul>
            <p className="mt-4">
              If I were picking, in order of (times it bit) × (cheapness):
            </p>
            <ol className="list-decimal pl-5 [&_li]:my-1">
              <li>
                <b>Docs patterns section</b> (§12). Zero library risk; most of
                the corrections in §1, §3, §5 were re-learning the same things.
              </li>
              <li>
                <b>
                  Lerp: pair unkeyed siblings by type, snap string props to a
                  side, name the ids in the error
                </b>{" "}
                (§5.1). The single most frequent crash.
              </li>
              <li>
                <b>Frame-0 guard</b>: no branch switch until the pointer moves a
                few pixels, or a dev warning when frame 0's winner isn't the
                start state (§1). Would have caught tableaux, ZX, and the{" "}
                <Code>whenFar</Code>-starts-foreground case.
              </li>
              <li>
                <b>
                  <Code>dropTarget</Code> bounds from the start state by default
                </b>{" "}
                (§1.2). Small, and it's what two agents needed.
              </li>
              <li>
                <b>
                  Central-difference probe + layer pointer forwarding +
                  descendant click handlers
                </b>
                : three small renderer fixes already specified in their tasks
                (§7, §8).
              </li>
              <li>
                <b>Fuzzer hit-testing and a frame strip</b> (§13), so the next
                batch's silent failures aren't silent.
              </li>
              <li>
                <b>Bigger design questions</b> to think about rather than build
                yet: staged drops (§9), a connector primitive (§5.2),{" "}
                <Code>.within()</Code> (§2), one chaining API (§3).
              </li>
            </ol>
            <p className="mt-6 text-xs text-gray-500">
              Method: the 32 archived transcripts were downloaded from Prusik,
              read in full by ten reader agents (one per cluster of related
              sessions), and cross-checked against the current source. Readers'
              notes are in this session's scratchpad; the demo-ideation session
              (<Ref t="ideas" l={302} />) and the pure process friction
              (dev-browser timeouts, prettier-vs-python-patches, usage limits,
              HashRouter preview URLs) are left out here.
            </p>
          </div>
          <div className="pb-14" />
        </div>
        <DemoSettingsBar
          only={["showDebugOverlay", "showDropZones", "showTreeView"]}
          compact
        />
      </div>
    </DemoSettingsProvider>
  );
}
