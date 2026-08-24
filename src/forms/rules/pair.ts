import { concatPaths, type Path, tagPath, type Vec2 } from "../path.js";
import {
	params as checkParams,
	path as checkPath,
	count,
	partName,
	vec2,
} from "../validate.js";
import { mirrorY, translate } from "./transform.js";

export interface PairParams {
	/**
	 * Where the pair attaches, in the parent's coordinate space.
	 *
	 * `x` is the station along the body and is shared by both members; `y` is
	 * the offset to one side, and the other member takes `-y`.
	 */
	readonly attachment: Vec2;
	/** Anatomical part name, e.g. "leg", "antenna", "fin". */
	readonly part: string;
	/**
	 * Index of this attachment site along the body — the segment a `repeat`
	 * placed it at. Left and right members are tagged `2*siteIndex` and
	 * `2*siteIndex+1` so every appendage in a repeated body gets a distinct
	 * index without the two rules needing to coordinate beyond this offset.
	 */
	readonly siteIndex?: number;
}

/**
 * Emit a left/right mirrored pair of a unit appendage at an attachment
 * point.
 *
 * `bioluminescent-sea` independently arrived at this exact shape under a
 * different name — a jellyfish's `tentacleCount` loop draws each tentacle at
 * `xRatio` positions that are symmetric about the bell's centreline, which is
 * `pair` generalised to more than two. This rule is the two-sided case
 * because two-sidedness (bilateral symmetry) is the overwhelmingly common
 * body plan; `radiate` is what generalises it to jellyfish tentacles or
 * starfish arms.
 *
 * The unit appendage is authored pointing away from the body along +y; `pair`
 * translates it into place and reflects the second copy across the body's long
 * axis, so a leg drawn once becomes bilaterally symmetric for free rather than
 * needing to be authored twice.
 *
 * ## Which axis
 *
 * `path.ts` fixes the convention that a body's long axis runs along +x, and
 * `repeat` callers lay bodies out that way. The plane of bilateral symmetry
 * therefore CONTAINS the x axis, so mirroring to the other side negates y and
 * leaves x alone. Both members keep their station along the body: a foreleg
 * mirrors to the opposite foreleg, not to a hindleg.
 *
 * This rule originally mirrored across x instead, which negates the along-body
 * coordinate. Both members came out sharing a y and straddling the origin in x
 * — one at the head end, one at the tail end, both on the same side of the
 * animal. Every existing test still passed, because none of them asserted
 * which axis separated the two members; it took drawing a creature to see it.
 */
export function pair(unit: Path, params: PairParams): Path {
	checkParams("pair", params);
	checkPath("pair", "unit", unit);
	const attachment = vec2("pair", "attachment", params.attachment);
	const part = partName("pair", "part", params.part);
	const siteIndex = count("pair", "siteIndex", params.siteIndex ?? 0);
	const right = tagPath(translate(unit, attachment), part, siteIndex * 2);
	const mirroredAttachment: Vec2 = { x: attachment.x, y: -attachment.y };
	const left = tagPath(
		translate(mirrorY(unit), mirroredAttachment),
		part,
		siteIndex * 2 + 1,
	);
	// Right emitted first, matching repeat's low-index-first convention —
	// draw order is depth order, and there is no a-priori reason for one side
	// to occlude the other, so the convention just needs to be consistent.
	return concatPaths(right, left);
}
