--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: advice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.advice (
    id integer NOT NULL,
    user_id text NOT NULL,
    trip_id integer,
    topic text DEFAULT 'general'::text,
    prompt text NOT NULL,
    content text,
    model text,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: advice_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.advice_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: advice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.advice_id_seq OWNED BY public.advice.id;


--
-- Name: advice id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advice ALTER COLUMN id SET DEFAULT nextval('public.advice_id_seq'::regclass);


--
-- Data for Name: advice; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.advice (id, user_id, trip_id, topic, prompt, content, model, source, created_at) VALUES (1, 'u1', 1, 'packing', 'What should I pack for Tokyo in December?', 'Pack layers: days are cool and dry, nights near freezing. Bring a warm coat, comfortable walking shoes, and a Suica or Pasmo card for trains.', 'sample', 'user', '2026-11-09 06:16:44.472489+00');
INSERT INTO public.advice (id, user_id, trip_id, topic, prompt, content, model, source, created_at) VALUES (2, 'u1', 2, 'food', 'Where should I eat on a Seattle weekend?', 'Start with Pike Place Market for breakfast, try Seattle-style teriyaki for lunch, and book a seafood dinner on the waterfront.', 'sample', 'user', '2026-11-09 06:16:44.473509+00');


--
-- Name: advice_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.advice_id_seq', 2, true);


--
-- Name: advice advice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advice
    ADD CONSTRAINT advice_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--


