import { describe, expect, it } from "vitest";
import { groupByPart, type Path } from "../../path.js";
import { radiate } from "../../rules/radiate.js";

// A tentacle-like arm pointing along +x from the origin.
const arm: Path = {
	shapes: [
		{
			kind: "subpath",
			start: { x: 0, y: 0 },
			segments: [{ kind: "line", to: { x: 1, y: 0 } }],
			closed: false,
		},
	],
};

describe("radiate", () => {
	it("places count copies", () => {
		expect(
			radiate(arm, {
				center: { x: 0, y: 0 },
				count: 5,
				spreadTurns: 1,
				part: "tentacle",
			}).shapes,
		).toHaveLength(5);
	});

	it("returns an empty path for a non-positive count", () => {
		expect(
			radiate(arm, {
				center: { x: 0, y: 0 },
				count: 0,
				spreadTurns: 1,
				part: "tentacle",
			}).shapes,
		).toHaveLength(0);
	});

	it("spaces a full ring evenly around the centre", () => {
		const ring = radiate(arm, {
			center: { x: 0, y: 0 },
			count: 4,
			spreadTurns: 1,
			part: "arm",
		});
		const tips = ring.shapes.map((s) => {
			if (s.kind !== "subpath") throw new Error("expected a subpath");
			const seg = s.segments[0];
			if (seg?.kind !== "line") throw new Error("expected a line");
			return seg.to;
		});
		// Four arms a quarter-turn apart from a unit-length arm: (1,0), (0,1),
		// (-1,0), (0,-1) in some rotational order.
		for (const tip of tips) {
			expect(Math.hypot(tip.x, tip.y)).toBeCloseTo(1, 6);
		}
		expect(tips[0]).toMatchObject({
			x: expect.closeTo(1, 6),
			y: expect.closeTo(0, 6),
		});
	});

	it("places every copy at the requested distance from the centre", () => {
		const centered = radiate(arm, {
			center: { x: 5, y: -5 },
			count: 6,
			spreadTurns: 1,
			part: "arm",
		});
		for (const shape of centered.shapes) {
			if (shape.kind !== "subpath") throw new Error("expected a subpath");
			const seg = shape.segments[0];
			if (seg?.kind !== "line") throw new Error("expected a line");
			const dx = seg.to.x - shape.start.x;
			const dy = seg.to.y - shape.start.y;
			expect(Math.hypot(dx, dy)).toBeCloseTo(1, 6);
		}
	});

	it("spaces a partial arc in count even slots covering the spread", () => {
		// count evenly-sized slots of spreadTurns/count each, starting at
		// startTurn — the same formula a full ring uses, which is what keeps
		// this rule free of a cliff at spreadTurns = 1 (see radiate.ts).
		const arc = radiate(arm, {
			center: { x: 0, y: 0 },
			count: 4,
			spreadTurns: 0.5,
			startTurn: -0.25,
			part: "tentacle",
		});
		const tipYAt = (index: number) => {
			const shape = arc.shapes[index];
			if (shape?.kind !== "subpath") throw new Error("expected a subpath");
			const seg = shape.segments[0];
			if (seg?.kind !== "line") throw new Error("expected a line");
			return seg.to.y;
		};
		// startTurn=-0.25 -> pointing along -y. Step = 0.5/4 = 0.125 turns.
		// First copy at turn -0.25 (along -y); last of 4 at turn -0.25+3*0.125
		// = 0.125 turns short of a quarter turn past +x, not all the way to +y.
		expect(tipYAt(0)).toBeCloseTo(-1, 6);
		expect(tipYAt(3)).toBeLessThan(1);
	});

	it("tags copies with sequential indices", () => {
		const ring = radiate(arm, {
			center: { x: 0, y: 0 },
			count: 3,
			spreadTurns: 1,
			part: "tentacle",
		});
		expect(groupByPart(ring).map((g) => g.index)).toEqual([0, 1, 2]);
	});

	// CONTINUITY ASSAY: sweeping spreadTurns produces no cliff.
	it("sweeps spreadTurns with no discontinuity in the outermost tip position", () => {
		const tipYAt = (spreadTurns: number) => {
			const arc = radiate(arm, {
				center: { x: 0, y: 0 },
				count: 8,
				spreadTurns,
				part: "tentacle",
			});
			const last = arc.shapes[arc.shapes.length - 1];
			if (last?.kind !== "subpath") throw new Error("expected a subpath");
			const seg = last.segments[0];
			if (seg?.kind !== "line") throw new Error("expected a line");
			return seg.to.y;
		};
		const steps = Array.from({ length: 60 }, (_, i) => i / 59);
		let previous = tipYAt(steps[0] as number);
		for (const s of steps.slice(1)) {
			const current = tipYAt(s);
			expect(Math.abs(current - previous)).toBeLessThan(0.2);
			previous = current;
		}
	});
});
