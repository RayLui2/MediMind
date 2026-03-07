CREATE TABLE IF NOT EXISTS public.messages (
  id SERIAL NOT NULL,
  conversation_id INTEGER NOT NULL,
  role CHARACTER VARYING NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations (id)
);

CREATE INDEX IF NOT EXISTS ix_messages_id ON public.messages USING btree (id);
CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON public.messages USING btree (conversation_id);
