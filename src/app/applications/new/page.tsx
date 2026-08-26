import Link from 'next/link';
import { ApplicationForm } from '../ApplicationForm';
import { createApplication } from '../actions';
import { todayISO } from '@/lib/date';

export default function NewApplicationPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/applications" className="text-sm underline opacity-60">
        ← Applications
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Add application</h1>

      <div className="mt-6">
        <ApplicationForm
          action={createApplication}
          today={todayISO()}
          submitLabel="Save application"
        />
      </div>
    </main>
  );
}
