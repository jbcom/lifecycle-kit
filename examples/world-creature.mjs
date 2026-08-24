import { assemble, DEFAULT_LIGHT, shade } from "@jbdevprimary/lifecycle-kit/assemblage";
import { maxGroupSize } from "@jbdevprimary/lifecycle-kit/bio-laws";
import {
	bodyMassKg,
	composition,
	deriveBiochemistry,
	metabolise,
	NEWBORN,
} from "@jbdevprimary/lifecycle-kit/chem";
import { bounds, repeat, taper, toSvgDocument } from "@jbdevprimary/lifecycle-kit/forms";
import {
	derivePigments,
	NO_DIET_HISTORY,
	paletteRamp,
	recordMeal,
} from "@jbdevprimary/lifecycle-kit/pigment";

const world = deriveBiochemistry({ Si: 30, S: 2 }, 500);
let state = NEWBORN;
let diet = NO_DIET_HISTORY;

for (let day = 0; day < 12; day += 1) {
	const plantFraction = day % 3 === 0 ? 0.8 : 0.35;
	diet = recordMeal(diet, plantFraction);
	state = metabolise(
		state,
		{ protein: 1, chitin: 0.35, keratin: 0.15 },
		{ exertion: 0.7, growth: 0.5, rest: day % 2 === 0 ? 0.4 : 0.1 },
		world.backbone,
	);
}

const tissue = composition(state);
const pigments = derivePigments(tissue, diet, { uvExposure: 0.65, genetics: 0.55 });
const palette = paletteRamp(tissue, pigments, {
	metallic: 0.08,
	roughness: 0.72,
	opacity: 1,
});

const segment = taper({
	from: 0.22,
	to: 0.12,
	bulgeAt: 0.45,
	length: 0.48,
	part: "segment",
});
const form = repeat(segment, {
	axis: { x: 1, y: 0 },
	count: 4,
	spacing: 0.42,
	part: "segment",
});
const extent = bounds(form);
if (!extent) throw new Error("the generated form was unexpectedly empty");

const parts = assemble(form.shapes, DEFAULT_LIGHT);
const svg = toSvgDocument(form, {
	minX: extent.min.x - 0.1,
	minY: extent.min.y - 0.1,
	width: extent.max.x - extent.min.x + 0.2,
	height: extent.max.y - extent.min.y + 0.2,
});

const result = {
	world,
	bodyMassKg: bodyMassKg(state),
	estimatedGroupSize: maxGroupSize(4.1),
	diet,
	tissue,
	palette,
	parts: parts.map((part) => ({
		depth: part.depth,
		occlusion: part.occlusion,
		fill: shade(palette.pigment, part.light),
	})),
	svg,
};

if (result.parts.length !== 4 || !svg.startsWith("<svg") || result.bodyMassKg <= 0) {
	throw new Error("the world-to-creature pipeline produced an invalid result");
}

console.log(JSON.stringify(result, null, 2));
