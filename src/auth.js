// Contas e sessões: palavra-passe com scrypt, sessão num cookie HttpOnly
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { um, correr } from './db.js';

const DURACAO_MS = 30 * 24 * 3600 * 1000; // 30 dias

export function hashSenha(senha) {
  const sal = randomBytes(16).toString('hex');
  return sal + ':' + scryptSync(senha, sal, 64).toString('hex');
}
export function verificarSenha(senha, guardado) {
  const [sal, hex] = String(guardado).split(':');
  const a = scryptSync(senha, sal, 64), b = Buffer.from(hex || '', 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
function cookie(token, maxAge) {
  const seguro = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `sessao=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${seguro}`;
}
export function criarSessao(res, utilizadorId) {
  const token = randomBytes(32).toString('hex');
  correr('INSERT INTO sessoes (token, utilizador_id, gabinete_id, expira) VALUES (?, ?, NULL, ?)', token, utilizadorId, Date.now() + DURACAO_MS);
  res.setHeader('Set-Cookie', cookie(token, DURACAO_MS / 1000));
}
function lerCookie(req, nome) {
  const par = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(nome + '='));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : null;
}
export function sessaoDe(req) {
  const token = lerCookie(req, 'sessao'); if (!token) return null;
  const s = um('SELECT * FROM sessoes WHERE token = ?', token);
  if (!s || s.expira < Date.now()) return null;
  return s;
}
export function terminarSessao(req, res) {
  const token = lerCookie(req, 'sessao');
  if (token) correr('DELETE FROM sessoes WHERE token = ?', token);
  res.setHeader('Set-Cookie', cookie('', 0));
}
