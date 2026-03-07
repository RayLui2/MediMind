CREATE TABLE IF NOT EXISTS public.recommendations (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT recommendations_pkey PRIMARY KEY (id),
  CONSTRAINT recommendations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_recommendations_id ON public.recommendations USING btree (id);
CREATE INDEX IF NOT EXISTS ix_recommendations_user_id ON public.recommendations USING btree (user_id);
