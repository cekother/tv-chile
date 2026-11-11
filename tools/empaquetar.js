// Genera los paquetes instalables en dist/: Android (.apk), LG webOS (.ipk) y Samsung Tizen (carpeta de proyecto).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { icon } = require('./png');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const DIST = path.join(ROOT, 'dist');
const WEB_FILES = ['index.html', 'hls.min.js', 'channels.js', 'icon-192.png', 'icon-512.png'];

const JAVA_HOME = process.env.JAVA_HOME || 'C:/aw/jdk';
const ANDROID_HOME = process.env.ANDROID_HOME || 'C:/aw/android-sdk';
const WEBOS_CLI = process.env.WEBOS_CLI || 'C:/aw/webos-cli/node_modules/@webos-tools/cli/bin/ares-package.js';
const KEYSTORE = process.env.TVCHILE_KEYSTORE || 'C:/aw/keys/tv-chile.jks';
const KEYSTORE_PASS = process.env.TVCHILE_KEYSTORE_PASS || 'android';
const BUILD_TOOLS = path.join(ANDROID_HOME, 'build-tools', '34.0.0');
const PLATFORM_JAR = path.join(ANDROID_HOME, 'platforms', 'android-34', 'android.jar');

const run = (file, args, options) => execFileSync(file, args, { stdio: ['ignore', 'pipe', 'inherit'], ...options });
const java = (...args) => run(path.join(JAVA_HOME, 'bin', 'java.exe'), args);
const tool = (name) => path.join(BUILD_TOOLS, `${name}.exe`);

function reset(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyWeb(target) {
  fs.mkdirSync(target, { recursive: true });
  for (const file of WEB_FILES) fs.copyFileSync(path.join(ROOT, file), path.join(target, file));
}

function filesUnder(dir, extension) {
  return fs
    .readdirSync(dir, { recursive: true })
    .map((entry) => path.join(dir, entry))
    .filter((file) => file.endsWith(extension));
}

function buildAndroid() {
  const out = path.join(BUILD, 'android');
  reset(out);
  copyWeb(path.join(out, 'assets'));

  const res = path.join(out, 'res');
  fs.mkdirSync(path.join(res, 'mipmap-xxxhdpi'), { recursive: true });
  fs.mkdirSync(path.join(res, 'drawable-xhdpi'), { recursive: true });
  fs.writeFileSync(path.join(res, 'mipmap-xxxhdpi', 'ic_launcher.png'), icon(192));
  fs.writeFileSync(path.join(res, 'drawable-xhdpi', 'banner.png'), icon(320, 180));

  const resZip = path.join(out, 'res.zip');
  const unsigned = path.join(out, 'unsigned.apk');
  const aligned = path.join(out, 'aligned.apk');
  const gen = path.join(out, 'gen');
  const classes = path.join(out, 'classes');
  const dex = path.join(out, 'dex');
  for (const dir of [gen, classes, dex]) fs.mkdirSync(dir);

  run(tool('aapt2'), ['compile', '--dir', res, '-o', resZip]);
  run(tool('aapt2'), [
    'link', '-o', unsigned, '-I', PLATFORM_JAR,
    '--manifest', path.join(ROOT, 'android', 'AndroidManifest.xml'),
    '-A', path.join(out, 'assets'), '--java', gen,
    '--min-sdk-version', '21', '--target-sdk-version', '34',
    '--version-code', '1', '--version-name', '1.0.0',
    resZip,
  ]);

  const sources = [...filesUnder(path.join(ROOT, 'android', 'src'), '.java'), ...filesUnder(gen, '.java')];
  run(path.join(JAVA_HOME, 'bin', 'javac.exe'), [
    '-source', '8', '-target', '8', '-Xlint:-options', '-cp', PLATFORM_JAR, '-d', classes, ...sources,
  ]);
  java('-cp', path.join(BUILD_TOOLS, 'lib', 'd8.jar'), 'com.android.tools.r8.D8',
    '--lib', PLATFORM_JAR, '--min-api', '21', '--output', dex, ...filesUnder(classes, '.class'));
  run(tool('aapt'), ['add', unsigned, 'classes.dex'], { cwd: dex });
  run(tool('zipalign'), ['-f', '-p', '4', unsigned, aligned]);

  if (!fs.existsSync(KEYSTORE)) {
    fs.mkdirSync(path.dirname(KEYSTORE), { recursive: true });
    run(path.join(JAVA_HOME, 'bin', 'keytool.exe'), [
      '-genkeypair', '-keystore', KEYSTORE, '-storepass', KEYSTORE_PASS, '-keypass', KEYSTORE_PASS,
      '-alias', 'tvchile', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=TV Chile',
    ]);
  }
  const apk = path.join(DIST, 'tv-chile.apk');
  const apksigner = path.join(BUILD_TOOLS, 'lib', 'apksigner.jar');
  java('-jar', apksigner, 'sign', '--ks', KEYSTORE, '--ks-pass', `pass:${KEYSTORE_PASS}`, '--out', apk, aligned);
  java('-jar', apksigner, 'verify', apk);
  fs.rmSync(`${apk}.idsig`, { force: true });
  return apk;
}

function buildWebos() {
  const out = path.join(BUILD, 'webos');
  reset(out);
  copyWeb(out);
  fs.copyFileSync(path.join(ROOT, 'webos', 'appinfo.json'), path.join(out, 'appinfo.json'));
  fs.writeFileSync(path.join(out, 'icon.png'), icon(80));
  fs.writeFileSync(path.join(out, 'largeIcon.png'), icon(130));
  run(process.execPath, [WEBOS_CLI, out, '-o', DIST, '--no-minify']);
  return fs.readdirSync(DIST).filter((file) => file.endsWith('.ipk')).map((file) => path.join(DIST, file))[0];
}

function buildTizen() {
  const out = path.join(DIST, 'tizen');
  reset(out);
  copyWeb(out);
  fs.copyFileSync(path.join(ROOT, 'tizen', 'config.xml'), path.join(out, 'config.xml'));
  fs.writeFileSync(path.join(out, 'icon.png'), icon(512));
  return out;
}

fs.mkdirSync(DIST, { recursive: true });
const targets = { android: buildAndroid, webos: buildWebos, tizen: buildTizen };
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(targets);
for (const name of wanted) {
  console.log(`${name}: ${targets[name]()}`);
}
