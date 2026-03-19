function normalizePath(path: string): string {
  if (!path) return "/";

  const [withoutQuery] = path.split("?");
  const [withoutHash] = withoutQuery.split("#");

  if (!withoutHash || withoutHash === "/") {
    return "/";
  }

  const normalized = withoutHash.endsWith("/")
    ? withoutHash.slice(0, -1)
    : withoutHash;

  return normalized || "/";
}

const ACTIVE_ROUTE_ALIASES: Record<string, string[]> = {
  "/admin/balances/payouts": ["/admin/payouts"],
};

function matchesBySegment(current: string, base: string): boolean {
  if (current === base) {
    return true;
  }

  if (base === "/") {
    return current === "/";
  }

  return current.startsWith(`${base}/`);
}

function getActiveCandidates(basePath: string): string[] {
  if (basePath.trim() === "#") {
    return [];
  }

  const base = normalizePath(basePath);
  const aliases = ACTIVE_ROUTE_ALIASES[base] ?? [];
  const normalizedAliases = aliases.map(normalizePath);

  return [base, ...normalizedAliases];
}

function getRouteMatchScore(pathname: string, basePath: string): number {
  const current = normalizePath(pathname);
  const candidates = getActiveCandidates(basePath);

  let bestScore = -1;
  for (const candidate of candidates) {
    if (matchesBySegment(current, candidate)) {
      bestScore = Math.max(bestScore, candidate.length);
    }
  }

  return bestScore;
}

export function isRouteActive(pathname: string, basePath: string): boolean {
  return getRouteMatchScore(pathname, basePath) >= 0;
}

export function getBestActiveRoute(
  pathname: string,
  candidates: string[],
): string | undefined {
  let bestCandidate: string | undefined;
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = getRouteMatchScore(pathname, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestScore >= 0 ? bestCandidate : undefined;
}
