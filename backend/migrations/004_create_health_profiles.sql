CREATE TABLE IF NOT EXISTS public.health_profiles (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  current_weight INTEGER NULL,
  height INTEGER NULL,
  blood_type CHARACTER VARYING NULL,
  current_conditions CHARACTER VARYING[] NULL,
  allergies CHARACTER VARYING[] NULL,
  family_history CHARACTER VARYING[] NULL,
  activity_level CHARACTER VARYING NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT health_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT health_profiles_user_id_key UNIQUE (user_id),
  CONSTRAINT health_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_health_profiles_id ON public.health_profiles USING btree (id);
