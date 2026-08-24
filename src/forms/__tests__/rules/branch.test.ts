import { describe, expect, it } from "vitest";
import { bounds, groupByPart, type Path } from "../../path.js";
import { branch } from "../../rules/branch.js";

// A twig pointing along +x, unit length.
const twig: Path = {
	shapes: [
		{
			kind: "subpath",
			start: { x: 0, y: 0 },
			segments: [{ kind: "line", to: { x: 1, y: 0 } }],
			closed: false,
		},
	],
};

describe("branch", () => {
	it("emits nothing at depth 0", () => {
		expect(
			branch(twig, {
				depth: 0,
				splits: 2,
				angle: 0.1,
				shrink: 0.6,
				attachAt: 1,
				part: "twig",
			}).shapes,
		).toHaveLength(0);
	});

	it("emits exactly the unit at depth 1", () => {
		const result = branch(twig, {
			depth: 1,
			splits: 2,
			angle: 0.1,
			shrink: 0.6,
			attachAt: 1,
			part: "twig",
		});
		expect(result.shapes).toHaveLength(1);
	});

	it("grows geometrically: depth n has splits^(n-1) leaf-generation shapes plus every ancestor", () => {
		const splits = 2;
		const depth = 4;
		const result = branch(twig, {
			depth,
			splits,
			angle: 0.15,
			shrink: 0.7,
			attachAt: 1,
			part: "twig",
		});
		let expected = 0;
		for (let d = 0; d < depth; d++) expected += splits ** d;
		expect(result.shapes).toHaveLength(expected);
	});

	it("shrinks later generations", () => {
		const result = branch(twig, {
			depth: 3,
			splits: 2,
			angle: 0.1,
			shrink: 0.5,
			attachAt: 1,
			part: "twig",
		});
		const lengths = result.shapes.map((s) => {
			const box = bounds({ shapes: [s] });
			if (!box) throw new Error("expected bounds");
			return Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y);
		});
		// The root (first emitted) must be the longest — every descendant
		// shrinks by a factor below 1 relative to it.
		const root = lengths[0] as number;
		for (const len of lengths.slice(1)) {
			expect(len).toBeLessThanOrEqual(root + 1e-9);
		}
	});

	it("terminates even when shrink is exactly 1 — depth is the only cutoff", () => {
		const result = branch(twig, {
			depth: 3,
			splits: 2,
			angle: 0.1,
			shrink: 1,
			attachAt: 1,
			part: "twig",
		});
		expect(result.shapes.length).toBeGreaterThan(0);
		expect(Number.isFinite(result.shapes.length)).toBe(true);
	});

	/**
	 * `splits: 1` divides by `params.splits - 1`, which is zero — the fan-turn
	 * formula short-circuits to a fixed 0 specifically to avoid that division.
	 * Every other test in this file uses `splits: 2`, so this guard had never
	 * actually run; without it, a single-split branch (a stem continuing
	 * without forking) would compute `angle * (0 / 0)`, which is NaN.
	 */
	it("does not divide by zero when splits is 1", () => {
		const result = branch(twig, {
			depth: 2,
			splits: 1,
			angle: 0.3,
			shrink: 0.7,
			attachAt: 1,
			part: "twig",
		});
		expect(result.shapes).toHaveLength(2);
		for (const shape of result.shapes) {
			if (shape.kind !== "subpath") throw new Error("expected a subpath");
			expect(Number.isFinite(shape.start.x)).toBe(true);
			expect(Number.isFinite(shape.start.y)).toBe(true);
		}
	});

	it("fans splits symmetrically about the parent direction", () => {
		// splits=2 at depth 2: root plus two children fanned at ±angle/2.
		const result = branch(twig, {
			depth: 2,
			splits: 2,
			angle: 0.1,
			shrink: 0.8,
			attachAt: 1,
			part: "twig",
		});
		expect(result.shapes).toHaveLength(3);
		const children = result.shapes.slice(1).map((s) => {
			if (s.kind !== "subpath") throw new Error("expected a subpath");
			const seg = s.segments[0];
			if (seg?.kind !== "line") throw new Error("expected a line");
			return seg.to.y - s.start.y;
		});
		// One child fans up, one fans down, by equal magnitude.
		expect(children[0]).toBeCloseTo(-(children[1] as number), 6);
	});

	it("assigns every shape a part tag", () => {
		const result = branch(twig, {
			depth: 2,
			splits: 2,
			angle: 0.1,
			shrink: 0.8,
			attachAt: 1,
			part: "twig",
		});
		const groups = groupByPart(result);
		expect(groups.every((g) => g.part === "twig")).toBe(true);
		expect(groups.reduce((n, g) => n + g.shapes.length, 0)).toBe(
			result.shapes.length,
		);
	});

	// CONTINUITY ASSAY: sweeping angle produces no cliff in the overall extent.
	it("sweeps angle with no discontinuity in extent", () => {
		const extentAt = (angle: number) => {
			const result = branch(twig, {
				depth: 4,
				splits: 2,
				angle,
				shrink: 0.65,
				attachAt: 1,
				part: "twig",
			});
			const box = bounds(result);
			if (!box) throw new Error("expected bounds");
			return box.max.y - box.min.y;
		};
		const steps = Array.from({ length: 60 }, (_, i) => i / 59);
		let previous = extentAt(steps[0] as number);
		for (const a of steps.slice(1)) {
			const current = extentAt(a);
			expect(Math.abs(current - previous)).toBeLessThan(0.3);
			previous = current;
		}
	});
});
