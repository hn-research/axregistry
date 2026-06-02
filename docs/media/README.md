# README media assets

The project README embeds the files below. Drop them here (same filenames) and
the README renders automatically. Capture from **axregistry.com** (or local
`npm run dev` against the populated DB) on a clean window.

## Shot list

| File | What to capture | Notes |
| --- | --- | --- |
| `hero-search.gif` | The homepage hero. Let the **auto-demo** type a query and the dropdown fill with real server + client results; then type one yourself. | The money shot — show live results animating in. 6–10s loop. |
| `insights.png` | `/insights` — the dashboard grid (totals, most-adopted, kind distribution, client landscape, co-occurrence). | Full-width, real numbers visible. |
| `leaderboards.png` | `/lists` — category leaderboard cards. | Shows breadth across categories. |
| `server-graph.png` | A popular server page (e.g. a high-adoption one) showing the **relationship graph** + adoption line. | Pick one with a dense graph and a trend. |
| `scan.png` | `/scan?repo=<owner>/<name>` report for a repo with several MCP servers. | Shows the audit value. |

## Capture & sizing tips

- **GIF (hero):** record with [Kap](https://getkap.co) (macOS), [LICEcap](https://www.cockos.com/licecap/),
  or ScreenToGif (Windows). Target **~820px wide**, < ~5 MB, 6–10s, loop. Trim dead air.
- **PNG (stills):** capture at 2× then export ~1400px wide; crop to the content.
- Use a **dark, real-data** view — empty states look weak. Hide personal browser
  chrome/bookmarks.
- Keep total media reasonable (GitHub serves these on every README view).

## Prefer video (MP4)?

GitHub doesn't render repo-relative `<video>` reliably. To use an MP4: drag it
into a GitHub issue/PR/release to get a `user-images.githubusercontent.com` URL,
then embed that URL in the README instead of the local path. GIFs in this folder
are the simplest path and work offline.
