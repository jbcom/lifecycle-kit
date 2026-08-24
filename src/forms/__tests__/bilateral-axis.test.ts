import { describe, expect, it } from "vitest";
import type { Path, SubPath } from "../path.js";
import { pair } from "../rules/pair.js";

/**
 * Bilateral symmetry is about the body's long axis.
 *
 * `path.ts` fixes the convention — "the body's long axis along +x" — and every
 * caller of `repeat` lays a body out with `axis: {x: 1, y: 0}` accordingly. A
 * left/right pair therefore differs in Y and shares X: two forelegs sit at the
 * same distance along the body, on opposite sides of it.
 *
 * `pair` originally mirrored across X, which negates the along-body coordinate
 * instead. Both members came out at the same Y with opposite X — one at the
 * head end and one at the tail end, both on the same side. That is not a pair,
 * and it was invisible in tests because nothing asserted which axis separated
 * the two members.
 */
describe("pair is bilateral about the body axis", () => {
	/** A limb authored at the origin, pointing away from the body along +y. */
	const limb: Path = {
		shapes: [
			{
				kind: "subpath",
				start: { x: 0, y: 0 },
				segments: [{ kind: "line", to: { x: 0, y: 0.3 } }],
				closed: false,
			},
		],
	};

	/** Attached partway along the body, offset to one side of it. */
	const ATTACHMENT = { x: 0.2, y: 0.15 };

	function sides(p: Path) {
		const subpaths = p.shapes.filter(
			(s): s is Extract<(typeof p.shapes)[number], SubPath> => s.kind === "subpath",
		);
		return subpaths.map((s) => [s.start, ...s.segments.map((g) => g.to)]);
	}

	it("puts the two members on opposite sides of the body", () => {
		const [right, left] = sides(pair(limb, { attachment: ATTACHMENT, part: "leg", siteIndex: 0 }));
		expect(right?.[0]?.y).toBeGreaterThan(0);
		expect(left?.[0]?.y).toBeLessThan(0);
	});

	// The failure this pins: both members landed at the same Y, separated in X,
	// which reads as a front leg and a back leg rather than a left and a right.
	it("keeps both members at the same position along the body", () => {
		const [right, left] = sides(pair(limb, { attachment: ATTACHMENT, part: "leg", siteIndex: 0 }));
		expect(right?.[0]?.x).toBeCloseTo(left?.[0]?.x ?? Number.NaN, 10);
		expect(right?.[0]?.x).toBeCloseTo(ATTACHMENT.x, 10);
	});

	it("mirrors the whole limb, not only its attachment", () => {
		const [right, left] = sides(pair(limb, { attachment: ATTACHMENT, part: "leg", siteIndex: 0 }));
		// The limb extends away from the body on each side.
		expect(right?.[1]?.y).toBeGreaterThan(right?.[0]?.y ?? 0);
		expect(left?.[1]?.y).toBeLessThan(left?.[0]?.y ?? 0);
		// And stays at its station along the body.
		expect(right?.[1]?.x).toBeCloseTo(left?.[1]?.x ?? Number.NaN, 10);
	});

	it("still tags the two members as one part with distinct indices", () => {
		const p = pair(limb, { attachment: ATTACHMENT, part: "leg", siteIndex: 2 });
		const tags = p.shapes.map((s) => s.tag);
		expect(tags.map((t) => t?.part)).toEqual(["leg", "leg"]);
		expect(tags.map((t) => t?.index)).toEqual([4, 5]);
	});
});
