'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Revokes one app's access. Supabase marks the consent revoked, drops that
 * client's sessions and invalidates its refresh tokens, so the next MCP call it
 * makes fails verification in lib/mcp/auth.ts rather than waiting out the
 * token's expiry.
 */
export async function revokeConnection(formData: FormData): Promise<void> {
  const clientId = String(formData.get('client_id') ?? '');
  if (!clientId) return;

  const supabase = await createClient();
  await supabase.auth.oauth.revokeGrant({ clientId });

  revalidatePath('/settings/connections');
}
