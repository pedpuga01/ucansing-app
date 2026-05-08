import type { Config } from "tailwindcss";

const config: Config = {
  // 1. Le decimos a Tailwind dónde buscar nuestras clases
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 2. Inyectamos los colores oficiales de UCANSING
      colors: {
        navy: "#0B132D",
        red: "#D20505",
        orange: "#FC6827",
        blue: "#0466C8",
      },
      // 3. Conectamos las tipografías de Google Fonts
      fontFamily: {
        sans: ['var(--font-montserrat)', 'sans-serif'],
        poppins: ['var(--font-poppins)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;