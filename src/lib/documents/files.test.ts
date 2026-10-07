import { describe, expect, it } from 'vitest';
import { ALLOWED_EXTENSIONS, MAX_DOCUMENT_BYTES, checkFile, displayName, extensionOf } from './files';

/**
 * The rule the library exists to hold: text and documents in, everything else
 * out, nothing over 1 MB. The cases that matter are the ones where the name and
 * the content disagree, because the name is the part a caller controls.
 */

const text = (s: string) => new TextEncoder().encode(s);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const PDF = text('%PDF-1.7\n1 0 obj\n<< >>\nendobj\n');
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]);

describe('checkFile', () => {
  it('accepts a PDF and a Word file as what they are', () => {
    expect(checkFile('cv.pdf', PDF)).toMatchObject({ ok: true, mimeType: 'application/pdf', isText: false });
    expect(checkFile('CV.DOCX', ZIP)).toMatchObject({
      ok: true,
      extension: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  });

  it('stores source code as plain text, whatever the language', () => {
    for (const name of ['solution.ts', 'main.py', 'index.html', 'data.json', 'Query.sql']) {
      expect(checkFile(name, text('const answer = 42;\n'))).toMatchObject({
        ok: true,
        mimeType: 'text/plain',
        isText: true,
      });
    }
  });

  it('keeps the more specific type for Markdown and CSV', () => {
    expect(checkFile('cover-letter.md', text('# Hello'))).toMatchObject({ mimeType: 'text/markdown' });
    expect(checkFile('scores.csv', text('a,b\n1,2'))).toMatchObject({ mimeType: 'text/csv' });
  });

  it('accepts text that is not ASCII', () => {
    expect(checkFile('lettre.txt', text('Montréal — développeur'))).toMatchObject({ ok: true });
  });

  it('refuses images, video and archives by name', () => {
    for (const name of ['photo.png', 'scan.jpg', 'diagram.svg', 'demo.mp4', 'talk.mov', 'repo.zip', 'song.mp3']) {
      const verdict = checkFile(name, text('whatever'));
      expect(verdict.ok, name).toBe(false);
    }
  });

  it('refuses an image renamed to a text extension', () => {
    const verdict = checkFile('notes.txt', PNG);
    expect(verdict).toMatchObject({ ok: false });
    expect(!verdict.ok && verdict.error).toContain('not plain text');
  });

  it('refuses a PDF name over content that is not a PDF', () => {
    expect(checkFile('cv.pdf', PNG).ok).toBe(false);
    expect(checkFile('cv.pdf', text('just some words')).ok).toBe(false);
    expect(checkFile('cv.docx', PDF).ok).toBe(false);
  });

  it('holds the limit at exactly 1 MB', () => {
    const atLimit = new Uint8Array(MAX_DOCUMENT_BYTES).fill(0x61);
    const over = new Uint8Array(MAX_DOCUMENT_BYTES + 1).fill(0x61);

    expect(MAX_DOCUMENT_BYTES).toBe(1_048_576);
    expect(checkFile('big.txt', atLimit).ok).toBe(true);

    const verdict = checkFile('big.txt', over);
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.error).toContain('limit is 1 MB');
  });

  it('refuses an empty file and a file with no extension', () => {
    expect(checkFile('empty.txt', new Uint8Array()).ok).toBe(false);
    expect(checkFile('Makefile', text('all:\n')).ok).toBe(false);
    expect(checkFile('.env', text('A=1')).ok).toBe(false);
  });
});

describe('file names', () => {
  it('reads the extension off the last segment only', () => {
    expect(extensionOf('archive.tar.GZ')).toBe('gz');
    expect(extensionOf('some.dir/readme')).toBe('');
  });

  it('shows the base name, not the path it came with', () => {
    expect(displayName('C:\\Users\\me\\CV final.pdf')).toBe('CV final.pdf');
    expect(displayName('../../etc/passwd.txt')).toBe('passwd.txt');
  });

  it('lists no image, audio, video or archive extension as allowed', () => {
    const refused = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'mp4', 'mov', 'webm', 'mp3', 'wav', 'zip', 'gz', 'tar'];
    expect(ALLOWED_EXTENSIONS.filter((e) => refused.includes(e))).toEqual([]);
  });
});
