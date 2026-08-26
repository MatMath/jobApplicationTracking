import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();

  // head:true fetches the count without the rows — this runs on every visit to
  // the root, and we only need to know whether the number is zero.
  const { count, error } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true });

  // On a fresh account there is nothing to show and only one useful next step,
  // so skip the empty dashboard and open the form. On error, fall through to
  // the list rather than trapping someone in the form.
  if (!error && count === 0) redirect('/applications/new');

  redirect('/applications');
}
