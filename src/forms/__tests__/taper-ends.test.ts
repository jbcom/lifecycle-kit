import { describe, expect, it } from "vitest";
import { taper } from "../rules/taper.js";

/**
 * A taper has two ENDS, not two points.
 *
 * The outline ran (0, -from) -> curve -> (length, -to) -> curve -> (0, from),
 * which never visits (length, to) at all. The right-hand end therefore
 * collapsed to a single vertex and every taper came out a lens — two arcs
 * meeting at sharp points.
 *
 * Two lenses joined at the waist is a diamond, which is exactly what the
 * creature rendered as: an angular crystal with spikes rather than an animal.
 * Caught by looking at a screenshot; no numeric test was asserting the shape
 * of the ends.
 */
describe("taper ends", () => {
	const shape = () => {
		const [s] = taper({ from: 0.3, to: 0.15, bulgeAt: 0.5, length: 1 }).shapes;
		if (s?.kind !== "subpath") throw new Error("expected a subpath");
		return s;
	};

	function points(): { x: number; y: number }[] {
		const s = shape();
		return [s.start, ...s.segments.map((g) => g.to)];
	}

	// A blunt end means both of its corners exist.
	it("visits both corners of the narrow end", () => {
		const ys = points()
			.filter((p) => Math.abs(p.x - 1) < 1e-9)
			.map((p) => p.y)
			.sort((a, b) => a - b);
		expect(ys).toHaveLength(2);
		expect(ys[0]).toBeCloseTo(-0.15, 6);
		expect(ys[1]).toBeCloseTo(0.15, 6);
	});

	it("visits both corners of the wide end", () => {
		const ys = points()
			.filter((p) => Math.abs(p.x) < 1e-9)
			.map((p) => p.y)
			.sort((a, b) => a - b);
		expect(ys).toHaveLength(2);
		expect(ys[0]).toBeCloseTo(-0.3, 6);
		expect(ys[1]).toBeCloseTo(0.3, 6);
	});

	// Both flanks curve; the ends are the straight bits that close it.
	it("curves along both flanks", () => {
		const curved = shape().segments.filter((g) => g.kind === "quadratic");
		expect(curved.length).toBeGreaterThanOrEqual(2);
	});

	it("stays closed", () => {
		expect(shape().closed).toBe(true);
	});

	// A taper narrowing to nothing IS a point, and must stay one.
	it("still comes to a point when it tapers to zero", () => {
		const [s] = taper({ from: 0.3, to: 0, bulgeAt: 0.5, length: 1 }).shapes;
		if (s?.kind !== "subpath") throw new Error("expected a subpath");
		const ends = [s.start, ...s.segments.map((g) => g.to)].filter((p) => Math.abs(p.x - 1) < 1e-9);
		expect(ends.every((p) => Math.abs(p.y) < 1e-9)).toBe(true);
	});
});
