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
        primary: "#F5A623",
        "primary-dark": "#D4891C",
        "primary-soft": "#FFF1D0",
        bg: "#FBF7EE",
        surface: "#FFFFFF",
        "surface-alt": "#F5EFE1",
        ink: "#1B1814",
        "ink-2": "#6B6256",
        "ink-3": "#A39A8A",
        border: "rgba(27,24,20,0.08)",
        "border-strong": "rgba(27,24,20,0.14)",
        aman: {
          DEFAULT: "#22C55E",
          bg: "#DCFCE7",
          text: "#15803D",
        },
        warning: {
          DEFAULT: "#EF4444",
          bg: "#FEE2E2",
          text: "#B91C1C",
        },
        over: {
          DEFAULT: "#F59E0B",
          bg: "#FEF3C7",
          text: "#B45309",
        },
        max: {
          DEFAULT: "#3B82F6",
          bg: "#DBEAFE",
          text: "#1D4ED8",
        },
        partial: {
          DEFAULT: "#6366F1",
          bg: "#EDE9FE",
          text: "#6D28D9",
        },
        draft: {
          DEFAULT: "#6B7280",
          bg: "#F3F4F6",
          text: "#374151",
        },
        coral: "#FF7A59",
        "coral-soft": "#FFE5DC",
        indigo: "#5B5BD6",
        "indigo-soft": "#E6E6F9",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
      },
    },
  },
  plugins: [],
};

export default config;
