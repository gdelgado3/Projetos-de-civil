// Escrever PDF sem bibliotecas: texto com fontes padrão, caixas de cor e quebra de linha com justificação.
// O mesmo conteúdo do Word, com o tema do Documentos de Civil ou com a cor e o nome do gabinete.
import zlib from 'node:zlib';
import { LARGURAS } from './pdf-metricas.js';
import { TIPOS, segmentar, nomeObra } from './motor.js';

const W = 595.28, H = 841.89, M = 62, BASE = 58;
const FONTES = { sans: 'Helvetica', sansB: 'Helvetica-Bold', serif: 'Times-Roman', serifI: 'Times-Italic', serifB: 'Times-Bold' };
const REF = { Helvetica: 'F1', 'Helvetica-Bold': 'F2', 'Times-Roman': 'F3', 'Times-Italic': 'F4', 'Times-Bold': 'F5' };
const CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F };

function codigos(s) {
  const r = [];
  for (const ch of String(s).replace(/ /g, ' ').replace(/[  ]/g, ' ')) {
    const c = ch.codePointAt(0);
    r.push(c >= 32 && c < 256 ? c : CP1252[ch] ?? 63);
  }
  return r;
}
const hex = s => '<' + Buffer.from(codigos(s)).toString('hex') + '>';
const larg = (s, f, t) => { let w = 0; const tab = LARGURAS[f]; for (const c of codigos(s)) w += tab[c - 32] ?? 500; return w * t / 1000; };
const n2 = v => (Math.round(v * 100) / 100).toString();

function rgb(h) { const x = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16) / 255); }
const cor = h => rgb(h).map(n2).join(' ');
const luminancia = h => { const [r, g, b] = rgb(h); return 0.299 * r + 0.587 * g + 0.114 * b; };
function escurecer(h, ate = 0.42) {
  let [r, g, b] = rgb(h).map(v => v * 255);
  for (let i = 0; i < 12 && 0.299 * r / 255 + 0.587 * g / 255 + 0.114 * b / 255 > ate; i++) { r *= 0.88; g *= 0.88; b *= 0.88; }
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function clarear(h, k = 0.88) { const [r, g, b] = rgb(h).map(v => v * 255); return '#' + [r, g, b].map(v => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0')).join(''); }

export const TEMA_CIVIL = { tipo: 'civil', marinho: '#0B1F3F', acento: '#F5A20A', titulo: '#0B1F3F', caixa: '#FFF1D6', marca: 'Documentos de Civil' };

class Doc {
  constructor(tema) { this.tema = tema; this.paginas = []; this.y = 0; this.nova(false); }
  nova(primeira, meta = {}) { this.pag = { cmds: [], primeira, ...meta }; this.paginas.push(this.pag); this.y = primeira ? 196 : M + 6; }
  garantir(h) { if (this.y + h > H - BASE) this.nova(false, { titulo: this.pag.titulo, subtitulo: this.pag.subtitulo }); }
  rect(x, y, w, h, c) { this.pag.cmds.push(`${cor(c)} rg ${n2(x)} ${n2(H - y - h)} ${n2(w)} ${n2(h)} re f`); }
  rrect(x, y, w, h, r, c) {
    const Y = H - y - h, k = r * 0.5523;
    this.pag.cmds.push(`${cor(c)} rg ${n2(x + r)} ${n2(Y)} m ${n2(x + w - r)} ${n2(Y)} l ${n2(x + w - r + k)} ${n2(Y)} ${n2(x + w)} ${n2(Y + r - k)} ${n2(x + w)} ${n2(Y + r)} c ${n2(x + w)} ${n2(Y + h - r)} l ${n2(x + w)} ${n2(Y + h - r + k)} ${n2(x + w - r + k)} ${n2(Y + h)} ${n2(x + w - r)} ${n2(Y + h)} c ${n2(x + r)} ${n2(Y + h)} l ${n2(x + r - k)} ${n2(Y + h)} ${n2(x)} ${n2(Y + h - r + k)} ${n2(x)} ${n2(Y + h - r)} c ${n2(x)} ${n2(Y + r)} l ${n2(x)} ${n2(Y + r - k)} ${n2(x + r - k)} ${n2(Y)} ${n2(x + r)} ${n2(Y)} c f`);
  }
  linha(x1, y1, x2, y2, c, esp = 0.8) { this.pag.cmds.push(`${cor(c)} RG ${n2(esp)} w ${n2(x1)} ${n2(H - y1)} m ${n2(x2)} ${n2(H - y2)} l S`); }
  texto(s, x, y, f, t, c) { if (s) this.pag.cmds.push(`BT ${cor(c)} rg /${REF[f]} ${n2(t)} Tf ${n2(x)} ${n2(H - y)} Td ${hex(s)} Tj ET`); }
}

// Parte um texto em linhas que cabem na largura
function quebrar(s, f, t, w) {
  const linhas = []; let atual = '';
  for (const p of String(s).split(/\s+/).filter(Boolean)) {
    const prova = atual ? atual + ' ' + p : p;
    if (larg(prova, f, t) <= w || !atual) atual = prova; else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// Parágrafo justificado com realces para [A CONFIRMAR], dados de obras antigas e valores a confirmar
function paragrafo(d, pedacos, o = {}) {
  const f = o.fonte || FONTES.serif, t = o.tam || 10.8, lead = o.lead || 15.6, x0 = o.x ?? M, w = o.w ?? W - 2 * M;
  const palavras = []; let atual = [];
  for (const p of pedacos) {
    for (const parte of p.t.split(/(\s+)/)) {
      if (!parte) continue;
      if (/^\s+$/.test(parte)) { if (atual.length) { palavras.push(atual); atual = []; } } else atual.push({ t: parte, tipo: p.tipo });
    }
  }
  if (atual.length) palavras.push(atual);
  const lw = pal => pal.reduce((s, p) => s + larg(p.t, f, t), 0);
  const esp = larg(' ', f, t), linhas = []; let l = [], lwid = 0;
  for (const pal of palavras) {
    const pw = lw(pal);
    if (l.length && lwid + esp + pw > w) { linhas.push(l); l = []; lwid = 0; }
    lwid += (l.length ? esp : 0) + pw; l.push(pal);
  }
  if (l.length) linhas.push(l);
  linhas.forEach((ln, i) => {
    d.garantir(lead);
    const ultima = i === linhas.length - 1;
    const base = ln.reduce((s, pal) => s + lw(pal), 0);
    const e = !ultima && o.justificar !== false && ln.length > 1 ? (w - base) / (ln.length - 1) : esp;
    let x = x0; const y = d.y + t;
    ln.forEach((pal, k) => {
      const prox = ln[k + 1]; const fim = pal[pal.length - 1].tipo;
      pal.forEach((p, j) => {
        const pw = larg(p.t, f, t); const fundo = { conf: '#FFE29A', antigo: '#FAD4D0', num: '#E3E8F1' }[p.tipo];
        const estende = j === pal.length - 1 && prox && prox[0].tipo === fim && fundo;
        if (fundo) d.rect(x, d.y + 1, pw + (estende ? e : 0), lead - 2, fundo);
        d.texto(p.t, x, y, f, t, p.tipo === 'antigo' ? '#B3261E' : o.cor || '#1B2433');
        x += pw;
      });
      x += e;
    });
    d.y += lead;
  });
  d.y += o.depois ?? 5;
}

function cabecalhoDocumento(d, { tipo, obra, gabinete, departamento }) {
  const T = d.tema, f = obra.ficha;
  const meta = [['Dono de obra', f['Dono de obra']], ['Fase', f['Fase do projeto']], ['Gabinete', gabinete.nome], ['Departamento', departamento?.nome]];
  if (T.tipo === 'civil') {
    d.rect(0, 0, W, 168, T.marinho); d.rect(0, 168, W, 4, T.acento);
    d.rrect(M, 34, 26, 26, 7, T.acento);
    [[13, 6.5], [9, 11.6], [13, 16.7]].forEach(([w, dy], i) => d.rect(M + 6.5, 34 + dy, w, 2.8, i === 2 ? '#8A5200' : T.marinho));
    d.texto('Documentos de Civil', M + 36, 52, FONTES.sansB, 13, '#FFFFFF');
    d.texto(TIPOS[tipo].toUpperCase(), M, 94, FONTES.sansB, 9, T.acento);
    quebrar(nomeObra(obra), FONTES.sansB, 22, W - 2 * M).slice(0, 2).forEach((ln, i) => d.texto(ln, M, 118 + i * 26, FONTES.sansB, 22, '#FFFFFF'));
    const linhasMeta = meta.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('   |   ');
    quebrar(linhasMeta, FONTES.sans, 8.6, W - 2 * M).slice(0, 2).forEach((ln, i) => d.texto(ln, M, 154 + i * 11, FONTES.sans, 8.6, '#B5C5E3'));
  } else {
    d.rect(0, 0, W, 16, T.acento);
    d.texto(gabinete.nome, M, 62, FONTES.sansB, 20, T.titulo);
    d.texto([gabinete.nif && `NIF ${gabinete.nif}`, gabinete.localidade].filter(Boolean).join('   ·   '), M, 78, FONTES.sans, 9, '#5A6577');
    d.rect(M, 92, 54, 3, T.acento);
    d.texto(TIPOS[tipo].toUpperCase(), M, 122, FONTES.sansB, 9, T.titulo);
    quebrar(nomeObra(obra), FONTES.sansB, 22, W - 2 * M).slice(0, 2).forEach((ln, i) => d.texto(ln, M, 148 + i * 26, FONTES.sansB, 22, '#1B2433'));
    const linhasMeta = meta.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('   |   ');
    quebrar(linhasMeta, FONTES.sans, 8.6, W - 2 * M).slice(0, 2).forEach((ln, i) => d.texto(ln, M, 176 + i * 11, FONTES.sans, 8.6, '#5A6577'));
    d.y = 204;
  }
}

function conteudoDocumento(d, { tipo, obra, rascunho: r, marcas }) {
  const T = d.tema, cores = { conf: 'conf', antigo: 'antigo', num: 'num' };
  const pend = r.seccoes.filter(s => s.estado === 'pendente').length;
  const revisores = [...new Set(r.seccoes.map(s => s.revistoPor).filter(Boolean))].join(', ');
  const aviso = pend
    ? `RASCUNHO: ${pend} secção(ões) por rever. Gerado pelo Documentos de Civil em ${r.geradoEm}; deve ser validado e assinado pelo engenheiro responsável.`
    : `Todas as secções revistas${revisores ? ' por ' + revisores : ''}. Pronto para validação final e assinatura do engenheiro responsável.`;
  const linhasAviso = quebrar(aviso, FONTES.serifI, 10, W - 2 * M - 28);
  const hAviso = linhasAviso.length * 14 + 16;
  d.garantir(hAviso + 10);
  d.rect(M, d.y, W - 2 * M, hAviso, T.caixa); d.rect(M, d.y, 4, hAviso, T.acento);
  linhasAviso.forEach((ln, i) => d.texto(ln, M + 16, d.y + 17 + i * 14, FONTES.serifI, 10, '#3D4F6B'));
  d.y += hAviso + 16;
  r.seccoes.filter(s => s.estado !== 'rejeitada').forEach(s => {
    const tit = quebrar(s.titulo, FONTES.sansB, 13.5, W - 2 * M - 14);
    d.garantir(tit.length * 18 + 60);
    d.y += 6; d.rect(M, d.y + 1, 4, tit.length * 18 - 2, T.acento);
    tit.forEach((ln, i) => d.texto(ln, M + 14, d.y + 13 + i * 18, FONTES.sansB, 13.5, T.titulo));
    d.y += tit.length * 18 + 6;
    s.paragrafos.forEach(p => paragrafo(d, segmentar(p.texto, { antigos: marcas.antigos, numeros: s.estado === 'aceite' ? [] : p.numeros })
      .map(x => ({ t: x.t, tipo: cores[x.tipo] }))));
  });
  d.garantir(70); d.y += 34;
  d.linha(M, d.y, M + 200, d.y, '#1B2433', 0.7); d.texto('O Engenheiro Responsável', M, d.y + 14, FONTES.sans, 9.5, '#3D4F6B'); d.y += 30;
  // Anexo de rastreabilidade
  d.nova(false, { titulo: d.pag.titulo, subtitulo: d.pag.subtitulo });
  const NOMES = { reaproveitado: 'reaproveitado(s)', especifico: 'específico(s)', unico: 'de fonte única', editado: 'editado(s)', referencia: 'da referência' };
  d.texto('Anexo: origem do texto', M, d.y + 14, FONTES.sansB, 13.5, T.titulo); d.rect(M, d.y + 22, 40, 2.5, T.acento); d.y += 40;
  r.seccoes.forEach(s => {
    const c = {}; s.paragrafos.forEach(p => { c[p.tipo] = (c[p.tipo] || 0) + 1; });
    const resumo = Object.entries(c).map(([k, n]) => `${n} ${NOMES[k]}`).join(', ');
    const estado = s.estado === 'aceite' ? 'aceite' + (s.revistoPor ? ' por ' + s.revistoPor : '') : s.estado === 'rejeitada' ? 'rejeitada' : 'por rever';
    paragrafo(d, [{ t: s.titulo + ': ', tipo: null }, { t: `fonte ${s.fonteNome}; presente em ${s.presenca} obras; ${resumo}; ${estado}.`, tipo: null }],
      { fonte: FONTES.sans, tam: 9.2, lead: 13, justificar: false, depois: 5, cor: '#2A3547' });
  });
}

function fechar(d, tituloGeral) {
  const T = d.tema, total = d.paginas.length;
  d.paginas.forEach((p, i) => {
    d.pag = p;
    if (!p.primeira) {
      d.texto(p.titulo || '', M, 34, FONTES.sansB, 8.4, T.titulo);
      d.texto(p.subtitulo || '', W - M - larg(p.subtitulo || '', FONTES.sans, 8.4), 34, FONTES.sans, 8.4, '#6B778B');
      d.linha(M, 42, W - M, 42, T.acento, 1.1);
    }
    d.linha(M, H - 42, W - M, H - 42, '#D3DAE6', 0.7);
    d.texto(T.marca, M, H - 28, FONTES.sansB, 8.2, T.tipo === 'civil' ? '#8A5200' : T.titulo);
    const nr = `Página ${i + 1} de ${total}`; d.texto(nr, W - M - larg(nr, FONTES.sans, 8.2), H - 28, FONTES.sans, 8.2, '#6B778B');
  });
  void tituloGeral;
}

function paraBuffer(d, titulo, autor) {
  const objs = []; const add = c => { objs.push(c); return objs.length; };
  const catalogo = add(null), arvore = add(null);
  const fontes = Object.values(FONTES).map(f => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`));
  const recursos = `<< /Font << ${Object.values(FONTES).map((f, i) => `/${REF[f]} ${fontes[i]} 0 R`).join(' ')} >> >>`;
  const paginas = d.paginas.map(p => {
    const dados = zlib.deflateSync(Buffer.from(p.cmds.join('\n'), 'latin1'));
    const cont = add({ stream: dados });
    return add(`<< /Type /Page /Parent ${arvore} 0 R /MediaBox [0 0 ${n2(W)} ${n2(H)}] /Resources ${recursos} /Contents ${cont} 0 R >>`);
  });
  const u16 = s => '<FEFF' + Buffer.from(s, 'utf16le').swap16().toString('hex') + '>';
  const info = add(`<< /Title ${u16(titulo)} /Author ${u16(autor)} /Creator ${u16('Documentos de Civil')} >>`);
  objs[catalogo - 1] = `<< /Type /Catalog /Pages ${arvore} 0 R >>`;
  objs[arvore - 1] = `<< /Type /Pages /Kids [${paginas.map(p => p + ' 0 R').join(' ')}] /Count ${paginas.length} >>`;
  const partes = [Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'latin1')]; const pos = []; let off = partes[0].length;
  objs.forEach((o, i) => {
    pos.push(off);
    const b = o && o.stream
      ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${o.stream.length} /Filter /FlateDecode >>\nstream\n`), o.stream, Buffer.from('\nendstream\nendobj\n')])
      : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`);
    partes.push(b); off += b.length;
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalogo} 0 R /Info ${info} 0 R >>\nstartxref\n${off}\n%%EOF\n`;
  partes.push(Buffer.from(xref)); return Buffer.concat(partes);
}

// documentos: [{ tipo, obra, rascunho, marcas, departamento }]; tema: TEMA_CIVIL ou { tipo:'empresa', cor }
export function construirPdf({ gabinete, documentos, tema = 'civil', cor: corEmpresa }) {
  let T = TEMA_CIVIL;
  if (tema === 'empresa') {
    const c = /^#?[0-9a-fA-F]{6}$/.test(corEmpresa || '') ? '#' + corEmpresa.replace('#', '') : '#1F5FBF';
    T = { tipo: 'empresa', marinho: c, acento: c, titulo: escurecer(c), caixa: clarear(c, 0.9), marca: gabinete.nome };
  }
  const d = new Doc(T); d.paginas = [];
  documentos.forEach(dc => {
    d.nova(true, { titulo: `${TIPOS[dc.tipo]}`, subtitulo: nomeObra(dc.obra) });
    cabecalhoDocumento(d, { tipo: dc.tipo, obra: dc.obra, gabinete, departamento: dc.departamento });
    conteudoDocumento(d, dc);
  });
  fechar(d);
  const nome = nomeObra(documentos[0].obra);
  return paraBuffer(d, documentos.length === 1 ? `${TIPOS[documentos[0].tipo]} — ${nome}` : `Documentos — ${nome}`, gabinete.nome);
}
