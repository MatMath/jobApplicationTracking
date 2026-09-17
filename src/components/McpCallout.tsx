import Link from 'next/link';

/**
 * Tells people — and the assistants reading over their shoulder — that this
 * tracker is not only a website.
 *
 * The MCP endpoint is invisible by construction: it advertises itself at
 * /.well-known/oauth-protected-resource, which nothing but an MCP client will
 * ever fetch. Someone using the app would never learn it exists, and an
 * assistant asked to "add this job" would offer to fill the form by hand. So
 * the URL is stated in plain text on the pages people actually look at.
 *
 * The origin is passed in rather than read from a constant because it differs
 * per environment, and an instruction block with the wrong host in it is worse
 * than none — see lib/origin.ts for why request.url cannot be trusted here.
 */

export function McpEndpoint({ origin }: { origin: string }) {
  return (
    <code className="break-all rounded bg-black/5 px-2 py-1 font-mono text-xs dark:bg-white/10">
      {origin}/api/mcp
    </code>
  );
}

/** One line for the sign-in page, where there is no account to connect yet. */
export function McpNote({ origin }: { origin: string }) {
  return (
    <div className="mt-8 rounded border border-black/15 p-4 dark:border-white/15">
      <p className="text-sm font-medium">Works with Claude and other AI assistants</p>
      <p className="mt-1.5 text-sm opacity-70">
        This tracker speaks{' '}
        <a
          href="https://modelcontextprotocol.io"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          MCP
        </a>
        , so an assistant can file a job posting for you from its URL, search
        what you have applied to, and log interview rounds — without you filling
        the form. Connect it by adding <McpEndpoint origin={origin} /> as a
        custom connector. Sign in first; you approve the connection yourself.
      </p>
    </div>
  );
}

/**
 * A nudge for the applications list, shown only while nothing is connected —
 * so it retires itself the moment it has done its job, rather than becoming a
 * permanent banner on the page people look at most.
 */
export function McpPrompt({ origin }: { origin: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded border border-black/15 px-4 py-3 dark:border-white/15">
      <p className="text-sm opacity-70">
        <span className="font-medium opacity-100">
          Let an assistant file these for you.
        </span>{' '}
        Connect Claude with <McpEndpoint origin={origin} /> and paste a posting
        URL instead of filling the form.
      </p>
      <Link
        href="/settings/connections"
        className="shrink-0 rounded border border-black/20 px-3 py-1.5 text-sm dark:border-white/20"
      >
        How to connect
      </Link>
    </div>
  );
}

/** The full how-to, for someone who has an account and wants to connect it. */
export function McpGuide({ origin }: { origin: string }) {
  return (
    <section
      aria-labelledby="mcp-guide"
      className="rounded border border-black/15 p-5 dark:border-white/15"
    >
      <h2 id="mcp-guide" className="text-base font-medium">
        Connect an AI assistant
      </h2>
      <p className="mt-1.5 text-sm opacity-70">
        This tracker exposes a{' '}
        <a
          href="https://modelcontextprotocol.io"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Model Context Protocol
        </a>{' '}
        server, so Claude — or any MCP client — can work with your applications
        directly instead of you retyping a posting into the form.
      </p>

      <p className="mt-4 text-sm font-medium">Server URL</p>
      <p className="mt-1">
        <McpEndpoint origin={origin} />
      </p>

      <ol className="mt-4 flex list-decimal flex-col gap-1.5 pl-5 text-sm opacity-70">
        <li>In Claude: Settings → Connectors → Add custom connector.</li>
        <li>Paste the URL above. There is nothing else to fill in.</li>
        <li>
          Approve the connection when it sends you back here. Check the address
          it says it will return to before you allow it.
        </li>
      </ol>

      <p className="mt-4 text-sm font-medium">Then ask for things like</p>
      <ul className="mt-1 flex flex-col gap-1 text-sm opacity-70">
        <li>&ldquo;Add this job to my tracker: &lt;paste a posting URL&gt;&rdquo;</li>
        <li>&ldquo;Have I applied to Shopify?&rdquo;</li>
        <li>&ldquo;I got a phone screen at Acme — move it along.&rdquo;</li>
        <li>&ldquo;Log today&rsquo;s technical round: they asked me to design a rate limiter.&rdquo;</li>
      </ul>

      <p className="mt-4 text-xs opacity-50">
        An assistant only ever sees your own applications, and only after you
        approve it. Revoke access any time from{' '}
        <Link href="/settings/connections" className="underline">
          connected apps
        </Link>
        .
      </p>
    </section>
  );
}
