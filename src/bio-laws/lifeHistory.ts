import { finite, nonNegative, positive } from "./validate.js";

/**
 * Life history laws — how an organism spends the mass it has.
 *
 * Ported from a peer-reviewed-laws reference used across sibling
 * simulation games, whose governing rule is worth restating because it is
 * what makes this package's causality real rather than plausible:
 *
 *   "If it exists in a peer-reviewed journal, we implement it EXACTLY.
 *    No approximations. No game balance tweaks."
 *
 * Everything here is cited. Where a constant appears without a source it is a
 * bug, not a design decision.
 *
 * These matter here because reproduction and growth were the two places this
 * simulation was still guessing. A creature differentiated at an invented mass
 * threshold, and reproductive strategy was read off tissue fractions with
 * hand-picked cutoffs. Both are solved problems with measured scaling laws,
 * and using the real ones costs nothing.
 */

/**
 * von Bertalanffy growth in mass.
 *
 * Source: von Bertalanffy, L. (1938). "A quantitative theory of organic
 * growth." Human Biology, 10(2), 181-213.
 *
 *   W(t) = W_max × (1 - e^(-K(t - t0)))^b
 *
 * The standard model for indeterminate growers. Growth is fast while small
 * and asymptotes toward a maximum the organism never quite reaches — which is
 * why a well-fed creature does not grow without bound, and why the last
 * increment of size is the most expensive one it will ever buy.
 */
export function vonBertalanffyMass(
	age: number,
	maxMass: number,
	growthRate: number,
	t0 = 0,
	b = 3,
): number {
	nonNegative("vonBertalanffyMass", "age", age);
	nonNegative("vonBertalanffyMass", "maxMass", maxMass);
	nonNegative("vonBertalanffyMass", "growthRate", growthRate);
	finite("vonBertalanffyMass", "t0", t0);
	finite("vonBertalanffyMass", "b", b);

	const growth = 1 - Math.exp(-growthRate * (age - t0));
	// Before t0 the model is undefined rather than negative.
	if (growth <= 0) return 0;
	return maxMass * growth ** b;
}

/**
 * Offspring count from the size/number trade-off.
 *
 * Source: Charnov, E.L. & Ernest, S.K.M. (2006). "The offspring-size/
 * clutch-size trade-off in mammals." The American Naturalist, 167(4), 578-582.
 *
 * Total reproductive output is roughly constant for a given parent mass, so a
 * lineage chooses between many small offspring and few large ones — it cannot
 * have both. r-selected strategies allocate ~25% of body mass to reproduction;
 * K-selected ~10%.
 *
 * This is the real content of "reproductive strategy": not which container the
 * offspring arrives in, but how the parent divides a fixed budget.
 */
export function clutchSize(parentMass: number, offspringMass: number, rSelected = false): number {
	nonNegative("clutchSize", "parentMass", parentMass);
	nonNegative("clutchSize", "offspringMass", offspringMass);

	if (offspringMass <= 0) return 0;
	const allocation = rSelected ? 0.25 : 0.1;
	const reproductiveMass = parentMass * allocation;
	return Math.max(1, Math.floor(reproductiveMass / offspringMass));
}

/**
 * Age at first reproduction, as a fraction of maximum lifespan.
 *
 * Source: Charnov & Ernest (2006), as above.
 *
 * Invariant across an enormous range of body sizes: organisms begin
 * reproducing at roughly a quarter of their potential lifespan.
 */
export function ageAtFirstReproduction(maxLifespan: number): number {
	// This one did not produce a NaN — it produced something worse, a
	// confident negative age from a negative lifespan, which no downstream
	// check would ever think to question.
	nonNegative("ageAtFirstReproduction", "maxLifespan", maxLifespan);
	return 0.25 * maxLifespan;
}

/**
 * Population density from body mass.
 *
 * Source: Damuth, J. (1981). "Population density and body size in mammals."
 * Nature, 290(5808), 699-700.
 *
 *   log10(D) = 4.23 - 0.75 × log10(M)
 *
 * Large animals are rare because each one needs more resources. This is what
 * makes a big creature's world feel empty and a small one's crowded, without
 * anyone tuning a spawn rate.
 */
export function populationDensity(massKg: number): number {
	nonNegative("populationDensity", "massKg", massKg);
	if (massKg <= 0) return 0;
	return 10 ** (4.23 - 0.75 * Math.log10(massKg));
}

/**
 * Expected brain mass for a given body mass.
 *
 * Source: Jerison, H.J. (1973). "Evolution of the Brain and Intelligence."
 * Academic Press.
 *
 *   Brain_expected = 0.01 × M^0.75
 */
export function expectedBrainMass(bodyMassKg: number): number {
	// `(-5) ** 0.75` is NaN: a negative base to a fractional exponent has no
	// real root. That is where the nulls were coming from.
	nonNegative("expectedBrainMass", "bodyMassKg", bodyMassKg);
	return 0.01 * bodyMassKg ** 0.75;
}

/**
 * Encephalization quotient — brain mass relative to what body size predicts.
 *
 * Source: Jerison (1973), as above.
 *
 * EQ ~1 is average for a mammal; 4-5 is elephant or dolphin; ~7 is human. It
 * is the honest way to say "how clever is it" without inventing a stat.
 */
export function encephalizationQuotient(brainMassKg: number, bodyMassKg: number): number {
	nonNegative("encephalizationQuotient", "brainMassKg", brainMassKg);
	nonNegative("encephalizationQuotient", "bodyMassKg", bodyMassKg);

	const expected = expectedBrainMass(bodyMassKg);
	if (expected <= 0) return 0;
	return brainMassKg / expected;
}

/**
 * Maximum stable social group size, from neocortex ratio.
 *
 * Source: Dunbar, R.I.M. (1992). "Neocortex size as a constraint on group size
 * in primates." Journal of Human Evolution, 22(6), 469-493.
 *
 *   log10(N) = 0.093 + 3.389 × log10(CR)
 *
 * CR is the neocortex volume divided by the volume of the REST of the brain —
 * not by body mass. It runs about 1.5 in small primates and 4.1 in humans,
 * where this yields 148: Dunbar's number, reproduced from his own regression.
 *
 * The ported PEER_REVIEWED_LAWS.md gives a linear form (N = 42.2 + 3.32 × CR)
 * together with an estimator CR ≈ 4.0 × (Brain/Body)^0.25. Neither survives
 * contact with the paper's headline result: the linear form is bounded near 56
 * across the entire primate CR range and cannot produce 150 at any input, and
 * the estimator returns 1.54 for a human where Dunbar measured 4.1. The assay
 * in lifeHistory.test.ts is what caught it. We implement the log-linear
 * regression and take CR directly, because there is no defensible way to get
 * it from body mass alone.
 *
 * Relevant once companionship exists: how many others a creature can hold
 * relationships with is a consequence of its brain, not a UI limit.
 */
export function maxGroupSize(neocortexRatio: number): number {
	nonNegative("maxGroupSize", "neocortexRatio", neocortexRatio);
	if (neocortexRatio <= 0) return 0;
	return 10 ** (0.093 + 3.389 * Math.log10(neocortexRatio));
}

/**
 * Cost of transport — energy per unit distance per unit mass, J/(kg·m).
 *
 * Source: Schmidt-Nielsen, K. (1972). "Locomotion: Energy Cost of Swimming,
 * Flying, and Running." Science, 177(4045), 222-228.
 *
 * Validated across 27 orders of magnitude of body mass, which makes it one of
 * the most robust relationships in the whole of biomechanics. Swimming is
 * cheapest because buoyancy carries the weight; burrowing is brutal because
 * the animal has to move the ground as well as itself.
 *
 * This is what makes a room's activity genuinely cost something different.
 */
export const costOfTransport = {
	swimming: (massKg: number): number =>
		0.3 * nonNegative("costOfTransport.swimming", "massKg", massKg) ** 0.65,
	flying: (massKg: number): number =>
		1.6 * nonNegative("costOfTransport.flying", "massKg", massKg) ** 0.65,
	running: (massKg: number): number =>
		10.7 * nonNegative("costOfTransport.running", "massKg", massKg) ** 0.68,
	burrowing: (massKg: number): number =>
		360 * nonNegative("costOfTransport.burrowing", "massKg", massKg) ** 0.6,
} as const;

export type Gait = keyof typeof costOfTransport;

/**
 * Mean gut retention time, in hours.
 *
 * Source: Karasov, W.H. & Douglas, A.E. (2013). "Comparative Digestive
 * Physiology." Comprehensive Physiology, 3(2), 741-783.
 *
 *   MRT ∝ M^0.27
 *
 * Bigger animals hold food longer, which is why they can eat worse food. A
 * small creature must eat richly and often; this is the law that says so.
 */
export function gutRetentionTime(massKg: number): number {
	nonNegative("gutRetentionTime", "massKg", massKg);
	return 13 * massKg ** 0.27;
}

/**
 * Boltzmann's constant in electronvolts per kelvin.
 *
 * The unit matters: activation energies for metabolism are quoted in eV in the
 * metabolic-theory literature, so k must be in eV/K for the exponent to be
 * dimensionless. Expressing one in joules and the other in eV is the classic
 * way to get an exponent off by 19 orders of magnitude.
 */
const BOLTZMANN_EV_PER_K = 8.617333262e-5;

/**
 * Average activation energy of metabolic reactions, in electronvolts.
 *
 * Source: Gillooly et al. (2001), which reports 0.6-0.7 eV across the
 * respiratory complex and uses 0.63 eV as the central value. This is not a
 * tuning knob — it is the measured activation energy of the rate-limiting
 * steps of aerobic respiration.
 */
const ACTIVATION_ENERGY_EV = 0.63;

/**
 * The temperature life on Earth is calibrated against, in kelvin.
 *
 * 293.15 K (20 °C) is the reference the metabolic-theory literature normalises
 * to. Any reference would do arithmetically — it only sets where the returned
 * factor equals 1 — but using the literature's keeps the numbers comparable to
 * published rates rather than to a value someone here chose.
 */
export const REFERENCE_TEMPERATURE_K = 293.15;

/**
 * How much faster metabolism runs at a given temperature, relative to 20 °C.
 *
 * Source: Gillooly, J.F., Brown, J.H., West, G.B., Savage, V.M. & Charnov,
 * E.L. (2001). "Effects of size and temperature on metabolic rate." Science,
 * 293(5538), 2248-2251.
 *
 *   B ∝ M^(3/4) · e^(-E / kT)
 *
 * The mass term is `vonBertalanffyMass`'s business and the scaling laws
 * above; this is the Boltzmann-Arrhenius factor alone, normalised so that
 * 20 °C returns exactly 1. A creature on a warm world builds tissue faster
 * from the same meal, and one on a cold world builds it slower — the same
 * chemistry, run at a different rate.
 *
 * This is a RATE multiplier, not an efficiency: it says how fast the reactions
 * proceed, not how much of the food ends up as body. Doubling the rate does
 * not create matter, and the caller is responsible for still conserving it.
 *
 * Deliberately unclamped at the top. Real metabolism does not accelerate
 * forever — proteins denature and the curve collapses past an optimum — but
 * that falling limb is a different law with a different citation, and faking
 * it with a `Math.min` here would be an invented constant sitting in a file
 * whose whole premise is that it contains none. A caller that models a world
 * hot enough for it should apply that law explicitly.
 */
export function thermalRateFactor(kelvin: number): number {
	const t = positive("thermalRateFactor", "kelvin", kelvin);
	const exponent =
		ACTIVATION_ENERGY_EV / (BOLTZMANN_EV_PER_K * REFERENCE_TEMPERATURE_K) -
		ACTIVATION_ENERGY_EV / (BOLTZMANN_EV_PER_K * t);
	return Math.exp(exponent);
}
