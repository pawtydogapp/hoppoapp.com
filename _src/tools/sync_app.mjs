/* Copies the app's English text and guide list into the site source.
   Run from the site root:  node _src/tools/sync_app.mjs ../hoppo-app
   The guide pages are then built word for word from the app text. */
import fs from "fs"; import path from "path";
const app = path.resolve(process.argv[2] || "../hoppo-app");
const src = path.resolve("_src");
fs.copyFileSync(path.join(app, "i18n-source/en.json"), path.join(src, "app/en.json"));
/* The app's own translations (ui, plural, content) for every language. The site reuses them:
   guide text word for word, and any label whose English text is the same as an app string.
   Nothing the app already says is translated a second time. */
const trDir = path.join(app, "i18n-source/translations");
let nLang = 0;
for (const f of fs.readdirSync(trDir).filter(f => f.endsWith(".json"))) { fs.copyFileSync(path.join(trDir, f), path.join(src, "app", f)); nLang++; }
const { GUIDES } = await import(path.join(app, "src/content/guides.js"));
const old = fs.existsSync(path.join(src, "guides.json")) ? JSON.parse(fs.readFileSync(path.join(src, "guides.json"), "utf8")) : [];
const dateOf = Object.fromEntries(old.map(g => [g.id, g.date]));
const today = new Date().toISOString().slice(0, 10);
const out = GUIDES.map(g => ({ slug: g.id.replace(/_/g, "-"), id: g.id, stage: g.stage, date: dateOf[g.id] || today }));
fs.writeFileSync(path.join(src, "guides.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`Synced ${out.length} guides, en.json and ${nLang} translations from ${app}`);
