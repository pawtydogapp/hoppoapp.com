# Hoppo: publish the website, link the domain, set up email

Same tools as Pawty: GitHub Desktop, GitHub Pages, Porkbun, Gmail and Resend. About 1 hour in total, plus waiting time for DNS.

## 0. Do I need to "build"?

**No.** The zip already contains the finished website. You only upload it.

- The pages you publish: `index.html`, `guides/`, `blog/`, `img/`, `fonts/`, `assets/` and the other files at the top of the zip.
- `_src` is the source I edit. It goes to GitHub too, but GitHub Pages does not publish folders that start with `_`, so nobody sees it.
- When content changes later, I build it and send you a new zip. You copy it over and push. That is all.

## 1. Folders on your computer (mirror Pawty)

| Pawty | Hoppo | What it holds |
| --- | --- | --- |
| `C:\pawty\pawty-app` | `C:\hoppo\hoppo-app` | App code, its own private GitHub repository (we set this up at store publishing) |
| `C:\pawty website\pawtydogapp.github.io` | `C:\hoppo website\hoppoapp.com` | Website, public GitHub repository |
| `C:\pawty-keys` | `C:\hoppo-keys` | Store signing keys. Never inside a GitHub folder |

Create `C:\hoppo website` now. The other 2 come later.

## 2. Create the website repository (GitHub Desktop, same account as Pawty)

1. GitHub Desktop: **File, New repository**.
   - Name: `hoppoapp.com`
   - Local path: `C:\hoppo website`
   - Leave "Initialize with README" unticked. Git ignore: None. License: None.
   - Click **Create repository**. This makes `C:\hoppo website\hoppoapp.com`.
2. Unzip `hoppo-site-0_2_1-2026-10-25.zip` somewhere temporary. Open the `hoppo-site` folder inside it, select **everything inside** (not the folder itself) and copy it into `C:\hoppo website\hoppoapp.com`. You should now see `index.html` directly in that folder, next to the hidden `.git` folder.
3. Back in GitHub Desktop you see about 140 changed files. Summary: `First version of hoppoapp.com`. Click **Commit to main**.
4. Click **Publish repository**. **Untick "Keep this code private"** (GitHub Pages is free only for public repositories). Publish.

## 3. Turn on GitHub Pages

1. On github.com, open the new `hoppoapp.com` repository, then **Settings, Pages**.
2. Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)**. Save.
3. Custom domain: GitHub reads it from the `CNAME` file (`hoppoapp.com`). If the box is empty, type `hoppoapp.com` and save.
4. Recommended, as for Pawty: your profile picture, **Settings, Pages, Add a domain** to verify `hoppoapp.com`. GitHub gives you 1 TXT record to add at Porkbun. This stops anyone else claiming the domain on GitHub.

## 4. Link the domain at Porkbun

Porkbun, **Domain Management**, `hoppoapp.com`, **DNS**.

1. Delete the default parking records (usually an `ALIAS` to `pixie.porkbun.com` and a `CNAME` for `*`).
2. Add 4 **A** records, host left empty:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
3. Add 1 **CNAME** record: host `www`, answer `pawtydogapp.github.io` (your GitHub user name followed by `.github.io`, the same as Pawty).
4. Wait 10 to 60 minutes. Back in GitHub, **Settings, Pages**: when the DNS check shows green, tick **Enforce HTTPS**.
5. Test `https://hoppoapp.com`, `https://www.hoppoapp.com`, `https://hoppoapp.com/privacy` and `https://hoppoapp.com/terms`. The last 2 are the addresses the app opens.

Do not touch any MX or TXT records that step 5 below adds.

## 5. Email: info@hoppoapp.com, like Pawty

### 5a. Receive: Porkbun forwarding to Gmail

1. Porkbun, `hoppoapp.com`, **Email Forwarding** (free).
2. Add: `info` forwards to `hoppo.kid.app@gmail.com`.
3. Porkbun adds its own MX and SPF records automatically. Send a test email to info@hoppoapp.com from another address.

### 5b. Send: Resend as the outgoing server

1. resend.com, same login as Pawty, **Domains, Add domain**: `hoppoapp.com`, region EU (Ireland).
2. Resend shows 3 or 4 DNS records (a DKIM `TXT` on `resend._domainkey`, plus an `MX` and a `TXT` on the `send` subdomain). Copy each one into Porkbun DNS exactly as shown. Then click **Verify** in Resend.
3. Resend, **API Keys, Create**: name `gmail-hoppo`, permission **Sending access**, domain `hoppoapp.com`. Copy the key now (it is shown once). Store it with the Pawty passwords.
4. Gmail (`hoppo.kid.app@gmail.com`), **Settings, Accounts and Import, Send mail as, Add another email address**:
   - Name: `Hoppo`. Email: `info@hoppoapp.com`. Untick "Treat as an alias".
   - SMTP server: `smtp.resend.com`. Port: `465`. Username: `resend`. Password: the API key. Secured connection using SSL.
5. Gmail sends a confirmation code to info@hoppoapp.com. It arrives in the same Gmail through the forwarding from 5a. Enter it.
6. Optional: **When replying to a message, reply from the same address it was sent to**.

The SPF record for Porkbun forwarding and the Resend records live side by side. If Porkbun complains about 2 SPF records on the main domain, tell me what it shows and I will merge them.

## 6. Working on Pawty and Hoppo side by side

- GitHub Desktop, top left, **Current repository**. Both repositories are listed. Click one to switch. Nothing else changes.
- Each repository only sees its own folder, so Pawty and Hoppo files can never mix.
- Every update follows the same 4 steps:
  1. Switch to the right repository.
  2. Unzip my new zip and copy the contents of its top folder over the repository folder, replacing files.
  3. Check the list of changes in GitHub Desktop looks as expected, then **Commit to main**.
  4. **Push origin**. The live site updates in 1 to 2 minutes.
- To check what is live, open the repository on github.com, **Actions**: the latest "pages build and deployment" must be green.

## 7. After the site is live: ask Google and Bing to crawl

1. Google Search Console (log in with `hoppo.kid.app@gmail.com`): **Add property, Domain**, `hoppoapp.com`. Add the TXT record it gives you at Porkbun, then Verify.
2. **Sitemaps**: submit `https://hoppoapp.com/sitemap.xml` (54 pages).
3. **URL inspection**: paste `https://hoppoapp.com/` and click **Request indexing**. Repeat for `/guides.html` and `/blog.html`.
4. Bing Webmaster Tools: sign in, **Import from Google Search Console**. This copies the verification and the sitemap in 1 step.

Indexing usually takes days to a few weeks for a new domain.
