/**
 * D-INFRAS Monitor — Cloudflare Worker
 * monitor.d-infras.africa
 * Patrice Tano / D-INFRAS AFRICA — 2026
 *
 * Routes :
 *   GET  /login            → page login
 *   POST /login            → authentification
 *   GET  /logout           → déconnexion
 *   GET  /                 → dashboard (services, domaines, coûts)
 *   GET  /admin            → page admin (VPS métriques + gestion clients cPanel)
 *   POST /admin/action     → actions WHM (suspendre, réactiver)
 *   GET  /api/status       → JSON statut services
 *   GET  /api/vps          → JSON métriques VPS
 *   GET  /api/cpanel/accounts → JSON comptes cPanel
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  SUPABASE_URL: "https://VOTRE_PROJECT_ID.supabase.co",
  SUPABASE_ANON_KEY: "VOTRE_ANON_KEY",
  SESSION_SECRET: "dinfras-monitor-secret-2026-changeme",
  // Hostinger API
  HOSTINGER_TOKEN: "tET3gcMAJuktnL3n2lVZ2KHSrHlJzjwPmIGARzlc514a6567",
  // WHM API — accès direct sur le VPS
  WHM_HOST: "72.60.88.54",
  WHM_PORT: "2087",
  WHM_USER: "root",
  WHM_TOKEN: "", // à générer : WHM → Development → Manage API Tokens → Create Token
};
function cfg(env, key) { return (env && env[key]) || DEFAULT_CONFIG[key]; }

// ─── SERVICES / DOMAINES / COÛTS ──────────────────────────────────────────────
const SERVICES = [
  { id: "moncga-front",   name: "moncga.ci",         url: "https://www.moncga.ci",      category: "Frontend CGA",    client_id: "worldev"   },
  { id: "estock-front",   name: "estock-fne.com",    url: "https://estock-fne.com",     category: "Frontend E-Stock",client_id: "worldev"   },
  { id: "cga-api",        name: "API CGA",            url: "https://api.moncga.ci",      category: "Backend API",     client_id: "worldev"   },
  { id: "estock-api",     name: "API E-Stock",        url: "https://api.estock-fne.com", category: "Backend API",     client_id: "worldev"   },
  { id: "worldev-main",   name: "worldev.ci",         url: "https://worldev.ci",         category: "Site principal",  client_id: "worldev"   },
  { id: "worldevci-info", name: "worldevci.info",     url: "https://worldevci.info",     category: "Serveur dev/test",client_id: "worldev"   },
  { id: "dinfras",        name: "d-infras.africa",    url: "https://d-infras.africa",    category: "D-INFRAS",        client_id: "__admin"   },
  { id: "upper-techs",    name: "upper-techs.africa", url: "https://upper-techs.africa", category: "Upper Techs",     client_id: "uppertech" },
  { id: "akiede",         name: "akiede.ci",          url: "https://akiede.ci",          category: "Client",          client_id: "akiede"    },
  { id: "printxi",        name: "printxi.ci",         url: "https://printxi.ci",         category: "Client",          client_id: "printxi"   },
  { id: "rhdoc",          name: "rhdoc.africa",       url: "https://rhdoc.africa",       category: "Client",          client_id: "rhdoc"     },
  { id: "microtech",      name: "microtech.ci",       url: "https://microtech.ci",       category: "Client",          client_id: "microtech" },
];

const DOMAINS = [
  { domain: "worldev.ci",              expires: "2027-01-05", cost: "20000 FCFA/an", client_id: "worldev"  },
  { domain: "estock-fne.com",          expires: "2027-03-19", cost: "20000 FCFA/an", client_id: "worldev"  },
  { domain: "e-cga.com",               expires: "2027-05-06", cost: "20000 FCFA/an", client_id: "worldev"  },
  { domain: "e-cabinet-comptable.com", expires: "2027-05-06", cost: "20000 FCFA/an", client_id: "worldev"  },
  { domain: "moncga.ci",               expires: "2026-09-08", cost: "20000 FCFA/an", client_id: "worldev", warning: true },
  { domain: "d-infras.africa",         expires: "2027-06-01", cost: "20000 FCFA/an", client_id: "__admin"  },
  { domain: "upper-techs.africa",      expires: "2027-06-01", cost: "20000 FCFA/an", client_id: "uppertech"},
];

const COSTS = [
  { label: "Hostinger KVM 2 + cPanel Pro", amount: 60.98, fcfa: 36600, type: "infra",    client_id: "__admin"  },
  { label: "Vercel Pro (Frontend)",         amount: 40,    fcfa: 24000, type: "frontend", client_id: "worldev"  },
  { label: "Laravel Cloud (Backend)",       amount: 25,    fcfa: 15000, type: "backend",  client_id: "worldev", variable: true },
  { label: "Cloudflare R2 Backup",          amount: 2.25,  fcfa: 1350,  type: "backup",   client_id: "__admin"  },
];

// Mapping cPanel username → client_id (pour lier les comptes WHM aux clients du monitor)
const CPANEL_CLIENT_MAP = {
  "worldevci":   "worldev",
  "moncga":      "worldev",
  "worldev":     "worldev",
  "akiede":      "akiede",
  "printxi":     "printxi",
  "rhdoc":       "rhdoc",
  "microtech":   "microtech",
  "uppertech":   "uppertech",
  "dinfrasa":    "__admin",
  "dinfras":     "__admin",
};

// Forfaits par client (pour l'affichage facturation)
const CLIENT_PLANS = {
  "worldev":    { label: "Forfait WORLDEV",    fcfa: 164000, ref: "DINFRAS-WORLDEV-2026-001" },
  "akiede":     { label: "Hébergement Akiede", fcfa: 25000,  ref: null },
  "printxi":    { label: "Hébergement PrintXI",fcfa: 25000,  ref: null },
  "rhdoc":      { label: "Hébergement RHDOC",  fcfa: 25000,  ref: null },
  "microtech":  { label: "Hébergement Microtech", fcfa: 25000, ref: null },
  "uppertech":  { label: "Hébergement Upper Techs", fcfa: 45000, ref: null },
  "__admin":    { label: "D-INFRAS AFRICA (interne)", fcfa: 0, ref: null },
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }
function fmtDate(d) { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
function fmtBytes(mb) {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + " GB";
  return mb + " MB";
}
function pct(used, total) { return total > 0 ? Math.round((used / total) * 100) : 0; }
function barColor(p) { return p >= 90 ? "#ef4444" : p >= 75 ? "#f59e0b" : "#22c55e"; }

// ─── SESSION ──────────────────────────────────────────────────────────────────
async function signPayload(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
async function createToken(user, secret) {
  const payload = btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role, client_id: user.client_id, exp: Date.now() + 86400000 }));
  return `${payload}.${await signPayload(payload, secret)}`;
}
async function verifyToken(token, secret) {
  try {
    const [b64, sig] = token.split(".");
    if ((await signPayload(b64, secret)) !== sig) return null;
    const data = JSON.parse(atob(b64));
    return data.exp < Date.now() ? null : data;
  } catch { return null; }
}
function getSession(req) {
  const m = (req.headers.get("Cookie") || "").match(/dinfras_session=([^;]+)/);
  return m ? m[1] : null;
}
async function hashPwd(p) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
async function sbReq(env, path, opts = {}) {
  const r = await fetch(`${cfg(env, "SUPABASE_URL")}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: cfg(env, "SUPABASE_ANON_KEY"), Authorization: `Bearer ${cfg(env, "SUPABASE_ANON_KEY")}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  return r.ok ? r.json() : null;
}
async function findUser(env, email) {
  const r = await sbReq(env, `/monitor_users?email=eq.${encodeURIComponent(email)}&limit=1`);
  return r?.[0] || null;
}

// ─── HOSTINGER API ────────────────────────────────────────────────────────────
async function hostingerVPS(env) {
  try {
    const r = await fetch("https://developers.hostinger.com/api/vps/v1/virtual-machines", {
      headers: { Authorization: `Bearer ${cfg(env, "HOSTINGER_TOKEN")}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data) ? (data.find(v => v.main_ip_address === "72.60.88.54") || data[0]) : null;
  } catch { return null; }
}

async function hostingerMetrics(env, vpsId) {
  if (!vpsId) return null;
  try {
    const r = await fetch(`https://developers.hostinger.com/api/vps/v1/virtual-machines/${vpsId}/metrics`, {
      headers: { Authorization: `Bearer ${cfg(env, "HOSTINGER_TOKEN")}` },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

// ─── WHM API (cPanel) ─────────────────────────────────────────────────────────
async function whmReq(env, fn, params = {}) {
  const token = cfg(env, "WHM_TOKEN");
  const host = cfg(env, "WHM_HOST");
  const port = cfg(env, "WHM_PORT");
  if (!token) return null;

  const qs = new URLSearchParams({ api_version: "1", ...params }).toString();
  try {
    const r = await fetch(`https://${host}:${port}/json-api/${fn}?${qs}`, {
      headers: { Authorization: `whm ${cfg(env, "WHM_USER")}:${token}` },
      signal: AbortSignal.timeout(10000),
    });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function whmListAccounts(env) {
  const r = await whmReq(env, "listaccts");
  if (!r?.data?.acct) return null;
  return r.data.acct.map(a => ({
    username: a.user,
    domain: a.domain,
    diskUsedMB: Math.round((a.diskused || 0)),
    diskLimitMB: Math.round((a.disklimit === "unlimited" ? 0 : a.disklimit || 0)),
    suspended: a.suspended === 1 || a.suspended === "1",
    email: a.email || "",
    plan: a.plan || "",
    created: a.startdate || "",
    client_id: CPANEL_CLIENT_MAP[a.user] || null,
  }));
}

async function whmSuspend(env, username, reason = "Suspended by admin") {
  return whmReq(env, "suspendacct", { user: username, reason });
}

async function whmUnsuspend(env, username) {
  return whmReq(env, "unsuspendacct", { user: username });
}

async function whmDiskUsage(env, username) {
  return whmReq(env, "showbw", { searchtype: "user", search: username });
}

// ─── HTTP CHECK ───────────────────────────────────────────────────────────────
async function checkSvc(svc) {
  const t = Date.now();
  try {
    const r = await fetch(svc.url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
    return { ...svc, status: r.ok || r.status < 400 ? "up" : "degraded", httpStatus: r.status, latency: Date.now() - t };
  } catch (e) {
    return { ...svc, status: "down", httpStatus: 0, latency: Date.now() - t, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTML PAGES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SHARED CSS ───────────────────────────────────────────────────────────────
const CSS = `
  :root{--bg:#0f1117;--bg2:#1a1d27;--bg3:#222535;--border:#2e3147;
    --text:#e2e8f0;--text2:#94a3b8;--accent:#6366f1;
    --green:#22c55e;--yellow:#f59e0b;--red:#ef4444;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;}
  .header{background:linear-gradient(135deg,#1e2035,#16192a);border-bottom:1px solid var(--border);
    padding:14px 28px;display:flex;justify-content:space-between;align-items:center;}
  .logo{display:flex;align-items:center;gap:10px;}
  .logo-icon{width:36px;height:36px;background:var(--accent);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:17px;}
  .logo-text h1{font-size:15px;font-weight:700;}
  .logo-text p{font-size:11px;color:var(--text2);}
  .nav{display:flex;gap:4px;}
  .nav a{padding:6px 14px;border-radius:7px;font-size:13px;font-weight:600;text-decoration:none;color:var(--text2);transition:all .15s;}
  .nav a:hover,.nav a.active{background:rgba(99,102,241,.15);color:#a5b4fc;}
  .nav a.active{border:1px solid rgba(99,102,241,.3);}
  .hdr-right{display:flex;align-items:center;gap:10px;}
  .btn{padding:6px 14px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:none;text-decoration:none;display:inline-flex;align-items:center;gap:5px;}
  .btn-primary{background:var(--accent);color:white;}
  .btn-danger{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);}
  .btn-success{background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);}
  .btn-ghost{background:transparent;color:var(--text2);border:1px solid var(--border);}
  .btn:hover{opacity:.85;}
  .main{max-width:1500px;margin:0 auto;padding:22px 28px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
  .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
  .section{margin-bottom:26px;}
  .sec-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text2);
    margin-bottom:13px;display:flex;align-items:center;gap:8px;}
  .sec-title::after{content:'';flex:1;height:1px;background:var(--border);}
  .card{background:var(--bg2);border:1px solid var(--border);border-radius:11px;overflow:hidden;}
  .card-pad{background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:18px;}
  table{width:100%;border-collapse:collapse;}
  th{background:var(--bg3);padding:9px 14px;text-align:left;font-size:11px;color:var(--text2);font-weight:600;text-transform:uppercase;letter-spacing:.05em;}
  td{padding:10px 14px;border-top:1px solid var(--border);font-size:13px;vertical-align:middle;}
  tr:hover td{background:rgba(99,102,241,.03);}
  td small{color:var(--text2);font-size:11px;}
  .badge{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;}
  .badge.up{background:rgba(34,197,94,.15);color:#22c55e;}
  .badge.down{background:rgba(239,68,68,.15);color:#ef4444;}
  .badge.degraded,.badge.warn{background:rgba(245,158,11,.15);color:#f59e0b;}
  .badge.suspended{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2);}
  .badge.active{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.2);}
  .kpi{background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:16px 18px;}
  .kpi .kpi-val{font-size:28px;font-weight:800;color:white;margin:4px 0;}
  .kpi .kpi-lbl{font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;}
  .kpi .kpi-sub{font-size:12px;color:var(--text2);margin-top:2px;}
  .progress-wrap{margin-top:8px;}
  .progress-bar-bg{background:var(--bg3);border-radius:4px;height:6px;overflow:hidden;}
  .progress-bar{height:6px;border-radius:4px;transition:width .3s;}
  .lat-good{color:#22c55e;font-weight:700;}
  .lat-warn{color:#f59e0b;font-weight:700;}
  .lat-bad{color:#ef4444;font-weight:700;}
  .tag{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;}
  .tag.infra{background:rgba(99,102,241,.2);color:#818cf8;}
  .tag.frontend{background:rgba(34,197,94,.15);color:#4ade80;}
  .tag.backend{background:rgba(245,158,11,.15);color:#fbbf24;}
  .tag.backup{background:rgba(148,163,184,.15);color:#94a3b8;}
  .notice{padding:10px 16px;border-radius:8px;font-size:13px;margin-bottom:14px;}
  .notice.warn{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#fbbf24;}
  .notice.error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;}
  .notice.info{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);color:#a5b4fc;}
  @media(max-width:768px){.main{padding:14px}.grid2,.grid3,.grid4{grid-template-columns:1fr}.nav a span{display:none}}
`;

// ─── SHARED HEADER HTML ───────────────────────────────────────────────────────
function navHtml(activePage, user) {
  return `
  <div class="header">
    <div class="logo">
      <div class="logo-icon">📡</div>
      <div class="logo-text"><h1>D-INFRAS Monitor</h1><p>Infrastructure WORLDEV</p></div>
    </div>
    <nav class="nav">
      <a href="/" class="${activePage === 'dashboard' ? 'active' : ''}">📊 <span>Dashboard</span></a>
      ${user.role === 'admin' ? `<a href="/admin" class="${activePage === 'admin' ? 'active' : ''}">⚙️ <span>Administration</span></a>` : ''}
    </nav>
    <div class="hdr-right">
      <small style="color:var(--text2)">${user.email}</small>
      <a href="/" class="btn btn-ghost" style="padding:5px 10px">🔄</a>
      <a href="/logout" class="btn btn-ghost">Déconnexion</a>
    </div>
  </div>`;
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function loginPage(error = "") {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Connexion — D-INFRAS Monitor</title>
  <style>
    ${CSS}
    body{display:flex;align-items:center;justify-content:center;}
    .login-wrap{width:100%;max-width:400px;padding:20px;}
    .brand{text-align:center;margin-bottom:28px;}
    .brand-icon{width:52px;height:52px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 10px;}
    .brand h1{color:#e2e8f0;font-size:20px;font-weight:800;}
    .brand p{color:#64748b;font-size:12px;margin-top:4px;}
    .login-card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:28px;}
    label{display:block;font-size:12px;color:var(--text2);margin-bottom:5px;font-weight:600;}
    input{width:100%;padding:11px 13px;background:var(--bg);border:1px solid var(--border);border-radius:9px;color:var(--text);font-size:14px;margin-bottom:14px;outline:none;}
    input:focus{border-color:var(--accent);}
    .submit-btn{width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;}
    .submit-btn:hover{opacity:.9;}
    .err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;padding:9px 13px;border-radius:7px;font-size:12px;margin-bottom:13px;text-align:center;}
    .foot{text-align:center;margin-top:18px;font-size:11px;color:#475569;}
  </style></head><body>
  <div class="login-wrap">
    <div class="brand">
      <div class="brand-icon">📡</div>
      <h1>Service Monitor</h1><p>D-INFRAS AFRICA — Infrastructure</p>
    </div>
    <div class="login-card">
      ${error ? `<div class="err">⚠️ ${error}</div>` : ""}
      <form method="POST" action="/login">
        <label>Adresse email</label>
        <input type="email" name="email" placeholder="vous@example.com" required>
        <label>Mot de passe</label>
        <input type="password" name="password" placeholder="••••••••" required>
        <button type="submit" class="submit-btn">Se connecter →</button>
      </form>
    </div>
    <div class="foot">Accès réservé — D-INFRAS AFRICA</div>
  </div></body></html>`;
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────
function dashboardPage(user, services, domains, costs, timestamp) {
  const isAdmin = user.role === "admin";
  const visSvcs = isAdmin ? services : services.filter(s => s.client_id === user.client_id);
  const visDoms = isAdmin ? domains  : domains.filter(d => d.client_id === user.client_id);
  const visCosts = isAdmin ? costs   : costs.filter(c => c.client_id === user.client_id);

  const up   = visSvcs.filter(s => s.status === "up").length;
  const down = visSvcs.filter(s => s.status === "down").length;
  const deg  = visSvcs.filter(s => s.status === "degraded").length;
  const sc   = down > 0 ? "#ef4444" : deg > 0 ? "#f59e0b" : "#22c55e";
  const st   = down > 0 ? `⚠️ ${down} service(s) hors ligne` : deg > 0 ? `⚡ ${deg} dégradé(s)` : "✅ Tous opérationnels";

  const totalUSD  = visCosts.reduce((a,c) => a + c.amount, 0).toFixed(2);
  const totalFCFA = visCosts.reduce((a,c) => a + c.fcfa, 0);

  const svcRows = visSvcs.map(s => {
    const b = s.status === "up" ? `<span class="badge up">● UP</span>` : s.status === "degraded" ? `<span class="badge warn">● DÉGRADÉ</span>` : `<span class="badge down">● DOWN</span>`;
    const lc = s.latency < 500 ? "lat-good" : s.latency < 1500 ? "lat-warn" : "lat-bad";
    return `<tr><td><strong>${s.name}</strong><br><small>${s.category}</small></td><td>${b}</td>
      <td class="${lc}">${s.latency}ms</td><td><code style="background:var(--bg3);padding:2px 5px;border-radius:4px;font-size:11px">${s.httpStatus||"—"}</code></td>
      ${isAdmin ? `<td><small>${s.client_id}</small></td>` : ""}</tr>`;
  }).join("");

  const domRows = visDoms.map(d => {
    const days = daysUntil(d.expires);
    const b = days < 30 ? `<span class="badge down">⚠️ ${days}j</span>` : days < 90 ? `<span class="badge warn">⚡ ${days}j</span>` : `<span class="badge up">✓ ${days}j</span>`;
    return `<tr style="${days < 30 ? 'background:rgba(239,68,68,.05)' : ''}">
      <td><strong>${d.domain}</strong></td><td>${fmtDate(d.expires)}</td><td>${b}</td><td><small>${d.cost}</small></td></tr>`;
  }).join("");

  const costRows = visCosts.map(c => `<tr><td>${c.label}${c.variable ? " <small style='background:rgba(245,158,11,.2);color:#fbbf24;padding:1px 5px;border-radius:3px;font-size:10px'>variable</small>" : ""}</td>
    <td><strong>$${c.amount}</strong></td><td><strong>${c.fcfa.toLocaleString("fr-FR")} FCFA</strong></td>
    <td><span class="tag ${c.type}">${c.type}</span></td></tr>`).join("");

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Dashboard — D-INFRAS Monitor</title>
  <style>${CSS}</style></head><body>
  ${navHtml("dashboard", user)}

  ${isAdmin ? `<div style="background:rgba(99,102,241,.08);border-bottom:1px solid rgba(99,102,241,.2);padding:7px 28px;display:flex;justify-content:space-between;font-size:12px;color:#a5b4fc">
    <span>🔑 <strong>Admin</strong> — Vue globale tous clients</span><span>${visSvcs.length} services surveillés</span></div>` : ""}

  <div style="background:var(--bg2);border-bottom:1px solid var(--border);padding:9px 28px;display:flex;align-items:center;gap:10px;">
    <div style="width:8px;height:8px;border-radius:50%;background:${sc};box-shadow:0 0 7px ${sc};animation:pulse 2s infinite"></div>
    <span style="font-weight:700;color:${sc};font-size:13px">${st}</span>
    <span style="margin-left:auto;font-size:12px;color:var(--text2)">🟢 ${up} UP &nbsp;🟡 ${deg} DÉGRADÉS &nbsp;🔴 ${down} DOWN</span>
    <span style="font-size:11px;color:var(--text2)">${timestamp}</span>
  </div>
  <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}</style>

  <div class="main">
    <div class="section">
      <div class="sec-title">🌐 Services (${visSvcs.length})</div>
      <div class="card"><table>
        <thead><tr><th>Service</th><th>Statut</th><th>Latence</th><th>HTTP</th>${isAdmin ? "<th>Client</th>" : ""}</tr></thead>
        <tbody>${svcRows}</tbody>
      </table></div>
    </div>
    <div class="grid2">
      <div class="section">
        <div class="sec-title">🏷️ Domaines & Expirations</div>
        <div class="card"><table>
          <thead><tr><th>Domaine</th><th>Expiration</th><th>Jours</th><th>Coût</th></tr></thead>
          <tbody>${domRows}</tbody>
        </table></div>
      </div>
      <div class="section">
        <div class="sec-title">💰 Coûts mensuels</div>
        <div class="grid2" style="margin-bottom:12px">
          <div class="kpi"><div class="kpi-lbl">Total infrastructure</div><div class="kpi-val">$${totalUSD}</div><div class="kpi-sub">${totalFCFA.toLocaleString("fr-FR")} FCFA/mois</div></div>
          ${isAdmin ? `<div class="kpi"><div class="kpi-lbl">Facturé M. Bahi</div><div class="kpi-val" style="color:var(--accent)">164 000</div><div class="kpi-sub">FCFA/mois — Contrat 2026-001</div></div>` :
                      `<div class="kpi"><div class="kpi-lbl">Votre forfait</div><div class="kpi-val" style="color:var(--green)">164 000</div><div class="kpi-sub">FCFA/mois tout inclus</div></div>`}
        </div>
        <div class="card"><table>
          <thead><tr><th>Poste</th><th>USD</th><th>FCFA</th><th>Type</th></tr></thead>
          <tbody>${costRows}</tbody>
        </table></div>
      </div>
    </div>
    ${isAdmin ? `<div style="text-align:center;padding:10px 0"><a href="/admin" class="btn btn-primary">⚙️ Aller à l'Administration VPS &amp; Clients →</a></div>` : ""}
  </div>
  </body></html>`;
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
function adminPage(user, vps, metrics, accounts, actionMsg = null) {
  // ── VPS MÉTRIQUES ──
  const vpsState = vps?.state || "unknown";
  const vpsRunning = vpsState === "running";

  // Données depuis l'API Hostinger (structure réelle)
  const cpuTotal  = vps?.cpus || vps?.vcpu_count || 4;
  const ramTotal  = vps?.memory || 8192;  // MB
  const diskTotal = vps?.disk || 100;     // GB

  // Métriques temps réel (si disponibles via /metrics)
  const cpuPct  = metrics?.cpu_usage  ?? metrics?.cpu  ?? null;
  const ramUsed = metrics?.ram_usage  ?? metrics?.memory_used ?? null;   // MB
  const netIn   = metrics?.network_in ?? metrics?.rx_bytes ?? null;
  const netOut  = metrics?.network_out ?? metrics?.tx_bytes ?? null;

  const cpuPctVal  = cpuPct !== null ? Math.round(cpuPct) : null;
  const ramPctVal  = ramUsed !== null ? pct(ramUsed, ramTotal) : null;

  function metricCard(label, icon, value, subtext, progressPct) {
    const pc = progressPct ?? 0;
    const bc = barColor(pc);
    return `<div class="kpi">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div class="kpi-lbl">${icon} ${label}</div>
        ${progressPct !== null ? `<span style="font-size:11px;font-weight:700;color:${bc}">${pc}%</span>` : ""}
      </div>
      <div class="kpi-val">${value}</div>
      <div class="kpi-sub">${subtext}</div>
      ${progressPct !== null ? `<div class="progress-wrap">
        <div class="progress-bar-bg"><div class="progress-bar" style="width:${pc}%;background:${bc}"></div></div>
      </div>` : ""}
    </div>`;
  }

  const vpsMetricsBlock = `
    <div class="card-pad" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:10px;height:10px;border-radius:50%;background:${vpsRunning ? "#22c55e" : "#ef4444"};box-shadow:0 0 8px ${vpsRunning ? "#22c55e" : "#ef4444"}"></div>
        <strong style="font-size:15px">VPS Hostinger — srv1723700.hstgr.cloud</strong>
        <span style="color:var(--text2);font-size:13px">72.60.88.54</span>
        <span class="badge ${vpsRunning ? 'active' : 'suspended'}" style="margin-left:auto">${vpsRunning ? "● EN LIGNE" : "● HORS LIGNE"}</span>
      </div>
      <div class="grid4">
        ${metricCard("CPU", "⚡", cpuPctVal !== null ? `${cpuPctVal}%` : `${cpuTotal} vCPU`, cpuPctVal !== null ? "Charge actuelle" : "AlmaLinux 9", cpuPctVal)}
        ${metricCard("RAM", "💾", ramUsed !== null ? fmtBytes(ramUsed) : `${Math.round(ramTotal/1024)} GB`, `Total: ${Math.round(ramTotal/1024)} GB`, ramPctVal)}
        ${metricCard("Disque NVMe", "💿", `${diskTotal} GB`, "NVMe — AlmaLinux + cPanel Pro", null)}
        ${metricCard("Réseau In", "⬇️", netIn !== null ? `${(netIn/1024/1024).toFixed(1)} MB` : "—", "Trafic entrant", null)}
      </div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--text2);margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <span>📍 France (Paris)</span>
        <span>🏷 AlmaLinux 9 + cPanel/WHM Pro</span>
        <span>💰 $60.98/mois</span>
        <span>⏰ Exp. 01/07/2026</span>
        <span style="color:${vpsRunning ? '#22c55e' : '#ef4444'};font-weight:600">● ${vpsRunning ? "Serveur opérationnel" : "Serveur hors ligne"}</span>
        ${metrics === null && vps !== null ? `<span style="color:#f59e0b">⚠️ Métriques temps réel non disponibles — WHM Token requis</span>` : ""}
      </div>
    </div>`;

  // ── COMPTES CPANEL ──
  const noWhm = accounts === null;

  let whmNotice = "";
  if (noWhm) {
    whmNotice = `<div class="notice warn">
      ⚠️ <strong>API WHM non configurée.</strong> Pour activer la gestion des comptes cPanel, génère un token WHM :
      <br>→ Connecte-toi sur <a href="https://72.60.88.54:2087" target="_blank" style="color:#f59e0b">https://72.60.88.54:2087</a>
      → Development → Manage API Tokens → Create Token
      <br>→ Puis : <code style="background:var(--bg3);padding:2px 6px;border-radius:4px">wrangler secret put WHM_TOKEN</code>
    </div>`;
  }

  // Liste des comptes — si WHM dispo, sinon affiche les comptes connus statiquement
  const staticAccounts = [
    { username: "worldevci", domain: "worldevci.info",  diskUsedMB: 36864, diskLimitMB: 102400, suspended: false, client_id: "worldev",   plan: "25 000 FCFA/mois" },
    { username: "moncga",    domain: "moncga.ci",       diskUsedMB: 782,   diskLimitMB: 10240,  suspended: false, client_id: "worldev",   plan: "25 000 FCFA/mois" },
    { username: "worldev",   domain: "worldev.ci",      diskUsedMB: 4505,  diskLimitMB: 10240,  suspended: false, client_id: "worldev",   plan: "inclus" },
    { username: "akiede",    domain: "akiede.ci",       diskUsedMB: 5521,  diskLimitMB: 10240,  suspended: false, client_id: "akiede",    plan: "25 000 FCFA/mois" },
    { username: "printxi",   domain: "printxi.ci",      diskUsedMB: 347,   diskLimitMB: 5120,   suspended: false, client_id: "printxi",   plan: "25 000 FCFA/mois" },
    { username: "rhdoc",     domain: "rhdoc.africa",    diskUsedMB: 4577,  diskLimitMB: 10240,  suspended: false, client_id: "rhdoc",     plan: "25 000 FCFA/mois" },
    { username: "microtech", domain: "microtech.ci",    diskUsedMB: 347,   diskLimitMB: 5120,   suspended: false, client_id: "microtech", plan: "25 000 FCFA/mois" },
    { username: "uppertech", domain: "upper-techs.africa", diskUsedMB: 1741, diskLimitMB: 10240, suspended: false, client_id: "uppertech", plan: "45 000 FCFA/mois" },
    { username: "dinfrasa",  domain: "d-infras.africa", diskUsedMB: 211,   diskLimitMB: 5120,   suspended: false, client_id: "__admin",   plan: "interne" },
    { username: "dinfras",   domain: "d-infras.com",    diskUsedMB: 18,    diskLimitMB: 5120,   suspended: false, client_id: "__admin",   plan: "interne" },
    { username: "evdh",      domain: "evdh.org",        diskUsedMB: 38,    diskLimitMB: 5120,   suspended: false, client_id: null,        plan: "—" },
    { username: "infoproci", domain: "info-pro.ci",     diskUsedMB: 9,     diskLimitMB: 5120,   suspended: false, client_id: null,        plan: "—" },
    { username: "eic-ci",    domain: "eic-ci.com",      diskUsedMB: 113,   diskLimitMB: 5120,   suspended: false, client_id: null,        plan: "—" },
    { username: "gpemalqowsh", domain: "groupemalqowsh.com", diskUsedMB: 18, diskLimitMB: 5120, suspended: false, client_id: null,        plan: "—" },
  ];

  const displayAccounts = accounts || staticAccounts;
  const totalDiskUsed = displayAccounts.reduce((a, c) => a + (c.diskUsedMB || 0), 0);
  const diskPctTotal = pct(totalDiskUsed, 100 * 1024); // 100 GB total

  const accountRows = displayAccounts.map(a => {
    const dp = a.diskLimitMB > 0 ? pct(a.diskUsedMB, a.diskLimitMB) : 0;
    const bc = barColor(dp);
    const plan = CLIENT_PLANS[a.client_id];
    const diskBar = `<div style="min-width:80px">
      <div style="font-size:12px;font-weight:600;margin-bottom:3px">${fmtBytes(a.diskUsedMB)}${a.diskLimitMB > 0 ? ` / ${fmtBytes(a.diskLimitMB)}` : ''}</div>
      ${a.diskLimitMB > 0 ? `<div class="progress-bar-bg" style="width:80px"><div class="progress-bar" style="width:${dp}%;background:${bc}"></div></div>` : ""}
    </div>`;

    const actionBtn = noWhm ? "" : (a.suspended
      ? `<form method="POST" action="/admin/action" style="display:inline"><input type="hidden" name="action" value="unsuspend"><input type="hidden" name="username" value="${a.username}"><button class="btn btn-success" style="font-size:11px;padding:4px 9px">▶ Réactiver</button></form>`
      : `<form method="POST" action="/admin/action" style="display:inline"><input type="hidden" name="action" value="suspend"><input type="hidden" name="username" value="${a.username}"><button class="btn btn-danger" style="font-size:11px;padding:4px 9px" onclick="return confirm('Suspendre ${a.username} ?')">⏸ Suspendre</button></form>`);

    return `<tr>
      <td>
        <strong>${a.username}</strong><br>
        <small>${a.domain}</small>
      </td>
      <td><span class="badge ${a.suspended ? 'suspended' : 'active'}">${a.suspended ? '⏸ SUSPENDU' : '● ACTIF'}</span></td>
      <td>${diskBar}</td>
      <td>
        ${a.client_id ? `<span style="font-size:12px;color:var(--accent);font-weight:600">${a.client_id}</span>` : `<span style="color:var(--text2);font-size:12px">—</span>`}
        ${plan ? `<br><small>${plan.fcfa > 0 ? plan.fcfa.toLocaleString("fr-FR") + " FCFA/mois" : plan.label}</small>` : ""}
      </td>
      <td>${actionBtn || (noWhm ? '<small style="color:var(--text2)">WHM requis</small>' : "")}</td>
    </tr>`;
  }).join("");

  // KPIs résumé comptes
  const totalAccounts = displayAccounts.length;
  const activeAccounts = displayAccounts.filter(a => !a.suspended).length;
  const suspendedAccounts = displayAccounts.filter(a => a.suspended).length;
  const billableAccounts = displayAccounts.filter(a => {
    const p = CLIENT_PLANS[a.client_id];
    return p && p.fcfa > 0;
  }).length;
  const totalRevenue = Object.values(CLIENT_PLANS).reduce((a, p) => a + p.fcfa, 0);

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Administration — D-INFRAS Monitor</title>
  <style>${CSS}
    .disk-warn{color:#f59e0b} .disk-critical{color:#ef4444}
  </style></head><body>
  ${navHtml("admin", user)}
  <div style="background:rgba(99,102,241,.08);border-bottom:1px solid rgba(99,102,241,.2);padding:7px 28px;display:flex;gap:16px;font-size:12px;color:#a5b4fc">
    <span>🔑 <strong>Administration</strong> — Accès réservé admin</span>
    <span style="margin-left:auto">VPS : 72.60.88.54 — cPanel/WHM Pro — AlmaLinux 9</span>
  </div>

  <div class="main">

    ${actionMsg ? `<div class="notice ${actionMsg.type}">${actionMsg.text}</div>` : ""}

    <!-- MÉTRIQUES VPS -->
    <div class="section">
      <div class="sec-title">🖥️ Métriques Serveur VPS Hostinger</div>
      ${vps ? vpsMetricsBlock : `<div class="notice warn">⚠️ API Hostinger non disponible — vérifier le token (expire 01/07/2026). <a href="https://hpanel.hostinger.com" target="_blank" style="color:#f59e0b">Renouveler →</a></div>`}
    </div>

    <!-- KPIs COMPTES -->
    <div class="section">
      <div class="sec-title">📊 Vue d'ensemble comptes cPanel</div>
      <div class="grid4">
        <div class="kpi"><div class="kpi-lbl">📂 Comptes total</div><div class="kpi-val">${totalAccounts}</div><div class="kpi-sub">sur le VPS 72.60.88.54</div></div>
        <div class="kpi"><div class="kpi-lbl">✅ Comptes actifs</div><div class="kpi-val" style="color:var(--green)">${activeAccounts}</div><div class="kpi-sub">${suspendedAccounts} suspendu(s)</div></div>
        <div class="kpi">
          <div class="kpi-lbl">💿 Disque utilisé</div>
          <div class="kpi-val">${fmtBytes(totalDiskUsed)}</div>
          <div class="kpi-sub">/ 100 GB NVMe</div>
          <div class="progress-wrap"><div class="progress-bar-bg"><div class="progress-bar" style="width:${diskPctTotal}%;background:${barColor(diskPctTotal)}"></div></div></div>
        </div>
        <div class="kpi"><div class="kpi-lbl">💰 Revenus héb. mensuel</div><div class="kpi-val" style="color:var(--accent)">${totalRevenue.toLocaleString("fr-FR")}</div><div class="kpi-sub">FCFA/mois (${billableAccounts} clients facturés)</div></div>
      </div>
    </div>

    <!-- GESTION COMPTES CPANEL -->
    <div class="section">
      <div class="sec-title">👥 Gestion Comptes cPanel — ${noWhm ? "Données statiques (WHM token requis pour actions)" : "Données live via WHM"}</div>
      ${whmNotice}
      <div class="card">
        <table>
          <thead><tr>
            <th>Compte / Domaine</th>
            <th>Statut</th>
            <th>Espace disque</th>
            <th>Client / Forfait</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>${accountRows}</tbody>
        </table>
      </div>
      ${noWhm ? "" : `<div style="margin-top:10px;font-size:12px;color:var(--text2)">
        💡 Les actions de suspension/réactivation sont exécutées via l'API WHM directement sur le serveur.
      </div>`}
    </div>

    <!-- STATUT SERVICES cPanel -->
    <div class="section">
      <div class="sec-title">⚙️ Services Système cPanel/WHM</div>
      <div class="notice info">ℹ️ Ces vérifications nécessitent le token WHM pour accéder à l'API <code>/servicemanager</code>. Statut estimé basé sur les checks HTTP des domaines.</div>
      <div class="grid4">
        ${[
          { name: "Apache (HTTP/HTTPS)", icon: "🌐", port: "80/443" },
          { name: "MySQL / MariaDB",     icon: "🗄️", port: "3306"   },
          { name: "Exim (Mail)",         icon: "📧", port: "25/587"  },
          { name: "cPanel/WHM",          icon: "🖥️", port: "2083/2087" },
        ].map(s => `<div class="kpi">
          <div class="kpi-lbl">${s.icon} ${s.name}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span class="badge ${noWhm ? 'warn' : 'active'}">${noWhm ? '? INCONNU' : '● ACTIF'}</span>
          </div>
          <div class="kpi-sub" style="margin-top:6px">Port ${s.port}</div>
        </div>`).join("")}
      </div>
    </div>

    <!-- LIEN RAPIDES ADMIN -->
    <div class="section">
      <div class="sec-title">🔗 Accès rapides</div>
      <div class="grid4">
        ${[
          { label: "WHM Root",   url: "https://72.60.88.54:2087",  icon: "🖥️", desc: "Gestion serveur complet" },
          { label: "cPanel WORLDEV", url: "https://cpanel.worldev.ci", icon: "📁", desc: "Compte worldev.ci" },
          { label: "Hostinger Panel", url: "https://hpanel.hostinger.com", icon: "☁️", desc: "API Token / Facturation" },
          { label: "Cloudflare",  url: "https://dash.cloudflare.com", icon: "🔥", desc: "DNS + Workers + R2" },
        ].map(l => `<a href="${l.url}" target="_blank" class="card-pad" style="display:block;text-decoration:none;color:var(--text);cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-size:20px;margin-bottom:6px">${l.icon}</div>
          <div style="font-weight:700;font-size:13px">${l.label}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px">${l.desc}</div>
        </a>`).join("")}
      </div>
    </div>

  </div>
  </body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const secret = cfg(env, "SESSION_SECRET");

    // ── LOGOUT ──
    if (url.pathname === "/logout") {
      return new Response(null, { status: 302, headers: {
        Location: "/login",
        "Set-Cookie": "dinfras_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
      }});
    }

    // ── LOGIN ──
    if (url.pathname === "/login") {
      if (request.method === "GET") return html(loginPage());
      const form = await request.formData();
      const email = form.get("email")?.trim().toLowerCase();
      const password = form.get("password");
      if (!email || !password) return html(loginPage("Email et mot de passe requis."), 400);
      const user = await findUser(env, email);
      if (!user || (await hashPwd(password)) !== user.password_hash)
        return html(loginPage("Identifiants incorrects."), 401);
      const token = await createToken(user, secret);
      return new Response(null, { status: 302, headers: {
        Location: "/",
        "Set-Cookie": `dinfras_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
      }});
    }

    // ── AUTH ──
    const session = getSession(request);
    const user = session ? await verifyToken(session, secret) : null;
    if (!user) return new Response(null, { status: 302, headers: { Location: "/login" } });

    // ── ADMIN ACTION (suspend/unsuspend) ──
    if (url.pathname === "/admin/action" && request.method === "POST") {
      if (user.role !== "admin") return new Response("Accès refusé", { status: 403 });
      const form = await request.formData();
      const action = form.get("action");
      const username = form.get("username");
      let msg;
      if (action === "suspend") {
        const r = await whmSuspend(env, username, "Suspendu depuis D-INFRAS Monitor");
        msg = r ? { type: "info", text: `✅ Compte <strong>${username}</strong> suspendu avec succès.` }
                : { type: "error", text: `❌ Échec suspension de <strong>${username}</strong>. Vérifier le token WHM.` };
      } else if (action === "unsuspend") {
        const r = await whmUnsuspend(env, username);
        msg = r ? { type: "info", text: `✅ Compte <strong>${username}</strong> réactivé avec succès.` }
                : { type: "error", text: `❌ Échec réactivation de <strong>${username}</strong>.` };
      }
      // Recharger la page admin avec message
      const [vps, accounts] = await Promise.all([hostingerVPS(env), whmListAccounts(env)]);
      const metrics = vps?.id ? await hostingerMetrics(env, vps.id) : null;
      return html(adminPage(user, vps, metrics, accounts, msg));
    }

    // ── ADMIN PAGE ──
    if (url.pathname === "/admin") {
      if (user.role !== "admin") return new Response(null, { status: 302, headers: { Location: "/" } });
      const [vps, accounts] = await Promise.all([hostingerVPS(env), whmListAccounts(env)]);
      const metrics = vps?.id ? await hostingerMetrics(env, vps.id) : null;
      return html(adminPage(user, vps, metrics, accounts));
    }

    // ── API ENDPOINTS ──
    if (url.pathname === "/api/vps") {
      if (user.role !== "admin") return json({ error: "Accès refusé" }, 403);
      const vps = await hostingerVPS(env);
      const metrics = vps?.id ? await hostingerMetrics(env, vps.id) : null;
      return json({ vps, metrics });
    }
    if (url.pathname === "/api/cpanel/accounts") {
      if (user.role !== "admin") return json({ error: "Accès refusé" }, 403);
      return json({ accounts: await whmListAccounts(env) });
    }
    if (url.pathname === "/api/status") {
      const filter = user.role === "admin" ? null : user.client_id;
      const svcs = filter ? SERVICES.filter(s => s.client_id === filter) : SERVICES;
      return json({ services: await Promise.all(svcs.map(checkSvc)) });
    }

    // ── DASHBOARD ──
    const svcs = await Promise.all(SERVICES.map(checkSvc));
    const ts = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return html(dashboardPage(user, svcs, DOMAINS, COSTS, ts));
  },
};

function html(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" } });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}
