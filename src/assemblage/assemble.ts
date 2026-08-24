import type { Shape, Vec2 } from "../forms/index.js";
import { DEFAULT_LIGHT, type Light, litness } from "./light.js";
import { type Caster, occlusion, shadowed } from "./shadow.js";

/**
 * Depth, light and shading over composed forms.
 *
 * The forms stage emits a flat list of outlines, each tagged with the part
 * it belongs to. It says nothing about depth or colour, deliberately — a
 * `taper` rule that picked a fill would be an art director, and a rule that
 * assigned depth would be guessing at anatomy it does not model.
 *
 * This package is where that flat list becomes something that reads as GROWN
 * rather than assembled: parts occupy depth bands, a directional light falls
 * across them, and the near ones CAST ONTO the far ones. The design doc names
 * the failure this exists to fix — "parts currently read as stickers rather
 * than anatomy" — and the cause is that four flat layers stacked in a fixed
 * order have no spatial relationship to each other at all.
 *
 * Everything here is a pure function of geometry and a light. No canvas, no
 * Pixi, no DOM: a consumer renders the result through whatever back end it
 * already has. That is also what makes it assertable numerically instead of
 * by screenshot — though a screenshot is now taken as well, because numbers
 * agreeing with each other is not the same as a creature looking right.
 */

export type { Light } from "./light.js";
export { DEFAULT_LIGHT, litness, normalise, shade } from "./light.js";
export {
	type Box,
	boxArea,
	type Caster,
	occlusion,
	offsetBox,
	overlapArea,
	shadowed,
	shapeBox,
} from "./shadow.js";

/** A shape placed in depth, ready to draw. */
export interface AssembledPart {
	readonly shape: Shape;
	/** Larger is nearer. Draw ascending so near parts land on top. */
	readonly depth: number;
	/**
	 * 0..1 — how much light this part catches, for shading its fill.
	 *
	 * Includes shadow cast by the parts in front of it. This is the number a
	 * consumer feeds to `shade`, and it is the one that should be used: the
	 * two components are exposed separately below for tests and for a consumer
	 * that wants to drive them independently, not because either alone is the
	 * right thing to draw with.
	 */
	readonly light: number;
	/**
	 * 0..1 — the directional term alone, before any part occluded it.
	 *
	 * What position against the light says on its own. Kept because it is the
	 * honest input to a specular highlight, which cares where the light is and
	 * not what is standing in the way.
	 */
	readonly direct: number;
	/**
	 * 0..1 — how much of this part is covered by the parts in front of it.
	 *
	 * Zero for the nearest part in any scene, since nothing is in front of it.
	 * A consumer wanting a gradient fill rather than a uniform darkening drives
	 * it from this.
	 */
	readonly occlusion: number;
}

/**
 * Depth bands by anatomical part.
 *
 * A body is the trunk everything else attaches to, so it sits in the middle;
 * crests and fins ride behind it and limbs come forward. An unrecognised part
 * lands on the body's plane rather than being dropped, because `PartTag.part`
 * is deliberately an open string — a rule that invents a new kind of part must
 * not fall out of the scene for want of an entry here.
 */
const BANDS: Record<string, number> = {
	crest: -2,
	fin: -2,
	frond: -1,
	segment: 0,
	body: 0,
	shell: 0.5,
	face: 1,
	eye: 1,
	limb: 2,
	leg: 2,
	arm: 2,
	tentacle: 2,
};

/** How far apart repetitions of one part sit. */
const INDEX_SPACING = 0.1;

/**
 * Place each shape in depth, light it, and let the near parts shade the far.
 *
 * Returned back to front, so a consumer draws in order and the near parts land
 * on top without needing a z-buffer.
 *
 * Repetitions of the same part are separated by their tag index, which is the
 * reason `PartTag` carries one. Six legs from a `pair` rule are not six copies
 * in one plane — the near ones occlude the far ones, and that occlusion is
 * most of what makes a creature look three-dimensional at this scale.
 *
 * Occlusion is computed after every part has a depth, because a caster has to
 * know it is in front before it can cast. That ordering is the reason this is
 * two passes rather than one map.
 */
export function assemble(
	shapes: readonly Shape[],
	light: Light = DEFAULT_LIGHT,
): readonly AssembledPart[] {
	const placed: Caster[] = shapes.map((shape) => ({
		shape,
		depth: depthOf(shape),
	}));

	return placed
		.map((part) => {
			const direct = litness(centerOf(part.shape), light);
			const covered = occlusion(part, placed, light);
			return {
				shape: part.shape,
				depth: part.depth,
				direct,
				occlusion: covered,
				light: shadowed(direct, covered),
			};
		})
		.sort((a, b) => a.depth - b.depth);
}

/** Which plane a shape sits in, from the part it was tagged with. */
function depthOf(shape: Shape): number {
	const tag = shape.tag;
	if (!tag) return 0;
	const band = BANDS[tag.part] ?? 0;
	const index = Number.isFinite(tag.index) ? tag.index : 0;
	return band + index * INDEX_SPACING;
}

/** Where a shape sits, for lighting purposes. */
function centerOf(shape: Shape): Vec2 {
	if (shape.kind === "ellipse") return shape.center;

	// A subpath's start is a fair proxy and costs nothing. A true centroid
	// would need to flatten every curve, which buys precision that a light
	// falling across a small sprite cannot show.
	return shape.start;
}
