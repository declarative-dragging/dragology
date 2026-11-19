import { describe, expect, it } from "vitest";
import { CoincidentPointsError, Delaunay } from "./delaunay";
import { Vec2 } from "./vec2";

describe("coincident points", () => {
  it("throws CoincidentPointsError for two identical points", () => {
    expect(
      () =>
        new Delaunay([
          [1, 2],
          [1, 2],
        ]),
    ).toThrow(CoincidentPointsError);
  });

  it("reports the correct indices", () => {
    try {
      new Delaunay([
        [0, 0],
        [1, 1],
        [0, 0],
      ]);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CoincidentPointsError);
      expect((e as CoincidentPointsError).indexA).toBe(0);
      expect((e as CoincidentPointsError).indexB).toBe(2);
    }
  });

  it("reports the first coincident pair found", () => {
    try {
      new Delaunay([
        [5, 5],
        [1, 1],
        [5, 5],
        [1, 1],
      ]);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CoincidentPointsError);
      expect((e as CoincidentPointsError).indexA).toBe(0);
      expect((e as CoincidentPointsError).indexB).toBe(2);
    }
  });

  it("allows distinct points", () => {
    expect(
      () =>
        new Delaunay([
          [0, 0],
          [1, 0],
          [0, 1],
        ]),
    ).not.toThrow();
  });
});

describe("findTriangle", () => {
  it("works in weird collinear case #1", () => {
    const delaunay = new Delaunay([
      [250, 0],
      [250, 50],
    ]);
    const pt = Vec2(250, 55);
    expect(delaunay.findTriangle(pt)).toEqual(-1);
  });

  it("works in weird collinear case #2", () => {
    const delaunay = new Delaunay([
      [250, 0],
      [250, 50],
    ]);
    const pt = Vec2(300, 55);
    expect(delaunay.findTriangle(pt)).toEqual(-1);
  });

  it("works in weird collinear case #3", () => {
    const delaunay = new Delaunay([
      [250, 0],
      [250, 50],
      [250, 100],
    ]);
    const pt = Vec2(250, 55);
    expect(delaunay.findTriangle(pt)).toEqual(-1);
  });

  it("finds a point that rounding puts outside both triangles of an edge", () => {
    // From the plot-treemap demo: where a dragged file lands in each
    // state it can be dropped into, and a pointer on the edge between
    // points 9 and 13. The walk used to cycle between the two triangles
    // on that edge forever.
    const coords = [
      9.01083591331269, 88.32164948453608, 183.45574819401446,
      88.32164948453608, 183.45574819401446, 217.04962875914748,
      281.5810113519092, 217.04962875914748, 9.01083591331269,
      270.05740077987286, 168.35955386203065, 270.05740077987286,
      256.4206874652695, 270.05740077987286, 256.4206874652695,
      347.62053140436154, 327.62136222910215, 88.32164948453608,
      420.53715170278633, 88.32164948453608, 463.42136222910216,
      88.32164948453608, 463.42136222910216, 135.81134020618555,
      327.62136222910215, 217.23917525773197, 424.4937306501548,
      217.23917525773197, 477.3332043343653, 217.23917525773197,
    ];
    const points = coords.flatMap((c, i) =>
      i % 2 === 0 ? [Vec2(c, coords[i + 1])] : [],
    );
    const delaunay = new Delaunay(points);
    const pt = Vec2(423.174871001032, 174.26666666666668);
    const tri = delaunay.findTriangle(pt);
    expect(tri).not.toEqual(-1);
    const [a, b, c] = delaunay.triangle(tri);
    const cross = (p: Vec2, q: Vec2) =>
      (q.x - p.x) * (pt.y - p.y) - (q.y - p.y) * (pt.x - p.x);
    const signs = [cross(a, b), cross(b, c), cross(c, a)];
    expect(signs.every((s) => s >= 0) || signs.every((s) => s <= 0)).toBe(true);
  });
});
