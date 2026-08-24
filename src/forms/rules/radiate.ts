import {
	concatPaths,
	EMPTY_PATH,
	type Path,
	tagPath,
	type Vec2,
} from "../path.js";
import {
	count as checkCount,
	params as checkParams,
	path as checkPath,
	finite,
	partName,
	vec2,
} from "../validate.js";
import { rotateTurns, translate } from "./transform.js";

export interface RadiateParams {
	/** Centre to radiate from, in the parent's coordinate space. */
	readonly center: Vec2;
	/** How many copies. */
	readonly count: number;
	/**
	 * Fraction of a full turn the copies spread across, 0..1. 1.0 is a full
	 * ring (a sea anemone's arms, spokes of a wheel); a starfish with 5 arms
	 * spread across the whole turn uses 1.0, while a fan of gills spread
	 * across only the animal's front uses something smaller.
	 */
	readonly spreadTurns: number;
	/** Turn at which the first copy sits. 0 is "along +x". */
	readonly startTurn?: number;
	readonly part: string;
}

/**
 * Place `count` copies of a unit appendage radially around a centre.
 *
 * The generalisation of `pair` from two sides to N: a starfish's arms, a sea
 * anemone's tentacle ring, and — the consumer that actually needed this — a
 * jellyfish's tentacles, which `bioluminescent-sea` draws with an ad hoc
 * `xRatio` sweep under the name `tentacleCount`. `spreadTurns` covers both:
 * 1.0 for the anemone's full ring, less than 1.0 for tentacles that trail
 * from the underside of a bell rather than surrounding it.
 *
 * The unit is authored pointing along +x from the centre; each copy is
 * rotated to its position on the ring and translated out to `center`. Copies
 * are `count` evenly spaced slots covering `spreadTurns`, always dividing by
 * `count` and never by `count - 1`.
 *
 * An earlier version divided by `count - 1` below a full turn, so the last
 * copy landed exactly at the far end of the spread, and switched to dividing
 * by `count` at `spreadTurns = 1` so a ring's first and last copy did not
 * coincide. That is a genuine cliff at spreadTurns = 1 — sweeping through it
 * jumps the last copy's angle discontinuously — and the continuity assay in
 * `radiate.test.ts` exists precisely to catch this class of bug. One formula
 * for every spread is what removes it: a partial arc's last copy sits one
 * slot short of the spread's far edge rather than exactly on it, which is a
 * real behaviour change from the inclusive-endpoint version, not a
 * simplification of the same one.
 */
export function radiate(unit: Path, params: RadiateParams): Path {
	checkParams("radiate", params);
	checkPath("radiate", "unit", unit);
	const center = vec2("radiate", "center", params.center);
	const count = checkCount("radiate", "count", params.count);
	const spreadTurns = finite("radiate", "spreadTurns", params.spreadTurns);
	const part = partName("radiate", "part", params.part);
	const startTurn = finite("radiate", "startTurn", params.startTurn ?? 0);

	if (count <= 0) return EMPTY_PATH;
	const step = spreadTurns / count;

	const copies: Path[] = [];
	for (let i = 0; i < count; i++) {
		const turn = startTurn + step * i;
		const placed = translate(rotateTurns(unit, turn), center);
		copies.push(tagPath(placed, part, i));
	}
	return concatPaths(...copies);
}
