// Motor de geração do Documentos de Civil.
// Módulo partilhado: corre no servidor (Node) e no browser (servido em /js/motor.js).
// Não usa IA: monta o rascunho com o texto que se repete nos projetos anteriores do gabinete.

// ===== Constantes =====
export const TIPOS = { memoria: 'Memória descritiva', calculos: 'Cálculos descritivos' };
export const AREAS = ['Hidráulica', 'Geotecnia', 'Estruturas'];
export const PLANOS = { pequeno: { nome: 'Pequeno', max: 3, preco: '100 €/mês' }, medio: { nome: 'Médio', max: 10, preco: '250 €/mês' } };
export const CAMPOS_BASE = ['Designação da obra', 'Dono de obra', 'Concelho', 'Local', 'Tipo de obra', 'Fase do projeto', 'Ano', 'Capacidade', 'Cota de soleira', 'Material', 'Coordenador do projeto'];
export const NOMES_MARCA = { conf: 'Falta confirmar', dado: 'Dado da ficha da obra', num: 'Valor reaproveitado que muda entre obras: confirmar', antigo: 'Dado de uma obra antiga: corrigir' };
const CAMPOS_PONTUACAO = ['Tipo de obra', 'Material', 'Dono de obra', 'Concelho'];
const LIMIAR = 0.72; // semelhança mínima para dizer que um parágrafo se repete noutra obra
const RE_NUM = /(\d{1,3}(?:[  .]\d{3})+(?:,\d+)?|\d+(?:,\d+)?)\s?(m³|m3|m²|m2|mm|cm|km|kN\/m²|kN\/m2|kN|kPa|MPa|m\/s|l\/s|ha|m|%|dias|anos|meses|€)(?![\wÀ-ÿ³²])/g;

// ===== Utilitários =====
export function normal(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
export function slug(s) { return normal(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'documento'; }
function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function nomeObra(o) { return o?.ficha?.['Designação da obra'] || 'Obra sem nome'; }

// ===== Texto: secções e parágrafos =====
// Uma linha é título se começa por #, se é numerada e curta, ou se está toda em maiúsculas
export function eTitulo(l) {
  if (l.startsWith('#')) return true;
  if (/^\d+(\.\d+)*\.?\s+\S/.test(l) && l.length <= 90 && !/[.;:,]$/.test(l)) return true;
  return l.length <= 60 && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3}/.test(l);
}
export function textoParaSeccoes(texto) {
  const seccoes = []; let atual = null; let buf = [];
  const fecharPar = () => {
    if (!buf.length) return;
    if (!atual) { atual = { titulo: 'Preâmbulo', paragrafos: [] }; seccoes.push(atual); }
    atual.paragrafos.push(buf.join(' ')); buf = [];
  };
  String(texto || '').split(/\r?\n/).forEach(linha => {
    const l = linha.trim();
    if (!l) return fecharPar();
    if (eTitulo(l)) { fecharPar(); atual = { titulo: l.replace(/^#+\s*/, ''), paragrafos: [] }; seccoes.push(atual); }
    else buf.push(l);
  });
  fecharPar();
  return seccoes.filter(s => s.titulo);
}
export function seccoesParaTexto(seccoes) {
  return (seccoes || []).map(s => '# ' + s.titulo + '\n\n' + s.paragrafos.join('\n\n')).join('\n\n');
}
export function chaveTitulo(t) { return normal(String(t).replace(/^\s*\d+(\.\d+)*[.)]?\s*/, '')); }
function numeroTitulo(t) { const m = String(t).match(/^\s*(\d+)/); return m ? +m[1] : 999; }

// ===== Troca de dados =====
// Troca os dados de uma obra por marcadores {{campo}} (os valores mais longos primeiro)
export function modelizar(texto, ficha) {
  const pares = Object.entries(ficha || {}).filter(([, v]) => v && String(v).trim().length >= 2)
    .sort((a, b) => String(b[1]).trim().length - String(a[1]).trim().length);
  let t = texto; const mapa = [];
  pares.forEach(([c, v], i) => { const marca = String.fromCharCode(0xE000 + i); mapa.push([marca, c]); t = t.split(String(v).trim()).join(marca); });
  mapa.forEach(([m, c]) => { t = t.split(m).join('{{' + c + '}}'); });
  return t;
}
// Põe os dados da obra nova nos marcadores; o que falta fica [A CONFIRMAR]
export function preencher(modelo, ficha) {
  return modelo.replace(/\{\{([^}]+)\}\}/g, (_, c) => { const v = String(ficha[c] || '').trim(); return v || `[A CONFIRMAR: ${c}]`; });
}
function palavras(t) {
  const s = t.replace(/\{\{([^}]+)\}\}/g, (_, c) => ' §' + normal(c).replace(/\s+/g, '_') + ' ');
  return new Set(normal(s).match(/[§a-z0-9_]+/g) || []);
}
// Semelhança entre dois textos (coeficiente de Dice sobre palavras)
export function semelhanca(a, b) {
  const A = palavras(a), B = palavras(b); if (!A.size || !B.size) return 0;
  let n = 0; A.forEach(x => { if (B.has(x)) n++; });
  return 2 * n / (A.size + B.size);
}
export function numerosComUnidade(t) { return [...new Set(t.match(RE_NUM) || [])]; }

// ===== Geração =====
export function seccaoDe(p, tipo, chave) { return (p.documentos?.[tipo]?.seccoes || []).find(s => chaveTitulo(s.titulo) === chave); }
function pontuar(p, obra) {
  let n = 0; CAMPOS_PONTUACAO.forEach(c => { if (p.ficha[c] && normal(p.ficha[c]) === normal(obra.ficha[c])) n++; });
  return n + (parseInt(p.ano) || 0) / 10000;
}
export function projetosPara(arquivo, departamentoId, tipo) {
  return arquivo.filter(p => p.departamentoId === departamentoId && p.documentos?.[tipo]?.seccoes?.length);
}

// Gera uma secção a partir de um projeto-fonte, comparando com as outras obras do arquivo
export function gerarSeccao(chave, fonte, projetos, ficha, tipo) {
  const sFonte = seccaoDe(fonte, tipo, chave);
  const outros = projetos.filter(p => p.id !== fonte.id && seccaoDe(p, tipo, chave));
  const modelosOutros = outros.map(p => ({ p, mods: seccaoDe(p, tipo, chave).paragrafos.map(t => modelizar(t, p.ficha)) }));
  const paragrafos = sFonte.paragrafos.map(orig => {
    const m = modelizar(orig, fonte.ficha);
    const corresp = [];
    modelosOutros.forEach(o => {
      let melhor = null, sm = 0;
      o.mods.forEach(t => { const s = semelhanca(m, t); if (s > sm) { sm = s; melhor = t; } });
      if (sm >= LIMIAR) corresp.push({ p: o.p, t: melhor });
    });
    const base = { origem: { projetoId: fonte.id, projeto: fonte.nome, ano: fonte.ano, seccao: sFonte.titulo }, referencia: orig, aparece: corresp.map(c => c.p.nome) };
    if (outros.length && !corresp.length) return { ...base, tipo: 'especifico', texto: '[A CONFIRMAR: texto específico desta obra]', numeros: [] };
    const nums = numerosComUnidade(m);
    const numeros = corresp.length ? nums.filter(n => !corresp.every(c => c.t.includes(n))) : nums;
    return { ...base, tipo: corresp.length ? 'reaproveitado' : 'unico', texto: preencher(m, ficha), numeros };
  });
  return { chave, titulo: sFonte.titulo, fonteId: fonte.id, fonteNome: fonte.nome, presenca: `${1 + outros.length} de ${projetos.length}`, paragrafos, estado: 'pendente', revistoPor: null };
}

// Gera o documento inteiro: a obra mais parecida é a base, e entram as secções frequentes nas outras
export function gerarDocumento(arquivo, obra, tipo, dataTexto) {
  const projetos = projetosPara(arquivo, obra.departamentoId, tipo);
  if (!projetos.length) return { erro: `Não há projetos anteriores com ${TIPOS[tipo].toLowerCase()} neste departamento. Junta pelo menos um ao arquivo.` };
  const ordenados = [...projetos].sort((a, b) => pontuar(b, obra) - pontuar(a, obra));
  const base = ordenados[0];
  const chaves = base.documentos[tipo].seccoes.map(s => ({ chave: chaveTitulo(s.titulo), titulo: s.titulo }));
  const contagem = {};
  projetos.forEach(p => p.documentos[tipo].seccoes.forEach(s => { const k = chaveTitulo(s.titulo); (contagem[k] = contagem[k] || { n: 0, titulo: s.titulo }).n++; }));
  Object.entries(contagem).forEach(([k, v]) => {
    if (!chaves.some(c => c.chave === k) && v.n >= 2 && v.n >= Math.ceil(projetos.length / 2)) chaves.push({ chave: k, titulo: v.titulo });
  });
  chaves.forEach((c, i) => c.ordem = i);
  chaves.sort((a, b) => (numeroTitulo(a.titulo) - numeroTitulo(b.titulo)) || (a.ordem - b.ordem));
  const seccoes = chaves.map(c => gerarSeccao(c.chave, ordenados.find(p => seccaoDe(p, tipo, c.chave)), projetos, obra.ficha, tipo));
  return { tipo, seccoes, geradoEm: dataTexto, assinatura: JSON.stringify(obra.ficha), departamentoId: obra.departamentoId, nProjetos: projetos.length };
}
export function percentagemReaproveitada(r) {
  let tot = 0, rep = 0;
  r.seccoes.forEach(s => s.paragrafos.forEach(p => { tot += p.referencia.length; if (p.tipo === 'reaproveitado') rep += p.referencia.length; }));
  return tot ? Math.round(100 * rep / tot) : 0;
}

// ===== Marcas no texto e alertas =====
export function valoresNovos(ficha) { return Object.values(ficha || {}).filter(v => v && String(v).trim().length >= 2).map(v => String(v).trim()); }
export function valoresAntigos(arquivo, ficha) {
  const novos = new Set(valoresNovos(ficha).map(normal)); const out = new Set();
  arquivo.forEach(p => Object.values(p.ficha || {}).forEach(v => { v = String(v || '').trim(); if (v.length >= 4 && !novos.has(normal(v))) out.add(v); }));
  return [...out];
}
export function segmentar(texto, marcas) {
  const cand = [];
  const juntar = (re, tipo, pri) => { let m; while ((m = re.exec(texto))) { if (!m[0]) { re.lastIndex++; continue; } cand.push({ i: m.index, f: m.index + m[0].length, tipo, pri }); } };
  juntar(/\[A CONFIRMAR[^\]]*\]/g, 'conf', 0);
  (marcas.antigos || []).forEach(s => juntar(new RegExp(escRegex(s), 'gi'), 'antigo', 1));
  (marcas.dados || []).forEach(s => juntar(new RegExp(escRegex(s), 'g'), 'dado', 1));
  (marcas.numeros || []).forEach(s => juntar(new RegExp(escRegex(s), 'g'), 'num', 2));
  // Prioridade: [A CONFIRMAR], depois o trecho mais longo
  cand.sort((a, b) => (a.pri === 0 ? -1 : 0) - (b.pri === 0 ? -1 : 0) || (b.f - b.i) - (a.f - a.i) || a.pri - b.pri);
  const ocupado = new Array(texto.length).fill(false); const aceites = [];
  cand.forEach(c => { for (let k = c.i; k < c.f; k++) if (ocupado[k]) return; for (let k = c.i; k < c.f; k++) ocupado[k] = true; aceites.push(c); });
  aceites.sort((a, b) => a.i - b.i);
  const out = []; let pos = 0;
  aceites.forEach(c => { if (c.i > pos) out.push({ t: texto.slice(pos, c.i) }); out.push({ t: texto.slice(c.i, c.f), tipo: c.tipo }); pos = c.f; });
  if (pos < texto.length) out.push({ t: texto.slice(pos) });
  return out;
}
export function calcularAlertas(r, marcas) {
  const a = { conf: 0, nums: 0, pend: 0, antigos: [] };
  r.seccoes.forEach(s => {
    if (s.estado === 'rejeitada') return;
    if (s.estado === 'pendente') a.pend++;
    s.paragrafos.forEach(p => {
      a.conf += (p.texto.match(/\[A CONFIRMAR/g) || []).length;
      if (s.estado !== 'aceite') a.nums += p.numeros.filter(n => p.texto.includes(n)).length;
      segmentar(p.texto, marcas).filter(x => x.tipo === 'antigo').forEach(x => a.antigos.push({ seccao: s.titulo, valor: x.t }));
    });
  });
  return a;
}
// Devolve a razão para não deixar aceitar uma secção, ou null
export function problemasSeccao(s, marcas) {
  if (s.paragrafos.some(p => p.texto.includes('[A CONFIRMAR'))) return 'Esta secção ainda tem pontos [A CONFIRMAR]. Edita-a antes de aceitar.';
  if (s.paragrafos.some(p => segmentar(p.texto, marcas).some(x => x.tipo === 'antigo'))) return 'Esta secção ainda tem dados de obras antigas. Corrige-os antes de aceitar.';
  return null;
}
