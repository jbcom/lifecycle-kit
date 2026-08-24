import { describe, expect, it } from "vitest";
import { CATENATION, ELEMENTS, HYDROLYSIS, molecularMass, scarcity } from "../elements";

/**
 * `elements.ts` had never had a test file of its own. Everything in it is
 * exported from the package's `./chem` public entry point — `molecularMass`
 * and `scarcity` are also the two functions `unitMass` and `growthCost` in
 * `biomolecules.ts` forward to — but every existing assertion on them went
 * through those wrappers with real, well-formed biomolecule formulas. Neither
 * function's own edge cases (an unknown symbol, an empty formula) had ever
 * been exercised, and the underlying tables (`ELEMENTS`, `CATENATION`,
 * `HYDROLYSIS`) were only ever read incidentally.
 */

describe("ELEMENTS table", () => {
	it("keys every entry by its own symbol", () => {
		for (const [key, el] of Object.entries(ELEMENTS)) {
			expect(el.symbol).toBe(key);
		}
	});

	it("gives every element a positive mass and a valid CPK colour", () => {
		for (const el of Object.values(ELEMENTS)) {
			expect(el.mass).toBeGreaterThan(0);
			expect(el.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
		}
	});

	it("keeps abundance a positive fraction, since it is used as a log argument", () => {
		for (const el of Object.values(ELEMENTS)) {
			expect(el.abundance).toBeGreaterThan(0);
		}
	});

	// The header's own claim: this is the biologically dominant set.
	it("includes the elements biomass is overwhelmingly made of", () => {
		for (const symbol of ["H", "C", "N", "O", "P", "S"]) {
			expect(ELEMENTS[symbol]).toBeDefined();
		}
	});
});

describe("CATENATION and HYDROLYSIS tables", () => {
	it("ranks carbon's self-bond energy above silicon's, per the documented physics", () => {
		expect(CATENATION.C).toBeGreaterThan(CATENATION.Si as number);
	});

	it("only marks silicon as water-vulnerable, since carbon chains do not hydrolyse", () => {
		expect(HYDROLYSIS.Si).toBeGreaterThan(0);
		expect(HYDROLYSIS.C ?? 0).toBe(0);
	});
});

describe("molecularMass", () => {
	it("sums atomic mass times count for a real formula", () => {
		// Water: 2 H + 1 O.
		const mass = molecularMass({ H: 2, O: 1 });
		const expected =
			(ELEMENTS.H as (typeof ELEMENTS)[string]).mass * 2 +
			(ELEMENTS.O as (typeof ELEMENTS)[string]).mass;
		expect(mass).toBeCloseTo(expected, 6);
	});

	it("is zero for an empty formula", () => {
		expect(molecularMass({})).toBe(0);
	});

	/**
	 * The table stops at chlorine by design (see the file header) — a formula
	 * naming an element outside it must not throw or silently produce NaN, it
	 * must simply not count toward the mass. This is the one behaviour that
	 * distinguishes `molecularMass` from a naive `Object.entries` sum.
	 */
	it("ignores a symbol the table does not know, rather than producing NaN", () => {
		const known = molecularMass({ C: 6 });
		const withUnknown = molecularMass({ C: 6, Xx: 4 });
		expect(withUnknown).toBe(known);
		expect(Number.isFinite(withUnknown)).toBe(true);
	});

	it("rejects non-finite and negative atom counts at the formula boundary", () => {
		expect(() => molecularMass({ H: Number.NaN })).toThrow(
			/molecularMass: counts\.H must be a finite number/,
		);
		expect(() => molecularMass({ O: -1 })).toThrow(/molecularMass: counts\.O cannot be negative/);
	});

	it("names a missing or array-shaped formula instead of leaking Object.entries errors", () => {
		expect(() => molecularMass(undefined as unknown as Record<string, number>)).toThrow(
			/molecularMass: counts must be an object, got undefined/,
		);
		expect(() => molecularMass([1] as unknown as Record<string, number>)).toThrow(
			/molecularMass: counts must be an object, got an array/,
		);
	});
});

describe("scarcity", () => {
	it("is zero for an empty formula rather than dividing by zero atoms into NaN", () => {
		expect(scarcity({})).toBe(0);
	});

	// Phosphorus is roughly five orders of magnitude rarer than oxygen per the
	// biomolecules.ts header — a phosphorus-bearing formula must cost more.
	it("scores a phosphorus-bearing formula as scarcer than an oxygen-only one of the same size", () => {
		expect(scarcity({ P: 1 })).toBeGreaterThan(scarcity({ O: 1 }));
	});

	it("ignores an unknown symbol instead of letting it corrupt the average", () => {
		const known = scarcity({ C: 6, O: 6 });
		const withUnknown = scarcity({ C: 6, O: 6, Xx: 100 });
		expect(withUnknown).toBe(known);
	});

	it("stays finite and non-negative for a real biological formula", () => {
		const s = scarcity({ C: 6, H: 12, O: 6 });
		expect(Number.isFinite(s)).toBe(true);
		expect(s).toBeGreaterThanOrEqual(0);
	});

	it("rejects invalid counts instead of returning NaN or negative scarcity", () => {
		expect(() => scarcity({ C: Number.POSITIVE_INFINITY })).toThrow(
			/scarcity: counts\.C must be a finite number/,
		);
		expect(() => scarcity({ C: -1 })).toThrow(/scarcity: counts\.C cannot be negative/);
	});
});
