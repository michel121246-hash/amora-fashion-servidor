const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CONFIG FILE PATH ──────────────────────────────────────
// Railway tem sistema de arquivos efêmero — usamos variável de ambiente
// como fallback para persistência entre deploys via Railway Volumes ou env var
const CONFIG_FILE = path.join('/tmp', 'amora_config.json');
const CONFIG_SECRET = process.env.CONFIG_SECRET || 'amora2026';

// ── MIDDLEWARES ───────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, access-token, secret-access-token, x-config-secret');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── HELPERS ───────────────────────────────────────────────
function loadConfig() {
  // Tenta arquivo local primeiro
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {}
  // Tenta variável de ambiente (fallback para persistência entre deploys)
  try {
    if (process.env.AMORA_CONFIG) {
      return JSON.parse(process.env.AMORA_CONFIG);
    }
  } catch (e) {}
  return { meses: {}, usuarios: [], updatedAt: null };
}

function saveConfig(data) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data), 'utf8');
    return true;
  } catch (e) {
    console.error('Erro ao salvar config:', e.message);
    return false;
  }
}

function authCheck(req, res) {
  const secret = req.headers['x-config-secret'] || req.query.secret;
  if (secret !== CONFIG_SECRET) {
    res.status(401).json({ error: 'Não autorizado' });
    return false;
  }
  return true;
}

// ── CONFIG ENDPOINTS ──────────────────────────────────────

// GET /config — carrega configurações
app.get('/config', (req, res) => {
  if (!authCheck(req, res)) return;
  const config = loadConfig();
  res.json({ ok: true, data: config, updatedAt: config.updatedAt });
});

// POST /config — salva configurações completas
app.post('/config', (req, res) => {
  if (!authCheck(req, res)) return;
  const { meses, usuarios } = req.body;
  if (!meses && !usuarios) {
    return res.status(400).json({ error: 'Payload inválido: envie meses e/ou usuarios' });
  }
  const current = loadConfig();
  const updated = {
    meses: meses !== undefined ? meses : current.meses,
    usuarios: usuarios !== undefined ? usuarios : current.usuarios,
    updatedAt: new Date().toISOString()
  };
  const ok = saveConfig(updated);
  if (ok) {
    res.json({ ok: true, updatedAt: updated.updatedAt });
  } else {
    res.status(500).json({ error: 'Falha ao salvar configurações' });
  }
});

// GET /config/status — verifica timestamp da última atualização (sem auth)
app.get('/config/status', (req, res) => {
  const config = loadConfig();
  res.json({ updatedAt: config.updatedAt || null });
});

// ── PROXY GESTÃO CLICK ────────────────────────────────────
app.get('/api/:endpoint', (req, res) => {
  const { endpoint } = req.params;
  const accessToken = req.headers['access-token'];
  const secretToken = req.headers['secret-access-token'];

  if (!accessToken || !secretToken) {
    return res.status(400).json({ error: 'Tokens de autenticação ausentes' });
  }

  const queryString = new URLSearchParams(req.query).toString();
  const targetPath = `/api/${endpoint}${queryString ? '?' + queryString : ''}`;

  const options = {
    hostname: 'api.gestaoclick.com',
    path: targetPath,
    method: 'GET',
    headers: {
      'access-token': accessToken,
      'secret-access-token': secretToken,
      'Content-Type': 'application/json'
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => {
      res.status(proxyRes.statusCode);
      res.set('Content-Type', 'application/json');
      res.send(body);
    });
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e.message);
    res.status(500).json({ error: 'Erro no proxy: ' + e.message });
  });

  proxyReq.end();
});

// ── HEALTH CHECK ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'Amora Fashion Proxy',
    status: 'ok',
    endpoints: ['GET /api/:endpoint', 'GET /config', 'POST /config', 'GET /config/status']
  });
});

app.listen(PORT, () => {
  console.log(`Amora Fashion Proxy rodando na porta ${PORT}`);
});
