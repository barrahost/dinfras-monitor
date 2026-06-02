-- ============================================================
-- D-INFRAS Monitor — Tables Supabase
-- Coller dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- TABLE : monitor_users
-- Stocke les utilisateurs (admin + clients)
CREATE TABLE IF NOT EXISTS monitor_users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,   -- SHA-256 hex du mot de passe
  role        TEXT NOT NULL DEFAULT 'client',  -- 'admin' | 'client'
  client_id   TEXT,              -- null pour admin, 'worldev' pour M. Bahi, etc.
  name        TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  last_login  TIMESTAMPTZ
);

-- TABLE : monitor_clients
-- Config de chaque client géré
CREATE TABLE IF NOT EXISTS monitor_clients (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   TEXT UNIQUE NOT NULL,   -- 'worldev', 'akiede', 'printxi', etc.
  name        TEXT NOT NULL,          -- 'WORLDEV (M. Bahi)', 'Akiede CI'
  contact     TEXT,                   -- email contact client
  forfait     TEXT,                   -- '164 000 FCFA/mois'
  contract_ref TEXT,                  -- 'DINFRAS-WORLDEV-2026-001'
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- INDEX pour performance
CREATE INDEX IF NOT EXISTS idx_users_email ON monitor_users(email);
CREATE INDEX IF NOT EXISTS idx_clients_client_id ON monitor_clients(client_id);

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================

-- Clients
INSERT INTO monitor_clients (client_id, name, contact, forfait, contract_ref) VALUES
  ('worldev',   'WORLDEV (M. Hubert Bahi)',  'hubert.bahi@worldev.ci',       '164 000 FCFA/mois', 'DINFRAS-WORLDEV-2026-001'),
  ('uppertech', 'Upper Techs Africa',         'patrice.tano@upper-techs.africa', '45 000 FCFA/mois', NULL),
  ('akiede',    'Akiede CI',                  'contact@akiede.ci',             '25 000 FCFA/mois', NULL),
  ('printxi',   'PrintXI',                    'admin@printxi.ci',              '25 000 FCFA/mois', NULL),
  ('rhdoc',     'RHDOC Africa',               'contact@rhdoc.africa',          '25 000 FCFA/mois', NULL),
  ('microtech', 'Microtech CI',               'info@microtech.ci',             '25 000 FCFA/mois', NULL)
ON CONFLICT (client_id) DO NOTHING;


-- ============================================================
-- UTILISATEURS — Générer les hash SHA-256 avec la commande :
-- node -e "const c=require('crypto');console.log(c.createHash('sha256').update('VOTRE_MOT_DE_PASSE').digest('hex'))"
-- OU utiliser : https://emn178.github.io/online-tools/sha256.html
-- ============================================================

-- Admin : patrice.tano.k@gmail.com / DInfras@2026!
-- Hash SHA-256 de "DInfras@2026!" :
-- À générer et remplacer ci-dessous avant d'insérer

INSERT INTO monitor_users (email, password_hash, role, client_id, name) VALUES
  (
    'patrice.tano.k@gmail.com',
    'REMPLACER_PAR_HASH_SHA256_DE_VOTRE_MOT_DE_PASSE_ADMIN',
    'admin',
    NULL,
    'Patrice Tano — D-INFRAS AFRICA'
  ),
  (
    'hubert.bahi@worldev.ci',
    'REMPLACER_PAR_HASH_SHA256_DU_MOT_DE_PASSE_BAHI',
    'client',
    'worldev',
    'Hubert Bahi — WORLDEV'
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- RLS (Row Level Security) — optionnel mais recommandé
-- Le Worker utilise la clé anon mais avec un accès direct
-- ============================================================

-- Désactiver RLS pour ces tables (le Worker gère l'auth lui-même)
ALTER TABLE monitor_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_clients DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- POUR AJOUTER UN NOUVEAU CLIENT plus tard :
-- ============================================================
/*
-- 1. Ajouter le client
INSERT INTO monitor_clients (client_id, name, contact, forfait)
VALUES ('nouveau_client', 'Nom du Client', 'email@client.ci', '25 000 FCFA/mois');

-- 2. Créer son compte utilisateur (avec hash SHA-256 du mot de passe)
INSERT INTO monitor_users (email, password_hash, role, client_id, name)
VALUES ('contact@client.ci', 'HASH_ICI', 'client', 'nouveau_client', 'Prénom Nom');

-- 3. Ajouter ses services dans worker.js (WORLDEV_SERVICES) avec client_id = 'nouveau_client'
-- 4. Relancer : wrangler deploy
*/
