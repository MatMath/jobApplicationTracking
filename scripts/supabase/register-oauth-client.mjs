#!/usr/bin/env node
/**
 * Registers one OAuth client with this project's Supabase Auth OAuth 2.1
 * server, so an MCP client can be pointed at the tracker.
 *
 *   node scripts/supabase/register-oauth-client.mjs [name]
 *
 * The alternative is dynamic client registration, which Supabase leaves off by
 * default. Registering by hand is the safer of the two: with DCR enabled,
 * anyone who finds the project URL can register a client and put a consent
 * prompt in front of you. This way the only clients that exist are ones you
 * created.
 *
 * Needs SUPABASE_SECRET_KEY, which is why this is a local script and not a
 * route: the key bypasses RLS and deliberately never reaches Cloud Run (see
 * cloudbuild.yaml). The client secret it prints is shown once — Supabase does
 * not return it again.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/** Read .env directly: this runs outside Next, which is what normally loads it. */
function env(name) {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;

  const line = readFileSync(new URL('../../.env', import.meta.url), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  if (!line) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

/**
 * Claude's callbacks. Supabase matches redirect URIs exactly — no wildcards —
 * so every surface that might connect has to be listed up front.
 */
const REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
  'http://localhost:6274/oauth/callback', // MCP Inspector, for local testing
];

const supabase = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.admin.oauth.createClient({
  client_name: process.argv[2] ?? 'Claude',
  redirect_uris: REDIRECT_URIS,
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  scope: 'openid email profile offline_access',
  // Public client: Claude uses PKCE, and a secret it has to store adds nothing.
  token_endpoint_auth_method: 'none',
});

if (error) {
  console.error('Registration failed:', error.message);
  process.exit(1);
}

console.log('Registered.\n');
console.log(`  client_id:     ${data.client_id}`);
if (data.client_secret) console.log(`  client_secret: ${data.client_secret}   (shown once)`);
console.log(`  redirect_uris: ${data.redirect_uris.join('\n                 ')}`);
console.log('\nEnter the client id in Claude when adding the custom connector.');
