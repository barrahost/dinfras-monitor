# Déploiement — monitor.d-infras.africa

## ETAPE 1 — Supabase
1. https://supabase.com ‒ New Project `dinfras-monitor` West EU
2. Settings ‒ API : Project URL + anon key
3. SQL Editor : coller supabase-setup.sql, remplacer hash SHA-256

## ETAPE 2 — Secrets Wrangler
```bash
npm install -g wrangler && wrangler login
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SESSION_SECRET
wrangler secret put HOSTINGER_TOKEN
wrangler secret put WHM_TOKEN
wrangler secret put WHM_HOST
wrangler secret put WHM_PORT
wrangler secret put WHM_USER
```

## ETAPE 3 — Deployer
```bash
cd monitor-worker/ && wrangler deploy
```

## ETAPE 4 — Domaine
Cloudflare : Workers & Pages ‒ worldev-monitor → Settings ‒ Triggers — Custom Domains → Add monitor.d-infras.africa

## COMPTES
| Role | Email |
|----|----|
| admin | patrice.tano.k@gmail.com |
| client | hubert.bahi@worldev.ci |

## COUT : $0/mois (Cloudflare Workers gratuit + Supabase gratuit)
