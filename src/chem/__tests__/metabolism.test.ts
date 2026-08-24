import { describe, expect, it } from "vitest";
import { compositionColor, dominantTissue, growthCost } from "../biomolecules";
import { bodyMass, composition, type MetabolicState, metabolise, NEWBORN } from "../metabolism";

const liveOn = (
	ticks: number,
	food: Parameters<typeof metabolise>[1],
	activity: Parameters<typeof metabolise>[2],
	backbone: Parameters<typeof metabolise>[3],
): MetabolicState => {
	let s = NEWBORN;
	for (let i = 0; i < ticks; i++) s = metabolise(s, food, activity, backbone);
	return s;
};

const live = (
	ticks: number,
	food: Parameters<typeof metabolise>[1],
	activity: Parameters<typeof metabolise>[2],
): MetabolicState => {
	let s = NEWBORN;
	for (let i = 0; i < ticks; i++) s = metabolise(s, food, activity);
	return s;
};

const IDLE = { exertion: 0, growth: 0, rest: 0 };

describe("metabolism", () => {
	it("builds muscle from protein when the pet actually exerts itself", () => {
		const athlete = live(50, { protein: 1, mineral: 0.4 }, { exertion: 1, growth: 0.3, rest: 0 });
		expect(dominantTissue(composition(athlete))).toBe("protein");
	});

	// The point of the loop: the same food on a sedentary pet is not muscle.
	it("banks protein as sugar when the pet does nothing with it", () => {
		const idle = live(50, { protein: 1, mineral: 0.4 }, IDLE);
		expect(dominantTissue(composition(idle))).toBe("sugar");
	});

	it("turns rest and rich food into insulation", () => {
		const fat = live(50, { lipid: 1, sugar: 0.5 }, { exertion: 0, growth: 0, rest: 1 });
		const c = composition(fat);
		expect(c.lipid).toBeGreaterThan(c.protein);
	});

	// What a body PLAN does with chitin belongs to lifecycle-forms. Here we
	// assert only that the tissue accumulates from the diet.
	it("grows armour from a chitin diet under growth pressure", () => {
		const bug = live(60, { chitin: 1 }, { exertion: 0, growth: 1, rest: 0 });
		const plain = live(60, { sugar: 1 }, { exertion: 0, growth: 1, rest: 0 });
		expect(composition(bug).chitin).toBeGreaterThan(composition(plain).chitin);
	});

	it("builds keratin only from a keratin diet", () => {
		const spined = live(80, { keratin: 1 }, { exertion: 0, growth: 1, rest: 0 });
		const plain = live(80, { sugar: 1 }, { exertion: 0, growth: 1, rest: 0 });
		expect(composition(spined).keratin).toBeGreaterThan(composition(plain).keratin);
	});

	// Scarcity has to be felt, not just declared.
	it("makes skeleton costlier to build than sugar", () => {
		expect(growthCost("mineral")).toBeGreaterThan(growthCost("sugar"));
	});

	// Growth used to map only to mineral, chitin and keratin, so an ordinary
	// meal (protein/lipid/sugar) had ZERO overlap with growth demand and built
	// no tissue however fast a growing pet's chemistry ran — the most
	// nutritious plate in the game contributed nothing structural. A growing
	// vertebrate lays down bone and muscle together, not skeleton first and
	// flesh later, so growth now also calls for protein.
	it("builds muscle under growth pressure too, not skeleton alone", () => {
		const grown = live(60, { protein: 1 }, { exertion: 0, growth: 1, rest: 0 });
		expect(composition(grown).protein).toBeGreaterThan(composition(NEWBORN).protein);
	});

	it("still builds MORE muscle from exertion than from growth alone, for the same protein diet", () => {
		const exerted = live(60, { protein: 1 }, { exertion: 1, growth: 0, rest: 0 });
		const grown = live(60, { protein: 1 }, { exertion: 0, growth: 1, rest: 0 });
		expect(composition(exerted).protein).toBeGreaterThan(composition(grown).protein);
	});

	it("grows the body over a life that builds tissue", () => {
		const young = live(5, { protein: 1, mineral: 0.5 }, { exertion: 1, growth: 1, rest: 0 });
		const old = live(100, { protein: 1, mineral: 0.5 }, { exertion: 1, growth: 1, rest: 0 });
		expect(bodyMass(old)).toBeGreaterThan(bodyMass(young));
	});

	// Sugar is fuel, not structure. A pet fed nothing but sugar and never
	// exercised does not accumulate a body — it just burns what it is given.
	it("does not build a body from sugar alone", () => {
		const fed = live(100, { sugar: 1 }, IDLE);
		expect(bodyMass(fed)).toBeLessThan(bodyMass(NEWBORN) + 2);
	});

	it("keeps composition normalised whatever the diet", () => {
		for (const food of [{ sugar: 1 }, { protein: 3, lipid: 2 }, { mineral: 9 }]) {
			const c = composition(live(30, food, { exertion: 1, growth: 1, rest: 1 }));
			const total = Object.values(c).reduce((a, b) => a + b, 0);
			expect(total).toBeCloseTo(1, 5);
		}
	});

	it("colours a body from the elements it is actually made of", () => {
		const bug = composition(live(60, { chitin: 1 }, { exertion: 0, growth: 1, rest: 0 }));
		const blob = composition(live(60, { sugar: 1 }, IDLE));
		expect(compositionColor(bug)).toMatch(/^#[0-9a-f]{6}$/);
		expect(compositionColor(bug)).not.toBe(compositionColor(blob));
	});
});

/**
 * Demand itself follows the world's chemistry, not only the build-speed
 * discount metabolise() already applied per-tissue.
 *
 * Wires `demandProfile` to `growthCost(id, backbone)` so a creature calls for
 * structural tissue in proportion to how practical its own backbone makes it
 * — the same law `growthCost` already uses to make mineral costlier than
 * sugar, reused for demand rather than only for build speed.
 */
describe("demand follows backbone chemistry", () => {
	const GROW = { exertion: 0, growth: 1, rest: 0 };
	const EXERT = { exertion: 1, growth: 0.3, rest: 0 };

	it("leaves carbon worlds exactly as tuned — the default and every existing caller", () => {
		const carbonImplicit = live(60, { mineral: 1, chitin: 1, keratin: 1 }, GROW);
		const carbonExplicit = liveOn(60, { mineral: 1, chitin: 1, keratin: 1 }, GROW, "C");
		expect(carbonExplicit).toEqual(carbonImplicit);
	});

	// Silicon makes every carbon-bearing tissue costlier to grow
	// (biomolecules.test.ts "makes silicon tissue costlier to grow"), so a
	// silicon creature's own body calls for LESS of it per unit of activity —
	// mirroring cost the same way growthCost already does, rather than
	// wanting the maximally expensive skeleton regardless of what its own
	// chemistry can practically supply.
	it("calls for less chitin on a backbone where chitin costs more to build", () => {
		expect(growthCost("chitin", "Si")).toBeGreaterThan(growthCost("chitin", "C"));

		const carbonBug = liveOn(60, { chitin: 1 }, GROW, "C");
		const siliconBug = liveOn(60, { chitin: 1 }, GROW, "Si");

		expect(composition(siliconBug).chitin).toBeLessThan(composition(carbonBug).chitin);
	});

	it("calls for less keratin on a costlier backbone, same shape as chitin", () => {
		const carbonSpined = liveOn(80, { keratin: 1 }, GROW, "C");
		const siliconSpined = liveOn(80, { keratin: 1 }, GROW, "Si");

		expect(composition(siliconSpined).keratin).toBeLessThan(composition(carbonSpined).keratin);
	});

	it("carries the same structural shift into exertion's mineral demand, not only growth's", () => {
		// growthCost(mineral, backbone) is backbone-invariant (no carbon in
		// P2O8Mg3), so this isolates whether exertion's mineral term runs
		// through structuralShare() at all, independent of protein's own
		// build-speed discount (which DOES change with backbone, since protein
		// contains carbon — that is real chemistry, not this assay's concern).
		const carbonAthlete = liveOn(60, { mineral: 1 }, EXERT, "C");
		const siliconAthlete = liveOn(60, { mineral: 1 }, EXERT, "Si");

		expect(composition(siliconAthlete).mineral).toBeCloseTo(composition(carbonAthlete).mineral, 6);
	});

	// Mineral is P2O8Mg3 — no carbon atom for asBackbone to substitute — so its
	// growth cost, and therefore its demand share, is identical on every
	// backbone. This is the honest answer, not a gap: a phosphorus mineral
	// does not become a different chemical because the animal's OTHER tissue
	// switched backbones.
	it("leaves mineral demand untouched by backbone, since mineral has no carbon to substitute", () => {
		const carbon = liveOn(60, { mineral: 1 }, GROW, "C");
		const silicon = liveOn(60, { mineral: 1 }, GROW, "Si");
		expect(composition(silicon).mineral).toBeCloseTo(composition(carbon).mineral, 6);
	});
});

/**
 * Rest and exertion are symmetric, and that symmetry is what makes a body
 * record how it was kept rather than only what it was fed.
 *
 * These act on STORED fuel, not on intake reserve. Reserve is consumed inside
 * the same metabolise() call that receives it, so anything acting on it later
 * finds an empty body — which is exactly the bug that had sleep wired up and
 * doing nothing in the consuming game.
 */
describe("rest and exertion", () => {
	const FED = { tissue: { ...NEWBORN.tissue, sugar: 10 }, reserve: 0 };
	const REST = { exertion: 0, growth: 0, rest: 1 };
	const WORK = { exertion: 1, growth: 0, rest: 0 };
	const STILL = { exertion: 0, growth: 0, rest: 0 };

	it("banks lipid while resting", () => {
		expect(metabolise(FED, {}, REST).tissue.lipid).toBeGreaterThan(FED.tissue.lipid);
	});

	it("banks nothing while merely idle", () => {
		expect(metabolise(FED, {}, STILL).tissue.lipid).toBe(FED.tissue.lipid);
	});

	it("burns lipid while exerting", () => {
		const fat = { tissue: { ...NEWBORN.tissue, lipid: 5 }, reserve: 0 };
		expect(metabolise(fat, {}, WORK).tissue.lipid).toBeLessThan(5);
	});

	// The claim the whole model rests on: the same meal, kept two ways,
	// produces two different bodies.
	it("sends the same meal to different places", () => {
		let slept = FED;
		let worked = FED;
		for (let i = 0; i < 20; i++) {
			slept = metabolise(slept, {}, REST);
			worked = metabolise(worked, {}, WORK);
		}
		expect(slept.tissue.lipid).toBeGreaterThan(worked.tissue.lipid);
	});

	it("never drives lipid negative", () => {
		let s = { tissue: { ...NEWBORN.tissue, lipid: 0.001 }, reserve: 0 };
		for (let i = 0; i < 200; i++) s = metabolise(s, {}, WORK);
		expect(s.tissue.lipid).toBeGreaterThanOrEqual(0);
	});
});
