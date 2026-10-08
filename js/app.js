import { marked } from "https://cdn.jsdelivr.net/npm/marked@18.0.13/+esm";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.4.15/+esm";
import { Teacher } from "./teacher.js";
import { createStage } from "./visuals/stage.js";
import { html } from "./visuals/svg.js";

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const DEMO = new URLSearchParams(location.search).has("demo");
const mobile = () => matchMedia("(max-width: 900px)").matches;

const STARTERS = [
  { ico: "🛒", title: "Why do prices exist?", sub: "Markets, supply & demand, price controls", prompt: "Teach me how supply and demand set prices, and what happens when governments set prices instead." },
  { ico: "⚖️", title: "Who gets what?", sub: "Inequality, the Gini coefficient, redistribution", prompt: "Teach me how economists measure inequality, and the main arguments for and against redistribution." },
  { ico: "🤝", title: "Why does cooperation fail?", sub: "Prisoner's dilemma & tragedy of the commons", prompt: "Teach me why rational people often fail to cooperate: the prisoner's dilemma and the tragedy of the commons." },
  { ico: "🏛️", title: "Smith vs Marx vs Keynes vs Hayek", sub: "The big schools of thought", prompt: "Give me a map of the big schools of thought in political economy and how they argue with each other." },
];

// ---------- elements ----------
const messagesEl = $("messages");
const input = $("input");
const sendBtn = $("send-btn");
const settings = $("settings");
let shareVisualState = true;

// ---------- theme ----------
const savedTheme = store.get("theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
$("theme-btn").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const next = dark ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  store.set("theme", next);
});

// ---------- mobile tabs ----------
const tabs = [...document.querySelectorAll(".pane-tab")];
function showPane(name) {
  for (const t of tabs) {
    const on = t.dataset.pane === name;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on);
  }
  $("chat-pane").classList.toggle("active", name === "chat");
  $("stage-pane").classList.toggle("active", name === "stage");
  if (name === "stage") $("stage-badge").hidden = true;
}
tabs.forEach((t) => t.addEventListener("click", () => showPane(t.dataset.pane)));

// ---------- stage ----------
const stage = createStage({
  onDirty: (d) => { $("visual-note").hidden = !(d && shareVisualState); },
  onSend: (text) => send(text),
  onShown: () => {
    if (mobile()) {
      if ($("chat-pane").classList.contains("active")) $("stage-badge").hidden = false;
    }
  },
});
$("visual-note-clear").addEventListener("click", () => { stage.discardChanges(); });

// ---------- chat rendering ----------
const renderMd = (text) => DOMPurify.sanitize(marked.parse(text, { breaks: true }));

function scrollDown() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addMessage(who, text, { shared } = {}) {
  const bubble = html("div", { class: "bubble" });
  if (who === "student") {
    bubble.textContent = text;
    if (shared) bubble.append(html("div", { style: "font-size:11.5px;opacity:.75;margin-top:4px", text: "📎 whiteboard shared" }));
  } else bubble.innerHTML = renderMd(text);
  const row = html("div", { class: `msg ${who}` }, [html("div", { class: "avatar", text: "M", "aria-hidden": "true" }), bubble]);
  messagesEl.append(row);
  scrollDown();
  return { row, bubble };
}

function notice(text, error = false) {
  messagesEl.append(html("div", { class: `system-note${error ? " error" : ""}`, text }));
  scrollDown();
}

let current = null; // { row, bubble, raw, frame }
const ui = {
  startTurn() {
    const { row, bubble } = addMessage("teacher", "");
    bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    current = { row, bubble, raw: "", frame: 0 };
  },
  onText(delta) {
    if (!current) return;
    current.raw += delta;
    if (!current.frame) {
      current.frame = requestAnimationFrame(() => {
        if (!current) return;
        current.frame = 0;
        current.bubble.innerHTML = renderMd(current.raw);
        scrollDown();
      });
    }
  },
  endTurn() {
    if (!current) return;
    cancelAnimationFrame(current.frame);
    if (!current.raw.trim()) current.row.remove();
    else current.bubble.innerHTML = renderMd(current.raw);
    current = null;
  },
  showVisual(kind, params, display) {
    const entry = stage.show(kind, params, display);
    const chip = html("button", { type: "button", class: "visual-chip", text: `${kind === "quiz" ? "❓" : "✏️"} ${entry.title}` });
    chip.addEventListener("click", () => { entry.chip.click(); if (mobile()) showPane("stage"); });
    messagesEl.append(html("div", { style: "padding-left:40px" }, [chip]));
    scrollDown();
    if (mobile()) showPane("stage");
    return entry;
  },
  showReplies(options) {
    clearChips();
    const row = html("div", { class: "chips" }, options.map((o) => html("button", { type: "button", class: "chip", text: o, onclick: () => send(o) })));
    messagesEl.append(row);
    scrollDown();
  },
  notice,
  openSettings: () => openSettings(),
};

function clearChips() {
  messagesEl.querySelectorAll(".chips").forEach((c) => c.remove());
}

// ---------- teacher ----------
const teacher = new Teacher({
  getKey: () => store.get("anthropic_api_key"),
  getModel: () => store.get("model") || "claude-opus-5-5",
  ui,
});

async function send(text) {
  text = text.trim();
  if (!text || teacher.busy) return;
  if (!store.get("anthropic_api_key")) {
    input.value = stripState(text);
    openSettings("Add your Anthropic API key so the teacher can reply.");
    return;
  }
  document.querySelector(".welcome")?.remove();
  clearChips();

  // Attach anything the student changed on the whiteboard since the teacher last saw it.
  let payload = text;
  const notes = shareVisualState ? stage.takeChanges() : [];
  if (notes.length && !text.includes("[Visual state:")) payload += `\n\n[Visual state: ${notes.join(" | ")}]`;
  addMessage("student", stripState(text), { shared: payload.includes("[Visual state:") });

  setBusy(true);
  try {
    await teacher.send(payload);
  } finally {
    setBusy(false);
  }
}

function stripState(text) {
  return text.replace(/\n*\[Visual state:[\s\S]*\]$/, "").trim();
}

function setBusy(b) {
  sendBtn.disabled = b;
  input.placeholder = b ? "Professor Mill is thinking…" : "Ask Professor Mill anything…";
}

$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = input.value;
  input.value = "";
  autosize();
  send(t);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $("composer").requestSubmit();
  }
});
function autosize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}
input.addEventListener("input", autosize);

// ---------- welcome ----------
function welcome() {
  const box = html("div", { class: "welcome" }, [
    html("h2", { text: "Hi, I'm Professor Mill." }),
    html("p", { text: "I'll teach you political economy by talking it through with you and drawing on the whiteboard. You can drag, slide and click everything I draw. Where shall we start?" }),
    html("div", { class: "starters" }, STARTERS.map((s) =>
      html("button", { type: "button", class: "starter", onclick: () => send(s.prompt) }, [
        html("div", { class: "ico", text: s.ico }), html("strong", { text: s.title }), html("span", { text: s.sub }),
      ]))),
    DEMO ? null : html("p", { class: "demo-link" }, ["No API key yet? ", html("a", { href: "?demo", text: "Explore the whiteboard in demo mode" }), "."]),
  ]);
  messagesEl.append(box);
}

$("new-lesson-btn").addEventListener("click", () => {
  if (teacher.busy) return;
  teacher.reset();
  messagesEl.replaceChildren();
  stage.clear();
  welcome();
  if (DEMO) demoBar();
});

// ---------- settings ----------
function openSettings(reason) {
  $("api-key").value = store.get("anthropic_api_key") || "";
  $("model").value = store.get("model") || "claude-opus-5-5";
  settings.showModal();
  if (reason) notice(reason);
}
$("settings-btn").addEventListener("click", () => openSettings());
$("clear-key").addEventListener("click", () => {
  store.set("anthropic_api_key", null);
  $("api-key").value = "";
});
settings.addEventListener("close", () => {
  if (settings.returnValue !== "save") return;
  const key = $("api-key").value.trim();
  store.set("anthropic_api_key", key || null);
  store.set("model", $("model").value);
  if (key && input.value.trim()) $("composer").requestSubmit();
});

// ---------- demo mode ----------
const DEMOS = [
  ["Supply & demand", "supply_demand", { demand_intercept: 100, demand_slope: 1, supply_intercept: 10, supply_slope: 0.5, x_label: "Cups of coffee per day", y_label: "Price per cup ($)" }, { title: "The coffee market", caption: "Drag either curve, or pick a policy and move its slider." }],
  ["Tax & DWL", "supply_demand", { demand_intercept: 100, demand_slope: 1, supply_intercept: 10, supply_slope: 0.5, tax: 15 }, { title: "A $15 tax on every unit", caption: "The red triangle is trade that no longer happens: the deadweight loss." }],
  ["Rent control", "supply_demand", { demand_intercept: 3000, demand_slope: 2, supply_intercept: 400, supply_slope: 2, price_ceiling: 1300, x_label: "Apartments", y_label: "Monthly rent ($)" }, { title: "Rent control", caption: "A ceiling below equilibrium creates a shortage. Try raising it." }],
  ["Lorenz curve", "lorenz", { preset: "united_states", compare_shares: [9, 14, 18, 23, 36], compare_label: "Nordic country (approx.)" }, { title: "How unequal is the US?", caption: "Move the redistribution slider and watch the Gini fall." }],
  ["Prisoner's dilemma", "game_matrix", { preset: "prisoners_dilemma" }, { title: "The prisoner's dilemma", caption: "Click each outcome. Then play 10 rounds against Tit-for-Tat." }],
  ["Commons", "commons", { resource_name: "Fish", herders: 6 }, { title: "Overfishing a shared lake", caption: "Each fisher takes a bit too much. Try fewer fishers, or a community quota." }],
  ["Concept map", "concept_map", { preset: "schools_of_thought" }, { title: "Schools of thought", caption: "Click any thinker to ask about them." }],
  ["Quiz", "quiz", { question: "A $10 per-unit tax is placed on sellers of coffee. Who ends up paying it?", options: ["Only the sellers", "Only the buyers", "Both, split by how steep the curves are", "Neither: prices just rise"], correct_index: 2, explanation: "Tax incidence depends on relative elasticities, not on who writes the cheque. The less responsive side bears more." }, {}],
];

function showDemo(kind, params, display) {
  stage.show(kind, params, display);
  if (mobile()) showPane("stage");
}

function demoBar() {
  const bar = html("div", { class: "demo-bar" }, [
    html("span", { class: "eyebrow", style: "align-self:center;margin-right:4px", text: "Demo" }),
    ...DEMOS.map(([label, kind, params, display]) => html("button", { type: "button", class: "btn small", text: label, onclick: () => showDemo(kind, params, display) })),
  ]);
  document.querySelector(".demo-bar")?.remove();
  $("stage-pane").insertBefore(bar, $("stage-body"));
}

// ---------- boot ----------
welcome();
if (DEMO) {
  demoBar();
  stage.show(...DEMOS[0].slice(1));
  if (mobile()) showPane("chat");
}
input.focus();
