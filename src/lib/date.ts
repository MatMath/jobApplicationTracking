/**
 * Today as YYYY-MM-DD in the server's local zone, for date input defaults.
 * Computed on the server and passed down, so a client in a different zone
 * cannot produce a hydration mismatch by computing a different "today".
 */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * A `<input type="date">` value is a calendar date with no zone. Sending the
 * bare "2026-08-26" to a timestamptz column makes Postgres read it as UTC
 * midnight; rendering that back in a western timezone shows the previous day.
 *
 * So: interpret the input as local midnight on write, and derive the input's
 * value from local date parts on read. Slicing the stored ISO string would
 * reintroduce the same bug mirrored, for anyone east of UTC.
 */
export function fromDateInput(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toISOString();
}

export function toDateInput(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-CA');
}
