// Met à jour le numéro de version (?v=…) des fichiers CSS et JS référencés par index.html et par les imports.
// Sans ce numéro, un navigateur peut combiner la nouvelle page avec d'anciens fichiers gardés en cache
// (page cassée après une mise à jour). Les imports ES ne transmettent pas le ?v= : chaque import le porte.
// Usage : node scripts/stamp-version.mjs [dossier du site] [version]
//   dossier par défaut : la racine du projet ; version par défaut : date et heure (AAAAMMJJHHMM).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[3] || new Date().toISOString().replace(/\D/g, '').slice(0, 12);
if (!/^[\w.-]+$/.test(version)) {
  console.error(`Version invalide : ${version}`);
  process.exit(1);
}

const files = [join(root, 'index.html')];
const jsDir = join(root, 'js');
if (existsSync(jsDir)) for (const name of readdirSync(jsDir)) if (name.endsWith('.js')) files.push(join(jsDir, name));

// Références locales vers un .js ou un .css, avec ou sans ?v= existant.
const ref = /((?:\.\/|css\/|js\/)[\w./-]+\.(?:js|css))(?:\?v=[\w.-]+)?(?=["'])/g;
let count = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(ref, (_, path) => { count += 1; return `${path}?v=${version}`; });
  if (after !== before) writeFileSync(file, after);
}
console.log(`version ${version} appliquée à ${count} références dans ${files.length} fichiers`);
