import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#16A34A",
          dark: "#15803D",
          light: "#DCFCE7",
          text: "#166534",
        },
        amber: { DEFAULT: "#F59E0B", light: "#FEF3C7" },
        red: { DEFAULT: "#EF4444", light: "#FEE2E2" },
        blue: { DEFAULT: "#3B82F6", light: "#EFF6FF" },
        bg: "#EEF0F4",
        surface: "#FFFFFF",
        border: "#E2E8F0",
        "border-strong": "#CBD5E1",
        t1: "#0F172A",
        t2: "#475569",
        t3: "#94A3B8",
      },
      fontFamily: {
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui"],
        mono: ['"DM Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "8px", lg: "12px" },
      fontSize: {
        "ui-xs": ["11px", { lineHeight: "1.4" }],
        "ui-sm": ["12px", { lineHeight: "1.4" }],
        "ui-md": ["14px", { lineHeight: "1.5" }],
        "ui-lg": ["16px", { lineHeight: "1.4" }],
        "ui-xl": ["20px", { lineHeight: "1.25" }],
        "ui-2xl": ["22px", { lineHeight: "1" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
