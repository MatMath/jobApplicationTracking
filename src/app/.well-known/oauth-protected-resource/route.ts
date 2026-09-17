import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler';
import { publicOrigin } from '@/lib/origin';

/**
 * RFC 9728 protected resource metadata: the first thing an MCP client fetches,
 * and the only thing that tells it where to go to get a token. It points at
 * Supabase Auth, which is the authorization server for this app.
 *
 * Kept public in middleware.ts — discovery necessarily happens before the
 * client holds any credential.
 */

export const dynamic = 'force-dynamic';

const authServerUrls = [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`];

export function GET(request: Request): Response {
  // mcp-handler can derive this from forwarded headers, but publicOrigin also
  // honours NEXT_PUBLIC_SITE_URL, which is what a custom domain would set.
  return protectedResourceHandler({
    authServerUrls,
    resourceUrl: publicOrigin(request.headers),
  })(request);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
