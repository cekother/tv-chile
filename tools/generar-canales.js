const fs = require('fs');
const path = require('path');
const { icon } = require('./png');

const playlistPath = process.argv[2] ?? path.join(__dirname, '..', 'canales.m3u');
const outDir = process.argv[3] ?? path.join(__dirname, '..');

const MOVIES = 'Películas y series';
const ENTERTAINMENT = 'Entretenimiento';
const CULTURE = 'Cultura y educación';
const NORTH = 'Regiones norte';
const CENTER = 'Regiones centro';
const SOUTH = 'Regiones sur y Patagonia';
const REGIONAL = 'Otros regionales';
const RADIO = 'Radios';
const RELIGION = 'Religión';

// Categoría según el group-title de la lista; lo que no aparece aquí queda como regional.
const GROUP_NAMES = {
  Nacionales: 'Nacionales', Peliculas: MOVIES, Novelas: 'Novelas', Paraguay: 'Paraguay', News: 'Noticias', Legislative: 'Noticias', Sports: 'Deportes',
  Animation: 'Infantil', Kids: 'Infantil',
  Entertainment: ENTERTAINMENT, Family: ENTERTAINMENT, Movies: ENTERTAINMENT, Series: ENTERTAINMENT,
  Comedy: ENTERTAINMENT, Classic: ENTERTAINMENT, Lifestyle: ENTERTAINMENT, Cooking: ENTERTAINMENT,
  Shop: ENTERTAINMENT, Auto: ENTERTAINMENT, Relax: ENTERTAINMENT,
  Culture: CULTURE, Documentary: CULTURE, Education: CULTURE, Science: CULTURE, Travel: CULTURE,
  Outdoor: CULTURE, Business: CULTURE, Weather: CULTURE,
  Music: 'Música', Religious: RELIGION,
};
// Canales cuya categoría de origen no sirve: se ubican por nombre.
const BY_NAME = {
  'TV+': 'Nacionales',
  'CHV Noticias': 'Noticias', '24 Horas': 'Noticias', Cooperativa: 'Noticias', 'Bio Bio TV': 'Noticias',
  'TV Senado (Chile)': 'Noticias',
  'TCM Latin America Chile': ENTERTAINMENT, 'Tendencias Prime': ENTERTAINMENT, 'EPA! TV': ENTERTAINMENT,
  CampusTV: CULTURE, 'TV UCT': CULTURE, TVU: CULTURE,
  'Antofagasta TV': NORTH, 'Caldera Vision': NORTH, 'Iquique TV': NORTH, 'Maray TV': NORTH,
  'Holvoet TV': NORTH, 'Thema Television': NORTH,
  'Marga Marga TV': CENTER, 'Canal 30 Loncomilla': CENTER, 'En Linea Maule': CENTER,
  'Lila TV Pencahue': CENTER, 'TV5 Linares': CENTER, 'Pichilemu TV': CENTER,
  'VTV Valle de Aconcagua': CENTER, 'Estacion Limache TV': CENTER, 'TVR (Chile)': CENTER, 'Islita TV': CENTER,
  'Aysen TV': SOUTH, 'Canal 1 Nuble': SOUTH, 'RTV Nuble': SOUTH, 'San Nicolas TV': SOUTH,
  'Concepcion TV': SOUTH, 'El 3 de Conce': SOUTH, 'Canal 9 Bio-Bio Television': SOUTH, Teleangol: SOUTH,
  'Pucon TV': SOUTH, 'Canal 5 Puerto Montt': SOUTH, 'Decima TV': SOUTH, 'Canal Chilote': SOUTH,
  'Chiloe Red 25': SOUTH, 'Canal 2 Quellon': SOUTH, 'Canal Survision Alerce': SOUTH,
  'Mundos Lacustres TV': SOUTH, 'SUR TV': SOUTH, 'Surena TV': SOUTH, 'Coyhaique TV': SOUTH,
  'ITV Patagonia': SOUTH, 'Polar TV (Chile)': SOUTH, 'Santa Maria Television': SOUTH,
};
const GROUP_ORDER = ['Nacionales', 'Noticias', 'Deportes', MOVIES, 'Novelas', ENTERTAINMENT, 'Infantil', CULTURE,
  NORTH, CENTER, SOUTH, REGIONAL, 'Paraguay', 'Música', RADIO, RELIGION];

function groupOf(name, rawGroup) {
  if (BY_NAME[name]) return BY_NAME[name];
  const group = GROUP_NAMES[rawGroup] ?? REGIONAL;
  if (group !== RELIGION && /\bradio\b|\bFM\b/i.test(name)) return RADIO;
  return group;
}
const BAD_CERT = ['Arica TV', 'Juntos TV (Chile)'];

const lines = fs.readFileSync(playlistPath, 'utf8').split(/\r?\n/);
const channels = [];
const skipped = { http: [], headers: [], cert: [] };
let current = null;
for (const line of lines) {
  if (line.startsWith('#EXTINF')) {
    const rawGroup = (line.match(/group-title="([^"]*)"/)?.[1] ?? '').split(';')[0];
    const name = line.replace(/^.*,/, '').replace(/\s*\(\d+[pi]\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
    current = { name, group: groupOf(name, rawGroup), logo: line.match(/tvg-logo="(https:[^"]*)"/)?.[1] };
  } else if (current && line.startsWith('#EXTVLCOPT')) {
    current.needsHeaders = true;
  } else if (current && line.trim() && !line.startsWith('#')) {
    current.url = line.trim();
    if (current.needsHeaders) skipped.headers.push(current.name);
    else if (!current.url.startsWith('https://')) skipped.http.push(current.name);
    else if (BAD_CERT.includes(current.name)) skipped.cert.push(current.name);
    else channels.push({ name: current.name, group: current.group, url: current.url, logo: current.logo });
    current = null;
  }
}
channels.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
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
