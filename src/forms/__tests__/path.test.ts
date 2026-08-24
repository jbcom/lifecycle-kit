import { describe, expect, it } from "vitest";
import {
	type Animated,
	at,
	bounds,
	concatPaths,
	EMPTY_PATH,
	groupByPart,
	type Path,
	partBounds,
	still,
	tagPath,
} from "../path.js";

/**
 * The path description is the package's outward seam, so these tests pin the
 * PROPERTIES the design argued for rather than a particular implementation:
 * exact comparability, resolution independence, and time living outside the
 * geometry. If one of these fails, the question is whether the change or the
 * contract is wrong.
 */

const line = (
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	closed = false,
): Path => ({
	shapes: [
		{
			kind: "subpath",
			start: { x: x0, y: y0 },
			segments: [{ kind: "line", to: { x: x1, y: y1 } }],
			closed,
		},
	],
});

describe("exact comparability", () => {
	/**
	 * The headline claim of the vectors-only decision: tests assert geometry,
	 * not screenshots. That requires structural equality to be total — no class
	 * instances, no object identity, no hidden state.
	 */
	it("compares two independently built identical paths as equal", () => {
		expect(line(0, 0, 1, 1)).toEqual(line(0, 0, 1, 1));
	});

	it("distinguishes geometries that differ by a single coordinate", () => {
		expect(line(0, 0, 1, 1)).not.toEqual(line(0, 0, 1, 1.0000001));
	});

	/**
	 * Closure is explicit, not inferred from coincident endpoints. A tentacle
	 * that curls back to its origin must not become a filled body.
	 */
	it("distinguishes an open run from a closed one with the same points", () => {
		expect(line(0, 0, 1, 1, false)).not.toEqual(line(0, 0, 1, 1, true));
	});

	/** A fixture has to survive being written to disk and read back. */
	it("survives a JSON round trip unchanged", () => {
		const path = line(0.5, -2.25, 3, 4);
		expect(JSON.parse(JSON.stringify(path))).toEqual(path);
	});
});

describe("resolution independence", () => {
	/**
	 * Scaling a path scales its bounds exactly, with no quantisation anywhere.
	 * This is the property a pixel grid cannot have and the reason the grid was
	 * dropped: a small parameter change must produce a correspondingly small
	 * geometric change, at every magnitude.
	 */
	it("preserves proportion under arbitrary scaling", () => {
		for (const scale of [1e-6, 0.5, 1, 1000, 1e6]) {
			const scaled = line(0, 0, scale, scale * 2);
			const box = bounds(scaled);
			expect(box).not.toBeNull();
			if (!box) return;
			expect(box.max.y / box.max.x).toBeCloseTo(2, 12);
		}
	});

	/** No cliff: a vanishingly small parameter change stays vanishingly small. */
	it("has no quantisation threshold", () => {
		const a = bounds(line(0, 0, 1, 1));
		const b = bounds(line(0, 0, 1 + 1e-9, 1));
		expect(a).not.toBeNull();
		expect(b).not.toBeNull();
		if (!a || !b) return;
		expect(b.max.x - a.max.x).toBeGreaterThan(0);
		expect(b.max.x - a.max.x).toBeLessThan(1e-6);
	});
});

describe("bounds", () => {
	it("is null for an empty path", () => {
		expect(bounds(EMPTY_PATH)).toBeNull();
	});

	it("uses the semi-axes of an ellipse exactly", () => {
		const path: Path = {
			shapes: [
				{
					kind: "ellipse",
					center: { x: 1, y: 2 },
					radiusX: 3,
					radiusY: 4,
				},
			],
		};
		expect(bounds(path)).toEqual({
			min: { x: -2, y: -2 },
			max: { x: 4, y: 6 },
		});
	});

	/** A mirrored rule may legitimately emit a negative radius. */
	it("treats a negative radius as its magnitude", () => {
		const path: Path = {
			shapes: [
				{
					kind: "ellipse",
					center: { x: 0, y: 0 },
					radiusX: -3,
					radiusY: 4,
				},
			],
		};
		expect(bounds(path)).toEqual({
			min: { x: -3, y: -4 },
			max: { x: 3, y: 4 },
		});
	});

	/**
	 * The reason bounds is exact rather than a control-point hull. A quadratic
	 * with a control point at y = 10 peaks at y = 5, not 10 — the control point
	 * is not on the curve. A hull would overstate the box by a factor of two
	 * and make every extent assertion fuzzy.
	 */
	it("solves a quadratic's real peak rather than hulling its control point", () => {
		const path: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					segments: [
						{
							kind: "quadratic",
							control: { x: 5, y: 10 },
							to: { x: 10, y: 0 },
						},
					],
					closed: false,
				},
			],
		};
		const box = bounds(path);
		expect(box).not.toBeNull();
		if (!box) return;
		expect(box.max.y).toBeCloseTo(5, 12);
		expect(box.min.y).toBe(0);
		expect(box.max.x).toBe(10);
	});

	/** Same argument for cubics: the peak of this symmetric curve is 0.75. */
	it("solves a cubic's real peak", () => {
		const path: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					segments: [
						{
							kind: "cubic",
							control1: { x: 0, y: 1 },
							control2: { x: 1, y: 1 },
							to: { x: 1, y: 0 },
						},
					],
					closed: false,
				},
			],
		};
		const box = bounds(path);
		expect(box).not.toBeNull();
		if (!box) return;
		expect(box.max.y).toBeCloseTo(0.75, 12);
	});

	/**
	 * The X-axis peak of a cubic, not just its Y-axis one. The other cubic
	 * test above starts and ends at x=0 and x=1 with both control points
	 * ALSO pinned to x=0/x=1, so the curve is monotonic in x and its
	 * x-extrema solver never actually returns an interior root. A curve that
	 * bulges sideways — a limb curving outward, say — is the case that
	 * exercises it.
	 */
	it("solves a cubic's real peak on the x axis, not only the y axis", () => {
		const path: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 0 },
					segments: [
						{
							kind: "cubic",
							control1: { x: 1, y: 0 },
							control2: { x: 1, y: 1 },
							to: { x: 0, y: 1 },
						},
					],
					closed: false,
				},
			],
		};
		const box = bounds(path);
		expect(box).not.toBeNull();
		if (!box) return;
		expect(box.max.x).toBeCloseTo(0.75, 12);
		expect(box.min.x).toBe(0);
	});

	/**
	 * An x-extremum occurs at a t whose y is unrelated to any endpoint. An
	 * implementation that pairs a solved x with a guessed y silently widens the
	 * other axis; this curve is flat in y, so any such leak shows up.
	 */
	it("does not let one axis's extremum contaminate the other", () => {
		const path: Path = {
			shapes: [
				{
					kind: "subpath",
					start: { x: 0, y: 3 },
					segments: [
						{
							kind: "quadratic",
							control: { x: 10, y: 3 },
							to: { x: 0, y: 3 },
						},
					],
					closed: false,
				},
			],
		};
		const box = bounds(path);
		expect(box).not.toBeNull();
		if (!box) return;
		expect(box.min.y).toBe(3);
		expect(box.max.y).toBe(3);
		expect(box.max.x).toBeCloseTo(5, 12);
	});
});

describe("part tags", () => {
	/**
	 * The reason an earlier draft rejected grouping outright was that a scene
	 * graph would need transforms, and transforms break exact comparability.
	 * A label is not a transform. This is the assay for that distinction — if
	 * tagging ever costs exact equality, the tag was built wrong.
	 */
	it("does not cost exact comparability", () => {
		const a = tagPath(line(0, 0, 1, 1), "leg", 0);
		const b = tagPath(line(0, 0, 1, 1), "leg", 0);
		expect(a).toEqual(b);
		expect(a).not.toEqual(tagPath(line(0, 0, 1, 1), "leg", 1));
		expect(a).not.toEqual(tagPath(line(0, 0, 1, 1), "antenna", 0));
	});

	it("still round trips through JSON", () => {
		const path = tagPath(line(0.5, -2.25, 3, 4), "segment", 2);
		expect(JSON.parse(JSON.stringify(path))).toEqual(path);
	});

	/** An untagged path must compare exactly as it did before tags existed. */
	it("leaves an untagged path untouched", () => {
		const plain = line(0, 0, 1, 1);
		expect(plain.shapes[0]).not.toHaveProperty("tag");
		expect(bounds(plain)).toEqual({ min: { x: 0, y: 0 }, max: { x: 1, y: 1 } });
	});

	/**
	 * The case that motivated tags: `pair` emits a left and a right appendage,
	 * and nothing downstream can recover which is which from coordinates.
	 */
	it("distinguishes repetitions of the same part", () => {
		const legs = concatPaths(
			tagPath(line(0, 0, -1, 1), "leg", 0),
			tagPath(line(0, 0, 1, 1), "leg", 1),
		);
		const groups = groupByPart(legs);
		expect(groups).toHaveLength(2);
		expect(groups.map((g) => `${g.part}${g.index}`)).toEqual(["leg0", "leg1"]);
	});

	/** Order is draw order, and draw order is what a light reads as depth. */
	it("preserves draw order across and within parts", () => {
		const body = concatPaths(
			tagPath(line(0, 0, 1, 0), "thorax", 0),
			tagPath(line(0, 1, 1, 1), "leg", 0),
			tagPath(line(0, 2, 1, 2), "thorax", 0),
		);
		const groups = groupByPart(body);
		// thorax appears first, so it leads — and both its shapes stay together
		// in their original relative order.
		expect(groups.map((g) => g.part)).toEqual(["thorax", "leg"]);
		expect(groups[0]?.shapes).toHaveLength(2);
		expect(groups[0]?.shapes[0]).toEqual(body.shapes[0]);
		expect(groups[0]?.shapes[1]).toEqual(body.shapes[2]);
	});

	/** A path that says nothing about anatomy must still survive assembly. */
	it("groups untagged shapes rather than dropping them", () => {
		const groups = groupByPart(concatPaths(line(0, 0, 1, 1), line(2, 2, 3, 3)));
		expect(groups).toHaveLength(1);
		expect(groups[0]?.part).toBe("untagged");
		expect(groups[0]?.shapes).toHaveLength(2);
	});

	/** The outermost rule owns the anatomy: a taper inside a pair is a leg. */
	it("lets an outer rule overwrite an inner tag", () => {
		const inner = tagPath(line(0, 0, 1, 1), "taper", 0);
		expect(groupByPart(tagPath(inner, "leg", 3))[0]).toMatchObject({
			part: "leg",
			index: 3,
		});
	});

	/**
	 * What assemblage actually consumes: a per-part extent, so it can assign a
	 * depth band and know which parts overlap.
	 */
	it("reports an exact bounding box per part", () => {
		const creature = concatPaths(
			tagPath(line(0, 0, 4, 2), "thorax", 0),
			tagPath(line(10, 10, 12, 14), "leg", 0),
		);
		expect(partBounds(creature)).toEqual([
			{ part: "thorax", index: 0, min: { x: 0, y: 0 }, max: { x: 4, y: 2 } },
			{ part: "leg", index: 0, min: { x: 10, y: 10 }, max: { x: 12, y: 14 } },
		]);
	});
});

describe("the composition operators refuse a malformed path", () => {
	/**
	 * Found by sweeping the published packages with the inputs that used to
	 * leak elsewhere in this package. `concatPaths` is what every rule composes
	 * through, so a malformed path admitted here ends up in whatever the rules
	 * build on top of it — and the naive `paths.flatMap(p => p.shapes)` failed
	 * with "Cannot read properties of undefined" from inside a flatMap,
	 * naming neither the caller nor which argument was wrong.
	 *
	 * With a variadic signature, which argument it was is precisely the thing
	 * the message has to tell you.
	 */
	it("names the offending argument by position", () => {
		expect(() =>
			concatPaths(line(0, 0, 1, 1), undefined as unknown as Path),
		).toThrow(/concatPaths: argument 1 must be a Path/);
		expect(() => concatPaths(undefined as unknown as Path)).toThrow(
			/argument 0 .* got undefined/,
		);
	});

	it("rejects an object that is not a path", () => {
		expect(() =>
			concatPaths({ shapes: "not an array" } as unknown as Path),
		).toThrow(/must be a Path with a shapes array/);
	});

	/**
	 * `typeof null === "object"`, and `describeValue`'s null check has to run
	 * before its object check or `null` would print as an object with no
	 * keys — worse wording for what is usually the most common bad-argument
	 * case: an unset field on a real record. Only `undefined` had ever been
	 * exercised above.
	 */
	it("names null distinctly from an object with no keys", () => {
		expect(() => concatPaths(null as unknown as Path)).toThrow(
			/argument 0 .* got null/,
		);
	});

	/**
	 * An array is `typeof "object"` but a caller passing a bare array where a
	 * `Path` was expected — a raw shapes list, missing its `{ shapes }`
	 * wrapper — is a distinct, common mistake from an arbitrary object, and
	 * deserves the more specific "an array" wording rather than "an object ()".
	 */
	it("names an array distinctly from an object with no keys", () => {
		expect(() => concatPaths([] as unknown as Path)).toThrow(
			/argument 0 .* got an array/,
		);
	});

	it("still composes real paths", () => {
		expect(concatPaths(line(0, 0, 1, 1), line(2, 2, 3, 3)).shapes).toHaveLength(
			2,
		);
		expect(concatPaths()).toEqual(EMPTY_PATH);
	});

	it("tagPath refuses a malformed path or an empty part name", () => {
		expect(() => tagPath(undefined as unknown as Path, "leg", 0)).toThrow(
			/tagPath: path must be a Path/,
		);
		expect(() => tagPath(line(0, 0, 1, 1), "", 0)).toThrow(
			/part must be a non-empty string/,
		);
		expect(() =>
			tagPath(line(0, 0, 1, 1), undefined as unknown as string, 0),
		).toThrow(/part must be a non-empty string/);
	});

	/**
	 * An undefined index would collapse every mis-tagged shape into one group,
	 * so `lifecycle-assemblage` would light six separate legs as one surface.
	 */
	it("tagPath refuses an index that would collapse the grouping", () => {
		expect(() => tagPath(line(0, 0, 1, 1), "leg", -1)).toThrow(
			/index must be a non-negative whole number/,
		);
		expect(() =>
			tagPath(line(0, 0, 1, 1), "leg", undefined as unknown as number),
		).toThrow(/index must be a non-negative whole number/);
		expect(() => tagPath(line(0, 0, 1, 1), "leg", 1.5)).toThrow(/index/);
	});
});

describe("composition", () => {
	it("is the identity when composing with an empty path", () => {
		const path = line(0, 0, 1, 1);
		expect(concatPaths(path, EMPTY_PATH)).toEqual(path);
		expect(concatPaths(EMPTY_PATH, path)).toEqual(path);
	});

	/** Order is draw order, so composition is associative but not commutative. */
	it("preserves order", () => {
		const a = line(0, 0, 1, 1);
		const b = line(2, 2, 3, 3);
		expect(concatPaths(a, b).shapes).toEqual([...a.shapes, ...b.shapes]);
		expect(concatPaths(a, b)).not.toEqual(concatPaths(b, a));
	});

	it("is associative", () => {
		const a = line(0, 0, 1, 1);
		const b = line(2, 2, 3, 3);
		const c = line(4, 4, 5, 5);
		expect(concatPaths(concatPaths(a, b), c)).toEqual(
			concatPaths(a, concatPaths(b, c)),
		);
	});
});

describe("time-varying parameters", () => {
	it("passes a constant through unchanged at every phase", () => {
		expect(at(5, 0)).toBe(5);
		expect(at(5, 0.5)).toBe(5);
	});

	it("evaluates a function of phase", () => {
		const pulse = (phase: number) => Math.sin(phase * Math.PI * 2);
		expect(at(pulse, 0)).toBeCloseTo(0, 12);
		expect(at(pulse, 0.25)).toBeCloseTo(1, 12);
	});

	/**
	 * Phase is in turns precisely so that periodicity is an exact equality
	 * rather than an approximate comparison against 2*pi. A jellyfish bell that
	 * did not close its loop would jump every cycle.
	 */
	it("lets a periodic form be asserted by exact equality", () => {
		const bell: Animated = (phase) => ({
			shapes: [
				{
					kind: "ellipse",
					center: { x: 0, y: 0 },
					radiusX: 1,
					radiusY: 1 + 0.06 * Math.sin(phase * Math.PI * 2),
				},
			],
		});
		expect(bell(0)).toEqual(bell(1));
		expect(bell(0)).not.toEqual(bell(0.25));
	});

	/**
	 * The honest limit of the above, pinned so nobody rediscovers it as a
	 * mysterious one-frame jitter.
	 *
	 * Turns make the loop point exact at THIS seam, but a rule that converts
	 * turns to radians inherits the trigonometry's error: `Math.sin(2 * PI)` is
	 * -2.4e-16, not 0. Wrapping with `phase % 1` before the conversion sends
	 * phase 1 down the identical arithmetic path as phase 0, which restores
	 * exact equality. This is the pattern a periodic rule should use.
	 */
	it("needs a wrapped phase for a radian-based rule to close its loop exactly", () => {
		const naive = (phase: number) => Math.sin(phase * Math.PI * 2);
		expect(naive(1)).not.toBe(naive(0));

		const wrapped = (phase: number) => Math.sin((phase % 1) * Math.PI * 2);
		expect(wrapped(1)).toBe(wrapped(0));
	});

	/** A posed animated form is an ordinary Path, so ordinary assertions hold. */
	it("produces a plain path at a chosen phase", () => {
		const bell: Animated = (phase) => ({
			shapes: [
				{
					kind: "ellipse",
					center: { x: 0, y: 0 },
					radiusX: 1,
					radiusY: phase,
				},
			],
		});
		expect(bounds(bell(2))).toEqual({
			min: { x: -1, y: -2 },
			max: { x: 1, y: 2 },
		});
	});

	it("lifts a static path into one that ignores phase", () => {
		const path = line(0, 0, 1, 1);
		const animated = still(path);
		expect(animated(0)).toEqual(path);
		expect(animated(0.73)).toEqual(path);
	});
});
