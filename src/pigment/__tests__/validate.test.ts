import { normalise } from "../../chem/index.js";
import { describe, expect, it } from "vitest";
import { NO_DIET_HISTORY, recordMeal } from "../dietHistory.js";
import { paletteRamp } from "../palette.js";
import { derivePigments } from "../pigments.js";

/**
 * The assay for a bug that shipped.
 *
 * `lifecycle-pigment@0.1.0` went to the registry returning `null` where its
 * own types promise `number`, and throwing a `TypeError` from inside a colour
 * function. Every unit test in this package passed the whole time, because
 * every one of them called the functions correctly.
 *
 * That is the gap these tests close: the failure mode of a shared library is
 * not "the maths is wrong", it is "a consumer who did not write it passed
 * something slightly wrong and got a plausible-looking number back". So these
 * assert the behaviour on BAD input, which is the input the library does not
 * control.
 */

const COMPOSITION = normalise({ protein: 0.5, chitin: 0.3, lipid: 0.2 });
const DIET = { plantAverage: 0.8, meals: 12 };
const INPUTS = { uvExposure: 0.6, genetics: 0.5 };
const SURFACE = { metallic: 0.1, roughness: 0.7, opacity: 1 };

describe("derivePigments rejects what it cannot use", () => {
	/**
	 * The exact defect. `Math.max(0, undefined)` is NaN, so the old clamp
	 * turned a missing `genetics` into `melanin: NaN` and `pterin: NaN` —
	 * serialising as `null` — from a function whose return type says `number`.
	 */
	it("never returns a non-finite concentration", () => {
		const pigments = derivePigments(COMPOSITION, DIET, INPUTS);
		for (const [name, value] of Object.entries(pigments)) {
			expect(Number.isFinite(value), `${name} must be finite`).toBe(true);
		}
	});

	it("throws by name when genetics is missing", () => {
		expect(() =>
			derivePigments(COMPOSITION, DIET, {
				uvExposure: 0.6,
			} as unknown as typeof INPUTS),
		).toThrow(/derivePigments: inputs\.genetics/);
	});

	it("throws by name when uvExposure is missing", () => {
		expect(() =>
			derivePigments(COMPOSITION, DIET, {
				genetics: 0.5,
			} as unknown as typeof INPUTS),
		).toThrow(/derivePigments: inputs\.uvExposure/);
	});

	/**
	 * Out of range is rejected, not silently clamped. A `uvExposure` of 12 is
	 * a caller working in different units, and clamping hides that for as long
	 * as the mistake survives.
	 */
	it("rejects an out-of-range exposure rather than clamping it", () => {
		expect(() =>
			derivePigments(COMPOSITION, DIET, { uvExposure: 12, genetics: 0.5 }),
		).toThrow(/must be between 0 and 1, got 12/);
		expect(() =>
			derivePigments(COMPOSITION, DIET, { uvExposure: -1, genetics: 0.5 }),
		).toThrow(/must be between 0 and 1/);
	});

	it("rejects a NaN that a caller computed upstream", () => {
		expect(() =>
			derivePigments(COMPOSITION, DIET, {
				uvExposure: Number.NaN,
				genetics: 0.5,
			}),
		).toThrow(/must be a finite number, got number NaN/);
	});

	it("names the missing argument rather than failing on a property read", () => {
		expect(() =>
			derivePigments(COMPOSITION, DIET, undefined as unknown as typeof INPUTS),
		).toThrow(/derivePigments: inputs must be an object, got undefined/);
	});

	it("rejects a diet whose average is not a number", () => {
		expect(() =>
			derivePigments(
				COMPOSITION,
				{ plantAverage: undefined, meals: 3 } as unknown as typeof DIET,
				INPUTS,
			),
		).toThrow(/derivePigments: diet\.plantAverage/);
	});
});

describe("paletteRamp survives a pigment object it did not build", () => {
	/**
	 * The crash this audit actually hit. The old loop walked the caller's
	 * object and asserted its keys were known, so an extra key indexed the
	 * tint table to `undefined` and threw `Cannot read properties of
	 * undefined` from inside a colour function.
	 */
	it("ignores an unknown pigment key instead of throwing", () => {
		const pigments = derivePigments(COMPOSITION, DIET, INPUTS);
		const ramp = paletteRamp(
			COMPOSITION,
			{ ...pigments, bilirubin: 0.9 } as unknown as typeof pigments,
			SURFACE,
		);
		expect(ramp.pigment).toMatch(/^#[0-9a-f]{6}$/);
		expect(ramp).toEqual(paletteRamp(COMPOSITION, pigments, SURFACE));
	});

	/** Every stop must be a real colour — this is what assemblage draws with. */
	it("emits four well-formed hex stops", () => {
		const ramp = paletteRamp(
			COMPOSITION,
			derivePigments(COMPOSITION, DIET, INPUTS),
			SURFACE,
		);
		for (const stop of ["shadow", "base", "pigment", "highlight"] as const) {
			expect(ramp[stop], stop).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	/**
	 * The "#NaNNaNNaN" failure, named in `lifecycle-forms`'s validate.ts,
	 * reached the renderer from a package like this one. It must be impossible
	 * to construct a ramp containing one.
	 */
	it("cannot produce a NaN colour from a bad concentration", () => {
		expect(() =>
			paletteRamp(
				COMPOSITION,
				{
					melanin: Number.NaN,
					carotenoid: 0.5,
					pterin: 0.1,
					purine: 0.4,
					porphyrin: 0.3,
				},
				SURFACE,
			),
		).toThrow(/paletteRamp: pigments\.melanin/);
	});

	it("rejects a non-finite surface property", () => {
		expect(() =>
			paletteRamp(COMPOSITION, derivePigments(COMPOSITION, DIET, INPUTS), {
				metallic: 0.1,
				roughness: undefined,
				opacity: 1,
			} as unknown as typeof SURFACE),
		).toThrow(/paletteRamp: surface\.roughness/);
	});
});

/**
 * The "got ..." clause has a branch for an array and a branch for a plain
 * object, distinct from "number" and "undefined". Every test above only ever
 * passed a number, undefined, or NaN — never an array or object standing in
 * for a number, which is what happens when a caller threads a whole options
 * bag through where one field was expected.
 */
describe("bad-argument messages name arrays and objects specifically", () => {
	it("names an array rather than calling it 'object'", () => {
		expect(() =>
			derivePigments(COMPOSITION, DIET, {
				uvExposure: [0.5] as unknown as number,
				genetics: 0.5,
			}),
		).toThrow(/must be a finite number, got an array/);
	});

	it("names an object's own keys", () => {
		expect(() =>
			derivePigments(COMPOSITION, DIET, {
				uvExposure: { value: 0.5 } as unknown as number,
				genetics: 0.5,
			}),
		).toThrow(/must be a finite number, got an object \(value\)/);
	});

	/**
	 * `typeof null === "object"`, so `describe`'s null check has to run
	 * before its object check or `null` would print as an object with no
	 * keys — a strictly worse message for the single most common bad-argument
	 * case: an unset field on a real record.
	 */
	it("names null distinctly from an object with no keys", () => {
		expect(() =>
			derivePigments(COMPOSITION, DIET, {
				uvExposure: null as unknown as number,
				genetics: 0.5,
			}),
		).toThrow(/must be a finite number, got null/);
	});
});

describe("recordMeal cannot be poisoned", () => {
	/**
	 * The average IS the state, so one NaN meal makes `plantAverage` NaN
	 * forever and no later meal can recover it. This is the worst version of
	 * the bug in this package, and the reason the check is at the boundary
	 * rather than at read time.
	 */
	it("refuses a meal that would poison the average permanently", () => {
		expect(() =>
			recordMeal(NO_DIET_HISTORY, undefined as unknown as number),
		).toThrow(/recordMeal: plantFraction/);
		expect(() => recordMeal(NO_DIET_HISTORY, Number.NaN)).toThrow(
			/recordMeal: plantFraction/,
		);
	});

	it("refuses a history that is already corrupt", () => {
		expect(() =>
			recordMeal({ plantAverage: Number.NaN, meals: 3 }, 0.5),
		).toThrow(/recordMeal: history\.plantAverage/);
		expect(() => recordMeal({ plantAverage: 0.5, meals: 1.5 }, 0.5)).toThrow(
			/recordMeal: history\.meals must be a non-negative whole number/,
		);
	});

	/** A long run of real meals must stay finite and in range throughout. */
	it("stays finite and in range across many meals", () => {
		let history = NO_DIET_HISTORY;
		for (let i = 0; i < 200; i++) {
			history = recordMeal(history, (i % 11) / 10);
			expect(Number.isFinite(history.plantAverage)).toBe(true);
			expect(history.plantAverage).toBeGreaterThanOrEqual(0);
			expect(history.plantAverage).toBeLessThanOrEqual(1);
		}
		expect(history.meals).toBe(200);
	});
});
