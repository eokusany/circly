-- Add messages permission to existing relationships.
-- Default true so existing relationships keep messaging enabled.
update public.relationships
set permissions = permissions || '{"messages": true}'::jsonb
where not (permissions ? 'messages');
