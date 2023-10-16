--
-- PostgreSQL database dump
--

-- Dumped from database version 15.3 (Debian 15.3-1.pgdg120+1)
-- Dumped by pg_dump version 15.3 (Debian 15.3-0+deb12u1)

-- Started on 2023-10-16 17:05:39 UTC

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

--
-- TOC entry 217 (class 1255 OID 16482)
-- Name: add_alias(bigint, character varying); Type: FUNCTION; Schema: public; Owner: kraftwerk28
--

CREATE FUNCTION public.add_alias(user_id bigint, alias character varying) RETURNS void
    LANGUAGE sql
    AS $_$
	INSERT INTO aliases AS a (user_id, alias)
	VALUES ($1, $2)
	ON CONFLICT (user_id) DO UPDATE SET alias = $2
	WHERE a.user_id = $1;
$_$;


ALTER FUNCTION public.add_alias(user_id bigint, alias character varying) OWNER TO kraftwerk28;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 214 (class 1259 OID 16483)
-- Name: chat_members; Type: TABLE; Schema: public; Owner: kraftwerk28
--

CREATE TABLE public.chat_members (
    chat_id bigint NOT NULL,
    user_id bigint NOT NULL,
    wins integer DEFAULT 0 NOT NULL,
    leadings integer DEFAULT 0
);


ALTER TABLE public.chat_members OWNER TO kraftwerk28;

--
-- TOC entry 218 (class 1255 OID 16488)
-- Name: add_chat_member(bigint, bigint, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: kraftwerk28
--

CREATE FUNCTION public.add_chat_member(chat_id bigint, user_id bigint, username character varying, first_name character varying, last_name character varying) RETURNS SETOF public.chat_members
    LANGUAGE sql
    AS $_$
	INSERT INTO users (user_id, username, first_name, last_name)
	VALUES ($2, $3, $4, $5)
	ON CONFLICT (user_id) DO UPDATE
		SET username   = $3,
			first_name = $4,
			last_name  = $5;
	INSERT INTO chat_members (chat_id, user_id)
	VALUES ($1, $2)
	ON CONFLICT DO NOTHING
	RETURNING *;
$_$;


ALTER FUNCTION public.add_chat_member(chat_id bigint, user_id bigint, username character varying, first_name character varying, last_name character varying) OWNER TO kraftwerk28;

--
-- TOC entry 219 (class 1255 OID 16489)
-- Name: get_chat_rating(bigint); Type: FUNCTION; Schema: public; Owner: kraftwerk28
--

CREATE FUNCTION public.get_chat_rating(chat_id bigint) RETURNS TABLE(user_id bigint, username character varying, first_name character varying, last_name character varying, wins integer)
    LANGUAGE sql IMMUTABLE
    AS $_$
	SELECT u.*, cm.wins
	FROM users u
			 JOIN chat_members cm ON u.user_id = cm.user_id
	WHERE cm.chat_id = $1
	  AND cm.wins > 0
	ORDER BY cm.wins DESC
	LIMIT 8;
$_$;


ALTER FUNCTION public.get_chat_rating(chat_id bigint) OWNER TO kraftwerk28;

--
-- TOC entry 220 (class 1255 OID 16490)
-- Name: get_global_rating(); Type: FUNCTION; Schema: public; Owner: kraftwerk28
--

CREATE FUNCTION public.get_global_rating() RETURNS TABLE(user_id bigint, username character varying, first_name character varying, last_name character varying, wins integer)
    LANGUAGE sql IMMUTABLE
    AS $$
	WITH r AS (
		SELECT u.*, sum(cm.wins)::INT AS wins
		FROM users u
				 JOIN chat_members cm ON u.user_id = cm.user_id
		WHERE cm.wins > 0
		GROUP BY u.user_id
	)
	SELECT *
	FROM r
	ORDER BY wins DESC
	LIMIT 8;
$$;


ALTER FUNCTION public.get_global_rating() OWNER TO kraftwerk28;

--
-- TOC entry 221 (class 1255 OID 16491)
-- Name: increase_user_leadings(bigint, bigint); Type: FUNCTION; Schema: public; Owner: kraftwerk28
--

CREATE FUNCTION public.increase_user_leadings(chat_id bigint, user_id bigint) RETURNS integer
    LANGUAGE sql
    AS $_$
	UPDATE chat_members cm
	SET leadings = leadings + 1
	WHERE cm.chat_id = $1
	  AND cm.user_id = $2
	RETURNING cm.leadings;
$_$;


ALTER FUNCTION public.increase_user_leadings(chat_id bigint, user_id bigint) OWNER TO kraftwerk28;

--
-- TOC entry 222 (class 1255 OID 16492)
-- Name: increase_user_wins(bigint, bigint); Type: FUNCTION; Schema: public; Owner: kraftwerk28
--

CREATE FUNCTION public.increase_user_wins(chat_id bigint, user_id bigint) RETURNS integer
    LANGUAGE sql
    AS $_$
	UPDATE chat_members cm
	SET wins = wins + 1
	WHERE cm.chat_id = $1
	  AND cm.user_id = $2
	RETURNING cm.wins;
$_$;


ALTER FUNCTION public.increase_user_wins(chat_id bigint, user_id bigint) OWNER TO kraftwerk28;

--
-- TOC entry 215 (class 1259 OID 16493)
-- Name: aliases; Type: TABLE; Schema: public; Owner: kraftwerk28
--

CREATE TABLE public.aliases (
    user_id bigint NOT NULL,
    alias character varying(64)
);


ALTER TABLE public.aliases OWNER TO kraftwerk28;

--
-- TOC entry 3347 (class 0 OID 0)
-- Dependencies: 215
-- Name: TABLE aliases; Type: COMMENT; Schema: public; Owner: kraftwerk28
--

COMMENT ON TABLE public.aliases IS 'User aliases and so on';


--
-- TOC entry 216 (class 1259 OID 16496)
-- Name: users; Type: TABLE; Schema: public; Owner: kraftwerk28
--

CREATE TABLE public.users (
    user_id bigint NOT NULL,
    username character varying(32),
    first_name character varying,
    last_name character varying
);


ALTER TABLE public.users OWNER TO kraftwerk28;

--
-- TOC entry 3194 (class 2606 OID 16502)
-- Name: aliases aliases_pk; Type: CONSTRAINT; Schema: public; Owner: kraftwerk28
--

ALTER TABLE ONLY public.aliases
    ADD CONSTRAINT aliases_pk PRIMARY KEY (user_id);


--
-- TOC entry 3192 (class 2606 OID 16504)
-- Name: chat_members chat_members_pk; Type: CONSTRAINT; Schema: public; Owner: kraftwerk28
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_pk PRIMARY KEY (user_id, chat_id);


--
-- TOC entry 3197 (class 2606 OID 16506)
-- Name: users users_pk; Type: CONSTRAINT; Schema: public; Owner: kraftwerk28
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pk PRIMARY KEY (user_id);


--
-- TOC entry 3195 (class 1259 OID 16507)
-- Name: aliases_user_id_uindex; Type: INDEX; Schema: public; Owner: kraftwerk28
--

CREATE UNIQUE INDEX aliases_user_id_uindex ON public.aliases USING btree (user_id);


--
-- TOC entry 3198 (class 2606 OID 16508)
-- Name: chat_members chat_members_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: kraftwerk28
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_users_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- TOC entry 3346 (class 0 OID 0)
-- Dependencies: 214
-- Name: TABLE chat_members; Type: ACL; Schema: public; Owner: kraftwerk28
--

GRANT SELECT ON TABLE public.chat_members TO remote;


--
-- TOC entry 3348 (class 0 OID 0)
-- Dependencies: 215
-- Name: TABLE aliases; Type: ACL; Schema: public; Owner: kraftwerk28
--

GRANT SELECT ON TABLE public.aliases TO remote;


--
-- TOC entry 3349 (class 0 OID 0)
-- Dependencies: 216
-- Name: TABLE users; Type: ACL; Schema: public; Owner: kraftwerk28
--

GRANT SELECT ON TABLE public.users TO remote;


-- Completed on 2023-10-16 17:05:41 UTC

--
-- PostgreSQL database dump complete
--

