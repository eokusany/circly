-- Enable Realtime on the notifications table so clients receive instant
-- delivery of new notifications via websocket subscription.
alter publication supabase_realtime add table public.notifications;
