import { type Backbone, inBackbone } from "./biochemistry.js";
import { ELEMENTS, molecularMass, scarcity } from "./elements.js";
import { composition } from "./validate.js";

/**
 * What a body is built out of.
 *
 * Ported from `ebb-and-bloom`'s `MolecularSynthesis` (engine/procedural).
 * Its principle is exactly right and entirely renderer-agnostic:
 *
 *   protein → muscle bulk
 *   calcium → rigid structure
 *   lipid   → insulation and reserve
 *   chitin  → exoskeleton
 *   keratin → spines, claws, coat
 *
 * Only its final step was 3D — it turned those fractions into THREE.js
 * cylinders and spheres, and *that* is the part of Ebb & Bloom that is hard.
 * Rendering fusing molecules in 3D is the problem that stalled it. At 12x9
 * pixels a molecule is a glyph and a body plan is a handful of parts, so the
 * expensive half of the idea evaporates and the valuable half ports intact.
 *
 * That table has no calcium, so rigidity here comes from phosphorus and
 * magnesium — which is chemically honest: bone mineral is calcium phosphate,
 * and phosphate is the scarce half.
 *
 * The formulas below are real molecules — glucose, an amino-acid residue,
 * palmitic acid — written as carbon compounds because that is what they are.
 * On a world whose chemistry chose a different backbone, `asBackbone()`
 * substitutes it, so a tissue keeps its STRUCTURE (a chain with nitrogen and
 * sulfur hanging off it is a protein whatever the chain is made of) while its
 * composition, mass and cost follow the world. Everything downstream reads
 * through that rather than off the literal formula.
 */

export interface Biomolecule {
	id: string;
	name: string;
	/** Element counts per unit. */
	formula: Record<string, number>;
	/** What having a lot of this does to a body. */
	role: string;
}

export const BIOMOLECULES: Record<string, Biomolecule> = {
	// C:H:O ~ 1:2:1. Fuel and the simplest thing to eat.
	sugar: {
		id: "sugar",
		name: "Sugar",
		formula: { C: 6, H: 12, O: 6 },
		role: "energy",
	},
	// Amino-acid backbone. Muscle and every enzyme.
	protein: {
		id: "protein",
		name: "Protein",
		formula: { C: 5, H: 9, N: 1, O: 2, S: 1 },
		role: "muscle",
	},
	// Long carbon chain, little oxygen. Insulation and stored energy.
	lipid: {
		id: "lipid",
		name: "Lipid",
		formula: { C: 16, H: 32, O: 2 },
		role: "reserve",
	},
	// Phosphate mineral. Rigid structure — the scarce, expensive tissue.
	mineral: {
		id: "mineral",
		name: "Mineral",
		formula: { P: 2, O: 8, Mg: 3 },
		role: "structure",
	},
	// N-acetylglucosamine, the exoskeleton polymer.
	chitin: {
		id: "chitin",
		name: "Chitin",
		formula: { C: 8, H: 13, N: 1, O: 5 },
		role: "armour",
	},
	// Sulfur-rich structural protein: spines, claws, coat.
	keratin: {
		id: "keratin",
		name: "Keratin",
		formula: { C: 5, H: 10, N: 2, O: 3, S: 2 },
		role: "spines",
	},
};

export type BiomoleculeId = keyof typeof BIOMOLECULES;

/** A body's makeup, as fractions summing to roughly 1. */
export type Composition = Record<BiomoleculeId, number>;

export const EMPTY_COMPOSITION: Composition = {
	sugar: 0,
	protein: 0,
	lipid: 0,
	mineral: 0,
	chitin: 0,
	keratin: 0,
};

/** Normalise a raw tally into fractions that sum to 1. */
export function normalise(raw: Composition): Composition {
	// One NaN member makes `total` NaN, which makes every output field NaN —
	// a single bad tissue silently destroying the whole composition. Checked
	// by name, before the division.
	composition("normalise", "raw", raw);

	const total = Object.values(raw).reduce((a, b) => a + b, 0);
	if (total <= 0) return { ...EMPTY_COMPOSITION, sugar: 1 };
	const out = { ...EMPTY_COMPOSITION };
	for (const k of Object.keys(raw) as BiomoleculeId[]) {
		out[k] = (raw[k] ?? 0) / total;
	}
	return out;
}

/**
 * A tissue's formula expressed in a given world's backbone.
 *
 * Carbon atoms become backbone atoms; everything else is untouched. Passing
 * "C" returns the formula unchanged, which is why every caller can default to
 * it and worlds that chose carbon cost nothing extra.
 */
export function asBackbone(id: BiomoleculeId, backbone: Backbone = "C"): Record<string, number> {
	const entry = BIOMOLECULES[id];
	if (!entry) throw new Error(`unknown biomolecule ${id}`);
	const formula = entry.formula;
	if (backbone === "C") return formula;
	// Rewrite carbon as the placeholder, then let inBackbone substitute — so
	// the substitution rule lives in one place.
	const templated: Record<string, number> = {};
	for (const [symbol, count] of Object.entries(formula)) {
		templated[symbol === "C" ? "X" : symbol] = count;
	}
	return inBackbone(templated, backbone);
}

/** Mass of one unit of a biomolecule, in u. */
export function unitMass(id: BiomoleculeId, backbone: Backbone = "C"): number {
	return molecularMass(asBackbone(id, backbone));
}

/**
 * How costly a tissue is to grow, from the scarcity of its elements.
 *
 * Mineral needs phosphorus, which is roughly five orders of magnitude rarer
 * than oxygen, so skeleton is genuinely expensive and a heavily built
 * creature is genuinely an achievement.
 */
export function growthCost(id: BiomoleculeId, backbone: Backbone = "C"): number {
	return scarcity(asBackbone(id, backbone));
}

/** The dominant tissue, which is what a creature reads as at a glance. */
export function dominantTissue(c: Composition): BiomoleculeId {
	let best: BiomoleculeId = "sugar";
	for (const k of Object.keys(c) as BiomoleculeId[]) {
		if ((c[k] ?? 0) > (c[best] ?? 0)) best = k;
	}
	return best;
}

/**
 * The colour a body takes on, blended from its tissues' elements.
 *
 * Uses the CPK colours from the ported table, so a chitinous creature reads
 * carbon-dark and a mineral-rich one reads phosphorus-orange. The pixel a
 * player sees is downstream of what the creature is actually made of.
 *
 * The backbone reaches the player here most visibly: carbon's CPK colour is
 * near-black, silicon's is a pale teal. A silicon-based creature looks
 * different because it IS different, not because anything recoloured it.
 */
export function compositionColor(c: Composition, backbone: Backbone = "C"): string {
	// The origin of the "#NaNNaNNaN" fill that `lifecycle-forms`'s validate.ts
	// documents. The loop below skips a tissue with `if (frac <= 0) continue`,
	// and every comparison against NaN is false — so `NaN <= 0` is false, the
	// guard waves it through, and it reaches the weighted sum. A filter
	// written as a lower bound does not exclude NaN.
	composition("compositionColor", "c", c);

	let r = 0;
	let g = 0;
	let b = 0;
	let weight = 0;
	for (const id of Object.keys(c) as BiomoleculeId[]) {
		const frac = c[id] ?? 0;
		if (frac <= 0) continue;
		const formula = asBackbone(id, backbone);
		for (const [sym, n] of Object.entries(formula)) {
			const el = ELEMENTS[sym];
			if (!el) continue;
			const w = frac * n;
			const hex = el.color.replace("#", "");
			r += Number.parseInt(hex.slice(0, 2), 16) * w;
			g += Number.parseInt(hex.slice(2, 4), 16) * w;
			b += Number.parseInt(hex.slice(4, 6), 16) * w;
			weight += w;
		}
	}
	if (weight === 0) return "#8da177";
	const to = (v: number) =>
		Math.round(v / weight)
			.toString(16)
			.padStart(2, "0");
	return `#${to(r)}${to(g)}${to(b)}`;
}
