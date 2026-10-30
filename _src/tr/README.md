# Translations that are not in the app

Content that the app already translates is reused from `_src/app/<lang>.json`. Edit it once in the app, then run `node _src/tools/sync_app.mjs`.
This folder holds only what the app does not have. English is the source of truth and the legally binding version.

| Content | English source | Translation file | Import command |
| --- | --- | --- | --- |
| Page labels, shop text, home, guides, support, 404, meta | `lang/en/` | `tr/<lang>.json` | `python3 _src/tools/import_tr.py <lang>` |
| Privacy, terms, terms of sale, partners | `lang/en/pages/` | `tr/legal/<lang>.json` | `python3 _src/tools/import_legal.py <lang>` |
| Blog posts | `lang/en/pages/blog/` | `tr/blog/<lang>/<slug>.json` | `python3 _src/tools/import_blog.py <lang>` |

Set `HOPPO_TR=_src/tr` when you run an importer from the site folder.
The importers check tags, placeholders, numbers, dashes, exclamation marks, semicolons and missing text. They write nothing for a page that fails.
Worksheets with the English text per unit: `tr/blog_en/` and `tr/legal_en/`. Rebuild them with `import_blog.py --worksheet` and `import_legal.py --worksheet` after you change English text.
`number_ok` in a blog file lists units where the digits may differ from English (for example 24-hour times). A human check of each one is wise.
Every translated legal page shows a line that says the English version is legally binding and links to it.

After a change to English text, update every language file for that unit, run the importer, then `python3 _src/build.py` and `python3 _src/tools/validate.py "$(pwd)"`.
