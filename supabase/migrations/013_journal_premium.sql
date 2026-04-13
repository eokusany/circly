-- Premium journal: mood value slider + prompt tracking

ALTER TABLE public.journal_entries
  ADD COLUMN mood_value integer,
  ADD COLUMN prompt_used text;

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_mood_value_range
  CHECK (mood_value IS NULL OR (mood_value >= 0 AND mood_value <= 100));
