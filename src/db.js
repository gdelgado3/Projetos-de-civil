// Base de dados SQLite (módulo node:sqlite, sem dependências nativas)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ficheiro = process.env.DB_FICHEIRO || path.resolve('dados/documentos-civil.db');
if (ficheiro !== ':memory:') fs.mkdirSync(path.dirname(ficheiro), { recursive: true });
export const db = new DatabaseSync(ficheiro);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS utilizadores (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, senha TEXT NOT NULL, criado_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY, utilizador_id TEXT NOT NULL REFERENCES utilizadores(id) ON DELETE CASCADE,
  gabinete_id TEXT, expira INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS gabinetes (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, nif TEXT, localidade TEXT, descricao TEXT,
  plano TEXT NOT NULL, campos TEXT NOT NULL, criado_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS departamentos (
  id TEXT PRIMARY KEY, gabinete_id TEXT NOT NULL REFERENCES gabinetes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, area TEXT, descricao TEXT);
CREATE TABLE IF NOT EXISTS membros (
  gabinete_id TEXT NOT NULL REFERENCES gabinetes(id) ON DELETE CASCADE,
  utilizador_id TEXT NOT NULL REFERENCES utilizadores(id) ON DELETE CASCADE,
  papel TEXT NOT NULL, funcao TEXT, departamento_id TEXT, telefone TEXT,
  perfil_completo INTEGER NOT NULL DEFAULT 0, entrou_em TEXT NOT NULL,
  PRIMARY KEY (gabinete_id, utilizador_id));
CREATE TABLE IF NOT EXISTS convites (
  token TEXT PRIMARY KEY, gabinete_id TEXT NOT NULL REFERENCES gabinetes(id) ON DELETE CASCADE,
  email TEXT NOT NULL, papel TEXT NOT NULL, criado_por TEXT, criado_em TEXT NOT NULL, aceite_em TEXT);
CREATE TABLE IF NOT EXISTS projetos (
  id TEXT PRIMARY KEY, gabinete_id TEXT NOT NULL REFERENCES gabinetes(id) ON DELETE CASCADE,
  departamento_id TEXT, nome TEXT NOT NULL, ano TEXT, ficha TEXT NOT NULL, documentos TEXT NOT NULL, atualizado_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS obras (
  id TEXT PRIMARY KEY, gabinete_id TEXT NOT NULL REFERENCES gabinetes(id) ON DELETE CASCADE,
  departamento_id TEXT, ficha TEXT NOT NULL, criado_por TEXT, criado_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rascunhos (
  obra_id TEXT NOT NULL REFERENCES obras(id) ON DELETE CASCADE, tipo TEXT NOT NULL,
  dados TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (obra_id, tipo));
CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT, gabinete_id TEXT NOT NULL REFERENCES gabinetes(id) ON DELETE CASCADE,
  utilizador_id TEXT, texto TEXT NOT NULL, anexo TEXT, criado_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_mensagens ON mensagens(gabinete_id, id);
`);

export const um = (sql, ...p) => db.prepare(sql).get(...p);
export const todos = (sql, ...p) => db.prepare(sql).all(...p);
export const correr = (sql, ...p) => db.prepare(sql).run(...p);
export const agora = () => new Date().toISOString();
export const novoId = () => randomUUID();
// Corre várias escritas de uma vez: ou todas ficam, ou nenhuma
export function transacao(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
