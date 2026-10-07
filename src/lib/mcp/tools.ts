import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  APPLICATION_TYPES,
  DOCUMENT_TYPES,
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
  locationChangeInput,
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
  setLocation,
} from '@/lib/applications/write';
import { ALLOWED_SUMMARY, MAX_DOCUMENT_BYTES, formatBytes } from '@/lib/documents/files';
import {
  attachInput,
  detachInput,
  documentListInput,
  documentUploadInput,
} from '@/lib/documents/schema';
import {
  attachDocument,
  detachDocument,
  listApplicationDocuments,
  listDocuments,
  readDocumentText,
  setDefaultResume,
  signedDownloadUrl,
  storeDocument,
} from '@/lib/documents/write';
import { placesConfigured, searchPlaces } from '@/lib/geo/places';
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
const DOCUMENT_TYPE_LIST = DOCUMENT_TYPES.join(' | ');
const SIZE_LIMIT = formatBytes(MAX_DOCUMENT_BYTES);

/**
 * How much of a text file get_document returns inline. A file may be 1 MB,
 * which is a quarter of a million tokens; a CV or a cover letter is a few
 * thousand characters, so this cuts nothing that is normally asked for.
 */
const MAX_INLINE_CHARS = 60_000;

/** How long a download link handed to a model stays valid, in seconds. */
const LINK_SECONDS = 300;

/**
 * Sent to the client at initialization, ahead of any tool call. The individual
 * tool descriptions say what each tool does; this says how they fit together,
 * which no single description is in a position to.
 */
export const SERVER_INSTRUCTIONS = [
  'This is one person\'s job application tracker.',
  '',
  'Applications: call search_applications before create_application, so the same posting is not recorded twice. Read a posting yourself and pass the extracted fields; no tool here fetches a URL.',
  '',
  'Documents: the tracker keeps a library of files (CVs, cover letters, saved postings, assignments) and records which ones were sent with which application. Files are immutable — a revised CV is uploaded as a new file, never an edit — so an application keeps citing exactly what was sent.',
  '- One résumé is the default (the generic CV). It is attached automatically when an application is first recorded as applied, unless a résumé is already attached.',
  '- If a tailored CV or a cover letter was sent, upload it with upload_document and pass `applicationId` so it is attached in the same call. Attach a tailored résumé BEFORE moving the application to "applied", or detach the generic one afterwards.',
  '- To reuse a file already in the library, call list_documents and then attach_document. Uploading the same bytes twice is harmless: it resolves to the existing file.',
  '- When recording a posting, also save it as a file: upload_document with type "job_posting" and the posting text as Markdown. Postings are taken down.',
  '- For a take-home, upload the brief as "assignment" and the answer as "assignment_submission", with `meetingId` naming the interview round that set it (ids are in get_application).',
  `- Only text and document files are accepted (${ALLOWED_SUMMARY}), ${SIZE_LIMIT} each. Images, audio, video and archives are refused; do not try to work around that.`,
  '- Never invent the contents of a file. Upload only text the user gave you or that you read from a source; if you do not have the actual file, say so and point the user at the Documents page.',
].join('\n');

export function registerTools(server: McpServer, appOrigin: string) {
  const linkTo = (id: string) => `${appOrigin}/applications/${id}`;
  const documentsPage = `${appOrigin}/settings/documents`;

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
        'Full detail for one application, including its interview rounds, notes, status history ' +
        'and the documents attached to it — the résumé and cover letter that were sent, the saved ' +
        'posting, any assignment. Each round and each document carries the id the document tools ' +
        'take. Use the id returned by search_applications.',
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
    'lookup_location',
    {
      title: 'Find an office address',
      description:
        "Resolve an office to a real address before recording it. This is the programmatic " +
        "half of the address autocomplete the web form shows: pass whatever the posting says " +
        "— \"Shopify Montreal\", \"1 Hacker Way, Menlo Park\", \"our Toronto office\" — and it " +
        "returns the candidates Google matched, best first, each with a `placeId` to hand to " +
        "create_application or set_application_location. Include the company name in the query " +
        "when the posting only names a city: \"Montreal\" alone is a metro area, while " +
        "\"Shopify Montreal\" is a building. Pick a candidate rather than inventing an address; " +
        "if none of them is plausibly the right office, record the city as plain text instead.",
      inputSchema: z.object({
        query: z.string().describe('What to look for, e.g. "Shopify Montreal office" or "490 Rue De la Gauchetiere O, Montreal".'),
        limit: z.number().int().min(1).max(10).optional().describe('How many candidates to return. Defaults to 5.'),
      }),
    },
    async ({ query, limit }, ctx) => {
      // Gated on the caller like every other tool: this spends the project's
      // Places quota, so it is not open to an unidentified token.
      if (!callerId(ctx)) return problem('Could not identify the signed-in user.');

      if (!placesConfigured()) {
        return problem(
          'Address lookup is not configured on this server (no GOOGLE_MAPS_API_KEY). ' +
            'Record the location as plain text; it will have no map pin.',
        );
      }

      try {
        const places = await searchPlaces(query, limit ?? 5);
        if (places.length === 0) return text(`Nothing matched "${query}".`);
        return json(places);
      } catch (error) {
        return problem(`Address lookup failed: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'set_application_location',
    {
      title: 'Correct where the office is',
      description:
        'Change the office address on an application already recorded, and move its map pin ' +
        'with it. Use this when the office turns out to be a different one than first ' +
        'recorded, or when an application was saved with only a city and the exact address is ' +
        'now known. Call lookup_location first and pass the `placeId` it returns. Everything ' +
        'else about the application is left untouched.',
      inputSchema: z.object({
        id: z.uuid().describe('The application id, from search_applications.'),
        location: z.string().optional().describe('The address to store. Omit to use the address that belongs to `locationPlaceId`.'),
        locationPlaceId: z.string().optional().describe('Google place id from lookup_location. Without it the address is resolved from the text, which is a guess.'),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = locationChangeInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const result = await setLocation(createTokenClient(authToken(ctx)), userId, parsed.data);
      if (result.error !== null) return problem(result.error);

      // Say whether the pin actually moved. A silent "saved" would hide the
      // case where the address stuck but Google could not place it.
      const pinned =
        result.data.location_lat !== null
          ? `pinned at ${result.data.location_lat}, ${result.data.location_lng}`
          : 'no map pin — the address could not be resolved';
      return text(`Location set to "${result.data.location}" (${pinned}).\n${linkTo(parsed.data.id)}`);
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
        'submitted. Unless the role is fully remote, an office location is required: call ' +
        'lookup_location first and pass the `locationPlaceId` it returns, so the application ' +
        'lands on the dashboard map at the right building rather than at whatever a city ' +
        'name happens to match. When the status is anything past "wishlist", the default résumé ' +
        'is attached as the one that was sent; the result says which file that was. If a tailored ' +
        'résumé or a cover letter was sent instead, follow up with upload_document or ' +
        'attach_document.',
      inputSchema: z.object({
        company: z.string().describe('Employer name. Reused if already known, so prefer the plain name ("Shopify", not "Shopify Inc.").'),
        role: z.string().describe('Job title as the posting states it.'),
        companyWebsite: z.string().optional().describe("The employer's own site. Used to resolve their logo."),
        jobUrl: z.string().optional().describe('URL of the posting.'),
        description: z.string().optional().describe('The posting body as plain text. Include responsibilities and requirements; drop boilerplate and nav text.'),
        location: z.string().optional().describe('Office location as stated, e.g. "Montreal, QC" or "490 Rue De la Gauchetière O, Montreal". Required unless remoteType is "remote".'),
        locationPlaceId: z.string().optional().describe('Google place id for that office, from lookup_location. Pass it whenever you have one: it pins the exact address instead of a best guess at the text.'),
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

      const supabase = createTokenClient(authToken(ctx));
      const result = await createApplication(supabase, userId, parsed.data);
      if (result.error !== null) return problem(result.error);

      const resume =
        parsed.data.status === 'wishlist' ? '' : await resumeOnRecord(supabase, userId, result.data);
      return text(
        `Added ${parsed.data.role} at ${parsed.data.company} as "${parsed.data.status}".\n` +
          `Application id: ${result.data}\n${linkTo(result.data)}${resume}`,
      );
    },
  );

  server.registerTool(
    'update_application_status',
    {
      title: 'Move an application along',
      description:
        'Change one application\'s pipeline stage, e.g. after a reply or an interview invite. ' +
        'Leaves every other field alone. Set `outcome` only once the application is finished. ' +
        'Moving an application out of "wishlist" records it as sent, and attaches the default ' +
        'résumé if no résumé is attached yet — so attach a tailored one first when there is one.',
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

      const supabase = createTokenClient(authToken(ctx));
      const result = await changeStatus(supabase, userId, parsed.data);
      if (result.error !== null) return problem(result.error);

      const resume =
        parsed.data.status === 'wishlist' ? '' : await resumeOnRecord(supabase, userId, parsed.data.id);
      return text(`Status set to "${parsed.data.status}".\n${linkTo(parsed.data.id)}${resume}`);
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

  server.registerTool(
    'list_documents',
    {
      title: 'List the document library',
      description:
        'List the files in the library: CVs, cover letters, saved postings, assignments. Each ' +
        'entry has the `id` to pass to attach_document or get_document, its type, its size, ' +
        'how many applications it is attached to, and whether it is the default résumé — the ' +
        'generic CV attached to an application when it is first recorded as applied. Call this ' +
        'before uploading a CV or cover letter, to reuse one that is already there. To see ' +
        'what is attached to one application, use get_application instead.',
      inputSchema: z.object({
        type: z.enum(DOCUMENT_TYPES).optional().describe(`Only this kind: ${DOCUMENT_TYPE_LIST}.`),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = documentListInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const result = await listDocuments(createTokenClient(authToken(ctx)), userId, parsed.data);
      if (result.error !== null) return problem(result.error);

      if (result.data.length === 0) {
        return text(
          parsed.data.type
            ? `No documents of type "${parsed.data.type}" in the library.`
            : `The library is empty. Upload the generic CV with upload_document (type "resume"), or at ${documentsPage}.`,
        );
      }
      return json(result.data);
    },
  );

  server.registerTool(
    'get_document',
    {
      title: 'Read one document',
      description:
        'Metadata for one file, a download link valid for a few minutes, and — for a text ' +
        'file such as Markdown, plain text or source code — its contents. A PDF or Word file ' +
        'is returned as a link only: its text is not extracted here, so do not describe what ' +
        'such a file says unless you have read it some other way. Use this to check what a CV ' +
        'or cover letter actually said before writing a new one, or to reread an assignment brief.',
      inputSchema: z.object({
        id: z.uuid().describe('The document id, from list_documents or get_application.'),
      }),
    },
    async ({ id }, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const supabase = createTokenClient(authToken(ctx));
      const read = await readDocumentText(supabase, userId, id);
      if (read.error !== null) return problem(read.error);

      const link = await signedDownloadUrl(supabase, userId, id, LINK_SECONDS);
      const body = read.data.text;

      return json({
        ...read.data.document,
        downloadUrl: link.error === null ? link.data.url : null,
        downloadUrlExpiresInSeconds: link.error === null ? LINK_SECONDS : null,
        content:
          body === null
            ? null
            : body.length > MAX_INLINE_CHARS
              ? body.slice(0, MAX_INLINE_CHARS)
              : body,
        contentNote:
          body === null
            ? 'Binary document: contents are not available as text. Use downloadUrl.'
            : body.length > MAX_INLINE_CHARS
              ? `Truncated to the first ${MAX_INLINE_CHARS} of ${body.length} characters. Use downloadUrl for the rest.`
              : null,
      });
    },
  );

  server.registerTool(
    'upload_document',
    {
      title: 'Add a file to the library',
      description:
        'Store a file — a CV, a cover letter, a saved job posting, an assignment brief or a ' +
        'submission — and optionally attach it to an application in the same call. Pass the ' +
        'file as `content` when it is text (a Markdown cover letter, a posting saved as text, ' +
        'source code); that is the normal case. `contentBase64` is for a PDF or Word file and ' +
        'only when you hold its exact bytes: never construct one, and if the user has such a ' +
        `file that you cannot read byte for byte, tell them to upload it at ${documentsPage} ` +
        `instead. Accepted: ${ALLOWED_SUMMARY}. Images, audio, video and archives are refused, ` +
        `and so is anything over ${SIZE_LIMIT}; the type is judged from the extension in ` +
        '`fileName` and checked against the contents. Files cannot be edited afterwards — to ' +
        'revise one, upload the new version as a new file. Uploading bytes already in the ' +
        'library returns the existing file rather than a copy, so this is safe to repeat. ' +
        'Pass `applicationId` to record that this file was sent with (or belongs to) that ' +
        'application. The first résumé uploaded becomes the default résumé automatically.',
      inputSchema: z.object({
        fileName: z.string().describe('Name with its extension, e.g. "Cover letter - Shopify.md" or "CV 2026.pdf". The extension decides the file type.'),
        content: z.string().optional().describe('The file as text. Use this for .md, .txt, .csv, .json and source code. Exactly one of `content` and `contentBase64` is required.'),
        contentBase64: z.string().optional().describe('The file as standard base64, for .pdf, .docx, .doc, .odt and .rtf. Only when you have the real bytes.'),
        type: z.enum(DOCUMENT_TYPES).describe(`What the file is: ${DOCUMENT_TYPE_LIST}. "assignment" is the brief received; "assignment_submission" is what was handed back.`),
        applicationId: z.uuid().optional().describe('Attach to this application in the same step. From search_applications.'),
        meetingId: z.uuid().optional().describe('The interview round an assignment belongs to, from get_application. Requires applicationId.'),
        makeDefaultResume: z.boolean().optional().describe('For type "resume": make this the default résumé for future applications. Applications that already have a résumé keep theirs.'),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = documentUploadInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const bytes = uploadedBytes(args.content, args.contentBase64);
      if (typeof bytes === 'string') return problem(bytes);

      const result = await storeDocument(
        createTokenClient(authToken(ctx)),
        userId,
        { fileName: args.fileName, bytes },
        parsed.data,
      );
      if (result.error !== null) return problem(result.error);

      const doc = result.data;
      const lines = [
        doc.already_stored
          ? `These exact contents were already in the library as "${doc.file_name}" (${doc.type}); no second copy was stored.`
          : `Stored "${doc.file_name}" as ${doc.type}, ${formatBytes(doc.size_bytes)}.`,
        `Document id: ${doc.id}`,
      ];
      if (doc.became_default_resume) lines.push('It is now the default résumé.');
      if (doc.attached && parsed.data.applicationId) {
        lines.push(`Attached to the application.\n${linkTo(parsed.data.applicationId)}`);
      } else {
        lines.push(`Not attached to any application yet — use attach_document to record where it was sent.\n${documentsPage}`);
      }
      return text(lines.join('\n'));
    },
  );

  server.registerTool(
    'attach_document',
    {
      title: 'Record a file against an application',
      description:
        'Attach a file already in the library to an application: "this is the CV I sent ' +
        'them", "this cover letter went with it", "this is their take-home". Get the document ' +
        'id from list_documents. The same file can be attached to any number of applications ' +
        '— that is how the generic CV works. Attaching a file that is already attached is not ' +
        'an error; it only updates which interview round it is filed under. If a tailored ' +
        'résumé replaces the generic one on an application, detach the generic one too, so ' +
        'the record shows only what was actually sent.',
      inputSchema: z.object({
        applicationId: z.uuid().describe('The application id, from search_applications.'),
        documentId: z.uuid().describe('The document id, from list_documents or upload_document.'),
        meetingId: z.uuid().optional().describe('For an assignment: the interview round that set it, from get_application.'),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = attachInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const result = await attachDocument(createTokenClient(authToken(ctx)), userId, parsed.data);
      if (result.error !== null) return problem(result.error);

      return text(
        `Attached "${result.data.file_name}" (${result.data.type}).\n${linkTo(parsed.data.applicationId)}`,
      );
    },
  );

  server.registerTool(
    'detach_document',
    {
      title: 'Remove a file from an application',
      description:
        'Undo an attachment: the file was recorded against the wrong application, or the ' +
        'generic résumé was attached automatically but a tailored one was actually sent. The ' +
        'file itself stays in the library and stays attached everywhere else. There is no tool ' +
        'for deleting a file; that is done by the user on the Documents page.',
      inputSchema: z.object({
        applicationId: z.uuid().describe('The application id.'),
        documentId: z.uuid().describe('The document id, as listed under the application in get_application.'),
      }),
    },
    async (args, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const parsed = detachInput.safeParse(args);
      if (!parsed.success) return problem(formatIssues(parsed.error));

      const result = await detachDocument(createTokenClient(authToken(ctx)), userId, parsed.data);
      if (result.error !== null) return problem(result.error);

      return text(`Detached. The file is still in the library.\n${linkTo(parsed.data.applicationId)}`);
    },
  );

  server.registerTool(
    'set_default_resume',
    {
      title: 'Choose the default résumé',
      description:
        'Name which résumé in the library is the generic CV — the one attached to an ' +
        'application when it is first recorded as applied. Use it after uploading an updated ' +
        'CV. Only affects applications from now on: every application that already has a ' +
        'résumé attached keeps the one it was sent with. The document must be of type "resume".',
      inputSchema: z.object({
        documentId: z.uuid().describe('The résumé to make the default, from list_documents.'),
      }),
    },
    async ({ documentId }, ctx) => {
      const userId = callerId(ctx);
      if (!userId) return problem('Could not identify the signed-in user.');

      const result = await setDefaultResume(createTokenClient(authToken(ctx)), userId, documentId);
      if (result.error !== null) return problem(result.error);

      return text(`"${result.data?.file_name}" is now the default résumé.\n${documentsPage}`);
    },
  );
}

/**
 * The bytes of an uploaded file, or a sentence saying why there are none.
 *
 * The size is checked on the encoded string before decoding it: base64 is four
 * characters to three bytes, so anything past that length is over the limit
 * whatever it decodes to, and there is no reason to allocate it to find out.
 */
function uploadedBytes(content: unknown, contentBase64: unknown): Uint8Array | string {
  const hasText = typeof content === 'string' && content.length > 0;
  const hasBase64 = typeof contentBase64 === 'string' && contentBase64.length > 0;
  if (hasText === hasBase64) {
    return 'Pass exactly one of `content` (text) and `contentBase64` (binary).';
  }

  if (hasText) return new TextEncoder().encode(content as string);

  const encoded = (contentBase64 as string).replace(/\s+/g, '');
  if (encoded.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4) {
    return `contentBase64: the file is larger than the ${SIZE_LIMIT} limit.`;
  }
  // Buffer.from skips characters it does not recognise instead of failing,
  // which would store a silently mangled file.
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    return 'contentBase64: not valid base64.';
  }
  return new Uint8Array(Buffer.from(encoded, 'base64'));
}

/**
 * One line on which résumé an application has on record, for the tools that
 * can cause the default one to be attached. Said every time rather than left
 * to be discovered: the attachment is automatic, and the model is the only one
 * in a position to notice that a different CV was actually sent.
 */
async function resumeOnRecord(
  supabase: ReturnType<typeof createTokenClient>,
  userId: string,
  applicationId: string,
): Promise<string> {
  const attached = await listApplicationDocuments(supabase, userId, applicationId);
  if (attached.error !== null) return '';

  const resumes = attached.data.filter((d) => d.type === 'resume');
  if (resumes.length === 0) {
    return '\nNo résumé is on record for this application. If one was sent, attach it with attach_document or upload_document.';
  }
  return (
    `\nRésumé on record: "${resumes.map((d) => d.file_name).join('", "')}". ` +
    'If a different one was sent, attach that one and detach this.'
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
