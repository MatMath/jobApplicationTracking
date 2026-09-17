import type { SupabaseClient } from '@supabase/supabase-js';
import { RESPONDED_STATUSES, type Status } from '@/db/schema';
import { fromDateInput } from '@/lib/date';
import { resolveLocation } from '@/lib/geo/places';
import type {
  ApplicationInput,
  ApplicationSearchInput,
  ApplicationUpdateInput,
  LocationChangeInput,
  MeetingInput,
  NoteInput,
  StatusChangeInput,
} from './schema';

/**
 * Every write against `applications`, as plain data logic.
 *
 * This used to live inside the Server Actions in app/applications/actions.ts,
 * which made it unreachable from anything that is not a browser form. The MCP
 * tools need the same rules — when `applied_at` is stamped, what counts as a
 * first response, when history is appended — and the rules are subtle enough
 * that a second implementation would drift within a week and quietly corrupt
 * the dashboard's time-to-reply stats. So: one copy, two thin callers.
 *
 * Every function takes the client and the user id rather than reaching for a
 * session, because the two callers authenticate differently (cookies vs. an
 * OAuth bearer token). RLS scopes the rows either way; the explicit
 * `user_id` filters here are the same belt-and-braces as db/scope.ts.
 */

export type WriteResult<T = null> = { data: T; error: null } | { data: null; error: string };

const ok = <T>(data: T): WriteResult<T> => ({ data, error: null });
const fail = (error: string): WriteResult<never> => ({ data: null, error });

/** Statuses that mean the company came back to us in some form. */
const RESPONDED = new Set<string>(RESPONDED_STATUSES);

/** Statuses that end the application's life. */
const CLOSED = new Set<string>(['rejected', 'withdrawn']);

/**
 * Resolves a company name to an id, creating the row on first use. The old
 * system stored the company as free text on each application, which split one
 * employer's stats across every spelling variant; this keeps entry just as fast
 * while still normalizing.
 */
export async function resolveCompanyId(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  website: string | null,
): Promise<WriteResult<string>> {
  const { data: existing, error: findError } = await supabase
    .from('companies')
    .select('id, website')
    .eq('user_id', userId)
    .ilike('name', name)
    .maybeSingle();

  if (findError) return fail(findError.message);

  if (existing) {
    // Fill in a website we did not have before, so the logo starts resolving by
    // domain instead of by name. Never blank out one already recorded.
    if (website && !existing.website) {
      await supabase.from('companies').update({ website }).eq('id', existing.id);
    }
    return ok(existing.id as string);
  }

  const { data: created, error: insertError } = await supabase
    .from('companies')
    .insert({ user_id: userId, name, website })
    .select('id')
    .single();

  if (insertError) return fail(insertError.message);
  return ok(created.id as string);
}

/** The four columns that describe where the office is. */
type LocationColumns = {
  location: string | null;
  location_place_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
};

/**
 * Turns an address — typed, picked from the suggestions, or passed by a model —
 * into the columns to write, geocoding it on the way.
 *
 * Here rather than in the callers because "the pin follows the address" has to
 * hold on every path: a form save, a tool call, an address corrected six weeks
 * later. Left to each caller, one of them eventually updates the text and
 * leaves the old coordinates behind, and the map quietly lies.
 *
 * `current` is the row as it stands, when there is one. Google is only asked
 * again when the address actually changed, or when a previous attempt left no
 * coordinates — an unrelated edit to the salary should not spend a lookup.
 */
async function locationColumns(
  location: string | null,
  placeId: string | null,
  /** Wider than LocationColumns in practice — only these four are read. */
  current?: LocationColumns,
): Promise<LocationColumns> {
  const blank = { location: null, location_place_id: null, location_lat: null, location_lng: null };
  if (!location && !placeId) return blank;

  const unchanged =
    current !== undefined &&
    current.location === location &&
    current.location_place_id === placeId;
  const located = current?.location_lat != null && current?.location_lng != null;
  // Rebuilt field by field rather than returned as-is: `current` is a wider row
  // than this type, and spreading it into an update would write back columns
  // this function has no business touching.
  if (unchanged && located) {
    return {
      location: current.location,
      location_place_id: current.location_place_id,
      location_lat: current.location_lat,
      location_lng: current.location_lng,
    };
  }

  const place = await resolveLocation(location, placeId);
  if (!place) {
    // The address stands; the pin does not. Keeping the old coordinates against
    // a new address would be worse than having none — the next edit retries.
    return { location, location_place_id: placeId, location_lat: null, location_lng: null };
  }

  return {
    // A caller that sent only a place id gets Google's address as the label.
    location: location ?? place.address,
    location_place_id: place.placeId,
    location_lat: place.lat,
    location_lng: place.lng,
  };
}

export async function createApplication(
  supabase: SupabaseClient,
  userId: string,
  input: ApplicationInput,
): Promise<WriteResult<string>> {
  const company = await resolveCompanyId(supabase, userId, input.company, input.companyWebsite);
  if (company.error !== null) return fail(company.error);

  const place = await locationColumns(input.location, input.locationPlaceId);

  const { data: created, error } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      company_id: company.data,
      role: input.role,
      description: input.description,
      job_url: input.jobUrl,
      application_type: input.applicationType,
      platform_found: input.platformFound,
      platform_applied: input.platformApplied,
      ...place,
      remote_type: input.remoteType,
      salary_min: input.salaryMin,
      salary_max: input.salaryMax,
      // The column defaults to CAD; sending null would override that with null.
      ...(input.salaryCurrency ? { salary_currency: input.salaryCurrency } : {}),
      cover_letter: input.coverLetter,
      status: input.status,
      // Applying is the event worth timestamping; a wishlist entry has no date.
      applied_at:
        fromDateInput(input.appliedAt) ??
        (input.status !== 'wishlist' ? new Date().toISOString() : null),
      // Created already past 'applied' (logging an older application that has
      // since moved on) still means the company replied.
      first_response_at: RESPONDED.has(input.status) ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) return fail(error.message);

  // Seed the history so time-in-stage has a starting point.
  await supabase
    .from('status_history')
    .insert({ user_id: userId, application_id: created.id, status: input.status });

  return ok(created.id as string);
}

type Lifecycle = { status: Status; first_response_at: string | null; closed_at: string | null };

/** What an update needs to know about the row before it rewrites it. */
type CurrentRow = Lifecycle & LocationColumns & { applied_at: string | null };

const CURRENT_COLUMNS =
  'status, first_response_at, closed_at, applied_at, location, location_place_id, location_lat, location_lng';

/**
 * Stamp the first reply the moment the pipeline first moves past applied. A
 * rejection counts: it is still a response, and treating it otherwise would
 * flatter the response-rate stats.
 */
function lifecycleTimestamps(current: Lifecycle, status: string, now: string) {
  return {
    first_response_at: current.first_response_at ?? (RESPONDED.has(status) ? now : null),
    closed_at: CLOSED.has(status) ? (current.closed_at ?? now) : null,
  };
}

async function loadCurrent(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<WriteResult<CurrentRow>> {
  const { data, error } = await supabase
    .from('applications')
    .select(CURRENT_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail('No such application.');
  return ok(data as unknown as CurrentRow);
}

export async function updateApplication(
  supabase: SupabaseClient,
  userId: string,
  input: ApplicationUpdateInput,
): Promise<WriteResult> {
  const current = await loadCurrent(supabase, userId, input.id);
  if (current.error !== null) return fail(current.error);

  const company = await resolveCompanyId(supabase, userId, input.company, input.companyWebsite);
  if (company.error !== null) return fail(company.error);

  // An address that changed is re-geocoded here, in the same save.
  const place = await locationColumns(input.location, input.locationPlaceId, current.data);

  const statusChanged = input.status !== current.data.status;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('applications')
    .update({
      company_id: company.data,
      role: input.role,
      description: input.description,
      job_url: input.jobUrl,
      application_type: input.applicationType,
      platform_found: input.platformFound,
      platform_applied: input.platformApplied,
      ...place,
      remote_type: input.remoteType,
      salary_min: input.salaryMin,
      salary_max: input.salaryMax,
      ...(input.salaryCurrency ? { salary_currency: input.salaryCurrency } : {}),
      cover_letter: input.coverLetter,
      outcome: input.outcome,
      rejection_reason: input.rejectionReason,
      status: input.status,
      applied_at: fromDateInput(input.appliedAt),
      ...lifecycleTimestamps(current.data, input.status, now),
    })
    .eq('id', input.id)
    .eq('user_id', userId);

  if (error) return fail(error.message);

  if (statusChanged) {
    await supabase
      .from('status_history')
      .insert({ user_id: userId, application_id: input.id, status: input.status });
  }

  return ok(null);
}

/**
 * Moves an application along the pipeline without touching the rest of the
 * record. The full update above rewrites every column from the form, which is
 * right for a form and wrong for "I got a phone screen at Acme" — that must not
 * blank out a description just because the caller did not repeat it.
 */
export async function changeStatus(
  supabase: SupabaseClient,
  userId: string,
  input: StatusChangeInput,
): Promise<WriteResult> {
  const current = await loadCurrent(supabase, userId, input.id);
  if (current.error !== null) return fail(current.error);

  const statusChanged = input.status !== current.data.status;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('applications')
    .update({
      status: input.status,
      ...(input.outcome ? { outcome: input.outcome } : {}),
      ...(input.rejectionReason ? { rejection_reason: input.rejectionReason } : {}),
      // A wishlist entry being moved on for the first time is being applied to
      // now; anything already dated keeps its date.
      applied_at:
        current.data.applied_at ?? (input.status !== 'wishlist' ? now : null),
      ...lifecycleTimestamps(current.data, input.status, now),
    })
    .eq('id', input.id)
    .eq('user_id', userId);

  if (error) return fail(error.message);

  if (statusChanged) {
    await supabase
      .from('status_history')
      .insert({ user_id: userId, application_id: input.id, status: input.status });
  }

  return ok(null);
}

/**
 * Corrects where the office is, and moves the pin with it. The full update
 * above rewrites every column from a form; this is the equivalent of
 * changeStatus for an address — "that role is at their Toronto office" must not
 * blank out a description the caller did not repeat.
 */
export async function setLocation(
  supabase: SupabaseClient,
  userId: string,
  input: LocationChangeInput,
): Promise<WriteResult<LocationColumns>> {
  const current = await loadCurrent(supabase, userId, input.id);
  if (current.error !== null) return fail(current.error);

  const place = await locationColumns(input.location, input.locationPlaceId, current.data);

  const { error } = await supabase
    .from('applications')
    .update(place)
    .eq('id', input.id)
    .eq('user_id', userId);

  if (error) return fail(error.message);
  return ok(place);
}

export async function addNote(
  supabase: SupabaseClient,
  userId: string,
  input: NoteInput,
): Promise<WriteResult> {
  const { error } = await supabase
    .from('notes')
    .insert({ user_id: userId, application_id: input.applicationId, content: input.content });

  if (error) return fail(error.message);
  return ok(null);
}

export async function addMeeting(
  supabase: SupabaseClient,
  userId: string,
  input: MeetingInput,
): Promise<WriteResult> {
  const { error } = await supabase.from('meetings').insert({
    user_id: userId,
    application_id: input.applicationId,
    scheduled_at: input.scheduledAt,
    purpose: input.purpose,
    participants: input.participants,
    challenge: input.challenge,
    outcome: input.outcome,
    notes: input.notes,
  });

  if (error) return fail(error.message);
  return ok(null);
}

/** The columns a caller outside the UI needs to identify and act on a row. */
const SUMMARY_COLUMNS =
  'id, role, status, outcome, location, location_place_id, location_lat, location_lng, remote_type, salary_min, salary_max, salary_currency, job_url, platform_found, platform_applied, applied_at, first_response_at, closed_at, created_at, companies (id, name, website)';

export async function searchApplications(
  supabase: SupabaseClient,
  userId: string,
  input: ApplicationSearchInput,
) {
  let q = supabase
    .from('applications')
    .select(SUMMARY_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(input.limit);

  if (input.status) q = q.eq('status', input.status);
  // The company name lives on the joined table, so filter through the relation
  // rather than post-filtering a page of results and returning fewer than asked.
  if (input.company) q = q.ilike('companies.name', `%${input.company}%`).not('companies', 'is', null);
  if (input.query) q = q.or(`role.ilike.%${input.query}%,description.ilike.%${input.query}%`);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function getApplication(supabase: SupabaseClient, userId: string, id: string) {
  const { data, error } = await supabase
    .from('applications')
    .select(
      `${SUMMARY_COLUMNS}, description, cover_letter, application_type, rejection_reason,
       meetings (id, scheduled_at, purpose, participants, challenge, outcome, notes),
       notes (id, content, created_at),
       status_history (status, changed_at)`,
    )
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail('No such application.');
  return ok(data);
}
