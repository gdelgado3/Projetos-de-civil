// Servidor do Documentos de Civil: API + ficheiros do frontend
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { um, todos, correr, agora, novoId, transacao } from './db.js';
import { hashSenha, verificarSenha, criarSessao, sessaoDe, terminarSessao } from './auth.js';
import * as motor from './motor.js';
import { construirDocx, lerDocx } from './docx.js';
import { dadosExemplo } from './exemplo.js';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // atrás do proxy HTTPS do alojamento
app.use(express.json({ limit: '5mb' }));

// ===== Erros =====
class Erro extends Error { constructor(msg, status = 400, extra = {}) { super(msg); this.status = status; this.extra = extra; } }
const texto = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const obrigatorio = (v, nome, max) => { const t = texto(v, max); if (!t) throw new Erro(`Falta preencher: ${nome}.`); return t; };
const validarTipo = t => { if (!motor.TIPOS[t]) throw new Erro('Tipo de documento desconhecido.'); return t; };
const dataHoje = () => new Date().toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' });

// ===== Middlewares de acesso =====
function exigirConta(req, res, next) {
  const s = sessaoDe(req);
  const u = s && um('SELECT id, nome, email FROM utilizadores WHERE id = ?', s.utilizador_id);
  if (!u) return res.status(401).json({ erro: 'Tens de entrar na tua conta.' });
  req.s = s; req.u = u; next();
}
// Gabinete ativo da sessão (ou o primeiro de que o utilizador é membro)
function membroAtivo(req) {
  let m = req.s.gabinete_id && um('SELECT * FROM membros WHERE gabinete_id = ? AND utilizador_id = ?', req.s.gabinete_id, req.u.id);
  if (!m) {
    m = um('SELECT * FROM membros WHERE utilizador_id = ? ORDER BY entrou_em LIMIT 1', req.u.id);
    correr('UPDATE sessoes SET gabinete_id = ? WHERE token = ?', m ? m.gabinete_id : null, req.s.token);
  }
  return m || null;
}
function exigirGabinete(req, res, next) {
  const m = membroAtivo(req);
  if (!m) return res.status(403).json({ erro: 'Cria ou junta-te a um gabinete primeiro.', estado: 'sem_gabinete' });
  if (!m.perfil_completo) return res.status(403).json({ erro: 'Completa o teu perfil primeiro.', estado: 'perfil_incompleto' });
  req.m = m; req.gid = m.gabinete_id; next();
}
function exigirAdmin(req, res, next) {
  if (req.m.papel !== 'admin') return res.status(403).json({ erro: 'Só um administrador do gabinete pode fazer isto.' });
  next();
}
const app_ = [exigirConta, exigirGabinete]; // atalho para rotas da aplicação
// Administradores da plataforma (quem gere a demo): emails na variável SUPERADMIN_EMAILS, separados por vírgulas
const SUPERADMINS = (process.env.SUPERADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const ePlataformaAdmin = u => SUPERADMINS.includes(String(u?.email || '').toLowerCase());
function exigirPlataforma(req, res, next) {
  if (!ePlataformaAdmin(req.u)) return res.status(403).json({ erro: 'Só a administração da plataforma pode fazer isto.' });
  next();
}

// ===== Leitura de dados =====
const gabinete = gid => { const g = um('SELECT * FROM gabinetes WHERE id = ?', gid); return { ...g, campos: JSON.parse(g.campos) }; };
const departamentos = gid => todos('SELECT id, nome, area, descricao FROM departamentos WHERE gabinete_id = ? ORDER BY rowid', gid);
function departamentoValido(gid, id) {
  if (!um('SELECT 1 FROM departamentos WHERE id = ? AND gabinete_id = ?', id || '', gid)) throw new Erro('Escolhe um departamento do gabinete.');
  return id;
}
const lerProjeto = p => ({ id: p.id, nome: p.nome, ano: p.ano, departamentoId: p.departamento_id, ficha: JSON.parse(p.ficha), documentos: JSON.parse(p.documentos) });
const arquivo = gid => todos('SELECT * FROM projetos WHERE gabinete_id = ?', gid).map(lerProjeto);
function obraDe(gid, id) {
  const o = um('SELECT * FROM obras WHERE id = ? AND gabinete_id = ?', id, gid);
  if (!o) throw new Erro('Obra não encontrada.', 404);
  return { id: o.id, departamentoId: o.departamento_id, ficha: JSON.parse(o.ficha), criadoEm: o.criado_em };
}
function rascunhoDe(obraId, tipo) { const r = um('SELECT dados FROM rascunhos WHERE obra_id = ? AND tipo = ?', obraId, tipo); return r ? JSON.parse(r.dados) : null; }
function guardarRascunho(obraId, tipo, r) {
  correr(`INSERT INTO rascunhos (obra_id, tipo, dados, atualizado_em) VALUES (?, ?, ?, ?)
          ON CONFLICT (obra_id, tipo) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`, obraId, tipo, JSON.stringify(r), agora());
}
const marcasObra = (arq, o) => ({ dados: motor.valoresNovos(o.ficha), antigos: motor.valoresAntigos(arq, o.ficha) });
// Tudo o que o ecrã de uma obra precisa: ficha, rascunhos, marcas e alertas
function obraCompleta(gid, id) {
  const o = obraDe(gid, id); const arq = arquivo(gid); const marcas = marcasObra(arq, o);
  const documentos = {};
  for (const tipo of Object.keys(motor.TIPOS)) {
    const r = rascunhoDe(o.id, tipo);
    documentos[tipo] = {
      nProjetos: motor.projetosPara(arq, o.departamentoId, tipo).length,
      rascunho: r,
      alertas: r ? motor.calcularAlertas(r, marcas) : null,
      reaproveitado: r ? motor.percentagemReaproveitada(r) : null,
      desatualizado: r ? (r.assinatura !== JSON.stringify(o.ficha) || r.departamentoId !== o.departamentoId) : false
    };
  }
  return { obra: o, marcas, documentos };
}

// ===== Chat: mensagens e transmissão em tempo real (Server-Sent Events) =====
const ouvintes = new Map(); // gabinete -> Set de respostas abertas
function formatarMensagem(m) {
  return { id: m.id, texto: m.texto, criadoEm: m.criado_em, autor: m.utilizador_id ? { id: m.utilizador_id, nome: m.autor_nome || 'Ex-membro' } : null, anexo: m.anexo ? JSON.parse(m.anexo) : null };
}
function publicar(gid, utilizadorId, txt, anexo = null) {
  const r = correr('INSERT INTO mensagens (gabinete_id, utilizador_id, texto, anexo, criado_em) VALUES (?, ?, ?, ?, ?)', gid, utilizadorId ?? null, txt, anexo ? JSON.stringify(anexo) : null, agora());
  const msg = formatarMensagem(um('SELECT m.*, u.nome AS autor_nome FROM mensagens m LEFT JOIN utilizadores u ON u.id = m.utilizador_id WHERE m.id = ?', r.lastInsertRowid));
  for (const res of ouvintes.get(gid) || []) res.write(`event: mensagem\ndata: ${JSON.stringify(msg)}\n\n`);
  return msg;
}
// Valida o que se quer partilhar e devolve um anexo com título fiável
function anexoValido(gid, a) {
  if (!a) return null;
  if (a.tipo === 'obra') { const o = obraDe(gid, a.id); return { tipo: 'obra', id: o.id, titulo: motor.nomeObra(o) }; }
  if (a.tipo === 'rascunho') {
    const o = obraDe(gid, a.obraId); validarTipo(a.docTipo);
    if (!rascunhoDe(o.id, a.docTipo)) throw new Erro('Esse documento ainda não foi gerado.');
    return { tipo: 'rascunho', obraId: o.id, docTipo: a.docTipo, titulo: `${motor.TIPOS[a.docTipo]} — ${motor.nomeObra(o)}` };
  }
  if (a.tipo === 'projeto') {
    const p = um('SELECT id, nome FROM projetos WHERE id = ? AND gabinete_id = ?', a.id, gid);
    if (!p) throw new Erro('Projeto não encontrado.', 404);
    return { tipo: 'projeto', id: p.id, titulo: p.nome };
  }
  throw new Erro('Não é possível partilhar isto.');
}

// Verificação de saúde para o alojamento
app.get('/api/saude', (req, res) => res.json({ ok: true }));

// ===== Contas =====
app.post('/api/registar', (req, res) => {
  const nome = obrigatorio(req.body.nome, 'nome', 120);
  const email = obrigatorio(req.body.email, 'email', 200).toLowerCase();
  const senha = String(req.body.senha || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Erro('O email não parece válido.');
  if (senha.length < 8) throw new Erro('A palavra-passe tem de ter pelo menos 8 caracteres.');
  if (um('SELECT 1 FROM utilizadores WHERE email = ?', email)) throw new Erro('Já existe uma conta com este email. Entra na tua conta.');
  const id = novoId();
  correr('INSERT INTO utilizadores (id, nome, email, senha, criado_em) VALUES (?, ?, ?, ?, ?)', id, nome, email, hashSenha(senha), agora());
  criarSessao(res, id);
  res.json({ ok: true });
});
app.post('/api/entrar', (req, res) => {
  const email = texto(req.body.email, 200).toLowerCase();
  const u = um('SELECT * FROM utilizadores WHERE email = ?', email);
  if (!u || !verificarSenha(String(req.body.senha || ''), u.senha)) throw new Erro('Email ou palavra-passe errados.', 401);
  criarSessao(res, u.id);
  res.json({ ok: true });
});
app.post('/api/sair', (req, res) => { terminarSessao(req, res); res.json({ ok: true }); });

// Quem sou e em que passo do fluxo estou
app.get('/api/eu', (req, res) => {
  const s = sessaoDe(req);
  const u = s && um('SELECT id, nome, email FROM utilizadores WHERE id = ?', s.utilizador_id);
  if (!u) return res.json({ utilizador: null });
  req.s = s; req.u = u;
  const m = membroAtivo(req);
  const gabinetes = todos('SELECT g.id, g.nome, m.papel, m.perfil_completo FROM membros m JOIN gabinetes g ON g.id = m.gabinete_id WHERE m.utilizador_id = ? ORDER BY m.entrou_em', u.id)
    .map(g => ({ id: g.id, nome: g.nome, papel: g.papel, perfilCompleto: !!g.perfil_completo }));
  const convitesPendentes = todos(`SELECT c.token, g.nome AS gabinete FROM convites c JOIN gabinetes g ON g.id = c.gabinete_id
    WHERE c.email = ? AND c.aceite_em IS NULL AND c.gabinete_id NOT IN (SELECT gabinete_id FROM membros WHERE utilizador_id = ?)`, u.email, u.id);
  const estado = !m ? 'sem_gabinete' : !m.perfil_completo ? 'perfil_incompleto' : 'pronto';
  const ativo = m ? { id: m.gabinete_id, nome: gabinete(m.gabinete_id).nome, papel: m.papel, departamentos: departamentos(m.gabinete_id), funcao: m.funcao, departamentoId: m.departamento_id, telefone: m.telefone } : null;
  res.json({ utilizador: u, estado, gabinetes, gabineteAtivo: ativo, convitesPendentes, plataformaAdmin: ePlataformaAdmin(u) });
});
app.post('/api/gabinete-ativo', exigirConta, (req, res) => {
  const m = um('SELECT 1 FROM membros WHERE gabinete_id = ? AND utilizador_id = ?', req.body.gabineteId || '', req.u.id);
  if (!m) throw new Erro('Não és membro desse gabinete.', 403);
  correr('UPDATE sessoes SET gabinete_id = ? WHERE token = ?', req.body.gabineteId, req.s.token);
  res.json({ ok: true });
});

// ===== Onboarding: criar gabinete e completar perfil =====
app.post('/api/gabinetes', exigirConta, (req, res) => {
  const b = req.body;
  const nome = obrigatorio(b.nome, 'nome do gabinete', 160);
  const descricao = obrigatorio(b.descricao, 'descrição do gabinete', 2000);
  const plano = motor.PLANOS[b.plano] ? b.plano : 'pequeno';
  const deps = (Array.isArray(b.departamentos) ? b.departamentos : []).filter(d => texto(d.nome));
  if (!deps.length) throw new Erro('Indica pelo menos um departamento.');
  const gid = novoId();
  transacao(() => {
    correr('INSERT INTO gabinetes (id, nome, nif, localidade, descricao, plano, campos, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      gid, nome, texto(b.nif, 20), texto(b.localidade, 120), descricao, plano, JSON.stringify(motor.CAMPOS_BASE), agora());
    const ids = deps.map(d => {
      const id = novoId();
      correr('INSERT INTO departamentos (id, gabinete_id, nome, area, descricao) VALUES (?, ?, ?, ?, ?)', id, gid, texto(d.nome, 120), motor.AREAS.includes(d.area) ? d.area : null, texto(d.descricao));
      return { id, area: d.area };
    });
    correr('INSERT INTO membros (gabinete_id, utilizador_id, papel, perfil_completo, entrou_em) VALUES (?, ?, ?, 0, ?)', gid, req.u.id, 'admin', agora());
    if (b.exemplo) {
      // Projetos fictícios no departamento de Hidráulica (ou no primeiro)
      const depId = (ids.find(d => d.area === 'Hidráulica') || ids[0]).id;
      const ex = dadosExemplo(nome);
      ex.projetos.forEach(p => correr('INSERT INTO projetos (id, gabinete_id, departamento_id, nome, ano, ficha, documentos, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        novoId(), gid, depId, p.nome, p.ano, JSON.stringify(p.ficha), JSON.stringify(p.documentos), agora()));
      correr('INSERT INTO obras (id, gabinete_id, departamento_id, ficha, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)', novoId(), gid, depId, JSON.stringify(ex.obra.ficha), req.u.id, agora());
    }
  });
  correr('UPDATE sessoes SET gabinete_id = ? WHERE token = ?', gid, req.s.token);
  publicar(gid, null, `${req.u.nome} criou o gabinete «${nome}».`);
  res.json({ id: gid });
});
// Perfil do utilizador no gabinete ativo (obrigatório antes de usar a app)
app.put('/api/perfil', exigirConta, (req, res) => {
  const m = membroAtivo(req); if (!m) throw new Erro('Cria ou junta-te a um gabinete primeiro.', 403);
  const nome = obrigatorio(req.body.nome, 'o teu nome', 120);
  const funcao = obrigatorio(req.body.funcao, 'a tua função', 120);
  const dep = departamentoValido(m.gabinete_id, req.body.departamentoId);
  correr('UPDATE utilizadores SET nome = ? WHERE id = ?', nome, req.u.id);
  correr('UPDATE membros SET funcao = ?, departamento_id = ?, telefone = ?, perfil_completo = 1 WHERE gabinete_id = ? AND utilizador_id = ?',
    funcao, dep, texto(req.body.telefone, 30), m.gabinete_id, req.u.id);
  if (!m.perfil_completo) publicar(m.gabinete_id, null, `${nome} juntou-se ao gabinete (${funcao}).`);
  res.json({ ok: true });
});

// ===== Convites =====
function limiteMembros(gid) {
  const g = gabinete(gid); const max = motor.PLANOS[g.plano].max;
  const membros = um('SELECT COUNT(*) AS n FROM membros WHERE gabinete_id = ?', gid).n;
  const pendentes = um('SELECT COUNT(*) AS n FROM convites WHERE gabinete_id = ? AND aceite_em IS NULL', gid).n;
  return { max, membros, pendentes, plano: motor.PLANOS[g.plano].nome };
}
app.get('/api/convites/:token', (req, res) => {
  const c = um('SELECT c.*, g.nome AS gabinete FROM convites c JOIN gabinetes g ON g.id = c.gabinete_id WHERE c.token = ?', req.params.token);
  if (!c) throw new Erro('Este convite não existe ou foi cancelado.', 404);
  res.json({ gabinete: c.gabinete, email: c.email, aceite: !!c.aceite_em, existeConta: !!um('SELECT 1 FROM utilizadores WHERE email = ?', c.email) });
});
app.post('/api/convites/:token/aceitar', exigirConta, (req, res) => {
  const c = um('SELECT * FROM convites WHERE token = ?', req.params.token);
  if (!c) throw new Erro('Este convite não existe ou foi cancelado.', 404);
  if (c.email !== req.u.email) throw new Erro(`Este convite é para ${c.email}. Entra com essa conta.`, 403);
  if (!um('SELECT 1 FROM membros WHERE gabinete_id = ? AND utilizador_id = ?', c.gabinete_id, req.u.id)) {
    if (c.aceite_em) throw new Erro('Este convite já foi usado.');
    const l = limiteMembros(c.gabinete_id);
    if (l.membros >= l.max) throw new Erro(`O gabinete já tem o número máximo de utilizadores do plano ${l.plano}.`);
    transacao(() => {
      correr('INSERT INTO membros (gabinete_id, utilizador_id, papel, perfil_completo, entrou_em) VALUES (?, ?, ?, 0, ?)', c.gabinete_id, req.u.id, c.papel, agora());
      correr('UPDATE convites SET aceite_em = ? WHERE token = ?', agora(), c.token);
    });
  }
  correr('UPDATE sessoes SET gabinete_id = ? WHERE token = ?', c.gabinete_id, req.s.token);
  res.json({ ok: true });
});
app.post('/api/convites', ...app_, exigirAdmin, (req, res) => {
  const email = obrigatorio(req.body.email, 'email', 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Erro('O email não parece válido.');
  const papel = req.body.papel === 'admin' ? 'admin' : 'membro';
  if (um('SELECT 1 FROM membros m JOIN utilizadores u ON u.id = m.utilizador_id WHERE m.gabinete_id = ? AND u.email = ?', req.gid, email)) throw new Erro('Essa pessoa já faz parte do gabinete.');
  if (um('SELECT 1 FROM convites WHERE gabinete_id = ? AND email = ? AND aceite_em IS NULL', req.gid, email)) throw new Erro('Já há um convite pendente para esse email.');
  const l = limiteMembros(req.gid);
  if (l.membros + l.pendentes >= l.max) throw new Erro(`O plano ${l.plano} permite até ${l.max} utilizadores (contando convites pendentes).`);
  const token = randomBytes(18).toString('base64url');
  correr('INSERT INTO convites (token, gabinete_id, email, papel, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)', token, req.gid, email, papel, req.u.id, agora());
  res.json({ token });
});
app.delete('/api/convites/:token', ...app_, exigirAdmin, (req, res) => {
  correr('DELETE FROM convites WHERE token = ? AND gabinete_id = ? AND aceite_em IS NULL', req.params.token, req.gid);
  res.json({ ok: true });
});

// ===== Gabinete: dados, departamentos, equipa =====
app.get('/api/gabinete', ...app_, (req, res) => {
  const g = gabinete(req.gid);
  const membros = todos(`SELECT u.id, u.nome, u.email, m.papel, m.funcao, m.departamento_id, m.telefone, m.perfil_completo
    FROM membros m JOIN utilizadores u ON u.id = m.utilizador_id WHERE m.gabinete_id = ? ORDER BY m.entrou_em`, req.gid)
    .map(m => ({ id: m.id, nome: m.nome, email: m.email, papel: m.papel, funcao: m.funcao, departamentoId: m.departamento_id, telefone: m.telefone, perfilCompleto: !!m.perfil_completo }));
  const convites = req.m.papel === 'admin'
    ? todos('SELECT token, email, papel, criado_em FROM convites WHERE gabinete_id = ? AND aceite_em IS NULL ORDER BY criado_em', req.gid).map(c => ({ token: c.token, email: c.email, papel: c.papel, criadoEm: c.criado_em }))
    : [];
  res.json({ gabinete: { id: g.id, nome: g.nome, nif: g.nif, localidade: g.localidade, descricao: g.descricao, plano: g.plano, campos: g.campos },
    departamentos: departamentos(req.gid), membros, convites, limite: limiteMembros(req.gid), eu: { id: req.u.id, papel: req.m.papel } });
});
app.put('/api/gabinete', ...app_, exigirAdmin, (req, res) => {
  const b = req.body; const g = gabinete(req.gid);
  const plano = motor.PLANOS[b.plano] ? b.plano : g.plano;
  const l = limiteMembros(req.gid);
  if (l.membros + l.pendentes > motor.PLANOS[plano].max) throw new Erro(`O plano ${motor.PLANOS[plano].nome} só permite ${motor.PLANOS[plano].max} utilizadores e o gabinete já tem ${l.membros + l.pendentes} (com convites).`);
  const campos = Array.isArray(b.campos) ? [...new Set(b.campos.map(c => texto(c, 80)).filter(Boolean))] : g.campos;
  correr('UPDATE gabinetes SET nome = ?, nif = ?, localidade = ?, descricao = ?, plano = ?, campos = ? WHERE id = ?',
    obrigatorio(b.nome ?? g.nome, 'nome do gabinete', 160), texto(b.nif ?? g.nif, 20), texto(b.localidade ?? g.localidade, 120),
    obrigatorio(b.descricao ?? g.descricao, 'descrição do gabinete'), plano, JSON.stringify(campos), req.gid);
  res.json({ ok: true });
});
app.post('/api/departamentos', ...app_, exigirAdmin, (req, res) => {
  const id = novoId();
  correr('INSERT INTO departamentos (id, gabinete_id, nome, area, descricao) VALUES (?, ?, ?, ?, ?)', id, req.gid,
    obrigatorio(req.body.nome, 'nome do departamento', 120), motor.AREAS.includes(req.body.area) ? req.body.area : null, texto(req.body.descricao));
  res.json({ id });
});
app.put('/api/departamentos/:id', ...app_, exigirAdmin, (req, res) => {
  departamentoValido(req.gid, req.params.id);
  correr('UPDATE departamentos SET nome = ?, area = ?, descricao = ? WHERE id = ?',
    obrigatorio(req.body.nome, 'nome do departamento', 120), motor.AREAS.includes(req.body.area) ? req.body.area : null, texto(req.body.descricao), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/departamentos/:id', ...app_, exigirAdmin, (req, res) => {
  departamentoValido(req.gid, req.params.id);
  const usado = um('SELECT (SELECT COUNT(*) FROM projetos WHERE departamento_id = ?) + (SELECT COUNT(*) FROM obras WHERE departamento_id = ?) + (SELECT COUNT(*) FROM membros WHERE departamento_id = ?) AS n', req.params.id, req.params.id, req.params.id).n;
  if (usado) throw new Erro('Este departamento tem projetos, obras ou pessoas. Muda-os de departamento primeiro.');
  correr('DELETE FROM departamentos WHERE id = ?', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/membros/:id', ...app_, exigirAdmin, (req, res) => {
  if (req.params.id === req.u.id) throw new Erro('Não te podes remover a ti próprio.');
  const alvo = um('SELECT u.nome FROM membros m JOIN utilizadores u ON u.id = m.utilizador_id WHERE m.gabinete_id = ? AND m.utilizador_id = ?', req.gid, req.params.id);
  if (!alvo) throw new Erro('Essa pessoa não é membro do gabinete.', 404);
  correr('DELETE FROM membros WHERE gabinete_id = ? AND utilizador_id = ?', req.gid, req.params.id);
  correr('UPDATE sessoes SET gabinete_id = NULL WHERE utilizador_id = ? AND gabinete_id = ?', req.params.id, req.gid);
  publicar(req.gid, null, `${alvo.nome} saiu do gabinete.`);
  res.json({ ok: true });
});

// ===== Apagar contas e gabinetes =====
// Apaga uma conta. Gabinetes onde era a única pessoa também são apagados;
// se era o único administrador, o membro mais antigo passa a administrador.
function apagarUtilizador(uid) {
  const u = um('SELECT nome FROM utilizadores WHERE id = ?', uid);
  if (!u) throw new Erro('Conta não encontrada.', 404);
  const avisar = [];
  transacao(() => {
    for (const m of todos('SELECT gabinete_id, papel FROM membros WHERE utilizador_id = ?', uid)) {
      const outros = todos('SELECT utilizador_id, papel FROM membros WHERE gabinete_id = ? AND utilizador_id != ? ORDER BY entrou_em', m.gabinete_id, uid);
      if (!outros.length) { correr('DELETE FROM gabinetes WHERE id = ?', m.gabinete_id); continue; }
      if (m.papel === 'admin' && !outros.some(o => o.papel === 'admin'))
        correr("UPDATE membros SET papel = 'admin' WHERE gabinete_id = ? AND utilizador_id = ?", m.gabinete_id, outros[0].utilizador_id);
      avisar.push(m.gabinete_id);
    }
    correr('DELETE FROM utilizadores WHERE id = ?', uid);
  });
  avisar.forEach(gid => publicar(gid, null, `${u.nome} apagou a conta e saiu do gabinete.`));
}
app.delete('/api/conta', exigirConta, (req, res) => {
  const u = um('SELECT senha FROM utilizadores WHERE id = ?', req.u.id);
  if (!verificarSenha(String(req.body?.senha || ''), u.senha)) throw new Erro('A palavra-passe não está certa.');
  apagarUtilizador(req.u.id);
  terminarSessao(req, res);
  res.json({ ok: true });
});
app.delete('/api/gabinete', ...app_, exigirAdmin, (req, res) => {
  const g = gabinete(req.gid);
  if (texto(req.body?.nome) !== g.nome) throw new Erro('Escreve o nome do gabinete exatamente como aparece para confirmar.');
  correr('DELETE FROM gabinetes WHERE id = ?', req.gid);
  res.json({ ok: true });
});

// ===== Administração da plataforma =====
app.get('/api/plataforma', exigirConta, exigirPlataforma, (req, res) => {
  const utilizadores = todos(`SELECT u.id, u.nome, u.email, u.criado_em,
      (SELECT group_concat(g.nome, ', ') FROM membros m JOIN gabinetes g ON g.id = m.gabinete_id WHERE m.utilizador_id = u.id) AS gabinetes
    FROM utilizadores u ORDER BY u.criado_em DESC`)
    .map(u => ({ id: u.id, nome: u.nome, email: u.email, criadoEm: u.criado_em, gabinetes: u.gabinetes || '', plataformaAdmin: ePlataformaAdmin(u), eu: u.id === req.u.id }));
  const gabinetes = todos(`SELECT g.id, g.nome, g.criado_em,
      (SELECT COUNT(*) FROM membros WHERE gabinete_id = g.id) AS membros,
      (SELECT COUNT(*) FROM projetos WHERE gabinete_id = g.id) AS projetos,
      (SELECT COUNT(*) FROM obras WHERE gabinete_id = g.id) AS obras
    FROM gabinetes g ORDER BY g.criado_em DESC`)
    .map(g => ({ id: g.id, nome: g.nome, criadoEm: g.criado_em, membros: g.membros, projetos: g.projetos, obras: g.obras }));
  res.json({ utilizadores, gabinetes });
});
app.delete('/api/plataforma/utilizadores/:id', exigirConta, exigirPlataforma, (req, res) => {
  if (req.params.id === req.u.id) throw new Erro('Para apagares a tua própria conta usa o teu perfil.');
  apagarUtilizador(req.params.id);
  res.json({ ok: true });
});
app.delete('/api/plataforma/gabinetes/:id', exigirConta, exigirPlataforma, (req, res) => {
  if (!um('SELECT 1 FROM gabinetes WHERE id = ?', req.params.id)) throw new Erro('Gabinete não encontrado.', 404);
  correr('DELETE FROM gabinetes WHERE id = ?', req.params.id);
  res.json({ ok: true });
});
// Depois da demo: apaga todas as contas e gabinetes, exceto os da administração da plataforma
app.post('/api/plataforma/limpar', exigirConta, exigirPlataforma, (req, res) => {
  if (req.body?.confirmacao !== 'APAGAR') throw new Erro('Escreve APAGAR para confirmar.');
  const manter = todos('SELECT id, email FROM utilizadores').filter(ePlataformaAdmin).map(u => u.id);
  const marcas = manter.map(() => '?').join(',') || "''";
  const r = transacao(() => {
    const g = correr(`DELETE FROM gabinetes WHERE id NOT IN (SELECT gabinete_id FROM membros WHERE utilizador_id IN (${marcas}))`, ...manter).changes;
    const u = correr(`DELETE FROM utilizadores WHERE id NOT IN (${marcas})`, ...manter).changes;
    return { gabinetes: g, utilizadores: u };
  });
  res.json(r);
});

// ===== Arquivo de projetos anteriores =====
app.get('/api/projetos', ...app_, (req, res) => {
  res.json(arquivo(req.gid).map(p => ({ id: p.id, nome: p.nome, ano: p.ano, departamentoId: p.departamentoId,
    seccoes: Object.fromEntries(Object.keys(motor.TIPOS).map(t => [t, p.documentos[t]?.seccoes?.length || 0])) })));
});
app.get('/api/projetos/:id', ...app_, (req, res) => {
  const p = um('SELECT * FROM projetos WHERE id = ? AND gabinete_id = ?', req.params.id, req.gid);
  if (!p) throw new Erro('Projeto não encontrado.', 404);
  const lp = lerProjeto(p);
  res.json({ ...lp, textos: Object.fromEntries(Object.keys(motor.TIPOS).map(t => [t, motor.seccoesParaTexto(lp.documentos[t]?.seccoes)])) });
});
function corpoProjeto(req) {
  const b = req.body; const textos = b.textos || {};
  const ficha = Object.fromEntries(Object.entries(b.ficha || {}).map(([k, v]) => [texto(k, 80), texto(v, 300)]).filter(([k]) => k));
  const documentos = Object.fromEntries(Object.keys(motor.TIPOS).map(t => [t, { seccoes: motor.textoParaSeccoes(texto(textos[t], 400000)) }]));
  return { nome: obrigatorio(b.nome, 'nome do projeto', 200), ano: texto(b.ano, 10), dep: departamentoValido(req.gid, b.departamentoId), ficha, documentos };
}
app.post('/api/projetos', ...app_, (req, res) => {
  const p = corpoProjeto(req); const id = novoId();
  correr('INSERT INTO projetos (id, gabinete_id, departamento_id, nome, ano, ficha, documentos, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, req.gid, p.dep, p.nome, p.ano, JSON.stringify(p.ficha), JSON.stringify(p.documentos), agora());
  publicar(req.gid, req.u.id, `Juntei ao arquivo o projeto ${p.nome}.`, { tipo: 'projeto', id, titulo: p.nome });
  res.json({ id });
});
app.put('/api/projetos/:id', ...app_, (req, res) => {
  if (!um('SELECT 1 FROM projetos WHERE id = ? AND gabinete_id = ?', req.params.id, req.gid)) throw new Erro('Projeto não encontrado.', 404);
  const p = corpoProjeto(req);
  correr('UPDATE projetos SET departamento_id = ?, nome = ?, ano = ?, ficha = ?, documentos = ?, atualizado_em = ? WHERE id = ?',
    p.dep, p.nome, p.ano, JSON.stringify(p.ficha), JSON.stringify(p.documentos), agora(), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/projetos/:id', ...app_, (req, res) => {
  correr('DELETE FROM projetos WHERE id = ? AND gabinete_id = ?', req.params.id, req.gid);
  res.json({ ok: true });
});
app.post('/api/docx-para-texto', ...app_, express.raw({ type: 'application/octet-stream', limit: '25mb' }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new Erro('Ficheiro vazio.');
  let t; try { t = lerDocx(req.body); } catch (e) { throw new Erro(e.message); }
  res.json({ texto: t, seccoes: motor.textoParaSeccoes(t).length });
});

// ===== Obras e rascunhos =====
app.get('/api/obras', ...app_, (req, res) => {
  const lista = todos('SELECT id, departamento_id, ficha, criado_em FROM obras WHERE gabinete_id = ? ORDER BY criado_em DESC', req.gid).map(o => {
    const docs = Object.fromEntries(todos('SELECT tipo, dados FROM rascunhos WHERE obra_id = ?', o.id).map(r => {
      const d = JSON.parse(r.dados);
      return [r.tipo, { total: d.seccoes.length, aceites: d.seccoes.filter(s => s.estado === 'aceite').length }];
    }));
    return { id: o.id, nome: motor.nomeObra({ ficha: JSON.parse(o.ficha) }), departamentoId: o.departamento_id, criadoEm: o.criado_em, documentos: docs };
  });
  res.json(lista);
});
app.post('/api/obras', ...app_, (req, res) => {
  const id = novoId();
  const dep = departamentoValido(req.gid, req.body.departamentoId || req.m.departamento_id);
  const ficha = { 'Designação da obra': texto(req.body.nome, 200) || 'Obra nova', 'Fase do projeto': 'Projeto de Execução', 'Ano': String(new Date().getFullYear()) };
  correr('INSERT INTO obras (id, gabinete_id, departamento_id, ficha, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)', id, req.gid, dep, JSON.stringify(ficha), req.u.id, agora());
  res.json({ id });
});
app.get('/api/obras/:id', ...app_, (req, res) => res.json(obraCompleta(req.gid, req.params.id)));
app.put('/api/obras/:id', ...app_, (req, res) => {
  obraDe(req.gid, req.params.id);
  const ficha = Object.fromEntries(Object.entries(req.body.ficha || {}).map(([k, v]) => [texto(k, 80), texto(v, 300)]).filter(([k]) => k));
  correr('UPDATE obras SET departamento_id = ?, ficha = ? WHERE id = ?', departamentoValido(req.gid, req.body.departamentoId), JSON.stringify(ficha), req.params.id);
  res.json(obraCompleta(req.gid, req.params.id));
});
app.delete('/api/obras/:id', ...app_, (req, res) => {
  obraDe(req.gid, req.params.id);
  correr('DELETE FROM obras WHERE id = ?', req.params.id);
  res.json({ ok: true });
});
app.post('/api/obras/:id/gerar/:tipo', ...app_, (req, res) => {
  const tipo = validarTipo(req.params.tipo); const o = obraDe(req.gid, req.params.id);
  const r = motor.gerarDocumento(arquivo(req.gid), o, tipo, dataHoje());
  if (r.erro) throw new Erro(r.erro);
  r.geradoPor = req.u.nome;
  guardarRascunho(o.id, tipo, r);
  publicar(req.gid, null, `${req.u.nome} gerou a ${motor.TIPOS[tipo].toLowerCase()} de ${motor.nomeObra(o)} (${motor.percentagemReaproveitada(r)}% do texto reaproveitado).`,
    { tipo: 'rascunho', obraId: o.id, docTipo: tipo, titulo: `${motor.TIPOS[tipo]} — ${motor.nomeObra(o)}` });
  res.json(obraCompleta(req.gid, o.id));
});
// Ações de revisão sobre uma secção
app.post('/api/obras/:id/rascunhos/:tipo/seccoes/:i/:acao', ...app_, (req, res) => {
  const tipo = validarTipo(req.params.tipo); const o = obraDe(req.gid, req.params.id);
  const r = rascunhoDe(o.id, tipo); if (!r) throw new Erro('Este documento ainda não foi gerado.');
  const i = Number(req.params.i); const s = r.seccoes[i]; if (!s) throw new Erro('Secção não encontrada.', 404);
  const arq = arquivo(req.gid);
  switch (req.params.acao) {
    case 'aceitar': {
      const problema = motor.problemasSeccao(s, marcasObra(arq, o)); if (problema) throw new Erro(problema);
      s.estado = 'aceite'; s.revistoPor = req.u.nome; s.revistoEm = agora(); break;
    }
    case 'rejeitar': s.estado = s.estado === 'rejeitada' ? 'pendente' : 'rejeitada'; s.revistoPor = null; break;
    case 'editar': {
      const textos = req.body.textos;
      if (!Array.isArray(textos) || textos.length !== s.paragrafos.length) throw new Erro('Pedido de edição inválido.');
      textos.forEach((t, k) => { t = texto(t, 20000); if (t !== s.paragrafos[k].texto) { s.paragrafos[k].texto = t; s.paragrafos[k].tipo = 'editado'; } });
      s.estado = 'pendente'; s.revistoPor = null; break;
    }
    case 'outra-fonte': {
      const projetos = motor.projetosPara(arq, r.departamentoId, tipo);
      const alt = projetos.filter(p => motor.seccaoDe(p, tipo, s.chave));
      if (alt.length < 2) throw new Erro('Não há outra fonte para esta secção.');
      const prox = alt[(alt.findIndex(p => p.id === s.fonteId) + 1) % alt.length];
      r.seccoes[i] = motor.gerarSeccao(s.chave, prox, projetos, o.ficha, tipo); break;
    }
    case 'usar-referencia': {
      const p = s.paragrafos[Number(req.body.paragrafo)]; if (!p) throw new Erro('Parágrafo não encontrado.');
      const fonte = arq.find(x => x.id === p.origem.projetoId);
      const m = motor.modelizar(p.referencia, fonte ? fonte.ficha : {});
      p.texto = motor.preencher(m, o.ficha); p.numeros = motor.numerosComUnidade(m); p.tipo = 'referencia';
      s.estado = 'pendente'; s.revistoPor = null; break;
    }
    default: throw new Erro('Ação desconhecida.');
  }
  guardarRascunho(o.id, tipo, r);
  if (req.params.acao === 'aceitar' && r.seccoes.every(x => x.estado !== 'pendente'))
    publicar(req.gid, null, `${req.u.nome} terminou a revisão da ${motor.TIPOS[tipo].toLowerCase()} de ${motor.nomeObra(o)}.`,
      { tipo: 'rascunho', obraId: o.id, docTipo: tipo, titulo: `${motor.TIPOS[tipo]} — ${motor.nomeObra(o)}` });
  res.json(obraCompleta(req.gid, o.id));
});
app.get('/api/obras/:id/rascunhos/:tipo/docx', ...app_, (req, res) => {
  const tipo = validarTipo(req.params.tipo); const o = obraDe(req.gid, req.params.id);
  const r = rascunhoDe(o.id, tipo); if (!r) throw new Erro('Este documento ainda não foi gerado.');
  const buf = construirDocx({ gabinete: gabinete(req.gid), departamento: um('SELECT nome FROM departamentos WHERE id = ?', o.departamentoId), obra: o, rascunho: r, tipo, marcas: marcasObra(arquivo(req.gid), o) });
  const nome = `${motor.slug(motor.TIPOS[tipo])}_${motor.slug(motor.nomeObra(o))}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.send(buf);
});

// ===== Chat da equipa =====
app.get('/api/chat', ...app_, (req, res) => {
  const antes = Number(req.query.antes) || Number.MAX_SAFE_INTEGER;
  const linhas = todos('SELECT m.*, u.nome AS autor_nome FROM mensagens m LEFT JOIN utilizadores u ON u.id = m.utilizador_id WHERE m.gabinete_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT 100', req.gid, antes);
  res.json(linhas.reverse().map(formatarMensagem));
});
app.post('/api/chat', ...app_, (req, res) => {
  const txt = texto(req.body.texto, 4000);
  const anexo = anexoValido(req.gid, req.body.anexo);
  if (!txt && !anexo) throw new Erro('Escreve uma mensagem.');
  res.json(publicar(req.gid, req.u.id, txt, anexo));
});
// O que se pode partilhar no chat
app.get('/api/partilhaveis', ...app_, (req, res) => {
  const itens = [];
  todos('SELECT id, ficha FROM obras WHERE gabinete_id = ? ORDER BY criado_em DESC', req.gid).forEach(o => {
    const nome = motor.nomeObra({ ficha: JSON.parse(o.ficha) });
    itens.push({ tipo: 'obra', id: o.id, titulo: `Obra: ${nome}` });
    todos('SELECT tipo FROM rascunhos WHERE obra_id = ?', o.id).forEach(r => itens.push({ tipo: 'rascunho', obraId: o.id, docTipo: r.tipo, titulo: `${motor.TIPOS[r.tipo]}: ${nome}` }));
  });
  todos('SELECT id, nome FROM projetos WHERE gabinete_id = ? ORDER BY nome', req.gid).forEach(p => itens.push({ tipo: 'projeto', id: p.id, titulo: `Arquivo: ${p.nome}` }));
  res.json(itens);
});
app.get('/api/chat/stream', ...app_, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  if (!ouvintes.has(req.gid)) ouvintes.set(req.gid, new Set());
  ouvintes.get(req.gid).add(res);
  const batida = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(batida); ouvintes.get(req.gid)?.delete(res); });
});

// ===== Frontend =====
app.get('/js/motor.js', (req, res) => res.type('application/javascript').sendFile(path.join(raiz, 'motor.js')));
app.use(express.static(path.join(raiz, '..', 'public')));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota desconhecida.' }));

// Erros: mensagens claras para o utilizador, detalhes só no registo do servidor
app.use((err, req, res, next) => {
  if (err instanceof Erro) return res.status(err.status).json({ erro: err.message, ...err.extra });
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'O ficheiro é demasiado grande.' });
  console.error(err);
  res.status(500).json({ erro: 'Erro inesperado no servidor.' });
});

const porta = Number(process.env.PORT) || 3000;
app.listen(porta, () => console.log(`Documentos de Civil a correr em http://localhost:${porta}`));
