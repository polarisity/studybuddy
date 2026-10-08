// Lorenz curve + Gini from income shares by quintile, with a redistribution slider.
import { el, html, frame, slider, statRow, tooltip, fmt, color } from "./svg.js";

export const title = "Lorenz curve";

// Approximate shares of household income by quintile (bottom → top), rounded, for teaching.
export const PRESETS = {
  perfect_equality: { label: "Perfect equality", shares: [20, 20, 20, 20, 20] },
  nordic: { label: "Nordic country (approx.)", shares: [9, 14, 18, 23, 36] },
  united_states: { label: "United States (approx.)", shares: [3.1, 8.3, 14.1, 22.7, 51.8] },
  brazil: { label: "Brazil (approx.)", shares: [3.3, 7.6, 12.3, 19, 57.8] },
  south_africa: { label: "South Africa (approx.)", shares: [2.4, 4.8, 8.2, 16.5, 68.1] },
};

export function normalize(shares) {
  const sum = shares.reduce((a, b) => a + b, 0) || 1;
  return shares.map((s) => (s / sum) * 100);
}

/** Gini via trapezoids on the 5-point Lorenz curve (understates the true Gini slightly). */
export function gini(shares) {
  const n = normalize(shares).map((s) => s / 100);
  let cum = 0;
  let area = 0;
  for (const s of n) {
    const prev = cum;
    cum += s;
    area += 0.2 * (prev + cum);
  }
  return Math.max(0, 1 - area);
}

const cumulative = (shares) => {
  let c = 0;
  return [0, ...normalize(shares).map((s) => (c += s))];
};

export function mount(container, params, { onStateChange } = {}) {
  const preset = params.preset && PRESETS[params.preset];
  const baseShares = normalize(params.quintile_shares ?? preset?.shares ?? PRESETS.united_states.shares);
  const baseLabel = params.label ?? preset?.label ?? "Income distribution";
  const compare = params.compare_shares ? normalize(params.compare_shares) : null;
  const compareLabel = params.compare_label ?? "Comparison";

  let redistribution = params.redistribution ?? 0; // % flat tax returned as equal cash transfer
  const start = redistribution;

  const root = html("div", { class: "viz" });
  const grid = html("div", { class: "viz-grid" });
  const chartBox = html("div");
  const panel = html("div", { class: "panel" });
  const legend = html("div", { class: "legend" });
  grid.append(chartBox, panel);
  root.append(legend, grid);
  container.append(root);

  const F = frame(chartBox, {
    width: 560, height: 470, xMax: 100, yMax: 100,
    xTicks: [0, 20, 40, 60, 80, 100], yTicks: [0, 20, 40, 60, 80, 100],
    fmtX: (v) => `${v}%`, fmtY: (v) => `${v}%`,
    xLabel: "Households, poorest → richest (cumulative)", yLabel: "Share of total income (cumulative)",
  });
  const { svg, x, y } = F;
  const tip = tooltip(chartBox);
  const layer = el("g", {}, F.plot);

  const heroCard = html("div", { class: "card" });
  const sharesCard = html("div", { class: "card" });
  const policyCard = html("div", { class: "card" }, [html("h3", { text: "Redistribute" })]);
  const rSlider = slider({
    label: "Flat tax paid back as equal cash",
    min: 0, max: 100, step: 1, value: redistribution, format: (v) => `${v}%`,
    onInput: (v) => { redistribution = v; render(); onStateChange?.(); },
  });
  policyCard.append(rSlider.node, html("p", { class: "stage-caption", style: "font-size:12.5px;margin:0", text: "Everyone pays the same % of income; the money is split equally among all households." }));
  panel.append(heroCard, sharesCard, policyCard);

  const after = () => baseShares.map((s) => (1 - redistribution / 100) * s + (redistribution / 100) * 20);

  let first = true;
  function curvePath(cum) {
    return cum.map((c, i) => `${i ? "L" : "M"}${x(i * 20)},${y(c)}`).join(" ");
  }

  function render() {
    layer.replaceChildren();
    const shares = after();
    const cum = cumulative(shares);
    // area between equality and curve
    el("path", { d: `${curvePath(cum)} L${x(0)},${y(0)} Z`, fill: color(1), "fill-opacity": 0.12 }, layer);
    el("line", { x1: x(0), y1: y(0), x2: x(100), y2: y(100), stroke: "var(--muted)", "stroke-width": 1.5, "stroke-dasharray": "5 5" }, layer);
    el("text", { x: x(62), y: y(66), class: "ink-2", transform: `rotate(-41 ${x(62)} ${y(66)})` }, layer).textContent = "Perfect equality";

    if (compare) {
      el("path", { d: curvePath(cumulative(compare)), class: "curve", stroke: color(2) }, layer);
    }
    if (redistribution > 0) {
      el("path", { d: curvePath(cumulative(baseShares)), class: "curve", stroke: color(1), "stroke-opacity": 0.35, "stroke-dasharray": "6 6" }, layer);
    }
    el("path", { d: curvePath(cum), class: `curve${first ? " anim-draw" : ""}`, stroke: color(1) }, layer);

    cum.forEach((c, i) => {
      if (i === 0 || i === 5) return;
      el("circle", { cx: x(i * 20), cy: y(c), r: 5, class: "dot", fill: color(1) }, layer);
      const hit = el("circle", { cx: x(i * 20), cy: y(c), r: 16, class: "handle-hit" }, layer);
      hit.addEventListener("pointerenter", () => tip.show(svg, x(i * 20), y(c), `Poorest ${i * 20}% receive ${fmt(c, 1)}% of income`));
      hit.addEventListener("pointerleave", () => tip.hide());
    });

    // legend
    legend.replaceChildren(html("span", {}, [html("span", { class: "swatch", style: `background:${color(1)}` }), redistribution > 0 ? `${baseLabel} after redistribution` : baseLabel]));
    if (redistribution > 0) legend.append(html("span", {}, [html("span", { class: "swatch", style: `background:${color(1)};opacity:.35` }), "Before"]));
    if (compare) legend.append(html("span", {}, [html("span", { class: "swatch", style: `background:${color(2)}` }), compareLabel]));

    // panel
    const g = gini(shares);
    const g0 = gini(baseShares);
    heroCard.replaceChildren(
      html("h3", { text: "Gini coefficient" }),
      html("div", { class: "hero-num", text: g.toFixed(2) }),
      html("div", { class: "stage-caption", style: "font-size:12.5px;margin:2px 0 0" }, [
        redistribution > 0 ? html("span", { class: "delta-up", text: `▼ ${(g0 - g).toFixed(2)} from ${g0.toFixed(2)}  ` }) : null,
        "0 = everyone equal · 1 = one household has everything",
      ]),
    );
    if (compare) heroCard.append(statRow(compareLabel, gini(compare).toFixed(2), color(2)));
    sharesCard.replaceChildren(html("h3", { text: "Share of income" }));
    ["Bottom 20%", "Second 20%", "Middle 20%", "Fourth 20%", "Top 20%"].forEach((lab, i) => sharesCard.append(statRow(lab, `${fmt(shares[i], 1)}%`)));
    sharesCard.append(statRow("Top 20% ÷ bottom 20%", `${fmt(shares[4] / shares[0], 1)}×`));
    first = false;
  }
  render();

  return {
    summary() {
      const shares = after();
      let t = `Lorenz curve for "${baseLabel}": quintile income shares ${shares.map((s) => fmt(s, 1) + "%").join(", ")}; Gini ≈ ${gini(shares).toFixed(3)} (5-point approximation).`;
      if (redistribution > 0) t += ` Student applied a ${redistribution}% flat tax returned as equal cash transfers (Gini was ${gini(baseShares).toFixed(3)} before).`;
      if (compare) t += ` Comparison "${compareLabel}": Gini ≈ ${gini(compare).toFixed(3)}.`;
      return t;
    },
    changed: () => redistribution !== start,
    reset() {
      redistribution = start;
      rSlider.set(start);
      render();
    },
  };
}
