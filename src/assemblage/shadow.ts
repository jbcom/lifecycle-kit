import type { Ellipse, Shape, SubPath, Vec2 } from "../forms/index.js";
import type { Light } from "./light.js";
import { normalise } from "./light.js";

/**
 * True self-shadowing: a part CASTING onto the parts behind it.
 *
 * Flat shading — each part lit independently by its own position against the
 * light — is what shipped first, and it is not this. Flat shading tells you
 * which side of the creature the sun is on. It cannot tell you that a leg is
 * IN FRONT OF a body, because it never asks whether one part covers another.
 * That is the whole difference between parts that read as pasted and parts
 * that read as grown, and it is the reason the design doc lists self-shadowing
 * separately from the directional light it sits on top of.
 *
 * ## Why a coverage fraction rather than a shadow map
 *
 * The obvious implementation is to rasterise every caster into a buffer and
 * sample it per receiver pixel. That is banned here, and rightly: a pixel grid
 * would quantise away the continuity that is the entire argument for vectors
 * (see `lifecycle-forms`' path.ts header). "Slightly larger limb means
 * slightly deeper shadow" has to survive, and in a 12x9 grid it rounds to the
 * same cells until it abruptly does not.
 *
 * So the shadow term is a scalar: what FRACTION of a receiver's extent is
 * covered by the casters in front of it. That composes with the existing
 * `light` scalar without changing the outward seam — `AssembledPart` stays a
 * flat POJO of numbers, and a consumer still does one `fill()` per shape.
 *
 * The honest limitation, written down rather than discovered later: this
 * shades a receiver UNIFORMLY by how much of it is covered. A part half in
 * shadow goes half-dark all over rather than dark on one side. At the scale
 * these creatures draw — a body a few dozen pixels across — that reads
 * correctly, because the eye takes the darkening as "something is on top of
 * this" and there is not enough area for the gradient to be missed. A consumer
 * that draws a creature filling a screen wants a gradient fill, and the
 * coverage fraction is exactly the input that would drive one.
 *
 * ## Why boxes and not exact silhouette intersection
 *
 * A receiver's coverage is computed from axis-aligned bounds, not from a true
 * polygon clip of two outlines. Two reasons, in order of weight:
 *
 * 1. `lifecycle-forms` already solves exact bounds for the whole segment
 *    vocabulary, including Bézier extrema. Reusing it means one exact
 *    implementation rather than a second solver that agrees with it on most
 *    inputs — the failure mode the forms package explicitly calls out.
 * 2. An exact clip of two arbitrary curved outlines is a general polygon
 *    boolean, which needs curve flattening. Flattening reintroduces a
 *    resolution parameter, which is the pixel grid wearing a different hat.
 *
 * An ellipse is corrected for, because a circle inscribed in its box fills
 * only π/4 of it, and bodies and eyes are ellipses often enough that treating
 * them as squares visibly over-shadows.
 */

/** How far a shadow slides per unit of depth between caster and receiver. */
const OFFSET_PER_DEPTH = 0.06;

/**
 * How dark a fully covered receiver goes, as a fraction of its lit value.
 *
 * Not zero, and for the same reason `Light.ambient` is not zero: a creature
 * has to stay readable everywhere. Light bounces, and a cast shadow on a
 * surface a few pixels wide that goes to black reads as a hole in the
 * creature rather than as a limb in front of it.
 *
 * Set by looking. A limb across a body covers something like a third of it,
 * so the constant has to be large enough that a THIRD of it is a difference a
 * person can see — at 0.45 the answer was about four values of luma, which is
 * below the threshold at which anyone reads a shadow as a shadow. This is the
 * kind of constant that cannot be derived from anything, only checked against
 * a render, which is why the capture spec exists.
 */
const MAX_OCCLUSION = 0.7;

/**
 * The area an ellipse actually fills inside its bounding box.
 *
 * π/4. Without it a round body is treated as a square one and catches roughly
 * a quarter more shadow than it should — which is small per part and
 * compounds, because a body is typically the receiver for every limb at once.
 */
const ELLIPSE_FILL = Math.PI / 4;

/** An axis-aligned extent. The unit shadowing is computed in. */
export interface Box {
	readonly min: Vec2;
	readonly max: Vec2;
}

/** A finite number, or a fallback. Bad geometry must not become NaN light. */
function finite(value: number | undefined, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * The extent of one shape.
 *
 * Exact for ellipses and for straight runs; a curve's true extremum needs the
 * Bézier derivative roots that `lifecycle-forms` already solves, and control
 * points are deliberately included as a conservative outer bound here rather
 * than re-deriving that solver. A shadow cast from a box slightly larger than
 * the curve errs toward more shadow, never toward a limb that fails to cast.
 */
export function shapeBox(shape: Shape): Box {
	if (shape.kind === "ellipse") return ellipseBox(shape);
	return subPathBox(shape);
}

function ellipseBox(shape: Ellipse): Box {
	const cx = finite(shape.center?.x, 0);
	const cy = finite(shape.center?.y, 0);
	const rx = Math.abs(finite(shape.radiusX, 0));
	const ry = Math.abs(finite(shape.radiusY, 0));
	return {
		min: { x: cx - rx, y: cy - ry },
		max: { x: cx + rx, y: cy + ry },
	};
}

function subPathBox(shape: SubPath): Box {
	const sx = finite(shape.start?.x, 0);
	const sy = finite(shape.start?.y, 0);
	let minX = sx;
	let minY = sy;
	let maxX = sx;
	let maxY = sy;

	const include = (point: Vec2 | undefined): void => {
		const x = finite(point?.x, sx);
		const y = finite(point?.y, sy);
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	};

	for (const segment of shape.segments ?? []) {
		if (segment.kind === "quadratic") include(segment.control);
		if (segment.kind === "cubic") {
			include(segment.control1);
			include(segment.control2);
		}
		include(segment.to);
	}

	return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

/** Slide a box along a direction. A shadow is a silhouette, displaced. */
export function offsetBox(box: Box, dx: number, dy: number): Box {
	return {
		min: { x: box.min.x + dx, y: box.min.y + dy },
		max: { x: box.max.x + dx, y: box.max.y + dy },
	};
}

/** The area two boxes share. Zero when they miss. */
export function overlapArea(a: Box, b: Box): number {
	const w = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
	const h = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
	if (!(w > 0) || !(h > 0)) return 0;
	return w * h;
}

/** A box's own area. */
export function boxArea(box: Box): number {
	const w = box.max.x - box.min.x;
	const h = box.max.y - box.min.y;
	return Math.max(0, w) * Math.max(0, h);
}

/** One shape considered as something that can cast. */
export interface Caster {
	readonly shape: Shape;
	readonly depth: number;
}

/**
 * How much of a receiver is covered by the casters in front of it, 0..1.
 *
 * Only parts strictly NEARER than the receiver cast onto it. Equal depth means
 * the same plane, and a plane cannot shadow itself — that is what the depth
 * band separation from `assemble` is for, and it is why repetitions of one
 * part are given distinct bands rather than sharing one.
 *
 * The displacement grows with the depth gap, which is the parallax that sells
 * the separation: a limb well in front of a body throws its shadow further
 * across that body than a shell sitting just proud of it does. Displacement is
 * along the direction the light TRAVELS, because that is where a silhouette
 * lands.
 *
 * Coverage from multiple casters is combined as independent occluders rather
 * than summed, so two limbs over the same patch of body deepen the shadow
 * without it ever exceeding total coverage. Summing would let three limbs
 * report 150% coverage and clamp, losing the difference between "mostly
 * covered" and "utterly buried".
 */
export function occlusion(
	receiver: Caster,
	casters: readonly Caster[],
	light: Light,
): number {
	const box = shapeBox(receiver.shape);
	const area = boxArea(box);
	if (!(area > 0)) return 0;

	const { x: nx, y: ny } = normalise(light.direction);

	// Independent occluders: track the fraction still UNCOVERED and let each
	// caster take its share of what remains.
	let clear = 1;

	for (const caster of casters) {
		const gap = caster.depth - receiver.depth;
		if (!(gap > 0)) continue;

		const casterBox = shapeBox(caster.shape);
		const slid = offsetBox(
			casterBox,
			nx * gap * OFFSET_PER_DEPTH,
			ny * gap * OFFSET_PER_DEPTH,
		);

		const shared = overlapArea(box, slid);
		if (!(shared > 0)) continue;

		// An ellipse fills only π/4 of its box, so a round caster covers less
		// than its extent suggests and a round receiver presents less area to
		// be covered.
		const casterFill = caster.shape.kind === "ellipse" ? ELLIPSE_FILL : 1;
		const receiverFill = receiver.shape.kind === "ellipse" ? ELLIPSE_FILL : 1;

		const fraction = Math.min(1, (shared * casterFill) / (area * receiverFill));
		clear *= 1 - fraction;
	}

	const covered = 1 - clear;
	return Number.isFinite(covered) ? Math.max(0, Math.min(1, covered)) : 0;
}

/**
 * Apply a coverage fraction to a light level.
 *
 * Multiplicative rather than subtractive: a shadow removes a proportion of
 * whatever light was reaching a surface, so a part already facing away from
 * the light does not go doubly dark for being covered as well. Subtracting a
 * fixed amount would push the unlit side below ambient, which is exactly the
 * unreadable silhouette ambient exists to prevent.
 */
export function shadowed(light: number, coverage: number): number {
	const base = Number.isFinite(light) ? light : 0.5;
	const cover = Number.isFinite(coverage)
		? Math.max(0, Math.min(1, coverage))
		: 0;
	return base * (1 - MAX_OCCLUSION * cover);
}
