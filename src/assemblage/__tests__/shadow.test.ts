import type { Shape } from "../../forms/index.js";
import { describe, expect, it } from "vitest";
import { assemble } from "../assemble.js";
import { DEFAULT_LIGHT, shade } from "../light.js";
import {
	boxArea,
	occlusion,
	offsetBox,
	overlapArea,
	shadowed,
	shapeBox,
} from "../shadow.js";

/**
 * Self-shadowing is what separates "grown" from "pasted".
 *
 * Flat shading lights each part by its own position and never asks whether one
 * part covers another, so a leg drawn over a body is a differently-coloured
 * sticker on it. These assays pin the property that fixes that: a part in
 * front takes light AWAY from the part behind, in proportion to how much of it
 * it actually covers, displaced by how far in front it is.
 *
 * The assertions are relational — this is darker than that, this moved further
 * than that — rather than pinned to constants, because the constants are
 * design decisions that should be tunable without a test rewrite. What must
 * not change is the ordering, and that is what is asserted.
 */

function ellipse(
	part: string,
	index: number,
	x: number,
	y: number,
	r = 0.3,
): Shape {
	return {
		kind: "ellipse",
		center: { x, y },
		radiusX: r,
		radiusY: r,
		tag: { part, index },
	};
}

describe("shape extents", () => {
	it("bounds an ellipse by its radii", () => {
		const box = shapeBox(ellipse("body", 0, 1, 2, 0.5));
		expect(box.min).toEqual({ x: 0.5, y: 1.5 });
		expect(box.max).toEqual({ x: 1.5, y: 2.5 });
	});

	it("bounds a subpath over every point it visits", () => {
		const box = shapeBox({
			kind: "subpath",
			start: { x: 0, y: 0 },
			segments: [{ kind: "line", to: { x: 2, y: -1 } }],
			closed: false,
		});
		expect(box.min).toEqual({ x: 0, y: -1 });
		expect(box.max).toEqual({ x: 2, y: 0 });
	});

	// A curve's control points are not on the curve, so a box that includes
	// them is larger than the curve. That is deliberate and the direction
	// matters: a caster that errs large still casts, one that errs small can
	// silently fail to.
	it("never bounds a curve more tightly than the curve", () => {
		const box = shapeBox({
			kind: "subpath",
			start: { x: 0, y: 0 },
			segments: [
				{ kind: "quadratic", control: { x: 1, y: 1 }, to: { x: 2, y: 0 } },
			],
			closed: false,
		});
		expect(box.max.y).toBeGreaterThanOrEqual(0.5);
	});

	// Cubic segments carry TWO control points, both outside the curve itself
	// (unlike quadratic's one). Both must be folded into the box, or a cubic
	// limb's shadow box silently undershoots the curve it is supposed to cover.
	it("bounds a cubic curve by both of its control points, not just one", () => {
		const box = shapeBox({
			kind: "subpath",
			start: { x: 0, y: 0 },
			segments: [
				{
					kind: "cubic",
					control1: { x: 0, y: 3 },
					control2: { x: 2, y: -3 },
					to: { x: 2, y: 0 },
				},
			],
			closed: false,
		});
		expect(box.max.y).toBeGreaterThanOrEqual(3);
		expect(box.min.y).toBeLessThanOrEqual(-3);
	});

	it("survives a shape with a null coordinate", () => {
		const bad = {
			kind: "ellipse",
			center: { x: 0, y: null },
			radiusX: 0.2,
			radiusY: 0.2,
		} as unknown as Shape;
		const box = shapeBox(bad);
		expect(Number.isFinite(box.min.x)).toBe(true);
		expect(Number.isFinite(box.min.y)).toBe(true);
		expect(Number.isFinite(box.max.y)).toBe(true);
	});

	/**
	 * `segments` is typed as a required array on `SubPath`, so a well-typed
	 * caller never triggers the `shape.segments ?? []` fallback. A malformed
	 * subpath missing it entirely — round-tripped through JSON that dropped
	 * an empty array, say — must collapse to a point box at `start` rather
	 * than throwing on `undefined.length`.
	 */
	it("bounds a subpath with no segments array as a single point at start", () => {
		const bad = {
			kind: "subpath",
			start: { x: 3, y: -2 },
			closed: false,
		} as unknown as Shape;
		const box = shapeBox(bad);
		expect(box).toEqual({ min: { x: 3, y: -2 }, max: { x: 3, y: -2 } });
	});
});

describe("box arithmetic", () => {
	const unit = { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } };

	it("measures its own area", () => {
		expect(boxArea(unit)).toBeCloseTo(1, 10);
	});

	it("finds the shared area of two overlapping boxes", () => {
		const other = { min: { x: 0.5, y: 0.5 }, max: { x: 1.5, y: 1.5 } };
		expect(overlapArea(unit, other)).toBeCloseTo(0.25, 10);
	});

	it("reports no overlap for boxes that miss", () => {
		const away = { min: { x: 5, y: 5 }, max: { x: 6, y: 6 } };
		expect(overlapArea(unit, away)).toBe(0);
	});

	// Touching is not overlapping. A shadow that begins the instant two boxes
	// share an edge would make every adjacent part darken its neighbour.
	it("reports no overlap for boxes that merely touch", () => {
		const touching = { min: { x: 1, y: 0 }, max: { x: 2, y: 1 } };
		expect(overlapArea(unit, touching)).toBe(0);
	});

	it("slides a box without resizing it", () => {
		const moved = offsetBox(unit, 2, -3);
		expect(boxArea(moved)).toBeCloseTo(boxArea(unit), 10);
		expect(moved.min).toEqual({ x: 2, y: -3 });
	});
});

describe("occlusion between parts", () => {
	// The core claim. A part directly on top of another covers it, and the one
	// behind must know.
	it("covers a part that a nearer part sits on top of", () => {
		const body = { shape: ellipse("body", 0, 0, 0), depth: 0 };
		const leg = { shape: ellipse("leg", 0, 0, 0), depth: 2 };
		expect(occlusion(body, [body, leg], DEFAULT_LIGHT)).toBeGreaterThan(0);
	});

	// The other half of the claim, and the one that makes it self-shadowing
	// rather than an ambient occlusion term: direction matters. A part behind
	// cannot cast forward.
	it("does not let a far part cast onto a near one", () => {
		const body = { shape: ellipse("body", 0, 0, 0), depth: 0 };
		const leg = { shape: ellipse("leg", 0, 0, 0), depth: 2 };
		expect(occlusion(leg, [body, leg], DEFAULT_LIGHT)).toBe(0);
	});

	it("does not let a part shadow itself", () => {
		const body = { shape: ellipse("body", 0, 0, 0), depth: 0 };
		expect(occlusion(body, [body], DEFAULT_LIGHT)).toBe(0);
	});

	// Equal depth is one plane, and a plane cannot shadow itself. This is why
	// `assemble` gives repetitions of one part distinct bands by tag index.
	it("does not let parts in the same plane shadow each other", () => {
		const a = { shape: ellipse("leg", 0, 0, 0), depth: 1 };
		const b = { shape: ellipse("leg", 1, 0, 0), depth: 1 };
		expect(occlusion(a, [a, b], DEFAULT_LIGHT)).toBe(0);
	});

	it("casts nothing onto a part it does not cover", () => {
		const body = { shape: ellipse("body", 0, 0, 0, 0.2), depth: 0 };
		const far = { shape: ellipse("leg", 0, 9, 9, 0.2), depth: 2 };
		expect(occlusion(body, [body, far], DEFAULT_LIGHT)).toBe(0);
	});

	it("covers more when the caster is larger", () => {
		const body = { shape: ellipse("body", 0, 0, 0, 0.5), depth: 0 };
		const small = { shape: ellipse("leg", 0, 0, 0, 0.1), depth: 1 };
		const large = { shape: ellipse("leg", 0, 0, 0, 0.5), depth: 1 };
		expect(occlusion(body, [body, large], DEFAULT_LIGHT)).toBeGreaterThan(
			occlusion(body, [body, small], DEFAULT_LIGHT),
		);
	});

	it("deepens as more parts pile onto the same place", () => {
		const body = { shape: ellipse("body", 0, 0, 0, 0.5), depth: 0 };
		const one = { shape: ellipse("leg", 0, 0, 0, 0.2), depth: 1 };
		const two = { shape: ellipse("leg", 1, 0.05, 0, 0.2), depth: 1.1 };
		expect(occlusion(body, [body, one, two], DEFAULT_LIGHT)).toBeGreaterThan(
			occlusion(body, [body, one], DEFAULT_LIGHT),
		);
	});

	// Independent occluders, not a sum. Three limbs over one patch must not
	// report more coverage than the patch has.
	it("never reports more than total coverage", () => {
		const body = { shape: ellipse("body", 0, 0, 0, 0.2), depth: 0 };
		const piled = Array.from({ length: 12 }, (_, i) => ({
			shape: ellipse("leg", i, 0, 0, 0.6),
			depth: 1 + i * 0.01,
		}));
		const covered = occlusion(body, [body, ...piled], DEFAULT_LIGHT);
		expect(covered).toBeLessThanOrEqual(1);
		expect(covered).toBeGreaterThan(0);
	});

	// The parallax that sells the depth separation: a limb further in front
	// throws its shadow further across whatever is behind it.
	it("slides the shadow further as the depth gap grows", () => {
		// Placed so the caster's shadow walks OFF the receiver as it slides.
		const body = { shape: ellipse("body", 0, 0, 0, 0.3), depth: 0 };
		const near = { shape: ellipse("leg", 0, 0, 0, 0.3), depth: 0.5 };
		const far = { shape: ellipse("leg", 0, 0, 0, 0.3), depth: 8 };
		expect(occlusion(body, [body, far], DEFAULT_LIGHT)).toBeLessThan(
			occlusion(body, [body, near], DEFAULT_LIGHT),
		);
	});

	it("stays finite when the light direction is degenerate", () => {
		const body = { shape: ellipse("body", 0, 0, 0), depth: 0 };
		const leg = { shape: ellipse("leg", 0, 0, 0), depth: 2 };
		const dead = { direction: { x: 0, y: 0 }, ambient: 0.3 };
		expect(Number.isFinite(occlusion(body, [body, leg], dead))).toBe(true);
	});

	it("stays finite when a shape has a bad coordinate", () => {
		const bad = {
			kind: "ellipse",
			center: { x: Number.NaN, y: 0 },
			radiusX: 0.2,
			radiusY: 0.2,
		} as unknown as Shape;
		const body = { shape: ellipse("body", 0, 0, 0), depth: 0 };
		const result = occlusion(
			body,
			[body, { shape: bad, depth: 2 }],
			DEFAULT_LIGHT,
		);
		expect(Number.isFinite(result)).toBe(true);
	});

	it("reports zero coverage for a receiver whose box has no area", () => {
		// A radius-zero ellipse has a zero-area box, so `area > 0` is false and
		// the function must return early rather than dividing by zero.
		const point = { shape: ellipse("body", 0, 0, 0, 0), depth: 0 };
		const leg = { shape: ellipse("leg", 0, 0, 0), depth: 2 };
		expect(occlusion(point, [point, leg], DEFAULT_LIGHT)).toBe(0);
	});

	/**
	 * Every occlusion test above uses an ellipse for both receiver and
	 * caster, so `casterFill`/`receiverFill` never took their non-ellipse
	 * branch (a factor of 1, unlike an ellipse's pi/4 fill fraction). A limb
	 * drawn from `taper`/`repeat` is a subpath, not an ellipse, and mixing
	 * shape kinds is the ordinary case in a real assembled creature.
	 */
	it("gives a subpath caster full box coverage, unlike an ellipse's partial fill", () => {
		const subpathCaster = {
			shape: {
				kind: "subpath" as const,
				start: { x: -0.5, y: -0.5 },
				segments: [{ kind: "line" as const, to: { x: 0.5, y: 0.5 } }],
				closed: true,
			},
			depth: 2,
		};
		const ellipseCaster = { shape: ellipse("leg", 0, 0, 0, 0.5), depth: 2 };
		const receiver = { shape: ellipse("body", 0, 0, 0, 1), depth: 0 };

		const subpathCoverage = occlusion(
			receiver,
			[receiver, subpathCaster],
			DEFAULT_LIGHT,
		);
		const ellipseCoverage = occlusion(
			receiver,
			[receiver, ellipseCaster],
			DEFAULT_LIGHT,
		);
		expect(subpathCoverage).toBeGreaterThan(ellipseCoverage);
	});

	it("gives a subpath receiver its full box as the area to cover", () => {
		const subpathReceiver = {
			shape: {
				kind: "subpath" as const,
				start: { x: -0.5, y: -0.5 },
				segments: [{ kind: "line" as const, to: { x: 0.5, y: 0.5 } }],
				closed: true,
			},
			depth: 0,
		};
		const caster = { shape: ellipse("leg", 0, 0, 0, 1), depth: 2 };
		const covered = occlusion(
			subpathReceiver,
			[subpathReceiver, caster],
			DEFAULT_LIGHT,
		);
		expect(covered).toBeGreaterThan(0);
		expect(Number.isFinite(covered)).toBe(true);
	});
});

/**
 * The shading curve has to spend its colour range where the variation is.
 *
 * Found by looking at a render, not by an assay: the shipped curve ramped to
 * black over the lower half and only halfway to white over the upper half, so
 * a cast shadow on a lit surface — which is where cast shadows live — moved
 * the colour by about four values of luma and was invisible. Every
 * monotonicity test passed throughout.
 */
describe("the shading curve", () => {
	const BASE = "#8fa8c8";

	const luma = (hex: string): number => {
		const n = (o: number) => Number.parseInt(hex.slice(1 + o, 3 + o), 16);
		return 0.299 * n(0) + 0.587 * n(2) + 0.114 * n(4);
	};

	it("gives the lit half a slope comparable to the shadowed half", () => {
		const dark = luma(shade(BASE, 0.5)) - luma(shade(BASE, 0.1));
		const bright = luma(shade(BASE, 0.9)) - luma(shade(BASE, 0.5));
		// Within a factor of two. The old curve was off by six.
		expect(dark / bright).toBeLessThan(2);
		expect(bright / dark).toBeLessThan(2);
	});

	// The specific case that shipped invisible: a body losing a third of its
	// light must move by an amount a person can actually see.
	it("makes a third of a light level a visible difference", () => {
		expect(luma(shade(BASE, 0.675)) - luma(shade(BASE, 0.45))).toBeGreaterThan(
			8,
		);
	});

	// A creature is a coloured thing in light, not a lamp. Blowing the
	// highlight to white would throw away the pigment derived upstream.
	it("keeps its hue at full light", () => {
		const full = shade(BASE, 1);
		expect(full).not.toBe("#ffffff");
		const r = Number.parseInt(full.slice(1, 3), 16);
		const b = Number.parseInt(full.slice(5, 7), 16);
		// The base is blue-ish; it must still be blue-ish when fully lit.
		expect(b).toBeGreaterThan(r);
	});
});

describe("applying a shadow to a light level", () => {
	it("leaves an uncovered part alone", () => {
		expect(shadowed(0.8, 0)).toBeCloseTo(0.8, 10);
	});

	it("darkens a covered part", () => {
		expect(shadowed(0.8, 1)).toBeLessThan(0.8);
	});

	it("darkens further the more of it is covered", () => {
		expect(shadowed(0.8, 1)).toBeLessThan(shadowed(0.8, 0.5));
	});

	// Ambient's reason applies to cast shadow too: a creature has to stay
	// readable everywhere, so a fully covered part is dark and not black.
	it("never takes a part to black", () => {
		expect(shadowed(0.8, 1)).toBeGreaterThan(0);
	});

	// Multiplicative, not subtractive. A part already facing away must not go
	// doubly dark for being covered as well.
	it("removes a proportion rather than a fixed amount", () => {
		const brightLoss = 0.9 - shadowed(0.9, 1);
		const dimLoss = 0.2 - shadowed(0.2, 1);
		expect(brightLoss).toBeGreaterThan(dimLoss);
	});

	it("refuses to emit NaN", () => {
		expect(Number.isFinite(shadowed(Number.NaN, 0.5))).toBe(true);
		expect(Number.isFinite(shadowed(0.5, Number.NaN))).toBe(true);
	});
});

/**
 * The composed claim, at the level a consumer sees it.
 *
 * These are the ones that would have caught a creature that still looked
 * pasted: they go through `assemble` rather than calling `occlusion` directly.
 */
describe("a creature shades itself", () => {
	const BODY = ellipse("body", 0, 0, 0, 0.5);
	const LEG = ellipse("leg", 0, 0, 0, 0.25);

	it("takes light from a body that a leg lies across", () => {
		const withLeg = assemble([BODY, LEG]);
		const alone = assemble([BODY]);
		const shadedBody = withLeg.find((p) => p.shape === BODY);
		const litBody = alone.find((p) => p.shape === BODY);
		expect(shadedBody?.light).toBeLessThan(litBody?.light ?? 0);
	});

	it("leaves the nearest part unshadowed", () => {
		const parts = assemble([BODY, LEG]);
		expect(parts[parts.length - 1]?.occlusion).toBe(0);
	});

	it("reports the direct term untouched by shadow", () => {
		const withLeg = assemble([BODY, LEG]);
		const alone = assemble([BODY]);
		expect(withLeg.find((p) => p.shape === BODY)?.direct).toBeCloseTo(
			alone.find((p) => p.shape === BODY)?.direct ?? 0,
			10,
		);
	});

	it("keeps every light level in range", () => {
		for (const p of assemble([BODY, LEG, ellipse("crest", 0, -0.2, 0)])) {
			expect(p.light).toBeGreaterThanOrEqual(0);
			expect(p.light).toBeLessThanOrEqual(1);
			expect(p.occlusion).toBeGreaterThanOrEqual(0);
			expect(p.occlusion).toBeLessThanOrEqual(1);
		}
	});

	it("is still deterministic", () => {
		expect(assemble([BODY, LEG])).toEqual(assemble([BODY, LEG]));
	});

	// A creature with no overlapping parts is exactly the flat-shaded case, so
	// self-shadowing must cost it nothing.
	it("changes nothing when no part covers another", () => {
		const spread = [
			ellipse("body", 0, 0, 0, 0.1),
			ellipse("leg", 0, 5, 5, 0.1),
			ellipse("crest", 0, -5, -5, 0.1),
		];
		for (const p of assemble(spread)) {
			expect(p.occlusion).toBe(0);
			expect(p.light).toBeCloseTo(p.direct, 10);
		}
	});
});
