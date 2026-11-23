import * as Plot from "@observablehq/plot";
import { attributesToProps } from "html-react-parser";
import React, { ReactNode, SVGAttributes } from "react";
import { Svgx } from "../../svgx";
import { parseTransform, serializeTransform } from "../../svgx/transform";
import { assert } from "../../utils/assert";

/**
 * Renders Observable Plot charts as Dragology SVG.
 *
 * Plot builds an SVG DOM; we turn it into JSX, with three changes so
 * Dragology can track and blend it:
 *
 * - Marks tagged with `keyed(...)` get their key as an `id`, plus any
 *   props `attach` returns for that key (`dragologyOnDrag`, ...).
 * - Keyed rects are drawn as a unit rect placed by
 *   `translate(x, y) scale(w, h)`. Dragology tracks elements by their
 *   transforms, so this is what lets it see a bar move, and a point
 *   grabbed partway across a bar stays partway across it as the bar
 *   resizes.
 * - Axis ticks get ids from their labels, so a tick for "10" in one
 *   state blends into the tick for "10" in another, even when the
 *   scale (and so the number of ticks) changes.
 */

const KEY_ATTR = "data-dragology-key";

/**
 * A mark option that tags each of the mark's elements with a key
 * computed from its datum. `data` must be the array passed to the mark,
 * and the mark must not derive new data from it (as `groupX` or `binX`
 * do), since we look keys up by Plot's index into `data`.
 *
 * With facets, Plot draws a mark once per facet, so a datum drawn in
 * several facets gets the same key in each; `plotSvgx` numbers the
 * repeats (`key`, `key-2`, ...) to keep ids unique.
 */
export function keyed<T>(
  data: readonly T[],
  key: (d: T) => string,
): { render: Plot.RenderFunction } {
  return {
    render(index, scales, values, dimensions, context, next) {
      const g = next!(index, scales, values, dimensions, context);
      if (!g) return g;
      const children = Array.from(g.children);
      assert(
        children.length === index.length,
        `keyed: expected one element per datum (${children.length} elements, ${index.length} data)`,
      );
      children.forEach((el, i) =>
        el.setAttribute(KEY_ATTR, key(data[index[i]])),
      );
      return g;
    },
  };
}

export type PlotSvgxOptions = {
  /** Props to add to the element (or group) whose key is `key`. */
  attach?: (key: string) => SVGAttributes<SVGElement> | undefined;
  /**
   * Gathers keyed elements into groups: those with the same
   * `group(key)` go in a `<g>` with that id, which then moves as one
   * (e.g. a bar and its label, both floating together). `attach` is
   * called with the group's id too. Groups are drawn on top of the rest
   * of the chart, and in a group, elements are told apart by
   * `dragologyKey`, not `id`, so that they don't become layers of their
   * own (which would keep presses on them from reaching the group).
   */
  group?: (key: string) => string | undefined;
  /** Prefix for the ids given to axis ticks; set it to tell apart
   * several plots in one draggable. */
  idPrefix?: string;
};

export function plotSvgx(
  options: Plot.PlotOptions,
  { attach, group, idPrefix = "plot" }: PlotSvgxOptions = {},
): Svgx {
  const root = Plot.plot(options);
  assert(
    root instanceof SVGSVGElement,
    "plotSvgx: Plot made a <figure>, not an <svg>; drop options that add HTML (legends, title, caption)",
  );

  const tickKeys = axisTickKeys(root);
  const usedIds = new Set<string>();
  /** `base`, or if that's taken, `base-2`, `base-3`, ... */
  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    return id;
  };
  /** Each group's members, and where it's placed: the position of its
   * first member, so that Dragology can see the group move. */
  const groups = new Map<
    string,
    { origin: { x: number; y: number }; members: ReactNode[] }
  >();
  const convert = (
    node: Node,
    inherited: Attrs,
    /** The transforms of `node`'s ancestors. */
    ancestorTransform: string,
  ): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      return text.trim() === "" ? null : text;
    }
    if (!(node instanceof Element)) return null;
    if (node.tagName === "style") return null;

    let attrs: Attrs = {};
    for (const a of Array.from(node.attributes)) attrs[a.name] = a.value;
    const childInherited = { ...inherited, ...pick(attrs, INHERITED) };
    const childTransform = combine(ancestorTransform, attrs.transform);

    const key = attrs[KEY_ATTR];
    delete attrs[KEY_ATTR];
    let id: string | undefined;
    if (key !== undefined) {
      if (node.tagName === "rect") placeRectByTransform(attrs);
      id = uniqueId(key);
    } else if (tickKeys.has(node)) {
      id = `${idPrefix}-${tickKeys.get(node)}`;
    } else if (node.parentNode === root && attrs["aria-label"]) {
      // Each of Plot's top-level groups is one mark or axis; name it so
      // it's matched by name, not by its position among the others.
      // Several marks of one kind are numbered in the order drawn.
      id = uniqueId(
        `${idPrefix}-${sanitizeId(attrs["aria-label"].replace(/ /g, "-"))}`,
      );
    }
    // Inherited presentation attributes go on the leaves, not on groups.
    // An element with an id becomes a layer of its own, drawn outside its
    // parent groups, so it has to carry what it inherited. And two charts
    // may draw the same thing with these attributes on different groups,
    // which would leave the groups unblendable.
    if (node.tagName === "g") {
      for (const name of INHERITED) delete attrs[name];
    } else {
      attrs = { ...inherited, ...attrs };
    }

    const groupId = key !== undefined ? group?.(key) : undefined;
    if (groupId !== undefined) {
      // It's moving to a group at the top level, so it takes along the
      // transforms it was under, made relative to the group's origin.
      const { translate, rest } = splitLeadingTranslate(
        combine(ancestorTransform, attrs.transform),
      );
      if (!groups.has(groupId)) {
        groups.set(groupId, { origin: translate, members: [] });
      }
      const { origin } = groups.get(groupId)!;
      attrs.transform = serializeTransform([
        {
          type: "translate",
          x: translate.x - origin.x,
          y: translate.y - origin.y,
        },
        ...rest,
      ]);
    }

    const props: Record<string, unknown> = {
      ...attributesToProps(attrs, node.tagName),
      ...(id !== undefined &&
        (groupId !== undefined ? { dragologyKey: id } : { id })),
      ...(key !== undefined && attach?.(key)),
    };
    const children = Array.from(node.childNodes)
      .map((c) => convert(c, childInherited, childTransform))
      .filter((c) => c !== null);
    const element = React.createElement(node.tagName, props, ...children);
    if (groupId === undefined) return element;
    groups.get(groupId)!.members.push(element);
    return null;
  };

  // The root <svg>'s presentation attributes (fill, font) are inherited
  // by everything in it.
  const rootAttrs = pick(
    Object.fromEntries(
      Array.from(root.attributes).map((a) => [a.name, a.value]),
    ),
    INHERITED,
  );
  const chart = Array.from(root.childNodes)
    .map((c) => convert(c, rootAttrs, ""))
    .filter((c) => c !== null);
  return React.createElement(
    "g",
    {},
    ...chart,
    // In a wrapper of its own, like Plot's marks, so the groups stack
    // with the marks' elements (above them) and not beneath them.
    React.createElement(
      "g",
      { id: `${idPrefix}-groups` },
      ...Array.from(groups, ([groupId, { origin, members }]) =>
        React.createElement(
          "g",
          {
            id: groupId,
            transform: serializeTransform([{ type: "translate", ...origin }]),
            ...attach?.(groupId),
          },
          ...members,
        ),
      ),
    ),
  );
}

function combine(outer: string, inner: string | undefined): string {
  return [outer, inner].filter(Boolean).join(" ");
}

/** A transform's leading translations, summed, and what follows them. */
function splitLeadingTranslate(transform: string) {
  const parsed = parseTransform(transform);
  const translate = { x: 0, y: 0 };
  let i = 0;
  for (; i < parsed.length; i++) {
    const t = parsed[i];
    if (t.type !== "translate") break;
    translate.x += t.x;
    translate.y += t.y;
  }
  return { translate, rest: parsed.slice(i) };
}

type Attrs = Record<string, string>;

/** Presentation attributes that SVG elements inherit from their parents. */
const INHERITED = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "font-family",
  "font-size",
  "font-style",
  "font-variant",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "paint-order",
];

function pick(attrs: Attrs, names: string[]): Attrs {
  return Object.fromEntries(
    Object.entries(attrs).filter(([name]) => names.includes(name)),
  );
}

function placeRectByTransform(attrs: Record<string, string>) {
  assert(!attrs.transform, "keyed rects can't have their own transform");
  const x = Number(attrs.x ?? 0);
  const y = Number(attrs.y ?? 0);
  const w = Number(attrs.width ?? 0);
  const h = Number(attrs.height ?? 0);
  delete attrs.x;
  delete attrs.y;
  attrs.width = "1";
  attrs.height = "1";
  attrs.transform = `translate(${x}, ${y}) scale(${w}, ${h})`;
  attrs["vector-effect"] = "non-scaling-stroke";
}

/**
 * Plot draws each axis as a group of labels ("y-axis tick label"), a
 * group of tick marks ("y-axis tick") and maybe grid lines ("y-grid"),
 * all in the same order. (With facets, each group repeats its contents
 * once per facet.) Key them all by the label text, so that a tick keeps
 * its identity when the scale changes. A facet axis ("fx-axis") is
 * keyed like the plain axis in its direction, so the labels of a chart
 * faceted by quarter match those of one with quarters along x.
 */
function axisTickKeys(root: SVGSVGElement): Map<Element, string> {
  const keys = new Map<Element, string>();
  const used = new Set<string>();
  const set = (el: Element, key: string) => {
    let unique = key;
    for (let n = 2; used.has(unique); n++) unique = `${key}-${n}`;
    used.add(unique);
    keys.set(el, unique);
  };
  const leaves = (g: Element | undefined) =>
    g ? Array.from(g.querySelectorAll("path, line")) : [];
  const group = (label: string) =>
    Array.from(root.children).find(
      (g) => g.getAttribute("aria-label") === label,
    );

  for (const labelGroup of Array.from(root.children)) {
    const m = labelGroup
      .getAttribute("aria-label")
      ?.match(/^(f?)([xy])-axis tick label$/);
    if (!m) continue;
    const [, facet, dir] = m;
    const name = `${dir}-axis`;
    const labelEls = Array.from(labelGroup.querySelectorAll("text"));
    const texts = labelEls.map((t) => sanitizeId(t.textContent ?? ""));
    labelEls.forEach((el, i) => set(el, `${name}-label-${texts[i]}`));

    const others: [Element[], string][] = [
      [leaves(group(`${facet}${dir}-axis tick`)), "tick"],
      [leaves(group(`${facet}${dir}-grid`)), "grid"],
    ];
    for (const [els, kind] of others) {
      if (els.length === 0 || els.length % texts.length !== 0) continue;
      els.forEach((el, i) =>
        set(el, `${name}-${kind}-${texts[i % texts.length]}`),
      );
    }
  }
  return keys;
}

function sanitizeId(s: string): string {
  return s.replace(/[^\w-]/g, (c) => `_${c.charCodeAt(0)}`);
}
