import type { Path, Vec2 } from "../path.js";
import { finite, positive } from "../validate.js";

/**
 * A body outline that narrows (or widens) along its axis.
 *
 * Unlike the other five rules, `taper` does not take a unit `Path` to
 * transform — it IS the primitive body-outline generator. `repeat` places
 * copies of something; `taper` is usually the something. An ant's thorax, a
 * jellyfish bell's profile and a fern frond's midrib are all one tapering
 * outline with different width curves.
 *
 * The outline is built as two symmetric half-width curves — top and bottom —
 * joined into one closed subpath, which is the standard way to turn a 1D
 * width function into a filled 2D silhouette. Using `quadratic` control
 * points (rather than sampling into a polyline) keeps the outline exact and
 * resolution-independent, matching the header's argument in `path.ts`.
 */
export interface TaperParams {
	/** Half-width at the start of the axis (x = 0), in form-space units. */
	readonly from: number;
	/** Half-width at the end of the axis (x = length). */
	readonly to: number;
	/**
	 * Where along the curve the width bulges before narrowing, 0..1 as a
	 * fraction of `length`. 0.5 is a symmetric bulge (a grub, a bell); moving
	 * it toward 0 or 1 makes the widest point read as a head or a base — an
	 * ant's abdomen is fat near the thorax and this is the parameter that
	 * says so, continuously, rather than as a separate "abdomen" shape.
	 */
	readonly bulgeAt: number;
	/** Length of the body along its axis. */
	readonly length: number;
	/** Which anatomical part this outline belongs to, for depth banding. */
	readonly part?: string;
	readonly index?: number;
}

/**
 * Emit a closed tapering silhouette along +x.
 *
 * The curve through (0, from), (bulgeAt*length, max(from,to)*shape-dependent
 * peak) and (length, to) is built from two quadratics per side — flare-in and
 * taper-out — so the outline can bulge past both endpoints' widths rather
 * than being confined to a straight interpolation between them. This is what
 * lets `bulgeAt` actually read as a bulge instead of a corner.
 */
export function taper(params: TaperParams): Path {
	// Validate at the boundary: a bad width here becomes a null coordinate,
	// then NaN in a downstream package, then an erased creature. See
	// ../validate.ts.
	finite("taper", "from", params.from);
	finite("taper", "to", params.to);
	finite("taper", "bulgeAt", params.bulgeAt);
	positive("taper", "length", params.length);

	const { from, to, bulgeAt, length } = params;
	const bulgeX = clamp01(bulgeAt) * length;
	// The peak half-width is the wider endpoint, pushed out a little further
	// so the midpoint genuinely bulges rather than just interpolating.
	const peak = Math.max(from, to) * 1.15 + Math.min(from, to) * 0.15;

	const top: Vec2[] = [
		{ x: 0, y: -from },
		{ x: bulgeX, y: -peak },
		{ x: length, y: -to },
	];
	const bottom: Vec2[] = [
		{ x: length, y: to },
		{ x: bulgeX, y: peak },
		{ x: 0, y: from },
	];

	const path: Path = {
		shapes: [
			{
				kind: "subpath",
				start: top[0] as Vec2,
				segments: [
					// Down the top flank to the narrow end.
					{ kind: "quadratic", control: top[1] as Vec2, to: top[2] as Vec2 },
					// Across the narrow end. Without this the outline jumped
					// straight from (length, -to) to (0, from), never visiting
					// (length, to) — so the end collapsed to a single vertex and
					// every taper came out a LENS rather than a tapered body.
					// Two lenses joined at a waist is a diamond, which is what
					// creatures were rendering as: angular crystals with spikes.
					// A taper narrowing to zero still meets at a point, because
					// then both corners genuinely are the same point.
					{ kind: "line", to: bottom[0] as Vec2 },
					// Back up the bottom flank to where we started.
					{
						kind: "quadratic",
						control: bottom[1] as Vec2,
						to: bottom[2] as Vec2,
					},
				],
				closed: true,
				...(params.part
					? { tag: { part: params.part, index: params.index ?? 0 } }
					: {}),
			},
		],
	};
	return path;
}

function clamp01(v: number): number {
	return Math.max(0, Math.min(1, v));
}
