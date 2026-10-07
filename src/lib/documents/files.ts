/**
 * What may be uploaded, decided in one place.
 *
 * The library is for CVs, cover letters, postings and take-home work — things
 * made of text. Images, audio, video and archives are refused, and nothing may
 * exceed 1 MB, because the storage this sits on is a free tier and one phone
 * photo of a whiteboard is larger than every CV a person will ever write.
 *
 * Two things here are deliberate and easy to undo by accident:
 *
 * The type is decided from the extension, never from the browser's Content-Type.
 * Browsers report an empty string for `.md` and `video/mp2t` for `.ts`, so an
 * allow-list of MIME types would reject Markdown and wave TypeScript through as
 * a video. The extension picks the type; the first bytes then have to agree
 * with it, so a renamed PNG is not a `.txt`.
 *
 * Source code is stored as `text/plain`, whatever the language. That keeps the
 * bucket's own allow-list to eight entries, and it means an uploaded `.html`
 * can never be served back as a page.
 *
 * Nothing in this file touches Node or the network: the upload form imports it
 * for the same limits the server enforces.
 */

/** 1 MB. The bucket and a CHECK constraint carry the same number. */
export const MAX_DOCUMENT_BYTES = 1024 * 1024;

export const STORAGE_BUCKET = 'documents';

type Signature = 'pdf' | 'ole' | 'zip' | 'rtf' | 'text';

const BINARY_FORMATS: Record<string, { mimeType: string; signature: Signature }> = {
  pdf: { mimeType: 'application/pdf', signature: 'pdf' },
  rtf: { mimeType: 'application/rtf', signature: 'rtf' },
  doc: { mimeType: 'application/msword', signature: 'ole' },
  docx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signature: 'zip',
  },
  odt: { mimeType: 'application/vnd.oasis.opendocument.text', signature: 'zip' },
};

/** Plain text that has a more specific type worth keeping. */
const TEXT_TYPES: Record<string, string> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
};

/**
 * Everything else that is text. Long because a take-home can be in anything;
 * the content check below is what actually holds the line, this list only
 * decides what is worth checking.
 */
const TEXT_EXTENSIONS = [
  'txt', 'text', 'log', 'tex', 'rst', 'adoc', 'org',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte',
  'py', 'ipynb', 'rb', 'php', 'go', 'rs', 'java', 'kt', 'kts', 'scala', 'swift',
  'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'fs', 'm', 'r', 'jl', 'lua', 'pl', 'dart',
  'ex', 'exs', 'erl', 'hs', 'clj', 'elm', 'zig',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat',
  'sql', 'graphql', 'gql', 'proto',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'json', 'jsonl', 'yaml', 'yml', 'toml', 'xml', 'ini', 'cfg', 'conf', 'tf', 'gradle',
  'diff', 'patch',
] as const;

const TEXT_SET = new Set<string>([...TEXT_EXTENSIONS, ...Object.keys(TEXT_TYPES)]);

/** Every accepted extension, for the file picker's `accept` and for messages. */
export const ALLOWED_EXTENSIONS: readonly string[] = [
  ...Object.keys(BINARY_FORMATS),
  ...Object.keys(TEXT_TYPES),
  ...TEXT_EXTENSIONS,
];

/** Short enough to put in an error message; the full list is not. */
export const ALLOWED_SUMMARY =
  'PDF, Word (.doc, .docx), OpenDocument (.odt), RTF, or any plain-text file ' +
  '(.txt, .md, .csv, .json, source code)';

export function extensionOf(fileName: string): string {
  const base = fileName.slice(fileName.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  // A leading dot is a hidden file's name, not an extension.
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/**
 * The name to show and to offer on download: the last path segment, with
 * anything that is not printable removed. It is never used as a storage key —
 * objects are named by document id — so this only has to be presentable.
 */
export function displayName(fileName: string): string {
  const base = fileName.replace(/\\/g, '/').split('/').pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.slice(-200);
}

export type FileVerdict =
  | { ok: true; fileName: string; extension: string; mimeType: string; isText: boolean }
  | { ok: false; error: string };

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

/** Does the content look like what the extension says it is? */
function matchesSignature(bytes: Uint8Array, signature: Signature): boolean {
  switch (signature) {
    case 'pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case 'rtf':
      return startsWith(bytes, [0x7b, 0x5c, 0x72, 0x74, 0x66]); // {\rtf
    case 'ole':
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case 'zip':
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]); // PK..
    case 'text':
      return isText(bytes);
  }
}

/**
 * Text means: decodes as UTF-8 and holds no NUL. Every image, video and archive
 * format fails one or the other within its first few bytes, which is what makes
 * an extension allow-list safe to be generous with.
 */
function isText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Accepts or refuses a file, and says what it is.
 *
 * Every refusal is a sentence a person can act on, because both callers show it
 * verbatim: the form in its alert, an MCP tool as its result.
 */
export function checkFile(fileName: string, bytes: Uint8Array): FileVerdict {
  const name = displayName(fileName);
  if (!name) return { ok: false, error: 'The file needs a name.' };

  const extension = extensionOf(name);
  const binary = BINARY_FORMATS[extension];
  if (!binary && !TEXT_SET.has(extension)) {
    return {
      ok: false,
      error: extension
        ? `.${extension} files are not accepted. Upload ${ALLOWED_SUMMARY}. Images, audio, video and archives are refused.`
        : `"${name}" has no extension, so its type cannot be told. Upload ${ALLOWED_SUMMARY}.`,
    };
  }

  if (bytes.byteLength === 0) return { ok: false, error: `"${name}" is empty.` };
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `"${name}" is ${formatBytes(bytes.byteLength)}; the limit is ${formatBytes(MAX_DOCUMENT_BYTES)} per file.`,
    };
  }

  if (!matchesSignature(bytes, binary?.signature ?? 'text')) {
    return {
      ok: false,
      error: binary
        ? `"${name}" is not a valid .${extension} file — its contents are something else.`
        : `"${name}" is not plain text. Only UTF-8 text is accepted under a .${extension} name.`,
    };
  }

  return {
    ok: true,
    fileName: name,
    extension,
    mimeType: binary?.mimeType ?? TEXT_TYPES[extension] ?? 'text/plain',
    isText: !binary,
  };
}

/** Whether a stored type can be read back as text, e.g. to hand to a model. */
export function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
}
