# hoppoapp.com plan, from the Pawty site (v31)

Scope agreed on 18 October 2026: home, support, terms, privacy, 35 guides, blog posts. English first. Other languages later, with the same folder structure as Pawty.

## Reuse as is (about 70% of the code)

| Part | Pawty file | Change for Hoppo |
| --- | --- | --- |
| Static site generator | _src/build.py (191 lines) | Rename Pawty to Hoppo. New guide renderer for the Hoppo guide shape |
| Languages, hreflang, sitemap, lastmod dates | build.py, config.json, lastmod.json | Start with English only. Language switch hides itself with 1 language |
| Page shell | templates/base.html | New logo, colours, nav, social links, email info@hoppoapp.com |
| Store badges | templates/stores.html | New store links once the apps are live. Until then: "Coming soon" |
| Analytics without cookies | templates/posthog.html | New PostHog project key for Hoppo. Same memory-only setting, so no cookie banner |
| Scroll reveal, counters, video pause, language menu | assets/site.js | Remove the Pawty partner logo fetch |
| Stylesheet | assets/site.css (211 lines) | New Hoppo colours and fonts. Layout stays |
| HTML checker | tools/validate.py | Domain changed to hoppoapp.com |
| Translation import | tools/importer.py, tools/seg.py | Kept for the translation step |
| robots.txt, 404, sitemap | as is | Domain changed |

## Reuse the rule: app and site never drift

Pawty builds each guide page word for word from the app's own translation file. Hoppo does the same: the 35 guide pages are built from hoppo-app/i18n-source/en.json. One edit in the app changes the website at the next build.

## New (written from scratch)

| Page | Why it is new |
| --- | --- |
| Guide template | Hoppo guides have 5 parts: intro, what is common, what can help, talk to your doctor if, get urgent help now if. Pawty guides have 4 different parts. The urgent box needs its own red style |
| Guides index | 35 cards in 4 groups: pregnancy, baby, toddler and preschool, for you |
| Home page | New story, Hoppo screenshots, mascot images |
| Support | New questions: due dates, born early, photos staying on the phone, deleting data, reminders |
| Privacy policy | Must be rewritten. Hoppo stores data about children and pregnancy. See the concerns below |
| Terms | Pawty structure reused. New sections: not medical advice, data about your child, affiliate links and Darija's products |
| Blog posts | New articles. Each one goes through the same safety check as the guides |
| SEO texts per guide | Title, description and card line for each of the 35 guides |
| Images | Favicon, app icon, share image (og-image) from the mascot. Screenshots taken from the demo build |

## Not in the first version
Pawty's marketplace, partners and approach pages. They can follow later.

## Status, 18 October 2026: first version built

The site lives in its own folder, hoppo-site, next to this app. 41 pages: home, guides index, 35 guide pages, support, privacy, terms and 404. The HTML check passes with 0 errors. See hoppo-site/_src/DEPLOY.md for build and publishing steps.

Decided:
- "Coming soon" store badges until the apps are live.
- Operator: Matej Mesko, Slovenia. No social links yet.
- English only. Blog follows with 10 posts, once researched, written and safety-checked.
- Fonts are served from the site and from inside the app, not from Google Fonts.

Changed in the app for the website (0.8.1):
- The sign-up checkbox now asks for explicit consent to store pregnancy and child health details. The privacy policy relies on this (GDPR Article 9(2)(a)).
- Fonts are bundled in public/fonts.

Before launch: a data protection lawyer should review the privacy policy, the consent wording, and the usage statistics, which are linked to a random account number and can show whether a profile is a pregnancy.

## Status, 19 October 2026: blog added

12 posts, all written to the writer brief, style-checked and independently fact-checked (152 fixes applied). No affiliate links. The 3 high-risk topics (autism signs under 1, paracetamol in pregnancy, births that do not go to plan) were dropped at the owner's request.

1. Newborn visitors and grandparents
2. Sensory play by age, with a printable
3. What a baby really costs in the first year
4. Formula and toddler milk
5. Baby sleep by age, birth to 5
6. Toddler daily routine, with a printable
7. Newborn shopping list
8. Sharing the mental load after a baby
9. Milestones month by month
10. Gentle or firm toddler behaviour
11. From 1 child to 2
12. Back to work and childcare

The site now has 54 pages. The process and the fact-check files are in hoppo-site/_src/blog-tools.
