/**
 * The path description — this package's outward seam.
 *
 * Everything in the forms stage produces this type and nothing consumes it
 * here. The assemblage stage takes it, lights it and draws it; applications
 * render it through Pixi `Graphics` or SVG. It is the contract, so it is
 * deliberately small and every field below has to justify itself.
 *
 * Four requirements shaped it, and they are in tension, so the resolutions are
 * written down rather than left to be re-derived by whoever reads this next.
 *
 * ## 1. Resolution-independent
 *
 * There are no pixels here and there will not be. A rule is a geometric
 * statement — `taper(from, to, curve)` IS a curve — and rasterising inside the
 * rule quantises away the exact property that makes rules better than a
 * catalogue. "Slightly more chitin means slightly more segmented" survives in a
 * path and dies in a 12x9 grid, where it rounds to the same cells until it
 * abruptly does not. Continuity is the whole argument for this design.
 *
 * Coordinates are therefore plain unitless numbers in an abstract form space,
 * conventionally centred on the origin with the body's long axis along +x and
 * a nominal extent near 1. A renderer scales that to whatever it is drawing
 * into. Nothing in this file knows how big a pixel is.
 *
 * ## 2. Comparable EXACTLY
 *
 * The tests assert geometry, not screenshots. That is a major reason vectors
 * were chosen over a pixel matrix, and it only survives into practice if the
 * type is a plain immutable data structure — no class instances, no methods, no
 * `Float32Array`, no accumulated floating-point transform state, no object
 * identity anywhere. Everything below is a readonly POJO of numbers, strings
 * and arrays, so `toEqual` is a total and honest equality and a path can be
 * JSON round-tripped as a fixture without losing anything.
 *
 * This is why segments carry ABSOLUTE coordinates and there is no transform
 * field on `Path`. A `{ rotate, scale, translate }` node would make two
 * geometrically identical paths compare unequal because one arrived via a
 * different route, and would push a matrix stack into every renderer and every
 * test. `repeat` and `radiate` bake their transforms into the emitted numbers
 * instead. The cost is that the emitter does the trigonometry; the benefit is
 * that equality means what it looks like it means.
 *
 * ## 3. Renderable by both Pixi `Graphics` and SVG
 *
 * The segment vocabulary is the intersection of what both back ends do
 * natively, chosen by counting calls across surveyed procedural renderers
 * actually call. Across `concrete-vermin`, `pond-warfare` and
 * `bioluminescent-sea`: `lineTo` 655, `moveTo` 437, `circle` 335, `ellipse`
 * 187, `closePath` 145, `quadraticCurveTo` 134, `bezierCurveTo` 48.
 *
 * So: lines, quadratic and cubic curves, and ellipse/circle as a first-class
 * primitive rather than a curve approximation. Both back ends draw all of
 * these directly — Pixi has `ellipse()`, SVG has `<ellipse>` — and
 * approximating an ellipse with four beziers in the emitter would throw away
 * exactness for no gain.
 *
 * Arcs are deliberately absent despite Pixi and SVG both having them. SVG's
 * arc is an endpoint parameterisation with sweep flags and Pixi's is a centre
 * parameterisation with angles; converting between them is a well-known source
 * of off-by-a-half-turn bugs, and none of the six rules needs an arc that a
 * quadratic or an ellipse cannot express. A vocabulary is a liability, and this
 * one is kept to what the rules provably need.
 *
 * ## 4. Time-varying parameters
 *
 * `bioluminescent-sea` pulses a jellyfish bell, sways its tentacles and beats a
 * fish tail. That consumer requirement would not have surfaced from the other
 * games and it is the one that most constrains the type.
 *
 * The resolution is that a `Path` stays static — a single pose, exactly
 * comparable — and animation lives one level up as a pure function of phase.
 * See `Animated` at the bottom of this file. A path with time inside it would
 * be neither exactly comparable (what does equality mean when a field is a
 * function?) nor serialisable, and it would force every renderer to evaluate
 * time even when drawing a still frame. Keeping time outside means a pose at a
 * given phase is an ordinary `Path` that ordinary geometric assertions apply
 * to, which is what makes the pulse testable at all.
 */

/** A point in abstract form space. Unitless; see the header on resolution. */
export interface Vec2 {
	readonly x: number;
	readonly y: number;
}

/**
 * A straight line to an absolute point.
 *
 * The single most-used primitive in the surveyed renderers (655 calls),
 * which is why it is first.
 */
export interface LineSegment {
	readonly kind: "line";
	readonly to: Vec2;
}

/**
 * A quadratic Bézier — one control point.
 *
 * Kept distinct from `cubic` rather than promoted to one, even though every
 * quadratic has an exact cubic equivalent. Promotion would mean two paths that
 * a consumer wrote differently compare equal, which sounds harmless until a
 * test that meant to pin "this is the cheap curve" silently stops doing so.
 * The survey found `quadraticCurveTo` 134 times against `bezierCurveTo` 48, so
 * the cheap curve is the common case and deserves to stay legible.
 */
export interface QuadraticSegment {
	readonly kind: "quadratic";
	readonly control: Vec2;
	readonly to: Vec2;
}

/** A cubic Bézier — two control points. Tentacles and sweeping fins. */
export interface CubicSegment {
	readonly kind: "cubic";
	readonly control1: Vec2;
	readonly control2: Vec2;
	readonly to: Vec2;
}

export type Segment = LineSegment | QuadraticSegment | CubicSegment;

/**
 * A run of segments from a starting point.
 *
 * `closed` is explicit and not inferred from whether the last point equals the
 * first. The surveyed renderers call `closePath` 145 times and also draw many
 * deliberately open strokes — a tentacle, a filament, a belly stripe — and
 * those two cases differ in how they fill and where they join even when the
 * endpoints coincide. Inferring closure would silently fill a tentacle that
 * happened to curl back on itself.
 *
 * A subpath is the unit that lets one `Path` hold a body and its six legs
 * without the renderer guessing where one ends and the next begins. This is
 * exactly `moveTo` followed by drawing commands in both back ends.
 */
export interface SubPath {
	readonly kind: "subpath";
	readonly start: Vec2;
	readonly segments: readonly Segment[];
	readonly closed: boolean;
}

/**
 * An axis-aligned ellipse, as a primitive rather than four beziers.
 *
 * Earns its place on evidence: `circle` and `ellipse` together are 522 calls
 * across the three surveyed games — bells, bodies, spots, eyes, plankton
 * nodes. Both back ends draw it natively and exactly.
 *
 * There is no separate circle shape. A circle is this with equal radii, and a
 * second type would mean two ways to express one geometry and therefore two
 * things that ought to compare equal and would not.
 */
export interface Ellipse {
	readonly kind: "ellipse";
	readonly center: Vec2;
	readonly radiusX: number;
	readonly radiusY: number;
}

/**
 * Which anatomical part a shape belongs to.
 *
 * A flat label, not a tree. The assemblage stage has to put each part in a
 * depth band, cast a directional light from one part onto the parts behind it,
 * and give each band its own parallax offset. It cannot do any of that against
 * an anonymous list of outlines — it would have to GUESS where one part ends
 * and the next begins, and guessing wrong is precisely why the design doc says
 * "parts currently read as stickers rather than anatomy".
 *
 * So the emitting rule, which is the only thing that actually knows, says so.
 * `pair` knows it just emitted a left and a right appendage; nothing
 * downstream can recover that from coordinates alone.
 *
 * Deliberately a string and not a closed enum. A closed set would be the
 * catalogue failure one level down — capping the vocabulary at whatever
 * someone had time to name, so that a rule producing a genuinely new kind of
 * part has nowhere to put it. Consumers group by equality and ignore labels
 * they do not recognise.
 *
 * `index` disambiguates repetitions of the same part: `repeat` emitting three
 * body segments tags them `("segment", 0..2)`, and `pair` tags a left and
 * right as the same part with different indices. That is what lets a depth
 * band be assigned per repetition — the near legs occlude the far ones.
 */
export interface PartTag {
	readonly part: string;
	readonly index: number;
}

/**
 * One drawable outline.
 *
 * Not styled. A shape says where it is and which part it belongs to, never
 * what colour it is — pigment and lighting come from their respective stages,
 * both of which derive colour from biology rather than
 * from a form rule picking one. Baking a fill into a rule's output would make
 * `taper` an art director.
 *
 * The tag is OPTIONAL, and that is what keeps the flatness honest. A rule that
 * has nothing meaningful to say about anatomy omits it and the shape compares
 * exactly as before; a consumer that does not care about parts ignores it
 * entirely. It adds a channel without adding a required ceremony.
 *
 * Crucially it is plain data — a string and a number, no transform, no parent
 * pointer, no nesting. Grouping and transforms are separable concerns, and
 * conflating them is what made an earlier draft reject grouping outright: a
 * scene-graph node would have needed a matrix to be worth having, and a matrix
 * would have broken exact comparability. A label breaks nothing. Two shapes
 * with equal geometry and equal tags are still `toEqual`, and a tagged path
 * still JSON round-trips.
 */
export type Shape = (SubPath | Ellipse) & { readonly tag?: PartTag };

/**
 * What a compositional rule emits.
 *
 * A flat list of shapes, and that flatness is the point. There is no group or
 * child node: a tree would need transforms to be worth having, and transforms
 * would break exact comparability (see the header). `repeat` of `pair` of
 * `taper` composes by concatenating emitted geometry, not by nesting
 * containers — which is also how the rules compose conceptually. An ant is
 * `repeat` three times with `pair` legs at segment boundaries, and that is a
 * list of shapes, not a scene graph.
 *
 * What downstream packages actually needed from a tree was never the nesting;
 * it was knowing which shapes belong to the same part, so that a depth band
 * and a light could be applied per part. That is a labelling problem, and
 * `PartTag` solves it without a matrix — see `Shape`. Grouping and transforms
 * are separable, and only the second one was ever the threat.
 *
 * Scene graphs are the renderer's business. Pixi consumers already use
 * `Container`, `position` and `scale` to place a drawn creature in a world;
 * this type stops at the outline and lets them keep doing that.
 */
export interface Path {
	readonly shapes: readonly Shape[];
}

/** An empty path. Composing over rules that emit nothing needs an identity. */
export const EMPTY_PATH: Path = { shapes: [] };

/**
 * Concatenate paths.
 *
 * The composition operator for rules. `repeat` calls this n times over a
 * translated body segment; `pair` calls it over a mirrored appendage. Order is
 * preserved because it is draw order, and later shapes are the ones a
 * directional light treats as nearer.
 */
export function concatPaths(...paths: readonly Path[]): Path {
	// Every rule composes through this, so a malformed path admitted here is a
	// malformed path in whatever the rules build on top of it. The naive
	// version failed with "Cannot read properties of undefined (reading
	// 'shapes')" from inside a flatMap, naming neither the caller nor which of
	// the arguments was wrong — and with a variadic signature, which one it
	// was is exactly the thing you need to be told.
	paths.forEach((path, i) => {
		if (path === null || typeof path !== "object" || !Array.isArray(path.shapes)) {
			throw new TypeError(
				`concatPaths: argument ${i} must be a Path with a shapes array, got ${describeValue(path)}`,
			);
		}
	});
	return { shapes: paths.flatMap((p) => p.shapes) };
}

/** What the caller actually passed, briefly, for the error message. */
function describeValue(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (Array.isArray(value)) return "an array";
	if (typeof value === "object") return `an object (${Object.keys(value as object).join(", ")})`;
	return `${typeof value} ${String(value)}`;
}

/**
 * Tag every shape in a path as belonging to one part.
 *
 * The operator `pair` and `repeat` use when they emit a repetition: build the
 * geometry once, then stamp it. Existing tags are overwritten, because the
 * outermost rule is the one whose anatomy the consumer cares about — a `taper`
 * nested inside a `pair` is still a leg.
 */
export function tagPath(path: Path, part: string, index: number): Path {
	if (path === null || typeof path !== "object" || !Array.isArray(path.shapes)) {
		throw new TypeError(
			`tagPath: path must be a Path with a shapes array, got ${describeValue(path)}`,
		);
	}
	// A tag is what the assemblage stage groups depth bands by, so an
	// undefined part name would silently merge every mis-tagged shape into one
	// anatomical part and light them as a single surface.
	if (typeof part !== "string" || part.length === 0) {
		throw new TypeError(`tagPath: part must be a non-empty string, got ${describeValue(part)}`);
	}
	if (!Number.isInteger(index) || index < 0) {
		throw new RangeError(
			`tagPath: index must be a non-negative whole number, got ${describeValue(index)}`,
		);
	}
	return {
		shapes: path.shapes.map((shape) => ({ ...shape, tag: { part, index } })),
	};
}

/**
 * Group a path's shapes into parts, preserving draw order.
 *
 * This is what the assemblage stage calls to assign a depth band per part
 * and light each one against the parts behind it. Shapes with no tag are
 * grouped under `untagged`, so a path built by a rule that says nothing about
 * anatomy still round-trips through the assembler rather than vanishing.
 *
 * Order is preserved twice over: the parts come back in the order their first
 * shape appears, and each part's shapes stay in their original relative order.
 * Both matter, because order is draw order and draw order is what a
 * directional light reads as depth.
 */
export function groupByPart(path: Path): { part: string; index: number; shapes: Shape[] }[] {
	const groups: { part: string; index: number; shapes: Shape[] }[] = [];
	const seen = new Map<string, number>();

	for (const shape of path.shapes) {
		const part = shape.tag?.part ?? "untagged";
		const index = shape.tag?.index ?? 0;
		const key = `${part}\0${index}`;
		const existing = seen.get(key);
		if (existing === undefined) {
			seen.set(key, groups.length);
			groups.push({ part, index, shapes: [shape] });
		} else {
			groups[existing]?.shapes.push(shape);
		}
	}

	return groups;
}

/**
 * A parameter that may vary with time.
 *
 * Either a constant, or a pure function of phase. This is how a jellyfish bell
 * pulses without time leaking into `Path`.
 *
 * Phase is in turns, not radians and not seconds. Turns because one full cycle
 * is exactly 1.0, so the loop point is a value a test can name exactly instead
 * of an approximate comparison against 2π. Not seconds because a duration is
 * the consumer's decision: `bioluminescent-sea` drives its own `pulsePhase` at
 * its own rate and the library has no business owning a clock.
 *
 * Turns make the loop point exact at the seam, not inside a consumer's own
 * arithmetic. `Math.sin(2 * Math.PI)` is -2.4e-16 rather than 0, so a rule that
 * converts turns to radians and calls `sin` can still land a few ulps apart at
 * phase 0 versus phase 1. That is a property of the trigonometry, not of this
 * type, and the mitigation belongs where the periodicity is built: derive a
 * cyclic parameter from `phase % 1` so that phase 1 and phase 0 take the same
 * path through the arithmetic. What turns buy is that such a rule CAN be exact,
 * which a radian-based phase forecloses outright.
 */
export type Timed<T> = T | ((phase: number) => T);

/** Evaluate a possibly-time-varying parameter at a phase. */
export function at<T>(value: Timed<T>, phase: number): T {
	return typeof value === "function" ? (value as (phase: number) => T)(phase) : value;
}

/**
 * A form that can be posed at any phase.
 *
 * The animated counterpart of `Path`, and deliberately just a function. A
 * consumer drawing a still frame calls it once at phase 0 and never pays for
 * animation; a consumer pulsing a bell calls it per frame. Either way what
 * comes back is an ordinary `Path`, so every geometric assertion in the test
 * suite applies to an animated form at a chosen phase without a second code
 * path.
 */
export type Animated = (phase: number) => Path;

/** Lift a static path into an animated one that ignores phase. */
export function still(path: Path): Animated {
	return () => path;
}

/**
 * The bounding box of each part, in draw order.
 *
 * The assemblage stage needs this to place a part in a depth band and to
 * know which parts overlap, since a part can only cast a shadow onto one it
 * actually covers. It is deliberately a composition of `groupByPart` and
 * `bounds` rather than a second solver — one exact implementation of the
 * Bézier extrema, used everywhere.
 */
export function partBounds(path: Path): { part: string; index: number; min: Vec2; max: Vec2 }[] {
	const out: { part: string; index: number; min: Vec2; max: Vec2 }[] = [];
	for (const group of groupByPart(path)) {
		const box = bounds({ shapes: group.shapes });
		if (box) {
			out.push({
				part: group.part,
				index: group.index,
				min: box.min,
				max: box.max,
			});
		}
	}
	return out;
}

/**
 * The bounding box of a path, or `null` when it has no shapes.
 *
 * Exact for every member of the segment vocabulary, which is the reason it is
 * here rather than in a renderer. Tests assert extents — "a taper narrows",
 * "a radiate is symmetric about its hub" — and an approximate bound computed
 * from control points would make those assertions fuzzy in precisely the way
 * vectors were chosen to avoid.
 *
 * Control points of a Bézier are NOT on the curve, so including them directly
 * would overstate the box. The curve is solved instead: the extremum of a
 * Bézier lies at an endpoint or where its derivative crosses zero, so the
 * derivative roots within (0, 1) are evaluated and included.
 */
export function bounds(path: Path): { min: Vec2; max: Vec2 } | null {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let seen = false;

	const includeX = (x: number): void => {
		seen = true;
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
	};
	const includeY = (y: number): void => {
		seen = true;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	};
	const include = (x: number, y: number): void => {
		includeX(x);
		includeY(y);
	};

	for (const shape of path.shapes) {
		if (shape.kind === "ellipse") {
			// Axis-aligned, so the extremes are exactly the semi-axes. Radii are
			// abs'd because a mirrored rule may legitimately emit a negative one.
			const rx = Math.abs(shape.radiusX);
			const ry = Math.abs(shape.radiusY);
			include(shape.center.x - rx, shape.center.y - ry);
			include(shape.center.x + rx, shape.center.y + ry);
			continue;
		}

		let from = shape.start;
		include(from.x, from.y);
		for (const seg of shape.segments) {
			if (seg.kind === "line") {
				include(seg.to.x, seg.to.y);
			} else if (seg.kind === "quadratic") {
				for (const v of quadraticExtrema(from.x, seg.control.x, seg.to.x)) {
					includeX(v);
				}
				for (const v of quadraticExtrema(from.y, seg.control.y, seg.to.y)) {
					includeY(v);
				}
				include(seg.to.x, seg.to.y);
			} else {
				for (const v of cubicExtrema(from.x, seg.control1.x, seg.control2.x, seg.to.x)) {
					includeX(v);
				}
				for (const v of cubicExtrema(from.y, seg.control1.y, seg.control2.y, seg.to.y)) {
					includeY(v);
				}
				include(seg.to.x, seg.to.y);
			}
			from = seg.to;
		}
	}

	return seen ? { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } } : null;
}

/**
 * On-curve extrema of a quadratic Bézier along one axis.
 *
 * B(t) = (1-t)^2 a + 2(1-t)t b + t^2 d, so B'(t) = 0 at
 * t = (a - b) / (a - 2b + d). The denominator vanishes when the curve is
 * degenerate in this axis — a straight run whose extremes are its endpoints,
 * which the caller already includes.
 */
function quadraticExtrema(a: number, b: number, d: number): number[] {
	const denom = a - 2 * b + d;
	if (denom === 0) return [];
	const t = (a - b) / denom;
	if (t <= 0 || t >= 1) return [];
	const u = 1 - t;
	return [u * u * a + 2 * u * t * b + t * t * d];
}

/**
 * On-curve extrema of a cubic Bézier along one axis.
 *
 * B'(t) is a quadratic in t; its roots are found with the standard formula,
 * guarding the degenerate linear case where the leading coefficient is zero.
 * Only roots strictly inside (0, 1) matter — the endpoints are the caller's.
 */
function cubicExtrema(a: number, b: number, c: number, d: number): number[] {
	// B'(t) / 3 = qa t^2 + qb t + qc
	const qa = -a + 3 * b - 3 * c + d;
	const qb = 2 * (a - 2 * b + c);
	const qc = -a + b;

	const roots: number[] = [];
	if (qa === 0) {
		if (qb !== 0) roots.push(-qc / qb);
	} else {
		const disc = qb * qb - 4 * qa * qc;
		if (disc >= 0) {
			const root = Math.sqrt(disc);
			roots.push((-qb + root) / (2 * qa), (-qb - root) / (2 * qa));
		}
	}

	const out: number[] = [];
	for (const t of roots) {
		if (t <= 0 || t >= 1) continue;
		const u = 1 - t;
		out.push(u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d);
	}
	return out;
}
