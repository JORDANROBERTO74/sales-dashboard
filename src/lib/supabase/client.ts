import { createBrowserClient } from "@supabase/ssr";

/**
 * Validates that required Supabase environment variables are set.
 * Logs warning in development, throws error in production.
 */
function validateEnvVars() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      );
    }
    console.warn(
      "Missing Supabase environment variables. Some features may not work correctly.",
    );
  }

  return { url: url!, key: key! };
}

let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Creates a Supabase client for browser/client-side usage.
 * Uses a singleton pattern to ensure the same instance is used throughout the app.
 */
export function createClient() {
  const { url, key } = validateEnvVars();

  if (client) return client;

  client = createBrowserClient(url, key);
  return client;
}
