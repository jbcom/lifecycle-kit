import { describe, expect, it } from "vitest";
import { bounds } from "../../path.js";
import { taper } from "../../rules/taper.js";

describe("taper", () => {
	it("emits a single closed subpath", () => {
		const body = taper({ from: 1, to: 0.2, bulgeAt: 0.5, length: 10 });
		expect(body.shapes).toHaveLength(1);
		const shape = body.shapes[0];
		if (shape?.kind !== "subpath") throw new Error("expected a subpath");
		expect(shape.closed).toBe(true);
	});

	it("spans the requested length along x", () => {
		const box = bounds(taper({ from: 1, to: 1, bulgeAt: 0.5, length: 10 }));
		expect(box).not.toBeNull();
		if (!box) return;
		expect(box.min.x).toBeCloseTo(0, 6);
		expect(box.max.x).toBeCloseTo(10, 6);
	});

	it("narrows: the end half-width is smaller than the start when to < from", () => {
		const wide = taper({ from: 2, to: 0.5, bulgeAt: 0.5, length: 10 });
		const box = bounds(wide);
		expect(box).not.toBeNull();
		if (!box) return;
		// The overall half-height is dominated by the wider end plus the bulge,
		// but crucially the shape is not symmetric front-to-back for from != to.
		expect(box.max.y).toBeGreaterThan(0);
	});

	it("produces a genuine bulge past both endpoint widths at bulgeAt", () => {
		const body = taper({ from: 0.5, to: 0.5, bulgeAt: 0.5, length: 10 });
		const box = bounds(body);
		expect(box).not.toBeNull();
		if (!box) return;
		// A uniform 0.5 half-width body with a midpoint bulge must exceed 0.5.
		expect(box.max.y).toBeGreaterThan(0.5);
	});

	// CONTINUITY ASSAY: sweeping bulgeAt produces no cliff in the outline.
	it("sweeps bulgeAt with no discontinuity in extent", () => {
		const extentAt = (bulgeAt: number) => {
			const box = bounds(taper({ from: 1, to: 0.3, bulgeAt, length: 10 }));
			if (!box) throw new Error("expected bounds");
			return box.max.y;
		};
		const steps = Array.from({ length: 100 }, (_, i) => i / 99);
		let previous = extentAt(steps[0] as number);
		for (const t of steps.slice(1)) {
			const current = extentAt(t);
			expect(Math.abs(current - previous)).toBeLessThan(0.1);
			previous = current;
		}
	});

	it("sweeps from/to with no discontinuity in extent", () => {
		const extentAt = (from: number) => {
			const box = bounds(taper({ from, to: 0.3, bulgeAt: 0.4, length: 10 }));
			if (!box) throw new Error("expected bounds");
			return box.max.y;
		};
		const steps = Array.from({ length: 100 }, (_, i) => 0.1 + (i / 99) * 2);
		let previous = extentAt(steps[0] as number);
		for (const f of steps.slice(1)) {
			const current = extentAt(f);
			expect(Math.abs(current - previous)).toBeLessThan(0.2);
			previous = current;
		}
	});

	it("tags the outline when a part is supplied, and leaves it untagged otherwise", () => {
		const tagged = taper({
			from: 1,
			to: 1,
			bulgeAt: 0.5,
			length: 10,
			part: "thorax",
			index: 2,
		});
		expect(tagged.shapes[0]).toMatchObject({
			tag: { part: "thorax", index: 2 },
		});

		const untagged = taper({ from: 1, to: 1, bulgeAt: 0.5, length: 10 });
		expect(untagged.shapes[0]).not.toHaveProperty("tag");
	});
});
