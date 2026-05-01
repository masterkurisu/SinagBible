/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        parchment: "#fdfbf7",
        "parchment-canvas": "#f5f2ec",
        "parchment-dark": "#EDE8DC",
        stone: "#E8E2D8",
        quotetone: "#ebe6df",
        brown: {
          900: "#1a160f",
          800: "#2c2416",
          700: "#2c2416",
          600: "#4a3826",
          500: "#5c4f3a",
        },
        tan: {
          400: "#6B5540",
          300: "#8a7e6d",
          200: "#9c8e78",
          100: "#B5A993",
        },
        muted: "#8A7E6D",
        gold: "#c9a96e",
        "badge-gold": "#efe3c2",
        "badge-gold-ink": "#8c6a2f",
        cream: "#f5e9d6",
      },
      fontFamily: {
        serif: ["Lora_400Regular"],
        "serif-bold": ["Lora_700Bold"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
      },
    },
  },
  plugins: [],
};
