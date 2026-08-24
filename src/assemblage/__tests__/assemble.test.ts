import type { Shape } from "../../forms/index.js";
import { describe, expect, it } from "vitest";
import { assemble, DEFAULT_LIGHT, litness, shade } from "../assemble.js";

/**
 * Assembly is what stops parts reading as stickers.
 *
 * `lifecycle-forms` emits outlines tagged with the part they belong to. It
 * says nothing about depth, light or colour, deliberately — a `taper` rule
 * that picked a fill would be an art director. This package is where a flat
 * list of tagged outlines becomes something that looks GROWN: parts sit in
 * depth bands, a directional light falls across them, and the ones in front
 * shade the ones behind.
 *
 * Everything here is a pure function of geometry and a light, so it is
 * asserted numerically rather than by screenshot.
 */

function shapeAt(part: string, index: number, x: number, y: number): Shape {
	return {
		kind: "ellipse",
		center: { x, y },
		radiusX: 0.2,
		radiusY: 0.2,
		tag: { part, index },
	};
}

const BODY = shapeAt("body", 0, 0, 0);
const LEG_LEFT = shapeAt("leg", 0, 0, -0.4);
const LEG_RIGHT = shapeAt("leg", 1, 0, 0.4);

describe("assembling a creature", () => {
	it("keeps every shape it was given", () => {
		const parts = assemble([BODY, LEG_LEFT, LEG_RIGHT]);
		expect(parts).toHaveLength(3);
	});

	it("gives every part a depth", () => {
		for (const p of assemble([BODY, LEG_LEFT, LEG_RIGHT])) {
			expect(Number.isFinite(p.depth)).toBe(true);
		}
	});

	// The whole point of PartTag carrying an index: repetitions of the same
	// part occupy different bands, so the near ones occlude the far ones
	// instead of all landing in one flat plane.
	it("separates repetitions of the same part in depth", () => {
		const parts = assemble([LEG_LEFT, LEG_RIGHT]);
		expect(parts[0]?.depth).not.toBe(parts[1]?.depth);
	});

	it("puts different parts in different bands", () => {
		const parts = assemble([BODY, LEG_LEFT]);
		expect(parts[0]?.depth).not.toBe(parts[1]?.depth);
	});

	// Draw order has to follow depth or the near parts end up behind.
	it("orders parts back to front", () => {
		const parts = assemble([LEG_RIGHT, BODY, LEG_LEFT]);
		const depths = parts.map((p) => p.depth);
		expect([...depths].sort((a, b) => a - b)).toEqual(depths);
	});

	it("is deterministic", () => {
		expect(assemble([BODY, LEG_LEFT])).toEqual(assemble([BODY, LEG_LEFT]));
	});

	it("assembles nothing from nothing", () => {
		expect(assemble([])).toEqual([]);
	});
});

describe("light", () => {
	// A directional light means the side facing it is brighter. Without this
	// a creature is a flat silhouette and depth bands buy nothing.
	it("lights the side facing the source more brightly", () => {
		const lit = litness({ x: -1, y: -1 }, DEFAULT_LIGHT);
		const away = litness({ x: 1, y: 1 }, DEFAULT_LIGHT);
		expect(lit).toBeGreaterThan(away);
	});

	it("stays within bounds", () => {
		for (const x of [-2, -1, 0, 1, 2]) {
			const v = litness({ x, y: x }, DEFAULT_LIGHT);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(1);
		}
	});

	it("does not vary along the light's own axis", () => {
		const light = { direction: { x: 1, y: 0 }, ambient: 0.3 };
		expect(litness({ x: 0, y: -1 }, light)).toBeCloseTo(
			litness({ x: 0, y: 1 }, light),
			6,
		);
	});

	// Ambient is what stops the unlit side being a black hole. A creature has
	// to stay readable everywhere, which is a design constraint rather than a
	// physical one.
	it("never lets the far side go fully dark", () => {
		expect(litness({ x: 1, y: 1 }, DEFAULT_LIGHT)).toBeGreaterThan(0);
	});
});

describe("shading a colour", () => {
	const BASE = "#8899aa";

	it("returns a colour a renderer can use", () => {
		expect(shade(BASE, 0.5)).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it("brightens toward the light", () => {
		expect(shade(BASE, 1)).not.toBe(shade(BASE, 0.2));
	});

	it("is monotonic", () => {
		const dark = Number.parseInt(shade(BASE, 0.1).slice(1), 16);
		const mid = Number.parseInt(shade(BASE, 0.5).slice(1), 16);
		const bright = Number.parseInt(shade(BASE, 0.9).slice(1), 16);
		expect(mid).toBeGreaterThan(dark);
		expect(bright).toBeGreaterThan(mid);
	});

	it("never leaves the representable range", () => {
		for (const l of [-1, 0, 0.5, 1, 2]) {
			expect(shade("#ffffff", l)).toMatch(/^#[0-9a-f]{6}$/i);
			expect(shade("#000000", l)).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});
});

/**
 * A malformed shape must not poison the whole creature.
 *
 * Found by composing the real packages rather than by unit tests: calling a
 * rule with the wrong argument shape produced a point with a null coordinate,
 * which propagated silently through the light arithmetic to NaN and out to
 * "#NaNNaNNaN" as a fill. A creature vanishing because one coordinate was bad
 * is exactly the class of failure that passes every test and looks like a
 * rendering bug.
 */
describe("bad geometry", () => {
	const bad = (point: unknown): Shape =>
		({
			kind: "ellipse",
			center: point,
			radiusX: 0.2,
			radiusY: 0.2,
			tag: { part: "body", index: 0 },
		}) as Shape;

	it("does not produce NaN light from a null coordinate", () => {
		const [part] = assemble([bad({ x: 0, y: null })]);
		expect(Number.isFinite(part?.light)).toBe(true);
	});

	it("does not produce NaN light from a missing coordinate", () => {
		const [part] = assemble([bad({ x: 0.5 })]);
		expect(Number.isFinite(part?.light)).toBe(true);
	});

	it("always shades to a usable colour", () => {
		const [part] = assemble([bad({ x: Number.NaN, y: 0 })]);
		expect(shade("#8899aa", part?.light ?? 0)).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it("refuses to emit a colour containing NaN", () => {
		expect(shade("#8899aa", Number.NaN)).toMatch(/^#[0-9a-f]{6}$/i);
	});
});
