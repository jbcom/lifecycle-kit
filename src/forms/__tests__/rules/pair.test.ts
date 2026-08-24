import { describe, expect, it } from "vitest";
import { groupByPart, type Path } from "../../path.js";
import { pair } from "../../rules/pair.js";

// A leg pointing along +x from its attachment.
const leg: Path = {
	shapes: [
		{
			kind: "subpath",
			start: { x: 0, y: 0 },
			segments: [{ kind: "line", to: { x: 1, y: 0.3 } }],
			closed: false,
		},
	],
};

describe("pair", () => {
	it("emits two shapes for one unit", () => {
		expect(
			pair(leg, { attachment: { x: 2, y: 1 }, part: "leg" }).shapes,
		).toHaveLength(2);
	});

	// Reflected across the BODY's long axis (+x), so the members differ in y
	// and share x. Mirroring across x instead would negate the along-body
	// coordinate, putting one member at the head end and one at the tail end
	// — a front leg and a back leg rather than a left and a right.
	it("reflects the second copy across the body axis", () => {
		const both = pair(leg, { attachment: { x: 2, y: 1 }, part: "leg" });
		const right = both.shapes[0];
		const left = both.shapes[1];
		if (right?.kind !== "subpath" || left?.kind !== "subpath")
			throw new Error("expected subpaths");
		// Right leg's tip: attachment (2,1) + unit tip (1, 0.3).
		expect(right.segments[0]).toMatchObject({ to: { x: 3, y: 1.3 } });
		// Left leg's tip: mirrored attachment (2,-1) + mirrored unit tip (1,-0.3).
		expect(left.segments[0]).toMatchObject({ to: { x: 3, y: -1.3 } });
	});

	it("tags left and right as the same part with distinct indices", () => {
		const both = pair(leg, { attachment: { x: 1, y: 0 }, part: "leg" });
		const groups = groupByPart(both);
		expect(groups).toHaveLength(2);
		expect(groups.every((g) => g.part === "leg")).toBe(true);
		expect(groups.map((g) => g.index).sort()).toEqual([0, 1]);
	});

	it("offsets indices by siteIndex so a repeated body's pairs stay distinct", () => {
		const site1 = pair(leg, {
			attachment: { x: 1, y: 0 },
			part: "leg",
			siteIndex: 1,
		});
		const groups = groupByPart(site1);
		expect(groups.map((g) => g.index).sort()).toEqual([2, 3]);
	});

	it("is exactly symmetric about the body axis", () => {
		const centred = pair(leg, { attachment: { x: 1, y: 1 }, part: "leg" });
		const right = centred.shapes[0];
		const left = centred.shapes[1];
		if (right?.kind !== "subpath" || left?.kind !== "subpath")
			throw new Error("expected subpaths");
		// Same station along the body, opposite sides of it.
		expect(right.start.x).toBeCloseTo(left.start.x, 12);
		expect(right.start.y).toBeCloseTo(-left.start.y, 12);
	});
});
