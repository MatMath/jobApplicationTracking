import Link from 'next/link';

const tabs = [
  { href: '/applications', label: 'Applications' },
  { href: '/dashboard', label: 'Dashboard' },
] as const;

/** Top bar shared by the two top-level pages. */
export function AppNav({ current }: { current: (typeof tabs)[number]['href'] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Main" className="flex gap-1">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === current ? 'page' : undefined}
            className={`rounded px-3 py-1.5 text-sm ${
              t.href === current
                ? 'bg-black/5 font-medium dark:bg-white/10'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-4">
        <Link
          href="/applications/new"
          className="rounded bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          Add application
        </Link>
        <Link href="/settings/connections" className="text-sm underline opacity-60">
          Connected apps
        </Link>
        <form action="/auth/signout" method="post">
          <button className="text-sm underline opacity-60">Sign out</button>
        </form>
      </div>
    </div>
  );
}
