import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Nome do repositório no GitHub — o site fica publicado em
// https://<usuario>.github.io/<repo>/, então o Vite precisa saber esse prefixo.
const REPO_NAME = "imobiliaria";

export default defineConfig({
  plugins: [react()],
  base: `/${REPO_NAME}/`,
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
