CREATE TABLE IF NOT EXISTS public.medications (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  name CHARACTER VARYING NOT NULL,
  frequency CHARACTER VARYING NOT NULL,
  time CHARACTER VARYING NULL,
  notes CHARACTER VARYING NULL,
  is_active BOOLEAN NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT medications_pkey PRIMARY KEY (id),
  CONSTRAINT medications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_medications_id ON public.medications USING btree (id);
CREATE INDEX IF NOT EXISTS ix_medications_user_id ON public.medications USING btree (user_id);
