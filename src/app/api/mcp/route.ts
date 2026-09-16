import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyToken } from '@/lib/mcp/auth';
import { registerTools } from '@/lib/mcp/tools';
import { publicOrigin } from '@/lib/origin';

/**
 * The MCP endpoint. Add it to Claude as a custom connector and the tools in
 * lib/mcp/tools.ts become available there.
 *
 * Authorization is Supabase Auth's OAuth 2.1 server, not something built here:
 * the client discovers it through /.well-known/oauth-protected-resource, sends
 * the user through /oauth/consent, and arrives with a Supabase JWT. Which means
 * the existing RLS policies do the scoping and this service still holds no
 * secrets — see lib/supabase/token.ts.
 */

// Route handlers are static by default when they take no dynamic input; this
// one reads headers per request and must never be prerendered or cached.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Built per request rather than once at module load, so tool output can carry
 * links on the origin the caller actually reached — request.url says
 * localhost:8080 behind Cloud Run (see lib/origin.ts). Constructing the server
 * is cheap and each MCP request is independently stateless anyway.
 */
async function handle(request: Request): Promise<Response> {
  const origin = publicOrigin(request.headers);

  const handler = createMcpHandler((server) => registerTools(server, origin), {
    serverInfo: { name: 'job-tracker', version: '1.0.0' },
  });

  return withMcpAuth(handler, verifyToken, {
    required: true,
    // No custom scopes: the token names a user, and RLS decides the rest.
    requiredScopes: [],
    // Both this and the metadata route must name the same resource, or a client
    // rejects the challenge as pointing somewhere else.
    resourceUrl: origin,
  })(request);
}

export { handle as GET, handle as POST, handle as DELETE };
