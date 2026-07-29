/** @type {import('tailwindcss').Config} */
export default {
  content: ["./client/src/**/*.{js,ts,jsx,tsx}", "./client/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef9f6",
          100: "#d5f1ea",
          200: "#aee3d5",
          300: "#79cdb8",
          400: "#46b097",
          500: "#289479",
          600: "#1d7762",
          700: "#196050",
          800: "#174d41",
          900: "#154037",
          950: "#0b2521",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f8fafb",
          border: "#e4eaed",
        },
        dark: {
          bg: "#0f1117",
          surface: "#1a1d27",
          card: "#21253a",
          border: "#2d3148",
          muted: "#4a4f6a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)",
        elevated: "0 4px 16px rgba(0,0,0,.10)",
        glow: "0 0 20px rgba(40,148,121,.25)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-in": "slideIn 0.2s ease-out",
        "pulse-dot": "pulseDot 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(-8px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        pulseDot: {
          "0%, 80%, 100%": { transform: "scale(0)" },
          "40%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
