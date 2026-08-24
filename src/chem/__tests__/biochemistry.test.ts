import { describe, expect, it } from "vitest";
import { backboneScore, chainStability, deriveBiochemistry, inBackbone } from "../biochemistry";
import { CATENATION, HYDROLYSIS } from "../elements";

/**
 * Life's chemistry is derived from the world, not assumed.
 *
 * These tests pin the PHYSICS, not a preferred outcome. Every expectation
 * below should be defensible from bond energies and hydrolysis alone — if a
 * future change makes one fail, the question is which is wrong, the change or
 * the chemistry.
 */
describe("biochemistry", () => {
	describe("chain stability", () => {
		it("falls as temperature rises", () => {
			const cold = chainStability("C", 200);
			const warm = chainStability("C", 600);
			const hot = chainStability("C", 1200);
			expect(cold).toBeGreaterThan(warm);
			expect(warm).toBeGreaterThan(hot);
		});

		// Calibration anchor: organics pyrolyse in the 700-900 K range.
		it("has carbon chemistry mostly gone by 800 K", () => {
			expect(chainStability("C", 800)).toBeLessThan(0.2);
			expect(chainStability("C", 288)).toBeGreaterThan(0.4);
		});

		// The stronger catenator survives further, everywhere water isn't the
		// deciding factor.
		it("favours the stronger catenator when dry", () => {
			expect(chainStability("C", 600)).toBeGreaterThan(chainStability("Si", 600));
			expect(chainStability("C", 200)).toBeGreaterThan(chainStability("Si", 200));
		});

		// Si-O-Si hydrolyses; this is why Earth's silicon is silicate rock.
		it("collapses silicon where water is liquid", () => {
			expect(chainStability("Si", 288)).toBeLessThan(0.05);
		});

		it("spares carbon from hydrolysis", () => {
			// No notch across the liquid-water range for carbon.
			expect(chainStability("C", 288)).toBeGreaterThan(chainStability("C", 400));
		});

		it("restores silicon once the water boils off", () => {
			expect(chainStability("Si", 400)).toBeGreaterThan(chainStability("Si", 288) * 10);
		});

		it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
			"rejects a non-physical absolute temperature: %s",
			(kelvin) => {
				expect(() => chainStability("C", kelvin)).toThrow(/chainStability: kelvin/);
			},
		);

		it("rejects an unsupported backbone from untyped JavaScript", () => {
			expect(() => chainStability("Fe" as never, 288)).toThrow(
				/chainStability: symbol must be C, Si, or S/,
			);
		});
	});

	describe("backbone choice", () => {
		it("chooses carbon on an Earth-like world", () => {
			expect(deriveBiochemistry({}, 288).backbone).toBe("C");
		});

		it("chooses carbon decisively there", () => {
			expect(deriveBiochemistry({}, 288).margin).toBeGreaterThan(10);
		});

		// The strongest claim here: liquid water vetoes silicon outright.
		// Abundance cannot buy its way past hydrolysis.
		it("keeps carbon on a wet world however silicon-rich", () => {
			expect(deriveBiochemistry({ Si: 500 }, 288).backbone).toBe("C");
		});

		it("chooses silicon on a hot, dry, silicon-rich world", () => {
			expect(deriveBiochemistry({ Si: 30 }, 500).backbone).toBe("Si");
		});

		// Dryness alone is not enough — silicon still needs to be plentiful.
		it("keeps carbon on a dry world of ordinary composition", () => {
			expect(deriveBiochemistry({}, 500).backbone).toBe("C");
		});

		// Carbon's stronger bonds outlast silicon's as conditions worsen, so
		// the enrichment silicon needs goes UP with heat.
		it("demands more silicon the hotter the world gets", () => {
			expect(deriveBiochemistry({ Si: 30 }, 500).backbone).toBe("Si");
			expect(deriveBiochemistry({ Si: 30 }, 700).backbone).toBe("C");
		});

		it("chooses sulfur when sulfur overwhelmingly dominates", () => {
			expect(deriveBiochemistry({ S: 200 }, 288).backbone).toBe("S");
		});

		it("reports why a backbone won", () => {
			expect(deriveBiochemistry({}, 288).rationale).toMatch(/[Cc]arbon/);
			expect(deriveBiochemistry({ Si: 30 }, 500).rationale).toMatch(/[Ss]ilicon/);
		});

		it("explains silicon by the absence of water", () => {
			expect(deriveBiochemistry({ Si: 30 }, 500).rationale).toMatch(/water/i);
		});

		/**
		 * The genuine crossover the header promises: silicon can win even on a
		 * WET world, if it is abundant enough to overcome the hydrolysis penalty
		 * carbon does not pay. Every other silicon test in this file is dry
		 * (kelvin >= 500), so the "Silicon ... survive this world's water"
		 * rationale string had never actually been produced by this function.
		 */
		it("chooses silicon even on a wet world when silicon is overwhelming", () => {
			const result = deriveBiochemistry({ Si: 100_000 }, 288);
			expect(result.backbone).toBe("Si");
			expect(result.rationale).toMatch(/[Ss]ilicon/);
			expect(result.rationale).toMatch(/survive this world's water/i);
		});

		/**
		 * The rationale has to name the DECIDING CONDITION, not restate the
		 * result.
		 *
		 * This is the assay that was missing, and its absence let a real defect
		 * ship: `wet` was computed here and used only in silicon's branch, so
		 * carbon — the case a player almost always sees — said "it chains to
		 * itself more strongly than anything else here". That is true of carbon
		 * on every world, so it tells a player nothing about THEIR world and
		 * reads as the game simply preferring carbon. The whole derivation
		 * exists to dispel exactly that impression.
		 *
		 * Liquid water is what actually decides it: Si-O-Si hydrolyses, C-C does
		 * not, so the condition that makes a world habitable is the one that
		 * vetoes silicon.
		 */
		it("explains carbon by the PRESENCE of water on a wet world", () => {
			const wet = deriveBiochemistry({}, 288);
			expect(wet.backbone).toBe("C");
			expect(wet.rationale).toMatch(/water/i);
		});

		// The converse, so the string is not just always mentioning water. On a
		// dry world there is no water to credit, and claiming otherwise would be
		// a lie the player could catch by reading the temperature beside it.
		it("does not credit water on a world too hot to have any", () => {
			const dry = deriveBiochemistry({}, 700);
			expect(dry.backbone).toBe("C");
			expect(dry.rationale).not.toMatch(/liquid water/i);
		});

		// A rationale that restates the result teaches nothing. Carbon chaining
		// strongly is a property of carbon, not of this world.
		it("does not answer with a tautology about the winner", () => {
			expect(deriveBiochemistry({}, 288).rationale).not.toMatch(/chains to itself more strongly/i);
		});

		it("is deterministic for the same world", () => {
			const a = deriveBiochemistry({ Si: 12 }, 420);
			const b = deriveBiochemistry({ Si: 12 }, 420);
			expect(a).toEqual(b);
		});

		/**
		 * `margin` is `winner.score / runnerUp.score`, guarded by
		 * `runnerUp.score > 0` so a zero runner-up reports Infinity rather than
		 * NaN. At an ordinary temperature the runner-up's score is always some
		 * tiny positive float, so that guard's false branch had never actually
		 * run. On an absurdly hot world every candidate's Arrhenius survival
		 * term underflows to exactly 0 — the winner included — which is exactly
		 * when the guard matters: `0 / 0` is NaN, and the guard exists so the
		 * result is a defensible "no contest" Infinity instead.
		 */
		it("reports an infinite margin rather than NaN when every candidate's score underflows to zero", () => {
			const result = deriveBiochemistry({}, 500_000);
			expect(result.margin).toBe(Number.POSITIVE_INFINITY);
			expect(Number.isNaN(result.margin)).toBe(false);
		});
	});

	describe("the tables it rests on", () => {
		it("ranks catenation the way measured bond energies do", () => {
			expect(CATENATION.C).toBeGreaterThan(CATENATION.Si);
			expect(CATENATION.C).toBeGreaterThan(CATENATION.S);
			expect(CATENATION.Si).toBeGreaterThan(CATENATION.O);
		});

		it("ranks hydrolysis with carbon immune and silicon worst", () => {
			expect(HYDROLYSIS.C).toBe(0);
			expect(HYDROLYSIS.Si).toBeGreaterThan(HYDROLYSIS.S);
		});

		it("scores an absent element at zero", () => {
			expect(backboneScore("Si", { Si: 0 }, 500)).toBe(0);
		});

		it("rejects invalid world abundances before they can reverse or poison a score", () => {
			expect(() => backboneScore("C", { C: -1 }, 288)).toThrow(
				/backboneScore: worldAbundance\.C cannot be negative/,
			);
			expect(() => deriveBiochemistry({ Si: Number.NaN }, 500)).toThrow(
				/deriveBiochemistry: worldAbundance\.Si must be a finite number/,
			);
		});

		it("rejects a missing abundance record with an argument-specific error", () => {
			expect(() => deriveBiochemistry(undefined as unknown as Record<string, number>, 288)).toThrow(
				/deriveBiochemistry: worldAbundance must be an object, got undefined/,
			);
		});
	});

	// A tissue means the same thing structurally on any world; only the chain
	// element changes.
	describe("expressing tissue in a backbone", () => {
		it("substitutes the backbone for the placeholder", () => {
			const template = { X: 6, H: 12, O: 6 };
			expect(inBackbone(template, "C")).toEqual({ C: 6, H: 12, O: 6 });
			expect(inBackbone(template, "Si")).toEqual({ Si: 6, H: 12, O: 6 });
		});

		it("merges when the backbone already appears", () => {
			expect(inBackbone({ X: 2, S: 1 }, "S")).toEqual({ S: 3 });
		});

		it("leaves a template without a placeholder alone", () => {
			expect(inBackbone({ H: 2, O: 1 }, "Si")).toEqual({ H: 2, O: 1 });
		});

		it("rejects an unsupported substitution backbone", () => {
			expect(() => inBackbone({ X: 1 }, "Fe" as never)).toThrow(
				/inBackbone: backbone must be C, Si, or S/,
			);
		});
	});
});
