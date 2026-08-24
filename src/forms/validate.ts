/**
 * Parameter checks at the rule boundary.
 *
 * A shared library is consumed by people who did not write it, and they will
 * get the argument shape wrong. The cost of not checking is not a slightly
 * worse error message — it is a wrong value flowing downstream and failing
 * somewhere else entirely.
 *
 * That happened: `taper` called with a `Vec2` where it wants a half-width
 * emitted a point with a `null` coordinate, which reached
 * `lifecycle-assemblage`, became NaN in the light arithmetic, and rendered as
 * a "#NaNNaNNaN" fill. The creature vanished three packages away from the
 * mistake, and every unit test in both packages passed the whole time.
 *
 * So rules fail where the mistake is made. The message names the rule and the
 * parameter, because "expected a finite number" without a subject is barely
 * better than the NaN.
 */

export function finite(rule: string, name: string, value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(
			`${rule}: ${name} must be a finite number, got ${describe(value)}`,
		);
	}
	return value;
}

export function positive(rule: string, name: string, value: unknown): number {
	const n = finite(rule, name, value);
	if (n <= 0) {
		throw new RangeError(
			`${rule}: ${name} must be greater than zero, got ${n}`,
		);
	}
	return n;
}

export function count(rule: string, name: string, value: unknown): number {
	const n = finite(rule, name, value);
	if (!Number.isInteger(n) || n < 0) {
		throw new RangeError(
			`${rule}: ${name} must be a non-negative whole number, got ${n}`,
		);
	}
	return n;
}

/**
 * A point or direction in form space.
 *
 * The check that was missing, and the one that cost the most. `repeat` takes
 * `axis` as a `Vec2` DIRECTION — it need not be axis-aligned, which is the
 * whole reason it is a vector rather than an enum — so a caller who writes
 * the obvious-looking `axis: "x"` gets `"x".x === undefined`, an offset of
 * NaN, and a body whose every coordinate is null. Nothing threw. The rule
 * returned a full, correctly-shaped path made entirely of holes, and the
 * creature simply did not appear.
 *
 * That is the exact failure this package's own header describes, reproduced
 * by a rule that had no check at the time it was written.
 */
export function vec2(
	rule: string,
	name: string,
	value: unknown,
): { x: number; y: number } {
	if (value === null || typeof value !== "object") {
		throw new TypeError(
			`${rule}: ${name} must be a { x, y } point, got ${describe(value)}`,
		);
	}
	const v = value as { x?: unknown; y?: unknown };
	finite(rule, `${name}.x`, v.x);
	finite(rule, `${name}.y`, v.y);
	return { x: v.x as number, y: v.y as number };
}

/** A required options object, so a missing parameter bag fails by name. */
export function params<T>(rule: string, value: T | undefined): T {
	if (value === null || typeof value !== "object") {
		throw new TypeError(
			`${rule}: params must be an object, got ${describe(value)}`,
		);
	}
	return value;
}

/** A path argument, checked before a rule reads `.shapes` off it. */
export function path<T extends { shapes?: unknown }>(
	rule: string,
	name: string,
	value: T | undefined,
): T {
	if (
		value === null ||
		typeof value !== "object" ||
		!Array.isArray(value.shapes)
	) {
		throw new TypeError(
			`${rule}: ${name} must be a Path with a shapes array, got ${describe(value)}`,
		);
	}
	return value;
}

/** An anatomical part name. Empty would merge unrelated shapes into one part. */
export function partName(rule: string, name: string, value: unknown): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new TypeError(
			`${rule}: ${name} must be a non-empty string, got ${describe(value)}`,
		);
	}
	return value;
}

/** What the caller actually passed, briefly, for the error message. */
function describe(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (Array.isArray(value)) return "an array";
	if (typeof value === "object")
		return `an object (${Object.keys(value as object).join(", ")})`;
	return `${typeof value} ${String(value)}`;
}
