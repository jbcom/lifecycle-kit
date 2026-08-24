import { describe, expect, it } from "vitest";
import type { Composition } from "../../chem/index.js";
import { EMPTY_COMPOSITION } from "../../chem/index.js";
import { NO_DIET_HISTORY, recordMeal } from "../dietHistory";
import { derivePigments } from "../pigments";

const KERATINOUS = { ...EMPTY_COMPOSITION, keratin: 1 };
const CHITINOUS = { ...EMPTY_COMPOSITION, chitin: 1 };
const PROTEINACEOUS = { ...EMPTY_COMPOSITION, protein: 1 };

/**
 * The two REQUIRED assays from the directive: a carotenoid-rich diet must
 * produce a measurably warmer hue, and melanin must track UV exposure. Both
 * live here, against the pigment concentrations directly — `palette.test.ts`
 * re-confirms the same facts survive translation into an actual colour.
 */
describe("derivePigments", () => {
	it("tracks melanin to UV exposure, holding diet and genetics fixed", () => {
		const low = derivePigments(KERATINOUS, NO_DIET_HISTORY, {
			uvExposure: 0,
			genetics: 0.5,
		});
		const high = derivePigments(KERATINOUS, NO_DIET_HISTORY, {
			uvExposure: 1,
			genetics: 0.5,
		});
		expect(high.melanin).toBeGreaterThan(low.melanin);
	});

	it("gives melanin nothing to deposit into when there is no keratinised tissue", () => {
		const bare = derivePigments(EMPTY_COMPOSITION, NO_DIET_HISTORY, {
			uvExposure: 1,
			genetics: 1,
		});
		const keratinous = derivePigments(KERATINOUS, NO_DIET_HISTORY, {
			uvExposure: 1,
			genetics: 1,
		});
		expect(keratinous.melanin).toBeGreaterThan(bare.melanin);
	});

	it("locks carotenoid to diet history and nothing else", () => {
		let plantHeavy = NO_DIET_HISTORY;
		for (let i = 0; i < 10; i++) plantHeavy = recordMeal(plantHeavy, 1);
		let animalHeavy = NO_DIET_HISTORY;
		for (let i = 0; i < 10; i++) animalHeavy = recordMeal(animalHeavy, 0);

		const inputs = { uvExposure: 0, genetics: 0 };
		const fromPlants = derivePigments(EMPTY_COMPOSITION, plantHeavy, inputs);
		const fromAnimals = derivePigments(EMPTY_COMPOSITION, animalHeavy, inputs);
		expect(fromPlants.carotenoid).toBeGreaterThan(fromAnimals.carotenoid);
	});

	it("cannot synthesise carotenoid from genetics or UV alone", () => {
		const noDiet = derivePigments(EMPTY_COMPOSITION, NO_DIET_HISTORY, {
			uvExposure: 1,
			genetics: 1,
		});
		expect(noDiet.carotenoid).toBe(0);
	});

	it("seats purine pigment in chitin", () => {
		const bare = derivePigments(EMPTY_COMPOSITION, NO_DIET_HISTORY, {
			uvExposure: 0,
			genetics: 0,
		});
		const chitinous = derivePigments(CHITINOUS, NO_DIET_HISTORY, {
			uvExposure: 0,
			genetics: 0,
		});
		expect(chitinous.purine).toBeGreaterThan(bare.purine);
	});

	it("seats porphyrin partly in protein tissue, partly in a plant-heavy diet", () => {
		let plantHeavy = NO_DIET_HISTORY;
		for (let i = 0; i < 10; i++) plantHeavy = recordMeal(plantHeavy, 1);

		const bare = derivePigments(EMPTY_COMPOSITION, NO_DIET_HISTORY, {
			uvExposure: 0,
			genetics: 0,
		});
		const proteinaceous = derivePigments(PROTEINACEOUS, NO_DIET_HISTORY, {
			uvExposure: 0,
			genetics: 0,
		});
		const plantFed = derivePigments(EMPTY_COMPOSITION, plantHeavy, {
			uvExposure: 0,
			genetics: 0,
		});
		expect(proteinaceous.porphyrin).toBeGreaterThan(bare.porphyrin);
		expect(plantFed.porphyrin).toBeGreaterThan(bare.porphyrin);
	});

	/**
	 * `Composition` requires every tissue key, so a well-typed caller never
	 * triggers the `c[id] ?? 0` fallback inside `tissueAffinity` — every test
	 * above spreads `EMPTY_COMPOSITION`, which already has every key set to 0.
	 * A shared library is also called by code the type checker did not see,
	 * per this package's own header, so a Composition missing a key (built by
	 * hand, or round-tripped through JSON that dropped a zero field) must not
	 * crash on a property read.
	 */
	it("does not throw when a composition is missing a tissue key entirely", () => {
		const partial = { keratin: 1 } as unknown as Composition;
		expect(() =>
			derivePigments(partial, NO_DIET_HISTORY, {
				uvExposure: 0.5,
				genetics: 0.5,
			}),
		).not.toThrow();
		const p = derivePigments(partial, NO_DIET_HISTORY, {
			uvExposure: 0.5,
			genetics: 0.5,
		});
		expect(Object.values(p).every(Number.isFinite)).toBe(true);
	});

	it("keeps every concentration within 0..1 across the input range", () => {
		for (const uv of [0, 0.5, 1]) {
			for (const genetics of [0, 0.5, 1]) {
				const p = derivePigments(
					{ ...EMPTY_COMPOSITION, keratin: 1, chitin: 1, protein: 1 },
					{ plantAverage: 1, meals: 10 },
					{ uvExposure: uv, genetics },
				);
				for (const v of Object.values(p)) {
					expect(v).toBeGreaterThanOrEqual(0);
					expect(v).toBeLessThanOrEqual(1);
				}
			}
		}
	});
});
