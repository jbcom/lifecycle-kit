import type { Backbone } from "./biochemistry.js";

/**
 * Parameter checks at the composition boundary.
 *
 * This package is where the most-cited bug in its history actually originated.
 * The forms-stage validator describes a "#NaNNaNNaN" fill that reached
 * assemblage, made a creature vanish three stages from the mistake, and
 * passed every unit test in both stages on the way.
 * That exact string is what `compositionColor` returns, today, for a
 * composition containing a NaN.
 *
 * Two mechanisms, both worth naming because they are easy to reintroduce:
 *
 * 1. `compositionColor` skips a fraction with `if (frac <= 0) continue`.
 *    Every comparison against NaN is false, so `NaN <= 0` is false and the
 *    guard waves it through into the weighted sum. A filter written as a
 *    lower bound does not exclude NaN — only an explicit finite check does.
 *
 * 2. `normalise` divides by a total computed with `reduce((a, b) => a + b)`.
 *    One NaN member makes the total NaN, which makes EVERY output field NaN,
 *    so a single bad tissue silently destroys the whole composition rather
 *    than just its own entry.
 *
 * Both are checked here instead, where the caller can still be told which
 * tissue was wrong. A composition is the pivot type the entire downstream
 * pipeline consumes — pigment, forms and assemblage all read it — so a NaN
 * admitted here is a NaN in the drawn creature.
 */

/** What the caller actually passed, briefly, for the error message. */
function describe(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (Array.isArray(value)) return "an array";
	if (typeof value === "object") return `an object (${Object.keys(value as object).join(", ")})`;
	return `${typeof value} ${String(value)}`;
}

/**
 * An object argument.
 *
 * Without this, `Object.values(undefined)` throws "Cannot convert undefined or
 * null to object" — a message that names neither the function the caller
 * invoked nor the argument they omitted.
 */
export function object<T>(fn: string, name: string, value: T | undefined): T {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`${fn}: ${name} must be an object, got ${describe(value)}`);
	}
	return value;
}

export function finite(fn: string, name: string, value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(`${fn}: ${name} must be a finite number, got ${describe(value)}`);
	}
	return value;
}

export function nonNegative(fn: string, name: string, value: unknown): number {
	const amount = finite(fn, name, value);
	if (amount < 0) {
		throw new RangeError(`${fn}: ${name} cannot be negative, got ${amount}`);
	}
	return amount;
}

export function positive(fn: string, name: string, value: unknown): number {
	const amount = finite(fn, name, value);
	if (amount <= 0) {
		throw new RangeError(`${fn}: ${name} must be greater than zero, got ${amount}`);
	}
	return amount;
}

/** A supported long-chain chemistry, checked for JavaScript callers. */
export function backbone(fn: string, name: string, value: unknown): Backbone {
	if (value !== "C" && value !== "Si" && value !== "S") {
		throw new TypeError(`${fn}: ${name} must be C, Si, or S, got ${describe(value)}`);
	}
	return value;
}

/**
 * Every member of a composition-shaped record, checked by name.
 *
 * Returns nothing: the point is to fail before the arithmetic starts, naming
 * the tissue that was wrong. Reporting "protein" beats reporting a NaN that
 * surfaces two packages later as a colour.
 *
 * A negative fraction is rejected for the same reason a negative mass is in
 * the bio-laws stage: it is not a quantity to clamp, it is a caller bug,
 * and normalising it would silently produce a composition whose parts sum to
 * one while one of them is negative.
 */
export function quantities(fn: string, name: string, value: Record<string, number>): void {
	object(fn, name, value);
	for (const [key, amount] of Object.entries(value)) {
		nonNegative(fn, `${name}.${key}`, amount);
	}
}

/** A composition is a quantity record whose keys happen to be tissue names. */
export function composition(fn: string, name: string, value: Record<string, number>): void {
	quantities(fn, name, value);
}
