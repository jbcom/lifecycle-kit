import { concatPaths, EMPTY_PATH, type Path, tagPath } from "../path.js";
import {
	params as checkParams,
	path as checkPath,
	finite,
	outputCount,
	partName,
	vec2,
} from "../validate.js";
import { translate } from "./transform.js";

/** A direction in form space to repeat along. Need not be axis-aligned. */
export interface Axis {
	readonly x: number;
	readonly y: number;
}

export interface RepeatParams {
	/** How many copies, including the first at offset 0. */
	readonly count: number;
	/** Direction to step in. Not required to be a unit vector. */
	readonly axis: Axis;
	/** Distance between consecutive copies along `axis`. */
	readonly spacing: number;
	/** Anatomical part name for the whole repetition. */
	readonly part: string;
}

/**
 * Place `count` copies of a unit path along an axis.
 *
 * The segmented-body rule: a centipede is `repeat` of one body segment with
 * more `count`; the difference between a caterpillar and a millipede is
 * `spacing` and how many legs `pair` adds at each stop, not a different rule.
 *
 * Each copy is tagged `(part, i)` so the assemblage stage can put segment 0
 * (the head end) in front of segment 5 — draw order already reflects this
 * because copies are emitted low-index-first, but the tag is what lets a
 * consumer address "the third segment" directly rather than by array index
 * into an anonymous shape list.
 *
 * Continuity: `spacing` and `count` are continuous parameters over ordinary
 * translation, so a body that is "slightly more repeated" is a body with
 * copies slightly further out — there is no threshold where a new segment
 * pops into existence except at the integer boundaries of `count` itself,
 * which is the one place a repeated body IS discrete in reality (an ant has
 * a whole number of segments).
 */
export function repeat(unit: Path, params: RepeatParams): Path {
	checkParams("repeat", params);
	checkPath("repeat", "unit", unit);
	// `axis` is a DIRECTION, not an enum. A caller who writes the
	// obvious-looking `axis: "x"` gets `"x".x === undefined`, an offset of
	// NaN, and a body whose every coordinate is null — a correctly shaped
	// path made entirely of holes, with nothing thrown and no creature drawn.
	const axis = vec2("repeat", "axis", params.axis);
	finite("repeat", "spacing", params.spacing);
	const count = outputCount("repeat", "count", params.count);
	partName("repeat", "part", params.part);

	if (count <= 0) return EMPTY_PATH;
	const copies: Path[] = [];
	for (let i = 0; i < count; i++) {
		const offset = {
			x: axis.x * params.spacing * i,
			y: axis.y * params.spacing * i,
		};
		copies.push(tagPath(translate(unit, offset), params.part, i));
	}
	return concatPaths(...copies);
}
