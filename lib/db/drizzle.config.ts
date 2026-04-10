import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Use a relative, forward-slash path. Drizzle-kit resolves this against
// the config file's own directory on every platform. The previous
// path.join(__dirname, ...) produced backslashes on Windows that broke
// the internal glob resolver.
export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
