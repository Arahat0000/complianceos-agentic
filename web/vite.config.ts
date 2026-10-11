import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig(({ mode }) => {
  // The platform AI defaults live in the repo-root .env (shared with the server).
  // Only these non-secret values are exposed to the browser — never the token.
  const rootEnv = loadEnv(mode, path.resolve(import.meta.dirname, ".."), "")
  const aiDefaults = {
    provider: "bedrock",
    model: rootEnv.AWS_BEDROCK_MODEL_ID || "apac.amazon.nova-pro-v1:0",
    embeddingModel: rootEnv.AWS_BEDROCK_EMBEDDING_MODEL_ID || "amazon.titan-embed-text-v2:0",
  }
  return {
  define: { __AI_DEFAULTS__: JSON.stringify(aiDefaults) },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  }
})
