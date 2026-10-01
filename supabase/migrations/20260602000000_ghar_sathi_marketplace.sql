-- Ghar Sathi marketplace schema.
-- Configure the API server with a server-only Supabase Postgres connection
-- string in SUPABASE_DATABASE_URL before using these tables.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('client', 'helper')),
  full_name varchar(100) NOT NULL CHECK (char_length(btrim(full_name)) >= 2),
  language text NOT NULL CHECK (language IN ('en', 'ur', 'romanUrdu')),
  city varchar(80) NOT NULL CHECK (char_length(btrim(city)) >= 2),
  area varchar(100) NOT NULL CHECK (char_length(btrim(area)) >= 2),
  latitude double precision,
  longitude double precision,
  radius_km integer NOT NULL DEFAULT 10 CHECK (radius_km BETWEEN 1 AND 100),
  skills text[] NOT NULL DEFAULT '{}',
  work_types text[] NOT NULL DEFAULT '{}',
  service_hours_min smallint,
  service_hours_max smallint,
  rate_min_pkr integer CHECK (rate_min_pkr BETWEEN 0 AND 1000000),
  rate_max_pkr integer CHECK (rate_max_pkr BETWEEN 0 AND 1000000),
  nature_of_work varchar(300),
  about varchar(800),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_location_pair_check
    CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CONSTRAINT profiles_latitude_check
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT profiles_longitude_check
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT profiles_skills_limit_check
    CHECK (cardinality(skills) <= 12 AND array_position(skills, '') IS NULL),
  CONSTRAINT profiles_work_types_limit_check
    CHECK (cardinality(work_types) <= 12 AND array_position(work_types, '') IS NULL),
  CONSTRAINT profiles_service_hours_check
    CHECK (
      (service_hours_min IS NULL AND service_hours_max IS NULL)
      OR (
        service_hours_min BETWEEN 1 AND 24
        AND service_hours_max BETWEEN 1 AND 24
        AND service_hours_min <= service_hours_max
      )
    ),
  CONSTRAINT profiles_rates_order_check
    CHECK (rate_min_pkr IS NULL OR rate_max_pkr IS NULL OR rate_min_pkr <= rate_max_pkr)
);

CREATE TABLE IF NOT EXISTS public.swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  helper_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('left', 'right')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT swipes_distinct_profiles_check CHECK (client_profile_id <> helper_profile_id),
  CONSTRAINT swipes_client_helper_unique UNIQUE (client_profile_id, helper_profile_id),
  CONSTRAINT swipes_id_participants_unique UNIQUE (id, client_profile_id, helper_profile_id)
);

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swipe_id uuid NOT NULL UNIQUE,
  client_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  helper_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_pkr integer NOT NULL CHECK (amount_pkr BETWEEN 0 AND 1000000),
  counter_amount_pkr integer CHECK (counter_amount_pkr BETWEEN 0 AND 1000000),
  duration_hours numeric(4, 2) NOT NULL CHECK (duration_hours BETWEEN 0.5 AND 24),
  work_type varchar(60) NOT NULL CHECK (char_length(btrim(work_type)) BETWEEN 1 AND 60),
  work_description varchar(500) NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'countered')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_distinct_profiles_check CHECK (client_profile_id <> helper_profile_id),
  CONSTRAINT offers_description_length_check CHECK (char_length(work_description) <= 500),
  CONSTRAINT offers_swipe_participants_fk
    FOREIGN KEY (swipe_id, client_profile_id, helper_profile_id)
    REFERENCES public.swipes (id, client_profile_id, helper_profile_id)
    ON DELETE CASCADE,
  CONSTRAINT offers_id_participants_unique
    UNIQUE (id, client_profile_id, helper_profile_id)
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL UNIQUE,
  client_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  helper_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_distinct_profiles_check
    CHECK (client_profile_id <> helper_profile_id),
  CONSTRAINT conversations_offer_participants_fk
    FOREIGN KEY (offer_id, client_profile_id, helper_profile_id)
    REFERENCES public.offers (id, client_profile_id, helper_profile_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind varchar(80) NOT NULL,
  title varchar(200) NOT NULL,
  body varchar(1000) NOT NULL,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text varchar(2000),
  voice_data bytea,
  voice_mime_type varchar(100),
  duration_seconds numeric(5, 2),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_content_present_check
    CHECK (
      (text IS NOT NULL AND char_length(btrim(text)) > 0
        AND voice_data IS NULL AND voice_mime_type IS NULL AND duration_seconds IS NULL)
      OR
      (text IS NULL AND voice_data IS NOT NULL AND voice_mime_type IS NOT NULL
        AND duration_seconds IS NOT NULL)
    ),
  CONSTRAINT messages_text_length_check
    CHECK (text IS NULL OR char_length(text) <= 2000),
  CONSTRAINT messages_voice_size_check
    CHECK (voice_data IS NULL OR octet_length(voice_data) <= 5242880),
  CONSTRAINT messages_voice_duration_check
    CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 0.01 AND 60),
  CONSTRAINT messages_voice_type_check
    CHECK (
      voice_mime_type IS NULL OR voice_mime_type IN (
        'audio/aac', 'audio/3gpp', 'audio/m4a', 'audio/mp4', 'audio/mpeg',
        'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a'
      )
    )
);

CREATE INDEX IF NOT EXISTS profiles_role_city_idx
  ON public.profiles (role, city);
CREATE INDEX IF NOT EXISTS profiles_role_area_idx
  ON public.profiles (role, area);
CREATE INDEX IF NOT EXISTS profiles_role_coordinates_idx
  ON public.profiles (role, latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_work_types_gin_idx
  ON public.profiles USING gin (work_types);
CREATE INDEX IF NOT EXISTS profiles_skills_gin_idx
  ON public.profiles USING gin (skills);

CREATE INDEX IF NOT EXISTS swipes_helper_created_idx
  ON public.swipes (helper_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS offers_client_status_created_idx
  ON public.offers (client_profile_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS offers_helper_status_created_idx
  ON public.offers (helper_profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (recipient_profile_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS conversations_client_updated_idx
  ON public.conversations (client_profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_helper_updated_idx
  ON public.conversations (helper_profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_unread_conversation_idx
  ON public.messages (conversation_id, sender_profile_id)
  WHERE read_at IS NULL;

-- API access is through the private server-side Supabase Postgres connection.
-- Keep Supabase's public/anon roles from reading these tables directly.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;