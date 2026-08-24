import { describe, expect, it } from "vitest";
import { bounds } from "../path.js";
import { branch } from "../rules/branch.js";
import { enclose } from "../rules/enclose.js";
import { pair } from "../rules/pair.js";
import { radiate } from "../rules/radiate.js";
import { repeat } from "../rules/repeat.js";
import { taper } from "../rules/taper.js";
import { rotateTurns, scale, translate } from "../rules/transform.js";

/**
 * A rule refuses malformed parameters instead of emitting broken geometry.
 *
 * This is not defensive programming for its own sake. Calling `taper` with a
 * `Vec2` where it wants a half-width silently produced a point with a `null`
 * coordinate, which flowed through `lifecycle-assemblage`'s light arithmetic
 * to NaN and out as a "#NaNNaNNaN" fill — the creature vanished, three
 * packages away from the mistake, with every unit test in both packages
 * passing.
 *
 * A shared library is consumed by people who did not write it and will get the
 * argument shape wrong. Failing where the mistake is made is the difference
 * between a one-line fix and an afternoon.
 */
describe("rules reject malformed parameters", () => {
	// The exact call that caused the bug: Vec2 passed where a number is wanted.
	it("taper rejects a non-numeric width", () => {
		expect(() =>
			taper({
				from: { x: 0, y: 0 } as unknown as number,
				to: 0.1,
				bulgeAt: 0.5,
				length: 1,
			}),
		).toThrow(/taper/i);
	});

	it("taper rejects NaN", () => {
		expect(() => taper({ from: Number.NaN, to: 0.1, bulgeAt: 0.5, length: 1 })).toThrow(
			/finite|number/i,
		);
	});

	it("taper accepts honest numbers", () => {
		expect(() => taper({ from: 0.3, to: 0.1, bulgeAt: 0.5, length: 1 })).not.toThrow();
	});

	/**
	 * REWRITTEN. These three were passing vacuously.
	 *
	 * Each called a rule with ONE argument and a `shape:` key that no rule has
	 * ever taken, cast `as never` to silence the compiler — so they threw
	 * because the second argument was missing, not because the value under
	 * test was rejected. `repeat` in particular accepted a non-integer count
	 * quite happily; nothing here ever proved otherwise.
	 *
	 * A test that passes for the wrong reason is worse than no test, because
	 * it occupies the space where the real one would go. These now call the
	 * real two-argument signature and assert the specific parameter by name.
	 */
	const UNIT = taper({
		from: 0.2,
		to: 0.1,
		bulgeAt: 0.5,
		length: 0.4,
		part: "seg",
	});

	it("repeat rejects a non-integer count", () => {
		expect(() =>
			repeat(UNIT, {
				axis: { x: 1, y: 0 },
				count: 2.5,
				spacing: 0.2,
				part: "seg",
			}),
		).toThrow(/repeat: count must be a non-negative whole number/);
	});

	it("radiate rejects a negative count", () => {
		expect(() =>
			radiate(UNIT, {
				center: { x: 0, y: 0 },
				count: -3,
				spreadTurns: 1,
				part: "arm",
			}),
		).toThrow(/radiate: count must be a non-negative whole number/);
	});

	// Every rule takes numbers somewhere, and every one of them can be handed
	// a NaN by arithmetic upstream.
	it.each([
		["pair", () => pair(UNIT, { attachment: { x: Number.NaN, y: 0 }, part: "leg" })],
		[
			"branch",
			() =>
				branch(UNIT, {
					depth: Number.NaN,
					splits: 2,
					angle: 0.1,
					shrink: 0.7,
					attachAt: 1,
					part: "frond",
				}),
		],
		["enclose", () => enclose(UNIT, { thickness: Number.NaN, part: "shell" })],
	])("%s rejects NaN", (_name, call) => {
		expect(call).toThrow(/must be a finite number|whole number/);
	});
});

/**
 * The invisible-creature regression.
 *
 * Found by sweeping the published packages: `repeat` takes `axis` as a Vec2
 * DIRECTION — it need not be axis-aligned, which is the whole reason it is a
 * vector rather than an enum — so the obvious-looking `axis: "x"` gave
 * `"x".x === undefined`, an offset of NaN, and a body whose every coordinate
 * was null.
 *
 * Nothing threw. `repeat` returned a full, correctly-shaped path made
 * entirely of holes, `bounds()` returned null, and the creature simply did
 * not appear. That is precisely the failure this package's own header
 * describes, reproduced by rules that had no checks at the time they were
 * written — only `taper` validated anything.
 */
describe("every rule refuses malformed parameters", () => {
	const UNIT = taper({
		from: 0.3,
		to: 0.15,
		length: 0.6,
		bulgeAt: 0.5,
		part: "seg",
	});

	it("repeat rejects a string axis instead of emitting null coordinates", () => {
		expect(
			() =>
				repeat(UNIT, {
					axis: "x" as unknown as { x: number; y: number },
					count: 3,
					spacing: 0.5,
					part: "seg",
				}),
			// A string is caught by the object check, which reports what was
			// actually passed ("string x") rather than the derived
			// `axis.x === undefined` — the more useful of the two messages,
			// because the caller's mistake was the shape, not the component.
		).toThrow(/repeat: axis must be a \{ x, y \} point, got string x/);
	});

	/** An object of the right shape but wrong contents fails per component. */
	it("names the component when only one coordinate is bad", () => {
		expect(() =>
			repeat(UNIT, {
				axis: { x: 1, y: undefined as unknown as number },
				count: 3,
				spacing: 0.5,
				part: "seg",
			}),
		).toThrow(/repeat: axis\.y must be a finite number, got undefined/);
	});

	it("a valid repeat still produces real, bounded geometry", () => {
		const body = repeat(UNIT, {
			axis: { x: 1, y: 0 },
			count: 3,
			spacing: 0.55,
			part: "seg",
		});
		const box = bounds(body);
		expect(box).not.toBeNull();
		expect(JSON.stringify(body)).not.toContain("null");
	});

	it("rejects a missing params bag by name", () => {
		expect(() => taper(undefined as never)).toThrow(/taper: params must be an object/);
		expect(() => repeat(UNIT, undefined as never)).toThrow(/repeat: params must be an object/);
		expect(() => pair(UNIT, undefined as never)).toThrow(/pair: params/);
		expect(() => radiate(UNIT, undefined as never)).toThrow(/radiate: params/);
		expect(() => branch(UNIT, undefined as never)).toThrow(/branch: params/);
		expect(() => enclose(UNIT, undefined as never)).toThrow(/enclose: params/);
	});

	it("rejects a malformed unit path", () => {
		expect(() =>
			repeat(undefined as never, {
				axis: { x: 1, y: 0 },
				count: 2,
				spacing: 1,
				part: "s",
			}),
		).toThrow(/repeat: unit must be a Path/);
	});

	it("rejects an empty part name that would merge unrelated shapes", () => {
		expect(() => repeat(UNIT, { axis: { x: 1, y: 0 }, count: 2, spacing: 1, part: "" })).toThrow(
			/repeat: part must be a non-empty string/,
		);
	});

	it("pair and radiate reject a malformed point", () => {
		expect(() => pair(UNIT, { attachment: "middle" as never, part: "leg" })).toThrow(
			/pair: attachment must be a \{ x, y \} point/,
		);
		expect(() =>
			radiate(UNIT, {
				center: { x: 0, y: Number.NaN },
				count: 3,
				spreadTurns: 1,
				part: "arm",
			}),
		).toThrow(/radiate: center\.y must be a finite number/);
	});

	it("the transforms every rule is built on reject NaN", () => {
		expect(() => translate(UNIT, { x: Number.NaN, y: 0 })).toThrow(/translate: offset\.x/);
		expect(() => scale(UNIT, Number.NaN)).toThrow(/scale: sx/);
		expect(() => rotateTurns(UNIT, undefined as never)).toThrow(/rotateTurns: turns/);
	});

	/**
	 * The "got ..." clause on a plain `finite()` check has a branch for an
	 * array and a branch for a plain object, distinct from "string" (`vec2`,
	 * exercised above) and "undefined". A coordinate array or a stray options
	 * object passed where a bare number was expected is a realistic mistake
	 * — `angle: [0.1]` from a spread gone wrong, say — and neither branch had
	 * ever been exercised.
	 */
	it("names an array distinctly from a number, for a plain finite() argument", () => {
		expect(() =>
			branch(UNIT, {
				depth: 2,
				splits: 2,
				angle: [0.1] as unknown as number,
				shrink: 0.7,
				attachAt: 1,
				part: "frond",
			}),
		).toThrow(/branch: angle must be a finite number, got an array/);
	});

	it("names an object's own keys instead of just saying 'object'", () => {
		expect(() =>
			branch(UNIT, {
				depth: 2,
				splits: 2,
				angle: { turns: 0.1 } as unknown as number,
				shrink: 0.7,
				attachAt: 1,
				part: "frond",
			}),
		).toThrow(/branch: angle must be a finite number, got an object \(turns\)/);
	});

	/**
	 * `typeof null === "object"`, so `describe`'s null check has to run
	 * before its object check or `null` would print as an object with no
	 * keys — a strictly worse message for the single most common bad-argument
	 * case: an unset field on a real record.
	 */
	it("names null distinctly from an object with no keys", () => {
		expect(() =>
			branch(UNIT, {
				depth: 2,
				splits: 2,
				angle: null as unknown as number,
				shrink: 0.7,
				attachAt: 1,
				part: "frond",
			}),
		).toThrow(/branch: angle must be a finite number, got null/);
	});
});

describe("rules enforce documented geometry domains and allocation limits", () => {
	const UNIT = taper({ from: 0.2, to: 0.1, bulgeAt: 0.5, length: 0.4 });

	it("rejects negative half-widths and out-of-range bulges", () => {
		expect(() => taper({ from: -0.1, to: 0.1, bulgeAt: 0.5, length: 1 })).toThrow(
			/taper: from cannot be negative/,
		);
		expect(() => taper({ from: 0.1, to: 0.1, bulgeAt: 1.1, length: 1 })).toThrow(
			/taper: bulgeAt must be between 0 and 1/,
		);
	});

	it("rejects invalid branch fractions and shell thickness", () => {
		const base = { depth: 2, splits: 2, angle: 0.2, part: "frond" };
		expect(() => branch(UNIT, { ...base, shrink: 0, attachAt: 1 })).toThrow(
			/branch: shrink must be greater than 0 and at most 1/,
		);
		expect(() => branch(UNIT, { ...base, shrink: 0.7, attachAt: 2 })).toThrow(
			/branch: attachAt must be between 0 and 1/,
		);
		expect(() => enclose(UNIT, { thickness: -0.1, part: "shell" })).toThrow(
			/enclose: thickness cannot be negative/,
		);
	});

	it("rejects turn spans outside the documented range", () => {
		expect(() =>
			radiate(UNIT, {
				center: { x: 0, y: 0 },
				count: 3,
				spreadTurns: 1.1,
				part: "arm",
			}),
		).toThrow(/radiate: spreadTurns must be between 0 and 1/);
	});

	it("refuses copy counts that could exhaust a host process", () => {
		expect(() =>
			repeat(UNIT, {
				axis: { x: 1, y: 0 },
				count: 10_001,
				spacing: 1,
				part: "segment",
			}),
		).toThrow(/repeat: count cannot exceed 10000/);
		expect(() =>
			branch(UNIT, {
				depth: 10,
				splits: 4,
				angle: 0.2,
				shrink: 0.7,
				attachAt: 1,
				part: "frond",
			}),
		).toThrow(/would emit more than 10000 branch copies/);
		expect(() =>
			branch(UNIT, {
				depth: 65,
				splits: 1,
				angle: 0,
				shrink: 1,
				attachAt: 1,
				part: "frond",
			}),
		).toThrow(/branch: depth cannot exceed 64/);
	});

	it("does not overestimate a branch that has no children", () => {
		expect(
			branch(UNIT, {
				depth: 64,
				splits: 0,
				angle: 0,
				shrink: 1,
				attachAt: 1,
				part: "frond",
			}).shapes,
		).toHaveLength(1);
	});
});
