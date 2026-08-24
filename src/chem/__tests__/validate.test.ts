import { describe, expect, it } from "vitest";
import { inBackbone } from "../biochemistry.js";
import { compositionColor, EMPTY_COMPOSITION, normalise } from "../biomolecules.js";

/**
 * The assay for this package's most-cited bug, at its source.
 *
 * `lifecycle-forms/src/validate.ts` opens by describing a "#NaNNaNNaN" fill
 * that reached `lifecycle-assemblage`, made a creature vanish three packages
 * away from the mistake, and passed every unit test in both packages the
 * whole time. That exact string was produced here, by `compositionColor`, and
 * nothing in this package tested for it — because every existing test passed
 * a well-formed composition.
 *
 * `Composition` is the pivot type the entire downstream pipeline consumes, so
 * a NaN admitted here is a NaN in the drawn creature.
 */

describe("compositionColor cannot emit a NaN colour", () => {
	/** The literal regression. This string must never be returned again. */
	it("never returns the #NaNNaNNaN that made creatures vanish", () => {
		expect(() => compositionColor({ ...EMPTY_COMPOSITION, protein: Number.NaN })).toThrow(
			/compositionColor: c\.protein must be a finite number/,
		);
	});

	/**
	 * Why the old guard failed. The loop skipped a tissue with
	 * `if (frac <= 0) continue`, and every comparison against NaN is false, so
	 * `NaN <= 0` did not exclude it. A lower-bound filter is not a finiteness
	 * check, and this test exists to stop anyone reintroducing one.
	 */
	it("is not fooled by a lower-bound filter, because NaN <= 0 is false", () => {
		// Demonstrated through a variable so the linter's "use Number.isNaN"
		// rule does not rewrite this into `Number.isNaN(0)`, which would assert
		// something entirely different and quietly gut the test.
		const notANumber = Number.NaN;
		expect(notANumber <= 0).toBe(false);
		expect(notANumber > 0).toBe(false);
		expect(() => compositionColor({ ...EMPTY_COMPOSITION, chitin: Number.NaN })).toThrow(
			/c\.chitin/,
		);
	});

	it("rejects Infinity and a negative fraction", () => {
		expect(() =>
			compositionColor({
				...EMPTY_COMPOSITION,
				lipid: Number.POSITIVE_INFINITY,
			}),
		).toThrow(/must be a finite number/);
		expect(() => compositionColor({ ...EMPTY_COMPOSITION, lipid: -0.5 })).toThrow(
			/c\.lipid cannot be negative/,
		);
	});

	it("names the function and argument when handed nothing", () => {
		expect(() => compositionColor(undefined as unknown as typeof EMPTY_COMPOSITION)).toThrow(
			/compositionColor: c must be an object, got undefined/,
		);
	});

	it("still returns a real colour for a real composition", () => {
		const hex = compositionColor(normalise({ ...EMPTY_COMPOSITION, protein: 0.5, chitin: 0.5 }));
		expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
		expect(hex).not.toContain("NaN");
	});
});

describe("normalise cannot be destroyed by one bad tissue", () => {
	/**
	 * The second mechanism. The total is a `reduce((a, b) => a + b)`, so one
	 * NaN member made the total NaN, which made EVERY output field NaN — a
	 * single bad tissue silently destroying the whole composition rather than
	 * just its own entry.
	 */
	it("rejects a single NaN member instead of nulling every field", () => {
		expect(() => normalise({ ...EMPTY_COMPOSITION, protein: Number.NaN })).toThrow(
			/normalise: raw\.protein must be a finite number/,
		);
	});

	it("rejects a negative fraction rather than normalising it", () => {
		expect(() => normalise({ ...EMPTY_COMPOSITION, sugar: -1 })).toThrow(
			/normalise: raw\.sugar cannot be negative/,
		);
	});

	it("names the argument when handed nothing", () => {
		expect(() => normalise(undefined as unknown as typeof EMPTY_COMPOSITION)).toThrow(
			/normalise: raw must be an object, got undefined/,
		);
	});

	it("rejects an array even though JavaScript reports it as an object", () => {
		expect(() => normalise([] as unknown as typeof EMPTY_COMPOSITION)).toThrow(
			/normalise: raw must be an object, got an array/,
		);
	});

	/** The documented all-zero behaviour is untouched. */
	it("still returns all-sugar for an empty composition", () => {
		expect(normalise({ ...EMPTY_COMPOSITION })).toEqual({
			...EMPTY_COMPOSITION,
			sugar: 1,
		});
	});

	it("still sums to one for a real composition", () => {
		const out = normalise({
			...EMPTY_COMPOSITION,
			protein: 2,
			lipid: 1,
			chitin: 1,
		});
		const total = Object.values(out).reduce((a, b) => a + b, 0);
		expect(total).toBeCloseTo(1, 12);
		expect(Object.values(out).every(Number.isFinite)).toBe(true);
	});
});

/**
 * The "got ..." clause on every message above has a branch for an array and
 * a branch for a plain object, distinct from "number" and "undefined" — and
 * every existing test only ever passed a number or omitted the argument.
 * Passing a whole options-shaped object where a single fraction was expected
 * is a realistic caller mistake, and it deserves the more specific wording.
 */
describe("bad-argument messages name arrays and objects specifically", () => {
	it("names an array rather than calling it 'object'", () => {
		expect(() =>
			compositionColor({
				...EMPTY_COMPOSITION,
				protein: [1] as unknown as number,
			}),
		).toThrow(/must be a finite number, got an array/);
	});

	it("names an object's own keys", () => {
		expect(() =>
			compositionColor({
				...EMPTY_COMPOSITION,
				protein: { value: 1 } as unknown as number,
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
			compositionColor({
				...EMPTY_COMPOSITION,
				protein: null as unknown as number,
			}),
		).toThrow(/must be a finite number, got null/);
	});
});

describe("inBackbone cannot pass a NaN atom count through", () => {
	it("rejects a non-finite count", () => {
		expect(() => inBackbone({ C: Number.NaN, H: 2 }, "C")).toThrow(
			/inBackbone: template\.C must be a finite number/,
		);
	});

	it("still maps X to the world's backbone", () => {
		expect(inBackbone({ X: 6, H: 12, O: 6 }, "Si")).toEqual({
			Si: 6,
			H: 12,
			O: 6,
		});
	});
});
