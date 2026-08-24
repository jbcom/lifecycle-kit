import { defineConfig, markdown } from "sourcey";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

function markdownPages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? markdownPages(path)
        : entry.isFile() && /\.mdx?$/i.test(entry.name)
          ? [relative(".", path).split(sep).join("/").replace(/\.mdx?$/i, "")]
          : [];
    })
    .sort();
}

// TypeDoc writes these Markdown pages immediately before Sourcey builds. Keep
// the generated reference in one Sourcey navigation group without maintaining
// a second hand-authored inventory of every exported symbol.
const apiPages = markdownPages("api");
const apiPagesFor = (prefix: string) => apiPages.filter((page) => page.startsWith(prefix));

export default defineConfig({
  name: "Lifecycle Kit",
  siteUrl: "https://jonbogaty.com",
  baseUrl: "/lifecycle-kit/",
  prettyUrls: "slash",
  theme: {
    preset: "default",
    colors: {
      primary: "#365c4a",
      light: "#728c80",
      dark: "#254033",
    },
    fonts: {
      sans: "Avenir Next, Avenir, Helvetica Neue, Arial, sans-serif",
      mono: "SFMono-Regular, Consolas, Liberation Mono, monospace",
    },
    layout: {
      content: "48rem",
    },
    css: ["./src/styles/lifecycle-kit.css"],
  },
  logo: { light: "./src/assets/lifecycle-kit-mark.svg", href: "/lifecycle-kit/" },
  favicon: "./public/favicon.svg",
  ogImage: "./lifecycle-kit-hero.webp",
  repo: "https://github.com/jbcom/lifecycle-kit",
  editBranch: "main",
  editBasePath: "docs",
  navbar: {
    links: [
      { type: "github", href: "https://github.com/jbcom/lifecycle-kit" },
      { type: "npm", href: "https://www.npmjs.com/package/lifecycle-kit" },
    ],
  },
  footer: {
    links: [{ type: "github", href: "https://github.com/jbcom/lifecycle-kit" }],
  },
  changelog: { feed: true, permalinks: true, ogImages: true },
  search: { featured: ["introduction", "get-started", "pipeline"] },
  navigation: {
    tabs: [
      {
        tab: "Documentation",
        slug: "",
        source: markdown({
          groups: [
            {
              group: "Getting Started",
              pages: ["introduction", "get-started"],
            },
            {
              group: "Concepts",
              pages: ["pipeline", "determinism"],
            },
            {
              group: "Guides",
              pages: ["rendering", "agentic-consumers"],
            },
            { group: "Reference", pages: ["api-reference"] },
            { group: "API: package", pages: apiPagesFor("api/README").concat(apiPagesFor("api/index/")) },
            { group: "API: chem", pages: apiPagesFor("api/chem/") },
            { group: "API: bio-laws", pages: apiPagesFor("api/bio-laws/") },
            { group: "API: forms", pages: apiPagesFor("api/forms/") },
            { group: "API: pigment", pages: apiPagesFor("api/pigment/") },
            { group: "API: assemblage", pages: apiPagesFor("api/assemblage/") },
            {
              group: "Project",
              pages: ["contributing", "security"],
            },
          ],
        }),
      },
    ],
  },
});
