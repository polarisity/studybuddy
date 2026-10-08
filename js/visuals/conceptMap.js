// Thinkers & ideas on a timeline, one lane per school of thought.
import { el, html, color } from "./svg.js";

export const title = "Concept map";

export const PRESETS = {
  schools_of_thought: {
    title: "Schools of thought in political economy",
    nodes: [
      { id: "smith", label: "Adam Smith", detail: "Wealth of Nations · invisible hand", year: 1776, school: "Classical" },
      { id: "ricardo", label: "David Ricardo", detail: "Comparative advantage", year: 1817, school: "Classical" },
      { id: "mill", label: "J. S. Mill", detail: "Liberty & reform", year: 1848, school: "Classical" },
      { id: "marx", label: "Karl Marx", detail: "Capital · class & surplus value", year: 1867, school: "Marxian" },
      { id: "marshall", label: "Alfred Marshall", detail: "Supply & demand at the margin", year: 1890, school: "Neoclassical" },
      { id: "veblen", label: "Thorstein Veblen", detail: "Institutions · conspicuous consumption", year: 1899, school: "Institutionalist" },
      { id: "keynes", label: "J. M. Keynes", detail: "General Theory · aggregate demand", year: 1936, school: "Keynesian" },
      { id: "hayek", label: "F. A. Hayek", detail: "Prices as knowledge · Road to Serfdom", year: 1944, school: "Austrian" },
      { id: "polanyi", label: "Karl Polanyi", detail: "The Great Transformation", year: 1944, school: "Institutionalist" },
      { id: "friedman", label: "Milton Friedman", detail: "Monetarism · Capitalism and Freedom", year: 1962, school: "Chicago" },
      { id: "buchanan", label: "James Buchanan", detail: "Public choice · Calculus of Consent", year: 1962, school: "Public choice" },
      { id: "ostrom", label: "Elinor Ostrom", detail: "Governing the Commons", year: 1990, school: "Institutionalist" },
    ],
    edges: [
      { from: "smith", to: "ricardo", label: "builds on" },
      { from: "ricardo", to: "marx", label: "labour theory of value" },
      { from: "smith", to: "mill" },
      { from: "mill", to: "marshall" },
      { from: "marshall", to: "keynes", label: "teacher of" },
      { from: "keynes", to: "hayek", label: "debated" },
      { from: "hayek", to: "friedman", label: "influenced" },
      { from: "keynes", to: "friedman", label: "challenged by" },
      { from: "veblen", to: "polanyi" },
      { from: "polanyi", to: "ostrom" },
      { from: "buchanan", to: "ostrom", label: "collective action" },
    ],
  },
};

const NODE_W = 196;
const NODE_H = 46;

export function mount(container, params, { onStateChange, onAsk } = {}) {
  const preset = params.preset && PRESETS[params.preset];
  const nodes = (params.nodes?.length ? params.nodes : preset?.nodes ?? PRESETS.schools_of_thought.nodes).map((n, i) => ({ ...n, i }));
  const edges = params.edges?.length || params.nodes?.length ? params.edges ?? [] : preset?.edges ?? PRESETS.schools_of_thought.edges;
  let focused = null;

  // schools in fixed order of first appearance → fixed categorical colours
  const schools = [];
  for (const n of nodes) if (!schools.includes(n.school || "Other")) schools.push(n.school || "Other");
  const schoolColor = (s) => (schools.indexOf(s) < 8 ? color(schools.indexOf(s) + 1) : "var(--muted)");

  // Vertical timeline: one row per distinct year (or per node without years), nodes
  // alternating either side of a central spine; extra nodes in a row fan outward.
  const hasYears = nodes.every((n) => Number.isFinite(n.year));
  const keyOf = (n) => (hasYears ? n.year : n.i);
  const rowKeys = [...new Set(nodes.map(keyOf))].sort((a, b) => a - b);
  const rows = rowKeys.map((k) => nodes.filter((n) => keyOf(n) === k));
  const GAP = 34; // spine to node edge
  const maxPerSide = Math.max(1, ...rows.map((r) => Math.ceil(r.length / 2)));
  const W = 2 * (GAP + maxPerSide * (NODE_W + 14)) + 8;
  const spine = W / 2;
  const ROW_H = NODE_H + 26;
  const top = 18;
  const H = top + rows.length * ROW_H + 4;

  const placed = {};
  let flip = 0;
  rows.forEach((row, r) => {
    const y = top + r * ROW_H + NODE_H / 2;
    row.forEach((n, j) => {
      const side = (j + flip) % 2 ? 1 : -1; // −1 left, +1 right
      const slot = Math.floor(j / 2);
      const x = spine + side * (GAP + NODE_W / 2 + slot * (NODE_W + 14));
      placed[n.id] = { x, y, n, side };
    });
    if (row.length % 2) flip = 1 - flip;
  });

  const root = html("div", { class: "viz" });
  const legend = html("div", { class: "legend" }, schools.map((s) => html("span", {}, [html("span", { class: "swatch", style: `background:${schoolColor(s)}` }), s])));
  const scroller = html("div", { class: "cmap-scroll" });
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: "margin:0 auto" });
  const hint = html("p", { class: "stage-caption", style: "font-size:12.5px", text: "Click a thinker or idea to ask your teacher about it." });
  scroller.append(svg);
  root.append(legend, hint, scroller);
  container.append(root);

  // spine + year markers
  el("line", { x1: spine, x2: spine, y1: top - 8, y2: H - 6, stroke: "var(--axis)", "stroke-width": 2 }, svg);
  rows.forEach((row, r) => {
    const y = top + r * ROW_H + NODE_H / 2;
    el("circle", { cx: spine, cy: y, r: 4, fill: "var(--ink-2)", class: "dot" }, svg);
    if (hasYears) {
      const t = el("text", { x: spine, y: y - 9, "text-anchor": "middle", class: "cmap-edge-label" }, svg);
      t.textContent = String(rowKeys[r]);
    }
  });

  // arrowhead
  const defs = el("defs", {}, svg);
  const arrowId = `arrow-${Math.random().toString(36).slice(2, 8)}`;
  const marker = el("marker", { id: arrowId, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--axis)" }, marker);

  const edgeLayer = el("g", {}, svg);
  const nodeLayer = el("g", {}, svg);
  const labelLayer = el("g", {}, svg);

  for (const e of edges) {
    const a = placed[e.from];
    const b = placed[e.to];
    if (!a || !b) continue;
    const [x1, y1] = edgeAnchor(a, b);
    const [x2, y2] = edgeAnchor(b, a);
    // same-side links bow outward, away from the spine; cross-spine links arc gently
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const sameSide = a.side === b.side;
    const cx = (x1 + x2) / 2 + (sameSide ? a.side * Math.min(44, len * 0.3) : 0);
    const cy = (y1 + y2) / 2 - (sameSide ? 0 : Math.min(24, len * 0.1));
    el("path", { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, class: "cmap-edge", "marker-end": `url(#${arrowId})`, "data-from": e.from, "data-to": e.to }, edgeLayer);
    if (e.label) {
      const t = el("text", { x: (x1 + 2 * cx + x2) / 4, y: (y1 + 2 * cy + y2) / 4 + 4, "text-anchor": "middle", class: "cmap-edge-label" }, labelLayer);
      t.textContent = e.label;
    }
  }

  for (const { x, y, n } of Object.values(placed)) {
    const g = el("g", { class: "cmap-node", tabindex: 0, role: "button", "aria-label": `${n.label}${n.detail ? `: ${n.detail}` : ""}` }, nodeLayer);
    const c = schoolColor(n.school || "Other");
    el("rect", { x: x - NODE_W / 2, y: y - NODE_H / 2, width: NODE_W, height: NODE_H, rx: 10, fill: "var(--surface)", stroke: c }, g);
    el("rect", { x: x - NODE_W / 2, y: y - NODE_H / 2, width: 5, height: NODE_H, rx: 2, fill: c }, g);
    el("text", { x: x - NODE_W / 2 + 12, y: y - 3 }, g).textContent = truncate(n.label, 26);
    el("text", { x: x - NODE_W / 2 + 12, y: y + 13, class: "sub" }, g).textContent = truncate(n.detail ?? "", 34);
    if (n.detail) el("title", {}, g).textContent = n.detail;
    const ask = () => {
      focused = n.id;
      for (const p of edgeLayer.querySelectorAll("path")) p.style.stroke = p.dataset.from === n.id || p.dataset.to === n.id ? "var(--accent)" : "";
      onStateChange?.();
      onAsk?.(`Tell me about ${n.label}${n.detail ? ` (${n.detail})` : ""} and how it connects to the rest of the map.`);
    };
    g.addEventListener("click", ask);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ask(); } });
  }

  return {
    summary() {
      let t = `Concept map: ${nodes.map((n) => `${n.label}${hasYears ? ` (${n.year})` : ""} [${n.school || "Other"}]`).join("; ")}.`;
      if (edges.length) t += ` Links: ${edges.map((e) => `${e.from}→${e.to}${e.label ? ` "${e.label}"` : ""}`).join(", ")}.`;
      if (focused) t += ` Student clicked on ${placed[focused]?.n.label}.`;
      return t;
    },
    changed: () => focused !== null,
    reset() {
      focused = null;
      for (const p of edgeLayer.querySelectorAll("path")) p.style.stroke = "";
    },
  };
}

function edgeAnchor(a, b) {
  // same side of the spine: leave from the outer edge; otherwise from the edge facing the other node
  if (a.side === b.side && Math.abs(a.x - b.x) < 1) return [a.x + a.side * (NODE_W / 2), a.y];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) * NODE_H > Math.abs(dy) * NODE_W) return [a.x + Math.sign(dx) * (NODE_W / 2), a.y];
  return [a.x, a.y + Math.sign(dy) * (NODE_H / 2)];
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
