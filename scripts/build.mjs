// Assemble le site publiable dans dist/ : uniquement les fichiers publics (pas de docs, scripts ni configuration).
// Usage : node scripts/build.mjs
import { cpSync, rmSync, mkdirSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// 1. Contrôle des données : on ne publie pas une base invalide.
const data = Object.fromEntries(
  ['meta', 'software', 'connections', 'formats'].map((n) => [n, JSON.parse(readFileSync(join(root, 'data', `${n}.json`), 'utf8'))])
);
const ids = new Set(data.software.map((s) => s.id));
const formats = new Set(data.formats.map((f) => f.id));
const problems = [];
for (const c of data.connections) {
  if (!ids.has(c.source) || !ids.has(c.target)) problems.push(`${c.id}: logiciel inconnu`);
  for (const f of c.formats || []) if (!formats.has(f)) problems.push(`${c.id}: format inconnu ${f}`);
  if (!c.sources?.length) problems.push(`${c.id}: aucune source`);
}
if (problems.length) {
  console.error('Données invalides :\n - ' + problems.join('\n - '));
  process.exit(1);
}

// 2. Copie des fichiers publics.
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const entry of ['index.html', '.nojekyll', 'css', 'js', 'data', 'assets']) {
  if (existsSync(join(root, entry))) cpSync(join(root, entry), join(dist, entry), { recursive: true });
}
// Nouveau numéro de version des CSS/JS à chaque build : les visiteurs ne mélangent pas anciens et nouveaux fichiers.
execFileSync(process.execPath, [join(root, 'scripts', 'stamp-version.mjs'), dist], { stdio: 'inherit' });

// 3. Rapport.
let files = 0;
let bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else { files += 1; bytes += statSync(p).size; }
  }
};
walk(dist);
console.log(`dist/ prêt : ${data.software.length} logiciels, ${data.connections.length} liaisons, ${files} fichiers, ${(bytes / 1024).toFixed(0)} Ko`);
