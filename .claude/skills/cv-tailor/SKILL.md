---
name: cv-tailor
description: Tailor the CV to one tracked application - propose the changes, wait for direction, edit the CV repo on its own branch, render the PDF, check it, and once approved file it against the application. Use when the user wants their CV or resume adapted, updated or tailored for a specific job.
argument-hint: <application id or company name>
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)
---

# Tailor the CV for one application

Application: $ARGUMENTS

Step 3 of the application flow: `job-capture` → `job-fit` → `cv-tailor` →
`job-apply` → `manager-outreach`. The user directs this step. It has two
pauses, and nothing moves past either without their say-so.

The tracker's tools come from the `job-tracker` MCP server
(`mcp__job-tracker__*`). If they are not available, stop and say so.

## Inputs

- **The application**: `get_application`. Its posting, and its attached
  "`Fit - …`" document from `job-fit`. If there is no fit document, run
  `job-fit` first — tailoring without the gap list is guessing.
- **The CV repo**: `$CV_REPO` if set; otherwise the session directory with an
  `index.html` and a `CLAUDE.md` titled "CV source"; otherwise ask. Read its
  `CLAUDE.md` before anything else. Its rules bind every edit here: hide never
  delete, nothing invented, employers/titles/dates fixed, keyword footer backed
  by the body, new facts on the bank branch first.
- The repo must be on its bank branch (`master`) with a clean working tree. If
  it is not, stop and say what is there.

## 1. Propose, then wait

Before editing anything, give the user the plan as a list. For each change:
what it is, which requirement of the posting it serves, and the line in the
repo that backs it.

- **Un-hide**: hidden blocks the posting makes relevant.
- **Hide**: visible content that costs space and earns nothing for this role.
- **Reword**: old line → new line. Reach for the posting's vocabulary only
  where the substance is already there.
- **Reorder**: what moves up.
- **Headline, summary and keyword footer**: the exact new text.

Say what you chose not to change and why, and the expected length. Then stop.
The user will strike, add and redirect. A fact they supply here that the repo
lacks is committed to the bank branch as `hidden` content first.

## 2. Edit on a branch

```bash
git -C <cv repo> switch -c apply/<company>-<role> master
```

Apply the agreed changes to `index.html` and commit. Toggle `hidden`; do not
delete or move blocks out of the file.

## 3. Render and check

```bash
${CLAUDE_SKILL_DIR}/scripts/render.sh <cv repo> "<cv repo>/out/<Full Name> - CV - <Company>.pdf"
```

Then check all of these, and report each one as passed or failed:

1. **Length**: two pages at most, unless the user asked for another length.
2. **Layout**: Read the PDF and look at every page. No job header stranded at
   the foot of a page, no page holding a line or two, no bullet split from its
   job.
3. **Text**: the PDF's extracted text has the name, the email, and every
   visible employer with its dates, in a sensible reading order.
4. **Diff**: `git -C <cv repo> diff master -- index.html`. Every added or
   changed line traces to the repo or to something the user said in this
   session. No employer, title or date changed. Nothing was deleted from the
   file, only hidden.
5. **Keyword footer**: every term is backed by the body, visible or hidden.

Fix what fails and render again before showing anything.

## 4. Show, then wait

Send the user the PDF, open `index.html` in the browser pane, and give the
change list as built plus the check results. Then stop. Each round of feedback
is: edit, commit, render, re-check, show. Continue until they approve
explicitly — "looks good" about one section is not approval of the CV.

## 5. File it

Tell the user you are about to file the approved CV in the tracker, then:

1. **The source**: `upload_document`, type `other`, `fileName`
   "`CV source - <Company> - <short hash>.html`", the branch's `index.html` as
   `content`, and the `applicationId`.
2. **The PDF**: it cannot go through `upload_document` — a model cannot
   reproduce a PDF's bytes. In Chrome, open the application's tracker page (the
   link the tracker tools return), and in its Documents section set the file
   input with the Chrome file-upload tool, choose "Résumé" under "What is it",
   and upload. Do not click the file input itself: that opens a native picker
   you cannot see. If the tracker asks for a sign-in, the user signs in.
3. **Confirm** with `get_application` that the PDF is attached. If the generic
   résumé is attached too, `detach_document` it: the record should show only
   what will be sent.
4. `add_note`: the branch, the commit hash, and the PDF's file name.
5. `git -C <cv repo> switch master`.

The application stays in its current status. Submitting is `job-apply`:
`/job-apply <application id>`.
