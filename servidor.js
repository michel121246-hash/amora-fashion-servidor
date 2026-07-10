const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
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

// ── CONFIG ────────────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {}
  try {
    if (process.env.AMORA_CONFIG) return JSON.parse(process.env.AMORA_CONFIG);
  } catch (e) {}
  return { meses: {}, usuarios: [], wapp: {}, updatedAt: null };
}

function saveConfig(data) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(data), 'utf8'); return true; } catch (e) { return false; }
}

function authCheck(req, res) {
  const secret = req.headers['x-config-secret'] || req.query.secret;
  if (secret !== CONFIG_SECRET) { res.status(401).json({ error: 'Não autorizado' }); return false; }
  return true;
}

// ── FRASES MOTIVACIONAIS ──────────────────────────────────
const FRASES = [
  "Acredite no seu potencial — você é capaz de muito mais do que imagina! 🌟",
  "Cada cliente que você atende com amor é uma semente plantada para o sucesso! 🌱",
  "O sucesso não é um acidente. É trabalho duro, persistência e amor pelo que faz! 💪",
  "Você tem o poder de transformar o dia de alguém com seu sorriso e dedicação! ✨",
  "Cada 'não' te aproxima de um 'sim'. Continue persistindo, você vai conseguir! 🎯",
  "Grandes conquistas começam com pequenos passos. Cada venda conta! 👣",
  "Você foi feita para brilhar! Mostre o seu melhor hoje! 💎",
  "A confiança é a sua maior ferramenta de venda. Confie em si mesma! 🦋",
  "Hoje é um novo dia cheio de oportunidades. Aproveite cada uma delas! 🌅",
  "Sua dedicação inspira toda a equipe. Continue sendo incrível! 🏆",
  "O limite é a sua mente. E a sua mente não tem limites! 🚀",
  "Cada cliente satisfeito é uma prova do seu talento. Continue assim! 💫",
  "Você não está apenas vendendo roupas, está ajudando pessoas a se sentirem bem! 👗",
  "A persistência é o segredo dos que vencem. Não desista nunca! 🌊",
  "Seja a melhor versão de você mesma hoje. O sucesso te espera! ⭐",
  "O seu esforço de hoje é o seu resultado de amanhã. Vai com tudo! 🔥",
  "Acredite, sorria e conquiste! Você tem tudo para ser campeã! 🏅",
  "Uma atitude positiva pode transformar qualquer situação. Sorria e venda! 😊",
  "Você é mais forte do que os seus desafios. Enfrente o dia com coragem! 💪",
  "Sucesso é a soma de pequenos esforços repetidos dia após dia. Você está no caminho! 📈",
  "Sua energia e entusiasmo são contagiantes. Espalhe isso hoje! ✨",
  "Não espere a motivação chegar — você já tem tudo dentro de si! 💡",
  "Cada dia é uma nova chance de superar a si mesma. Use bem! 🎯",
  "O seu sorriso é o melhor produto que você pode oferecer! 😃",
  "Pessoas determinadas criam o próprio sucesso. Seja essa pessoa! 🌟",
  "Você tem talento, garra e determinação. Hoje vai ser um dia incrível! 🦋",
  "A sua dedicação à Amora Fashion é o que nos faz crescer juntas! 💜",
  "Mire alto, trabalhe forte e colha os resultados. Você merece! 🏆",
  "Cada venda é uma vitória. Celebre cada conquista, grande ou pequena! 🎉",
  "Você é a força da Amora Fashion. Continue brilhando! ✨",
  "Hoje é dia de superar suas metas e mostrar de que você é capaz! 🚀",
];

function getFraseHoje() {
  const dia = new Date().getDate();
  return FRASES[(dia - 1) % FRASES.length];
}

// ── HELPERS HTTP ──────────────────────────────────────────
function httpPost(hostname, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    };
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(d); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { hostname, path, method: 'GET', headers };
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(d); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── GESTÃO CLICK ──────────────────────────────────────────
async function fetchGC(endpoint, params, tokens) {
  const qs = new URLSearchParams(params).toString();
  const path = `/api/${endpoint}${qs ? '?' + qs : ''}`;
  return httpGet('api.gestaoclick.com', path, {
    'access-token': tokens.at,
    'secret-access-token': tokens.st,
    'Content-Type': 'application/json'
  });
}

async function fetchTodasVendas(params, tokens) {
  let todas = [], pagina = 1;
  while (true) {
    const res = await fetchGC('vendas', { ...params, pagina, registros_por_pagina: 200 }, tokens);
    const lista = res?.data || res?.vendas || [];
    if (!lista.length) break;
    todas = todas.concat(lista);
    if (lista.length < 200) break;
    pagina++;
  }
  return todas;
}

// ── CÁLCULO DE METAS ──────────────────────────────────────
function fmtDate(d) {
  const dt = d || new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function diasUteisRestantes(ano, mes, feriados = []) {
  const hoje = new Date();
  const dh = hoje.getDate();
  const dim = new Date(ano, mes, 0).getDate();
  const refStr = fmtDate(hoje);
  const ferSet = new Set(Array.isArray(feriados) ? feriados.filter(f => f >= refStr) : []);
  let rest = 0;
  for (let d = dh; d <= dim; d++) {
    const ds = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (new Date(ano, mes - 1, d).getDay() !== 0 && !ferSet.has(ds)) rest++;
  }
  return Math.max(rest, 1);
}

function valVenda(v) {
  const pags = v.pagamentos || [];
  if (pags.length > 0) return pags.reduce((s, p) => s + parseFloat((p.pagamento || p).valor || (p.pagamento || p).valor_total || 0), 0);
  if (parseInt(v.situacao_financeiro || 1) === 0) return 0;
  return parseFloat(v.valor_total || 0);
}

function ativas(lista) {
  return lista.filter(v => {
    const s = (v.nome_situacao || '').toLowerCase().trim();
    return !s.includes('cancelad') && !s.includes('rascunho') && s !== 'em aberto';
  });
}

function brl(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function calcMetaDiaVendedora(nome, vendas, metaMes, diasRestantes) {
  const hoje = fmtDate();
  const atOntem = ativas(vendas).filter(v =>
    (v.nome_vendedor || '').toUpperCase() === nome.toUpperCase() &&
    (v.data || '').substring(0, 10) < hoje
  );
  const vendidoOntem = atOntem.reduce((s, v) => s + valVenda(v), 0);
  const saldo = Math.max(metaMes - vendidoOntem, 0);
  const metaDia = diasRestantes > 0 ? saldo / diasRestantes : 0;
  const hoje_v = ativas(vendas).filter(v =>
    (v.nome_vendedor || '').toUpperCase() === nome.toUpperCase() &&
    (v.data || '').substring(0, 10) === hoje
  );
  const vendidoHoje = hoje_v.reduce((s, v) => s + valVenda(v), 0);
  const acumulado = ativas(vendas).filter(v =>
    (v.nome_vendedor || '').toUpperCase() === nome.toUpperCase()
  ).reduce((s, v) => s + valVenda(v), 0);
  return { metaDia, vendidoHoje, vendidoOntem, acumulado, saldo, bateu: vendidoOntem >= metaMes };
}

// ── Z-API ─────────────────────────────────────────────────
async function enviarWhatsApp(wappConfig, phone, message) {
  const { instanceUrl, token, instanceToken } = wappConfig;
  if (!instanceUrl || !phone) throw new Error('URL da instância UaZAPI não configurada');
  const authToken = instanceToken || token; // usa instanceToken se disponível
  if (!authToken) throw new Error('Token da instância UaZAPI não configurado');
  const phoneNum = phone.replace(/\D/g, '');
  const baseUrl = instanceUrl.startsWith('http') ? instanceUrl : 'https://' + instanceUrl;
  const url = new URL('/message/sendText', baseUrl);
  // UaZAPI: POST /message/sendText com header token (instance token)
  return httpPostFull(url, { phone: phoneNum, message }, { token: authToken });
}

function httpPostFull(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({ raw: d, status: res.statusCode }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── CONSTRUIR MENSAGENS ───────────────────────────────────
function buildMsgVendedora(user, metaDia, acumulado, vendidoOntem, metaBronze, metaPrata, metaOuro, diasRestantes, frase) {
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const pctBronze = metaBronze > 0 ? Math.min((acumulado / metaBronze * 100), 100).toFixed(0) : 0;
  const faltaBronze = Math.max(metaBronze - acumulado, 0);
  const faltaPrata  = metaPrata > 0 ? Math.max(metaPrata - acumulado, 0) : null;
  const faltaOuro   = metaOuro  > 0 ? Math.max(metaOuro  - acumulado, 0) : null;

  let metasLinhas = `🥉 Bronze: falta *${brl(faltaBronze)}*`;
  if (faltaPrata !== null) metasLinhas += `\n🥈 Prata:  falta *${brl(faltaPrata)}*`;
  if (faltaOuro  !== null) metasLinhas += `\n🥇 Ouro:   falta *${brl(faltaOuro)}*`;

  return `🌅 *Bom dia, ${user.nome.split(' ')[0]}!* ✨
${dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)}

_"${frase}"_

━━━━━━━━━━━━━━━━━
🎯 *META DE HOJE*
Você precisa vender *${brl(metaDia)}*

📦 *ONTEM você vendeu:* ${brl(vendidoOntem)}

━━━━━━━━━━━━━━━━━
📊 *SEU MÊS — ${diasRestantes} dias úteis restantes*
Acumulado: *${brl(acumulado)}* (${pctBronze}% da Bronze)

${metasLinhas}

━━━━━━━━━━━━━━━━━
💜 *Amora Fashion acredita em você!*
Vai com tudo hoje! 🚀`;
}


function buildMsgGerente(user, vendas, cfg, diasRestantes, frase) {
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const nv = Math.max(cfg.numVend || 4, 1);
  const fatTotal = ativas(vendas).reduce((s, v) => s + valVenda(v), 0);
  const pctBronze = cfg.bronze > 0 ? Math.min((fatTotal / cfg.bronze * 100), 100).toFixed(0) : 0;
  const faltaBronze = Math.max((cfg.bronze || 0) - fatTotal, 0);

  // Ranking vendedoras
  const agr = {};
  ativas(vendas).forEach(v => {
    const n = v.nome_vendedor || 'Sem vendedor';
    if (!agr[n]) agr[n] = 0;
    agr[n] += valVenda(v);
  });
  const ranking = Object.entries(agr).sort((a, b) => b[1] - a[1]);
  const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  const rankingTexto = ranking.map(([nome, total], i) => {
    const metaVend = (cfg.bronze || 0) / nv;
    const metaDiaVend = calcMetaDiaVendedora(nome, vendas, metaVend, diasRestantes);
    return `${emojis[i] || `${i + 1}.`} ${nome.split(' ')[0]}: *${brl(total)}* | Meta dia: ${brl(metaDiaVend.metaDia)}`;
  }).join('\n');

  return `🌅 *Bom dia, ${user.nome.split(' ')[0]}!* 📊
${dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)}

_"${frase}"_

━━━━━━━━━━━━━━━━━
🏪 *RESUMO DA LOJA*
Acumulado mês: *${brl(fatTotal)}*
🥉 Meta Bronze: ${brl(cfg.bronze || 0)} (${pctBronze}%)
Falta Bronze: *${brl(faltaBronze)}*
Meta do dia loja: *${brl(faltaBronze / diasRestantes)}*
Dias restantes: ${diasRestantes} dias

━━━━━━━━━━━━━━━━━
👥 *RANKING DE HOJE*
${rankingTexto}

💜 *Amora Fashion*
Boa sorte para toda a equipe! 🚀`;
}

// ── ENVIO PRINCIPAL ───────────────────────────────────────
let logEnvios = [];

async function executarEnvioManha(forcarAgora = false) {
  const config = loadConfig();
  const wapp = config.wapp || {};
  const usuarios = config.usuarios || [];
  const meses = config.meses || {};
  const gcTokens = { at: wapp.gcAt || process.env.GC_ACCESS_TOKEN, st: wapp.gcSt || process.env.GC_SECRET_TOKEN };
  const lojaId = wapp.lojaId || process.env.LOJA_ID || '364514';

  if (!wapp.instanceUrl || !wapp.token) {
    console.log('WhatsApp: credenciais UaZAPI não configuradas');
    return { ok: false, erro: 'Credenciais UaZAPI não configuradas' };
  }
  if (!gcTokens.at || !gcTokens.st) {
    console.log('WhatsApp: tokens Gestão Click não configurados');
    return { ok: false, erro: 'Tokens Gestão Click não configurados' };
  }

  // Busca vendas do mês atual
  const hoje = new Date();
  const mesIni = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const mesFim = fmtDate(hoje);
  const cfgMesKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const cfgMes = meses[cfgMesKey] || { bronze: 0, prata: 0, ouro: 0, numVend: 4, feriados: [] };
  const nv = Math.max(cfgMes.numVend || 4, 1);
  const dr = diasUteisRestantes(hoje.getFullYear(), hoje.getMonth() + 1, cfgMes.feriados || []);
  const frase = getFraseHoje();

  let vendas = [];
  try {
    vendas = await fetchTodasVendas({ data_inicio: mesIni, data_fim: mesFim, tipo: 'vendas_balcao', loja_id: lojaId }, gcTokens);
  } catch (e) {
    console.error('Erro ao buscar vendas GC:', e.message);
    return { ok: false, erro: 'Erro ao buscar vendas: ' + e.message };
  }

  const resultados = [];
  const frase_dia = frase;

  for (const user of usuarios) {
    if (!user.phone) continue;

    let msg, tipo;
    if (user.role === 'gerente' || user.role === 'admin') {
      // Gerente/Admin: resumo completo da loja
      msg = buildMsgGerente(user, vendas, cfgMes, dr, frase_dia);
      tipo = 'gerente';
    } else if (user.gcNome && user.role === 'vendedora') {
      // Vendedora: meta individual
      const metaVend = cfgMes.bronze > 0 ? cfgMes.bronze / nv : 0;
      const metaPrata = cfgMes.prata > 0 ? cfgMes.prata / nv : 0;
      const metaOuro = cfgMes.ouro > 0 ? cfgMes.ouro / nv : 0;
      const dados = calcMetaDiaVendedora(user.gcNome, vendas, metaVend, dr);
      msg = buildMsgVendedora(user, dados.metaDia, dados.acumulado, dados.vendidoAteOntem, metaVend, metaPrata, metaOuro, dr, frase_dia);
      tipo = 'vendedora';
    } else continue;

    try {
      const resp = await enviarWhatsApp(wapp, user.phone, msg);
      resultados.push({ nome: user.nome, phone: user.phone, tipo, ok: true, resp });
      console.log(`✅ Mensagem enviada para ${user.nome} (${user.phone})`);
    } catch (e) {
      resultados.push({ nome: user.nome, phone: user.phone, tipo, ok: false, erro: e.message });
      console.error(`❌ Erro ao enviar para ${user.nome}:`, e.message);
    }

    // Aguarda 1s entre envios para não sobrecarregar Z-API
    await new Promise(r => setTimeout(r, 1000));
  }

  const log = { data: new Date().toISOString(), resultados, totalEnviados: resultados.filter(r => r.ok).length, total: resultados.length };
  logEnvios.unshift(log);
  if (logEnvios.length > 10) logEnvios = logEnvios.slice(0, 10);

  return { ok: true, ...log };
}

// ── CRON — 08:00 Brasília = 11:00 UTC, Seg-Sáb ──────────
cron.schedule('30 8 * * 1-6', () => {
  console.log('🕗 Cron: enviando mensagens matinais...');
  executarEnvioManha().then(r => console.log('Cron resultado:', r.totalEnviados, '/', r.total, 'enviados'));
}, { timezone: 'America/Sao_Paulo' });

// ── ENDPOINTS WHATSAPP ────────────────────────────────────
app.post('/whatsapp/enviar', async (req, res) => {
  if (!authCheck(req, res)) return;
  console.log('📲 Envio manual solicitado');
  const resultado = await executarEnvioManha(true);
  res.json(resultado);
});

app.get('/whatsapp/status', (req, res) => {
  if (!authCheck(req, res)) return;
  res.json({ ok: true, logs: logEnvios, proximoEnvio: 'Diariamente às 08:00 (Brasília), Seg-Sáb' });
});

app.post('/whatsapp/teste', async (req, res) => {
  if (!authCheck(req, res)) return;
  const { phone, nome } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone obrigatório' });
  const config = loadConfig();
  const wapp = config.wapp || {};
  const frase = getFraseHoje();
  const msg = `🌟 *Teste - Amora Fashion Painel*\n\nOlá${nome ? ', ' + nome.split(' ')[0] : ''}! Este é um teste de notificação do painel.\n\n_"${frase}"_\n\n💜 Sistema configurado com sucesso!`;
  try {
    const resp = await enviarWhatsApp(wapp, phone, msg);
    res.json({ ok: true, resp });
  } catch (e) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

// ── CONFIG ENDPOINTS ──────────────────────────────────────
app.get('/config', (req, res) => {
  if (!authCheck(req, res)) return;
  const config = loadConfig();
  // Não retorna credenciais Z-API no GET por segurança
  const safeConfig = { ...config };
  if (safeConfig.wapp) {
    safeConfig.wapp = { ...safeConfig.wapp, token: safeConfig.wapp.token ? '***' : '', clientToken: safeConfig.wapp.clientToken ? '***' : '' };
  }
  res.json({ ok: true, data: config, updatedAt: config.updatedAt });
});

app.post('/config', (req, res) => {
  if (!authCheck(req, res)) return;
  const { meses, usuarios, wapp } = req.body;
  if (!meses && !usuarios && !wapp) return res.status(400).json({ error: 'Payload inválido' });
  const current = loadConfig();
  const updated = {
    meses: meses !== undefined ? meses : current.meses,
    usuarios: usuarios !== undefined ? usuarios : current.usuarios,
    wapp: wapp !== undefined ? { ...current.wapp, ...wapp } : current.wapp,
    updatedAt: new Date().toISOString()
  };
  const ok = saveConfig(updated);
  if (ok) res.json({ ok: true, updatedAt: updated.updatedAt });
  else res.status(500).json({ error: 'Falha ao salvar' });
});

app.get('/config/status', (req, res) => {
  const config = loadConfig();
  res.json({ updatedAt: config.updatedAt || null });
});

// ── PROXY GESTÃO CLICK ────────────────────────────────────
app.get('/api/:endpoint', (req, res) => {
  const { endpoint } = req.params;
  const accessToken = req.headers['access-token'];
  const secretToken = req.headers['secret-access-token'];
  if (!accessToken || !secretToken) return res.status(400).json({ error: 'Tokens ausentes' });
  const queryString = new URLSearchParams(req.query).toString();
  const targetPath = `/api/${endpoint}${queryString ? '?' + queryString : ''}`;
  const options = {
    hostname: 'api.gestaoclick.com', path: targetPath, method: 'GET',
    headers: { 'access-token': accessToken, 'secret-access-token': secretToken, 'Content-Type': 'application/json' }
  };
  const proxyReq = https.request(options, (proxyRes) => {
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => { res.status(proxyRes.statusCode).set('Content-Type', 'application/json').send(body); });
  });
  proxyReq.on('error', (e) => res.status(500).json({ error: e.message }));
  proxyReq.end();
});

app.get('/', (req, res) => res.json({ service: 'Amora Fashion Proxy + WhatsApp', status: 'ok', version: '3.0' }));

app.listen(PORT, () => console.log(`Amora Fashion servidor rodando na porta ${PORT}`));
