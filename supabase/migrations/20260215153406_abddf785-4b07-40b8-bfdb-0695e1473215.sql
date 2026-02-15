
-- Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receiver marks as read" ON public.messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create mentions table
CREATE TABLE public.mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id uuid NOT NULL,
  mentioner_id uuid NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mentions" ON public.mentions
  FOR SELECT USING (auth.uid() = mentioned_user_id OR auth.uid() = mentioner_id);

CREATE POLICY "Auth users create mentions" ON public.mentions
  FOR INSERT WITH CHECK (auth.uid() = mentioner_id);
