CREATE TABLE IF NOT EXISTS public.water_intakes (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  amount_oz DOUBLE PRECISION NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT water_intakes_pkey PRIMARY KEY (id),
  CONSTRAINT water_intakes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_water_intakes_user_id ON public.water_intakes USING btree (user_id);
