// Chamadas à API do servidor

export async function api(metodo, url, corpo) {
  const binario = corpo instanceof Blob || corpo instanceof ArrayBuffer;
  const r = await fetch(url, {
    method: metodo,
    credentials: 'same-origin',
    headers: corpo === undefined ? {} : { 'Content-Type': binario ? 'application/octet-stream' : 'application/json' },
    body: corpo === undefined ? undefined : binario ? corpo : JSON.stringify(corpo)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.erro || `Erro ${r.status}`); e.status = r.status; e.estado = j.estado;
    // Sessão terminada ou passo do fluxo em falta: volta ao início para o router decidir
    if ((r.status === 401 && url !== '/api/entrar') || j.estado) setTimeout(() => window.dispatchEvent(new Event('recarregar')), 0);
    throw e;
  }
  return j;
}

// Descarrega um ficheiro gerado pelo servidor (ex.: o Word)
export async function descarregar(url) {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.erro || 'Não foi possível descarregar.'); }
  const nome = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'documento.docx';
  const blob = await r.blob(); const link = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = link; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(link), 2000);
}
