// Atualiza o prices.json com as diárias do motor de reservas (Omnibees) do Mikiki.
// Roda sozinho no GitHub Actions todo dia (veja .github/workflows/update-prices.yml).
import { writeFileSync } from 'node:fs';

const HOTEL = 21743, CURRENCY = 16, DAYS = 365, CHUNK = 88, DAY = 864e5;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const now = new Date();
const d0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const last = d0 + (DAYS - 1) * DAY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': 'https://book.omnibees.com/hotel/' + HOTEL,
      } });
      if (r.ok) return await r.json();
      console.error('HTTP ' + r.status + ' em ' + url);
    } catch (e) { console.error(String(e)); }
    await sleep(1500 * (i + 1));
  }
  throw new Error('Falha ao ler o motor: ' + url);
}

const p = new Array(DAYS).fill(null);
const m = new Array(DAYS).fill(0);
for (let s = d0; s <= last; s += CHUNK * DAY) {
  const e = Math.min(s + (CHUNK - 1) * DAY, last);
  const url = 'https://book.omnibees.com/availability_v4/q/' + HOTEL + '/' + CURRENCY + '/' + iso(s) + '/' + iso(e) + '/2/0/0';
  const list = await get(url);
  if (!Array.isArray(list)) throw new Error('Resposta inesperada do motor');
  for (const it of list) {
    const i = Math.round((Date.parse(it.date) - d0) / DAY);
    if (i < 0 || i >= DAYS) continue;
    if (it.status === 'Open' && it.price > 0) {
      p[i] = it.price;
      m[i] = (it.restrictions && it.restrictions[0] && it.restrictions[0].Time) || 0;
    }
  }
  await sleep(400);
}

const ok = p.filter((v) => v !== null).length;
console.log('Dias com preço: ' + ok + ' de ' + DAYS);
if (ok < 60) { console.error('Poucos dias lidos; prices.json NÃO foi alterado.'); process.exit(1); }

writeFileSync('prices.json', JSON.stringify({ d0: iso(d0), gerado: new Date().toISOString(), p, m }));
console.log('prices.json atualizado.');
