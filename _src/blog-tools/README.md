# How a Hoppo blog post is made

1. **Research.** Parent questions from forums (Mumsnet, med.over.net, others), search and share trends, and official guidance. Reports: "Parent concerns for Hoppo blog" and "Hoppo blog topic trends".
2. **Write.** A writer follows WRITER_BRIEF.md: hook headline, hooks in every section, real ranges and numbers, international, no affiliate links, sources at the end.
3. **Style check.** `python3 stylecheck.py <post.html>` must report 0 problems (no contractions, dashes, semicolons, exclamation marks, number words, banned words or US spellings).
4. **Independent fact check.** A separate checker who did not write the post follows CHECKER_BRIEF.md and verifies every claim, link and safety statement against the primary source. Its fixes are in checks/.
5. **Apply fixes.** `python3 applyfix.py <post.html> <check.json>`, then the editor reviews the notes and makes any extra changes.
6. **Publish.** Add the post's metadata to `_src/lang/en/blog.json` (only posts listed there are built), run the build and the HTML check.

The 12 posts of 19 October 2026 all went through steps 2 to 6. Total fixes from the fact checks: 152.
