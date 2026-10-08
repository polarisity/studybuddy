# Study Buddy: a political economy tutor

A chat with an AI teacher ("Professor Mill", powered by Claude) next to an interactive whiteboard. The teacher draws on the whiteboard, and you can drag, slide and click what it draws. Changes you make are passed back to the teacher with your next message.

The site is plain HTML, CSS and JavaScript with no build step. The Anthropic SDK, `marked` and `DOMPurify` load from jsDelivr as pinned ES modules.

## Run it

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
```

- `http://localhost:8000/` is the tutor.
- `http://localhost:8000/?demo` adds a demo bar that shows every visual. It needs no API key.

When you send your first message, the app asks for your Anthropic API key (from console.anthropic.com). You can also choose the model under ⚙ Settings. Opus 5.5 is the default, and Sonnet 5.5 or Haiku 5.5 are cheaper.

**About the key:** it is stored in this browser's `localStorage` and sent directly from the browser to `api.anthropic.com` (using the SDK's `dangerouslyAllowBrowser` option). That's fine for personal use on your own machine. Don't host this publicly with your key in it. The next step for sharing is a small proxy server that holds the key.

## What the teacher can draw

| Tool | What you can do with it |
|---|---|
| `show_supply_demand` | Drag the curves; try a tax, price ceiling or floor; see shaded surplus and deadweight loss |
| `show_lorenz_curve` | Compare distributions; use a redistribution slider and watch the Gini change |
| `show_game_matrix` | Click outcomes to test for a Nash equilibrium; play repeated rounds against Tit-for-Tat and other strategies |
| `show_commons_simulation` | Change the number of users, how much each takes, and the regrowth rate; add a community quota |
| `show_concept_map` | Click thinkers on a timeline of schools of thought to ask about them |
| `show_quiz` | Answer a question; your answer goes back to the teacher |
| `suggest_replies` | Click a suggested follow-up reply |

## Layout

```
index.html, css/styles.css
js/app.js            UI: chat, settings, theme, mobile tabs, demo mode
js/teacher.js        Claude client, system prompt, streaming tool loop
js/tools.js          Tool schemas and client-side input validation
js/visuals/          One module per visual, plus stage.js (whiteboard) and svg.js (helpers)
```

Each visual exports `mount(el, params, callbacks) → { summary(), changed(), reset() }`. `summary()` is the plain-text description of the visual's current state. It goes into tool results and into the `[Visual state: …]` notes.
