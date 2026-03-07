CREATE TABLE IF NOT EXISTS public.medication_logs (
  id SERIAL NOT NULL,
  medication_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  taken_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  dose_number INTEGER NULL DEFAULT 1,
  CONSTRAINT medication_logs_pkey PRIMARY KEY (id),
  CONSTRAINT medication_logs_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES medications (id) ON DELETE CASCADE,
  CONSTRAINT medication_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_medication_logs_id ON public.medication_logs USING btree (id);
CREATE INDEX IF NOT EXISTS ix_medication_logs_medication_id ON public.medication_logs USING btree (medication_id);
CREATE INDEX IF NOT EXISTS ix_medication_logs_user_id ON public.medication_logs USING btree (user_id);
