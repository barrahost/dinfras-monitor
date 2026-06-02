# D-INFRAS Monitor — Contexte projet pour Claude Code

## Vue d'ensemble
Plateforme de supervision d'infrastructure web hébergée sur **monitor.d-infras.africa**.  
Un seul fichier : `worker.js` (Cloudflare Worker) + auth Supabase.  
Développé par **Patrice Tano / D-INFRAS AFRICA** — patrice.tano.k@gmail.com

---

## Stack technique
- **Runtime** : Cloudflare Worker (JS ES modules, edge computing)
- **Auth** : Supabase PostgreSQL (`monitor_users` table) + sessions cookie HMAC-SHA256 (24h)
- **Hébergement** : Cloudflare Workers → domaine `monitor.d-infras.africa`
- **Config** : secrets Wrangler (`wrangler secret put`)
- **Déploiement** : `wrangler deploy` depuis le dossier `monitor-worker/`

## Fichiers
```
monitor-worker/
├── worker.js          ← TOUT le code (Worker + HTML + logique)
├── wrangler.toml      ← config Cloudflare Workers
├── supabase-setup.sql ← tables SQL à créer dans Supabase
├── DEPLOY.md          ← guide de déploiement complet
└── CLAUDE.md          ← ce fichier
```

---

## Secrets à configurer (wrangler secret put)

| Secret | Valeur |
|--------|--------|
| `SUPABASE_URL` | `https://VOTRE_PROJECT_ID.supabase.co` |
| `SUPABASE_ANON_KEY` | clé anon Supabase |
| `SESSION_SECRET` | chaîne aléatoire forte (ex: `openssl rand -hex 32`) |
| `HOSTINGER_TOKEN` | `tET3gcMAJuktnL3n2lVZ2KHSrHlJzjwPmIGARzlc514a6567` ⚠️ expire 01/07/2026 |
| `WHM_TOKEN` | token API WHM — générer dans WHM → Development → Manage API Tokens |
| `WHM_HOST` | `72.60.88.54` |
| `WHM_PORT` | `2087` |
| `WHM_USER` | `root` |

---

## Routes de l'application

| Méthode | Route | Accès | Description |
|---------|-------|-------|-------------|
| GET | `/login` | public | Page de connexion |
| POST | `/login` | public | Authentification |
| GET | `/logout` | auth | Déconnexion |
| GET | `/` | auth | Dashboard (services, domaines, coûts) |
| GET | `/admin` | admin only | Page admin : VPS métriques + gestion clients cPanel |
| POST | `/admin/action` | admin only | Suspendre/réactiver un compte cPanel |
| GET | `/api/status` | auth | JSON statut services |
| GET | `/api/vps` | admin only | JSON métriques VPS Hostinger |
| GET | `/api/cpanel/accounts` | admin only | JSON liste comptes cPanel |

---

## Rôles utilisateurs

| Rôle | Email | Voit |
|------|-------|------|
| `admin` | patrice.tano.k@gmail.com | Tout : tous les clients, VPS, coûts réels, actions WHM |
| `client` | ex: hubert.bahi@worldev.ci | Ses services filtrés par `client_id`, ses domaines, son forfait |

---

## Base de données Supabase

### Table `monitor_users`
```sql
id UUID, email TEXT UNIQUE, password_hash TEXT (SHA-256),
role TEXT ('admin'|'client'), client_id TEXT, name TEXT, active BOOLEAN
```

### Table `monitor_clients`
```sql
id UUID, client_id TEXT UNIQUE, name TEXT, contact TEXT,
forfait TEXT, contract_ref TEXT, active BOOLEAN
```

**Hash SHA-256 d'un mot de passe :**
```bash
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('MOT_DE_PASSE').digest('hex'))"
```

---

## APIs externes intégrées

### Hostinger API
- Base URL : `https://developers.hostinger.com`
- Auth : `Bearer TOKEN`
- Endpoints utilisés :
  - `GET /api/vps/v1/virtual-machines` → liste VPS (IP, CPU, RAM, disk, état)
  - `GET /api/vps/v1/virtual-machines/{id}/metrics` → métriques temps réel
- ⚠️ Token actuel expire **01/07/2026** — à renouveler sur hpanel.hostinger.com

### WHM API (cPanel sur 72.60.88.54)
- Base URL : `https://72.60.88.54:2087/json-api/`
- Auth : `whm root:TOKEN`
- Endpoints utilisés :
  - `listaccts` → liste tous les comptes cPanel avec disk usage
  - `suspendacct?user=X` → suspendre un compte
  - `unsuspendacct?user=X` → réactiver un compte
- **Token WHM à générer** : WHM → Development → Manage API Tokens → Create Token
- Sans token WHM : la page admin affiche des données statiques (pas d'actions)

### Supabase REST API
- Base URL : `https://PROJECT_ID.supabase.co/rest/v1`
- Auth : `apikey` + `Authorization: Bearer ANON_KEY`
- Utilisé pour : lire `monitor_users` à la connexion

---

## Serveur VPS Hostinger
```
IP          : 72.60.88.54
Hostname    : srv1723700.hstgr.cloud
OS          : AlmaLinux 9 + cPanel/WHM Pro (30 comptes)
Coût        : $60.98/mois (KVM 2 $13.99 + cPanel Pro $46.99)
Expiration  : 2026-07-01
WHM         : https://72.60.88.54:2087 (root / +v9?G/NkX+JF4T#v)
```

---

## Clients hébergés (mapping cPanel → client_id)

| Username cPanel | Domaine | client_id | Forfait |
|----------------|---------|-----------|---------|
| `worldevci` | worldevci.info | `worldev` | 25 000 FCFA/mois |
| `moncga` | moncga.ci | `worldev` | 25 000 FCFA/mois |
| `worldev` | worldev.ci | `worldev` | inclus |
| `akiede` | akiede.ci | `akiede` | 25 000 FCFA/mois |
| `printxi` | printxi.ci | `printxi` | 25 000 FCFA/mois |
| `rhdoc` | rhdoc.africa | `rhdoc` | 25 000 FCFA/mois |
| `microtech` | microtech.ci | `microtech` | 25 000 FCFA/mois |
| `uppertech` | upper-techs.africa | `uppertech` | 45 000 FCFA/mois |
| `dinfrasa` | d-infras.africa | `__admin` | interne |

---

## Services surveillés (HTTP checks)

```js
// Définis dans SERVICES[] dans worker.js
// Format: { id, name, url, category, client_id }
// client_id "__admin" = visible admin seulement
// client_id "worldev" = visible par l'admin et le client worldev
```

12 services : moncga.ci, estock-fne.com, API CGA, API E-Stock,
worldev.ci, worldevci.info, d-infras.africa, upper-techs.africa,
akiede.ci, printxi.ci, rhdoc.africa, microtech.ci

---

## Domaines surveillés (expiration Netim)

| Domaine | Expiration | Alerte |
|---------|-----------|--------|
| moncga.ci | 2026-09-08 | ⚠️ À renouveler |
| worldev.ci | 2027-01-05 | OK |
| estock-fne.com | 2027-03-19 | OK |
| e-cga.com | 2027-05-06 | OK |
| e-cabinet-comptable.com | 2027-05-06 | OK |

---

## Prochaines fonctionnalités à développer (Phase 1)

1. **Cloudflare Cron Triggers** — checks continus toutes les 5 min (pas à la visite)
   - Ajouter `[triggers] crons = ["*/5 * * * *"]` dans wrangler.toml
   - Ajouter handler `scheduled()` dans worker.js
   - Stocker résultats dans Supabase table `check_results`

2. **Historique uptime** — table `check_results(id, service_id, status, latency_ms, http_code, checked_at)`
   - Afficher % uptime 30j sur le dashboard

3. **Alertes email** — intégrer Resend (gratuit 3 000 emails/mois)
   - `POST https://api.resend.com/emails` avec API key
   - Envoyer quand status passe de "up" → "down" et "down" → "up"

4. **Alertes WhatsApp** — via Twilio ou 360dialog
   - Canal préféré des PME ivoiriennes

5. **Rapport PDF mensuel** — résumé uptime + incidents + coûts par client

---

## Commandes utiles

```bash
# Déployer
cd monitor-worker/
wrangler deploy

# Voir les logs en temps réel
wrangler tail

# Ajouter un secret
wrangler secret put NOM_SECRET

# Lister les secrets
wrangler secret list

# Tester localement
wrangler dev
```

---

## Notes importantes

- Le sandbox Claude (Cowork) ne peut pas appeler l'API Hostinger (proxy bloqué).
  **Le Worker Cloudflare, lui, appelle l'API directement sans problème.**
- Le token Hostinger expire le **01/07/2026** — priorité absolue à renouveler.
- Sans token WHM, la page `/admin` affiche des données statiques.
  Pour activer les actions (suspendre/réactiver), générer un token WHM.
- Les mots de passe Supabase sont hashés en SHA-256 (pas bcrypt).
  Simple et suffisant pour ce contexte, mais upgrader à bcrypt si usage public.
- `wrangler.toml` : name = `worldev-monitor`, compatibility_date = `2024-01-01`
