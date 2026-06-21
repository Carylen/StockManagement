import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutral base
        bg:           "var(--c-bg)",
        surface:      "var(--c-surface)",
        "surface-alt":"var(--c-surface-alt)",
        ink:          "var(--c-ink)",
        "ink-2":      "var(--c-ink-2)",
        "ink-3":      "var(--c-ink-3)",
        line:         "var(--c-line)",
        "line-strong":"var(--c-line-strong)",
        border:       "var(--c-line-strong)",

        // Brand (context-aware — switches KPP ↔ UT via data-org)
        brand: {
          DEFAULT: "var(--brand-primary)",
          deep:    "var(--brand-primary-deep)",
          soft:    "var(--brand-primary-soft)",
          on:      "var(--on-brand-primary)",
        },

        // KPP Mining palette
        kpp: {
          DEFAULT: "var(--c-kpp)",
          deep:    "var(--c-kpp-deep)",
          mid:     "var(--c-kpp-mid)",
          soft:    "var(--c-kpp-soft)",
        },

        // United Tractors palette
        ut: {
          DEFAULT: "var(--c-ut)",
          deep:    "var(--c-ut-deep)",
          soft:    "var(--c-ut-soft)",
        },

        // Site badges
        "site-agmr": { DEFAULT: "var(--c-site-agmr)", soft: "var(--c-site-agmr-soft)" },
        "site-rant": { DEFAULT: "var(--c-site-rant)", soft: "var(--c-site-rant-soft)" },
        "site-sput": { DEFAULT: "var(--c-site-sput)", soft: "var(--c-site-sput-soft)" },

        // Stock status
        aman:    { DEFAULT: "var(--c-aman)",    bg: "var(--c-aman-bg)" },
        warning: { DEFAULT: "var(--c-warning)", bg: "var(--c-warning-bg)" },
        over:    { DEFAULT: "var(--c-over)",    bg: "var(--c-over-bg)" },
        max:     { DEFAULT: "var(--c-max)",     bg: "var(--c-max-bg)" },

        // Inquiry status (v2.0)
        pending: { DEFAULT: "var(--c-pending)", bg: "var(--c-pending-bg)" },
        valid:   { DEFAULT: "var(--c-valid)",   bg: "var(--c-valid-bg)" },
        invalid: { DEFAULT: "var(--c-invalid)", bg: "var(--c-invalid-bg)" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm:   "8px",
        md:   "12px",
        lg:   "16px",
        xl:   "18px",
        "2xl":"24px",
      },
    },
  },
  plugins: [],
};

export default config;
