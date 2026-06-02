# D-INFRAS Monitor — Contexte projet Claude Code

## Projet
Plateforme SaaS supervision infra web - monitor.d-infras.africa
Developpe par Patrice Tano / D-INFRAS AFRICA - patrice.tano.k@gmail.com
Un seul fichier : worker.js (Cloudflare Worker) + Supabase auth

## Stack
- Runtime : Cloudflare Worker (JS ES modules, edge)
- Auth : Supabase PostgreSQL + sessions cookie HMAC-SHA256 24h
- Deploiement : wrangler deploy

## Secrets requis
SUPABASE_URL, SUPABASE_ANON_KEY, SESSION_SECRET
HOSTINGER_TOKEN (expire 01/07/2026!)
WHM_TOKEN, WHM_HOST=72.60.88.54, WHM_PORT=2087, WHM_USER=root

## Routes
/login - GET/POST - public
/logout - GET - auth
/ - GET - auth - Dashboard
/admin - GET - admin only - VPS metriques + gestion cPanel
/admin/action - POST - admin only - suspendre/reactiver
/api/status - GET - auth - JSON statut services
/api/vps - GET - admin only - JSON metriques VPS
/api/cpanel/accounts - GET - admin only - comptes cPanel

## Roles
- admin (patrice.tano.k@gmail.com) : voit tout, actions WHM
- client : voit ses services/domaines filtres par client_id

## APIs
### Hostinger
- https://developers.hostinger.com
- GET /api/vps/v1/virtual-machines -> VPS state/CPU/RAM/disk
- GET /api/vps/v1/virtual-machines/{id}/metrics -> metriques reelles
- TOKEN EXPIRE 01/07/2026 - renouveler sur hpanel.hostinger.com

### WHM cPanel
- https://72.60.88.54:2087/json-api/ | auth: whm root:TOKEN
- listaccts -> liste comptes + disk usage
- suspendacct?user=X / unsuspendacct?user=X -> actions
- Generer token : WHM -> Development -> Manage API Tokens

## VPS 72.60.88.54
AlmaLinux 9 + cPanel/WHM Pro | $60.98/mois | exp 2026-07-01
WHM : https://72.60.88.54:2087 (root / +V9?G/NkX+JF4T#v)

## Clients cPanel
worldevci -> worldev.ci/.worldevci.info | moncga -> moncga.ci
akiede -> akiede.ci | printxi -> printxi.ci | rhdoc -> rhdoc.africa
microtech -> microtech.ci | uppertech -> upper-techs.africa
dinfrasa -> d-infras.africa (interne)

## Prochaines fonctionnalites (Phase 1)
1. CF Cron Triggers - checks continus 5min
2. Supabase check_results - historique uptime
3. Alertes email via Resend
4. Alertes WhatsApp via Twilio
5. Rapport PDF mensuel par client

## Commandes
wrangler deploy | wrangler tail | wrangler dev

## Notes
- Sandbox Claude : proxy bloque API Hostinger. Le Worker appelle directement.
- Sans WHM_TOKEN : /admin affiche donnees statiques
- M` ts de passes SHA-256 (pas bcrypt)
