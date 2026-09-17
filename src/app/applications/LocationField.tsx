'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * The office address, with Google's suggestions behind it.
 *
 * Suggestions come from /api/places/search rather than from Google's own
 * widget: the key stays on the server that way, and picking a suggestion only
 * records which place was picked — the coordinates are looked up again when the
 * form is saved, so nothing here can move a pin.
 *
 * It degrades to a plain text box, on purpose and in three separate ways: with
 * JavaScript off, with no API key configured, and when Google is unreachable.
 * Whatever is typed is saved either way; the pin is the part that waits.
 */

type Suggestion = { placeId: string; address: string; name: string | null };

/** Long enough that a burst of typing costs one lookup, short enough to feel live. */
const DEBOUNCE_MS = 300;

export function LocationField({
  className,
  defaultValue,
  defaultPlaceId,
  required,
}: {
  className: string;
  defaultValue: string;
  defaultPlaceId: string;
  /** Driven by the arrangement field: everything but a fully remote role. */
  required: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [placeId, setPlaceId] = useState(defaultPlaceId);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // What the field held when the current suggestions were fetched, so a value
  // set by picking one does not immediately trigger a fetch for itself.
  const settled = useRef(defaultValue);
  const listId = useId();

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3 || query === settled.current) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const body = (await response.json()) as { places?: Suggestion[] };
        setSuggestions(body.places ?? []);
        setActive(-1);
        setOpen((body.places?.length ?? 0) > 0);
      } catch {
        // Aborted, offline, or the lookup is down. The typed address still saves.
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  function choose(suggestion: Suggestion) {
    settled.current = suggestion.address;
    setValue(suggestion.address);
    setPlaceId(suggestion.placeId);
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && active >= 0) {
      // Only swallow Enter while an option is highlighted; otherwise it submits
      // the form, which is what Enter in a text field is supposed to do.
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        name="location"
        value={value}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Street, city — or just the city"
        className={className}
        onChange={(e) => {
          setValue(e.target.value);
          // Typing over a picked address means it is no longer that place.
          setPlaceId('');
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(suggestions.length > 0)}
        // Deferred: a click on an option fires after blur, and closing first
        // would remove the option before the click lands on it.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <input type="hidden" name="location_place_id" value={placeId} />

      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-black/20 bg-[var(--background)] shadow-lg dark:border-white/20"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === active ? 'bg-black/10 dark:bg-white/15' : ''
              }`}
              onMouseEnter={() => setActive(i)}
              // mousedown, not click: blur fires first otherwise.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
            >
              {s.name ? <span className="font-medium">{s.name} · </span> : null}
              <span className="opacity-70">{s.address}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
