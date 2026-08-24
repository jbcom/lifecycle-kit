import { CATENATION, ELEMENTS, HYDROLYSIS } from "./elements.js";
import { backbone as checkBackbone, composition, positive, quantities } from "./validate.js";

/**
 * Which chemistry life is built from — derived, not assumed.
 *
 * This is not speculative xenobiology. Everything below is the ordinary
 * behaviour of the periodic table: bond energies we have measured, hydrolysis
 * we have observed, abundances we have counted in stellar spectra. Given a
 * world's temperature and composition, the chemistry that follows is not a
 * choice anyone makes. It is what happens.
 *
 * On Earth, carbon wins decisively and the reasons are quantitative: carbon
 * self-bonds at 346 kJ/mol against silicon's 226, and carbon is roughly seven
 * times more abundant. Long chains need both, so carbon it is.
 *
 * But two of those facts are conditional. Si-Si and Si-O-Si chains hydrolyse
 * in liquid water — which is why silicon chemistry is discounted for Earth and
 * seriously discussed for hot, dry worlds, where silicones are stable and
 * carbon chains are the ones falling apart. And abundance is set by a galaxy's
 * enrichment history, not by anything universal.
 *
 * So the backbone is SCORED from this world's actual temperature and actual
 * abundances, and whatever wins is what tissue is made of. A player who lands
 * on a hot silicate world is not playing a science-fiction variant. They are
 * watching the same rules produce a different outcome.
 */

export type Backbone = "C" | "Si" | "S";

export interface Biochemistry {
	/** The element long-chain tissue is built around. */
	backbone: Backbone;
	/** Why this one won, for the dex. */
	rationale: string;
	/** How decisively. Near 1 means the runner-up was close. */
	margin: number;
}

/** Elements that can plausibly serve as a life backbone. */
const CANDIDATES: Backbone[] = ["C", "Si", "S"];

/**
 * How well an element's chains survive at a given temperature.
 *
 * Two competing effects, both measured:
 *
 * - **Hydrolysis.** Si-Si and Si-O-Si bonds are attacked by liquid water;
 *   carbon chains are not. This is the single strongest reason Earth is
 *   carbon-based, and it stops applying above the boiling point.
 * - **Thermal cleavage.** Every bond breaks once kT approaches its energy.
 *   Carbon's stronger bonds survive further, but not indefinitely — above
 *   roughly 800 K organic chemistry is unravelling while silicones are not.
 *
 * The result is a genuine crossover rather than a fudge: carbon dominates the
 * liquid-water range, silicon becomes viable once water is gone, and both fail
 * in the extreme heat where nothing holds together.
 */
export function chainStability(symbol: Backbone, kelvin: number): number {
	checkBackbone("chainStability", "symbol", symbol);
	const temperature = positive("chainStability", "kelvin", kelvin);
	const catenation = CATENATION[symbol] ?? 0;
	if (catenation <= 0) return 0;

	// Arrhenius survival: the fraction of bonds NOT thermally dissociated is
	// exp(-E_thermal / E_bond). Near absolute zero every bond holds; as RT
	// climbs toward the bond energy, chains come apart.
	//
	// R = 8.314 J/mol/K, and catenation is kJ/mol, hence the 1000. The factor
	// of 100 is the one empirical number here: a chain needs many consecutive
	// intact bonds, so it fails long before any single bond does. It is
	// calibrated against a real anchor — organic molecules pyrolyse in the
	// 700-900 K range, and at this value carbon stability has fallen to ~0.15
	// by 800 K while remaining ~0.5 at room temperature.
	const CHAIN_LENGTH = 100;
	const survives = Math.exp(-(CHAIN_LENGTH * 8.314 * temperature) / (catenation * 1000));

	// Hydrolysis only matters where water is liquid. Between 273 and 373 K a
	// silicon backbone is being taken apart as fast as it forms; carbon is
	// indifferent. HYDROLYSIS is the fraction of chains lost per unit time.
	const wet = temperature > 273 && temperature < 373 ? 1 : 0;
	const attacked = wet * (HYDROLYSIS[symbol] ?? 0);

	return Math.max(0, survives * (1 - attacked));
}

/**
 * Score an element's suitability as a backbone on this world.
 *
 * Stability decides whether chains persist at all; supply decides whether they
 * can form. Both are necessary, so they multiply — a perfect backbone that is
 * absent builds nothing, and an abundant one that hydrolyses builds nothing
 * either.
 */
export function backboneScore(
	symbol: Backbone,
	worldAbundance: Record<string, number>,
	kelvin = 288,
): number {
	checkBackbone("backboneScore", "symbol", symbol);
	quantities("backboneScore", "worldAbundance", worldAbundance);
	positive("backboneScore", "kelvin", kelvin);
	const element = ELEMENTS[symbol];
	if (!element) return 0;

	// Squared because chain stability is a qualitative threshold: a backbone
	// half as likely to hold together is far worse than half as good, since
	// every link in a long chain has to survive.
	const stability = chainStability(symbol, kelvin) ** 2;

	// Supply enters LINEARLY. An earlier version log-compressed it, which made
	// abundance almost irrelevant — carbon won on a world with 500x the silicon
	// and a hundredth the carbon, which is not chemistry, it is a thumb on the
	// scale.
	const supply = element.abundance * (worldAbundance[symbol] ?? 1);

	return stability * supply;
}

/**
 * Determine a world's biochemistry from its element abundances.
 *
 * Called once per world. Everything a creature is made of follows from it.
 */
export function deriveBiochemistry(
	worldAbundance: Record<string, number>,
	kelvin = 288,
): Biochemistry {
	quantities("deriveBiochemistry", "worldAbundance", worldAbundance);
	positive("deriveBiochemistry", "kelvin", kelvin);
	const scored = CANDIDATES.map((symbol) => ({
		symbol,
		score: backboneScore(symbol, worldAbundance, kelvin),
	})).sort((a, b) => b.score - a.score);

	// CANDIDATES is non-empty so a winner always exists, but the compiler
	// cannot know that from an index. An empty candidate list should be loud
	// rather than silently produce a backbone-less world.
	const winner = scored[0];
	if (!winner) throw new Error("no backbone candidates to score");
	const runnerUp = scored[1];
	const margin =
		runnerUp && runnerUp.score > 0 ? winner.score / runnerUp.score : Number.POSITIVE_INFINITY;

	return {
		backbone: winner.symbol,
		rationale: rationaleFor(winner.symbol, margin, kelvin),
		margin,
	};
}

/**
 * Why this backbone won, in one line a player can read.
 *
 * The point of this string is that the answer was DECIDED rather than assumed,
 * so it has to name the deciding condition and not merely restate the result.
 * "Carbon chains to itself strongly" is true of carbon everywhere and therefore
 * says nothing about THIS world — a player reading it learns that the game
 * likes carbon, which is the exact impression the whole derivation exists to
 * dispel.
 *
 * The deciding condition on any temperate world is liquid water. Si-O-Si bonds
 * hydrolyse and C-C bonds do not, so the same water that makes a world
 * habitable is what vetoes silicon (see `chainStability`). That is the causal
 * link worth surfacing, and it was already computed here as `wet` and then used
 * only in silicon's branch — carbon, the case a player almost always sees,
 * dropped it.
 */
function rationaleFor(symbol: Backbone, margin: number, kelvin: number): string {
	const element = ELEMENTS[symbol];
	const contested = margin < 1.5 ? ", narrowly" : "";
	const wet = kelvin > 273 && kelvin < 373;
	switch (symbol) {
		case "C":
			return wet
				? `Carbon${contested} — this world has liquid water, which breaks silicon chains but not carbon's`
				: `Carbon${contested} — it holds its chains together at ${Math.round(kelvin)} K where the alternatives do not`;
		case "Si":
			return wet
				? `Silicon${contested} — abundant enough to survive this world's water`
				: `Silicon${contested} — no liquid water to break its chains, and plenty of it`;
		case "S":
			return `Sulfur${contested} — this world's chemistry favours it over carbon`;
		default:
			return element?.name ?? symbol;
	}
}

/**
 * The formula for a tissue, expressed in this world's backbone.
 *
 * Templates are written in terms of a backbone atom rather than carbon
 * specifically, so the same tissue means the same thing structurally on any
 * world — a "protein" is a chain with nitrogen and sulfur attached, whatever
 * the chain is made of.
 */
export function inBackbone(
	template: Record<string, number>,
	backbone: Backbone,
): Record<string, number> {
	checkBackbone("inBackbone", "backbone", backbone);
	// An atom count is a count of atoms: a NaN here propagates straight into
	// every molecular mass and growth cost computed from the result.
	composition("inBackbone", "template", template);

	const out: Record<string, number> = {};
	for (const [symbol, count] of Object.entries(template)) {
		const mapped = symbol === "X" ? backbone : symbol;
		out[mapped] = (out[mapped] ?? 0) + count;
	}
	return out;
}
