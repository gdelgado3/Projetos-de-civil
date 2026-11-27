// Teste de fumo da API: arranca o servidor com uma base de dados temporária
// e percorre o fluxo completo com dois utilizadores.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const porta = 3900 + Math.floor(Math.random() * 90);
const base = `http://localhost:${porta}`;
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-'));
const servidor = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
  env: { ...process.env, PORT: String(porta), DB_FICHEIRO: path.join(pasta, 'teste.db'), SUPERADMIN_EMAILS: 'ana@teste.pt', DEMO_CODIGO: 'codigo-demo-teste' }, stdio: ['ignore', 'pipe', 'inherit']
});
await new Promise(r => servidor.stdout.on('data', d => { if (String(d).includes('a correr')) r(); }));

// Cliente com cookie de sessão próprio
function cliente() {
  let cookie = '';
  return async (metodo, url, corpo, bruto = false) => {
    const r = await fetch(base + url, { method: metodo, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    if (bruto) return r;
    const j = await r.json(); if (!r.ok) { const e = new Error(j.erro); e.status = r.status; e.estado = j.estado; throw e; }
    return j;
  };
}
const passo = (n) => console.log('✓', n);
try {
  const ana = cliente(), rui = cliente();
  await ana('POST', '/api/registar', { nome: 'Ana', email: 'ana@teste.pt', senha: 'segredo123' });
  let eu = await ana('GET', '/api/eu'); assert.equal(eu.estado, 'sem_gabinete'); passo('registo → pede gabinete');
  await assert.rejects(ana('GET', '/api/obras'), e => e.estado === 'sem_gabinete'); passo('app bloqueada sem gabinete');

  await ana('POST', '/api/gabinetes', { nome: 'Gabinete Teste', descricao: 'Teste', plano: 'pequeno', exemplo: true,
    departamentos: [{ nome: 'Hidráulica', area: 'Hidráulica', descricao: 'x' }, { nome: 'Estruturas', area: 'Estruturas' }] });
  eu = await ana('GET', '/api/eu'); assert.equal(eu.estado, 'perfil_incompleto'); passo('gabinete criado → pede perfil');
  await assert.rejects(ana('GET', '/api/obras'), e => e.estado === 'perfil_incompleto'); passo('app bloqueada sem perfil');
  const depH = eu.gabineteAtivo.departamentos[0].id;
  await ana('PUT', '/api/perfil', { nome: 'Ana Silva', funcao: 'Coordenadora', departamentoId: depH });
  eu = await ana('GET', '/api/eu'); assert.equal(eu.estado, 'pronto'); passo('perfil completo → app');

  const { token } = await ana('POST', '/api/convites', { email: 'rui@teste.pt' }); passo('convite criado');
  const info = await rui('GET', `/api/convites/${token}`); assert.equal(info.gabinete, 'Gabinete Teste');
  await rui('POST', '/api/registar', { nome: 'Rui', email: 'rui@teste.pt', senha: 'segredo123' });
  await rui('POST', `/api/convites/${token}/aceitar`);
  assert.equal((await rui('GET', '/api/eu')).estado, 'perfil_incompleto'); passo('convidado entra → pede perfil');
  await rui('PUT', '/api/perfil', { nome: 'Rui Costa', funcao: 'Projetista', departamentoId: depH });
  await assert.rejects(rui('POST', '/api/convites', { email: 'x@y.pt' }), e => e.status === 403); passo('membro não convida');
  await ana('POST', '/api/convites', { email: 'c@teste.pt' });
  await assert.rejects(ana('POST', '/api/convites', { email: 'd@teste.pt' }), /plano Pequeno/); passo('limite do plano respeitado');

  // Rui abre o stream do chat e recebe a mensagem de geração feita pela Ana
  const stream = await rui('GET', '/api/chat/stream', undefined, true);
  const leitor = stream.body.getReader(); let recebido = '';
  const esperar = (async () => { while (!recebido.includes('gerou a memória')) { const { value } = await leitor.read(); recebido += new TextDecoder().decode(value); } })();

  const obras = await ana('GET', '/api/obras'); assert.equal(obras.length, 1);
  const oid = obras[0].id;
  let o = await ana('POST', `/api/obras/${oid}/gerar/memoria`);
  const doc = o.documentos.memoria; assert.ok(doc.reaproveitado > 50); assert.equal(doc.alertas.antigos.length, 1);
  passo(`memória gerada (${doc.reaproveitado}% reaproveitado, 1 dado antigo detetado)`);
  await Promise.race([esperar, new Promise((_, rej) => setTimeout(() => rej(new Error('o chat não chegou em tempo real')), 3000))]);
  await leitor.cancel(); passo('chat em tempo real chegou ao Rui');

  await assert.rejects(rui('POST', `/api/obras/${oid}/rascunhos/memoria/seccoes/0/aceitar`), /A CONFIRMAR/); passo('aceitar bloqueado com [A CONFIRMAR]');
  o = await rui('POST', `/api/obras/${oid}/rascunhos/memoria/seccoes/3/aceitar`);
  assert.equal(o.documentos.memoria.rascunho.seccoes[3].revistoPor, 'Rui Costa'); passo('secção aceite com nome do revisor');
  await rui('POST', `/api/obras/${oid}/gerar/calculos`); passo('cálculos gerados');

  const r = await ana('GET', `/api/obras/${oid}/rascunhos/memoria/docx`, undefined, true);
  assert.equal(r.status, 200); const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(path.join(pasta, 'memoria.docx'), buf); console.log('  docx em', path.join(pasta, 'memoria.docx'));
  passo('Word exportado');

  await rui('POST', '/api/chat', { texto: 'Revi a secção 4.', anexo: { tipo: 'rascunho', obraId: oid, docTipo: 'memoria' } });
  const msgs = await ana('GET', '/api/chat'); assert.ok(msgs.some(m => m.texto === 'Revi a secção 4.' && m.anexo?.titulo.startsWith('Memória')));
  passo(`chat com partilha (${msgs.length} mensagens)`);

  // Outro gabinete não vê nada deste
  const eva = cliente();
  await eva('POST', '/api/registar', { nome: 'Eva', email: 'eva@teste.pt', senha: 'segredo123' });
  await eva('POST', '/api/gabinetes', { nome: 'Outro', descricao: 'x', departamentos: [{ nome: 'Geo', area: 'Geotecnia' }] });
  const e2 = await eva('GET', '/api/eu'); await eva('PUT', '/api/perfil', { nome: 'Eva', funcao: 'x', departamentoId: e2.gabineteAtivo.departamentos[0].id });
  await assert.rejects(eva('GET', `/api/obras/${oid}`), e => e.status === 404);
  assert.equal((await eva('GET', '/api/chat')).some(m => m.texto.includes('Revi')), false); passo('gabinetes isolados');
  // Administração da plataforma e apagar contas
  await assert.rejects(rui('GET', '/api/plataforma'), e => e.status === 403);
  const pl = await ana('GET', '/api/plataforma'); assert.equal(pl.gabinetes.length, 2); passo('painel de administração só para a Ana');
  await assert.rejects(rui('DELETE', '/api/conta', { senha: 'errada' }), /palavra-passe/);
  await rui('DELETE', '/api/conta', { senha: 'segredo123' });
  assert.equal((await rui('GET', '/api/eu')).utilizador, null);
  assert.ok((await ana('GET', '/api/chat')).some(m => m.texto.includes('apagou a conta'))); passo('o Rui apagou a própria conta');
  const limpo = await ana('POST', '/api/plataforma/limpar', { confirmacao: 'APAGAR' });
  assert.deepEqual(limpo, { gabinetes: 1, utilizadores: 1 });
  assert.equal((await ana('GET', '/api/obras')).length, 1); passo('limpar a demo apagou a Eva e o gabinete dela, manteve a Ana');
  // Entrada por código (QR): cada visitante ganha um gabinete de exemplo só seu
  const entrarDemo = async (codigo, cookie) => fetch(`${base}/demo?codigo=${codigo}`, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
  assert.equal((await entrarDemo('errado')).status, 403); passo('código de demo errado é recusado');
  const d1 = await entrarDemo('codigo-demo-teste'); assert.equal(d1.status, 302); assert.equal(d1.headers.get('location'), '/#/app/obras');
  const c1 = d1.headers.get('set-cookie').split(';')[0];
  const v1 = async (m, u, b) => { const r = await fetch(base + u, { method: m, headers: { Cookie: c1, ...(b ? { 'Content-Type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
  assert.equal((await v1('GET', '/api/eu')).estado, 'pronto');
  const obrasV1 = await v1('GET', '/api/obras'); assert.equal(obrasV1.length, 1);
  const gV1 = await v1('POST', `/api/obras/${obrasV1[0].id}/gerar/calculos`); assert.ok(gV1.documentos.calculos.rascunho.seccoes.length > 0);
  passo('código certo: entra já com perfil, obra e projetos de exemplo, e gera os cálculos');
  assert.equal((await entrarDemo('codigo-demo-teste', c1)).headers.get('set-cookie'), null);
  assert.equal((await ana('GET', '/api/plataforma')).utilizadores.filter(u => u.email.endsWith('@demo.local')).length, 1); passo('voltar a ler o QR não cria outra conta');
  const d2 = await entrarDemo('codigo-demo-teste'); const c2 = d2.headers.get('set-cookie').split(';')[0];
  const eu2 = await (await fetch(base + '/api/eu', { headers: { Cookie: c2 } })).json();
  const eu1 = await v1('GET', '/api/eu');
  assert.notEqual(eu1.gabineteAtivo.id, eu2.gabineteAtivo.id);
  assert.equal((await fetch(`${base}/api/obras/${obrasV1[0].id}`, { headers: { Cookie: c2 } })).status, 404); passo('dois visitantes ficam isolados um do outro');
  const limpoDemo = await ana('POST', '/api/plataforma/limpar', { confirmacao: 'APAGAR' });
  assert.deepEqual(limpoDemo, { gabinetes: 2, utilizadores: 2 }); passo('limpar a demo apaga as contas e gabinetes dos visitantes');
  console.log('\nTudo certo.');
} catch (e) { console.error('✗', e); process.exitCode = 1; }
finally { servidor.kill(); }
