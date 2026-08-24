import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf6",
          100: "#d6f5e7",
          200: "#b0ead4",
          500: "#1c9a6c",
          600: "#117b56",
          700: "#0f6348",
          800: "#10503c",
          900: "#0d4233",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.03), 0 10px 30px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
