import type { Vec2 } from "../forms/index.js";

/**
 * The directional light, and the flat shading that reads position against it.
 *
 * Split out from `assemble` because `shadow` needs the same light and the same
 * normalisation, and a package where two modules each normalise a direction
 * their own way is a package with two subtly different lights in it.
 */

/** A directional light in the same abstract space the forms live in. */
export interface Light {
	/** Direction the light travels. Need not be normalised. */
	readonly direction: Vec2;
	/**
	 * Floor brightness on the unlit side, 0..1.
	 *
	 * A design constraint rather than a physical one: a creature has to stay
	 * readable everywhere, and a physically honest zero would put half of a
	 * small sprite into an unreadable silhouette.
	 */
	readonly ambient: number;
}

/**
 * Light from the upper left.
 *
 * The convention nearly all 2D game art uses, because it matches where people
 * expect a sun to be and reads as depth without anyone thinking about it.
 */
export const DEFAULT_LIGHT: Light = {
	direction: { x: 0.7, y: 0.7 },
	ambient: 0.35,
};

/**
 * A light direction as a unit vector.
 *
 * Degenerate input — a zero vector, a NaN from bad geometry — falls back to
 * the default direction rather than producing NaN components. A light that
 * cannot be normalised would otherwise turn every part's shade into
 * "#NaNNaNNaN", which is the exact failure guarded in 0.1.1 arriving by a
 * different route.
 */
export function normalise(direction: Vec2 | undefined): Vec2 {
	const dx = Number.isFinite(direction?.x) ? (direction?.x ?? 0) : 0;
	const dy = Number.isFinite(direction?.y) ? (direction?.y ?? 0) : 0;
	const len = Math.hypot(dx, dy);
	if (!(len > 0)) return normalise(DEFAULT_LIGHT.direction);
	return { x: dx / len, y: dy / len };
}

/**
 * How much light a point catches, 0..1.
 *
 * The dot product of the point's offset against the light direction, which is
 * the flat-shading approximation: a point on the side facing the light is
 * brighter, and the falloff is smooth so nothing bands.
 *
 * There are no surface normals here because there is no surface — these are
 * outlines in a plane. Position against the light is the honest amount of
 * information available, and it is enough to make a limb sit in front of a
 * body rather than on it. What it CANNOT do is know that one part covers
 * another; that is `occlusion`'s job, and the two compose.
 */
export function litness(point: Vec2, light: Light): number {
	// A non-finite coordinate must not propagate. Found by composing the real
	// packages: a rule called with the wrong argument shape emitted a point
	// with a null coordinate, which flowed silently through this arithmetic to
	// NaN and out as a "#NaNNaNNaN" fill — a creature disappearing because one
	// number was bad, which reads as a rendering bug and is not one.
	const px = Number.isFinite(point?.x) ? point.x : 0;
	const py = Number.isFinite(point?.y) ? point.y : 0;

	const { x: nx, y: ny } = normalise(light.direction);

	// Negated because `direction` is where the light TRAVELS, so a point
	// upstream of it is the one being lit.
	const facing = -(px * nx + py * ny);

	// tanh keeps this in range for any input without a hard clamp, so a shape
	// far from the origin shades smoothly rather than saturating abruptly.
	const exposure = (Math.tanh(facing * 2) + 1) / 2;

	const ambient = Number.isFinite(light.ambient) ? Math.max(0, Math.min(1, light.ambient)) : 0;

	return ambient + (1 - ambient) * exposure;
}

/**
 * Apply a light level to a colour.
 *
 * Interpolates toward black below the midpoint and toward white above it,
 * which keeps a lit surface looking lit rather than merely less dark. Both
 * ends are clamped, so a fully lit white and a fully shadowed black are still
 * valid colours rather than overflowing into nonsense.
 *
 * ## The two halves have to have comparable slope
 *
 * The first version of this ramped to black over the lower half and only
 * HALFWAY to white over the upper half. That is a 6:1 asymmetry, and the
 * consequence was found by looking at a render rather than by any assay: every
 * monotonicity test passed, and a cast shadow was still invisible.
 *
 * The reason is that shadow does its work on the LIT side. A body at 0.675
 * losing a third of its light lands at 0.586 — which under the old curve moved
 * `#99b0cd` to `#94acca`, five values across three channels, below the
 * threshold at which anyone can see a shadow at all. All the colour resolution
 * had been spent on the dark half, where nothing varies.
 *
 * So the upper branch now reaches the same fraction of its available range as
 * the lower one. `LIT_REACH` is what keeps a fully lit surface from blowing
 * out to pure white: a creature is a coloured thing in light, not a lamp, and
 * washing its hue away at the highlight loses the pigment that
 * the pigment stage went to the trouble of deriving.
 */

/**
 * How much of its own colour a fully shadowed surface keeps.
 *
 * The floor, in colour, that `Light.ambient` is in light — and set from the
 * same argument. A creature has to stay readable everywhere, and a part that
 * ramps to black is a hole rather than a shadowed limb.
 */
const SHADOW_FLOOR = 0.35;

/**
 * How far toward white a fully lit surface travels.
 *
 * Paired with `SHADOW_FLOOR` so the two halves of the ramp have comparable
 * slope; the assay pins them within a factor of two of each other. Not 1:
 * a creature is a coloured thing in light, not a lamp, and a highlight that
 * reaches pure white throws away the pigment the pigment stage derived.
 */
const LIT_REACH = 0.75;

export function shade(hex: string, light: number): string {
	// The colour a creature is actually drawn in, so a malformed one is a
	// wrong picture rather than a crash — the failure mode this whole stack
	// keeps producing. `hex.replace` on a non-string threw "Cannot read
	// properties of undefined", naming nothing; worse, `parseInt(...) || 0`
	// below turned any unparseable string into black and returned it as a
	// confident, real-looking colour. `shade("nothex", 0.5)` was "#00000e".
	//
	// Upstream now refuses to emit a bad colour (see the pigment and chem
	// stages), so accepting one here would only hide a caller that
	// bypassed them.
	if (typeof hex !== "string" || !/^#?[0-9a-fA-F]{6}$/.test(hex)) {
		throw new TypeError(
			`shade: hex must be a 6-digit colour like "#aabbcc", got ${
				typeof hex === "string" ? `"${hex}"` : String(hex)
			}`,
		);
	}
	const clean = hex.replace("#", "");
	// Same guard as litness: a NaN level would render every channel as "NaN".
	const level = Number.isFinite(light) ? Math.max(0, Math.min(1, light)) : 0.5;

	const channel = (offset: number): number => {
		const value = Number.parseInt(clean.slice(offset, offset + 2), 16) || 0;
		const shaded =
			level < 0.5
				? // Toward black: at 0 the surface keeps SHADOW_FLOOR of its colour,
					// at 0.5 it is untouched.
					value * (SHADOW_FLOOR + (1 - SHADOW_FLOOR) * (level * 2))
				: // Toward white, with the same shape: at 0.5 untouched, at 1 it has
					// closed LIT_REACH of the distance to white.
					value + (255 - value) * ((level - 0.5) * 2) * LIT_REACH;
		return Math.max(0, Math.min(255, Math.round(shaded)));
	};

	const hexOf = (n: number) => n.toString(16).padStart(2, "0");
	return `#${hexOf(channel(0))}${hexOf(channel(2))}${hexOf(channel(4))}`;
}
