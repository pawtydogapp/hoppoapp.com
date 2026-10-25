# hoppoapp.com: build and publish

The site is plain HTML, built by `_src/build.py` and hosted free on GitHub Pages. Same setup as pawtyapp.com.

## Build

From the site root:

1. `node _src/tools/sync_app.mjs ../hoppo-app` copies the app's English text and guide list. Run it after every content change in the app, so the guide pages match the app word for word.
2. `python3 _src/build.py` writes every page, the sitemap and the assets.
3. `python3 _src/tools/validate.py "$(pwd)"` checks every page for broken links, unclosed tags and leftover placeholders. It must print `errors 0`.

## Publish on GitHub Pages (first time)

1. Create a new public repository, for example `hoppoapp.com`, and push the whole folder, including `_src`. GitHub Pages skips folders that start with an underscore, so the source is not published.
2. In the repository: Settings, then Pages. Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The `CNAME` file already contains `hoppoapp.com`.
4. At your domain registrar, add these DNS records:
   - 4 `A` records for `hoppoapp.com`: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
   - 1 `CNAME` record for `www`: `<your-github-username>.github.io`
5. Back in Settings, then Pages: wait for the DNS check, then tick "Enforce HTTPS".

Check GitHub's current Pages documentation before step 4, in case the addresses have changed.

## Before launch

- Set the effective date in `privacy.html` and `terms.html` (search for "[to be set at launch]").
- When the apps are live, replace the "Coming soon" badges in `_src/templates/stores.html` with the real store links.
- If you want website statistics, add the Hoppo PostHog snippet to `_src/templates/posthog.html`, with `persistence: 'memory'` so no cookies are set, as on Pawty.
- The app links to hoppoapp.com/terms and hoppoapp.com/privacy. GitHub Pages serves `terms.html` and `privacy.html` for those addresses.

## Fonts

Fredoka and Nunito are served from `/fonts`, not from Google Fonts, so visitors' IP addresses are not sent to Google. Both are under the SIL Open Font License (see the licence files in `/fonts`).
