// Ler e escrever ficheiros Word (.docx) sem bibliotecas externas.
// Um .docx é um ZIP com XML: escrevemos um ZIP sem compressão e lemos com o zlib do Node.
import zlib from 'node:zlib';
import { TIPOS, segmentar, nomeObra } from './motor.js';

// ===== ZIP =====
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function criarZip(ficheiros) {
  const partes = [], central = []; let pos = 0;
  for (const f of ficheiros) {
    const nome = Buffer.from(f.nome, 'utf8'), dados = Buffer.from(f.conteudo, 'utf8'), crc = crc32(dados);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(0, 8);
    loc.writeUInt16LE(0, 10); loc.writeUInt16LE(33, 12); loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(dados.length, 18);
    loc.writeUInt32LE(dados.length, 22); loc.writeUInt16LE(nome.length, 26); loc.writeUInt16LE(0, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(0, 10); cen.writeUInt16LE(0, 12); cen.writeUInt16LE(33, 14); cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(dados.length, 20); cen.writeUInt32LE(dados.length, 24); cen.writeUInt16LE(nome.length, 28);
    cen.writeUInt32LE(pos, 42);
    partes.push(loc, nome, dados); central.push(cen, nome);
    pos += 30 + nome.length + dados.length;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(ficheiros.length, 8); fim.writeUInt16LE(ficheiros.length, 10);
  fim.writeUInt32LE(tamCentral, 12); fim.writeUInt32LE(pos, 16);
  return Buffer.concat([...partes, ...central, fim]);
}

// ===== Escrever .docx =====
function xmlEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function pXml(runs, op = {}) {
  const titulo = op.nivel !== undefined;
  const pPr = `<w:pPr>${op.quebra ? '<w:pageBreakBefore/>' : ''}${titulo ? '<w:keepNext/>' : ''}<w:spacing w:before="${titulo ? 240 : 0}" w:after="120"/>${op.jc ? `<w:jc w:val="${op.jc}"/>` : ''}${titulo ? `<w:outlineLvl w:val="${op.nivel}"/>` : ''}</w:pPr>`;
  const rs = runs.map(r => `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${r.b ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${r.cor ? `<w:color w:val="${r.cor}"/>` : ''}<w:sz w:val="${r.sz || 22}"/>${r.hl ? `<w:highlight w:val="${r.hl}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xmlEsc(r.t)}</w:t></w:r>`).join('');
  return `<w:p>${pPr}${rs}</w:p>`;
}
const NOMES_TIPO_PAR = { reaproveitado: 'reaproveitado(s)', especifico: 'específico(s)', unico: 'de fonte única', editado: 'editado(s)', referencia: 'da referência' };

export function construirDocx({ gabinete, departamento, obra, rascunho: r, tipo, marcas }) {
  const f = obra.ficha; const P = [];
  P.push(pXml([{ t: TIPOS[tipo].toUpperCase(), b: 1, sz: 32, cor: '175FAA' }], { jc: 'center' }));
  P.push(pXml([{ t: nomeObra(obra), b: 1, sz: 28 }], { jc: 'center' }));
  [['Dono de obra', f['Dono de obra']], ['Fase', f['Fase do projeto']], ['Gabinete', gabinete.nome], ['Departamento', departamento?.nome]]
    .forEach(([k, v]) => P.push(pXml([{ t: k + ': ', b: 1 }, v ? { t: v } : { t: '[A CONFIRMAR]', hl: 'yellow' }])));
  const pend = r.seccoes.filter(s => s.estado === 'pendente').length;
  const revisores = [...new Set(r.seccoes.map(s => s.revistoPor).filter(Boolean))].join(', ');
  P.push(pXml([{ t: pend
    ? `RASCUNHO — ${pend} secção(ões) por rever. Gerado pelo Documentos de Civil em ${r.geradoEm}; deve ser validado e assinado pelo engenheiro responsável.`
    : `Todas as secções revistas${revisores ? ' por ' + revisores : ''}. Pronto para validação final e assinatura do engenheiro responsável.`, i: 1, cor: '3D4F6B' }]));
  const cores = { conf: 'yellow', antigo: 'red', num: 'lightGray' };
  r.seccoes.filter(s => s.estado !== 'rejeitada').forEach(s => {
    P.push(pXml([{ t: s.titulo, b: 1, sz: 26, cor: '175FAA' }], { nivel: 0 }));
    s.paragrafos.forEach(p => P.push(pXml(
      segmentar(p.texto, { antigos: marcas.antigos, numeros: s.estado === 'aceite' ? [] : p.numeros }).map(x => ({ t: x.t, hl: cores[x.tipo] })),
      { jc: 'both' })));
  });
  P.push(pXml([{ t: '' }]), pXml([{ t: 'O Engenheiro Responsável' }]), pXml([{ t: '______________________________' }]));
  // Anexo de rastreabilidade: de onde veio cada secção
  P.push(pXml([{ t: 'Anexo — Origem do texto', b: 1, sz: 26, cor: '175FAA' }], { nivel: 0, quebra: true }));
  r.seccoes.forEach(s => {
    const c = {}; s.paragrafos.forEach(p => { c[p.tipo] = (c[p.tipo] || 0) + 1; });
    const resumo = Object.entries(c).map(([k, n]) => `${n} ${NOMES_TIPO_PAR[k]}`).join(', ');
    const estado = s.estado === 'aceite' ? 'aceite' + (s.revistoPor ? ' por ' + s.revistoPor : '') : s.estado === 'rejeitada' ? 'rejeitada' : 'por rever';
    P.push(pXml([{ t: s.titulo + ': ', b: 1 }, { t: `fonte ${s.fonteNome}; presente em ${s.presenca} obras; ${resumo}; ${estado}.` }]));
  });
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${P.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return criarZip([
    { nome: '[Content_Types].xml', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { nome: '_rels/.rels', conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { nome: 'word/document.xml', conteudo: documento }
  ]);
}

// ===== Ler .docx =====
// Devolve o texto com os títulos marcados com «# », pronto para textoParaSeccoes
export function lerDocx(buf) {
  let fim = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error('O ficheiro não parece ser um .docx.');
  const n = buf.readUInt16LE(fim + 10); let p = buf.readUInt32LE(fim + 16); let entrada = null;
  for (let k = 0; k < n; k++) {
    const lNome = buf.readUInt16LE(p + 28), lExtra = buf.readUInt16LE(p + 30), lCom = buf.readUInt16LE(p + 32);
    if (buf.toString('utf8', p + 46, p + 46 + lNome) === 'word/document.xml')
      entrada = { metodo: buf.readUInt16LE(p + 10), tam: buf.readUInt32LE(p + 20), off: buf.readUInt32LE(p + 42) };
    p += 46 + lNome + lExtra + lCom;
  }
  if (!entrada) throw new Error('Não encontrei o texto dentro do .docx.');
  const ini = entrada.off + 30 + buf.readUInt16LE(entrada.off + 26) + buf.readUInt16LE(entrada.off + 28);
  const bytes = buf.subarray(ini, ini + entrada.tam);
  const xml = (entrada.metodo === 0 ? bytes : zlib.inflateRawSync(bytes)).toString('utf8');
  const desesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const pars = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  return pars.map(par => {
    const estilo = (par.match(/<w:pStyle w:val="([^"]*)"/) || [])[1] || '';
    const texto = desesc((par.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')).trim();
    if (!texto) return '';
    return /heading|t[ií]tulo|ttulo|title/i.test(estilo) ? '# ' + texto : texto;
  }).filter(Boolean).join('\n\n');
}
