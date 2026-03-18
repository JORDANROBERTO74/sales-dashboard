/**
 * Validates that a redirect URL is safe (internal only, no external URLs)
 * Prevents open redirect vulnerabilities
 *
 * @param path - The path to validate
 * @returns true if the path is safe to redirect to, false otherwise
 */
export function isValidRedirectPath(path: string | null): boolean {
  if (!path) return false;

  // Must start with "/" to be an internal path
  if (!path.startsWith("/")) return false;

  // Reject URLs with protocol (http://, https://, etc.)
  if (path.includes("://")) return false;

  // Reject javascript: or data: schemes (even if they somehow get through)
  if (/^(javascript|data|vbscript):/i.test(path)) return false;

  // Reject paths that try to escape with ".."
  if (path.includes("..")) return false;

  // Reject paths with control characters or null bytes
  if (/[\x00-\x1F\x7F]/.test(path)) return false;

  // Allow root path "/"
  if (path === "/") return true;

  // Reject paths that are just whitespace or empty segments
  const segments = path.split("/").filter((s) => s !== "");
  if (segments.length === 0) return false;

  // Reject paths with percent-encoded protocols (like %2F%2F for //)
  if (path.includes("%2F%2F") || path.includes("%2f%2f")) return false;

  // Reject paths that decode to dangerous schemes
  try {
    const decoded = decodeURIComponent(path);
    if (/^(javascript|data|vbscript):/i.test(decoded)) return false;
  } catch {
    // Invalid encoding, reject
    return false;
  }

  return true;
}

/**
 * Gets a safe redirect path, falling back to default if invalid
 *
 * @param redirectTo - The redirect path from query params or other source
 * @param defaultPath - Default path to use if redirectTo is invalid
 * @returns A safe redirect path
 */
export function getSafeRedirectPath(
  redirectTo: string | null,
  defaultPath: string = "/"
): string {
  return isValidRedirectPath(redirectTo) ? redirectTo! : defaultPath;
}
