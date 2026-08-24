/**
 * Parameter checks at this package's inward boundary.
 *
 * Same argument as the forms-stage validator, and the same failure
 * that motivated it — found here by auditing the published packages against
 * each other rather than by any test inside one of them.
 *
 * `derivePigments` clamped its inputs with `Math.max(0, Math.min(1, v))`, and
 * `Math.max(0, undefined)` is `NaN`. A caller who omitted `genetics` — which
 * the type requires but nothing enforced at runtime — got `melanin: NaN` and
 * `pterin: NaN` back, serialising as `null` through JSON, from a function
 * whose return type promises `number`. That then flowed into `paletteRamp`
 * and out as a corrupt hex colour, so a creature drawn three packages away
 * came out wrong while every unit test in every package passed.
 *
 * Clamping is not validation. `clamp01` answers "is this in range", and the
 * question that actually mattered was "is this a number at all". So the
 * numbers are checked where they enter, and the error names the function and
 * the parameter, because a NaN discovered downstream tells you nothing about
 * which caller produced it.
 */

import type { Composition } from "../chem/index.js";

/** What the caller actually passed, briefly, for the error message. */
function describe(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (Array.isArray(value)) return "an array";
	if (typeof value === "object") return `an object (${Object.keys(value as object).join(", ")})`;
	return `${typeof value} ${String(value)}`;
}

export function finite(fn: string, name: string, value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(`${fn}: ${name} must be a finite number, got ${describe(value)}`);
	}
	return value;
}

/**
 * A 0..1 quantity — an exposure, a concentration, a moving average.
 *
 * Deliberately rejects out-of-range values rather than silently clamping
 * them. A `uvExposure` of 12 is not a request for maximum tanning; it is a
 * caller working in different units, and quietly clamping it hides that for
 * as long as the mistake survives. This is the same reasoning that makes a
 * catalogue worse than a rule: the wrong answer must not be the quiet one.
 */
export function unitRange(fn: string, name: string, value: unknown): number {
	const n = finite(fn, name, value);
	if (n < 0 || n > 1) {
		throw new RangeError(`${fn}: ${name} must be between 0 and 1, got ${n}`);
	}
	return n;
}

/**
 * A count of things that have happened. Whole and non-negative.
 *
 * `DietHistory.meals` weights the moving average, so a fractional or negative
 * meal count silently skews every pigment that reads diet.
 */
export function count(fn: string, name: string, value: unknown): number {
	const n = finite(fn, name, value);
	if (!Number.isInteger(n) || n < 0) {
		throw new RangeError(`${fn}: ${name} must be a non-negative whole number, got ${n}`);
	}
	return n;
}

/** An object argument, so a missing options bag fails by name. */
export function object<T>(fn: string, name: string, value: T | undefined): T {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`${fn}: ${name} must be an object, got ${describe(value)}`);
	}
	return value;
}

const TISSUES: ReadonlyArray<keyof Composition> = [
	"sugar",
	"protein",
	"lipid",
	"mineral",
	"chitin",
	"keratin",
];

/** A normalised tissue composition; omitted legacy fields are treated as zero. */
export function composition(fn: string, name: string, value: unknown): Composition {
	const record = object(fn, name, value as Composition | undefined);
	for (const tissue of TISSUES) {
		if (record[tissue] !== undefined) unitRange(fn, `${name}.${tissue}`, record[tissue]);
	}
	return record;
}
