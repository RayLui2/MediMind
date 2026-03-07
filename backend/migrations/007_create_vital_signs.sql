CREATE TABLE IF NOT EXISTS public.vital_signs (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  systolic_bp INTEGER NULL,
  diastolic_bp INTEGER NULL,
  heart_rate INTEGER NULL,
  weight INTEGER NULL,
  temperature DOUBLE PRECISION NULL,
  notes CHARACTER VARYING NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT vital_signs_pkey PRIMARY KEY (id),
  CONSTRAINT vital_signs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_vital_signs_id ON public.vital_signs USING btree (id);
CREATE INDEX IF NOT EXISTS ix_vital_signs_user_id ON public.vital_signs USING btree (user_id);
