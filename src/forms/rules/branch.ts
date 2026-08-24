import {
	concatPaths,
	EMPTY_PATH,
	type Path,
	tagPath,
	type Vec2,
} from "../path.js";
import {
	params as checkParams,
	path as checkPath,
	count,
	finite,
	partName,
} from "../validate.js";
import { rotateTurns, scale, translate } from "./transform.js";

export interface BranchParams {
	/** How many recursive levels. 0 emits nothing; 1 is the unit alone. */
	readonly depth: number;
	/** How many children each branch splits into. */
	readonly splits: number;
	/** Fraction of a turn each child fans out from its parent's direction. */
	readonly angle: number;
	/**
	 * How much smaller each generation is, 0..1 exclusive. A fern frond's
	 * leaflets shrinking toward the tip and a coral's branches thinning with
	 * each fork are the same continuous shrink factor at different values —
	 * not different rules.
	 */
	readonly shrink: number;
	/** Where along the unit's own length (0..1) a child branch attaches. */
	readonly attachAt: number;
	readonly part: string;
}

/**
 * Recursively place shrunk, rotated copies of a unit at its own tip.
 *
 * `repeat` places identical copies along a line; `branch` places
 * self-similarly SHRINKING copies along a tree, which is the shape a fern
 * frond, a coral colony and an antler actually have. The recursion is the
 * whole rule — a fern with more leaflets and a coral with more forks are the
 * same call with a larger `depth`, never a separate `fernForm`.
 *
 * The unit is authored pointing along +x with unit length; each generation
 * attaches at `attachAt` fraction along the previous generation's (already
 * shrunk) length, fans out by `angle` per split, and shrinks again by
 * `shrink`. Recursion bottoms out at `depth <= 0` rather than at a size
 * threshold, so `shrink` staying exactly 1 (no shrink at all) still
 * terminates — a correctness property a size-based cutoff would not have.
 */
export function branch(unit: Path, params: BranchParams): Path {
	checkParams("branch", params);
	checkPath("branch", "unit", unit);
	count("branch", "depth", params.depth);
	count("branch", "splits", params.splits);
	finite("branch", "angle", params.angle);
	finite("branch", "shrink", params.shrink);
	finite("branch", "attachAt", params.attachAt);
	partName("branch", "part", params.part);

	return branchAt(unit, params, params.depth, 1, "root");
}

function branchAt(
	unit: Path,
	params: BranchParams,
	depth: number,
	currentScale: number,
	pathId: string,
): Path {
	if (depth <= 0) return EMPTY_PATH;

	const self = tagPath(
		scale(unit, currentScale),
		params.part,
		hashIndex(pathId),
	);

	if (depth === 1) return self;

	const attachPoint: Vec2 = { x: params.attachAt * currentScale, y: 0 };
	const childScale = currentScale * params.shrink;
	const children: Path[] = [];
	for (let i = 0; i < params.splits; i++) {
		// Fan symmetrically about the parent's own direction: splits=2 gives
		// +angle/2 and -angle/2, so a fork looks like a fork rather than a
		// kink to one side.
		const fanTurn =
			params.splits === 1 ? 0 : params.angle * (i / (params.splits - 1) - 0.5);
		const childUnit = translate(rotateTurns(unit, fanTurn), attachPoint);
		children.push(
			branchAt(childUnit, params, depth - 1, childScale, `${pathId}.${i}`),
		);
	}

	return concatPaths(self, ...children);
}

/**
 * A stable small integer from a branch's path, for `PartTag.index`.
 *
 * Recursion visits an exponentially growing number of nodes, so the index
 * cannot be a simple counter without threading mutable state through the
 * recursion — which would make two calls with identical parameters capable
 * of producing different tags depending on call order, breaking the "build
 * it twice, get the same Path" property every other rule has. Hashing the
 * path string keeps each node's index a pure function of where it is in the
 * tree.
 */
function hashIndex(pathId: string): number {
	let h = 0;
	for (let i = 0; i < pathId.length; i++) {
		h = (h * 31 + pathId.charCodeAt(i)) >>> 0;
	}
	return h % 100_000;
}
