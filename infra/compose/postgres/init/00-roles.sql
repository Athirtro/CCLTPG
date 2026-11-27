-- Propósito: crear los roles de base con privilegios mínimos (control C-41).
-- Se ejecuta una sola vez, cuando Docker inicializa el volumen de PostgreSQL.
-- Los esquemas se crean aquí (no en una migración) para que el historial de
-- Kysely pueda existir antes de la primera migración de cada esquema.

\set ON_ERROR_STOP on

\getenv db_name POSTGRES_DB
\getenv migrator_password CCLTPG_MIGRATOR_PASSWORD
\getenv app_password CCLTPG_APP_PASSWORD
\getenv readonly_password CCLTPG_READONLY_PASSWORD

\if :{?migrator_password}
\else
  \warn 'Falta CCLTPG_MIGRATOR_PASSWORD en el entorno del contenedor.'
  \quit 3
\endif

\if :{?app_password}
\else
  \warn 'Falta CCLTPG_APP_PASSWORD en el entorno del contenedor.'
  \quit 3
\endif

\if :{?readonly_password}
\else
  \warn 'Falta CCLTPG_READONLY_PASSWORD en el entorno del contenedor.'
  \quit 3
\endif

-- 1. Roles -----------------------------------------------------------------
-- ccltpg_migrator: dueño del DDL y de las tablas.
CREATE ROLE ccltpg_migrator
  LOGIN PASSWORD :'migrator_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- ccltpg_app: DML sobre las tablas, sin DDL ni privilegios de superusuario.
CREATE ROLE ccltpg_app
  LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- ccltpg_readonly: consultas analíticas, transacciones de solo lectura.
CREATE ROLE ccltpg_readonly
  LOGIN PASSWORD :'readonly_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

ALTER ROLE ccltpg_readonly SET default_transaction_read_only = on;
ALTER ROLE ccltpg_app SET idle_in_transaction_session_timeout = '30s';

-- 2. Conexión y esquemas ---------------------------------------------------
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO ccltpg_migrator, ccltpg_app, ccltpg_readonly;
-- Emisora R.A.C.: la migración 0001 instala `btree_gist` (extensión de confianza
-- en PG 13+) para la restricción de exclusión de franjas. Requiere CREATE en la
-- base de datos; se concede solo al rol migrador, nunca a app ni readonly.
GRANT CREATE ON DATABASE :"db_name" TO ccltpg_migrator;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ccltpg_app, ccltpg_readonly;
GRANT USAGE, CREATE ON SCHEMA public TO ccltpg_migrator;

CREATE SCHEMA IF NOT EXISTS academic AUTHORIZATION ccltpg_migrator;
GRANT USAGE ON SCHEMA academic TO ccltpg_app, ccltpg_readonly;
GRANT USAGE, CREATE ON SCHEMA academic TO ccltpg_migrator;

CREATE SCHEMA IF NOT EXISTS emisora AUTHORIZATION ccltpg_migrator;
GRANT USAGE ON SCHEMA emisora TO ccltpg_app, ccltpg_readonly;
GRANT USAGE, CREATE ON SCHEMA emisora TO ccltpg_migrator;

-- 3. Privilegios por defecto para objetos creados por el migrador -----------
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ccltpg_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA public
  GRANT SELECT ON TABLES TO ccltpg_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ccltpg_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO ccltpg_readonly;

ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA academic
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ccltpg_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA academic
  GRANT SELECT ON TABLES TO ccltpg_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA academic
  GRANT USAGE, SELECT ON SEQUENCES TO ccltpg_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA academic
  GRANT SELECT ON SEQUENCES TO ccltpg_readonly;

ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA emisora
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ccltpg_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA emisora
  GRANT SELECT ON TABLES TO ccltpg_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA emisora
  GRANT USAGE, SELECT ON SEQUENCES TO ccltpg_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ccltpg_migrator IN SCHEMA emisora
  GRANT SELECT ON SEQUENCES TO ccltpg_readonly;

-- Nota C2: sobre public.evento_auditoria se revocará UPDATE/DELETE/TRUNCATE
-- a ccltpg_app y se añadirá el disparador de inmutabilidad (C-28).
