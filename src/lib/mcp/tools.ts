import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  APPLICATION_TYPES,
  MEETING_OUTCOMES,
  MEETING_PURPOSES,
  OUTCOMES,
  REMOTE_TYPES,
  STATUSES,
} from '@/db/schema';
import {
  applicationInput,
  applicationSearchInput,
  formatIssues,
  meetingInput,
  noteInput,
  statusChangeInput,
} from '@/lib/applications/schema';
import {
  addMeeting,
  addNote,
  changeStatus,
  createApplication,
  getApplication,
  searchApplications,
} from '@/lib/applications/write';
import { createTokenClient } from '@/lib/supabase/token';
import { userIdFrom } from './auth';

/**
 * The tools, and only the tools — transport and auth live in the route.
 *
 * The schemas here are deliberately a second, thinner layer over the ones in
 * lib/applications/schema.ts. These exist for the model: they are what
 * `tools/list` publishes as JSON Schema, so they carry the descriptions and the
 * enum values a caller needs to fill a field correctly. The schemas in
 * lib/applications are the enforcement, shared with the form, and every tool
 * below hands its arguments to them before anything reaches the database.
 */

type Ctx = { http?: { authInfo?: { extra?: Record<string, unknown> } } };

const text = (body: string) => ({ content: [{ type: 'text' as const, text: body }] });
const problem = (body: string) => ({ ...text(body), isError: true as const });

/** Tool arguments are JSON, so a read renders as JSON rather than prose. */
const json = (value: unknown) => text(JSON.stringify(value, null, 2));

/**
 * Resolves the caller, or explains why not. The 401 path is handled upstream by
 * withMcpAuth; reaching a tool without an identity would be a bug, but a tool
 * must never fall back to "some user" when it cannot tell which one.
 */
function callerId(ctx: unknown): string | null {
  return userIdFrom((ctx as Ctx).http?.authInfo as never);
}

const STATUS_LIST = STATUSES.join(' | ');

export function registerTools(server: McpServer, appOrigin: string) {
  const linkTo = (id: string) => `${appOrigin}/applications/${id}`;

  server.registerTool(
    'search_applications',
    {
      title: 'Search job applications',
      description:
        'Search the job applications already tracked. Call this before create_application ' +
        'to check whether the company and role are already recorded — the same posting found ' +
        'twice on two job boards is one application, not two. Also answers questions like ' +
        '"have I applied to Shopify?" or "what is still in the interview stage?".',
      inputSchema: z.object({
        query: z.string().optional().describe('Free text matched against the role title and the saved job description.'),
        status: z.enum(STATUSES).optional().describe(`Pipeline stage: ${STATUS_LIST}.`),
        company: z.string().optional().describe('Company name, matched as a substring, case-insensitive.'),
        limit: z.number().int().min(1).max(100).optional().describe('Maximum rows to return. Defaults to 25.'),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = applicationSearchInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const result = await searchApplications(createTokenClient(authToken(ctx)), userId, parsed.data);
      if (result.error !== null) return problem(result.error);

      if (result.data.length === 0) return text('No applications matched.');
      return json(result.data);
    },
  );

  server.registerTool(
    'get_application',
    {
      title: 'Get one job application',
      description:
        'Full detail for one application, including its interview rounds, notes and status history. ' +
        'Use the id returned by search_applications.',
      inputSchema: z.object({ id: z.uuid().describe('The application id.') }),
    },
    async ({ id }, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const result = await getApplication(createTokenClient(authToken(ctx)), userId, id);
      if (result.error !== null) return problem(result.error);
      return json(result.data);
    },
  );

  server.registerTool(
    'create_application',
    {
      title: 'Add a job application',
      description:
        'Record a job posting. Read the posting page yourself and pass the fields already ' +
        'extracted — this tool does not fetch the URL. Fill in every field the posting ' +
        'actually states and leave the rest out rather than guessing; a wrong salary or ' +
        'location is worse than a missing one. Always pass `description` with the posting ' +
        'body: postings get taken down, and the saved text is what survives. Use ' +
        'status "wishlist" for something merely of interest and "applied" once it has been ' +
        'submitted.',
      inputSchema: z.object({
        company: z.string().describe('Employer name. Reused if already known, so prefer the plain name ("Shopify", not "Shopify Inc.").'),
        role: z.string().describe('Job title as the posting states it.'),
        companyWebsite: z.string().optional().describe("The employer's own site. Used to resolve their logo."),
        jobUrl: z.string().optional().describe('URL of the posting.'),
        description: z.string().optional().describe('The posting body as plain text. Include responsibilities and requirements; drop boilerplate and nav text.'),
        location: z.string().optional().describe('Location as stated, e.g. "Montreal, QC" or "Canada (remote)".'),
        remoteType: z.enum(REMOTE_TYPES).optional().describe(`One of: ${REMOTE_TYPES.join(' | ')}. Only when the posting says so.`),
        salaryMin: z.number().int().optional().describe('Bottom of the stated salary range, annual, as a whole number.'),
        salaryMax: z.number().int().optional().describe('Top of the stated salary range, annual, as a whole number.'),
        salaryCurrency: z.string().optional().describe('ISO code, e.g. CAD or USD. Defaults to CAD.'),
        platformFound: z.string().optional().describe('Where the listing was seen, e.g. LinkedIn, Indeed, Glassdoor, Company Site.'),
        platformApplied: z.string().optional().describe('Where the application was submitted, if it differs from where it was found.'),
        applicationType: z.enum(APPLICATION_TYPES).optional().describe(`"recruiter" if a recruiter is involved, otherwise "direct".`),
        status: z.enum(STATUSES).optional().describe(`Pipeline stage: ${STATUS_LIST}. Defaults to wishlist.`),
        appliedAt: z.string().optional().describe('Date applied, YYYY-MM-DD. Defaults to today when status is past wishlist.'),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = applicationInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const result = await createApplication(createTokenClient(authToken(ctx)), userId, parsed.data);
      if (result.error !== null) return problem(result.error);

      return text(
        `Added ${parsed.data.role} at ${parsed.data.company} as "${parsed.data.status}".\n${linkTo(result.data)}`,
      );
    },
  );

  server.registerTool(
    'update_application_status',
    {
      title: 'Move an application along',
      description:
        'Change one application\'s pipeline stage, e.g. after a reply or an interview invite. ' +
        'Leaves every other field alone. Set `outcome` only once the application is finished.',
      inputSchema: z.object({
        id: z.uuid().describe('The application id, from search_applications.'),
        status: z.enum(STATUSES).describe(`New stage: ${STATUS_LIST}.`),
        outcome: z.enum(OUTCOMES).optional().describe(`How it ended: ${OUTCOMES.join(' | ')}.`),
        rejectionReason: z.string().optional().describe('Reason given, when there was one.'),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = statusChangeInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const result = await changeStatus(createTokenClient(authToken(ctx)), userId, parsed.data);
      if (result.error !== null) return problem(result.error);

      return text(`Status set to "${parsed.data.status}".\n${linkTo(parsed.data.id)}`);
    },
  );

  server.registerTool(
    'add_note',
    {
      title: 'Add a note',
      description: 'Append a dated note to an application — a recruiter call, a follow-up, a thought about fit.',
      inputSchema: z.object({
        applicationId: z.uuid().describe('The application id.'),
        content: z.string().describe('The note.'),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = noteInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const result = await addNote(createTokenClient(authToken(ctx)), userId, parsed.data);
      if (result.error !== null) return problem(result.error);
      return text(`Note added.\n${linkTo(parsed.data.applicationId)}`);
    },
  );

  server.registerTool(
    'add_meeting',
    {
      title: 'Record an interview round',
      description:
        'Add one interview round to an application. Rounds accumulate, so add the next one ' +
        'rather than editing the last. Record the technical challenge when there was one — ' +
        'it is the part worth rereading before the next round.',
      inputSchema: z.object({
        applicationId: z.uuid().describe('The application id.'),
        scheduledAt: z.string().optional().describe('When it is or was, as an ISO 8601 timestamp with offset.'),
        purpose: z.enum(MEETING_PURPOSES).optional().describe(`Round type: ${MEETING_PURPOSES.join(' | ')}.`),
        participants: z.array(z.string()).optional().describe('Names of the interviewers.'),
        challenge: z.string().optional().describe('The technical challenge or exercise given.'),
        outcome: z.enum(MEETING_OUTCOMES).optional().describe(`${MEETING_OUTCOMES.join(' | ')}. Defaults to pending.`),
        notes: z.string().optional().describe('How it went.'),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = meetingInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const result = await addMeeting(createTokenClient(authToken(ctx)), userId, parsed.data);
      if (result.error !== null) return problem(result.error);
      return text(`Interview round added.\n${linkTo(parsed.data.applicationId)}`);
    },
  );
}

/**
 * The caller's own access token, reused as the database credential so RLS sees
 * the same identity the OAuth grant named.
 */
function authToken(ctx: unknown): string {
  const token = (ctx as { http?: { authInfo?: { token?: string } } }).http?.authInfo?.token;
  if (!token) throw new Error('Tool reached without a verified token.');
  return token;
}
