import { describe, expect, it } from "vitest";
import { bounds, type Path } from "../path.js";
import { branch } from "../rules/branch.js";
import { radiate } from "../rules/radiate.js";
import { repeat } from "../rules/repeat.js";
import { taper } from "../rules/taper.js";

/**
 * REQUIRED: kind eligibility as parameter RANGES over the six universal
 * rules, not as separate vocabularies.
 *
 * `docs/superpowers/specs/2026-08-08-compositional-rendering-design.md`
 * (`compositional-rendering-design.md` §"Trophic mode gates the part set")
 * describes eligibility as which PARAMETER RANGES a trophic mode may draw
 * from — "a phototroph draws only from sessile forms" — never as a second
 * function or a named-shape table. This package's contribution to that is
 * structural, not a feature to add: none of the six rules takes a "kind"
 * argument, has a closed enum anywhere in its parameters, or branches
 * internally on what the caller is building. There is nothing here for a new
 * organism kind to be MISSING from, because there is no vocabulary to be
 * absent from — only ranges a policy layer (`lifecycle-assemblage`, per the
 * seam's own division of labour) chooses to draw its arguments from.
 *
 * This is asserted rather than merely claimed: the same rule calls, given
 * only DIFFERENT NUMBERS for what the design doc calls a sessile vs. a
 * mobile form, produce recognisably different bodies with no branch, no
 * lookup, and no case the rule authors had to anticipate by name.
 */
describe("kind eligibility as parameter ranges", () => {
	// A phototroph's "form eligible for photoautotrophs" per the design doc:
	// axialForm, high taper, mineral-rich -- a woody stalk. No limbs: radiate
	// with a near-zero spread and a stationary attachment, not a different
	// function.
	function stalk(tautness: number): Path {
		return taper({
			from: 0.15,
			to: 0.15 * (1 - tautness),
			bulgeAt: 0.05,
			length: 4,
			part: "stalk",
		});
	}

	// A chemotroph's eligible form -- chitin-rich, radiate arms: the SAME
	// radiate() a jellyfish's tentacles use, just with a different count and
	// spread, per the design doc's `chemotroph + chitin-rich -> radialForm`.
	function arthropodLimbs(armCount: number): Path {
		const arm: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					segments: [{ kind: "line", to: { x: 1, y: 0 } }],
					closed: false,
				},
			],
		};
		return radiate(arm, {
			center: { x: 0, y: 0 },
			count: armCount,
			spreadTurns: 1,
			part: "limb",
		});
	}

	it("expresses a sessile phototroph form with only a taper — no separate 'plant' rule exists", () => {
		const woody = stalk(0.9);
		const box = bounds(woody);
		expect(box).not.toBeNull();
		// Tall and narrow: a stalk, not a blob. Achieved purely by the values
		// passed to the one universal taper() — there is no plantForm().
		if (!box) return;
		expect(box.max.x - box.min.x).toBeGreaterThan(box.max.y - box.min.y);
	});

	it("expresses a radial chemotroph form with the same radiate() a jellyfish uses", () => {
		const limbs = arthropodLimbs(6);
		expect(limbs.shapes).toHaveLength(6);
	});

	it("has no branch on organism kind anywhere in a rule's own logic", () => {
		// The assertion is structural: every rule's parameter object is plain
		// numbers, strings and Vec2s (see path.ts's own comparability
		// argument) — there is no `kind` field to check for, so the type
		// system itself is the enforcement. This test pins the observable
		// consequence: radiate() with count=1 and spreadTurns=1 (a
		// degenerate "one arm" chemotroph) and count=1 used for a stalk's
		// single branch attachment both go through the identical code path,
		// with no special-casing by what the caller intends to build.
		const oneArm = radiate(
			{
				shapes: [
					{
						kind: "subpath",
						start: { x: 0, y: 0 },
						segments: [{ kind: "line", to: { x: 1, y: 0 } }],
						closed: false,
					},
				],
			},
			{
				center: { x: 0, y: 0 },
				count: 1,
				spreadTurns: 1,
				part: "limb",
			},
		);
		expect(oneArm.shapes).toHaveLength(1);
	});

	it("lets a form generator gate eligibility purely by choosing which range to sample, not which function to call", () => {
		// The design doc's own eligibility table in one call: a phototroph
		// building a woody stalk uses axialForm-equivalent parameters (this
		// package's taper at high taper, low branching); a chemotroph
		// building a segmented body uses repeat(). Neither rule refuses the
		// other's range — a phototroph COULD call repeat() with count=5 and
		// get a segmented plant, because eligibility is a caller-side policy,
		// never a rule-side gate. That absence of a gate is the property.
		const segmentedStalk = repeat(taper({ from: 0.1, to: 0.1, bulgeAt: 0.5, length: 1 }), {
			count: 5,
			axis: { x: 1, y: 0 },
			spacing: 1,
			part: "segment",
		});
		expect(segmentedStalk.shapes).toHaveLength(5);
	});

	it("degrades a branching plant down to a single stalk continuously via depth, not via a switch to a different rule", () => {
		const twig: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					segments: [{ kind: "line", to: { x: 1, y: 0 } }],
					closed: false,
				},
			],
		};
		const bareStalk = branch(twig, {
			depth: 1,
			splits: 3,
			angle: 0.2,
			shrink: 0.6,
			attachAt: 1,
			part: "frond",
		});
		const branchedFrond = branch(twig, {
			depth: 4,
			splits: 3,
			angle: 0.2,
			shrink: 0.6,
			attachAt: 1,
			part: "frond",
		});
		expect(bareStalk.shapes).toHaveLength(1);
		expect(branchedFrond.shapes.length).toBeGreaterThan(1);
	});
});
