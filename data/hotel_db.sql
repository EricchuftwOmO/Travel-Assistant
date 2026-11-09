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
-- Name: hotels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hotels (
    id integer NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    country text NOT NULL,
    address text,
    stars integer NOT NULL,
    price_per_night numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text,
    rating numeric(10,2),
    available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hotels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hotels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hotels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hotels_id_seq OWNED BY public.hotels.id;


--
-- Name: hotels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotels ALTER COLUMN id SET DEFAULT nextval('public.hotels_id_seq'::regclass);


--
-- Data for Name: hotels; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hotels (id, name, city, country, address, stars, price_per_night, currency, rating, available, created_at) VALUES (1, 'Hotel Gracery Shinjuku', 'Tokyo', 'Japan', '1-19-1 Kabukicho, Shinjuku', 4, 165.00, 'USD', 8.60, true, '2026-11-09 06:16:44.483426+00');
INSERT INTO public.hotels (id, name, city, country, address, stars, price_per_night, currency, rating, available, created_at) VALUES (2, 'Tokyo Station Hotel', 'Tokyo', 'Japan', '1-9-1 Marunouchi, Chiyoda', 5, 410.00, 'USD', 9.20, true, '2026-11-09 06:16:44.484401+00');
INSERT INTO public.hotels (id, name, city, country, address, stars, price_per_night, currency, rating, available, created_at) VALUES (3, 'Sakura Capsule Inn', 'Tokyo', 'Japan', '2-3-5 Asakusa, Taito', 2, 48.00, 'USD', 7.40, true, '2026-11-09 06:16:44.485023+00');
INSERT INTO public.hotels (id, name, city, country, address, stars, price_per_night, currency, rating, available, created_at) VALUES (4, 'Staypineapple Seattle', 'Seattle', 'United States', '1100 5th Ave', 4, 189.00, 'USD', 8.80, true, '2026-11-09 06:16:44.48559+00');
INSERT INTO public.hotels (id, name, city, country, address, stars, price_per_night, currency, rating, available, created_at) VALUES (5, 'Hotel Max', 'Seattle', 'United States', '620 Stewart St', 3, 139.00, 'USD', 8.10, false, '2026-11-09 06:16:44.486119+00');
INSERT INTO public.hotels (id, name, city, country, address, stars, price_per_night, currency, rating, available, created_at) VALUES (6, 'Mandarin Oriental Taipei', 'Taipei', 'Taiwan', '158 Dunhua N Rd', 5, 380.00, 'USD', 9.40, true, '2026-11-09 06:16:44.486899+00');


--
-- Name: hotels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hotels_id_seq', 6, true);


--
-- Name: hotels hotels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hotels
    ADD CONSTRAINT hotels_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--


