/**
 * Parameter checks at the law boundary.
 *
 * Same argument as `lifecycle-forms/src/validate.ts` and
 * `lifecycle-pigment/src/validate.ts`, and found the same way — by composing
 * the published packages against each other rather than by any test inside
 * one of them.
 *
 * Two distinct defects were leaking:
 *
 * 1. Every law returned `null` for a NaN argument. `NaN ** 0.75` is NaN, and
 *    JSON turns NaN into `null`, so a function whose return type promises
 *    `number` handed back a null that then flowed downstream.
 *
 * 2. Most laws accepted a NEGATIVE mass. `(-5) ** 0.75` is NaN in IEEE 754 —
 *    a negative base to a fractional exponent has no real root — so
 *    `clutchSize`, `expectedBrainMass`, `gutRetentionTime` and
 *    `vonBertalanffyMass` all silently produced null from it, while
 *    `ageAtFirstReproduction(-5)` cheerfully returned an age of -1.25.
 *
 * The second is the more serious one, and it is why these checks reject
 * rather than clamp. A negative mass is not a small number to be nudged up to
 * zero; it is a caller bug — a subtraction that went the wrong way, a unit
 * conversion applied twice. These are ALLOMETRIC POWER LAWS fitted to real
 * measured organisms, and they have no meaning outside the domain they were
 * fitted on. Clamping a negative mass to zero would answer a question nobody
 * asked and hide the arithmetic that produced it.
 *
 * That is the same standard the package already holds itself to elsewhere: a
 * law without an assay is unverified, and a law quietly evaluated outside its
 * domain is worse than one that refuses.
 */

/** What the caller actually passed, briefly, for the error message. */
function describe(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (Array.isArray(value)) return "an array";
	if (typeof value === "object")
		return `an object (${Object.keys(value as object).join(", ")})`;
	return `${typeof value} ${String(value)}`;
}

export function finite(law: string, name: string, value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(
			`${law}: ${name} must be a finite number, got ${describe(value)}`,
		);
	}
	return value;
}

/**
 * A mass, a length, a duration — a physical quantity that cannot be negative.
 *
 * Zero is allowed because it is a meaningful boundary (a creature with no
 * brain mass, a growth model evaluated at t0), and each law decides for
 * itself what zero means. Negative is not a boundary, it is an error.
 */
export function nonNegative(law: string, name: string, value: unknown): number {
	const n = finite(law, name, value);
	if (n < 0) {
		throw new RangeError(
			`${law}: ${name} cannot be negative, got ${n}. ` +
				`These are allometric laws fitted to real organisms; a negative ` +
				`${name} is outside the domain they were measured on.`,
		);
	}
	return n;
}

/** A quantity that must be strictly greater than zero to mean anything. */
export function positive(law: string, name: string, value: unknown): number {
	const n = finite(law, name, value);
	if (n <= 0) {
		throw new RangeError(`${law}: ${name} must be greater than zero, got ${n}`);
	}
	return n;
}
