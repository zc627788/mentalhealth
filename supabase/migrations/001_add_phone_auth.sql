-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_users (
  id uuid NOT NULL,
  role character varying DEFAULT 'admin'::character varying,
  permissions ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email text,
  CONSTRAINT admin_users_pkey PRIMARY KEY (id),
  CONSTRAINT admin_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.appointments (
  id integer NOT NULL DEFAULT nextval('appointments_id_seq'::regclass),
  user_id uuid NOT NULL,
  appointment_type character varying NOT NULL CHECK (appointment_type::text = ANY (ARRAY['human'::character varying::text, 'ai'::character varying::text])),
  appointment_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  status character varying DEFAULT 'confirmed'::character varying CHECK (status::text = ANY (ARRAY['confirmed'::character varying, 'cancelled'::character varying, 'completed'::character varying]::text[])),
  meeting_link text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  counselor_id uuid,
  counselor_name character varying DEFAULT 'AI咨询师'::character varying,
  availability_id uuid,
  topic character varying,
  description text,
  urgency character varying DEFAULT 'medium'::character varying CHECK (urgency::text = ANY (ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying]::text[])),
  user_email character varying,
  user_phone character varying,
  ai_model character varying DEFAULT 'doubao'::character varying CHECK (ai_model::text = ANY (ARRAY['doubao'::character varying::text, 'peppy'::character varying::text])),
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.available_slots (
  id integer NOT NULL DEFAULT nextval('available_slots_id_seq'::regclass),
  day_of_week integer NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  slot_type character varying NOT NULL CHECK (slot_type::text = ANY (ARRAY['human'::character varying, 'ai'::character varying]::text[])),
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  counselor_id uuid,
  CONSTRAINT available_slots_pkey PRIMARY KEY (id)
);
CREATE TABLE public.chat_messages (
  id integer NOT NULL DEFAULT nextval('chat_messages_pro_id_seq'::regclass),
  session_id integer NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL,
  sender character varying NOT NULL CHECK (sender::text = ANY (ARRAY['user'::character varying, 'ai'::character varying]::text[])),
  ai_model character varying DEFAULT 'doubao'::character varying CHECK (ai_model::text = ANY (ARRAY['doubao'::character varying, 'peppy'::character varying, 'general'::character varying]::text[])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chat_sessions (
  id integer NOT NULL DEFAULT nextval('chat_sessions_id_seq'::regclass),
  user_id uuid NOT NULL,
  session_name character varying DEFAULT '新对话'::character varying,
  ai_model character varying NOT NULL DEFAULT 'doubao'::character varying CHECK (ai_model::text = ANY (ARRAY['doubao'::character varying, 'peppy'::character varying, 'general'::character varying]::text[])),
  is_active boolean DEFAULT true,
  message_count integer DEFAULT 0,
  last_message_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  appointment_id integer,
  is_appointment boolean NOT NULL DEFAULT false,
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT chat_sessions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id)
);
CREATE TABLE public.counselor_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  counselor_id uuid NOT NULL,
  availability_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_booked boolean DEFAULT false,
  created_by uuid NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  counselor_type character varying DEFAULT 'human'::character varying CHECK (counselor_type::text = ANY (ARRAY['human'::character varying::text, 'ai'::character varying::text])),
  ai_model character varying CHECK (ai_model::text = ANY (ARRAY['doubao'::character varying::text, 'peppy'::character varying::text])),
  CONSTRAINT counselor_availability_pkey PRIMARY KEY (id),
  CONSTRAINT counselor_availability_counselor_id_fkey FOREIGN KEY (counselor_id) REFERENCES public.counselors(id)
);
CREATE TABLE public.counselors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  title character varying NOT NULL,
  speciality text NOT NULL,
  experience character varying NOT NULL,
  rating numeric DEFAULT 0.0,
  photo_url text,
  bio text,
  available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT counselors_pkey PRIMARY KEY (id)
);
CREATE TABLE public.email_logs (
  id integer NOT NULL DEFAULT nextval('email_logs_id_seq'::regclass),
  appointment_id integer NOT NULL,
  recipient_email character varying NOT NULL,
  subject character varying NOT NULL,
  content text NOT NULL,
  status character varying DEFAULT 'pending'::character varying,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.meeting_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  meeting_platform character varying NOT NULL,
  meeting_url text NOT NULL,
  meeting_id character varying,
  meeting_password character varying,
  additional_info text,
  created_by uuid NOT NULL,
  email_sent boolean DEFAULT false,
  email_sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT meeting_links_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name character varying NOT NULL,
  phone character varying,
  birth_date date,
  gender character varying,
  occupation character varying,
  emergency_contact character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.sms_verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone_number character varying NOT NULL,
  verification_code character varying NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  is_used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_verification_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key character varying NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT system_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_chat_preferences (
  id integer NOT NULL DEFAULT nextval('user_chat_preferences_id_seq'::regclass),
  user_id uuid NOT NULL UNIQUE,
  default_ai_model character varying DEFAULT 'doubao'::character varying CHECK (default_ai_model::text = ANY (ARRAY['doubao'::character varying, 'peppy'::character varying, 'general'::character varying]::text[])),
  auto_save_sessions boolean DEFAULT true,
  session_retention_days integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_chat_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT user_chat_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  phone character varying UNIQUE,
  name character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);