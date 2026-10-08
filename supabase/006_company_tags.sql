-- Sector tags on a company: up to five short labels ("Fintech", "AI",
-- "Insurance") so the application page can say what the employer does at a
-- glance. Safe to re-run.
--
-- On `companies` rather than `applications`: what a company does is a property
-- of the employer, and the table is already normalized so that two postings at
-- one company share a row. Tagged per application, the second posting would
-- need tagging again and the two could disagree.
--
-- NOT NULL with an empty default rather than nullable, so "not tagged yet" has
-- one representation (the empty array) and no reader has to handle null as
-- well. The five-tag ceiling is enforced in the application layer, where it
-- can tell whoever tripped it how many they sent; a CHECK here would turn the
-- same mistake into a bare constraint-violation message.

alter table public.companies
  add column if not exists tags text[] not null default '{}';
