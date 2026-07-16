const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join('/tmp', 'amora_config.json');
const CONFIG_SECRET = process.env.CONFIG_SECRET || '7e043f3f7993257de9698541de1cb73969b3ae5eb46d0d4ccfe4e1499da4d1fa';

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

//
// ── IA — ANÁLISE DIÁRIA ──────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
let relatorioIA = null;

async function gerarAnaliseIA(dados) {
  const { vendas, cfg, dr } = dados;
  const nv = Math.max(cfg.numVend || 4, 1);
  const hoje = new Date();
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  const ontemStr = fmtDate(ontem);
  const agrMes = {}, agrOntem = {};
  ativas(vendas).forEach(v => {
    const n = v.nome_vendedor || 'Sem vendedor';
    const val = valVenda(v);
    const prods = (v.produtos||[]).length || 1;
    if (!agrMes[n]) agrMes[n] = { total:0, qtd:0, prods:0 };
    agrMes[n].total += val; agrMes[n].qtd++; agrMes[n].prods += prods;
    if ((v.data||'').substring(0,10) === ontemStr) {
      if (!agrOntem[n]) agrOntem[n] = { total:0, qtd:0, prods:0 };
      agrOntem[n].total += val; agrOntem[n].qtd++; agrOntem[n].prods += prods;
    }
  });
  const fatMes = Object.values(agrMes).reduce((s,v)=>s+v.total,0);
  const fatOntem = Object.values(agrOntem).reduce((s,v)=>s+v.total,0);
  const faltaBronze = Math.max((cfg.bronze||0) - fatMes, 0);
  const metaDia = dr > 0 ? faltaBronze / dr : 0;
  const rankMes = Object.entries(agrMes).sort((a,b)=>b[1].total-a[1].total).slice(0,6);
  const resumoVend = rankMes.map(([nome, d], i) => {
    const ticket = d.qtd > 0 ? Math.round(d.total/d.qtd) : 0;
    const itens = d.qtd > 0 ? (d.prods/d.qtd).toFixed(1) : 0;
    const ov = agrOntem[nome] || { total:0, qtd:0 };
    const pct = cfg.bronze > 0 ? Math.round(d.total/(cfg.bronze/nv)*100) : 0;
    return (i+1)+'. '+nome+': Mes R$'+Math.round(d.total)+' ('+pct+'%) | Ontem R$'+Math.round(ov.total)+'('+ov.qtd+' vendas) | Ticket R$'+ticket+' | '+itens+' itens/venda';
  }).join('\n');

  const dataHoje = hoje.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
  const prompt = 'Voce e consultora especialista em varejo de moda feminina da Amora Fashion (Rio de Janeiro).\n\nDADOS ('+dataHoje+'):\nMes: R$'+Math.round(fatMes)+' | Bronze: R$'+(cfg.bronze||0)+' | Falta: R$'+Math.round(faltaBronze)+'\nPrata: R$'+(cfg.prata||0)+' | Ouro: R$'+(cfg.ouro||0)+' | Dias: '+dr+' | Meta/dia: R$'+Math.round(metaDia)+'\nOntem: R$'+Math.round(fatOntem)+' | '+(fatOntem>=metaDia?'META BATIDA':'R$'+Math.round(metaDia-fatOntem)+' abaixo')+'\n\nVENDEDORAS:\n'+resumoVend+'\n\nFaca analise diaria em portugues. Inclua:\n1. RESUMO ONTEM - destaques, quem ficou abaixo\n2. SITUACAO DO MES - progresso, projecao\n3. ANALISE VENDEDORAS - ticket, itens, comportamento\n4. ACOES PARA HOJE - direcionamentos praticos\n5. ALERTA/OPORTUNIDADE - destaque especial\nUse emojis, seja direto. Max 400 palavras.';

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1024,messages:[{role:'user',content:prompt}]});
    const opts = {hostname:'api.anthropic.com',path:'/v1/messages',method:'POST',headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','Content-Length':Buffer.byteLength(body)}};
    const req = https.request(opts,(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{const r=JSON.parse(d);r.content?.[0]?resolve(r.content[0].text):reject(new Error(d.substring(0,200)));}catch(e){reject(e);}});});
    req.on('error',reject);req.write(body);req.end();
  });
}

async function executarAnaliseDiaria() {
  console.log('Iniciando analise IA...');
  const config = loadConfig();
  const hoje = new Date();
  const mesIni = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0')+'-01';
  const gcAt = config.wapp?.gcAt||process.env.GC_ACCESS_TOKEN;
  const gcSt = config.wapp?.gcSt||process.env.GC_SECRET_TOKEN;
  const lojaId = config.wapp?.lojaId||'364514';
  const mesKey = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');
  const cfg = (config.meses||{})[mesKey]||{bronze:0,prata:0,ouro:0,numVend:4,feriados:[]};
  const dr = diasUteisRestantes(hoje.getFullYear(),hoje.getMonth()+1,cfg.feriados||[]);
  if(!gcAt||!gcSt){console.log('IA: tokens GC ausentes');return;}
  try {
    const vendas = await fetchTodasVendas({data_inicio:mesIni,data_fim:fmtDate(hoje),tipo:'vendas_balcao',loja_id:lojaId},{at:gcAt,st:gcSt});
    console.log('IA: '+vendas.length+' vendas');
    const texto = await gerarAnaliseIA({vendas,cfg,dr});
    relatorioIA = {texto,geradoEm:new Date().toISOString(),dia:fmtDate(hoje)};
    const cur = loadConfig(); cur.relatorioIA = relatorioIA; saveConfig(cur);
    console.log('Analise IA concluida');
  } catch(e) { console.error('Erro IA:',e.message); }
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
  const POR_PAGINA = 100; // GC limita 100 por página
  while (true) {
    const res = await fetchGC('vendas', { ...params, pagina, registros_por_pagina: POR_PAGINA }, tokens);
    const lista = res?.data || res?.registros || res?.vendas || [];
    if (!lista.length) break;
    todas = todas.concat(lista);
    console.log(`Página ${pagina}: ${lista.length} vendas (total: ${todas.length})`);
    if (lista.length < POR_PAGINA) break; // última página
    pagina++;
  }
  console.log(`fetchTodasVendas: total ${todas.length} vendas`);
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
  // Ontem = dia anterior ao dia atual
  const ontemDate = new Date(); ontemDate.setDate(ontemDate.getDate() - 1);
  const ontem = fmtDate(ontemDate);

  const vendaVend = ativas(vendas).filter(v =>
    (v.nome_vendedor || '').toUpperCase() === nome.toUpperCase()
  );
  // Acumulado até ONTEM (exclusive hoje) - base do cálculo da meta
  const atOntem = vendaVend.filter(v => (v.data || '').substring(0, 10) < hoje);
  const vendidoAteOntem = atOntem.reduce((s, v) => s + valVenda(v), 0);
  // Só vendas DE ONTEM (para exibir na mensagem)
  const vendidoSoOntem = vendaVend
    .filter(v => (v.data || '').substring(0, 10) === ontem)
    .reduce((s, v) => s + valVenda(v), 0);
  const saldo = Math.max(metaMes - vendidoAteOntem, 0);
  const metaDia = diasRestantes > 0 ? saldo / diasRestantes : 0;
  // Vendas de hoje
  const vendidoHoje = vendaVend
    .filter(v => (v.data || '').substring(0, 10) === hoje)
    .reduce((s, v) => s + valVenda(v), 0);
  // Acumulado total
  const acumulado = vendaVend.reduce((s, v) => s + valVenda(v), 0);
  return { metaDia, vendidoHoje, vendidoAteOntem, vendidoSoOntem, acumulado, saldo, bateu: vendidoAteOntem >= metaMes };
}

// ── Z-API ─────────────────────────────────────────────────
async function enviarWhatsApp(wappConfig, phone, message) {
  // Usa variáveis de ambiente como fallback quando config não está disponível
  const baseUrlRaw = wappConfig.instanceUrl || wappConfig.instanceId || process.env.UAZAPI_URL || '';
  if (!baseUrlRaw || !phone) throw new Error('URL da instância UaZAPI não configurada (verifique Railway Variables: UAZAPI_URL)');
  const authToken = wappConfig.instanceToken || wappConfig.token || process.env.UAZAPI_TOKEN || '';
  if (!authToken) throw new Error('Token UaZAPI não configurado (verifique Railway Variables: UAZAPI_TOKEN)');
  const phoneNum = phone.replace(/\D/g, '');
  const baseUrl = baseUrlRaw.startsWith('http') ? baseUrlRaw : 'https://' + baseUrlRaw;
  // UaZAPI: POST /send/text, header token, body { phone, text }
  const url = new URL('/send/text', baseUrl);
  console.log(`UaZAPI: POST ${url.toString()} phone=${phoneNum}`);
  // UaZAPI usa 'number' e 'text' como campos obrigatórios
  return httpPostFull(url, { number: phoneNum, text: message }, { token: authToken });
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

  // Meta do dia por nível
  const metaDiaBronze = metaBronze > 0 && diasRestantes > 0 ? Math.max(metaBronze - acumulado, 0) / diasRestantes : 0;
  const metaDiaPrata  = metaPrata  > 0 && diasRestantes > 0 ? Math.max(metaPrata  - acumulado, 0) / diasRestantes : 0;
  const metaDiaOuro   = metaOuro   > 0 && diasRestantes > 0 ? Math.max(metaOuro   - acumulado, 0) / diasRestantes : 0;

  let metaDiaLinhas = `🥉 Bronze: *${brl(metaDiaBronze)}*/dia`;
  if (metaPrata  > 0) metaDiaLinhas += `
🥈 Prata:  *${brl(metaDiaPrata)}*/dia`;
  if (metaOuro   > 0) metaDiaLinhas += `
🥇 Ouro:   *${brl(metaDiaOuro)}*/dia`;

  // Verifica se bateu alguma meta DIÁRIA ontem (compara com metaDia de cada nível)
  // metaDia já calculado acima usa (metaMes - acumuladoAteOntem) / diasRestantes
  // Para parabéns, compara vendidoOntem com a meta diária de cada nível
  let parabens = '';
  if (vendidoOntem > 0) {
    if (metaOuro   > 0 && vendidoOntem >= metaDiaOuro)   parabens = '🏆 *PARABÉNS! Ontem você bateu a Meta OURO!* 🥇\n\n';
    else if (metaPrata  > 0 && vendidoOntem >= metaDiaPrata)  parabens = '🎉 *PARABÉNS! Ontem você bateu a Meta PRATA!* 🥈\n\n';
    else if (metaBronze > 0 && vendidoOntem >= metaDiaBronze) parabens = '👏 *PARABÉNS! Ontem você bateu a Meta BRONZE!* 🥉\n\n';
  }

  return `🌅 *Bom dia, ${user.nome.split(' ')[0]}!* ✨
${dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)}

${parabens}_"${frase}"_

━━━━━━━━━━━━━━━━━
🎯 *META DE HOJE*
${metaDiaLinhas}

📦 *ONTEM você vendeu:* ${brl(vendidoOntem)}

━━━━━━━━━━━━━━━━━
📊 *SEU MÊS — ${diasRestantes} dias úteis restantes*
Acumulado: *${brl(acumulado)}* (${pctBronze}% da Bronze)

${metasLinhas}

━━━━━━━━━━━━━━━━━
💜 *Amora Fashion acredita em você!*
Vai com tudo hoje! 🚀`;
}


function buildMsgGerente(user, vendas, cfg, diasRestantes, frase, usuarios) {
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const nv = Math.max(cfg.numVend || 4, 1);
  const hoje_g = fmtDate();
  const fatTotal = ativas(vendas).reduce((s, v) => s + valVenda(v), 0);
  // Meta do dia usa vendido até ONTEM (igual ao painel)
  const fatAteOntem = ativas(vendas)
    .filter(v => (v.data || '').substring(0, 10) < hoje_g)
    .reduce((s, v) => s + valVenda(v), 0);
  const pctBronze = cfg.bronze > 0 ? Math.min((fatTotal / cfg.bronze * 100), 100).toFixed(0) : 0;
  const faltaBronze = Math.max((cfg.bronze || 0) - fatAteOntem, 0);
  const metaDiaLoja = diasRestantes > 0 ? faltaBronze / diasRestantes : 0;

  // Ranking — exclui apenas usuários com role != vendedora (gerente, admin)
  const naoVendedoras = new Set(
    (usuarios || [])
      .filter(u => u.role !== 'vendedora' && u.gcNome)
      .map(u => u.gcNome.toUpperCase())
  );

  const agr = {};
  ativas(vendas).forEach(v => {
    const n = (v.nome_vendedor || '').toUpperCase();
    if (!n || n === 'SEM VENDEDOR') return;
    // Exclui gerentes e admins
    if (naoVendedoras.has(n)) return;
    if (!agr[n]) agr[n] = { total: 0, nomeOriginal: v.nome_vendedor || n };
    agr[n].total += valVenda(v);
  });
  const ranking = Object.entries(agr).sort((a, b) => b[1].total - a[1].total);
  const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  const metaVendBronze = (cfg.bronze || 0) / nv;
  const metaVendPrata  = (cfg.prata  || 0) / nv;
  const metaVendOuro   = (cfg.ouro   || 0) / nv;
  const ontemDate_g = new Date(); ontemDate_g.setDate(ontemDate_g.getDate() - 1);
  const ontemStr_g = fmtDate(ontemDate_g);

  const rankingTexto = ranking.map(([nomeUpper, d], i) => {
    const metaDiaVend = calcMetaDiaVendedora(d.nomeOriginal, vendas, metaVendBronze, diasRestantes);
    const primeiroNome = d.nomeOriginal.split(' ')[0];
    // Verifica meta batida ontem por esta vendedora
    const vendOntem = ativas(vendas)
      .filter(v => (v.nome_vendedor||'').toUpperCase()===nomeUpper && (v.data||'').substring(0,10)===ontemStr_g)
      .reduce((s,v)=>s+valVenda(v),0);
    let medalhaOntem = '';
    if (vendOntem > 0) {
      // Compara com meta DIÁRIA de cada nível (não mensal)
      const mDVBronze = metaVendBronze > 0 && diasRestantes > 0 ? Math.max(metaVendBronze - metaDiaVend.vendidoAteOntem, 0) / diasRestantes : 0;
      const mDVPrata  = metaVendPrata  > 0 && diasRestantes > 0 ? Math.max(metaVendPrata  - metaDiaVend.vendidoAteOntem, 0) / diasRestantes : 0;
      const mDVOuro   = metaVendOuro   > 0 && diasRestantes > 0 ? Math.max(metaVendOuro   - metaDiaVend.vendidoAteOntem, 0) / diasRestantes : 0;
      if (mDVOuro   > 0 && vendOntem >= mDVOuro)   medalhaOntem = ' 🏆🥇';
      else if (mDVPrata  > 0 && vendOntem >= mDVPrata)  medalhaOntem = ' 🎉🥈';
      else if (mDVBronze > 0 && vendOntem >= mDVBronze) medalhaOntem = ' 👏🥉';
    }
    return `${emojis[i] || `${i + 1}.`} ${primeiroNome}${medalhaOntem}: *${brl(d.total)}* | Meta dia: ${brl(metaDiaVend.metaDia)}`;
  }).join('\n');

  // Meta do dia da loja por nível
  const faltaPrataLoja = Math.max((cfg.prata || 0) - fatAteOntem, 0);
  const faltaOuroLoja  = Math.max((cfg.ouro  || 0) - fatAteOntem, 0);
  const metaDiaBronzeLoja = diasRestantes > 0 ? faltaBronze / diasRestantes : 0;
  const metaDiaPrataLoja  = cfg.prata > 0 && diasRestantes > 0 ? faltaPrataLoja / diasRestantes : 0;
  const metaDiaOuroLoja   = cfg.ouro  > 0 && diasRestantes > 0 ? faltaOuroLoja  / diasRestantes : 0;

  let metaDiaLojaLinhas = `🥉 Bronze: *${brl(metaDiaBronzeLoja)}*/dia`;
  if (cfg.prata > 0) metaDiaLojaLinhas += `
🥈 Prata:  *${brl(metaDiaPrataLoja)}*/dia`;
  if (cfg.ouro  > 0) metaDiaLojaLinhas += `
🥇 Ouro:   *${brl(metaDiaOuroLoja)}*/dia`;

  // Verifica meta da loja batida ontem
  const fatOntemLoja = ativas(vendas)
    .filter(v => (v.data||'').substring(0,10) === ontemStr_g)
    .reduce((s,v) => s+valVenda(v), 0);
  let parabensloja = '';
  if (fatOntemLoja > 0) {
    // Compara com a meta diária (metaDiaLoja já calculado acima)
    if (cfg.ouro   > 0 && fatOntemLoja >= metaDiaOuroLoja)   parabensloja = '🏆 *PARABÉNS! A loja bateu a Meta OURO ontem!* 🥇\n\n';
    else if (cfg.prata  > 0 && fatOntemLoja >= metaDiaPrataLoja)  parabensloja = '🎉 *PARABÉNS! A loja bateu a Meta PRATA ontem!* 🥈\n\n';
    else if (cfg.bronze > 0 && fatOntemLoja >= metaDiaBronzeLoja) parabensloja = '👏 *PARABÉNS! A loja bateu a Meta BRONZE ontem!* 🥉\n\n';
  }

  return `🌅 *Bom dia, ${user.nome.split(' ')[0]}!* 📊
${dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)}

${parabensloja}_"${frase}"_

━━━━━━━━━━━━━━━━━
🏪 *RESUMO DA LOJA*
Acumulado: *${brl(fatTotal)}* (${pctBronze}% da Bronze)

🎯 *META DO DIA — LOJA*
${metaDiaLojaLinhas}
Dias úteis restantes: ${diasRestantes} dias

━━━━━━━━━━━━━━━━━
👥 *RANKING DAS VENDEDORAS*
${rankingTexto}

━━━━━━━━━━━━━━━━━
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

  // Fallback para variáveis de ambiente do Railway
  if (!wapp.instanceUrl && process.env.UAZAPI_URL) wapp.instanceUrl = process.env.UAZAPI_URL;
  if (!wapp.instanceToken && process.env.UAZAPI_TOKEN) wapp.instanceToken = process.env.UAZAPI_TOKEN;
  if ((!wapp.instanceUrl && !wapp.instanceId) || (!wapp.instanceToken && !wapp.token)) {
    console.log('WhatsApp: credenciais UaZAPI não configuradas');
    return { ok: false, erro: 'Credenciais UaZAPI não configuradas' };
  }
  if (!gcTokens.at || !gcTokens.st) {
    console.log('WhatsApp: tokens Gestão Click não configurados');
    return { ok: false, erro: 'Tokens Gestão Click não configurados' };
  }

  // Busca vendas do mês atual
  const hoje = new Date();
  const hojeFmt = fmtDate(hoje);
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
      msg = buildMsgGerente(user, vendas, cfgMes, dr, frase_dia, usuarios);
      // Adiciona análise da IA ao final se disponível
      const configAtual = loadConfig();
      const relIA = relatorioIA || configAtual.relatorioIA;
      if (relIA && relIA.texto && relIA.dia === fmtDate(new Date())) {
        msg += `

━━━━━━━━━━━━━━━━━
🤖 *ANÁLISE DO DIA — IA*

${relIA.texto}`;
      }
      tipo = 'gerente';
    } else if (user.gcNome && user.role === 'vendedora') {
      // Vendedora: meta individual
      const metaVend = cfgMes.bronze > 0 ? cfgMes.bronze / nv : 0;
      const metaPrata = cfgMes.prata > 0 ? cfgMes.prata / nv : 0;
      const metaOuro = cfgMes.ouro > 0 ? cfgMes.ouro / nv : 0;
      const dados = calcMetaDiaVendedora(user.gcNome, vendas, metaVend, dr);
      msg = buildMsgVendedora(user, dados.metaDia, dados.acumulado, dados.vendidoSoOntem||0, metaVend, metaPrata, metaOuro, dr, frase_dia);
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
cron.schedule('1 0 * * *', () => {
  console.log('Cron IA: executando analise diaria...');
  executarAnaliseDiaria();
}, { timezone: 'America/Sao_Paulo' });

cron.schedule('30 8 * * 1-6', () => {
  console.log('🕗 Cron: enviando mensagens matinais...');
  executarEnvioManha().then(r => console.log('Cron resultado:', r.totalEnviados, '/', r.total, 'enviados'));
}, { timezone: 'America/Sao_Paulo' });

// ── ENDPOINTS IA ─────────────────────────────────────────

app.get('/ia/relatorio', (req, res) => {
  if (!authCheck(req, res)) return;
  const config = loadConfig();
  const rel = relatorioIA || config.relatorioIA || null;
  res.json({ ok: true, relatorio: rel });
});
app.post('/ia/gerar', async (req, res) => {
  if (!authCheck(req, res)) return;
  res.json({ ok: true, msg: 'Analise iniciada em background' });
  executarAnaliseDiaria();
});

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
    console.log('UaZAPI resposta completa:', JSON.stringify(resp));
    res.json({ ok: true, resp, debug: JSON.stringify(resp) });
  } catch (e) {
    console.error('UaZAPI erro:', e.message);
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
