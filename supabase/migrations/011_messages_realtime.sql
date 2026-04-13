-- Enable Realtime on the messages table so chat threads
-- receive instant delivery of new messages via websocket.
alter publication supabase_realtime add table public.messages;
