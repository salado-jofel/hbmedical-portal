SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict tv4fnwGgb16AsyPDMe0KQFYNP7p3Z4eTf5UdhaM8eivgObpQUrXnuLJfeHhemtp

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") VALUES
	('dd526478-3b8e-4cae-b6ff-3fd0833e11fa', '32c43dab-6cab-432c-ade5-cddd8c2ea8e5', '136eb705-cda5-4712-b8fc-bf2d1af74b71', 's256', '5ZuePlgSQ-4aT1NuG3HBntyN2x2xV1WxBDaI3hl_Wj0', 'email', '', '', '2026-03-25 20:46:14.334055+00', '2026-03-25 20:46:14.334055+00', 'email/signup', NULL, NULL, NULL, NULL, NULL, false),
	('183603bb-49d3-4700-b70e-2332566a1e3e', 'ec72b510-9cd6-4062-94e0-5749fac85745', '5e07a4df-6e1c-4f66-a8b5-1f4f90ce657d', 's256', 'YzYtvnNfkwOsOsNoKZxk2d4Rf7A3W42yUGUoUT03Weg', 'email', '', '', '2026-03-25 20:55:46.74329+00', '2026-03-25 20:56:14.262467+00', 'email/signup', '2026-03-25 20:56:14.262384+00', NULL, NULL, NULL, NULL, false),
	('1ee03fc3-336c-4687-a0fb-a4d849af90fe', '1448340b-6033-41f5-9ca8-59d9ebe89a70', '97021c48-a92c-40c6-a676-5862d298e19f', 's256', 'dLq_JnoQBG30P9MSWZmHUa47ESx7mH-MjqQ-Opg_CtA', 'email', '', '', '2026-03-26 07:50:48.914883+00', '2026-03-26 07:51:04.146597+00', 'email/signup', '2026-03-26 07:51:04.146534+00', NULL, NULL, NULL, NULL, false),
	('4361df61-a764-42a5-ae84-ff5e7d16bd42', 'e63aa99e-ecd9-46b3-9b2d-79fc9bd900be', '1f58132a-dcbd-4f8a-9972-f06b495e5d0d', 's256', 'E1S7XShvMSxjYHZ4ZI8EpEgaznRsMKLTh3fVtSfZlos', 'email', '', '', '2026-03-26 07:59:20.272066+00', '2026-03-26 07:59:55.017857+00', 'email/signup', '2026-03-26 07:59:55.016386+00', NULL, NULL, NULL, NULL, false),
	('772112d1-87e0-4e14-b283-d1763892e085', '7a52575e-a27b-47d3-98c0-c4051aba0985', '5f0c0dc6-b91f-423b-9f63-aba3bedc614e', 's256', '7K-ffta2XLhzT7LXMGUZZ6GC9FTcvgsiN1WtfjX13nc', 'email', '', '', '2026-03-26 08:07:06.19477+00', '2026-03-26 08:08:08.321916+00', 'email/signup', '2026-03-26 08:08:08.321845+00', NULL, NULL, NULL, NULL, false),
	('cce023a7-e720-4cef-9d29-f31462714cc9', '67bf5328-889a-4138-a72e-0782a48d056a', '6b7f3f44-71a9-49f0-9142-c4767faddcce', 's256', 'dRZynWS9b8ZFfXp4uStW2EACdkqnja5sf2hgCPrETT0', 'email', '', '', '2026-03-26 10:52:08.81953+00', '2026-03-26 10:52:24.021233+00', 'email/signup', '2026-03-26 10:52:24.021178+00', NULL, NULL, NULL, NULL, false),
	('dd524499-3a13-405e-9114-8c560a099544', 'dd3fde6e-74e1-4e19-81ac-5c5433402279', '0911f4e5-8282-4faa-8fac-b5f806808272', 's256', 'Mv_yJZ-86N75F4ahX8Ng4wuyWctSPS86ABfBssWFrD4', 'email', '', '', '2026-03-28 11:11:32.67606+00', '2026-03-28 11:11:56.395164+00', 'email/signup', '2026-03-28 11:11:56.393678+00', NULL, NULL, NULL, NULL, false),
	('a836e077-4d0f-4616-aa6d-12b957ccf95d', '63c45c28-4e4b-4fd2-9d5c-d90c61f762cd', '7552cf90-9fff-4dba-bf96-7e0f4979d97d', 's256', '6ZnTZVcVy-s5sjFlE5XIOcIn2EaL3HYOWP5U6GAXh2o', 'email', '', '', '2026-03-28 14:08:22.21946+00', '2026-03-28 14:08:35.712712+00', 'email/signup', '2026-03-28 14:08:35.711113+00', NULL, NULL, NULL, NULL, false),
	('1dab0d9f-b431-41bc-ad22-f119aafbd0bc', '3ca3be4f-5269-4eab-804f-04a903854811', 'ef843591-32bc-4e9a-aaaa-7668174b4e79', 's256', 'CvXPGCYLjWIpDnTd_RRAGWvU62dx72w3apU-wqhr0Qk', 'email', '', '', '2026-03-28 16:56:36.575497+00', '2026-03-28 16:56:48.215709+00', 'email/signup', '2026-03-28 16:56:48.215657+00', NULL, NULL, NULL, NULL, false),
	('189c1131-dee9-4dbc-8658-fe118a8202e0', '3ca3be4f-5269-4eab-804f-04a903854811', '85c59ecf-558d-41fe-80e3-be5cc1917b77', 's256', '0WNQBfxDLyP4Cxuo7-qvCWt5d-bUrucUfsCtNlIQ3uc', 'recovery', '', '', '2026-03-29 03:56:48.254969+00', '2026-03-29 03:56:48.254969+00', 'recovery', NULL, NULL, NULL, NULL, NULL, false),
	('5b31f0c5-9bc2-4b49-81e4-7dbc6473d692', '3ca3be4f-5269-4eab-804f-04a903854811', '4f6a1db5-e814-48f6-b53f-8ed5b260086c', 's256', 'acPI60adyhlSHM19x4vuo9CFSj-4sAloIR8Zu9nwvJY', 'recovery', '', '', '2026-03-29 03:59:37.140048+00', '2026-03-29 03:59:37.140048+00', 'recovery', NULL, NULL, NULL, NULL, NULL, false),
	('4ce3b352-3822-4327-9fa5-6c0f8b147524', '3ca3be4f-5269-4eab-804f-04a903854811', 'a585cadb-7fcc-4eab-ab09-ae17d4c4935e', 's256', 'VsCeN0LzBFRoKap3HTh7EPWz6QS4hQprnoIVg23xSJU', 'recovery', '', '', '2026-03-29 04:01:15.589311+00', '2026-03-29 04:01:31.177309+00', 'recovery', '2026-03-29 04:01:31.177248+00', NULL, NULL, NULL, NULL, false),
	('c8157ff6-ec8d-4e14-9a62-10d66660af16', '59756b24-04ce-43ee-9a98-a28732af0955', '8f106484-0202-48f0-907e-6b3691dbb666', 's256', '1mi7qcZTCOIVl8i1T9auQAtQVLu4yvRTUL4Z3K_aGUI', 'email', '', '', '2026-03-31 13:19:53.010238+00', '2026-03-31 13:20:46.444155+00', 'email/signup', '2026-03-31 13:20:46.443096+00', NULL, NULL, NULL, NULL, false),
	('c27f9a02-51e1-435a-b54d-cfcceb1c8ec7', '3ca3be4f-5269-4eab-804f-04a903854811', '526171d5-dbe3-45ec-887c-69a924f448d4', 's256', 'b4Vi8D2rrj0R0bsAnSERGMjqxcR09vvJhUJ2kH0D0Kg', 'recovery', '', '', '2026-03-29 04:17:03.318556+00', '2026-03-29 04:17:03.318556+00', 'recovery', NULL, NULL, NULL, NULL, NULL, false),
	('b6a09dbe-a03f-48a0-9f4d-ec6d87ebefe6', '57496e58-0f92-4ad5-a761-5b273cf7f20b', 'baa7f180-8916-4194-a57a-df459899acc3', 's256', 'NfTpIWlm2WAGfDrJdFHJg14TRZdfEvzAfEo5F2Re2kc', 'email', '', '', '2026-03-29 09:13:16.757917+00', '2026-03-29 09:13:40.055331+00', 'email/signup', '2026-03-29 09:13:40.054841+00', NULL, NULL, NULL, NULL, false),
	('968abc35-f796-492d-95dd-4ef8a792038a', '57496e58-0f92-4ad5-a761-5b273cf7f20b', 'c23ecef9-94a8-4b01-89b3-b1134a79fe40', 's256', 'Y3MGHjHWvTfANQyTwhwev09Kh6Ka42QHqlgNEBMToQc', 'recovery', '', '', '2026-03-29 10:26:35.971259+00', '2026-03-29 10:26:52.533105+00', 'recovery', '2026-03-29 10:26:52.532602+00', NULL, NULL, NULL, NULL, false),
	('be2334e7-2127-4fad-a348-1787c7b4bb20', '7df87cad-865d-42fe-8209-95f09e9aeeec', 'efe25130-cfc4-4350-949f-9976296139c3', 's256', 'ESIu5x3v12mwr_Yhgm9o3nDZ0i5Ak9KNjuoJ56t_Z4s', 'email', '', '', '2026-04-01 21:56:31.214821+00', '2026-04-01 21:56:46.616879+00', 'email/signup', '2026-04-01 21:56:46.616833+00', NULL, NULL, NULL, NULL, false),
	('215ff073-24fe-4b9a-891f-4a16854093a1', '57496e58-0f92-4ad5-a761-5b273cf7f20b', '09a7dfc6-152e-40a4-b59e-61b7a4ff9091', 's256', 'xt19DuPRIBu1gqiVK9NIXlDd7au3GuPQsElzygPC5rA', 'recovery', '', '', '2026-03-29 10:34:20.759372+00', '2026-03-29 10:34:31.421359+00', 'recovery', '2026-03-29 10:34:31.420786+00', NULL, NULL, NULL, NULL, false),
	('ce784c1b-c683-40aa-96e7-e28580165700', '57496e58-0f92-4ad5-a761-5b273cf7f20b', '56d1b30d-cc66-427a-b38a-a68fe64fde16', 's256', 'vThu_PQXqJeVsqr2-SyyO5b-lp6-R1W43jYHoHYDZTo', 'recovery', '', '', '2026-03-29 10:36:11.440751+00', '2026-03-29 10:36:20.013556+00', 'recovery', '2026-03-29 10:36:20.013078+00', NULL, NULL, NULL, NULL, false),
	('9447c74c-2336-49cc-8552-f90fbcb6a73d', '57496e58-0f92-4ad5-a761-5b273cf7f20b', 'a1bbc99a-f930-48bb-8cc3-0a474ae41c87', 's256', 'KBbf8cSA1wtQmTB4M5ucD7UL1zfvKt3fZu9gvTE_jjM', 'recovery', '', '', '2026-03-29 10:37:01.76676+00', '2026-03-29 10:37:01.76676+00', 'recovery', NULL, NULL, NULL, NULL, NULL, false),
	('8638cabe-ab35-4569-b617-594ca03d00d5', 'dddc3574-4390-411e-b29d-d27d474ce5c0', '9dc37aa4-6e4b-4906-a38b-152373767b44', 's256', 'dbiyJcmuNofLXAQTcJVwX9FE3ifzuajOsUQHnKSspM0', 'email', '', '', '2026-04-01 22:15:27.809895+00', '2026-04-01 22:15:27.809895+00', 'email/signup', NULL, NULL, NULL, NULL, NULL, false),
	('fd104770-97bf-47ba-9040-0ded258ba250', '3ca3be4f-5269-4eab-804f-04a903854811', '8ee32398-a495-491b-96f8-b1d801ec5561', 's256', 'KkPrXAV52Ns8HVCivDocu5k6Z3tw8vatBgPuipUL1rs', 'recovery', '', '', '2026-03-29 11:53:43.721215+00', '2026-03-29 11:53:43.721215+00', 'recovery', NULL, NULL, NULL, NULL, NULL, false),
	('ca6d5f16-8e22-4adf-bb87-74c356360c6c', '3ca3be4f-5269-4eab-804f-04a903854811', 'b28c0e3e-50f2-45d8-9dd9-801cfa0ecccd', 's256', '2d4tGf4mZS1zVYqBHng8B9DzdaAMqj40XgkY1zVW98o', 'recovery', '', '', '2026-03-29 11:53:56.243568+00', '2026-03-29 11:53:56.243568+00', 'recovery', NULL, NULL, NULL, NULL, NULL, false),
	('81856c0f-0736-4451-a4d3-7c22a1b30738', '57496e58-0f92-4ad5-a761-5b273cf7f20b', '26e74a0c-298f-420c-8373-44d73814352a', 's256', 'Rk_dnzGsa1l5cD2ja--vmmWVIQpygdkBTxLQ9GLuIRI', 'recovery', '', '', '2026-03-29 11:54:03.576344+00', '2026-03-29 11:54:03.576344+00', 'recovery', NULL, NULL, NULL, NULL, NULL, false),
	('ee6d762a-3767-4de5-b81e-6cc91dfa2662', '3ca3be4f-5269-4eab-804f-04a903854811', 'd7643459-213a-48cf-8083-aa19258ff7a7', 's256', 'HeT86utGtmQhKhZRMp2PUVRQHkrEytQEKLsdQ-oYFBU', 'recovery', '', '', '2026-03-29 12:18:27.423131+00', '2026-03-29 12:18:27.423131+00', 'recovery', NULL, NULL, NULL, NULL, NULL, false),
	('1bb7520a-4cfa-4bb6-a713-719aa3959301', 'bf686c86-28e5-4847-ba85-db95784c3a80', '52beac6c-6e3d-4c49-a23f-dad8dea9fe6e', 's256', 'gOf5rPUM7QGxaAYFISqdoF5GDCsTqkiuA5qTxA8crk4', 'email', '', '', '2026-03-29 18:31:13.792709+00', '2026-03-29 18:31:13.792709+00', 'email/signup', NULL, NULL, NULL, NULL, NULL, false),
	('09906208-7dd0-4302-80e1-e9328a4e878c', '1ba83322-ff25-49ff-bc69-76fd719e54c5', 'bbd6fd07-8817-44b7-8d22-f5c63e5e7eb7', 's256', 'NafAGvQfU6LztPoKa7hXKFYDA-s67mpgqJl6SMBm7Ok', 'email', '', '', '2026-03-29 20:12:59.618159+00', '2026-03-29 20:13:16.65532+00', 'email/signup', '2026-03-29 20:13:16.655262+00', NULL, NULL, NULL, NULL, false),
	('538793c0-e998-4741-8acc-975a970a8c63', 'e1c586b8-2154-4bd6-9364-5db6703a3922', '3c7c0f5e-f005-41db-a8d7-b19389d8ab26', 's256', 'phoGIAjkFRYYJnkounF5MLp_4UklAPghp8lUuPdSZB8', 'email', '', '', '2026-03-31 13:16:43.702957+00', '2026-03-31 13:17:11.441078+00', 'email/signup', '2026-03-31 13:17:11.44102+00', NULL, NULL, NULL, NULL, false),
	('a839ec97-ec1f-4213-994c-cc4525305b5f', 'b9f2d227-54f7-4f48-94b5-8dd679c83502', 'a8b53a79-4654-4317-9a0f-062d4d4f3314', 's256', 'r4pzAImcbRtbGk5Yll4TO_yh5piz9aGRy_zqepFoRNg', 'email', '', '', '2026-04-01 22:27:45.241955+00', '2026-04-01 22:27:45.241955+00', 'email/signup', NULL, NULL, NULL, NULL, NULL, false),
	('04777c50-46f3-4d34-8220-8c275b782fbe', '5d05b912-597b-4a7e-9e0a-05d62ed574f9', '557dc57b-e41c-4a92-92b9-3332883c9401', 's256', 'c_048XIGUl0NxAJQODKu4ocl1Bi-R73QIFVSDiyRW5k', 'email', '', '', '2026-04-01 22:32:17.510275+00', '2026-04-01 22:32:17.510275+00', 'email/signup', NULL, NULL, NULL, NULL, NULL, false),
	('5464647b-b41d-4fb7-b8ad-bfa9eb70cf2f', 'd1eef635-6597-4123-96a8-dfc66ff8332f', 'b011bc13-71a2-4f8d-b0c3-ca4e9aafee9d', 's256', '2O6I9Ws5rH54KyBy60GImaMvbX1O7gsMyCpNmi9R02o', 'email', '', '', '2026-04-01 22:36:28.198516+00', '2026-04-01 22:36:40.456459+00', 'email/signup', '2026-04-01 22:36:40.45639+00', NULL, NULL, NULL, NULL, false),
	('39f24a70-981e-4209-b40e-b9301183bd73', 'd8bb0da8-9110-40ce-a5a6-03d3a8ac6a00', 'b3c05ee2-da50-41f2-8604-4abf43a36453', 's256', 'TmjeYtNzO3RR-LdA3NuWFDRPmUye7u9s6ODAulsiMHU', 'email', '', '', '2026-04-02 09:47:35.750707+00', '2026-04-02 09:47:57.025252+00', 'email/signup', '2026-04-02 09:47:57.025202+00', NULL, NULL, NULL, NULL, false),
	('0e9f9327-482a-4454-a8e7-579649f7b4a1', '7248f3f9-907b-4cb0-a450-67ae105d9435', 'db523adb-1913-492c-a22a-520e91120166', 's256', 'mjbSmKzcEOgvftpyOBkPKTPxUqW6orBrWKfsu75EotM', 'email', '', '', '2026-04-02 12:39:16.242133+00', '2026-04-02 12:39:30.714689+00', 'email/signup', '2026-04-02 12:39:30.714143+00', NULL, NULL, NULL, NULL, false),
	('20cbd6a8-7813-41cc-b584-505427dc3f85', 'd33a75fd-63b9-4e7a-8ccd-37ec0b6aedb6', '40d4264c-bc97-4a2e-9c58-f216481e75f1', 's256', 'n2RCVbIThPJhws_FtVf2WP4JkS1q3jeN4R4sY-BR5bk', 'email', '', '', '2026-04-02 18:08:45.898226+00', '2026-04-02 18:09:01.555196+00', 'email/signup', '2026-04-02 18:09:01.555142+00', NULL, NULL, NULL, NULL, false),
	('6665e36c-23d4-4e5b-aafb-8408c76d6154', '086b502d-3b8d-40d2-b5c9-1ecc81e81a0c', '3a11300a-6a39-45af-8446-6ec0a64e2ae8', 's256', 'UrBov5vDXOGSwVOblgWEkncEdcS6uOf9KSZw3Tu11PY', 'email', '', '', '2026-04-02 18:11:08.409808+00', '2026-04-02 18:11:26.708137+00', 'email/signup', '2026-04-02 18:11:26.705604+00', NULL, NULL, NULL, NULL, false),
	('9c74fdbf-abb6-4f11-b953-2962c7489247', '491d792e-3d88-481a-9196-91f6291990f6', '76da89a9-cded-426b-a0e2-9453912f2915', 's256', 'BSdypbznCPlEVH2ZvNfei6BaF2YL-QcYWbAhor87-aY', 'email', '', '', '2026-04-03 10:10:26.414179+00', '2026-04-03 10:10:39.305329+00', 'email/signup', '2026-04-03 10:10:39.305277+00', NULL, NULL, NULL, NULL, false),
	('71e22918-7bf7-46ac-abb9-369fa239f059', '633e9ce6-044a-4956-b872-ee50082f02dc', '486d3768-e89c-410c-bf55-420d188a3e76', 's256', 's3oFQ-vrIduiVOeD3ZLGA3Mz7KYdqXKScUOkpdhgHrc', 'email', '', '', '2026-04-03 10:58:59.437226+00', '2026-04-03 10:59:10.76039+00', 'email/signup', '2026-04-03 10:59:10.760339+00', NULL, NULL, NULL, NULL, false),
	('d2d0257e-763b-4037-876d-e349bb885b20', 'b573a3a4-5e55-4cd9-97ec-c1cd881eb9ca', '3f87cb4b-c6c1-4210-af6d-e43a60d2f20d', 's256', 'Pb0--BTTxFy8B9sMYqgrckyO1_E2r3PRVS5bdYlP8-M', 'email', '', '', '2026-04-03 11:09:46.324479+00', '2026-04-03 11:09:57.342281+00', 'email/signup', '2026-04-03 11:09:57.3413+00', NULL, NULL, NULL, NULL, false),
	('829007e4-71e3-4817-8f07-fdc1ea275f62', '1045dce3-d6ef-49e0-8d65-1c80550c08eb', '995adc9d-73de-4471-a32a-dbc5d21daac1', 's256', 'NMjThSddoaXqPOjl9oKPxyRpwt_74XoV-1vL457s87M', 'email', '', '', '2026-04-03 15:42:22.646527+00', '2026-04-03 15:42:56.161739+00', 'email/signup', '2026-04-03 15:42:56.161684+00', NULL, NULL, NULL, NULL, false),
	('301da669-691e-481e-b774-98c40351a164', '5336844c-b00d-4915-b71b-0ff1ccd2530c', 'a40564fa-8f4f-43b6-8992-725f50723374', 's256', 'n9jyOcMMwGpyTu5CuPAVso7qgBodOgA14WltX0REuQI', 'email', '', '', '2026-04-03 18:30:50.824795+00', '2026-04-03 18:31:19.81893+00', 'email/signup', '2026-04-03 18:31:19.816893+00', NULL, NULL, NULL, NULL, false),
	('2e9b54b0-1296-4e4c-86f1-85ca443cd2de', '11c19ffe-90ef-4457-8a26-f97fd7544653', 'b6442be7-16bc-4507-b942-9c7b02982e64', 's256', 'zfZTOwfvvulytPLzNLkETVc2X6F2Nj9vnKRzgiLmlEQ', 'email', '', '', '2026-04-03 18:56:03.978798+00', '2026-04-03 18:56:32.751676+00', 'email/signup', '2026-04-03 18:56:32.750755+00', NULL, NULL, NULL, NULL, false),
	('473a0cae-e9a8-4069-8e6f-9c276c413ea8', '8d1ef56a-7e05-4b3c-927a-4085a6f2e900', '0af77462-a5d1-4681-b940-fe954bebf266', 's256', 'o4dvZ6AkWtM7XkYVIgIIYnoCAEQFKeR4LV7a6XoZUdQ', 'email', '', '', '2026-04-03 19:03:16.42764+00', '2026-04-03 19:03:28.845514+00', 'email/signup', '2026-04-03 19:03:28.845443+00', NULL, NULL, NULL, NULL, false),
	('534a4f89-7a0f-4148-8940-b96ec40b4e68', '98c3c857-3598-4062-9ffb-d54149d19fbd', '95fd73da-7b2f-4c54-8d26-bc6474263e9a', 's256', 'J9COhK8NyuwA7izw-trTZRWE6hm7IKXqvTumc5Qocno', 'email', '', '', '2026-04-03 21:01:29.318207+00', '2026-04-03 21:02:08.755364+00', 'email/signup', '2026-04-03 21:02:08.755313+00', NULL, NULL, NULL, NULL, false),
	('b6bcd868-a8e1-462a-b298-4e5e2b3e2941', '724e60a7-83e5-4861-9938-23a7123f94d0', 'e83ce9c4-14e1-41d6-b8f0-64eef2689b12', 's256', 'ryvLspHmhvXN4owe-uvRwJ75RCvZKYJw1YngHtJTvqA', 'email', '', '', '2026-04-03 21:05:12.292847+00', '2026-04-03 21:05:24.329744+00', 'email/signup', '2026-04-03 21:05:24.328872+00', NULL, NULL, NULL, NULL, false),
	('433267d3-3ea8-442d-a3e6-ad598990ee93', 'e834fd10-f38a-4574-b676-94f0b2337a64', '97a3aca1-1ba8-4afc-bd09-991e115ecd73', 's256', 'ggotLzK3UP4GAwxXm58WwlS5oFL7-UaZFzq3blG0te8', 'email', '', '', '2026-04-04 12:06:13.051088+00', '2026-04-04 12:06:13.051088+00', 'email/signup', NULL, NULL, NULL, NULL, NULL, false),
	('01a50614-c4a6-4695-9444-b0d62c38efc2', '15a1c0af-8eee-4588-88f8-5bc69f7df471', 'cb84f58a-f762-45b5-b3de-e9b7dcf94ede', 's256', 'dYpM7T9dlUoSvfwa3qVk9_fk3khvUNFc5L1DMQR9pSY', 'email', '', '', '2026-04-04 12:39:23.269896+00', '2026-04-04 12:39:39.559137+00', 'email/signup', '2026-04-04 12:39:39.559073+00', NULL, NULL, NULL, NULL, false),
	('247d0d2f-f4c7-416f-9dbf-ee7c7c44bb53', '209c311d-f50c-4fdc-903f-0ced66b53f65', '155c9602-5b78-428d-8d24-ee75750250a5', 's256', '1vChvH59qwr5DlYgGlGGDkGUSkQmz-Lg4GC9-KtKMuA', 'email', '', '', '2026-04-04 12:44:15.865159+00', '2026-04-04 12:44:30.20198+00', 'email/signup', '2026-04-04 12:44:30.201919+00', NULL, NULL, NULL, NULL, false),
	('d99baa87-523d-43a9-9666-79631d3f8576', 'cfd462b7-7dcf-4e01-8fbe-0a07c0fb3a25', 'ac8fd509-c087-45de-be3d-49ae844aa385', 's256', 'mKmxnMzwyTCyDpj-_l8waXb5Zuft71x6O_CBBbNJHII', 'email', '', '', '2026-04-04 13:53:46.573295+00', '2026-04-04 13:54:11.881865+00', 'email/signup', '2026-04-04 13:54:11.881815+00', NULL, NULL, NULL, NULL, false),
	('a5e4f5af-a4b0-449f-beb7-12ea65d2f983', 'ae8c2de7-c52e-46fd-ba1a-4e88745c54e8', 'c8868c59-581b-438b-803a-2ca0c883a378', 's256', 'iwhdXT5_Rt7nCCdCMw7BZwzdrTrCs3m79s2Zv8X01zs', 'email', '', '', '2026-04-04 14:26:00.736202+00', '2026-04-04 14:26:21.869179+00', 'email/signup', '2026-04-04 14:26:21.869127+00', NULL, NULL, NULL, NULL, false),
	('acc65e93-d6f4-4179-bd73-564b9e5ef895', '777924a7-c069-414a-a677-b6e1db929b98', 'f27714a0-938b-4cf6-a780-fc9edea229f3', 's256', 'ATLWt3ruXh4TdP4bQEdzBzJXlwlpV8LgsbPEqi-U7Cw', 'email', '', '', '2026-04-04 16:18:25.229762+00', '2026-04-04 16:18:48.941032+00', 'email/signup', '2026-04-04 16:18:48.940981+00', NULL, NULL, NULL, NULL, false),
	('4c54aac2-b296-4e57-bf86-1f83b126142b', 'ef491d05-60bf-492e-94bb-ea08898ec5ba', '15a86e92-3717-4fc0-bf10-df4ab846f025', 's256', 'ZqACDxptbCin6h_K6wzlEA7M74FNhdWu0ltcd2pKN64', 'email', '', '', '2026-04-09 17:56:03.488736+00', '2026-04-09 17:56:21.383113+00', 'email/signup', '2026-04-09 17:56:21.381609+00', NULL, NULL, NULL, NULL, false),
	('c7e8bb20-d64a-44af-8604-728f8ec94460', 'b3c06700-2d55-44d7-8b2c-21c074a6e6db', '54615ab1-b7d3-4052-904a-7b26c28700b5', 's256', '10-SoAtrX-hp-h5o3-Tu4UsS-LSkKZ2asVNPYJiSuK8', 'email', '', '', '2026-04-10 11:28:17.897286+00', '2026-04-10 11:28:34.875831+00', 'email/signup', '2026-04-10 11:28:34.875782+00', NULL, NULL, NULL, NULL, false),
	('3a66d303-effb-42df-bc5c-c981dee3ac5b', '16819cf0-66d7-499d-9706-05074a79e2fd', '93ac68a9-b53b-45b2-a4a6-b2da8b91ce53', 's256', 'ph9WqdLwUuSlLL9z5HkDypnJUEYT9q2SkB2I17BCNGs', 'email', '', '', '2026-04-11 13:46:20.051976+00', '2026-04-11 13:46:36.782302+00', 'email/signup', '2026-04-11 13:46:36.782251+00', NULL, NULL, NULL, NULL, false),
	('aedc9ec6-247f-48e7-87a3-2921a4c78ca3', '76c8a4c8-c908-4783-a767-189d5120703f', 'b0bd4a8a-01d9-434c-9b1d-e6bd7af129b8', 's256', '9rWqqp3FV72BHNSh5iT9wBQiZQraVg0N0y9i3sDbLUY', 'email', '', '', '2026-04-11 15:01:03.952238+00', '2026-04-11 15:01:44.197862+00', 'email/signup', '2026-04-11 15:01:44.195531+00', NULL, NULL, NULL, NULL, false),
	('349c76cc-514c-4b49-b4c5-a56de44c95a5', '2a5cef02-b649-4f23-8491-65bff7f9987e', '0a560969-7f2b-4ecb-8c0d-b40c8b37f5b6', 's256', 'rLmrxmRprmmqtxx9EUwJ0tPUSDo1iI5yAN__5DFZi3I', 'email', '', '', '2026-04-16 14:15:21.632018+00', '2026-04-16 14:15:47.831055+00', 'email/signup', '2026-04-16 14:15:47.830978+00', NULL, NULL, NULL, NULL, false);


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', 'ef491d05-60bf-492e-94bb-ea08898ec5ba', 'authenticated', 'authenticated', 'saladojofel+provider@gmail.com', '$2a$10$P.cMTxW1BC4CyQid6qQPL.t07umA387hKR5tsietOXBWQe2XFUBZW', '2026-04-09 17:56:21.271833+00', NULL, '', '2026-04-09 17:56:03.513017+00', '', NULL, '', '', NULL, '2026-04-09 18:09:10.979522+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "ef491d05-60bf-492e-94bb-ea08898ec5ba", "role": "clinical_provider", "email": "saladojofel+provider@gmail.com", "phone": "+11111111111", "full_name": "Victor Gonzalez", "last_name": "Gonzalez", "first_name": "Victor", "email_verified": true, "phone_verified": false}', NULL, '2026-04-09 17:56:03.395567+00', '2026-04-09 18:09:11.019473+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, 'aaaaaaaa-0001-0001-0000-000000000001', 'authenticated', 'authenticated', 'seed.rep.alice@example.com', '$2a$06$OiF53OUsDDIt7iHizhYwteTDeh5vZJQj5X038qo20liEyM3FJoZN.', '2026-04-16 10:40:56.967205+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'df3a36fe-2686-4a14-9a37-e4ad8c71ff0d', 'authenticated', 'authenticated', 'saladojofel+subrep@gmail.com', '$2a$10$/1Or9rP2D7sl4VdZ/acrxO6Y5Av5QFkiW4R1jkFCRp7YW5CSfbG5q', '2026-04-09 17:42:20.514984+00', '2026-04-09 17:40:35.067902+00', '', NULL, '', NULL, '', '', NULL, '2026-04-09 18:15:22.383045+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Romero", "first_name": "Ricky", "invited_by": "fd542a2a-ef6e-4587-8c8c-2bd138c5e953", "email_verified": true}', NULL, '2026-04-09 17:40:35.076513+00', '2026-04-09 18:15:22.457235+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, 'aaaaaaaa-0001-0001-0000-000000000002', 'authenticated', 'authenticated', 'seed.rep.ben@example.com', '$2a$06$dg.ZJe.YDXJnwI4Vnxrm5OsgI/GQ5bd8zwN3y2rgFNbbW3A10WAm2', '2026-04-16 10:40:56.967205+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'def47068-35f4-45fa-94bf-361460cb9c12', 'authenticated', 'authenticated', 'provider@hbmedical.com', '$2a$06$yCshMfwBqa2Tux8.MSRw7.tmK7GOAI85ATECx/F7KES5aBmPzeCHG', '2026-04-08 13:48:23.341424+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-17 14:21:36.761612+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Chen", "first_name": "Dr. Lisa"}', NULL, '2026-04-08 13:48:23.341424+00', '2026-04-17 14:21:36.809132+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '42161e6d-e35e-4d0a-9080-93adf40c3be1', 'authenticated', 'authenticated', 'kelsey@meridiansurgicalsupplies.com', '$2a$10$UKleoVLDPekNmsVK4lED.ui5M4XA/Kx15hFqV77ACwINT4hvt2BdK', '2026-04-10 21:13:48.445082+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-10 21:14:38.833015+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "celentano", "first_name": "kelsey", "email_verified": true}', NULL, '2026-04-10 21:13:48.402042+00', '2026-04-16 21:13:29.664431+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '82560ade-94bb-4439-9a45-546fbe22cfcb', 'authenticated', 'authenticated', 'ateite2@gmail.com', '$2a$10$ugVHfg.lmKWwgOkeMqZCfOUWOLksgoOYJtvTakDYH2tTX9/DV29qK', '2026-04-10 21:18:19.650259+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-16 15:39:33.665299+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Teitelman", "first_name": "Adam", "email_verified": true}', NULL, '2026-04-10 21:18:19.607216+00', '2026-04-17 16:14:23.631987+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '3c0b6510-46af-4fe3-8530-bd850f5086b6', 'authenticated', 'authenticated', 'support@hbmedical.com', '$2a$06$DrYQpjLZ2DtxBFH3ZpedSOgV26DiVcO5YEGBYeRgSwOMzWxI3edna', '2026-04-08 13:48:23.341424+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-08 14:04:43.748609+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Wilson", "first_name": "Jamie"}', NULL, '2026-04-08 13:48:23.341424+00', '2026-04-08 14:04:43.754966+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'b3c06700-2d55-44d7-8b2c-21c074a6e6db', 'authenticated', 'authenticated', 'saladojofel+proveer1@gmail.com', '$2a$10$r3SoZyRaq5b7omlCx5IfeeqZx3u0UgSzGn8q0coKX0R2yj.8dqe1W', '2026-04-10 11:28:34.849813+00', NULL, '', '2026-04-10 11:28:17.946092+00', '', NULL, '', '', NULL, '2026-04-10 11:28:58.83346+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "b3c06700-2d55-44d7-8b2c-21c074a6e6db", "role": "clinical_provider", "email": "saladojofel+proveer1@gmail.com", "phone": "+11111111111", "full_name": "Lorem Ipsum", "last_name": "Ipsum", "first_name": "Lorem", "email_verified": true, "phone_verified": false}', NULL, '2026-04-10 11:28:17.820614+00', '2026-04-10 12:27:13.082885+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '75f28d31-36e5-4b15-9358-546dbe1446f6', 'authenticated', 'authenticated', 'staff@hbmedical.com', '$2a$06$1TK62qNemHL4uvQKlZ5C/uJJEupXIvHzgRx0U.VFeCTd2EZa46lmu', '2026-04-08 13:48:23.341424+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-08 14:04:45.492991+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Johnson", "first_name": "Mark"}', NULL, '2026-04-08 13:48:23.341424+00', '2026-04-08 14:04:45.500565+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '16819cf0-66d7-499d-9706-05074a79e2fd', 'authenticated', 'authenticated', 'saladojofel+provider2@gmail.com', '$2a$10$yjo10DFOHyDQHrmYDb6RgO.46X4kD0uzy1DPnbs4dQdqhryYI1M8G', '2026-04-11 13:46:36.762125+00', NULL, '', '2026-04-11 13:46:20.067123+00', '', NULL, '', '', NULL, '2026-04-11 13:46:50.098739+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "16819cf0-66d7-499d-9706-05074a79e2fd", "role": "clinical_provider", "email": "saladojofel+provider2@gmail.com", "phone": "+11111111111", "full_name": "John Doe", "last_name": "Doe", "first_name": "John", "email_verified": true, "phone_verified": false}', NULL, '2026-04-11 13:46:20.002875+00', '2026-04-11 13:46:50.116361+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '76c8a4c8-c908-4783-a767-189d5120703f', 'authenticated', 'authenticated', 'saladojofel+provider3@gmail.com', '$2a$10$043TV51QtysqP3jsdIk5IOwaccR5sI/lA7rbabGF6/c2uSZOY4pum', '2026-04-11 15:01:44.090583+00', NULL, '', '2026-04-11 15:01:03.975823+00', '', NULL, '', '', NULL, '2026-04-11 15:01:56.373871+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "76c8a4c8-c908-4783-a767-189d5120703f", "role": "clinical_provider", "email": "saladojofel+provider3@gmail.com", "phone": "+11111111111", "full_name": "Lorem Ipsum", "last_name": "Ipsum", "first_name": "Lorem", "email_verified": true, "phone_verified": false}', NULL, '2026-04-11 15:01:03.875855+00', '2026-04-11 16:00:32.676838+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, 'aaaaaaaa-0001-0001-0000-000000000003', 'authenticated', 'authenticated', 'seed.rep.chloe@example.com', '$2a$06$Z6mkGrK4Qd9iD9qwnCxEF.jPHJSHCizfwmvbX8MBnEy.NxYgqXnc6', '2026-04-16 10:40:56.967205+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, 'aaaaaaaa-0001-0002-0000-000000000001', 'authenticated', 'authenticated', 'seed.prov.evan@example.com', '$2a$06$grQcbPqOz.5g5pWKZsJaq.8A5AZcCSanHRtAOp2MY2JEC6U2X.l4i', '2026-04-16 10:40:56.967205+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, 'aaaaaaaa-0001-0002-0000-000000000002', 'authenticated', 'authenticated', 'seed.prov.mia@example.com', '$2a$06$dPglx/90R0qBYvm8AFZ.UOr1KskD3gOavnw3rSLfssyb3R39YxnDu', '2026-04-16 10:40:56.967205+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, 'aaaaaaaa-0001-0002-0000-000000000003', 'authenticated', 'authenticated', 'seed.prov.omar@example.com', '$2a$06$TG3dUma15RkfSfa7dzrr6OSZLAZlPyivVpnZxyFd6c967h3M4Uu92', '2026-04-16 10:40:56.967205+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, 'aaaaaaaa-0001-0003-0000-000000000001', 'authenticated', 'authenticated', 'seed.staff.nina@example.com', '$2a$06$.lao3cP8aH.Ro1QDemMR/eahbMe5NTaXkuWoJajD71gmrXpz7gZva', '2026-04-16 10:40:56.967205+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	(NULL, 'aaaaaaaa-0001-0003-0000-000000000002', 'authenticated', 'authenticated', 'seed.staff.greg@example.com', '$2a$06$ErmYFI63/Rfia/Jm8fARW.HO2Xm5AtVsxvQJ2kIMwXQ9A/.1IJ1ZO', '2026-04-16 10:40:56.967205+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '44d3a259-8fb5-4d85-bbdd-cc7327e9d72b', 'authenticated', 'authenticated', 'kicovab342@sskaid.com', '', NULL, '2026-04-16 14:39:55.126069+00', '69d2746cb1759b39dc9fa2aeca57cc35dca7bbed03044ff6ff75996b', '2026-04-16 14:39:55.126069+00', '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"last_name": "Setup", "first_name": "Pending", "invited_by": "fd542a2a-ef6e-4587-8c8c-2bd138c5e953"}', NULL, '2026-04-16 14:39:55.141521+00', '2026-04-16 14:39:55.22518+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'f5625231-5b21-4e77-bee1-74a375f8633d', 'authenticated', 'authenticated', 'pahoge3277@sskaid.com', '', NULL, '2026-04-16 14:11:17.878786+00', 'e7df9a8fc3cc485c3f6962f5e417492f1b83c6ffe8053b7e47d62c3d', '2026-04-16 14:11:17.878786+00', '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"last_name": "Setup", "first_name": "Pending", "invited_by": "fd542a2a-ef6e-4587-8c8c-2bd138c5e953"}', NULL, '2026-04-16 14:11:17.890172+00', '2026-04-16 14:11:18.011335+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '4b52b4df-8d89-474a-9b80-07d91765838b', 'authenticated', 'authenticated', 'pebos37506@tatefarm.com', '', NULL, '2026-04-16 13:51:51.264428+00', '365a630624fe6ea17ebd07ee6e3e8cf2e3ace31d105b42d2b1c02462', '2026-04-16 13:51:51.264428+00', '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"last_name": "Setup", "first_name": "Pending", "invited_by": "fd542a2a-ef6e-4587-8c8c-2bd138c5e953"}', NULL, '2026-04-16 13:51:51.277186+00', '2026-04-16 13:51:51.399615+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '2a5cef02-b649-4f23-8491-65bff7f9987e', 'authenticated', 'authenticated', 'saladojofel+pr1@gmail.com', '$2a$10$Beou1OcWGTWJSIXZXzG2nOtaO/DeaAhozEwf6.opGYL.obiMBC8ye', '2026-04-16 14:15:47.545966+00', NULL, '', '2026-04-16 14:15:21.656368+00', '', NULL, '', '', NULL, '2026-04-16 14:15:55.895165+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "2a5cef02-b649-4f23-8491-65bff7f9987e", "role": "clinical_provider", "email": "saladojofel+pr1@gmail.com", "phone": "+11111111111", "full_name": "Jofel Salado", "last_name": "Salado", "first_name": "Jofel", "email_verified": true, "phone_verified": false}', NULL, '2026-04-16 14:15:21.515168+00', '2026-04-16 14:15:55.949484+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'ca61f392-b904-41e5-a839-a73db904579f', 'authenticated', 'authenticated', 'midoh48821@tatefarm.com', '$2a$10$kpdgCdWtMwaxCVs5cWdwM.rN/mg5X1Sq5/MgmW3Uab/a70Fb2fCD.', '2026-04-16 14:09:08.281159+00', '2026-04-16 14:08:50.160773+00', '', NULL, '', NULL, '', '', NULL, '2026-04-16 14:09:32.247684+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Doe", "first_name": "John", "invited_by": "fd542a2a-ef6e-4587-8c8c-2bd138c5e953", "email_verified": true}', NULL, '2026-04-16 14:08:50.172532+00', '2026-04-16 14:09:55.052115+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '5ace75c8-cca1-461e-a977-9df48eb66291', 'authenticated', 'authenticated', 'midexa5051@sskaid.com', '', NULL, '2026-04-16 15:03:11.888385+00', '7f1cb3907acdd13355295dbc9470ef5529cafcb40b4b94e9e897c8b3', '2026-04-16 15:03:11.888385+00', '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"last_name": "Setup", "first_name": "Pending", "invited_by": "fd542a2a-ef6e-4587-8c8c-2bd138c5e953"}', NULL, '2026-04-16 15:03:11.891756+00', '2026-04-16 15:03:11.931795+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '9e1b4098-7d2e-4325-8d81-694d7a991098', 'authenticated', 'authenticated', 'kelseyr.kc@gmail.com', '$2a$10$eiH87QPNYNUlnqxdmHQxuuiyL.8YxLs.jSqj/B6UkuFU4dcU8Hicq', '2026-04-16 15:28:52.269078+00', NULL, '', NULL, 'c6b8e2188098cc396723347498cf1e252d637f5a620892c744470407', '2026-04-16 15:28:52.655532+00', '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"last_name": "ryan", "first_name": "kelsey", "email_verified": true}', NULL, '2026-04-16 15:28:52.221027+00', '2026-04-16 15:28:52.658709+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '4ff3f0ec-9a0a-4f11-b27b-f5ea10e7d910', 'authenticated', 'authenticated', 'jkn@jknmedical.com', '$2a$10$pPo0yYj6p0z.gw3cKDdPAeeIc0KEoF/bSRmMV205FdNv2L1UiAJ26', '2026-04-16 20:03:59.43645+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-16 20:04:59.207997+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Nash", "first_name": "Jeannie", "email_verified": true}', NULL, '2026-04-16 20:03:59.374072+00', '2026-04-17 12:51:55.528112+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '17004d1c-fcdc-4082-ae80-b2dfdade271b', 'authenticated', 'authenticated', 'trenton219@aol.com', '$2a$10$DwO4gHrebWjG/yv5Cz51xudKvvqKM0X9YqrOJBee3UZqa2y6Y3VqC', '2026-04-16 18:06:45.874534+00', '2026-04-16 15:42:18.309237+00', '', NULL, '', NULL, '', '', NULL, '2026-04-16 19:31:02.753453+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Williams", "first_name": "Trenton", "invited_by": "82560ade-94bb-4439-9a45-546fbe22cfcb", "email_verified": true}', NULL, '2026-04-16 15:42:18.321517+00', '2026-04-17 16:00:00.872583+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'fd542a2a-ef6e-4587-8c8c-2bd138c5e953', 'authenticated', 'authenticated', 'rep@hbmedical.com', '$2a$06$VziPda5fKrxVU/J8XwlDE.F.5YQyhFVqeVGYB0Lz87JVvOD9AqyIm', '2026-04-08 13:48:23.341424+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-17 13:07:18.096117+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Carter", "first_name": "Ryan"}', NULL, '2026-04-08 13:48:23.341424+00', '2026-04-17 13:07:18.167913+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'bafaa688-4862-427f-a3f6-b9873ab603f2', 'authenticated', 'authenticated', 'admin@hbmedical.com', '$2a$06$KARzJ8oL3Uf6U9eTi64hWeJGCbCGoNnW/Vj2MW49EQ6uU26p9oBzS', '2026-04-08 13:48:23.341424+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-16 17:17:42.156762+00', '{"provider": "email", "providers": ["email"]}', '{"last_name": "Morgan", "first_name": "Alex"}', NULL, '2026-04-08 13:48:23.341424+00', '2026-04-17 12:54:03.101281+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('admin@hbmedical.com', 'bafaa688-4862-427f-a3f6-b9873ab603f2', '{"sub": "bafaa688-4862-427f-a3f6-b9873ab603f2", "email": "admin@hbmedical.com"}', 'email', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', '4d424d0f-9347-4839-8af3-7cfae1487311'),
	('aaaaaaaa-0001-0001-0000-000000000001', 'aaaaaaaa-0001-0001-0000-000000000001', '{"sub": "aaaaaaaa-0001-0001-0000-000000000001", "email": "seed.rep.alice@example.com", "email_verified": true}', 'email', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', 'f6288602-0ea1-414b-adb6-bffeb4c4ab2f'),
	('aaaaaaaa-0001-0001-0000-000000000002', 'aaaaaaaa-0001-0001-0000-000000000002', '{"sub": "aaaaaaaa-0001-0001-0000-000000000002", "email": "seed.rep.ben@example.com", "email_verified": true}', 'email', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', 'f311ef36-4a59-42cd-b5f6-3d0d9c3b53c7'),
	('aaaaaaaa-0001-0001-0000-000000000003', 'aaaaaaaa-0001-0001-0000-000000000003', '{"sub": "aaaaaaaa-0001-0001-0000-000000000003", "email": "seed.rep.chloe@example.com", "email_verified": true}', 'email', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', '350056f4-df35-4bab-b507-e1e0a28b575e'),
	('aaaaaaaa-0001-0002-0000-000000000001', 'aaaaaaaa-0001-0002-0000-000000000001', '{"sub": "aaaaaaaa-0001-0002-0000-000000000001", "email": "seed.prov.evan@example.com", "email_verified": true}', 'email', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', '70cc73eb-4818-48d8-aa0e-c4b964aed93c'),
	('aaaaaaaa-0001-0002-0000-000000000002', 'aaaaaaaa-0001-0002-0000-000000000002', '{"sub": "aaaaaaaa-0001-0002-0000-000000000002", "email": "seed.prov.mia@example.com", "email_verified": true}', 'email', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', '968b4f85-f15e-42b4-a4fd-b622963e30ae'),
	('aaaaaaaa-0001-0002-0000-000000000003', 'aaaaaaaa-0001-0002-0000-000000000003', '{"sub": "aaaaaaaa-0001-0002-0000-000000000003", "email": "seed.prov.omar@example.com", "email_verified": true}', 'email', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', '2744e576-1b6b-4e2b-9bef-f66687677eca'),
	('aaaaaaaa-0001-0003-0000-000000000001', 'aaaaaaaa-0001-0003-0000-000000000001', '{"sub": "aaaaaaaa-0001-0003-0000-000000000001", "email": "seed.staff.nina@example.com", "email_verified": true}', 'email', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', '75c6483f-63d2-4377-9828-ace346350436'),
	('aaaaaaaa-0001-0003-0000-000000000002', 'aaaaaaaa-0001-0003-0000-000000000002', '{"sub": "aaaaaaaa-0001-0003-0000-000000000002", "email": "seed.staff.greg@example.com", "email_verified": true}', 'email', NULL, '2026-04-16 10:40:56.967205+00', '2026-04-16 10:40:56.967205+00', 'dcd78b41-7f97-48ae-9d28-ec802f586f8a'),
	('4b52b4df-8d89-474a-9b80-07d91765838b', '4b52b4df-8d89-474a-9b80-07d91765838b', '{"sub": "4b52b4df-8d89-474a-9b80-07d91765838b", "email": "pebos37506@tatefarm.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-16 13:51:51.380942+00', '2026-04-16 13:51:51.381443+00', '2026-04-16 13:51:51.381443+00', '6153b7c7-238f-42c2-9db7-6066c77fa34a'),
	('support@hbmedical.com', '3c0b6510-46af-4fe3-8530-bd850f5086b6', '{"sub": "3c0b6510-46af-4fe3-8530-bd850f5086b6", "email": "support@hbmedical.com"}', 'email', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', '82da3bb2-c171-454a-a280-c71985d2cea2'),
	('rep@hbmedical.com', 'fd542a2a-ef6e-4587-8c8c-2bd138c5e953', '{"sub": "fd542a2a-ef6e-4587-8c8c-2bd138c5e953", "email": "rep@hbmedical.com"}', 'email', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', '64c6e8dd-de52-409c-8ea0-fbf0c981607e'),
	('provider@hbmedical.com', 'def47068-35f4-45fa-94bf-361460cb9c12', '{"sub": "def47068-35f4-45fa-94bf-361460cb9c12", "email": "provider@hbmedical.com"}', 'email', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', 'ccca55bf-10ab-4301-9558-acd5aa0169a6'),
	('staff@hbmedical.com', '75f28d31-36e5-4b15-9358-546dbe1446f6', '{"sub": "75f28d31-36e5-4b15-9358-546dbe1446f6", "email": "staff@hbmedical.com"}', 'email', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', '2026-04-08 13:48:23.341424+00', '25059cab-25bd-40c8-b06b-4f6f8f45678b'),
	('ef491d05-60bf-492e-94bb-ea08898ec5ba', 'ef491d05-60bf-492e-94bb-ea08898ec5ba', '{"sub": "ef491d05-60bf-492e-94bb-ea08898ec5ba", "role": "clinical_provider", "email": "saladojofel+provider@gmail.com", "phone": "+11111111111", "full_name": "Victor Gonzalez", "last_name": "Gonzalez", "first_name": "Victor", "email_verified": true, "phone_verified": false}', 'email', '2026-04-09 17:56:03.454545+00', '2026-04-09 17:56:03.456873+00', '2026-04-09 17:56:03.456873+00', 'b6467f73-e528-4556-84aa-0bcedb42b8f6'),
	('42161e6d-e35e-4d0a-9080-93adf40c3be1', '42161e6d-e35e-4d0a-9080-93adf40c3be1', '{"sub": "42161e6d-e35e-4d0a-9080-93adf40c3be1", "email": "kelsey@meridiansurgicalsupplies.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-10 21:13:48.425336+00', '2026-04-10 21:13:48.425642+00', '2026-04-10 21:13:48.425642+00', '6b9646f9-8f5b-476f-b0bd-e0639a78d324'),
	('16819cf0-66d7-499d-9706-05074a79e2fd', '16819cf0-66d7-499d-9706-05074a79e2fd', '{"sub": "16819cf0-66d7-499d-9706-05074a79e2fd", "role": "clinical_provider", "email": "saladojofel+provider2@gmail.com", "phone": "+11111111111", "full_name": "John Doe", "last_name": "Doe", "first_name": "John", "email_verified": true, "phone_verified": false}', 'email', '2026-04-11 13:46:20.034497+00', '2026-04-11 13:46:20.034543+00', '2026-04-11 13:46:20.034543+00', 'c1895cf0-6c27-4975-bf36-e7cc8175b113'),
	('2a5cef02-b649-4f23-8491-65bff7f9987e', '2a5cef02-b649-4f23-8491-65bff7f9987e', '{"sub": "2a5cef02-b649-4f23-8491-65bff7f9987e", "role": "clinical_provider", "email": "saladojofel+pr1@gmail.com", "phone": "+11111111111", "full_name": "Jofel Salado", "last_name": "Salado", "first_name": "Jofel", "email_verified": true, "phone_verified": false}', 'email', '2026-04-16 14:15:21.600215+00', '2026-04-16 14:15:21.601437+00', '2026-04-16 14:15:21.601437+00', '1712b5dc-ba01-484c-8af8-c715e54b50dd'),
	('5ace75c8-cca1-461e-a977-9df48eb66291', '5ace75c8-cca1-461e-a977-9df48eb66291', '{"sub": "5ace75c8-cca1-461e-a977-9df48eb66291", "email": "midexa5051@sskaid.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-16 15:03:11.925635+00', '2026-04-16 15:03:11.925681+00', '2026-04-16 15:03:11.925681+00', 'a23af335-cacb-48c3-89b0-8a14674c8f0b'),
	('17004d1c-fcdc-4082-ae80-b2dfdade271b', '17004d1c-fcdc-4082-ae80-b2dfdade271b', '{"sub": "17004d1c-fcdc-4082-ae80-b2dfdade271b", "email": "trenton219@aol.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-16 15:42:18.385591+00', '2026-04-16 15:42:18.385643+00', '2026-04-16 15:42:18.385643+00', '368e62c6-1f96-4645-90b0-61fd93ee6fa2'),
	('76c8a4c8-c908-4783-a767-189d5120703f', '76c8a4c8-c908-4783-a767-189d5120703f', '{"sub": "76c8a4c8-c908-4783-a767-189d5120703f", "role": "clinical_provider", "email": "saladojofel+provider3@gmail.com", "phone": "+11111111111", "full_name": "Lorem Ipsum", "last_name": "Ipsum", "first_name": "Lorem", "email_verified": true, "phone_verified": false}', 'email', '2026-04-11 15:01:03.927663+00', '2026-04-11 15:01:03.92771+00', '2026-04-11 15:01:03.92771+00', 'ed417427-28bf-4b4f-ba32-d754fb417e4d'),
	('ca61f392-b904-41e5-a839-a73db904579f', 'ca61f392-b904-41e5-a839-a73db904579f', '{"sub": "ca61f392-b904-41e5-a839-a73db904579f", "email": "midoh48821@tatefarm.com", "email_verified": true, "phone_verified": false}', 'email', '2026-04-16 14:08:50.275292+00', '2026-04-16 14:08:50.27667+00', '2026-04-16 14:08:50.27667+00', '8268d67e-124e-4c84-a5a3-64c971942acb'),
	('f5625231-5b21-4e77-bee1-74a375f8633d', 'f5625231-5b21-4e77-bee1-74a375f8633d', '{"sub": "f5625231-5b21-4e77-bee1-74a375f8633d", "email": "pahoge3277@sskaid.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-16 14:11:17.964466+00', '2026-04-16 14:11:17.967468+00', '2026-04-16 14:11:17.967468+00', '377037b4-6940-4cb2-afca-4af36455430f'),
	('44d3a259-8fb5-4d85-bbdd-cc7327e9d72b', '44d3a259-8fb5-4d85-bbdd-cc7327e9d72b', '{"sub": "44d3a259-8fb5-4d85-bbdd-cc7327e9d72b", "email": "kicovab342@sskaid.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-16 14:39:55.208488+00', '2026-04-16 14:39:55.209113+00', '2026-04-16 14:39:55.209113+00', 'fced1415-21b6-4fa6-a88f-27b8d3e6c9ef'),
	('9e1b4098-7d2e-4325-8d81-694d7a991098', '9e1b4098-7d2e-4325-8d81-694d7a991098', '{"sub": "9e1b4098-7d2e-4325-8d81-694d7a991098", "email": "kelseyr.kc@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-16 15:28:52.246129+00', '2026-04-16 15:28:52.246183+00', '2026-04-16 15:28:52.246183+00', '73d69647-0ffa-4c2a-adfe-fb881104986b'),
	('4ff3f0ec-9a0a-4f11-b27b-f5ea10e7d910', '4ff3f0ec-9a0a-4f11-b27b-f5ea10e7d910', '{"sub": "4ff3f0ec-9a0a-4f11-b27b-f5ea10e7d910", "email": "jkn@jknmedical.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-16 20:03:59.402073+00', '2026-04-16 20:03:59.402131+00', '2026-04-16 20:03:59.402131+00', '73d256da-45cd-4fe7-9e56-d10f7cc071eb'),
	('df3a36fe-2686-4a14-9a37-e4ad8c71ff0d', 'df3a36fe-2686-4a14-9a37-e4ad8c71ff0d', '{"sub": "df3a36fe-2686-4a14-9a37-e4ad8c71ff0d", "email": "saladojofel+subrep@gmail.com", "email_verified": true, "phone_verified": false}', 'email', '2026-04-09 17:40:35.146353+00', '2026-04-09 17:40:35.147787+00', '2026-04-09 17:40:35.147787+00', 'd9e309f2-962b-42e6-b2a5-db949e004b76'),
	('b3c06700-2d55-44d7-8b2c-21c074a6e6db', 'b3c06700-2d55-44d7-8b2c-21c074a6e6db', '{"sub": "b3c06700-2d55-44d7-8b2c-21c074a6e6db", "role": "clinical_provider", "email": "saladojofel+proveer1@gmail.com", "phone": "+11111111111", "full_name": "Lorem Ipsum", "last_name": "Ipsum", "first_name": "Lorem", "email_verified": true, "phone_verified": false}', 'email', '2026-04-10 11:28:17.873498+00', '2026-04-10 11:28:17.873789+00', '2026-04-10 11:28:17.873789+00', '2a6e13e2-9350-4499-b5db-ed9babf847f5'),
	('82560ade-94bb-4439-9a45-546fbe22cfcb', '82560ade-94bb-4439-9a45-546fbe22cfcb', '{"sub": "82560ade-94bb-4439-9a45-546fbe22cfcb", "email": "ateite2@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-04-10 21:18:19.624966+00', '2026-04-10 21:18:19.625756+00', '2026-04-10 21:18:19.625756+00', '18cafb97-db8b-4ce2-9386-a79df83354d5');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."instances" ("id", "uuid", "raw_base_config", "created_at", "updated_at") VALUES
	('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', '{}', '2026-04-08 13:59:31.594173+00', '2026-04-08 13:59:31.594173+00');


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('fb99ce5c-3a7f-4e97-a574-9aae16c05b90', '17004d1c-fcdc-4082-ae80-b2dfdade271b', '2026-04-16 19:31:02.753548+00', '2026-04-17 16:00:00.880604+00', NULL, 'aal1', NULL, '2026-04-17 16:00:00.880403', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '104.34.81.50', NULL, NULL, NULL, NULL, NULL),
	('7a3403b2-ad3d-4a3d-9f25-7828155aada5', '2a5cef02-b649-4f23-8491-65bff7f9987e', '2026-04-16 14:15:55.896305+00', '2026-04-16 14:15:55.896305+00', NULL, 'aal1', NULL, NULL, 'node', '180.190.20.0', NULL, NULL, NULL, NULL, NULL),
	('b1f4078a-44b3-4600-834e-461b2b592dbe', '82560ade-94bb-4439-9a45-546fbe22cfcb', '2026-04-16 15:39:33.666744+00', '2026-04-17 16:14:23.6353+00', NULL, 'aal1', NULL, '2026-04-17 16:14:23.6352', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '47.205.175.88', NULL, NULL, NULL, NULL, NULL),
	('7a6ded3c-804b-448a-9e80-07508b285630', 'b3c06700-2d55-44d7-8b2c-21c074a6e6db', '2026-04-10 11:28:58.834213+00', '2026-04-10 12:27:13.114817+00', NULL, 'aal1', NULL, '2026-04-10 12:27:13.113326', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '180.190.20.0', NULL, NULL, NULL, NULL, NULL),
	('f57f0c44-71a4-4426-9ccd-4d49178c30e1', '4ff3f0ec-9a0a-4f11-b27b-f5ea10e7d910', '2026-04-16 20:04:59.208096+00', '2026-04-17 12:51:55.547496+00', NULL, 'aal1', NULL, '2026-04-17 12:51:55.546435', 'Vercel Edge Functions', '3.93.189.124', NULL, NULL, NULL, NULL, NULL),
	('32307cde-c31b-4bbb-969a-fc143254c989', 'def47068-35f4-45fa-94bf-361460cb9c12', '2026-04-17 13:17:10.036062+00', '2026-04-17 13:17:10.036062+00', NULL, 'aal1', NULL, NULL, 'node', '35.175.140.127', NULL, NULL, NULL, NULL, NULL),
	('4d1eadac-2420-4a20-8b36-8d81532b2dd3', '82560ade-94bb-4439-9a45-546fbe22cfcb', '2026-04-16 15:30:11.857112+00', '2026-04-17 13:25:39.178213+00', NULL, 'aal1', NULL, '2026-04-17 13:25:39.177797', 'Vercel Edge Functions', '18.205.6.31', NULL, NULL, NULL, NULL, NULL),
	('49b12d40-f677-4d5d-ad8e-21253727347e', '17004d1c-fcdc-4082-ae80-b2dfdade271b', '2026-04-16 18:07:58.440131+00', '2026-04-16 20:02:12.650885+00', NULL, 'aal1', NULL, '2026-04-16 20:02:12.647689', 'Vercel Edge Functions', '54.183.238.44', NULL, NULL, NULL, NULL, NULL),
	('c4a9092d-98ef-4369-b1df-de43d97d956f', 'def47068-35f4-45fa-94bf-361460cb9c12', '2026-04-17 14:21:36.762606+00', '2026-04-17 14:21:36.762606+00', NULL, 'aal1', NULL, NULL, 'node', '180.190.20.0', NULL, NULL, NULL, NULL, NULL),
	('b03e7aed-ba1d-420b-97ae-16c4d7f2ea12', '42161e6d-e35e-4d0a-9080-93adf40c3be1', '2026-04-10 21:14:38.833114+00', '2026-04-16 21:13:29.684521+00', NULL, 'aal1', NULL, '2026-04-16 21:13:29.683961', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '74.219.2.149', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('7a6ded3c-804b-448a-9e80-07508b285630', '2026-04-10 11:28:58.899055+00', '2026-04-10 11:28:58.899055+00', 'password', '7fee5994-6bd3-4ad2-92c0-5d14b78652d4'),
	('7a3403b2-ad3d-4a3d-9f25-7828155aada5', '2026-04-16 14:15:55.963763+00', '2026-04-16 14:15:55.963763+00', 'password', 'a62d4d26-f6b1-4aaf-8774-f10b0d4d0ec2'),
	('4d1eadac-2420-4a20-8b36-8d81532b2dd3', '2026-04-16 15:30:11.95725+00', '2026-04-16 15:30:11.95725+00', 'password', 'c09bcd6c-e309-4bb7-9d8d-e6c755d6e4a1'),
	('b03e7aed-ba1d-420b-97ae-16c4d7f2ea12', '2026-04-10 21:14:38.852499+00', '2026-04-10 21:14:38.852499+00', 'password', '7d632b1f-4f88-432c-9ebf-22f6598b9575'),
	('b1f4078a-44b3-4600-834e-461b2b592dbe', '2026-04-16 15:39:33.727573+00', '2026-04-16 15:39:33.727573+00', 'password', '89489545-6097-4e87-9360-8e2c5ba92a05'),
	('49b12d40-f677-4d5d-ad8e-21253727347e', '2026-04-16 18:07:58.465103+00', '2026-04-16 18:07:58.465103+00', 'password', '8b43c0c5-4c1e-4ac8-810c-e4f2090b09a5'),
	('fb99ce5c-3a7f-4e97-a574-9aae16c05b90', '2026-04-16 19:31:02.827258+00', '2026-04-16 19:31:02.827258+00', 'password', 'd490c9e1-2337-4200-a6a6-d36b5df6d79b'),
	('f57f0c44-71a4-4426-9ccd-4d49178c30e1', '2026-04-16 20:04:59.25918+00', '2026-04-16 20:04:59.25918+00', 'password', '5c519172-4c1c-49e3-8bd8-914e34f3e895'),
	('32307cde-c31b-4bbb-969a-fc143254c989', '2026-04-17 13:17:10.107034+00', '2026-04-17 13:17:10.107034+00', 'password', 'b19028ca-db6f-4772-a84f-584f615c727b'),
	('c4a9092d-98ef-4369-b1df-de43d97d956f', '2026-04-17 14:21:36.824167+00', '2026-04-17 14:21:36.824167+00', 'password', '94089944-b28a-455c-be24-fc254e1858b7');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") VALUES
	('ea0a510f-2030-493d-bb79-a3e0baf6f884', '4b52b4df-8d89-474a-9b80-07d91765838b', 'confirmation_token', '365a630624fe6ea17ebd07ee6e3e8cf2e3ace31d105b42d2b1c02462', 'pebos37506@tatefarm.com', '2026-04-16 13:51:51.413719', '2026-04-16 13:51:51.413719'),
	('77bffbec-3072-4a1b-9365-41dab6ded09d', 'f5625231-5b21-4e77-bee1-74a375f8633d', 'confirmation_token', 'e7df9a8fc3cc485c3f6962f5e417492f1b83c6ffe8053b7e47d62c3d', 'pahoge3277@sskaid.com', '2026-04-16 14:11:18.020232', '2026-04-16 14:11:18.020232'),
	('9863e488-3f59-4cc7-9d56-8685cefa2a8e', '44d3a259-8fb5-4d85-bbdd-cc7327e9d72b', 'confirmation_token', '69d2746cb1759b39dc9fa2aeca57cc35dca7bbed03044ff6ff75996b', 'kicovab342@sskaid.com', '2026-04-16 14:39:55.263114', '2026-04-16 14:39:55.263114'),
	('34ecda08-6e82-4b4b-a2d7-d774077f550e', '5ace75c8-cca1-461e-a977-9df48eb66291', 'confirmation_token', '7f1cb3907acdd13355295dbc9470ef5529cafcb40b4b94e9e897c8b3', 'midexa5051@sskaid.com', '2026-04-16 15:03:11.943833', '2026-04-16 15:03:11.943833'),
	('c76bd156-dcb2-4940-85a7-2a61b641633c', '9e1b4098-7d2e-4325-8d81-694d7a991098', 'recovery_token', 'c6b8e2188098cc396723347498cf1e252d637f5a620892c744470407', 'kelseyr.kc@gmail.com', '2026-04-16 15:28:52.662217', '2026-04-16 15:28:52.662217');


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 363, 'ab5a33sbzfdd', '42161e6d-e35e-4d0a-9080-93adf40c3be1', true, '2026-04-10 21:14:38.839392+00', '2026-04-11 12:34:16.765457+00', NULL, 'b03e7aed-ba1d-420b-97ae-16c4d7f2ea12'),
	('00000000-0000-0000-0000-000000000000', 519, 'n63rufjfvsxi', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 08:22:28.279744+00', '2026-04-17 09:21:28.306987+00', 'bdstv4gyesc3', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 518, 'zlpa5gcqdl2s', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 08:11:34.746305+00', '2026-04-17 09:34:05.819098+00', 'z6jdx57mrlj3', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 520, 'mevf5k7kdow6', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 09:21:28.32952+00', '2026-04-17 10:20:28.130966+00', 'n63rufjfvsxi', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 521, 'bh6xkqxg5hkc', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 09:34:05.836998+00', '2026-04-17 10:42:45.731369+00', 'zlpa5gcqdl2s', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 522, 'bmoo54ojubft', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 10:20:28.172558+00', '2026-04-17 11:19:28.001396+00', 'mevf5k7kdow6', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 523, 'edhjf4ngh67c', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 10:42:45.753139+00', '2026-04-17 11:51:00.652443+00', 'bh6xkqxg5hkc', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 524, 'zyv2ahkcgikb', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 11:19:28.021174+00', '2026-04-17 12:18:28.077245+00', 'bmoo54ojubft', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 472, 'n3cvi3kpxpns', '2a5cef02-b649-4f23-8491-65bff7f9987e', false, '2026-04-16 14:15:55.926956+00', '2026-04-16 14:15:55.926956+00', NULL, '7a3403b2-ad3d-4a3d-9f25-7828155aada5'),
	('00000000-0000-0000-0000-000000000000', 503, 'dxxgo23rxsnu', '4ff3f0ec-9a0a-4f11-b27b-f5ea10e7d910', true, '2026-04-16 21:34:34.888312+00', '2026-04-17 12:51:55.495459+00', 'zyggh4e3bcej', 'f57f0c44-71a4-4426-9ccd-4d49178c30e1'),
	('00000000-0000-0000-0000-000000000000', 527, 'hqfk7gszw2zr', '4ff3f0ec-9a0a-4f11-b27b-f5ea10e7d910', false, '2026-04-17 12:51:55.514335+00', '2026-04-17 12:51:55.514335+00', 'dxxgo23rxsnu', 'f57f0c44-71a4-4426-9ccd-4d49178c30e1'),
	('00000000-0000-0000-0000-000000000000', 525, 'jmwtgkr7bgn3', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 11:51:00.678745+00', '2026-04-17 12:53:08.815565+00', 'edhjf4ngh67c', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 533, 'lwknpo7juu7l', 'def47068-35f4-45fa-94bf-361460cb9c12', false, '2026-04-17 13:17:10.072073+00', '2026-04-17 13:17:10.072073+00', NULL, '32307cde-c31b-4bbb-969a-fc143254c989'),
	('00000000-0000-0000-0000-000000000000', 526, 'qd52hl7d4iku', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 12:18:28.104074+00', '2026-04-17 13:17:27.676148+00', 'zyv2ahkcgikb', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 480, 'ltlrjqm2m3kd', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 15:30:11.9201+00', '2026-04-17 13:25:39.131752+00', NULL, '4d1eadac-2420-4a20-8b36-8d81532b2dd3'),
	('00000000-0000-0000-0000-000000000000', 483, 'j6xpgyeg7e34', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 15:39:33.686695+00', '2026-04-16 16:38:28.198944+00', NULL, 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 347, '7tagjxtpdfej', 'b3c06700-2d55-44d7-8b2c-21c074a6e6db', true, '2026-04-10 11:28:58.862278+00', '2026-04-10 12:27:13.031093+00', NULL, '7a6ded3c-804b-448a-9e80-07508b285630'),
	('00000000-0000-0000-0000-000000000000', 349, '56cdo3bfc27c', 'b3c06700-2d55-44d7-8b2c-21c074a6e6db', false, '2026-04-10 12:27:13.064012+00', '2026-04-10 12:27:13.064012+00', '7tagjxtpdfej', '7a6ded3c-804b-448a-9e80-07508b285630'),
	('00000000-0000-0000-0000-000000000000', 535, 'vlsqlzylrplh', '82560ade-94bb-4439-9a45-546fbe22cfcb', false, '2026-04-17 13:25:39.150554+00', '2026-04-17 13:25:39.150554+00', 'ltlrjqm2m3kd', '4d1eadac-2420-4a20-8b36-8d81532b2dd3'),
	('00000000-0000-0000-0000-000000000000', 528, 'zyeosxgp6sgt', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 12:53:08.845956+00', '2026-04-17 13:52:13.125426+00', 'jmwtgkr7bgn3', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 487, 'ztz32ndfsx2v', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 16:38:28.230153+00', '2026-04-16 17:37:27.890569+00', 'j6xpgyeg7e34', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 534, '5odhta5jh4yr', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 13:17:27.681877+00', '2026-04-17 14:16:27.983631+00', 'qd52hl7d4iku', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 489, 'ljrlwo43b72v', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 17:37:27.912643+00', '2026-04-16 18:36:28.103709+00', 'ztz32ndfsx2v', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 538, 't3a5zhl56ok4', 'def47068-35f4-45fa-94bf-361460cb9c12', false, '2026-04-17 14:21:36.795466+00', '2026-04-17 14:21:36.795466+00', NULL, 'c4a9092d-98ef-4369-b1df-de43d97d956f'),
	('00000000-0000-0000-0000-000000000000', 536, 't2kvun5lz5ht', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 13:52:13.151122+00', '2026-04-17 14:59:05.947357+00', 'zyeosxgp6sgt', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 493, 'yc7465ymyfkf', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 18:36:28.129764+00', '2026-04-16 19:35:28.731514+00', 'ljrlwo43b72v', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 537, 'os6moeg6ubha', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 14:16:28.005108+00', '2026-04-17 15:15:18.039625+00', '5odhta5jh4yr', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 492, 'dhpulrulwxdx', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-16 18:07:58.450614+00', '2026-04-16 20:02:12.588843+00', NULL, '49b12d40-f677-4d5d-ad8e-21253727347e'),
	('00000000-0000-0000-0000-000000000000', 496, 'yybb7jfvgmgh', '17004d1c-fcdc-4082-ae80-b2dfdade271b', false, '2026-04-16 20:02:12.603545+00', '2026-04-16 20:02:12.603545+00', 'dhpulrulwxdx', '49b12d40-f677-4d5d-ad8e-21253727347e'),
	('00000000-0000-0000-0000-000000000000', 495, 'i4ny5uwiqbjd', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 19:35:28.752613+00', '2026-04-16 20:34:28.200696+00', 'yc7465ymyfkf', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 368, 'brmahnbizmra', '42161e6d-e35e-4d0a-9080-93adf40c3be1', true, '2026-04-11 12:34:16.780071+00', '2026-04-16 21:13:29.611519+00', 'ab5a33sbzfdd', 'b03e7aed-ba1d-420b-97ae-16c4d7f2ea12'),
	('00000000-0000-0000-0000-000000000000', 501, 'ikyou5gvfko2', '42161e6d-e35e-4d0a-9080-93adf40c3be1', false, '2026-04-16 21:13:29.653347+00', '2026-04-16 21:13:29.653347+00', 'brmahnbizmra', 'b03e7aed-ba1d-420b-97ae-16c4d7f2ea12'),
	('00000000-0000-0000-0000-000000000000', 500, 'th3bgcx3dxkv', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 20:34:28.226209+00', '2026-04-16 21:33:28.226004+00', 'i4ny5uwiqbjd', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 499, 'zyggh4e3bcej', '4ff3f0ec-9a0a-4f11-b27b-f5ea10e7d910', true, '2026-04-16 20:04:59.228581+00', '2026-04-16 21:34:34.874812+00', NULL, 'f57f0c44-71a4-4426-9ccd-4d49178c30e1'),
	('00000000-0000-0000-0000-000000000000', 502, 'kic2ddda4xyo', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 21:33:28.239485+00', '2026-04-16 22:32:28.250179+00', 'th3bgcx3dxkv', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 504, 'rt5aknai362a', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 22:32:28.278721+00', '2026-04-16 23:31:28.17154+00', 'kic2ddda4xyo', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 505, 'h5by2qez36mf', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-16 23:31:28.202636+00', '2026-04-17 00:30:28.292209+00', 'rt5aknai362a', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 506, 'jsj5c7okwrpx', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 00:30:28.334837+00', '2026-04-17 01:29:28.194529+00', 'h5by2qez36mf', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 494, 'ta6sd57qkpcb', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-16 19:31:02.799997+00', '2026-04-17 02:20:39.376913+00', NULL, 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 507, 'k2lj43krti3t', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 01:29:28.210507+00', '2026-04-17 02:28:28.003046+00', 'jsj5c7okwrpx', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 509, '6ddzvvvbxxl7', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 02:28:28.022826+00', '2026-04-17 03:27:06.011484+00', 'k2lj43krti3t', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 508, 'xlwnqnsswmjr', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 02:20:39.419393+00', '2026-04-17 04:11:47.0685+00', 'ta6sd57qkpcb', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 510, '3zcacaalcnbc', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 03:27:06.025969+00', '2026-04-17 04:26:28.0466+00', '6ddzvvvbxxl7', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 512, 'ypv5kvyflizs', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 04:26:28.075207+00', '2026-04-17 05:25:28.115707+00', '3zcacaalcnbc', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 511, '7543yjbyx3sn', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 04:11:47.105367+00', '2026-04-17 05:42:20.044015+00', 'xlwnqnsswmjr', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 513, 'i63mpvl3llr3', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 05:25:28.133764+00', '2026-04-17 06:24:28.173835+00', 'ypv5kvyflizs', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 514, 'pnqge7c2sxea', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 05:42:20.072668+00', '2026-04-17 06:48:51.506789+00', '7543yjbyx3sn', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 515, 'zjkvfyq6ai4m', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 06:24:28.195636+00', '2026-04-17 07:23:28.337205+00', 'i63mpvl3llr3', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 516, 'z6jdx57mrlj3', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 06:48:51.532922+00', '2026-04-17 08:11:34.718172+00', 'pnqge7c2sxea', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 517, 'bdstv4gyesc3', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 07:23:28.363766+00', '2026-04-17 08:22:28.250697+00', 'zjkvfyq6ai4m', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 539, 'xuf74pkrzjwh', '17004d1c-fcdc-4082-ae80-b2dfdade271b', true, '2026-04-17 14:59:05.99295+00', '2026-04-17 16:00:00.862318+00', 't2kvun5lz5ht', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 541, 'vsb2rureghgl', '17004d1c-fcdc-4082-ae80-b2dfdade271b', false, '2026-04-17 16:00:00.867967+00', '2026-04-17 16:00:00.867967+00', 'xuf74pkrzjwh', 'fb99ce5c-3a7f-4e97-a574-9aae16c05b90'),
	('00000000-0000-0000-0000-000000000000', 540, 'ygemjz6qtydq', '82560ade-94bb-4439-9a45-546fbe22cfcb', true, '2026-04-17 15:15:18.061482+00', '2026-04-17 16:14:23.628276+00', 'os6moeg6ubha', 'b1f4078a-44b3-4600-834e-461b2b592dbe'),
	('00000000-0000-0000-0000-000000000000', 542, 'uujhqonoiws6', '82560ade-94bb-4439-9a45-546fbe22cfcb', false, '2026-04-17 16:14:23.630308+00', '2026-04-17 16:14:23.630308+00', 'ygemjz6qtydq', 'b1f4078a-44b3-4600-834e-461b2b592dbe');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 542, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict tv4fnwGgb16AsyPDMe0KQFYNP7p3Z4eTf5UdhaM8eivgObpQUrXnuLJfeHhemtp

RESET ALL;
