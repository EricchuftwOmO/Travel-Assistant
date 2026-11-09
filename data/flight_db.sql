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
-- Name: flights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flights (
    id integer NOT NULL,
    airline text NOT NULL,
    flight_number text NOT NULL,
    origin text NOT NULL,
    destination text NOT NULL,
    depart_at timestamp with time zone NOT NULL,
    arrive_at timestamp with time zone NOT NULL,
    price numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text,
    seats_available integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: flights_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flights_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flights_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flights_id_seq OWNED BY public.flights.id;


--
-- Name: flights id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights ALTER COLUMN id SET DEFAULT nextval('public.flights_id_seq'::regclass);


--
-- Data for Name: flights; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.flights (id, airline, flight_number, origin, destination, depart_at, arrive_at, price, currency, seats_available, created_at) VALUES (1, 'Alaska Airlines', 'AS 21', 'SEA', 'HND', '2026-12-01 10:15:00+00', '2026-12-02 14:05:00+00', 845.50, 'USD', 12, '2026-11-09 06:16:44.510628+00');
INSERT INTO public.flights (id, airline, flight_number, origin, destination, depart_at, arrive_at, price, currency, seats_available, created_at) VALUES (2, 'ANA', 'NH 177', 'SEA', 'HND', '2026-12-01 19:40:00+00', '2026-12-03 00:10:00+00', 912.00, 'USD', 5, '2026-11-09 06:16:44.511366+00');
INSERT INTO public.flights (id, airline, flight_number, origin, destination, depart_at, arrive_at, price, currency, seats_available, created_at) VALUES (3, 'Delta', 'DL 167', 'SEA', 'ICN', '2026-12-02 12:00:00+00', '2026-12-03 16:20:00+00', 780.25, 'USD', 20, '2026-11-09 06:16:44.512112+00');
INSERT INTO public.flights (id, airline, flight_number, origin, destination, depart_at, arrive_at, price, currency, seats_available, created_at) VALUES (4, 'EVA Air', 'BR 17', 'SEA', 'TPE', '2027-02-01 01:30:00+00', '2027-02-02 05:15:00+00', 698.00, 'USD', 8, '2026-11-09 06:16:44.512723+00');
INSERT INTO public.flights (id, airline, flight_number, origin, destination, depart_at, arrive_at, price, currency, seats_available, created_at) VALUES (5, 'Alaska Airlines', 'AS 1', 'LAX', 'SEA', '2027-01-10 15:00:00+00', '2027-01-10 17:45:00+00', 129.99, 'USD', 31, '2026-11-09 06:16:44.513132+00');
INSERT INTO public.flights (id, airline, flight_number, origin, destination, depart_at, arrive_at, price, currency, seats_available, created_at) VALUES (6, 'United', 'UA 2371', 'SFO', 'SEA', '2027-01-10 09:20:00+00', '2027-01-10 11:35:00+00', 119.00, 'USD', 17, '2026-11-09 06:16:44.513568+00');


--
-- Name: flights_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.flights_id_seq', 6, true);


--
-- Name: flights flights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--


