/**
 * What has actually been eaten, recently.
 *
 * Carotenoids cannot be synthesised — every animal that shows carotenoid
 * colour (flamingo pink, salmon flesh, a canary's yellow) gets it from diet,
 * with no exception. That makes carotenoid pigment genuinely time-lagged: a
 * creature that just ate an carotenoid-rich meal is not instantly redder for
 * it, and a creature starved of plant matter fades rather than instantly
 * greying. A running exponential average is the right shape for that lag —
 * it is what a real pigment pool does as it is laid down and slowly turned
 * over, and it needs no history buffer to replay: the average IS the state.
 */

import { count, object, unitRange } from "./validate.js";

/** Plant-matter fraction of a single meal, 0..1. */
export type MealPlantFraction = number;

export interface DietHistory {
	/** Exponential moving average of plant-matter fraction eaten, 0..1. */
	plantAverage: number;
	/** How many meals have contributed. Caps the averaging window's bite. */
	meals: number;
}

export const NO_DIET_HISTORY: DietHistory = { plantAverage: 0, meals: 0 };

/**
 * How much a single new meal moves the running average.
 *
 * Early meals move it a lot (a newborn's first meal IS its diet so far);
 * later meals move it less, converging toward a true moving average. This is
 * the standard "welford-lite" shape: weight = 1 / (n + 1), capped so a very
 * long life does not make the pigment pool completely inert to a dietary
 * change — real pigment turns over on a timescale of weeks, not a lifetime.
 */
const MIN_WEIGHT = 0.08;

/** Fold one meal's plant-matter fraction into the running average. */
export function recordMeal(
	history: DietHistory,
	plantFraction: MealPlantFraction,
): DietHistory {
	object("recordMeal", "history", history);

	// The average is the state, which is exactly why a bad value here is worse
	// than a bad value anywhere else in this package: a single NaN meal makes
	// `plantAverage` NaN forever, and every future meal folds into a number
	// that can never recover. It is checked before it can be absorbed.
	const fraction = unitRange("recordMeal", "plantFraction", plantFraction);
	const average = unitRange(
		"recordMeal",
		"history.plantAverage",
		history.plantAverage,
	);
	const meals = count("recordMeal", "history.meals", history.meals);

	const weight = Math.max(MIN_WEIGHT, 1 / (meals + 1));
	return {
		plantAverage: average + (fraction - average) * weight,
		meals: meals + 1,
	};
}
