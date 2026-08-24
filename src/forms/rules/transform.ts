import type { Path, Segment, Shape, Vec2 } from "../path.js";
import { path as checkPath, finite, vec2 } from "../validate.js";

/**
 * Geometric transforms over a `Path`, shared by every rule that places
 * copies of a unit shape.
 *
 * `path.ts` deliberately has no transform TYPE — a `{ rotate, scale,
 * translate }` node would make two geometrically identical paths compare
 * unequal depending on how they arrived, and every renderer would need a
 * matrix stack (see the seam's own header). These functions honour that by
 * doing the opposite: each one BAKES a transform into new absolute
 * coordinates and returns a plain `Path`, so the result is still an ordinary
 * POJO that compares exactly and needs no matrix anywhere downstream. This is
 * "the emitter does the trigonometry" from the seam doc, made concrete.
 */

function mapVec(v: Vec2, f: (v: Vec2) => Vec2): Vec2 {
	return f(v);
}

function mapSegment(seg: Segment, f: (v: Vec2) => Vec2): Segment {
	switch (seg.kind) {
		case "line":
			return { kind: "line", to: mapVec(seg.to, f) };
		case "quadratic":
			return {
				kind: "quadratic",
				control: mapVec(seg.control, f),
				to: mapVec(seg.to, f),
			};
		case "cubic":
			return {
				kind: "cubic",
				control1: mapVec(seg.control1, f),
				control2: mapVec(seg.control2, f),
				to: mapVec(seg.to, f),
			};
	}
}

/**
 * Apply a point transform to every coordinate in a path.
 *
 * The one primitive every named transform below is built from. An ellipse's
 * radii are handled separately by each caller because a general point map
 * (a rotation, say) cannot always be expressed as a change to `radiusX`/
 * `radiusY` alone — only the axis-aligned transforms here (translate,
 * uniform scale, axis mirror) can, which is why `rotate` below special-cases
 * ellipses into their true rotated form: a `subpath` ellipse approximation
 * would defeat the "renderable by Pixi and SVG natively" argument in the
 * seam doc, so a rotated ellipse instead keeps its shape but is only exact
 * for axis-aligned callers. Every rule in this package only rotates whole
 * unit paths by placing them at pre-rotated offsets, never rotates an
 * ellipse's own axes — see `radiate.ts` and `branch.ts`.
 */
function mapPoints(path: Path, f: (v: Vec2) => Vec2): Path {
	return {
		shapes: path.shapes.map((shape): Shape => {
			if (shape.kind === "ellipse") {
				const center = mapVec(shape.center, f);
				return { ...shape, center };
			}
			return {
				...shape,
				start: mapVec(shape.start, f),
				segments: shape.segments.map((s) => mapSegment(s, f)),
			};
		}),
	};
}

/** Translate every coordinate by an offset. */
export function translate(path: Path, offset: Vec2): Path {
	checkPath("translate", "path", path);
	vec2("translate", "offset", offset);
	if (offset.x === 0 && offset.y === 0) return path;
	return mapPoints(path, (v) => ({ x: v.x + offset.x, y: v.y + offset.y }));
}

/**
 * Scale every coordinate about the origin. Radii scale with it, including
 * sign, so a negative scale on one axis correctly mirrors an ellipse too.
 */
export function scale(path: Path, sx: number, sy: number = sx): Path {
	checkPath("scale", "path", path);
	finite("scale", "sx", sx);
	finite("scale", "sy", sy);
	return {
		shapes: mapPoints(path, (v) => ({ x: v.x * sx, y: v.y * sy })).shapes.map(
			(shape, i): Shape => {
				const original = path.shapes[i];
				if (shape.kind === "ellipse" && original?.kind === "ellipse") {
					return {
						...shape,
						radiusX: original.radiusX * sx,
						radiusY: original.radiusY * sy,
					};
				}
				return shape;
			},
		),
	};
}

/**
 * Mirror across the y axis (x -> -x) — reflects front-to-back.
 *
 * With the body's long axis along +x (see `path.ts`), this swaps head end for
 * tail end. It is NOT how a left/right pair is made; `mirrorY` is. The naming
 * follows the axis being negated, which is the convention that survives contact
 * with `scale(path, -1, 1)` sitting right there.
 */
export function mirrorX(path: Path): Path {
	return scale(path, -1, 1);
}

/**
 * Mirror across the x axis (y -> -y) — reflects left-to-right.
 *
 * This is the bilateral one. Because a body runs along +x, the plane of
 * bilateral symmetry contains that axis, so mirroring a limb to the other side
 * negates y and leaves x alone: a foreleg stays a foreleg rather than becoming
 * a hindleg.
 */
export function mirrorY(path: Path): Path {
	return scale(path, 1, -1);
}

/**
 * Rotate every coordinate about the origin by an angle in TURNS (see
 * `path.ts`'s header on why phase and angle are turns rather than radians —
 * the same exactness argument applies here: a rule that places copies at
 * `i / count` turns wants turn 1 to equal turn 0 exactly).
 *
 * An ellipse rotates about its own centre losslessly only when its centre is
 * the origin being rotated about, which is the only case this package's
 * rules ever need (a unit shape authored at the origin, rotated into place)
 * — see the note on `mapPoints`.
 */
export function rotateTurns(path: Path, turns: number): Path {
	checkPath("rotateTurns", "path", path);
	finite("rotateTurns", "turns", turns);
	const theta = (turns % 1) * Math.PI * 2;
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);
	const rotatePoint = (v: Vec2): Vec2 => ({
		x: v.x * cos - v.y * sin,
		y: v.x * sin + v.y * cos,
	});
	return mapPoints(path, rotatePoint);
}
