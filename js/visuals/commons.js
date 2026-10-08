// Tragedy of the commons: a shared, regrowing pasture/fishery harvested by N users.
import { el, html, frame, slider, statRow, fmt, color, niceMax } from "./svg.js";

export const title = "Tragedy of the commons";

/**
 * Logistic regrowth: S' = S + r·S·(1 − S/K) − H, where H = min(S, total harvest).
 * The biggest harvest the resource can sustain forever is r·K/4 (when S = K/2).
 */
export function simulate({ herders, take, regen, capacity, rounds, quota }) {
  let stock = capacity;
  const rows = [];
  let perHerder = 0;
  for (let t = 1; t <= rounds; t++) {
    const demand = herders * take;
    const allowed = quota ? Math.min(demand, quota) : demand;
    const harvest = Math.min(stock, allowed);
    stock = Math.max(0, stock - harvest);
    stock = Math.min(capacity, stock + regen * stock * (1 - stock / capacity));
    perHerder += harvest / herders;
    rows.push({ t, stock, harvest, perHerder });
  }
  const collapsed = rows.find((r) => r.stock < capacity * 0.01);
  return { rows, collapsedAt: collapsed?.t ?? null, msy: (regen * capacity) / 4, perHerder };
}

export function mount(container, params, { onStateChange } = {}) {
  const init = {
    herders: params.herders ?? 6,
    take: params.take_per_herder ?? null,
    regen: params.regen_rate ?? 0.4,
    capacity: params.capacity ?? 1000,
    rounds: params.rounds ?? 40,
    quota: params.quota ?? null,
    resource: params.resource_name ?? "Fish",
  };
  if (init.take == null) init.take = Math.round(((init.regen * init.capacity) / 4 / init.herders) * 1.6);
  let s = { ...init, useQuota: init.quota != null, quota: init.quota ?? Math.round((init.regen * init.capacity) / 4) };
  const start = JSON.stringify(s);

  const root = html("div", { class: "viz" });
  const grid = html("div", { class: "viz-grid" });
  const chartBox = html("div");
  const panel = html("div", { class: "panel" });
  grid.append(chartBox, panel);
  const legend = html("div", { class: "legend" }, [
    html("span", {}, [html("span", { class: "swatch", style: `background:${color(1)}` }), `${init.resource} remaining`]),
    html("span", {}, [html("span", { class: "swatch", style: `background:${color(2)}` }), "Total harvest per round"]),
  ]);
  root.append(legend, grid);
  container.append(root);

  const yMax = niceMax(init.capacity * 1.05);
  const F = frame(chartBox, { width: 640, height: 400, xMax: init.rounds, yMax, xLabel: "Round (season)", yLabel: init.resource });
  const { x, y, plot } = F;
  const layer = el("g", {}, plot);
  const hover = el("g", {}, plot);
  const capture = el("rect", { x: F.M.left, y: F.M.top, width: F.W - F.M.left - F.M.right, height: F.H - F.M.top - F.M.bottom, fill: "transparent" }, plot);
  const tipBox = html("div", { class: "tooltip" });
  chartBox.style.position = "relative";
  chartBox.append(tipBox);

  const statsCard = html("div", { class: "card" });
  const ctrlCard = html("div", { class: "card" }, [html("h3", { text: "Rules of the commons" })]);
  const herdersS = slider({ label: "Number of users", min: 1, max: 30, value: s.herders, onInput: (v) => { s.herders = v; play(); } });
  const takeS = slider({ label: "Each user takes / round", min: 0, max: Math.round(init.capacity / 4), value: s.take, onInput: (v) => { s.take = v; play(); } });
  const regenS = slider({ label: "Regrowth rate", min: 0.05, max: 1, step: 0.05, value: s.regen, format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { s.regen = v; play(); } });
  const quotaToggle = html("input", { type: "checkbox" });
  quotaToggle.checked = s.useQuota;
  const quotaS = slider({ label: "Total quota / round", min: 0, max: Math.round(init.capacity / 2), value: s.quota, onInput: (v) => { s.quota = v; play(); } });
  quotaToggle.addEventListener("change", () => { s.useQuota = quotaToggle.checked; play(); });
  ctrlCard.append(herdersS.node, takeS.node, regenS.node, html("label", { class: "toggle" }, [quotaToggle, "Community sets a quota"]), quotaS.node);
  const replay = html("button", { type: "button", class: "btn small", text: "▶ Replay seasons", onclick: () => play(true) });
  ctrlCard.append(replay);
  panel.append(statsCard, ctrlCard);

  let anim = null;
  let result = null;
  function play(animate = false) {
    cancelAnimationFrame(anim);
    quotaS.node.hidden = !s.useQuota;
    result = simulate({ ...s, quota: s.useQuota ? s.quota : null });
    if (!animate) {
      draw(result.rows.length);
      onStateChange?.();
      return;
    }
    let n = 0;
    const step = () => {
      n++;
      draw(n);
      if (n < result.rows.length) anim = requestAnimationFrame(() => setTimeout(step, 40));
    };
    step();
  }

  function draw(n) {
    layer.replaceChildren();
    const rows = result.rows.slice(0, n);
    const msy = (s.regen * s.capacity) / 4;
    el("line", { x1: x(0), x2: x(s.rounds), y1: y(msy), y2: y(msy), stroke: "var(--muted)", "stroke-dasharray": "4 4" }, layer);
    el("text", { x: x(s.rounds) - 4, y: y(msy) - 6, "text-anchor": "end" }, layer).textContent = `Max sustainable harvest ≈ ${fmt(msy)}`;
    const line = (key, c) => {
      const d = [`M${x(0)},${y(key === "stock" ? s.capacity : 0)}`, ...rows.map((r) => `L${x(r.t)},${y(r[key])}`)].join(" ");
      el("path", { d, class: "curve", stroke: c }, layer);
      const last = rows.at(-1);
      if (last) el("circle", { cx: x(last.t), cy: y(last[key]), r: 5, class: "dot", fill: c }, layer);
    };
    el("path", { d: [`M${x(0)},${y(0)} L${x(0)},${y(s.capacity)}`, ...rows.map((r) => `L${x(r.t)},${y(r.stock)}`), `L${x(rows.at(-1)?.t ?? 0)},${y(0)} Z`].join(" "), fill: color(1), "fill-opacity": 0.1 }, layer);
    line("stock", color(1));
    line("harvest", color(2));
    if (result.collapsedAt && n >= result.collapsedAt) {
      el("text", { x: x(result.collapsedAt) + 6, y: y(s.capacity * 0.12), class: "ink", "font-weight": 600 }, layer).textContent = `Collapse in round ${result.collapsedAt}`;
    }

    const last = result.rows.at(-1);
    const sustainableTotal = Math.min(s.herders * s.take, s.useQuota ? s.quota : Infinity);
    statsCard.replaceChildren(
      html("h3", { text: "Outcome" }),
      statRow(`${init.resource} left at the end`, fmt(last.stock), color(1)),
      statRow("Each user's total catch", fmt(last.perHerder)),
      statRow("Total wanted per round", fmt(s.herders * s.take)),
      statRow("Sustainable maximum", fmt(msy)),
      html("div", { class: "callout", style: "margin-top:8px", text: result.collapsedAt
        ? `The resource collapses in round ${result.collapsedAt}. Each user gains the full benefit of taking more, but bears only 1/${s.herders} of the damage.`
        : sustainableTotal <= msy ? "Sustainable: harvest stays within what the resource can regrow." : "Under strain: the stock is shrinking toward a lower level." }),
    );
  }

  capture.addEventListener("pointermove", (e) => {
    const svg = F.svg;
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * svg.viewBox.baseVal.width;
    const t = Math.max(1, Math.min(s.rounds, Math.round(x.invert(vx))));
    const row = result.rows[t - 1];
    hover.replaceChildren();
    el("line", { x1: x(t), x2: x(t), y1: y(0), y2: y(yMax), stroke: "var(--axis)" }, hover);
    tipBox.textContent = `Round ${t}: ${init.resource.toLowerCase()} ${fmt(row.stock)}, harvest ${fmt(row.harvest)}`;
    tipBox.style.left = `${(x(t) / svg.viewBox.baseVal.width) * r.width}px`;
    tipBox.style.top = `${(y(row.stock) / svg.viewBox.baseVal.height) * r.height}px`;
    tipBox.classList.add("show");
  });
  capture.addEventListener("pointerleave", () => { hover.replaceChildren(); tipBox.classList.remove("show"); });

  play(true);

  return {
    summary() {
      const last = result.rows.at(-1);
      return `Commons simulation (${init.resource}): ${s.herders} users each trying to take ${s.take}/round (total ${s.herders * s.take}), regrowth ${Math.round(s.regen * 100)}%, capacity ${s.capacity}, max sustainable harvest ≈ ${fmt((s.regen * s.capacity) / 4)}/round${s.useQuota ? `, community quota ${s.quota}/round` : ", no quota"}. Result after ${s.rounds} rounds: stock ${fmt(last.stock)}, each user's total catch ${fmt(last.perHerder)}${result.collapsedAt ? `; collapsed in round ${result.collapsedAt}` : "; no collapse"}.`;
    },
    changed: () => JSON.stringify(s) !== start,
    reset() {
      s = JSON.parse(start);
      herdersS.set(s.herders); takeS.set(s.take); regenS.set(s.regen); quotaS.set(s.quota);
      quotaToggle.checked = s.useQuota;
      play(true);
    },
  };
}
