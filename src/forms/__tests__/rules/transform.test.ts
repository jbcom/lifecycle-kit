import { describe, expect, it } from "vitest";
import { bounds, type Path } from "../../path.js";
import { mirrorX, mirrorY, rotateTurns, scale, translate } from "../../rules/transform.js";

const dot = (x: number, y: number): Path => ({
	shapes: [{ kind: "ellipse", center: { x, y }, radiusX: 1, radiusY: 2 }],
});

describe("transform", () => {
	it("translate moves every coordinate by the offset", () => {
		const moved = translate(dot(1, 1), { x: 2, y: -3 });
		expect(moved.shapes[0]).toMatchObject({ center: { x: 3, y: -2 } });
	});

	it("translate by zero is the identity", () => {
		const p = dot(1, 1);
		expect(translate(p, { x: 0, y: 0 })).toEqual(p);
	});

	it("scale multiplies coordinates and ellipse radii together", () => {
		const scaled = scale(dot(2, 3), 2);
		expect(scaled.shapes[0]).toMatchObject({
			center: { x: 4, y: 6 },
			radiusX: 2,
			radiusY: 4,
		});
	});

	it("mirrorX negates x and leaves y and radiusY untouched", () => {
		const mirrored = mirrorX(dot(2, 3));
		expect(mirrored.shapes[0]).toMatchObject({
			center: { x: -2, y: 3 },
			radiusY: 2,
		});
	});

	// The bilateral one: a body runs along +x, so reflecting a limb to the
	// other side negates y and leaves the along-body coordinate alone.
	it("mirrorY negates y and leaves x and radiusX untouched", () => {
		const mirrored = mirrorY(dot(2, 3));
		expect(mirrored.shapes[0]).toMatchObject({
			center: { x: 2, y: -3 },
			radiusX: 1,
		});
	});

	it("rotateTurns by a quarter turn sends +x to +y", () => {
		const p: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					segments: [{ kind: "line", to: { x: 1, y: 0 } }],
					closed: false,
				},
			],
		};
		const rotated = rotateTurns(p, 0.25);
		const shape = rotated.shapes[0];
		if (shape?.kind !== "subpath") throw new Error("expected a subpath");
		const seg = shape.segments[0];
		if (seg?.kind !== "line") throw new Error("expected a line");
		expect(seg.to.x).toBeCloseTo(0, 12);
		expect(seg.to.y).toBeCloseTo(1, 12);
	});

	it("rotateTurns closes its loop exactly at whole turns", () => {
		const p = dot(1, 0);
		expect(rotateTurns(p, 1)).toEqual(rotateTurns(p, 0));
	});

	it("rotateTurns preserves distance from the origin", () => {
		const box = bounds(dot(3, 4));
		const rotated = bounds(rotateTurns(dot(3, 4), 0.17));
		expect(box).not.toBeNull();
		expect(rotated).not.toBeNull();
		if (!box || !rotated) return;
		// A point at (3,4) is distance 5 from the origin; the ellipse's own
		// centre must still be distance 5 out after an arbitrary rotation.
		const centerDist = (b: { min: { x: number; y: number }; max: { x: number; y: number } }) => {
			const cx = (b.min.x + b.max.x) / 2;
			const cy = (b.min.y + b.max.y) / 2;
			return Math.hypot(cx, cy);
		};
		expect(centerDist(rotated)).toBeCloseTo(centerDist(box), 6);
	});
});
