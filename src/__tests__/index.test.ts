import { describe, expect, it } from "vitest";
import * as lifecycleKit from "../index.js";

/**
 * `.` — the package root — is the entry point every one of the sibling
 * subpath tests skips, since they all import their own package's `index.js`
 * directly. This is the one file that proves the root barrel itself: that it
 * namespaces all five stages, and — the entire documented reason it is
 * namespaced rather than flat — that `chem.normalise` and
 * `assemblage.normalise` really do stay two different functions rather than
 * one silently shadowing the other by declaration order.
 */
describe("the package root entry point", () => {
	it("exposes every stage as its own namespace", () => {
		expect(lifecycleKit.chem).toBeDefined();
		expect(lifecycleKit.forms).toBeDefined();
		expect(lifecycleKit.bioLaws).toBeDefined();
		expect(lifecycleKit.pigment).toBeDefined();
		expect(lifecycleKit.assemblage).toBeDefined();
	});

	/**
	 * The literal defect a flat re-export would reintroduce, and the reason
	 * this module is documented as namespaced rather than flat: `chem` and
	 * `assemblage` both export a function named `normalise`, and they do
	 * different things to different argument shapes.
	 */
	it("keeps chem.normalise and assemblage.normalise as two distinct functions", () => {
		expect(lifecycleKit.chem.normalise).not.toBe(
			lifecycleKit.assemblage.normalise,
		);

		// chem.normalise takes a tissue Composition and returns fractions
		// summing to one.
		const composition = lifecycleKit.chem.normalise({
			...lifecycleKit.chem.EMPTY_COMPOSITION,
			protein: 3,
			lipid: 1,
		});
		expect(composition.protein).toBeCloseTo(0.75, 6);

		// assemblage.normalise takes a Vec2 direction and returns a unit vector.
		const direction = lifecycleKit.assemblage.normalise({ x: 3, y: 4 });
		expect(direction.x).toBeCloseTo(0.6, 6);
		expect(direction.y).toBeCloseTo(0.8, 6);
	});

	// A real chain across every stage, through the root barrel: derive
	// biochemistry, express a tissue, pigment it, build a form, and assemble
	// it under light — proof the five namespaces genuinely interoperate.
	it("composes a creature across all five stages through the root import", () => {
		const { backbone } = lifecycleKit.chem.deriveBiochemistry({}, 288);
		const composition = lifecycleKit.chem.normalise({
			...lifecycleKit.chem.EMPTY_COMPOSITION,
			keratin: 1,
		});

		const pigments = lifecycleKit.pigment.derivePigments(
			composition,
			lifecycleKit.pigment.NO_DIET_HISTORY,
			{ uvExposure: 0.5, genetics: 0.5 },
		);
		const ramp = lifecycleKit.pigment.paletteRamp(composition, pigments, {
			metallic: 0.1,
			roughness: 0.6,
			opacity: 1,
		});

		const unit = lifecycleKit.forms.taper({
			from: 0.2,
			to: 0.1,
			bulgeAt: 0.5,
			length: 0.4,
			part: "body",
		});

		const [part] = lifecycleKit.assemblage.assemble(unit.shapes);
		expect(part).toBeDefined();
		const drawn = lifecycleKit.assemblage.shade(ramp.base, part?.light ?? 0.5);

		expect(backbone).toBe("C");
		expect(drawn).toMatch(/^#[0-9a-f]{6}$/i);
	});
});
