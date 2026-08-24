import {
	composition,
	deriveBiochemistry,
	metabolise,
	NEWBORN,
} from "@jbdevprimary/lifecycle-kit/chem";

const world = deriveBiochemistry({ Si: 30 }, 500);
const state = metabolise(
	NEWBORN,
	{ protein: 1, mineral: 0.25 },
	{ exertion: 0.8, growth: 0.4, rest: 0 },
	world.backbone,
);

const result = {
	world,
	composition: composition(state),
};

if (!Number.isFinite(result.world.margin) || result.composition.protein <= 0) {
	throw new Error("the quick-start pipeline produced an invalid result");
}

console.log(JSON.stringify(result, null, 2));
