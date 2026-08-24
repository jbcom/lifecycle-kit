import { describe, expect, it } from "vitest";
import { NO_DIET_HISTORY, recordMeal } from "../dietHistory";

/**
 * The moving average that makes carotenoid pigment time-lagged rather than
 * instant — a creature does not turn orange the moment it eats one carrot,
 * and does not turn instantly grey the moment its diet changes either.
 */
describe("dietHistory", () => {
	it("starts with no plant-matter history", () => {
		expect(NO_DIET_HISTORY.plantAverage).toBe(0);
		expect(NO_DIET_HISTORY.meals).toBe(0);
	});

	it("makes the first meal define the average outright", () => {
		const h = recordMeal(NO_DIET_HISTORY, 1);
		expect(h.plantAverage).toBeCloseTo(1, 6);
		expect(h.meals).toBe(1);
	});

	it("moves the average toward a repeated new value without snapping to it", () => {
		let h = recordMeal(NO_DIET_HISTORY, 1); // all-plant
		h = recordMeal(h, 0); // one all-animal meal
		expect(h.plantAverage).toBeGreaterThan(0);
		expect(h.plantAverage).toBeLessThan(1);
	});

	it("converges toward a sustained new diet over many meals", () => {
		let h: typeof NO_DIET_HISTORY = { plantAverage: 1, meals: 50 };
		for (let i = 0; i < 200; i++) h = recordMeal(h, 0);
		expect(h.plantAverage).toBeLessThan(0.1);
	});

	/**
	 * REVISED: this used to assert that an out-of-range meal fraction was
	 * clamped. It now asserts rejection, for a reason specific to this
	 * function: the average IS the state.
	 *
	 * Clamping a 5 to a 1 records a meal that never happened, and there is no
	 * later observation that can undo it — the history has no buffer to replay
	 * and no way to know the value was ever suspect. A caller passing 5 is
	 * working in percent, or passing a mass instead of a fraction, and the
	 * cheapest possible moment to find that out is here.
	 */
	it("rejects an out-of-range meal fraction rather than absorbing it", () => {
		expect(() => recordMeal(NO_DIET_HISTORY, 5)).toThrow(
			/recordMeal: plantFraction must be between 0 and 1, got 5/,
		);
		expect(() => recordMeal(NO_DIET_HISTORY, -5)).toThrow(/recordMeal: plantFraction/);
	});

	/** In-range fractions still fold in exactly as before. */
	it("folds an in-range meal into the average", () => {
		const h = recordMeal(NO_DIET_HISTORY, 1);
		expect(h.plantAverage).toBeGreaterThan(0);
		expect(h.plantAverage).toBeLessThanOrEqual(1);
		expect(h.meals).toBe(1);
	});

	it("never lets the averaging window fully freeze on a long life", () => {
		// Even after many meals, one more meal must still move the average —
		// otherwise an old creature's pigment could never respond to a real
		// dietary change, which contradicts real pigment turnover.
		let h: typeof NO_DIET_HISTORY = { plantAverage: 0, meals: 10_000 };
		const before = h.plantAverage;
		h = recordMeal(h, 1);
		expect(h.plantAverage).toBeGreaterThan(before);
	});
});
