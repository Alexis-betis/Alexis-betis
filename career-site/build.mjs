// Assemble le prototype en un seul fichier HTML autonome (CSS, JS, polices et logo intégrés).
// Usage : node build.mjs                 -> dist/site-carriere.html
//         node build.mjs --fragment out  -> fichier sans <html>/<head>/<body> (pour un hébergement qui fournit déjà le squelette)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const args = process.argv.slice(2);
const fragmentIdx = args.indexOf('--fragment');
const fragment = fragmentIdx >= 0;
const out = fragment ? args[fragmentIdx + 1] : join(root, 'dist', 'site-carriere.html');

let css = read('src/styles.css').replace(/url\(\.\.\/assets\/fonts\/([\w-]+\.woff2)\)/g, (_, f) =>
  'url(data:font/woff2;base64,' + readFileSync(join(root, 'assets/fonts', f)).toString('base64') + ')');

let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="src\/styles\.css">/, () => '<style>\n' + css + '\n</style>');
html = html.replace(/<script src="(src\/[\w.]+\.js)"><\/script>/g, (_, p) => '<script>\n' + read(p).replace(/<\/script/gi, '<\\/script') + '\n</script>');
if (fragment) {
  // Les lecteurs intégrés bloquent souvent les iframes YouTube/Vimeo : on ouvre la vidéo dans un nouvel onglet.
  html = html.replace('allowEmbeds: true', 'allowEmbeds: false');
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  html = head.trim() + '\n' + body.trim() + '\n';
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + ' Ko');
