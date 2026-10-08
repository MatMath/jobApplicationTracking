/**
 * A company's sector tags, as small chips. Renders nothing for an untagged
 * company rather than an empty row, so the list and the page lose no height for
 * records that have not been tagged yet.
 */
export function TagList({
  tags,
  className = '',
}: {
  tags: string[] | null | undefined;
  className?: string;
}) {
  if (!tags || tags.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-1.5 text-xs ${className}`} aria-label="Company tags">
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded-full border border-black/15 px-2 py-0.5 dark:border-white/20"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}
