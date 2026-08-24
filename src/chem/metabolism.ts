import type { Backbone } from "./biochemistry.js";
import {
	type BiomoleculeId,
	type Composition,
	EMPTY_COMPOSITION,
	growthCost,
	normalise,
} from "./biomolecules.js";
import { backbone as checkBackbone, nonNegative, object, quantities } from "./validate.js";

/**
 * You are what you eat.
 *
 * This is the loop that makes the chemistry matter rather than decorate: food
 * carries biomolecules, activity decides which of them get built into tissue,
 * and tissue decides the body. A pet fed on sugar and never exercised becomes
 * a soft thing; the same seed fed protein and played with daily becomes a
 * muscled one.
 *
 * Pure functions only — no draws, no hidden state — so a life replays exactly
 * from its seed. See docs/BIOLOGY.md.
 */

/** What a food is made of, as parts (normalised on intake). */
export type FoodProfile = Partial<Record<BiomoleculeId, number>>;

export interface MetabolicState {
	/** Tissue tally, unnormalised. Grows over a life. */
	tissue: Composition;
	/** Unspent intake awaiting a use. */
	reserve: number;
}

const NEWBORN_TISSUE: Readonly<Composition> = Object.freeze({
	...EMPTY_COMPOSITION,
	sugar: 2,
	protein: 1,
});

export const NEWBORN: MetabolicState = {
	tissue: { ...NEWBORN_TISSUE },
	reserve: 0,
};

export interface ActivityDemand {
	/** Exercise: play and walks. Drives protein into muscle. */
	exertion: number;
	/** Growth pressure: young pets build structure. */
	growth: number;
	/** Rest: sleep converts reserve into insulation. */
	rest: number;
}

/**
 * Reference growth costs on carbon, the backbone every existing tuning
 * number below was implicitly measured against. `structuralShare` divides by
 * these so a carbon world reproduces the original hand-tuned demand exactly,
 * and only a non-carbon backbone shifts it.
 */
const CARBON_MINERAL_COST = growthCost("mineral", "C");
const CARBON_CHITIN_COST = growthCost("chitin", "C");
const CARBON_KERATIN_COST = growthCost("keratin", "C");

/**
 * How much of a structural tissue an activity should call for, scaled by how
 * costly that tissue actually is to build on this world's backbone.
 *
 * `metabolise`'s build step already discounts costly tissue once, at the
 * `1 / (1 + growthCost * 0.25)` line — that is chemistry saying "scarce
 * material builds slowly even when demanded". This is a different discount:
 * demand itself. A creature does not evolve to WANT the maximally expensive
 * skeleton it could theoretically have; it calls for what its own backbone
 * makes practical, the way a phosphorus-poor world's animals lean less on
 * bone than a phosphorus-rich one's, not just build it slower once asked.
 *
 * `referenceCost` is the same tissue's cost on carbon — the backbone every
 * literal below (0.2, 0.5, 0.15, 0.1) was tuned against — so a carbon world
 * reproduces those numbers exactly and only a different backbone moves them.
 * A backbone whose version of a tissue is CHEAPER than carbon's calls for
 * more of it; a costlier one calls for less. This is `growthCost`'s own
 * cross-backbone comparison (see biomolecules.test.ts "makes silicon tissue
 * costlier to grow"), reused here rather than re-derived.
 */
function structuralShare(id: BiomoleculeId, referenceCost: number, backbone: Backbone): number {
	if (backbone === "C") return 1;
	const cost = growthCost(id, backbone);
	if (cost <= 0) return 1;
	return referenceCost / cost;
}

/**
 * Which tissue an activity builds.
 *
 * Exertion builds muscle and the structure to carry it. Growth builds
 * skeleton AND the muscle to carry it — a growing body lays down both
 * together, the way a growing vertebrate's bone and muscle mass track each
 * other rather than a skeleton first and flesh later. Rest banks lipid. Idle
 * intake becomes sugar, which is why an unexercised pet stays soft whatever
 * it is fed.
 *
 * Growth's protein share is deliberately smaller than exertion's (0.25 vs
 * 0.7): exertion is specifically the muscle-building demand, growth's
 * protein term exists so a growing body is not calling for a skeleton out of
 * minerals alone — the most nutritious ordinary meal (protein, lipid, sugar)
 * previously had ZERO overlap with growth demand and built no tissue however
 * fast a pet grew, which is the gap this closes.
 *
 * The structural terms (mineral, chitin, keratin) scale with the world's
 * actual backbone chemistry via `structuralShare`; protein and lipid do not,
 * because muscle and fat are not backbone-substituted tissue the way
 * mineral/chitin/keratin's carbon atoms are (see `asBackbone` — mineral has
 * no carbon to begin with, and protein/lipid's role is metabolic rather than
 * structural).
 */
function demandProfile(a: ActivityDemand, backbone: Backbone = "C"): FoodProfile {
	const out: FoodProfile = {};
	if (a.exertion > 0) {
		out.protein = a.exertion * 0.7;
		out.mineral = a.exertion * 0.2 * structuralShare("mineral", CARBON_MINERAL_COST, backbone);
	}
	if (a.growth > 0) {
		out.protein = (out.protein ?? 0) + a.growth * 0.25;
		out.mineral =
			(out.mineral ?? 0) +
			a.growth * 0.5 * structuralShare("mineral", CARBON_MINERAL_COST, backbone);
		out.chitin = a.growth * 0.15 * structuralShare("chitin", CARBON_CHITIN_COST, backbone);
		out.keratin = a.growth * 0.1 * structuralShare("keratin", CARBON_KERATIN_COST, backbone);
	}
	if (a.rest > 0) out.lipid = a.rest * 0.5;
	return out;
}

/**
 * Convert intake into tissue.
 *
 * A tissue is only built if the food supplied its inputs AND the pet's
 * activity called for it, so feeding protein to a sedentary pet banks lipid
 * rather than building muscle. Scarcer tissues build more slowly, which is
 * how phosphorus scarcity becomes something the player feels.
 *
 * `backbone` defaults to carbon, so every existing caller (and every
 * pre-existing test) is unaffected. A caller that knows the creature's world
 * — `currentBackbone()` in the pet game — passes it through, and the demand
 * AND build-speed discount both then read from the same world chemistry
 * rather than assuming carbon regardless of which backbone actually won.
 */
export function metabolise(
	state: MetabolicState,
	food: FoodProfile,
	activity: ActivityDemand,
	backbone: Backbone = "C",
): MetabolicState {
	const current = canonicalState(state, "metabolise", false);
	object("metabolise", "food", food);
	quantities("metabolise", "food", food as Record<string, number>);
	for (const id of Object.keys(food)) {
		if (!Object.hasOwn(EMPTY_COMPOSITION, id)) {
			throw new TypeError(`metabolise: food.${id} is not a known tissue`);
		}
	}
	object("metabolise", "activity", activity);
	const checkedActivity: ActivityDemand = {
		exertion: nonNegative("metabolise", "activity.exertion", activity.exertion),
		growth: nonNegative("metabolise", "activity.growth", activity.growth),
		rest: nonNegative("metabolise", "activity.rest", activity.rest),
	};
	const checkedBackbone = checkBackbone("metabolise", "backbone", backbone);

	const tissue = { ...current.tissue };
	const demand = demandProfile(checkedActivity, checkedBackbone);
	let reserve = current.reserve;

	for (const id of TISSUE_IDS) {
		const supplied = food[id] ?? 0;
		const wanted = demand[id] ?? 0;
		// Building needs both the material and a reason to build it.
		const built = Math.min(supplied, wanted) / (1 + growthCost(id, checkedBackbone) * 0.25);
		tissue[id] = (tissue[id] ?? 0) + built;
		reserve += supplied - built;
	}

	// Intake the body had no use for is mostly excreted. A small fraction is
	// kept — as fat while resting, otherwise as circulating sugar. Without
	// this loss, every diet converges on sugar and what the pet ate stops
	// mattering, which would defeat the whole loop.
	if (reserve > 0) {
		const kept = reserve * 0.12;
		const toLipid = checkedActivity.rest > 0 ? kept * 0.7 : 0;
		tissue.lipid = (tissue.lipid ?? 0) + toLipid;
		tissue.sugar = (tissue.sugar ?? 0) + kept - toLipid;
		reserve = 0;
	}

	// Sugar is fuel, not structure: it is spent living and does not accumulate.
	const spent = (tissue.sugar ?? 0) * 0.06;
	tissue.sugar = Math.max(0, (tissue.sugar ?? 0) - spent);

	// Resting converts some of that spent fuel into lipid rather than losing
	// it. This is why a fed creature that sleeps it off becomes a round one and
	// one that is walked becomes a lean one: the same meal, different
	// destination.
	//
	// Rest deliberately acts on STORED fuel rather than on intake reserve.
	// Reserve is consumed inside the same call that receives it, so a rest tick
	// arriving later found an empty body and banked nothing — the consuming
	// game had sleep wired up and doing precisely nothing until this changed.
	if (checkedActivity.rest > 0) {
		tissue.lipid = (tissue.lipid ?? 0) + spent * 0.5 * checkedActivity.rest;
	}

	// Exertion burns stores. The other half of the same fact: a worked body
	// spends its fat where a rested one lays it down, so what a creature is
	// made of records how it was kept and not only what it was fed.
	if (checkedActivity.exertion > 0) {
		const burned = (tissue.lipid ?? 0) * 0.12 * checkedActivity.exertion;
		tissue.lipid = Math.max(0, (tissue.lipid ?? 0) - burned);
	}

	return { tissue, reserve };
}

/** The body's current makeup, as fractions. */
export function composition(state: MetabolicState): Composition {
	return normalise(canonicalState(state, "composition", false).tissue);
}

/** Total tissue built, which is what "weight" actually measures. */
export function bodyMass(state: MetabolicState): number {
	return Object.values(canonicalState(state, "bodyMass", false).tissue).reduce((a, b) => a + b, 0);
}

/**
 * Tissue units per kilogram.
 *
 * bodyMass() counts tissue units, which are arbitrary — a newborn is 3 and a
 * grown pet is a few dozen. The peer-reviewed scaling laws in src/bio-laws
 * are all calibrated in KILOGRAMS, and feeding them raw tissue units would
 * produce numbers that typecheck and mean nothing: Damuth's law on a "mass"
 * of 8 would report the population density of an eight-kilogram animal.
 *
 * So the conversion is explicit and lives here, next to the thing it
 * converts. One unit is 50 g, which puts a newborn at 150 g and a well-grown
 * creature in the low kilograms — the range of a small mammal, which is what
 * this creature reads as.
 */
export const KG_PER_TISSUE_UNIT = 0.05;

const TISSUE_IDS = Object.keys(EMPTY_COMPOSITION) as BiomoleculeId[];

/** A new object every time: callers may evolve a loaded state in place. */
function newbornState(): MetabolicState {
	return { tissue: { ...NEWBORN_TISSUE }, reserve: 0 };
}

/**
 * Turn unknown persisted data into the complete schema calculations expect.
 *
 * Missing tissue keys are a supported legacy shape and become zero. Unknown
 * numeric keys are ignored for forward compatibility. A record with no known
 * tissue at all is not a metabolic state, even if it happens to be an object.
 */
function canonicalState(value: unknown, fn: string, allowMissingReserve: boolean): MetabolicState {
	const state = object(fn, "state", value as MetabolicState | undefined);
	const tissue = object(fn, "state.tissue", (state as { tissue?: Record<string, number> }).tissue);
	quantities(fn, "state.tissue", tissue);

	const canonical = { ...EMPTY_COMPOSITION };
	let recognised = 0;
	for (const id of TISSUE_IDS) {
		if (!Object.hasOwn(tissue, id)) continue;
		canonical[id] = tissue[id] as number;
		recognised += 1;
	}
	if (recognised === 0) {
		throw new TypeError(`${fn}: state.tissue must include at least one known tissue`);
	}

	const rawReserve = (state as { reserve?: unknown }).reserve;
	const reserve =
		allowMissingReserve && rawReserve === undefined
			? 0
			: nonNegative(fn, "state.reserve", rawReserve);

	return { tissue: canonical, reserve };
}

/**
 * Read a metabolic state that was persisted as JSON.
 *
 * koota traits hold flat values, so the state lives as a string on the
 * Metabolism trait. A malformed or absent record falls back to a newborn
 * rather than throwing, so an old save loads into the new system instead of
 * bricking — and so a caller reading mass never has to handle a parse error
 * to answer "how big is it".
 */
export function readMetabolicState(raw: string | undefined): MetabolicState {
	if (!raw) return newbornState();
	try {
		return canonicalState(JSON.parse(raw) as unknown, "readMetabolicState", true);
	} catch {
		return newbornState();
	}
}

/**
 * Serialise a validated, canonical metabolic state for persistence.
 *
 * Reads are forgiving because storage can be old or corrupt. Writes reject a
 * bad state instead: persisting a NaN as JSON `null` would make the corruption
 * durable and erase the argument name that caused it.
 */
export function writeMetabolicState(state: MetabolicState): string {
	return JSON.stringify(canonicalState(state, "writeMetabolicState", false));
}

/** Body mass in kilograms, for the scaling laws. */
export function bodyMassKg(state: MetabolicState): number {
	return bodyMass(state) * KG_PER_TISSUE_UNIT;
}
