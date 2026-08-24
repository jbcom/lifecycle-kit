import { describe, expect, it } from "vitest";
import { type Animated, at, bounds, concatPaths, type Path, partBounds, still } from "../path.js";
import { branch } from "../rules/branch.js";
import { pair } from "../rules/pair.js";
import { radiate } from "../rules/radiate.js";
import { repeat } from "../rules/repeat.js";
import { taper } from "../rules/taper.js";

/**
 * REQUIRED ASSAY: a recognisability regression.
 *
 * Not because these argument sets were authored to look right — because they
 * are the canary for whether the six rules still compose like real bodies.
 * If a future change to `repeat`, `pair`, `taper`, `radiate` or `branch`
 * makes an ant stop reading as segmented-with-legs, or a jellyfish stop
 * reading as a bell with trailing tentacles, that is exactly the kind of
 * silent regression a catalogue-based system could never have, and this test
 * exists to make it loud instead.
 *
 * Each check below asserts a STRUCTURAL property a viewer would use to
 * recognise the creature — segment count, bilateral leg pairs, a domed bell
 * over trailing tentacles, a shrinking branching frond — never an exact pixel
 * or an exact coordinate. That is deliberate: the whole point of continuous
 * rules is that many different parameter sets read as "an ant", and pinning
 * one exact geometry here would reintroduce the catalogue failure one level
 * down, in the tests instead of the source.
 */

describe("recognisability: an ant", () => {
	// `repeat` and `pair` each stamp a single homogeneous tag over whatever
	// they place — that is `tagPath`'s documented contract (see path.ts): the
	// outermost rule owns the anatomy of what it wraps. A composite body with
	// BOTH segments and legs is therefore built by composing separately
	// tagged pieces with concatPaths, not by handing repeat a segment+legs
	// unit and hoping two different tags survive one repeat call.
	function ant(): Path {
		const legUnit: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					// Authored pointing away from the body along +y, the axis `pair`
					// reflects across. Length is ~0.3 of the 3-long body: an ant's
					// legs reach about a third of its length, and because a pair
					// spans BOTH sides, a leg longer than half the body would make
					// the animal wider than it is long.
					segments: [{ kind: "line", to: { x: 0, y: 0.9 } }],
					closed: false,
				},
			],
		};
		const segmentUnit = taper({ from: 0.4, to: 0.35, bulgeAt: 0.5, length: 1 });
		const segments = repeat(segmentUnit, {
			count: 3,
			axis: { x: 1, y: 0 },
			spacing: 1,
			part: "segment",
		});
		const legsAtEverySegment = concatPaths(
			pair(legUnit, {
				attachment: { x: 0.5, y: 0.4 },
				part: "leg",
				siteIndex: 0,
			}),
			pair(legUnit, {
				attachment: { x: 1.5, y: 0.4 },
				part: "leg",
				siteIndex: 1,
			}),
			pair(legUnit, {
				attachment: { x: 2.5, y: 0.4 },
				part: "leg",
				siteIndex: 2,
			}),
		);
		return concatPaths(segments, legsAtEverySegment);
	}

	it("has three body segments", () => {
		const groups = partBounds(ant()).filter((p) => p.part === "segment");
		const indices = new Set(groups.map((g) => g.index));
		expect(indices.size).toBe(3);
	});

	it("has bilateral leg pairs at every segment", () => {
		const groups = partBounds(ant()).filter((p) => p.part === "leg");
		// pair() emits 2 legs per segment, repeat() emits 3 segments: 6 legs.
		const indices = new Set(groups.map((g) => g.index));
		expect(indices.size).toBe(6);
	});

	it("is longer along its body axis than it is tall — segmented, not blobby", () => {
		const box = bounds(ant());
		expect(box).not.toBeNull();
		if (!box) return;
		expect(box.max.x - box.min.x).toBeGreaterThan(box.max.y - box.min.y);
	});
});

describe("recognisability: a jellyfish", () => {
	function jellyfish(pulsePhase: number): Path {
		// A pulsing bell: the width breathes with phase, exactly the animation
		// bioluminescent-sea needs and the reason Path stays static while
		// Animated exists one level up (see path.ts's header on time-varying
		// parameters).
		const wrapped = (pulsePhase % 1) * Math.PI * 2;
		const pulse = 0.5 + 0.08 * Math.sin(wrapped);
		const bell = taper({
			from: 0.05,
			to: pulse,
			bulgeAt: 0.1,
			length: 1.6,
			part: "bell",
		});
		const tentacleUnit: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					segments: [
						{
							kind: "cubic",
							control1: { x: 0.3, y: 1 },
							control2: { x: -0.2, y: 2 },
							to: { x: 0, y: 3 },
						},
					],
					closed: false,
				},
			],
		};
		const tentacles = radiate(tentacleUnit, {
			center: { x: 0, y: 1 },
			count: 6,
			spreadTurns: 0.4,
			startTurn: 0.55,
			part: "tentacle",
		});
		return { shapes: [...bell.shapes, ...tentacles.shapes] };
	}

	const animated: Animated = (phase) => jellyfish(phase);

	it("has a domed bell wider than it is tall — a bell, not a sphere", () => {
		const box = bounds({
			shapes: jellyfish(0).shapes.filter((s) => s.tag?.part === "bell"),
		});
		expect(box).not.toBeNull();
		if (!box) return;
		expect(box.max.x - box.min.x).toBeGreaterThan(box.max.y - box.min.y);
	});

	it("has multiple trailing tentacles below the bell", () => {
		const tentacles = partBounds(jellyfish(0)).filter((p) => p.part === "tentacle");
		expect(new Set(tentacles.map((t) => t.index)).size).toBe(6);
		const bellBox = bounds({
			shapes: jellyfish(0).shapes.filter((s) => s.tag?.part === "bell"),
		});
		expect(bellBox).not.toBeNull();
		if (!bellBox) return;
		for (const t of tentacles) {
			// Tentacles extend below (higher y, since +y is down in form space
			// by this test's own convention) the bell's own extent.
			expect(t.max.y).toBeGreaterThan(bellBox.max.y);
		}
	});

	// REQUIRED: time-varying parameters, so bioluminescent-sea can pulse a bell.
	it("pulses: the bell shape at different phases is a different Path", () => {
		expect(animated(0)).not.toEqual(animated(0.25));
	});

	it("pulses periodically: phase 0 and phase 1 produce the identical Path", () => {
		expect(animated(0)).toEqual(animated(1));
	});

	it("a still (unanimated) jellyfish is an ordinary Path at a fixed pose", () => {
		const frozen = still(jellyfish(0.5));
		expect(frozen(0)).toEqual(frozen(0.9));
		expect(frozen(0)).toEqual(jellyfish(0.5));
	});

	it("supports a Timed bell width driving a genuine pulse", () => {
		const pulsingBell = (phase: number): Path =>
			taper({
				from: 0.1,
				to: at((p: number) => 0.8 + 0.15 * Math.sin((p % 1) * Math.PI * 2), phase),
				bulgeAt: 0.15,
				length: 1,
				part: "bell",
			});
		const a = bounds(pulsingBell(0));
		const b = bounds(pulsingBell(0.25));
		expect(a).not.toBeNull();
		expect(b).not.toBeNull();
		if (!a || !b) return;
		expect(a.max.y).not.toBeCloseTo(b.max.y, 3);
		// Exact loop closure at the phase seam, per path.ts's own wrapped-phase
		// pattern.
		expect(pulsingBell(1)).toEqual(pulsingBell(0));
	});
});

describe("recognisability: a fern", () => {
	function frond(): Path {
		const leaflet: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					segments: [{ kind: "line", to: { x: 1, y: 0 } }],
					closed: false,
				},
			],
		};
		return branch(leaflet, {
			depth: 5,
			splits: 2,
			angle: 0.12,
			shrink: 0.72,
			attachAt: 1,
			part: "leaflet",
		});
	}

	it("has many leaflets — more than a single stem", () => {
		expect(frond().shapes.length).toBeGreaterThan(10);
	});

	it("shrinks toward the tip: the deepest leaflets are shorter than the base", () => {
		const shapes = frond().shapes;
		const lenOf = (i: number) => {
			const box = bounds({ shapes: [shapes[i] as Path["shapes"][number]] });
			if (!box) throw new Error("expected bounds");
			return Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y);
		};
		const rootLen = lenOf(0);
		const tipLen = lenOf(shapes.length - 1);
		expect(tipLen).toBeLessThan(rootLen);
	});

	it("branches rather than staying a single line — spreads across both y directions", () => {
		const box = bounds(frond());
		expect(box).not.toBeNull();
		if (!box) return;
		expect(box.min.y).toBeLessThan(0);
		expect(box.max.y).toBeGreaterThan(0);
	});
});
