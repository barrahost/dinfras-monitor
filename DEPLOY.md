# Déploiement — monitor.d-infras.africa
## Avec login Supabase + rôles Admin/Client

---

## ÉTAPE 1 — Créer le projet Supabase (gratuit)

1. Aller sur https://supabase.com → **New Project**
2. Nom : `dinfras-monitor` — Région : **West EU** (Frankfurt, le plus proche)
3. Récupérer dans **Settings → API** :
   - `Project URL` → ex: `https://abcdefgh.supabase.co`
   - `anon public` key → longue clé JWT

---

## ÉTAPE 2 — Créer les tables

1. Supabase Dashboard → **SQL Editor** → **New Query**
2. Coller le contenu de `supabase-setup.sql`
3. Générer les hash SHA-256 des mots de passe **avant** d'insérer les users :

```bash
# Dans un terminal Node.js
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('TON_MOT_DE_PASSE').digest('hex'))"
```

Ou en ligne : https://emn178.github.io/online-tools/sha256.html

4. Remplacer les `REMPLACER_PAR_HASH_SHA256_...` dans le SQL puis **Run**

---

## ÉTAPE 3 — Configurer les secrets Wrangler

```bash
# Installer Wrangler si besoin
npm install -g wrangler
wrangler login

# Définir les secrets (ne jamais les mettre dans le code)
wrangler secret put SUPABASE_URL
# → Entrer : https://VOTRE_PROJECT_ID.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# → Entrer : ta clé anon Supabase

wrangler secret put SESSION_SECRET
# → Entrer un secret aléatoire fort, ex: openssl rand -hex 32

wrangler secret put HOSTINGER_API_TOKEN
# → Entrer : tET3gcMAJuktnL3n2lVZ2KHSrHlJzjwPmIGARzlc514a6567
#   (⚠️ expire 01/07/2026 — à renouveler)
```

---

## ÉTAPE 4 — Déployer

```bash
cd monitor-worker/
wrangler deploy
# → Worker déployé sur worldev-monitor.VOTRE-SOUS-DOMAINE.workers.dev
```

---

## ÉTAPE 5 — Associer monitor.d-infras.africa

**Option A — Dashboard Cloudflare (recommandé) :**
1. Workers & Pages → `worldev-monitor` → Settings → Triggers
2. Custom Domains → Add → `monitor.d-infras.africa`
3. Cloudflare crée automatiquement le CNAME

**Option B — wrangler.toml :**
```toml
routes = [
  { pattern = "monitor.d-infras.africa/*", zone_name = "d-infras.africa" }
]
```
Puis `wrangler deploy`

---

## CONNEXION

| Utilisateur | Email | Rôle | Voit |
|-------------|-------|------|------|
| Patrice (toi) | patrice.tano.k@gmail.com | **admin** | Tout : tous les clients, VPS, coûts réels, tokens |
| M. Bahi | hubert.bahi@worldev.ci | **client** | Ses services WORLDEV uniquement |

URL : https://monitor.d-infras.africa

---

## AJOUTER UN NOUVEAU CLIENT

### 1. SQL Supabase
```sql
INSERT INTO monitor_clients (client_id, name, contact, forfait)
VALUES ('nom_client', 'Nom Complet', 'email@client.ci', '25 000 FCFA/mois');

INSERT INTO monitor_users (email, password_hash, role, client_id, name)
VALUES ('email@client.ci', 'HASH_SHA256', 'client', 'nom_client', 'Prénom Nom');
```

### 2. worker.js — ajouter les services du client
```js
{ id: "service-id", name: "site.ci", url: "https://site.ci", category: "Site Web", client_id: "nom_client" },
```

### 3. Redéployer
```bash
wrangler deploy
```

---

## COÛT TOTAL

| Composant | Coût |
|-----------|------|
| Cloudflare Workers | **GRATUIT** (100k req/jour) |
| Supabase | **GRATUIT** (Free tier : 500 MB, 50k req/mois) |
| Domaine d-infras.africa | déjà payé |
| **TOTAL** | **$0/mois** |

---

## API JSON

`GET https://monitor.d-infras.africa/api/status` (authentifié)  
Retourne le statut de tous les services visibles par l'utilisateur connecté.
