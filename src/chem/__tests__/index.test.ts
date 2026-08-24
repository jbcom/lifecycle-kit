import { describe, expect, it } from "vitest";
import * as chem from "../index.js";

/**
 * `./chem` is a real `package.json` "exports" subpath, and — unlike every
 * other package's barrel — its `index.ts` file itself already reports 100%
 * coverage, because `biomolecules.test.ts` happens to import from
 * `"../biomolecules"` (no barrel involved) while other suites import
 * `../../chem/index.js` relatively. What none of that proves is that the
 * FOUR separate `export *` lines (biochemistry, biomolecules, elements,
 * metabolism) all actually surface through the single `./chem` entry point
 * together, without one shadowing another — chem/index.ts's own header
 * elsewhere in this package warns that exactly this kind of merge can hide a
 * collision.
 */
describe("the ./chem public entry point", () => {
	it("re-exports biochemistry", () => {
		expect(typeof chem.deriveBiochemistry).toBe("function");
		expect(typeof chem.chainStability).toBe("function");
		expect(typeof chem.inBackbone).toBe("function");
	});

	it("re-exports biomolecules, including the Composition helpers", () => {
		expect(typeof chem.normalise).toBe("function");
		expect(typeof chem.compositionColor).toBe("function");
		expect(typeof chem.dominantTissue).toBe("function");
		expect(chem.EMPTY_COMPOSITION).toBeDefined();
		expect(chem.BIOMOLECULES).toBeDefined();
	});

	it("re-exports the elements tables and functions", () => {
		expect(chem.ELEMENTS).toBeDefined();
		expect(chem.CATENATION).toBeDefined();
		expect(typeof chem.molecularMass).toBe("function");
		expect(typeof chem.scarcity).toBe("function");
	});

	it("re-exports metabolism", () => {
		expect(typeof chem.metabolise).toBe("function");
		expect(typeof chem.bodyMassKg).toBe("function");
		expect(chem.NEWBORN).toBeDefined();
	});

	// A real cross-module chain, through the single barrel: derive a world's
	// biochemistry, express a tissue in that backbone, and colour the result
	// — proof all four re-exported modules interoperate through one import.
	it("composes biochemistry, biomolecules and elements through one import", () => {
		const { backbone } = chem.deriveBiochemistry({ Si: 30 }, 500);
		expect(backbone).toBe("Si");
		const formula = chem.asBackbone("sugar", backbone);
		expect(chem.molecularMass(formula)).toBeGreaterThan(0);
		const color = chem.compositionColor(
			{ ...chem.EMPTY_COMPOSITION, protein: 1 },
			backbone,
		);
		expect(color).toMatch(/^#[0-9a-f]{6}$/i);
	});
});
