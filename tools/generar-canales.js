const fs = require('fs');
const path = require('path');
const { icon } = require('./png');

const playlistPath = process.argv[2] ?? path.join(__dirname, '..', 'canales.m3u');
const outDir = process.argv[3] ?? path.join(__dirname, '..');

const GROUP_NAMES = {
  Nacionales: 'Nacionales', General: 'General', News: 'Noticias', Sports: 'Deportes',
  Animation: 'Infantil', Kids: 'Infantil', Family: 'Familia', Movies: 'Cine', Series: 'Series',
  Entertainment: 'Entretenimiento', Comedy: 'Humor', Music: 'Música', Culture: 'Cultura',
  Documentary: 'Documentales', Education: 'Educación', Science: 'Ciencia', Religious: 'Religión',
  Legislative: 'Legislativo', Lifestyle: 'Estilo de vida', Travel: 'Viajes', Outdoor: 'Aire libre',
  Cooking: 'Cocina', Business: 'Negocios', Classic: 'Clásicos', Shop: 'Compras', Auto: 'Motor',
  Relax: 'Relax', Weather: 'Clima',
};
const GROUP_ORDER = ['Nacionales', 'General', 'Noticias', 'Deportes'];
const OTHER = 'Otros';
const BAD_CERT = ['Arica TV', 'Juntos TV (Chile)'];

const rank = (g) => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : g === OTHER ? 1000 : 100);

const lines = fs.readFileSync(playlistPath, 'utf8').split(/\r?\n/);
const channels = [];
const skipped = { http: [], headers: [], cert: [] };
let current = null;
for (const line of lines) {
  if (line.startsWith('#EXTINF')) {
    const rawGroup = (line.match(/group-title="([^"]*)"/)?.[1] ?? '').split(';')[0];
    current = {
      name: line.replace(/^.*,/, '').replace(/\s*\(\d+[pi]\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim(),
      group: GROUP_NAMES[rawGroup] ?? OTHER,
    };
  } else if (current && line.startsWith('#EXTVLCOPT')) {
    current.needsHeaders = true;
  } else if (current && line.trim() && !line.startsWith('#')) {
    current.url = line.trim();
    if (current.needsHeaders) skipped.headers.push(current.name);
    else if (!current.url.startsWith('https://')) skipped.http.push(current.name);
    else if (BAD_CERT.includes(current.name)) skipped.cert.push(current.name);
    else channels.push({ name: current.name, group: current.group, url: current.url });
    current = null;
  }
}
channels.sort((a, b) => rank(a.group) - rank(b.group) || a.group.localeCompare(b.group, 'es'));
fs.writeFileSync(path.join(outDir, 'channels.js'), 'window.CANALES = ' + JSON.stringify(channels) + ';\n');

fs.writeFileSync(path.join(outDir, 'icon-192.png'), icon(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), icon(512));

console.log(`canales: ${channels.length}`);
console.log(`fuera por http sin cifrar (${skipped.http.length}): ${skipped.http.join(', ')}`);
console.log(`fuera por requerir cabeceras (${skipped.headers.length}): ${skipped.headers.join(', ')}`);
console.log(`fuera por certificado (${skipped.cert.length}): ${skipped.cert.join(', ')}`);
const groups = {};
for (const c of channels) groups[c.group] = (groups[c.group] ?? 0) + 1;
console.log(JSON.stringify(groups));
