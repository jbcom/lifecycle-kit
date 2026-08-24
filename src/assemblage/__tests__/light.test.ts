import { describe, expect, it } from "vitest";
import { litness, normalise, shade } from "../light.js";

/**
 * A malformed colour must not become a plausible one.
 *
 * `shade` produces the hex a creature is actually drawn in, so a bad value
 * here is a wrong picture rather than a crash — the failure mode this whole
 * stack keeps producing, and the hardest kind to notice.
 *
 * Found by sweeping the published packages: `parseInt(...) || 0` turned any
 * unparseable string into black and returned it as a confident colour, so
 * `shade("nothex", 0.5)` was "#00000e". Upstream now refuses to emit a bad
 * colour at all (lifecycle-chem's compositionColor, lifecycle-pigment's
 * paletteRamp), so accepting one here would only hide a caller that went
 * around them.
 */
describe("shade refuses a colour it cannot read", () => {
	it("does not turn an unparseable string into black", () => {
		expect(() => shade("nothex", 0.5)).toThrow(/shade: hex must be a 6-digit colour/);
	});

	it("names the argument instead of failing on a property read", () => {
		expect(() => shade(undefined as unknown as string, 0.5)).toThrow(
			/shade: hex must be a 6-digit colour like "#aabbcc", got undefined/,
		);
	});

	it("rejects a short or over-long hex", () => {
		expect(() => shade("#abc", 0.5)).toThrow(/6-digit/);
		expect(() => shade("#aabbccdd", 0.5)).toThrow(/6-digit/);
	});

	it("accepts a real colour with or without the hash", () => {
		expect(shade("#aabbcc", 0.5)).toMatch(/^#[0-9a-f]{6}$/);
		expect(shade("aabbcc", 0.5)).toBe(shade("#aabbcc", 0.5));
	});

	/** The documented NaN guard stays: a bad LEVEL is neutral, not fatal. */
	it("still treats a non-finite light level as neutral", () => {
		expect(shade("#aabbcc", Number.NaN)).toBe(shade("#aabbcc", 0.5));
	});
});

/**
 * `litness` must not propagate a bad `Light.ambient` into NaN either — the
 * same "#NaNNaNNaN" failure mode this stack keeps producing, one argument
 * over. A `Light` composed by a caller (rather than `DEFAULT_LIGHT`) can omit
 * or miscompute `ambient`, so the fallback to a fully-dark floor of 0 has to
 * actually run, not just exist as dead code.
 */
describe("litness survives a bad ambient term", () => {
	it("falls back to zero ambient when ambient is NaN", () => {
		const light = { direction: { x: 0, y: 1 }, ambient: Number.NaN };
		const v = litness({ x: 0, y: -1 }, light);
		expect(Number.isFinite(v)).toBe(true);
		expect(v).toBeGreaterThanOrEqual(0);
		expect(v).toBeLessThanOrEqual(1);
	});

	it("falls back to zero ambient when ambient is missing", () => {
		const light = {
			direction: { x: 0, y: 1 },
			ambient: undefined as unknown as number,
		};
		const v = litness({ x: 0, y: -1 }, light);
		expect(Number.isFinite(v)).toBe(true);
	});

	/** A missing ambient must still let the fully-lit side reach near 1, not be silently dimmed. */
	it("does not clamp the lit side just because ambient was bad", () => {
		const bad = litness({ x: 0, y: -1 }, { direction: { x: 0, y: 1 }, ambient: Number.NaN });
		const good = litness({ x: 0, y: -1 }, { direction: { x: 0, y: 1 }, ambient: 0 });
		expect(bad).toBeCloseTo(good, 9);
	});
});

/**
 * `normalise` is exported directly and used inside `litness` and `occlusion`
 * alike, but nothing had ever called it on its own — only indirectly, through
 * a `Light` whose direction was always already well-formed. Its own documented
 * failure modes (a NaN component, a zero vector) had never been exercised at
 * the function itself.
 */
describe("normalise", () => {
	it("returns a real unit vector for an ordinary direction", () => {
		const { x, y } = normalise({ x: 3, y: 4 });
		expect(x).toBeCloseTo(0.6, 6);
		expect(y).toBeCloseTo(0.8, 6);
		expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
	});

	it("falls back to the default direction for a zero vector, rather than dividing by zero", () => {
		const { x, y } = normalise({ x: 0, y: 0 });
		expect(Number.isFinite(x)).toBe(true);
		expect(Number.isFinite(y)).toBe(true);
		expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
	});

	it("treats a NaN component as zero rather than propagating it", () => {
		const { x, y } = normalise({ x: Number.NaN, y: 5 });
		expect(Number.isFinite(x)).toBe(true);
		expect(Number.isFinite(y)).toBe(true);
	});

	it("falls back to the default direction when the direction is missing entirely", () => {
		const { x, y } = normalise(undefined);
		expect(Number.isFinite(x)).toBe(true);
		expect(Number.isFinite(y)).toBe(true);
		expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
	});
});
