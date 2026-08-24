import { type Composition, compositionColor } from "../chem/index.js";
import type { PigmentConcentrations } from "./pigments.js";
import { composition as checkComposition, object, unitRange } from "./validate.js";

/**
 * A palette RAMP: several colour stops from shadow to highlight, rather than
 * one flat tint. The assemblage stage needs a ramp to shade a lit,
 * self-shadowing form with — see
 * `docs/superpowers/specs/2026-08-08-compositional-rendering-design.md`
 * §"Surface is the same computation, not a coat of paint".
 */
export interface PaletteRamp {
	/** Darkest stop — shadow side of a lit form. */
	shadow: string;
	/** The structural/base colour — chem's element-weighted average. */
	base: string;
	/** Pigment-dominant stop — where the strongest pigment concentration reads. */
	pigment: string;
	/** Brightest stop — highlight side, toward the light. */
	highlight: string;
	/** 0..1, mass-weighted from the tissue's elements. Specular intensity. */
	metallic: number;
	/** 0..1. How sharply the shadow-to-highlight ramp falls off. */
	roughness: number;
	/** 0..1. Below 1 the form should dither/read translucent. */
	opacity: number;
}

/** Real absorption-family colour each pigment tints toward, as RGB 0..255. */
const PIGMENT_TINT: Record<keyof PigmentConcentrations, [number, number, number]> = {
	melanin: [61, 43, 31], // eumelanin: dark brown
	carotenoid: [232, 122, 26], // beta-carotene: orange
	pterin: [235, 215, 60], // xanthopterin: yellow
	purine: [235, 235, 240], // guanine crystal: near-white, faint blue cast
	porphyrin: [150, 32, 40], // haem/porphyrin ring: deep red
};

/**
 * Blend the structural base colour toward each pigment's tint, weighted by
 * that pigment's concentration — the strongest pigment dominates the
 * "pigment" stop the way it dominates a real coat or scale.
 */
function pigmentStop(baseHex: string, pigments: PigmentConcentrations): string {
	const base = hexToRgb(baseHex);
	const BASE_WEIGHT = 0.15; // the base colour always keeps some presence
	let r = base.r * BASE_WEIGHT;
	let g = base.g * BASE_WEIGHT;
	let b = base.b * BASE_WEIGHT;
	let weight = BASE_WEIGHT;
	// Iterate the TINT table, not the caller's object.
	//
	// The previous version walked `Object.entries(pigments)` and asserted the
	// keys were `keyof PigmentConcentrations`. That cast was a lie: a plain
	// object can carry any key, so an extra or misspelled one indexed
	// `PIGMENT_TINT` to `undefined` and threw `Cannot read properties of
	// undefined` from inside a colour function — which is what this audit
	// actually hit against the published package. Driving the loop from the
	// table makes the set of pigments a fact of this module rather than a
	// promise about the argument, and an unknown key is simply not consulted.
	for (const name of Object.keys(PIGMENT_TINT) as Array<keyof PigmentConcentrations>) {
		const tint = PIGMENT_TINT[name];
		const concentration = unitRange("paletteRamp", `pigments.${name}`, pigments[name]);
		if (concentration <= 0) continue;
		r += tint[0] * concentration;
		g += tint[1] * concentration;
		b += tint[2] * concentration;
		weight += concentration;
	}
	return rgbToHex(r, g, b, weight);
}

/** Scale a colour toward black (t<0) or white (t>0), t in -1..1. */
function shade(hex: string, t: number): string {
	const { r, g, b } = hexToRgb(hex);
	const target = t < 0 ? 0 : 255;
	const amount = Math.abs(t);
	const mix = (channel: number) => Math.round(channel + (target - channel) * amount);
	return `#${toHexByte(mix(r))}${toHexByte(mix(g))}${toHexByte(mix(b))}`;
}

/**
 * Build the palette ramp the assemblage stage shades a form with.
 *
 * `surfaceOf`-style metallic/roughness/opacity are element-mass-weighted from
 * the same composition, so a mineral-rich body is genuinely glossier and a
 * lipid-rich one genuinely more matte — the surface reads what the body is
 * made of rather than being painted on.
 */
export function paletteRamp(
	composition: Composition,
	pigments: PigmentConcentrations,
	surface: SurfaceProperties,
): PaletteRamp {
	checkComposition("paletteRamp", "composition", composition);
	object("paletteRamp", "pigments", pigments);
	object("paletteRamp", "surface", surface);

	// Surface gets the same treatment as the pigments: these three land
	// directly in the assemblage stage's light arithmetic, where a NaN
	// becomes a "#NaNNaNNaN" fill and the creature disappears.
	const metallic = unitRange("paletteRamp", "surface.metallic", surface.metallic);
	const roughness = unitRange("paletteRamp", "surface.roughness", surface.roughness);
	const opacity = unitRange("paletteRamp", "surface.opacity", surface.opacity);

	const base = compositionColor(composition);
	const pigment = pigmentStop(base, pigments);
	return {
		shadow: shade(pigment, -0.45),
		base,
		pigment,
		highlight: shade(pigment, 0.35),
		metallic,
		roughness,
		opacity,
	};
}

/** Mass-weighted metallic/roughness/opacity, matching `Element`'s PBR fields. */
export interface SurfaceProperties {
	metallic: number;
	roughness: number;
	opacity: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace("#", "");
	return {
		r: Number.parseInt(clean.slice(0, 2), 16),
		g: Number.parseInt(clean.slice(2, 4), 16),
		b: Number.parseInt(clean.slice(4, 6), 16),
	};
}

function toHexByte(v: number): string {
	return Math.max(0, Math.min(255, Math.round(v)))
		.toString(16)
		.padStart(2, "0");
}

function rgbToHex(r: number, g: number, b: number, weight: number): string {
	const norm = (v: number) => v / weight;
	return `#${toHexByte(norm(r))}${toHexByte(norm(g))}${toHexByte(norm(b))}`;
}
