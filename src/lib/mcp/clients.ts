/**
 * Recognition for OAuth clients arriving at the consent screen.
 *
 * With dynamic client registration enabled, anyone can register a client and
 * choose its name — `client_name` is attacker-controlled, so "Claude" on the
 * consent screen proves nothing. The redirect URI is the part that cannot be
 * faked usefully: it is where the authorization code is delivered, so an
 * attacker has to name a host they control, and a host they control is exactly
 * what this flags.
 *
 * This is deliberately advisory rather than a block list. A new MCP client
 * appearing is normal and should not be unapprovable; it should just not be
 * able to dress itself up as one you already trust.
 */

/** Hosts whose redirect URIs belong to MCP clients we expect to see. */
const KNOWN_HOSTS: Record<string, string> = {
  'claude.ai': 'Claude',
  'claude.com': 'Claude',
  'chatgpt.com': 'ChatGPT',
  'openai.com': 'ChatGPT',
  'cursor.com': 'Cursor',
  'cursor.sh': 'Cursor',
  localhost: 'a local client',
  '127.0.0.1': 'a local client',
};

export type ClientRecognition =
  | { known: true; host: string; label: string }
  | { known: false; host: string; insecure: boolean };

export function recognizeClient(redirectUri: string): ClientRecognition {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    // Supabase validated this on registration, so a value we cannot parse is
    // strange enough to be worth surfacing rather than swallowing.
    return { known: false, host: redirectUri, insecure: true };
  }

  const label = KNOWN_HOSTS[url.hostname];
  if (label) return { known: true, host: url.hostname, label };

  // Plain http off localhost means the code can be read in transit.
  const insecure = url.protocol !== 'https:' && !isLoopback(url.hostname);
  return { known: false, host: url.hostname, insecure };
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
