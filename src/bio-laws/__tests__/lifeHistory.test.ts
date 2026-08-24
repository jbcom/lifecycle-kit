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
	REFERENCE_TEMPERATURE_K,
	thermalRateFactor,
	vonBertalanffyMass,
} from "../lifeHistory";

/**
 * Assays against published values.
 *
 * A cited formula is only worth having if it reproduces the measurements it
 * was fitted to, so these check real organisms rather than internal
 * consistency. If one fails, either the port is wrong or the citation was
 * misread — both are bugs, and neither is a tuning opportunity.
 */
describe("life history laws", () => {
	describe("von Bertalanffy growth", () => {
		it("starts at nothing", () => {
			expect(vonBertalanffyMass(0, 100, 0.3)).toBe(0);
		});

		it("approaches but never reaches the maximum", () => {
			const late = vonBertalanffyMass(100, 100, 0.3);
			expect(late).toBeLessThan(100);
			expect(late).toBeGreaterThan(99);
		});

		it("grows monotonically", () => {
			const young = vonBertalanffyMass(2, 100, 0.3);
			const older = vonBertalanffyMass(5, 100, 0.3);
			expect(older).toBeGreaterThan(young);
		});

		// The characteristic shape: most growth happens early, and the last
		// increment of size is the most expensive one an organism ever buys.
		it("decelerates as it approaches the asymptote", () => {
			const first = vonBertalanffyMass(3, 100, 0.3) - vonBertalanffyMass(1, 100, 0.3);
			const later = vonBertalanffyMass(11, 100, 0.3) - vonBertalanffyMass(9, 100, 0.3);
			expect(first).toBeGreaterThan(later);
		});

		it("is undefined before t0 rather than negative", () => {
			expect(vonBertalanffyMass(1, 100, 0.3, 5)).toBe(0);
		});
	});

	describe("clutch size (Charnov & Ernest 2006)", () => {
		// The trade-off itself: a fixed budget buys many small or few large.
		it("trades offspring size against offspring number", () => {
			const many = clutchSize(10, 0.05, true);
			const few = clutchSize(10, 1.0, true);
			expect(many).toBeGreaterThan(few);
		});

		it("gives r-selected parents larger clutches than K-selected", () => {
			expect(clutchSize(10, 0.1, true)).toBeGreaterThan(clutchSize(10, 0.1, false));
		});

		// r-selected allocate ~25% of body mass, K-selected ~10%.
		it("allocates the published fraction of body mass", () => {
			// 10 kg parent, 0.1 kg offspring: 25% -> 25, 10% -> 10.
			expect(clutchSize(10, 0.1, true)).toBe(25);
			expect(clutchSize(10, 0.1, false)).toBe(10);
		});

		it("never promises less than one offspring", () => {
			expect(clutchSize(1, 100, false)).toBe(1);
		});

		it("refuses to divide by a massless offspring", () => {
			expect(clutchSize(10, 0, true)).toBe(0);
		});
	});

	it("puts first reproduction at a quarter of lifespan", () => {
		expect(ageAtFirstReproduction(40)).toBe(10);
	});

	describe("Damuth's law", () => {
		// Damuth (1981) fitted log10(D) = 4.23 - 0.75 log10(M) to mammals.
		// A 1 kg mammal should sit near 10^4.23 ~ 17000 individuals/km2.
		it("reproduces the published intercept at 1 kg", () => {
			expect(populationDensity(1)).toBeCloseTo(10 ** 4.23, 0);
		});

		// Larger animals are rarer — the entire content of the law.
		it("makes large animals rarer than small ones", () => {
			expect(populationDensity(1000)).toBeLessThan(populationDensity(1));
		});

		// A 3/4 exponent means 10000x the mass is 1000x rarer.
		it("scales as the negative three-quarter power", () => {
			const ratio = populationDensity(1) / populationDensity(10000);
			expect(ratio).toBeCloseTo(1000, -1);
		});

		it("has no density for a massless animal", () => {
			expect(populationDensity(0)).toBe(0);
		});
	});

	describe("encephalization", () => {
		// By construction EQ = 1 is exactly average for body size.
		it("scores an average brain at 1", () => {
			expect(encephalizationQuotient(expectedBrainMass(50), 50)).toBeCloseTo(1, 6);
		});

		// Humans: ~1.35 kg brain, ~62 kg body. Jerison's EQ lands near 7.
		it("puts a human near the published EQ of 7", () => {
			expect(encephalizationQuotient(1.35, 62)).toBeGreaterThan(5);
			expect(encephalizationQuotient(1.35, 62)).toBeLessThan(9);
		});

		it("scores a smaller-than-expected brain below 1", () => {
			expect(encephalizationQuotient(expectedBrainMass(50) / 2, 50)).toBeLessThan(1);
		});

		/**
		 * `expectedBrainMass(0)` is exactly 0, so a bodyMassKg of zero would
		 * otherwise divide `brainMassKg / 0` into Infinity — for the boundary
		 * case explicitly documented as legal ("zero is a real boundary, not
		 * an error"). The function guards this with `expected <= 0 → return 0`,
		 * and nothing had ever called it at that boundary.
		 */
		it("scores zero rather than Infinity for a zero-mass body", () => {
			expect(encephalizationQuotient(0, 0)).toBe(0);
			expect(encephalizationQuotient(1, 0)).toBe(0);
		});
	});

	describe("Dunbar's number", () => {
		// The namesake result. Human neocortex ratio is ~4.1 in Dunbar's data,
		// and his regression turns that into ~150. A form that cannot
		// reproduce this is not Dunbar's law, whatever it is cited as — the
		// ported doc's linear version fails here, which is how we caught it.
		it("predicts roughly 150 at the human neocortex ratio", () => {
			const n = maxGroupSize(4.1);
			expect(n).toBeGreaterThan(130);
			expect(n).toBeLessThan(170);
		});

		// Small primates sit around CR 1.5 and live in groups of a few.
		it("predicts small groups for small primates", () => {
			expect(maxGroupSize(1.5)).toBeLessThan(15);
		});

		it("gives a relatively larger neocortex a bigger circle", () => {
			expect(maxGroupSize(4.1)).toBeGreaterThan(maxGroupSize(2));
		});

		it("has no group without a neocortex", () => {
			expect(maxGroupSize(0)).toBe(0);
		});
	});

	describe("cost of transport (Schmidt-Nielsen 1972)", () => {
		// The headline finding: swimming is cheapest, burrowing is brutal.
		it("ranks the gaits the way the paper does", () => {
			const m = 1;
			expect(costOfTransport.swimming(m)).toBeLessThan(costOfTransport.flying(m));
			expect(costOfTransport.flying(m)).toBeLessThan(costOfTransport.running(m));
			expect(costOfTransport.running(m)).toBeLessThan(costOfTransport.burrowing(m));
		});

		// "Flying is 6x more efficient than running" — at 1 kg, 10.7/1.6.
		it("makes flying several times cheaper than running", () => {
			const ratio = costOfTransport.running(1) / costOfTransport.flying(1);
			expect(ratio).toBeGreaterThan(5);
			expect(ratio).toBeLessThan(8);
		});

		it("costs more per kilogram as an animal gets heavier", () => {
			expect(costOfTransport.running(100)).toBeGreaterThan(costOfTransport.running(1));
		});
	});

	describe("gut retention", () => {
		// MRT = 13 × M^0.27, so a 1 kg animal holds food ~13 hours.
		it("reproduces the published value at 1 kg", () => {
			expect(gutRetentionTime(1)).toBeCloseTo(13, 6);
		});

		// Bigger animals hold food longer, which is why they can eat worse food.
		it("holds food longer in a larger animal", () => {
			expect(gutRetentionTime(1000)).toBeGreaterThan(gutRetentionTime(1));
		});
	});
});

/**
 * Metabolic rate against temperature.
 *
 * Assayed against the PUBLISHED behaviour of the Boltzmann-Arrhenius factor,
 * not against a re-derivation of the same arithmetic. The load-bearing check
 * is Q10: biologists measure it directly, and it is the number that would be
 * wrong if the activation energy or Boltzmann's constant were in the wrong
 * units.
 */
describe("thermalRateFactor", () => {
	it("is exactly 1 at the reference temperature", () => {
		expect(thermalRateFactor(REFERENCE_TEMPERATURE_K)).toBeCloseTo(1, 10);
	});

	it("runs faster when warmer and slower when colder", () => {
		expect(thermalRateFactor(303.15)).toBeGreaterThan(1);
		expect(thermalRateFactor(283.15)).toBeLessThan(1);
	});

	/**
	 * Q10 — the factor a rate changes by over a 10 °C rise.
	 *
	 * Measured across biology to sit between 2 and 3 for aerobic metabolism,
	 * and E = 0.63 eV puts it near 2.5 around room temperature. This is the
	 * assay that catches a units error: joules instead of electronvolts would
	 * give a Q10 of 1.0000000, and it would still pass every monotonicity
	 * check above.
	 */
	it("has a Q10 in the range biology measures", () => {
		const q10 = thermalRateFactor(303.15) / thermalRateFactor(293.15);
		expect(q10).toBeGreaterThan(2);
		expect(q10).toBeLessThan(3);
	});

	// The same rise from a different base gives a slightly smaller Q10,
	// because the exponent is in 1/T rather than T. A model that returned a
	// constant Q10 would be Arrhenius-shaped but not Arrhenius.
	it("has a Q10 that falls as the base temperature rises", () => {
		const low = thermalRateFactor(283.15) / thermalRateFactor(273.15);
		const high = thermalRateFactor(313.15) / thermalRateFactor(303.15);
		expect(high).toBeLessThan(low);
	});

	// Never negative, and never NaN, across the whole habitable span and well
	// past it. Not "always > 0": below roughly 30 K the exponent underflows a
	// double to exactly zero, and that is the physically honest answer rather
	// than a defect — metabolism at 1 K IS zero. Asserting strict positivity
	// there would be demanding that floating point lie.
	it("stays finite and non-negative at any real temperature", () => {
		for (const k of [1, 50, 100, 273.15, 293.15, 400, 800, 2000]) {
			const rate = thermalRateFactor(k);
			expect(Number.isFinite(rate)).toBe(true);
			expect(rate).toBeGreaterThanOrEqual(0);
		}
	});

	// Across the range life actually occupies, the rate is strictly positive —
	// which is the claim a caller depends on.
	it("is strictly positive everywhere life is possible", () => {
		for (const k of [200, 273.15, 293.15, 310, 373, 500]) {
			expect(thermalRateFactor(k)).toBeGreaterThan(0);
		}
	});

	// Absolute zero and below are not temperatures a rate can be evaluated at.
	it("refuses a non-positive temperature", () => {
		expect(() => thermalRateFactor(0)).toThrow();
		expect(() => thermalRateFactor(-5)).toThrow();
	});

	it("refuses a non-finite temperature", () => {
		expect(() => thermalRateFactor(Number.NaN)).toThrow();
	});
});
