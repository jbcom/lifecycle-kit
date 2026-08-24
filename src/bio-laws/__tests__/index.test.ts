import { describe, expect, it } from "vitest";
import * as bioLaws from "../index.js";

/**
 * `./bio-laws` is a real `package.json` "exports" subpath. Every other test
 * in this package imports `../lifeHistory.js` directly, so the barrel that
 * consumers actually import from had never been proven to re-export
 * anything at all.
 */
describe("the ./bio-laws public entry point", () => {
	it("re-exports every documented scaling law", () => {
		expect(typeof bioLaws.expectedBrainMass).toBe("function");
		expect(typeof bioLaws.encephalizationQuotient).toBe("function");
		expect(typeof bioLaws.maxGroupSize).toBe("function");
		expect(typeof bioLaws.populationDensity).toBe("function");
		expect(typeof bioLaws.ageAtFirstReproduction).toBe("function");
		expect(typeof bioLaws.gutRetentionTime).toBe("function");
		expect(typeof bioLaws.vonBertalanffyMass).toBe("function");
		expect(typeof bioLaws.clutchSize).toBe("function");
		expect(typeof bioLaws.thermalRateFactor).toBe("function");
	});

	it("re-exports costOfTransport as a real, callable gait table", () => {
		expect(bioLaws.costOfTransport).toBeDefined();
		expect(typeof bioLaws.costOfTransport.swimming).toBe("function");
		expect(typeof bioLaws.costOfTransport.running).toBe("function");
		expect(bioLaws.costOfTransport.swimming(10)).toBeLessThan(bioLaws.costOfTransport.running(10));
	});

	it("computes a real, finite answer through the barrel", () => {
		expect(bioLaws.expectedBrainMass(50)).toBeGreaterThan(0);
		expect(bioLaws.encephalizationQuotient(bioLaws.expectedBrainMass(50), 50)).toBeCloseTo(1, 6);
	});
});
