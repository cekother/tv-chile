const fs = require('fs');
const path = require('path');
const input = process.argv[2] ?? path.join(__dirname, '..', 'canales.m3u');
const output = process.argv[3] ?? input;
const report = process.argv[4] ?? path.join(__dirname, '..', 'quitados.txt');

const DEFAULT_UA = 'VLC/3.0.18 LibVLC/3.0.18';
const TIMEOUT_MS = 20000;
const CONCURRENCY = 12;

function parse(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      current = { lines: [line], name: line.replace(/^.*,/, '').trim(), headers: {} };
    } else if (current && line.startsWith('#')) {
      current.lines.push(line);
      const ua = line.match(/^#EXTVLCOPT:http-user-agent=(.*)$/);
      const ref = line.match(/^#EXTVLCOPT:http-referrer=(.*)$/);
      if (ua) current.headers['User-Agent'] = ua[1].trim();
      if (ref) current.headers['Referer'] = ref[1].trim();
    } else if (current && line.trim()) {
      current.lines.push(line);
      current.url = line.trim();
      entries.push(current);
      current = null;
    }
  }
  return entries;
}

async function get(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': DEFAULT_UA, ...headers },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (size < 65536) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return { buf: Buffer.concat(chunks), finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
}

function firstUri(text, afterTag) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (afterTag) {
      if (line.startsWith(afterTag)) {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j] && !lines[j].startsWith('#')) return lines[j];
        }
      }
    } else if (line && !line.startsWith('#')) {
      return line;
    }
  }
  return null;
}

async function probe(entry) {
  let { buf, finalUrl } = await get(entry.url, entry.headers);
  let text = buf.toString('utf8');
  let depth = 0;
  while (text.trimStart().startsWith('#EXTM3U')) {
    if (depth++ > 3) throw new Error('playlist anidada');
    const isMaster = text.includes('#EXT-X-STREAM-INF');
    const uri = isMaster ? firstUri(text, '#EXT-X-STREAM-INF') : firstUri(text);
    if (!uri) throw new Error('playlist sin segmentos');
    const next = new URL(uri, finalUrl).toString();
    ({ buf, finalUrl } = await get(next, entry.headers));
    text = buf.toString('utf8');
    if (!isMaster) {
      if (buf.length < 188) throw new Error('segmento vacio');
      return;
    }
  }
  if (buf.length < 188) throw new Error('sin datos');
  if (/^\s*(<!doctype|<html)/i.test(text)) throw new Error('devuelve HTML');
}

async function check(entry) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await probe(entry);
      return null;
    } catch (err) {
      lastError = err.name === 'AbortError' ? 'timeout' : (err.cause?.code || err.message);
    }
  }
  return lastError;
}

async function main() {
  const entries = parse(fs.readFileSync(input, 'utf8'));
  const results = new Array(entries.length);
  let next = 0;
  async function worker() {
    while (next < entries.length) {
      const i = next++;
      results[i] = await check(entries[i]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const isCert = (e) => /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(String(e));
  const kept = entries.filter((_, i) => results[i] === null || isCert(results[i]));
  const dropped = entries
    .map((e, i) => ({ name: e.name, url: e.url, error: results[i] }))
    .filter((e) => e.error !== null && !isCert(e.error));
  const certs = entries.filter((_, i) => isCert(results[i])).map((e) => e.name);
  console.log(`certificado no verificable (se conservan): ${certs.join(', ') || 'ninguno'}`);

  const out = ['#EXTM3U', ...kept.flatMap((e) => e.lines)].join('\r\n') + '\r\n';
  fs.writeFileSync(output, out);
  fs.writeFileSync(report, dropped.map((d) => `${d.name} | ${d.error} | ${d.url}`).join('\n'));
  console.log(`total ${entries.length} | funcionan ${kept.length} | quitados ${dropped.length}`);
}

main();
