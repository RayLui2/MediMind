CREATE TABLE IF NOT EXISTS public.conversations (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  title CHARACTER VARYING NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  instructions JSONB NULL DEFAULT '[]'::jsonb,
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS ix_conversations_user_id ON public.conversations USING btree (user_id);
CREATE INDEX IF NOT EXISTS ix_conversations_id ON public.conversations USING btree (id);
