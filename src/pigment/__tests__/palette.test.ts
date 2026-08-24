import { EMPTY_COMPOSITION } from "../../chem/index.js";
import { describe, expect, it } from "vitest";
import { paletteRamp } from "../palette";
import { derivePigments, type PigmentConcentrations } from "../pigments";

const NEUTRAL_SURFACE = { metallic: 0.2, roughness: 0.5, opacity: 1 };
const NO_PIGMENT: PigmentConcentrations = {
	melanin: 0,
	carotenoid: 0,
	pterin: 0,
	purine: 0,
	porphyrin: 0,
};

function hue(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace("#", "");
	return {
		r: Number.parseInt(clean.slice(0, 2), 16),
		g: Number.parseInt(clean.slice(2, 4), 16),
		b: Number.parseInt(clean.slice(4, 6), 16),
	};
}

/** "Warmer" — red channel further ahead of blue. */
function warmth(hex: string): number {
	const { r, b } = hue(hex);
	return r - b;
}

describe("paletteRamp", () => {
	// REQUIRED ASSAY: a carotenoid-rich diet must produce a measurably warmer
	// hue. Carotenoid tints toward orange (232, 122, 26) — high red, low blue
	// — so its "pigment" stop must read warmer than an unpigmented one.
	it("makes a carotenoid-rich diet produce a measurably warmer hue", () => {
		const unpigmented = paletteRamp(
			EMPTY_COMPOSITION,
			NO_PIGMENT,
			NEUTRAL_SURFACE,
		);
		const carotenoidRich = paletteRamp(
			EMPTY_COMPOSITION,
			{ ...NO_PIGMENT, carotenoid: 1 },
			NEUTRAL_SURFACE,
		);
		expect(warmth(carotenoidRich.pigment)).toBeGreaterThan(
			warmth(unpigmented.pigment),
		);
	});

	// REQUIRED ASSAY: melanin must track UV exposure. Round-trips through the
	// full pigment -> palette pipeline, not just derivePigments in isolation.
	it("darkens the pigment stop as UV-driven melanin rises", () => {
		const lowUv = derivePigments(
			{ ...EMPTY_COMPOSITION, keratin: 1 },
			{ plantAverage: 0, meals: 0 },
			{ uvExposure: 0, genetics: 0 },
		);
		const highUv = derivePigments(
			{ ...EMPTY_COMPOSITION, keratin: 1 },
			{ plantAverage: 0, meals: 0 },
			{ uvExposure: 1, genetics: 0 },
		);
		const lowRamp = paletteRamp(EMPTY_COMPOSITION, lowUv, NEUTRAL_SURFACE);
		const highRamp = paletteRamp(EMPTY_COMPOSITION, highUv, NEUTRAL_SURFACE);

		const brightness = (hex: string) => {
			const { r, g, b } = hue(hex);
			return r + g + b;
		};
		expect(brightness(highRamp.pigment)).toBeLessThan(
			brightness(lowRamp.pigment),
		);
	});

	it("produces a genuine ramp, not a single tint", () => {
		const ramp = paletteRamp(
			{ ...EMPTY_COMPOSITION, keratin: 1 },
			{ ...NO_PIGMENT, melanin: 0.6 },
			NEUTRAL_SURFACE,
		);
		expect(ramp.shadow).not.toBe(ramp.base);
		expect(ramp.base).not.toBe(ramp.pigment);
		expect(ramp.pigment).not.toBe(ramp.highlight);
		expect(ramp.shadow).not.toBe(ramp.highlight);
	});

	it("orders shadow darker than highlight", () => {
		const ramp = paletteRamp(
			{ ...EMPTY_COMPOSITION, protein: 1 },
			{ ...NO_PIGMENT, porphyrin: 0.5 },
			NEUTRAL_SURFACE,
		);
		const sum = (hex: string) => {
			const { r, g, b } = hue(hex);
			return r + g + b;
		};
		expect(sum(ramp.shadow)).toBeLessThan(sum(ramp.pigment));
		expect(sum(ramp.highlight)).toBeGreaterThan(sum(ramp.pigment));
	});

	it("carries in-range surface PBR values through unchanged", () => {
		const ramp = paletteRamp(EMPTY_COMPOSITION, NO_PIGMENT, {
			metallic: 1,
			roughness: 0,
			opacity: 0.4,
		});
		expect(ramp.metallic).toBe(1);
		expect(ramp.roughness).toBe(0);
		expect(ramp.opacity).toBeCloseTo(0.4, 6);
	});

	/**
	 * REVISED: this used to assert that an out-of-range surface value was
	 * silently clamped. It now asserts the opposite, and the reversal is the
	 * point.
	 *
	 * Clamping answers "is this in range" while quietly accepting values that
	 * are in the wrong UNITS — a `metallic` of 1.5 is not a request for extra
	 * gloss, it is a caller who thinks the scale is 0..255 or 0..100, and
	 * clamping hides that for as long as the mistake survives. The same
	 * instinct is what let `Math.max(0, undefined)` produce a NaN that shipped
	 * to the registry and only surfaced when these packages were finally
	 * composed. A wrong value must not be the quiet one.
	 */
	it("rejects an out-of-range surface value rather than clamping it", () => {
		expect(() =>
			paletteRamp(EMPTY_COMPOSITION, NO_PIGMENT, {
				metallic: 1.5,
				roughness: 0.5,
				opacity: 1,
			}),
		).toThrow(
			/paletteRamp: surface\.metallic must be between 0 and 1, got 1\.5/,
		);

		expect(() =>
			paletteRamp(EMPTY_COMPOSITION, NO_PIGMENT, {
				metallic: 0.5,
				roughness: -0.2,
				opacity: 1,
			}),
		).toThrow(/paletteRamp: surface\.roughness/);
	});

	it("returns valid hex colours for every stop", () => {
		const ramp = paletteRamp(
			{ ...EMPTY_COMPOSITION, chitin: 1 },
			{ ...NO_PIGMENT, purine: 0.7 },
			NEUTRAL_SURFACE,
		);
		for (const stop of [ramp.shadow, ramp.base, ramp.pigment, ramp.highlight]) {
			expect(stop).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});
});
