CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL NOT NULL,
  email CHARACTER VARYING NOT NULL,
  password_hash CHARACTER VARYING NOT NULL,
  name CHARACTER VARYING NULL,
  age INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  setup_completed_at TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS ix_users_id ON public.users USING btree (id);
