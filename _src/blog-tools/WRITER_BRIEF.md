# Hoppo blog: writer brief

You are writing 1 article for the blog on hoppoapp.com. Hoppo is a free app for parents from pregnancy to age 5: a weekly 5-minute practice skill, milestones with keepsake cards, pregnancy week by week, 35 "Is this normal?" guides, and a calendar with sleep, feeding and growth logs. The audience is international (Europe first), reading in English, often as a second language. The owner is Matej Mesko.

## Research you must use
- /home/claude/reports/Parent concerns for Hoppo blog.md (first 4 topics: cost, shopping list, sleep, milestones)
- /home/claude/reports/Hoppo blog topic trends.md (new topics, NIJZ findings, runner-ups)
- The raw notes behind both, in /home/claude/research_notes/
Read the parts relevant to your topic. You may also search the web to confirm or update facts. Do not use Reddit or any copy of it.

## Goal
The most useful, most trustworthy article on the topic for a parent, and one that people want to share. Parents ask 1 question under every topic: "Is this normal, and am I doing it wrong?" Answer it with real ranges and real numbers, then give calm, practical next steps.

## Hooks (the owner wants attention-grabbing writing, smartly done)
- The headline must stop a scrolling parent. Use curiosity, relief, specific numbers, or loss aversion with real figures ("the 6 buys most parents never use"). Never invent fear, never exaggerate a risk, never promise what the evidence does not support.
- Every section heading is a hook in its own right: a surprising fact, a question parents actually ask, or a clear payoff. Not "Introduction" or "Conclusion".
- The first 2 sentences must make the reader feel seen, then promise what they will get.
- Short paragraphs. 1 idea per sentence. Concrete examples from everyday family life.

## House style (hard rules, an automated check enforces them)
- British English: nappy, cot, pram, Mum, colour, practise (verb).
- No contractions ("do not", "it is"). No em dashes or en dashes, use commas or full stops. No semicolons. No exclamation marks. No emojis.
- Numbers as digits (3, not three), including 1 to 10. Money as 1,000 EUR or £14.00 as the source gives it. Dates as 12 March 2026.
- Explain abbreviations the first time: World Health Organization (WHO).
- Never use these words: delve, landscape, realm, multifaceted, tapestry, testament, paradigm, nuanced, robust, intricate, pivotal, moreover, furthermore, notably, embark, foster, harnessing, showcasing, revolutionize, groundbreaking, cutting-edge, game-changer, synergy, holistic, streamline, spearheaded, bolster, underscore, navigate, scaffolding.
- No "It is not X, it is Y" or "Not only X but also Y" patterns. No rhetorical question chains.
- Warm, calm, honest. Never preachy, never guilt-inducing. Present both sides where experts or countries disagree, then say what Hoppo suggests and why.

## Content rules
- International: use WHO, NHS, AAP and other international or national bodies by name. Where countries differ, say so ("UK advice says X, US advice says Y"). Do not centre one country. No Slovenian specifics (those come in translated versions later).
- No affiliate links, no product brands recommended, no shop links. Generic product types only.
- No medicine doses. No diagnosis. Where relevant, a short "When to talk to your doctor or health visitor" box using official red flags, named by source.
- Parent voices: paraphrase what parents say on forums ("Many parents on Mumsnet describe..."). Do not quote real users word for word and never name them.
- Every fact or number must come from the research notes or a source you checked. Name the source in the text where it matters, and list all sources with links at the end.
- If you are not sure a fact is right, leave it out. If it is essential, add an HTML comment <!-- CHECK: what to verify --> right after it.
- Mention Hoppo naturally at most twice, only where it genuinely helps (for example, the weekly skill, the growth chart, the sleep log). No hard sell.
- Length: 1,200 to 1,800 words of body text. Tables are welcome where they make ranges easy to scan.

## Output
1. The article body as an HTML fragment at the path given in your task. Use exactly this structure:

```html
<div class="legal">
<p class="meta"><a href="/blog.html">All articles</a> · {N} min read · Checked against {sources}</p>
<h1>{headline}</h1>
<p class="lead">{2 to 3 sentence hook intro}</p>

<h2>{hook heading}</h2>
<p>...</p>
<!-- more sections: <h2>, <p>, <ul>, <ol>, tables inside <div class="tablewrap"><table>...</table></div> -->

<div class="keybox"><h2>{short summary heading}</h2><ul><li>...</li></ul></div>

<!-- only where relevant -->
<div class="warn"><h2>When to talk to your doctor or health visitor</h2><ul><li>...</li></ul></div>

<!-- only for printable posts -->
<div class="printable"><h2>{title}</h2> ...content to print... <button class="printbtn" type="button">Print this chart</button></div>

<h2>Sources</h2>
<ul class="sources">
<li><a href="https://...">{Organisation}: {page title}</a>, {date if known}</li>
</ul>
<p class="source">This article is general information, not medical advice. If you are worried about your child or your pregnancy, contact your doctor, midwife or health visitor.</p>

<div class="cta-box">
<b class="disp" style="font-size:20px">{1 line that links the topic to Hoppo}</b>
<p style="margin:8px 0 14px">{1 to 2 sentences}</p>
<div class="ctastores stores">
{{stores}}
</div>
</div>
</div>
```

Keep `{{stores}}` exactly as written, it is a template placeholder. Do not use any other `{{...}}`. Internal links: you may link to Hoppo guides as /guides/<id>.html (ids: crying, spitting-up, safe-sleep, baby-sleep, teething, first-foods, fever, tantrums, picky-eating, talking, potty, screens, low-mood, morning-sickness, preg-sleep, movements, hospital-bag, labour-signs, crawling, colds, nappy-rash, constipation, teeth-care, head-bump, foods-avoid, preg-exercise, enough-milk, jaundice, baby-poo, choking, home-safety, sun-safety, toddler-sleep, daycare, biting) and to other posts as /blog/<slug>.html only if your task lists them.

2. A metadata file (JSON) at the path given in your task:

```json
{"slug": "...", "headline": "...", "description": "meta description, 140 to 158 characters, with a hook", "card": "1 sentence teaser for the blog index, under 120 characters", "group": "one of: Pregnancy and newborn | Baby | Toddler and preschool | Family life", "date": "2026-10-19", "order": 0}
```

3. A short reply (under 150 words): word count, the 3 strongest hooks you used, and every CHECK comment you left.
