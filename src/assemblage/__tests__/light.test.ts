import { describe, expect, it } from "vitest";
import { shade } from "../light.js";

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
		expect(() => shade("nothex", 0.5)).toThrow(
			/shade: hex must be a 6-digit colour/,
		);
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
