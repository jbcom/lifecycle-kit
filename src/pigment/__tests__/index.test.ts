import { describe, expect, it } from "vitest";
import { EMPTY_COMPOSITION } from "../../chem/index.js";
import * as pigment from "../index.js";

/**
 * `./pigment` is a real `package.json` "exports" subpath. Every other test
 * in this package imports the concrete modules directly, so the barrel that
 * `@jbdevprimary/lifecycle-kit/pigment` consumers actually load had never itself
 * been exercised.
 */
describe("the ./pigment public entry point", () => {
	it("re-exports derivePigments and a working diet history", () => {
		expect(typeof pigment.derivePigments).toBe("function");
		expect(pigment.NO_DIET_HISTORY).toBeDefined();
		expect(typeof pigment.recordMeal).toBe("function");

		const diet = pigment.recordMeal(pigment.NO_DIET_HISTORY, 1);
		expect(diet.meals).toBe(1);
	});

	it("re-exports paletteRamp, and it composes end to end with derivePigments", () => {
		expect(typeof pigment.paletteRamp).toBe("function");
		const composition = { ...EMPTY_COMPOSITION, keratin: 1 };
		const pigments = pigment.derivePigments(composition, pigment.NO_DIET_HISTORY, {
			uvExposure: 0.5,
			genetics: 0.5,
		});
		const ramp = pigment.paletteRamp(composition, pigments, {
			metallic: 0.1,
			roughness: 0.7,
			opacity: 1,
		});
		for (const stop of ["shadow", "base", "pigment", "highlight"] as const) {
			expect(ramp[stop]).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});
});
