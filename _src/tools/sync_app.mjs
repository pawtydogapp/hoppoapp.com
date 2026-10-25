/* Copies the app's English text and guide list into the site source.
   Run from the site root:  node _src/tools/sync_app.mjs ../hoppo-app
   The guide pages are then built word for word from the app text. */
import fs from "fs"; import path from "path";
const app = path.resolve(process.argv[2] || "../hoppo-app");
const src = path.resolve("_src");
fs.copyFileSync(path.join(app, "i18n-source/en.json"), path.join(src, "app/en.json"));
const { GUIDES } = await import(path.join(app, "src/content/guides.js"));
const old = fs.existsSync(path.join(src, "guides.json")) ? JSON.parse(fs.readFileSync(path.join(src, "guides.json"), "utf8")) : [];
const dateOf = Object.fromEntries(old.map(g => [g.id, g.date]));
const today = new Date().toISOString().slice(0, 10);
const out = GUIDES.map(g => ({ slug: g.id.replace(/_/g, "-"), id: g.id, stage: g.stage, date: dateOf[g.id] || today }));
fs.writeFileSync(path.join(src, "guides.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`Synced ${out.length} guides and en.json from ${app}`);
