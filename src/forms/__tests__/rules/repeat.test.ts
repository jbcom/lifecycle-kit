import { describe, expect, it } from "vitest";
import { bounds, groupByPart, type Path } from "../../path.js";
import { repeat } from "../../rules/repeat.js";

const dot: Path = {
	shapes: [{ kind: "ellipse", center: { x: 0, y: 0 }, radiusX: 1, radiusY: 1 }],
};

describe("repeat", () => {
	it("places count copies at spacing intervals along the axis", () => {
		const body = repeat(dot, {
			count: 3,
			axis: { x: 1, y: 0 },
			spacing: 2,
			part: "segment",
		});
		expect(body.shapes).toHaveLength(3);
		expect(
			body.shapes.map((s) => (s.kind === "ellipse" ? s.center.x : null)),
		).toEqual([0, 2, 4]);
	});

	it("tags copies with increasing index, low index first", () => {
		const body = repeat(dot, {
			count: 3,
			axis: { x: 1, y: 0 },
			spacing: 1,
			part: "segment",
		});
		const groups = groupByPart(body);
		expect(groups.map((g) => g.index)).toEqual([0, 1, 2]);
	});

	it("returns an empty path for a non-positive count", () => {
		expect(
			repeat(dot, {
				count: 0,
				axis: { x: 1, y: 0 },
				spacing: 1,
				part: "segment",
			}).shapes,
		).toHaveLength(0);
	});

	it("supports an off-axis repeat direction", () => {
		const body = repeat(dot, {
			count: 2,
			axis: { x: 0, y: 1 },
			spacing: 3,
			part: "segment",
		});
		expect(body.shapes[1]).toMatchObject({ center: { x: 0, y: 3 } });
	});

	// CONTINUITY ASSAY: no parameter step produces a visual cliff.
	it("moves copies continuously as spacing varies, with no jump", () => {
		const at = (spacing: number) => {
			const body = repeat(dot, {
				count: 5,
				axis: { x: 1, y: 0 },
				spacing,
				part: "segment",
			});
			const box = bounds(body);
			if (!box) throw new Error("expected bounds");
			return box.max.x;
		};
		const spacings = Array.from({ length: 50 }, (_, i) => i * 0.1);
		let previous = at(spacings[0] as number);
		for (const s of spacings.slice(1)) {
			const current = at(s);
			// Extent must grow monotonically and by a bounded step for a small
			// step in spacing — no threshold where more segments appear at once.
			expect(current).toBeGreaterThanOrEqual(previous);
			expect(current - previous).toBeLessThan(1);
			previous = current;
		}
	});
});
