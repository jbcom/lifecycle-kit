import { describe, expect, it } from "vitest";
import {
	asBackbone,
	BIOMOLECULES,
	type BiomoleculeId,
	compositionColor,
	dominantTissue,
	EMPTY_COMPOSITION,
	growthCost,
	normalise,
	unitMass,
} from "../biomolecules";

/**
 * What a body is built out of.
 *
 * These pin the chemistry that decides how a creature looks and what it cost
 * to grow — a body is a consequence of what it ate and where it lives, and
 * these are the functions that make that true rather than decorative.
 */
describe("biomolecules", () => {
	it("gives every tissue a real mass", () => {
		for (const id of Object.keys(BIOMOLECULES) as BiomoleculeId[]) {
			expect(unitMass(id)).toBeGreaterThan(0);
		}
	});

	// Bone mineral needs phosphorus, orders of magnitude rarer than the
	// carbon and oxygen sugar is made of. A skeleton is an achievement.
	it("makes mineral the expensive tissue", () => {
		expect(growthCost("mineral")).toBeGreaterThan(growthCost("sugar"));
		expect(growthCost("mineral")).toBeGreaterThan(growthCost("lipid"));
	});

	describe("composition", () => {
		it("normalises a tally into fractions summing to one", () => {
			const n = normalise({ ...EMPTY_COMPOSITION, protein: 3, lipid: 1 });
			expect(n.protein + n.lipid).toBeCloseTo(1, 6);
			expect(n.protein).toBeCloseTo(0.75, 6);
		});

		it("falls back to sugar rather than dividing by zero", () => {
			expect(normalise({ ...EMPTY_COMPOSITION }).sugar).toBe(1);
		});

		it("reads a body as its dominant tissue", () => {
			expect(
				dominantTissue({ ...EMPTY_COMPOSITION, chitin: 0.6, protein: 0.4 }),
			).toBe("chitin");
		});

		/**
		 * `dominantTissue` seeds its comparison with `best = "sugar"` before it
		 * has looked at the composition at all, so the very first comparison
		 * reads `c.sugar` before knowing it exists. Every other test in this
		 * file spreads `EMPTY_COMPOSITION`, which always has a `sugar` key —
		 * this is the one realistic case (a malformed or hand-built
		 * composition genuinely missing it) where that assumption fails, and
		 * the function must not crash comparing against `undefined`.
		 */
		it("still finds a dominant tissue when the composition has no sugar key at all", () => {
			const noSugar = {
				chitin: 0.6,
				protein: 0.4,
			} as unknown as typeof EMPTY_COMPOSITION;
			expect(dominantTissue(noSugar)).toBe("chitin");
		});

		it("colours a body from the elements it is made of", () => {
			expect(compositionColor({ ...EMPTY_COMPOSITION, protein: 1 })).toMatch(
				/^#[0-9a-f]{6}$/i,
			);
		});

		it("gives an empty body a fallback colour", () => {
			expect(compositionColor({ ...EMPTY_COMPOSITION })).toMatch(
				/^#[0-9a-f]{6}$/i,
			);
		});
	});
});

/**
 * `BiomoleculeId` is a `keyof typeof BIOMOLECULES` — a compile-time-only
 * guarantee. A shared library is also reached by code the type checker never
 * saw (a string built from user input, a stale id after a rename), and
 * `asBackbone`'s own body already refuses that case explicitly rather than
 * indexing into `undefined`; nothing had ever exercised the refusal.
 */
describe("asBackbone with an id the table does not know", () => {
	it("throws by name rather than silently reading an undefined formula", () => {
		expect(() => asBackbone("unobtanium" as BiomoleculeId, "C")).toThrow(
			/unknown biomolecule unobtanium/,
		);
	});
});

/**
 * Tissue follows the world's chemistry.
 *
 * A protein is a chain with nitrogen and sulfur attached; what the chain is
 * made of is the world's business, not the tissue's.
 */
describe("backbone substitution", () => {
	it("leaves carbon worlds untouched", () => {
		for (const id of Object.keys(BIOMOLECULES) as BiomoleculeId[]) {
			expect(asBackbone(id, "C")).toEqual(BIOMOLECULES[id].formula);
		}
	});

	it("swaps carbon for the world's backbone", () => {
		expect(asBackbone("sugar", "Si")).toEqual({ Si: 6, H: 12, O: 6 });
	});

	it("keeps the rest of the molecule intact", () => {
		const protein = asBackbone("protein", "Si");
		expect(protein.N).toBe(BIOMOLECULES.protein.formula.N);
		expect(protein.S).toBe(BIOMOLECULES.protein.formula.S);
		expect(protein.C).toBeUndefined();
	});

	it("merges when the backbone already occurs in the tissue", () => {
		// Keratin is C5H10N2O3S2 — on a sulfur world the chain joins the S.
		const keratin = asBackbone("keratin", "S");
		expect(keratin.S).toBe(
			BIOMOLECULES.keratin.formula.C + BIOMOLECULES.keratin.formula.S,
		);
	});

	it("leaves carbon-free tissue alone whatever the backbone", () => {
		// Mineral is P2O8Mg3 — no carbon to substitute.
		expect(asBackbone("mineral", "Si")).toEqual(BIOMOLECULES.mineral.formula);
	});

	// Silicon is heavier than carbon (28.085 u vs 12.011), so the same tissue
	// on a silicon world genuinely weighs more.
	it("makes silicon tissue heavier than the carbon equivalent", () => {
		expect(unitMass("sugar", "Si")).toBeGreaterThan(unitMass("sugar", "C"));
	});

	// Silicon is far rarer than carbon, so a silicon body costs more to grow.
	it("makes silicon tissue costlier to grow", () => {
		expect(growthCost("lipid", "Si")).toBeGreaterThan(growthCost("lipid", "C"));
	});

	// Carbon's CPK colour is near-black; silicon's is a pale teal.
	it("gives a silicon creature a different colour", () => {
		const body = { ...EMPTY_COMPOSITION, protein: 1 };
		expect(compositionColor(body, "Si")).not.toBe(compositionColor(body, "C"));
	});

	it("still returns a valid colour on any backbone", () => {
		const body = { ...EMPTY_COMPOSITION, chitin: 0.5, mineral: 0.5 };
		for (const b of ["C", "Si", "S"] as const) {
			expect(compositionColor(body, b)).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});
});
