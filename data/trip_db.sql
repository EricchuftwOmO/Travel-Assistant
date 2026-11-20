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
-- Name: itineraries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itineraries (
    id integer NOT NULL,
    trip_id integer NOT NULL,
    day_number integer NOT NULL,
    date date NOT NULL,
    CONSTRAINT itineraries_day_number_check CHECK ((day_number >= 1))
);


--
-- Name: itineraries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.itineraries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itineraries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.itineraries_id_seq OWNED BY public.itineraries.id;


--
-- Name: itinerary_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itinerary_items (
    id integer NOT NULL,
    itinerary_id integer NOT NULL,
    place_id integer NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT itinerary_items_position_check CHECK (("position" >= 1))
);


--
-- Name: itinerary_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.itinerary_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itinerary_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.itinerary_items_id_seq OWNED BY public.itinerary_items.id;


--
-- Name: places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.places (
    id integer NOT NULL,
    google_place_id text,
    name text NOT NULL,
    city text NOT NULL,
    category text NOT NULL
);


--
-- Name: places_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.places_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: places_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.places_id_seq OWNED BY public.places.id;


--
-- Name: trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trips (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    title text NOT NULL,
    destination text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trips_dates_check CHECK ((end_date >= start_date))
);


--
-- Name: trips_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trips_id_seq OWNED BY public.trips.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: itineraries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itineraries ALTER COLUMN id SET DEFAULT nextval('public.itineraries_id_seq'::regclass);


--
-- Name: itinerary_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_items ALTER COLUMN id SET DEFAULT nextval('public.itinerary_items_id_seq'::regclass);


--
-- Name: places id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places ALTER COLUMN id SET DEFAULT nextval('public.places_id_seq'::regclass);


--
-- Name: trips id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips ALTER COLUMN id SET DEFAULT nextval('public.trips_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: itineraries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (1, 1, 1, '2027-01-28');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (2, 1, 2, '2027-01-29');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (3, 1, 3, '2027-01-30');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (4, 1, 4, '2027-01-31');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (5, 1, 5, '2027-02-01');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (6, 1, 6, '2027-02-02');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (7, 1, 7, '2027-02-03');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (8, 2, 1, '2027-03-10');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (9, 2, 2, '2027-03-11');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (10, 2, 3, '2027-03-12');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (11, 2, 4, '2027-03-13');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (12, 2, 5, '2027-03-14');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (13, 2, 6, '2027-03-15');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (14, 3, 1, '2027-06-01');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (15, 3, 2, '2027-06-02');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (16, 3, 3, '2027-06-03');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (17, 3, 4, '2027-06-04');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (18, 3, 5, '2027-06-05');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (19, 3, 6, '2027-06-06');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (20, 3, 7, '2027-06-07');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (21, 3, 8, '2027-06-08');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (22, 3, 9, '2027-06-09');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (23, 3, 10, '2027-06-10');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (24, 4, 1, '2026-05-15');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (25, 4, 2, '2026-05-16');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (26, 4, 3, '2026-05-17');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (27, 5, 1, '2026-04-02');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (28, 5, 2, '2026-04-03');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (29, 5, 3, '2026-04-04');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (30, 5, 4, '2026-04-05');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (31, 5, 5, '2026-04-06');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (32, 5, 6, '2026-04-07');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (33, 5, 7, '2026-04-08');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (34, 5, 8, '2026-04-09');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (35, 6, 1, '2027-02-12');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (36, 6, 2, '2027-02-13');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (37, 6, 3, '2027-02-14');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (38, 6, 4, '2027-02-15');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (39, 6, 5, '2027-02-16');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (40, 6, 6, '2027-02-17');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (41, 6, 7, '2027-02-18');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (42, 7, 1, '2026-07-20');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (43, 7, 2, '2026-07-21');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (44, 7, 3, '2026-07-22');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (45, 7, 4, '2026-07-23');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (46, 7, 5, '2026-07-24');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (47, 7, 6, '2026-07-25');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (48, 7, 7, '2026-07-26');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (49, 7, 8, '2026-07-27');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (50, 8, 1, '2027-04-05');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (51, 8, 2, '2027-04-06');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (52, 8, 3, '2027-04-07');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (53, 8, 4, '2027-04-08');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (54, 8, 5, '2027-04-09');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (55, 9, 1, '2027-05-14');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (56, 9, 2, '2027-05-15');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (57, 9, 3, '2027-05-16');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (58, 9, 4, '2027-05-17');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (59, 9, 5, '2027-05-18');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (60, 9, 6, '2027-05-19');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (61, 9, 7, '2027-05-20');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (62, 9, 8, '2027-05-21');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (63, 9, 9, '2027-05-22');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (64, 9, 10, '2027-05-23');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (65, 9, 11, '2027-05-24');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (66, 9, 12, '2027-05-25');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (67, 9, 13, '2027-05-26');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (68, 9, 14, '2027-05-27');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (69, 9, 15, '2027-05-28');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (70, 10, 1, '2026-03-08');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (71, 10, 2, '2026-03-09');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (72, 10, 3, '2026-03-10');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (73, 10, 4, '2026-03-11');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (74, 10, 5, '2026-03-12');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (75, 10, 6, '2026-03-13');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (76, 10, 7, '2026-03-14');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (77, 10, 8, '2026-03-15');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (78, 10, 9, '2026-03-16');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (79, 11, 1, '2026-09-11');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (80, 11, 2, '2026-09-12');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (81, 11, 3, '2026-09-13');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (82, 12, 1, '2027-08-02');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (83, 12, 2, '2027-08-03');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (84, 12, 3, '2027-08-04');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (85, 12, 4, '2027-08-05');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (86, 12, 5, '2027-08-06');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (87, 12, 6, '2027-08-07');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (88, 12, 7, '2027-08-08');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (89, 12, 8, '2027-08-09');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (90, 12, 9, '2027-08-10');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (91, 12, 10, '2027-08-11');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (92, 12, 11, '2027-08-12');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (93, 13, 1, '2026-02-06');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (94, 13, 2, '2026-02-07');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (95, 13, 3, '2026-02-08');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (96, 13, 4, '2026-02-09');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (97, 13, 5, '2026-02-10');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (98, 13, 6, '2026-02-11');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (99, 14, 1, '2027-01-05');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (100, 14, 2, '2027-01-06');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (101, 14, 3, '2027-01-07');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (102, 14, 4, '2027-01-08');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (103, 14, 5, '2027-01-09');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (104, 14, 6, '2027-01-10');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (105, 14, 7, '2027-01-11');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (106, 14, 8, '2027-01-12');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (107, 14, 9, '2027-01-13');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (108, 14, 10, '2027-01-14');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (109, 14, 11, '2027-01-15');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (110, 15, 1, '2026-08-14');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (111, 15, 2, '2026-08-15');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (112, 15, 3, '2026-08-16');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (113, 15, 4, '2026-08-17');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (114, 15, 5, '2026-08-18');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (115, 15, 6, '2026-08-19');
INSERT INTO public.itineraries (id, trip_id, day_number, date) VALUES (116, 15, 7, '2026-08-20');


--
-- Data for Name: itinerary_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (1, 1, 1, 1, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (2, 1, 2, 2, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (3, 2, 3, 1, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (4, 2, 4, 2, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (5, 3, 5, 1, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (6, 2, 6, 3, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (7, 27, 7, 1, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (8, 27, 8, 2, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (9, 14, 10, 1, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (10, 15, 11, 1, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (11, 14, 12, 2, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (12, 15, 13, 2, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (13, 35, 19, 1, '2026-11-09 06:36:13.987284+00');
INSERT INTO public.itinerary_items (id, itinerary_id, place_id, "position", created_at) VALUES (14, 35, 20, 2, '2026-11-09 06:36:13.987284+00');


--
-- Data for Name: places; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (1, NULL, 'Senso-ji Temple', 'Tokyo', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (2, NULL, 'Tokyo Skytree', 'Tokyo', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (3, NULL, 'Meiji Jingu', 'Tokyo', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (4, NULL, 'Shibuya Crossing', 'Tokyo', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (5, NULL, 'Tsukiji Outer Market', 'Tokyo', 'food');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (6, NULL, 'teamLab Planets', 'Tokyo', 'museum');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (7, NULL, 'Osaka Castle', 'Osaka', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (8, NULL, 'Dotonbori', 'Osaka', 'food');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (9, NULL, 'Kuromon Market', 'Osaka', 'food');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (10, NULL, 'Taipei 101', 'Taipei', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (11, NULL, 'National Palace Museum', 'Taipei', 'museum');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (12, NULL, 'Shilin Night Market', 'Taipei', 'food');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (13, NULL, 'Jiufen Old Street', 'New Taipei', 'shopping');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (14, NULL, 'Golden Gate Bridge', 'San Francisco', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (15, NULL, 'Griffith Observatory', 'Los Angeles', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (16, NULL, 'Yosemite Valley', 'Yosemite', 'nature');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (17, NULL, 'Stanley Park', 'Vancouver', 'nature');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (18, NULL, 'Granville Island', 'Vancouver', 'shopping');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (19, NULL, 'Gyeongbokgung Palace', 'Seoul', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (20, NULL, 'Myeongdong', 'Seoul', 'shopping');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (21, NULL, 'Eiffel Tower', 'Paris', 'attraction');
INSERT INTO public.places (id, google_place_id, name, city, category) VALUES (22, NULL, 'Louvre Museum', 'Paris', 'museum');


--
-- Data for Name: trips; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (1, 1, 'Japan Trip', 'Tokyo', '2027-01-28', '2027-02-03', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (2, 1, 'California Road Trip', 'California', '2027-03-10', '2027-03-15', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (3, 1, 'Taiwan Trip', 'Taiwan', '2027-06-01', '2027-06-10', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (4, 1, 'Vancouver Weekend', 'Vancouver', '2026-05-15', '2026-05-17', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (5, 1, 'Japan Spring Getaway', 'Osaka', '2026-04-02', '2026-04-09', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (6, 2, 'Korea Food Tour', 'Seoul', '2027-02-12', '2027-02-18', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (7, 2, 'Hawaii Vacation', 'Honolulu', '2026-07-20', '2026-07-27', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (8, 2, 'New York City Break', 'New York', '2027-04-05', '2027-04-09', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (9, 3, 'Europe Rail Trip', 'Paris', '2027-05-14', '2027-05-28', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (10, 3, 'Mexico Family Visit', 'Mexico City', '2026-03-08', '2026-03-16', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (11, 3, 'Portland Coffee Trip', 'Portland', '2026-09-11', '2026-09-13', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (12, 4, 'Iceland Ring Road', 'Reykjavik', '2027-08-02', '2027-08-12', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (13, 4, 'Banff Ski Trip', 'Banff', '2026-02-06', '2026-02-11', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (14, 5, 'Thailand Island Hop', 'Phuket', '2027-01-05', '2027-01-15', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.trips (id, owner_id, title, destination, start_date, end_date, created_at) VALUES (15, 5, 'Yellowstone Camping', 'Wyoming', '2026-08-14', '2026-08-20', '2026-11-09 06:36:13.987284+00');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, name, email, password_hash, created_at) VALUES (1, 'Alice Chen', 'alice@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.users (id, name, email, password_hash, created_at) VALUES (2, 'Bob Tanaka', 'bob@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.users (id, name, email, password_hash, created_at) VALUES (3, 'Carol Lopez', 'carol@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.users (id, name, email, password_hash, created_at) VALUES (4, 'David Kim', 'david@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', '2026-11-09 06:36:13.987284+00');
INSERT INTO public.users (id, name, email, password_hash, created_at) VALUES (5, 'Emma Wilson', 'emma@example.com', '$2b$10$oeX2uQ5Jre4KLF6wl9hEFeIl9Bq21T93ujHQcqYACRmnHLJz7ZsMe', '2026-11-09 06:36:13.987284+00');


--
-- Name: itineraries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.itineraries_id_seq', 122, true);


--
-- Name: itinerary_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.itinerary_items_id_seq', 14, true);


--
-- Name: places_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.places_id_seq', 22, true);


--
-- Name: trips_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.trips_id_seq', 17, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- Name: itineraries itineraries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itineraries
    ADD CONSTRAINT itineraries_pkey PRIMARY KEY (id);


--
-- Name: itineraries itineraries_trip_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itineraries
    ADD CONSTRAINT itineraries_trip_day_key UNIQUE (trip_id, day_number);


--
-- Name: itinerary_items itinerary_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_items
    ADD CONSTRAINT itinerary_items_pkey PRIMARY KEY (id);


--
-- Name: itinerary_items itinerary_items_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_items
    ADD CONSTRAINT itinerary_items_position_key UNIQUE (itinerary_id, "position") DEFERRABLE INITIALLY DEFERRED;


--
-- Name: places places_google_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_google_place_id_key UNIQUE (google_place_id);


--
-- Name: places places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_pkey PRIMARY KEY (id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: trips_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trips_owner_id_idx ON public.trips USING btree (owner_id);


--
-- Name: itineraries itineraries_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itineraries
    ADD CONSTRAINT itineraries_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: itinerary_items itinerary_items_itinerary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_items
    ADD CONSTRAINT itinerary_items_itinerary_id_fkey FOREIGN KEY (itinerary_id) REFERENCES public.itineraries(id) ON DELETE CASCADE;


--
-- Name: itinerary_items itinerary_items_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_items
    ADD CONSTRAINT itinerary_items_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: trips trips_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


