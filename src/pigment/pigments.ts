import type { Composition } from "../chem/index.js";
import type { DietHistory } from "./dietHistory.js";
import { object, unitRange } from "./validate.js";

/**
 * PIGMENTATION
 *
 * Colour a creature actually produces, as biological pigment families rather
 * than an arbitrary RGB blend. Ported from `ebb-and-bloom`'s
 * `PigmentationSynthesis` — its biology was exactly right; only its render
 * target (THREE.Color, a canvas texture) needs to go. This package emits
 * pigment CONCENTRATIONS and colour swatches; `lifecycle-assemblage` is
 * where those become pixels.
 *
 * Every family here is a real biological pigment class, not an invented
 * bucket:
 *
 * - Melanin — eumelanin/pheomelanin, upregulated by UV exposure (the same
 *   mechanism that tans human skin) and present in every clade that has skin
 *   at all. Browns and blacks.
 * - Carotenoids — cannot be synthesised by animal metabolism; every
 *   carotenoid-pigmented animal (flamingo, salmon, canary) gets the pigment
 *   from a plant-matter diet, full stop. Reds, oranges, yellows.
 * - Pterins — synthesised internally from GTP, independent of diet. Reds and
 *   yellows in insects and ectotherms (butterfly wings, frog skin).
 * - Purines (guanine) — the light-scattering crystal pigment behind
 *   structural white and the silvery/iridescent look of fish scales.
 * - Porphyrins — the tetrapyrrole ring at the centre of both haem (blood,
 *   animal-matter diet) and chlorophyll (plant-matter diet), giving reds and
 *   greens depending on which metal centre and diet dominate.
 */

/** Exposure and genetic inputs the chemistry alone cannot supply. */
export interface PigmentInputs {
	/** Cumulative UV exposure, 0..1. Drives melanin the way a tan does. */
	uvExposure: number;
	/** Heritable pigment-expression bias, 0..1. Not diet, not exposure. */
	genetics: number;
}

export interface PigmentConcentrations {
	melanin: number;
	carotenoid: number;
	pterin: number;
	purine: number;
	porphyrin: number;
}

/**
 * Weight of a Composition tissue in a pigment concentration.
 *
 * `keratin` carries melanin and pterin (the pigmented layer in a coat, a
 * claw, a wing scale); `chitin` carries purine (crystal pigment sits in the
 * cuticle); `protein` carries porphyrin (haem is a protein-bound pigment).
 * These are structural affinities, not arbitrary numbers — pigment is
 * deposited INTO the tissue that has somewhere to put it.
 */
function tissueAffinity(
	c: Composition,
	ids: ReadonlyArray<keyof Composition>,
): number {
	let total = 0;
	for (const id of ids) total += c[id] ?? 0;
	return total;
}

/**
 * Derive pigment concentrations from tissue composition, diet history and
 * exposure.
 *
 * Each concentration is a real biological driver, not a blend of everything:
 * melanin never sees diet, carotenoid never sees genetics, and so on. That
 * separation is what makes the two required assays possible — a diet change
 * moves carotenoid and nothing else; a UV change moves melanin and nothing
 * else.
 */
export function derivePigments(
	composition: Composition,
	diet: DietHistory,
	inputs: PigmentInputs,
): PigmentConcentrations {
	object("derivePigments", "composition", composition);
	object("derivePigments", "diet", diet);
	object("derivePigments", "inputs", inputs);

	// Checked, not clamped. `Math.max(0, undefined)` is NaN, so the old clamp
	// turned a missing input into a null concentration and handed it
	// downstream — see validate.ts for what that cost.
	const uv = unitRange(
		"derivePigments",
		"inputs.uvExposure",
		inputs.uvExposure,
	);
	const genetics = unitRange(
		"derivePigments",
		"inputs.genetics",
		inputs.genetics,
	);
	const plantAverage = unitRange(
		"derivePigments",
		"diet.plantAverage",
		diet.plantAverage,
	);

	const keratinAffinity = tissueAffinity(composition, ["keratin"]);
	const chitinAffinity = tissueAffinity(composition, ["chitin"]);
	const proteinAffinity = tissueAffinity(composition, ["protein"]);

	return {
		// UV protection response, scaled by how much keratinised tissue there
		// is to deposit it in. A creature with no keratin cannot tan.
		melanin: clamp01((uv * 0.7 + genetics * 0.3) * (0.4 + keratinAffinity)),

		// Diet-locked: cannot be synthesised, so it tracks the moving average
		// of plant matter eaten and nothing else.
		carotenoid: clamp01(plantAverage * 0.85),

		// Internally synthesised, independent of diet — genetics and the
		// keratinised tissue it colours.
		pterin: clamp01(genetics * 0.5 * (0.4 + keratinAffinity)),

		// Structural crystal pigment, seated in chitin.
		purine: clamp01(0.3 + chitinAffinity * 0.5),

		// Haem-and-chlorophyll family: protein tissue carries haem, and a
		// plant-heavy diet contributes the chlorophyll side.
		porphyrin: clamp01(proteinAffinity * 0.4 + plantAverage * 0.2),
	};
}

function clamp01(v: number): number {
	return Math.max(0, Math.min(1, v));
}
