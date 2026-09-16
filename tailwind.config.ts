import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0b0d",
          900: "#101114",
          800: "#17181c",
          700: "#212327",
          600: "#2c2e33",
          500: "#43454b",
          400: "#6b6d74",
          300: "#9a9ca3",
          200: "#c6c8cd",
          100: "#e8e9eb",
          50: "#f6f6f7",
        },
        gold: {
          950: "#332708",
          900: "#4d3a0c",
          800: "#6b5112",
          700: "#8a6a18",
          600: "#a9821f",
          500: "#c79b2c",
          400: "#d9b34f",
          300: "#e5c876",
          200: "#efdca3",
          100: "#f7ecd0",
          50: "#fbf6e8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(10,11,13,0.04), 0 8px 24px -12px rgba(10,11,13,0.12)",
        card: "0 1px 1px rgba(10,11,13,0.03), 0 2px 8px -2px rgba(10,11,13,0.06)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s cubic-bezier(0.16,1,0.3,1)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
