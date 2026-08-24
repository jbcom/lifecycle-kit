import { describe, expect, it } from "vitest";
import {
	ageAtFirstReproduction,
	clutchSize,
	costOfTransport,
	encephalizationQuotient,
	expectedBrainMass,
	gutRetentionTime,
	maxGroupSize,
	populationDensity,
	vonBertalanffyMass,
} from "../lifeHistory.js";

/**
 * The assay for input these laws cannot legally be evaluated on.
 *
 * `lifecycle-bio-laws@0.1.2` shipped returning `null` from every law for a
 * NaN argument, and accepting negative masses that produced either `null` or
 * — worse — a confident wrong answer. Every existing test passed, because
 * every one of them supplied a plausible organism.
 *
 * These are allometric power laws fitted to real measured animals. `x ** 0.75`
 * is NaN for negative x, because a negative base to a fractional exponent has
 * no real root. So the laws refuse rather than evaluate outside their domain,
 * which is the same standard "a law without an assay is unverified" already
 * holds them to.
 */

/** Every single-mass law, so none can be added later without a check. */
const MASS_LAWS: ReadonlyArray<[string, (m: number) => number]> = [
	["populationDensity", populationDensity],
	["expectedBrainMass", expectedBrainMass],
	["gutRetentionTime", gutRetentionTime],
	["maxGroupSize", maxGroupSize],
	["ageAtFirstReproduction", ageAtFirstReproduction],
	["costOfTransport.swimming", costOfTransport.swimming],
	["costOfTransport.flying", costOfTransport.flying],
	["costOfTransport.running", costOfTransport.running],
	["costOfTransport.burrowing", costOfTransport.burrowing],
];

describe("no law returns a non-finite number", () => {
	it.each(MASS_LAWS)("%s rejects NaN rather than returning null", (name, f) => {
		expect(() => f(Number.NaN)).toThrow(
			new RegExp(`${name.replace(".", "\\.")}: .* must be a finite number`),
		);
	});

	it.each(MASS_LAWS)("%s rejects Infinity", (_name, f) => {
		expect(() => f(Number.POSITIVE_INFINITY)).toThrow(/finite number/);
	});

	it.each(MASS_LAWS)("%s rejects undefined", (_name, f) => {
		expect(() => f(undefined as unknown as number)).toThrow(
			/must be a finite number, got undefined/,
		);
	});

	/**
	 * The serious one. `(-5) ** 0.75` is NaN, so most of these silently
	 * returned null — and `ageAtFirstReproduction(-5)` returned -1.25, a
	 * negative age, which nothing downstream would think to question.
	 */
	it.each(MASS_LAWS)("%s rejects a negative quantity", (_name, f) => {
		expect(() => f(-5)).toThrow(/cannot be negative, got -5/);
	});

	/** Zero is a real boundary, not an error — each law defines what it means. */
	it.each(MASS_LAWS)("%s accepts zero and stays finite", (_name, f) => {
		const result = f(0);
		expect(Number.isFinite(result)).toBe(true);
	});

	/** And a real organism still gets a real answer. */
	it.each(MASS_LAWS)("%s returns a finite number for a real mass", (_n, f) => {
		expect(Number.isFinite(f(70))).toBe(true);
	});
});

describe("multi-argument laws check every argument", () => {
	it("clutchSize rejects a negative parent or offspring mass", () => {
		expect(() => clutchSize(-1, 0.5)).toThrow(
			/clutchSize: parentMass cannot be negative/,
		);
		expect(() => clutchSize(10, -0.5)).toThrow(
			/clutchSize: offspringMass cannot be negative/,
		);
		expect(() => clutchSize(Number.NaN, 0.5)).toThrow(/parentMass/);
	});

	it("encephalizationQuotient rejects a negative brain or body mass", () => {
		expect(() => encephalizationQuotient(-1, 70)).toThrow(
			/encephalizationQuotient: brainMassKg cannot be negative/,
		);
		expect(() => encephalizationQuotient(1.4, -70)).toThrow(
			/encephalizationQuotient: bodyMassKg cannot be negative/,
		);
	});

	it("vonBertalanffyMass rejects a negative age, mass or rate", () => {
		expect(() => vonBertalanffyMass(-1, 100, 0.5)).toThrow(
			/vonBertalanffyMass: age cannot be negative/,
		);
		expect(() => vonBertalanffyMass(1, -100, 0.5)).toThrow(/maxMass/);
		expect(() => vonBertalanffyMass(1, 100, -0.5)).toThrow(/growthRate/);
		expect(() => vonBertalanffyMass(1, 100, 0.5, Number.NaN)).toThrow(/t0/);
	});

	/**
	 * t0 may legitimately be negative — it is an offset on the time axis, not
	 * a physical quantity — so it is only checked for finiteness.
	 */
	it("vonBertalanffyMass allows a negative t0", () => {
		expect(Number.isFinite(vonBertalanffyMass(1, 100, 0.5, -2))).toBe(true);
	});
});

describe("the published values still hold", () => {
	/**
	 * Guards must not have moved any answer. These re-pin the citations the
	 * package was built against, so a validation change that altered a result
	 * fails here rather than silently.
	 */
	it("still reproduces Dunbar's number from his own regression", () => {
		expect(maxGroupSize(4.1)).toBeCloseTo(148, 0);
	});

	it("still gives a human an EQ near 7", () => {
		expect(encephalizationQuotient(1.4, 62)).toBeGreaterThan(6);
		expect(encephalizationQuotient(1.4, 62)).toBeLessThan(8);
	});

	it("still makes swimming cheaper than running", () => {
		expect(costOfTransport.swimming(10)).toBeLessThan(
			costOfTransport.running(10),
		);
	});
});
