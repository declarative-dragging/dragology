// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ValueView, ValueViewProps, ValueViewProvider } from "./ValueView";

afterEach(cleanup);

function text(props: ValueViewProps) {
  return render(<ValueView {...props} />).container.textContent;
}

describe("DefaultValueView", () => {
  it("shows states as JSON", () => {
    expect(text({ kind: "state", value: { x: 1.23456, tags: ["a"] } })).toBe(`{
  "x": 1.23,
  "tags": [
    "a"
  ]
}`);
  });

  it("marks cycles but not shared values", () => {
    const shared = { n: 1 };
    const state: Record<string, unknown> = { a: shared, b: shared };
    state.self = state;
    const out = JSON.parse(text({ kind: "state", value: state })!);
    expect(out).toEqual({ a: { n: 1 }, b: { n: 1 }, self: "[Circular]" });
  });

  it("names functions and survives bigints", () => {
    const out = JSON.parse(
      text({ kind: "state", value: { f: function onDrag() {}, n: 2n } })!,
    );
    expect(out).toEqual({ f: "[Function onDrag]", n: "2n" });
  });

  it("shows SVG elements as tags", () => {
    expect(
      text({
        kind: "svg",
        value: (
          <g id="a" transform="translate(1, 2)" onClick={() => {}}>
            <circle r={3} style={{ fill: "red" }} />
            hi
          </g>
        ),
      }),
    ).toBe(`<g id="a" transform="translate(1, 2)" onClick={ƒ}>
  <circle r={3} style={{ "fill": "red" }} />
  hi
</g>`);
  });
});

it("ValueViewProvider swaps in another component", () => {
  const { container } = render(
    <ValueViewProvider component={({ kind }) => <span>custom {kind}</span>}>
      <ValueView kind="state" value={{}} />
    </ValueViewProvider>,
  );
  expect(container.textContent).toBe("custom state");
});
