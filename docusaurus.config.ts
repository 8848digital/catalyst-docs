import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const GITHUB_ORG = "https://github.com/8848digital";

const config: Config = {
  title: "Catalyst",
  tagline: "Offline-first Web and Mobile apps",
  // TODO(branding): add favicon.ico / logo.svg to static/img and re-enable
  // `favicon`, the navbar `logo`, and themeConfig `image` once they exist.

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Live at https://8848digital.github.io/catalyst-docs/ via GitHub Pages.
  // If this ever moves to a custom domain, `url` becomes that domain and
  // `baseUrl` becomes '/'.
  url: "https://8848digital.github.io",
  baseUrl: "/catalyst-docs/",

  organizationName: "8848digital",
  projectName: "catalyst-docs",

  // Inter, loaded from Google Fonts. Preconnect first so the font request is not
  // blocked behind DNS and TLS setup. The CSS falls back to the system stack.
  headTags: [
    {
      tagName: "link",
      attributes: { rel: "preconnect", href: "https://fonts.googleapis.com" },
    },
    {
      tagName: "link",
      attributes: {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "anonymous",
      },
    },
  ],

  stylesheets: [
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  ],

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang.
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  // The docs were restructured after the site went live. These keep the four
  // originally-published URLs working instead of 404ing on anyone who kept a link.
  plugins: [
    [
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
          { from: "/docs/getting-started/what-is-catalyst", to: "/docs/how-it-works/architecture" },
          { from: "/docs/getting-started/quickstart", to: "/docs/build/quickstart" },
          { from: "/docs/getting-started/what-am-i-looking-at", to: "/docs/build/the-workspace" },
          { from: "/docs/getting-started/build-your-first-feature", to: "/docs/build/your-first-feature" },
        ],
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: `${GITHUB_ORG}/catalyst-docs/tree/main/`,
        },
        // No blog. Re-enable here if a changelog or release feed is ever wanted.
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Catalyst",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: `${GITHUB_ORG}/reactant`,
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "light",
      links: [
        {
          title: "Repositories",
          items: [
            {
              label: "reactant (starter)",
              href: `${GITHUB_ORG}/reactant`,
            },
            {
              label: "catalyst (chassis)",
              href: `${GITHUB_ORG}/catalyst`,
            },
            {
              label: "offline-kit (engine)",
              href: `${GITHUB_ORG}/offline-kit`,
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 8848 Digital.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
