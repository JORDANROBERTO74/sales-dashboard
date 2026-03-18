function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getLast30DaysRange() {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);

  return {
    from: toDateOnly(from),
    to: toDateOnly(to),
  };
}
