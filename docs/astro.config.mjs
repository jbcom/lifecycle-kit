// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";
import starlightLlmsTxt from "starlight-llms-txt";

// GitHub Pages deploys this repo under jonbogaty.com/lifecycle-kit/ (the
// jbcom org's verified custom domain). CI sets these via env; local dev
// builds at the site root instead.
const base = process.env.ASTRO_BASE ?? "/";
const site = process.env.ASTRO_SITE ?? "http://localhost:4321";

// Mirrors package.json#exports: one entry point per public subpath.
const entryPoints = [
	"../src/index.ts",
	"../src/chem/index.ts",
	"../src/bio-laws/index.ts",
	"../src/forms/index.ts",
	"../src/pigment/index.ts",
	"../src/assemblage/index.ts",
];

export default defineConfig({
	site,
	base,
	integrations: [
		starlight({
			title: "Lifecycle Kit",
			description:
				"A deterministic TypeScript stage stack for growing procedural creatures from causes rather than catalogs.",
			favicon: "/favicon.svg",
			logo: {
				src: "./src/assets/lifecycle-kit-mark.svg",
			},
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/jbcom/lifecycle-kit",
				},
				{
					icon: "npm",
					label: "npm",
					href: "https://www.npmjs.com/package/@jbdevprimary/lifecycle-kit",
				},
			],
			editLink: {
				baseUrl: "https://github.com/jbcom/lifecycle-kit/edit/main/docs/",
			},
			customCss: ["./src/styles/lifecycle-kit.css"],
			lastUpdated: true,
			pagination: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
			plugins: [
				starlightLlmsTxt({
					projectName: "Lifecycle Kit",
					description:
						"Lifecycle Kit is a deterministic TypeScript stage stack for growing procedural creatures from causes rather than catalogs. A world's chemistry determines its tissue, lived diet and activity reshape that tissue, biological laws scale the organism, compositional rules emit its form, and pigment plus self-shadowing turn the result into renderer-neutral visual data.",
					details: [
						"Install with `pnpm add @jbdevprimary/lifecycle-kit` — no runtime dependencies, ESM-only, Node.js 22+.",
						"Import the stage you need from its subpath: `@jbdevprimary/lifecycle-kit/chem`, `/bio-laws`, `/forms`, `/pigment`, `/assemblage`, or the root export for the full pipeline.",
						"Every stage is pure: functions take plain-object inputs and return plain-object outputs, so worlds are serializable, replayable, and safe to run in parallel.",
						"No hidden randomness, no browser globals, no rendering-engine lock-in.",
					].join("\n"),
					promote: ["index*", "guides/**"],
					exclude: ["reference/**"],
				}),
				starlightTypeDoc({
					entryPoints,
					tsconfig: "../tsconfig.json",
					output: "reference",
					sidebar: { label: "API Reference", collapsed: false },
					typeDoc: {
						plugin: ["typedoc-plugin-markdown"],
						entryPointStrategy: "expand",
						excludeInternal: true,
						excludePrivate: true,
						hideGenerator: true,
					},
				}),
			],
			sidebar: [
				{
					label: "Get started",
					items: [{ label: "Overview", slug: "index" }],
				},
				{
					label: "Guides",
					items: [{ autogenerate: { directory: "guides" } }],
				},
				typeDocSidebarGroup,
			],
		}),
	],
});
