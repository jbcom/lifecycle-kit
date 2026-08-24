/**
 * The elements a creature is made of.
 *
 * Ported from `arcade-cabinet/ebb-and-bloom`'s periodic table
 * (`agents/tables/periodic-table.ts`) — real atomic masses, valences,
 * electronegativities, cosmic abundances and CPK colours, validated there
 * against the npm `periodic-table` reference.
 *
 * That table stops at chlorine, which is a limitation we inherit and one that
 * does not matter here: H, C, N, O, P and S are roughly 99% of biomass by
 * mass, and the trace metals a real cell needs are not something a 12x9 pixel
 * creature can express anyway.
 *
 * Abundance is the important field. It is the cosmic abundance of the
 * element, and it is what makes a creature's composition a *consequence*
 * rather than a choice: carbon is common, phosphorus is scarce, and a body
 * that wants a lot of phosphorus is therefore expensive to build.
 */

export interface Element {
	z: number;
	symbol: string;
	name: string;
	/** Atomic mass, u. */
	mass: number;
	valence: number;
	electronegativity: number;
	/** Fraction of ordinary matter in the universe. */
	abundance: number;
	/** CPK colour, used to tint the pixel that represents this atom. */
	color: string;
	/** 0..1. Metals catch light; a magnesium-rich tissue reads bright-edged. */
	metallic: number;
	/** 0..1. Low roughness is glossy, high is matte. */
	roughness: number;
	/** 0..1. Below 1 reads translucent — a watery, jelly-ish body. */
	opacity: number;
}

/**
 * Self-bond (catenation) energy, kJ/mol.
 *
 * Life needs an element that will bond to ITSELF into long stable chains.
 * Carbon does this at 346 kJ/mol; silicon manages only 226. This is one of the
 * two reasons carbon-based life is likely rather than assumed — a world is
 * scored on it, not handed a verdict.
 *
 * Note this is strictly about how much heat a chain survives. Silicon chains
 * ALSO hydrolyse, which is a separate effect with a separate table below;
 * conflating the two hides the fact that only one of them depends on water.
 *
 * Values from the ported periodic table's bondEnergies.
 */
export const CATENATION: Record<string, number> = {
	C: 346,
	Si: 226,
	S: 226,
	N: 167,
	O: 142,
	P: 201,
};

/**
 * Susceptibility of a backbone's chains to attack by liquid water, 0..1.
 *
 * The second reason Earth is carbon-based, and the conditional one. Si-Si and
 * Si-O-Si bonds are readily hydrolysed — silicon's affinity for oxygen is so
 * strong that in water it ends up as silicate rock rather than long chains,
 * which is exactly where Earth's silicon actually is. Carbon chains are stable
 * in water, which is why they got to build us.
 *
 * This is why silicon biochemistry is dismissed for Earth-like worlds and
 * taken seriously for hot, dry ones: remove the liquid water and the objection
 * goes with it. Sulfur sits in between, forming chains that persist in water
 * but less readily than carbon's.
 *
 * Values are relative susceptibilities rather than rate constants — the real
 * rates depend on pH and dissolved silica, which a creature simulation has no
 * business modelling. The ORDER is what matters and the order is not in doubt.
 */
export const HYDROLYSIS: Record<string, number> = {
	C: 0.0,
	Si: 0.97,
	S: 0.35,
	N: 0.5,
	O: 0.5,
	P: 0.6,
};

export const ELEMENTS: Record<string, Element> = {
	H: {
		z: 1,
		symbol: "H",
		name: "Hydrogen",
		mass: 1.008,
		valence: 1,
		electronegativity: 2.2,
		abundance: 0.75,
		color: "#FFFFFF",
		metallic: 0.0,
		roughness: 0.8,
		opacity: 0.3,
	},
	C: {
		z: 6,
		symbol: "C",
		name: "Carbon",
		mass: 12.011,
		valence: 4,
		electronegativity: 2.55,
		abundance: 0.005,
		color: "#303030",
		metallic: 0.0,
		roughness: 0.7,
		opacity: 1.0,
	},
	N: {
		z: 7,
		symbol: "N",
		name: "Nitrogen",
		mass: 14.007,
		valence: 5,
		electronegativity: 3.04,
		abundance: 0.001,
		color: "#87CEEB",
		metallic: 0.0,
		roughness: 0.8,
		opacity: 0.4,
	},
	O: {
		z: 8,
		symbol: "O",
		name: "Oxygen",
		mass: 15.999,
		valence: 6,
		electronegativity: 3.44,
		abundance: 0.01,
		color: "#FF6B6B",
		metallic: 0.0,
		roughness: 0.8,
		opacity: 0.4,
	},
	Na: {
		z: 11,
		symbol: "Na",
		name: "Sodium",
		mass: 22.99,
		valence: 1,
		electronegativity: 0.93,
		abundance: 0.00002,
		color: "#AB5CF2",
		metallic: 1.0,
		roughness: 0.4,
		opacity: 1.0,
	},
	Mg: {
		z: 12,
		symbol: "Mg",
		name: "Magnesium",
		mass: 24.305,
		valence: 2,
		electronegativity: 1.31,
		abundance: 0.0006,
		color: "#8AFF00",
		metallic: 1.0,
		roughness: 0.4,
		opacity: 1.0,
	},
	Si: {
		z: 14,
		symbol: "Si",
		name: "Silicon",
		mass: 28.085,
		valence: 4,
		electronegativity: 1.9,
		abundance: 0.0007,
		color: "#5F9EA0",
		metallic: 0.2,
		roughness: 0.5,
		opacity: 1.0,
	},
	P: {
		z: 15,
		symbol: "P",
		name: "Phosphorus",
		mass: 30.974,
		valence: 5,
		electronegativity: 2.19,
		abundance: 0.000007,
		color: "#FF8000",
		metallic: 0.0,
		roughness: 0.7,
		opacity: 1.0,
	},
	S: {
		z: 16,
		symbol: "S",
		name: "Sulfur",
		mass: 32.06,
		valence: 6,
		electronegativity: 2.58,
		abundance: 0.0005,
		color: "#FFFF30",
		metallic: 0.0,
		roughness: 0.7,
		opacity: 1.0,
	},
	Cl: {
		z: 17,
		symbol: "Cl",
		name: "Chlorine",
		mass: 35.45,
		valence: 7,
		electronegativity: 3.16,
		abundance: 0.0000001,
		color: "#1FF01F",
		metallic: 0.0,
		roughness: 0.8,
		opacity: 0.5,
	},
};

/** Mass of a formula given as element counts, in u. */
export function molecularMass(counts: Record<string, number>): number {
	let total = 0;
	for (const [sym, n] of Object.entries(counts)) {
		const el = ELEMENTS[sym];
		if (el) total += el.mass * n;
	}
	return total;
}

/**
 * How hard a molecule is to come by, from the scarcity of what it needs.
 *
 * Rarer inputs make a rarer molecule, so a creature built on phosphorus is
 * genuinely harder to grow than one built on carbon and water. Returns a
 * positive number where larger means scarcer.
 */
export function scarcity(counts: Record<string, number>): number {
	let sum = 0;
	let atoms = 0;
	for (const [sym, n] of Object.entries(counts)) {
		const el = ELEMENTS[sym];
		if (!el) continue;
		sum += -Math.log10(el.abundance) * n;
		atoms += n;
	}
	return atoms === 0 ? 0 : sum / atoms;
}
