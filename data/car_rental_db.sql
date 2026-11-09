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
-- Name: car_rentals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.car_rentals (
    id integer NOT NULL,
    company text NOT NULL,
    car_type text NOT NULL,
    model text NOT NULL,
    pickup_city text NOT NULL,
    seats integer DEFAULT 5,
    transmission text DEFAULT 'automatic'::text,
    price_per_day numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text,
    available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: car_rentals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.car_rentals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: car_rentals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.car_rentals_id_seq OWNED BY public.car_rentals.id;


--
-- Name: car_rentals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_rentals ALTER COLUMN id SET DEFAULT nextval('public.car_rentals_id_seq'::regclass);


--
-- Data for Name: car_rentals; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.car_rentals (id, company, car_type, model, pickup_city, seats, transmission, price_per_day, currency, available, created_at) VALUES (1, 'Hertz', 'compact', 'Toyota Corolla', 'Seattle', 5, 'automatic', 54.00, 'USD', true, '2026-11-09 06:16:44.490907+00');
INSERT INTO public.car_rentals (id, company, car_type, model, pickup_city, seats, transmission, price_per_day, currency, available, created_at) VALUES (2, 'Enterprise', 'suv', 'Ford Explorer', 'Seattle', 7, 'automatic', 92.00, 'USD', true, '2026-11-09 06:16:44.491625+00');
INSERT INTO public.car_rentals (id, company, car_type, model, pickup_city, seats, transmission, price_per_day, currency, available, created_at) VALUES (3, 'Avis', 'economy', 'Nissan Versa', 'Seattle', 5, 'automatic', 39.00, 'USD', false, '2026-11-09 06:16:44.492084+00');
INSERT INTO public.car_rentals (id, company, car_type, model, pickup_city, seats, transmission, price_per_day, currency, available, created_at) VALUES (4, 'Toyota Rent a Car', 'compact', 'Toyota Yaris', 'Tokyo', 5, 'automatic', 61.00, 'USD', true, '2026-11-09 06:16:44.492464+00');
INSERT INTO public.car_rentals (id, company, car_type, model, pickup_city, seats, transmission, price_per_day, currency, available, created_at) VALUES (5, 'Nippon Rent-A-Car', 'van', 'Toyota Alphard', 'Tokyo', 7, 'automatic', 148.00, 'USD', true, '2026-11-09 06:16:44.493037+00');
INSERT INTO public.car_rentals (id, company, car_type, model, pickup_city, seats, transmission, price_per_day, currency, available, created_at) VALUES (6, 'Hotai Leasing', 'luxury', 'Lexus ES', 'Taipei', 5, 'automatic', 135.00, 'USD', true, '2026-11-09 06:16:44.493518+00');


--
-- Name: car_rentals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.car_rentals_id_seq', 6, true);


--
-- Name: car_rentals car_rentals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_rentals
    ADD CONSTRAINT car_rentals_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--


