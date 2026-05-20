/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#131722",
        surface: "#1e222d",
        border: "#2a2e39",
        text: "#d1d4dc",
        accent: "#2962ff",
        green: "#26a69a",
        red: "#ef5350",
      }
    }
  },
  plugins: []
}
