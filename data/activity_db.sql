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
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id integer NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    category text NOT NULL,
    description text,
    price numeric(10,2) DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    duration_minutes integer,
    rating numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activities_id_seq OWNED BY public.activities.id;


--
-- Name: activities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities ALTER COLUMN id SET DEFAULT nextval('public.activities_id_seq'::regclass);


--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.activities (id, name, city, category, description, price, currency, duration_minutes, rating, created_at) VALUES (1, 'Senso-ji Temple', 'Tokyo', 'sightseeing', 'Tokyo''s oldest temple, with a lively market street leading to it.', 0.00, 'USD', 90, 4.70, '2026-11-09 06:16:44.48353+00');
INSERT INTO public.activities (id, name, city, category, description, price, currency, duration_minutes, rating, created_at) VALUES (2, 'Tsukiji Outer Market food walk', 'Tokyo', 'food', 'Sample sushi, tamagoyaki and street snacks.', 65.00, 'USD', 150, 4.80, '2026-11-09 06:16:44.484427+00');
INSERT INTO public.activities (id, name, city, category, description, price, currency, duration_minutes, rating, created_at) VALUES (3, 'teamLab Planets', 'Tokyo', 'museum', 'Immersive digital art you walk through barefoot.', 32.00, 'USD', 120, 4.60, '2026-11-09 06:16:44.485224+00');
INSERT INTO public.activities (id, name, city, category, description, price, currency, duration_minutes, rating, created_at) VALUES (4, 'Pike Place Market', 'Seattle', 'food', 'Fish throwing, flowers, and the original Starbucks.', 0.00, 'USD', 120, 4.60, '2026-11-09 06:16:44.485856+00');
INSERT INTO public.activities (id, name, city, category, description, price, currency, duration_minutes, rating, created_at) VALUES (5, 'Mount Rainier day hike', 'Seattle', 'outdoors', 'Paradise area trails with views of the glaciers.', 30.00, 'USD', 360, 4.90, '2026-11-09 06:16:44.486676+00');
INSERT INTO public.activities (id, name, city, category, description, price, currency, duration_minutes, rating, created_at) VALUES (6, 'Museum of Pop Culture', 'Seattle', 'museum', 'Music, sci-fi and pop culture exhibits.', 36.00, 'USD', 150, 4.40, '2026-11-09 06:16:44.487134+00');
INSERT INTO public.activities (id, name, city, category, description, price, currency, duration_minutes, rating, created_at) VALUES (7, 'Shilin Night Market', 'Taipei', 'food', 'Taipei''s biggest night market.', 15.00, 'USD', 180, 4.50, '2026-11-09 06:16:44.487425+00');
INSERT INTO public.activities (id, name, city, category, description, price, currency, duration_minutes, rating, created_at) VALUES (8, 'Taipei 101 Observatory', 'Taipei', 'sightseeing', 'Indoor and outdoor decks 382 m up.', 22.00, 'USD', 90, 4.50, '2026-11-09 06:16:44.488247+00');


--
-- Name: activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activities_id_seq', 8, true);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--


