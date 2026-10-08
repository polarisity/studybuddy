// Linear supply & demand with surplus areas, taxes and price controls.
// Demand: P = a - b·Q    Supply: P = c + d·Q
import { el, html, frame, slider, statRow, tooltip, draggable, clamp, round, fmt, color, niceMax } from "./svg.js";

export const title = "Supply & demand";

export function solve({ a, b, c, d, policy, tax, ceiling, floor }) {
  const qStar = Math.max(0, (a - c) / (b + d));
  const pStar = a - b * qStar;
  const out = { qStar, pStar, binding: false, shortage: 0, excess: 0, taxRevenue: 0, dwl: 0 };

  if (policy === "tax" && tax > 0) {
    const q = Math.max(0, (a - c - tax) / (b + d));
    const pc = a - b * q;
    const pp = pc - tax;
    Object.assign(out, {
      binding: true, q, pBuyer: pc, pSeller: pp,
      cs: 0.5 * (a - pc) * q,
      ps: 0.5 * (pp - c) * q,
      taxRevenue: tax * q,
      dwl: 0.5 * tax * (qStar - q),
    });
  } else if (policy === "ceiling" && ceiling < pStar) {
    const qs = Math.max(0, (ceiling - c) / d);
    const qd = Math.max(0, (a - ceiling) / b);
    Object.assign(out, {
      binding: true, q: qs, pBuyer: ceiling, pSeller: ceiling, shortage: qd - qs, qd, qs,
      cs: (a - ceiling) * qs - (b * qs * qs) / 2,
      ps: 0.5 * (ceiling - c) * qs,
      dwl: 0.5 * (qStar - qs) * (a - b * qs - ceiling),
    });
  } else if (policy === "floor" && floor > pStar) {
    const qd = Math.max(0, (a - floor) / b);
    const qs = (floor - c) / d;
    Object.assign(out, {
      binding: true, q: qd, pBuyer: floor, pSeller: floor, excess: qs - qd, qd, qs,
      cs: 0.5 * (a - floor) * qd,
      ps: (floor - c) * qd - (d * qd * qd) / 2,
      dwl: 0.5 * (qStar - qd) * (floor - (c + d * qd)),
    });
  }
  if (!out.binding) {
    Object.assign(out, { q: qStar, pBuyer: pStar, pSeller: pStar, cs: 0.5 * (a - pStar) * qStar, ps: 0.5 * (pStar - c) * qStar });
  }
  out.total = out.cs + out.ps + out.taxRevenue;
  return out;
}

export function defaults() {
  return {
    demand_intercept: 100, demand_slope: 1, supply_intercept: 10, supply_slope: 0.5,
    tax: 0, price_ceiling: null, price_floor: null, shift_demand: 0, shift_supply: 0,
    show_surplus: true, x_label: "Quantity", y_label: "Price ($)",
  };
}

export function mount(container, rawParams, { onStateChange } = {}) {
  const p = { ...defaults(), ...rawParams };
  const base = { a: p.demand_intercept, b: p.demand_slope, c: p.supply_intercept, d: p.supply_slope };
  const initialPolicy = p.tax > 0 ? "tax" : p.price_ceiling != null ? "ceiling" : p.price_floor != null ? "floor" : "none";
  const initial = () => ({
    a: base.a + (p.shift_demand || 0),
    c: base.c + (p.shift_supply || 0),
    policy: initialPolicy,
    tax: p.tax || round(base.a * 0.15, 0),
    ceiling: p.price_ceiling ?? null,
    floor: p.price_floor ?? null,
    showSurplus: p.show_surplus !== false,
  });
  let s = initial();
  const eq0 = solve({ ...base, policy: "none" });
  if (s.ceiling == null) s.ceiling = round(eq0.pStar * 0.75, 0);
  if (s.floor == null) s.floor = round(eq0.pStar * 1.25, 0);
  const startState = { ...s };

  // fixed axes so movement is visible
  const xMax = niceMax(Math.max(base.a / base.b, eq0.qStar * 1.6) * 1.05);
  const yMax = niceMax(Math.max(base.a, base.c + base.d * xMax * 0.6) * 1.15);
  const clampA = (v) => clamp(v, base.a * 0.35, yMax);
  const clampC = (v) => clamp(v, 0, yMax * 0.8);

  const root = html("div", { class: "viz" });
  const grid = html("div", { class: "viz-grid" });
  const chartBox = html("div");
  const panel = html("div", { class: "panel" });
  grid.append(chartBox, panel);
  root.append(grid);
  container.append(root);

  const F = frame(chartBox, { width: 640, height: 430, xMax, yMax, xLabel: p.x_label, yLabel: p.y_label, fmtY: (v) => `$${fmt(v)}` });
  const { svg, x, y } = F;
  const tip = tooltip(chartBox);
  const layers = {
    areas: el("g", {}, F.plot),
    ghosts: el("g", {}, F.plot),
    guides: el("g", {}, F.plot),
    curves: el("g", {}, F.plot),
    marks: el("g", {}, F.plot),
  };
  // persistent, fat, invisible hit lines so a drag survives re-renders
  const hits = el("g", {}, F.plot);
  const dHit = el("line", { class: "handle", stroke: "transparent", "stroke-width": 22 }, hits);
  const sHit = el("line", { class: "handle", stroke: "transparent", "stroke-width": 22 }, hits);
  dHit.style.cursor = sHit.style.cursor = "ns-resize";
  el("title", {}, dHit).textContent = "Drag to shift demand";
  el("title", {}, sHit).textContent = "Drag to shift supply";

  const legend = html("div", { class: "legend" }, [
    html("span", {}, [html("span", { class: "swatch", style: `background:${color(1)}` }), "Demand (drag me)"]),
    html("span", {}, [html("span", { class: "swatch", style: `background:${color(2)}` }), "Supply (drag me)"]),
  ]);
  root.insertBefore(legend, grid);

  // ---- panel ----
  const statsCard = html("div", { class: "card" });
  const policyCard = html("div", { class: "card" }, [html("h3", { text: "Policy" })]);
  const seg = html("div", { class: "seg" });
  const policyButtons = {};
  for (const [key, label] of [["none", "Free market"], ["tax", "Tax"], ["ceiling", "Price ceiling"], ["floor", "Price floor"]]) {
    policyButtons[key] = html("button", { type: "button", text: label, onclick: () => { s.policy = key; render(); } });
    seg.append(policyButtons[key]);
  }
  const taxSlider = slider({ label: "Tax per unit", min: 0, max: round(yMax * 0.5, 0), step: 1, value: s.tax, format: (v) => `$${v}`, onInput: (v) => { s.tax = v; render(); } });
  const ceilSlider = slider({ label: "Maximum price", min: 0, max: yMax, step: 1, value: s.ceiling, format: (v) => `$${v}`, onInput: (v) => { s.ceiling = v; render(); } });
  const floorSlider = slider({ label: "Minimum price", min: 0, max: yMax, step: 1, value: s.floor, format: (v) => `$${v}`, onInput: (v) => { s.floor = v; render(); } });
  policyCard.append(seg, taxSlider.node, ceilSlider.node, floorSlider.node);

  const shiftCard = html("div", { class: "card" }, [html("h3", { text: "Shift the curves" })]);
  const dSlider = slider({ label: "Demand", min: round(-base.a * 0.5, 0), max: round(yMax - base.a, 0), step: 1, value: s.a - base.a, format: signed, onInput: (v) => { s.a = clampA(base.a + v); render(); } });
  const sSlider = slider({ label: "Supply cost", min: round(-base.c, 0), max: round(yMax * 0.6, 0), step: 1, value: s.c - base.c, format: signed, onInput: (v) => { s.c = clampC(base.c + v); render(); } });
  const surplusToggle = html("input", { type: "checkbox" });
  surplusToggle.checked = s.showSurplus;
  surplusToggle.addEventListener("change", () => { s.showSurplus = surplusToggle.checked; render(); });
  shiftCard.append(dSlider.node, sSlider.node, html("label", { class: "toggle" }, [surplusToggle, "Shade surplus areas"]));
  panel.append(statsCard, policyCard, shiftCard);

  // ---- drag curves ----
  let dragFrom = null;
  function hookDrag(hit, which) {
    draggable(svg, hit, {
      onStart: () => { dragFrom = which === "d" ? s.a : s.c; },
      onMove: (pt, start) => {
        const dp = y.invert(pt.y) - y.invert(start.y);
        if (which === "d") s.a = clampA(round(dragFrom + dp, 0));
        else s.c = clampC(round(dragFrom + dp, 0));
        dSlider.set(s.a - base.a);
        sSlider.set(s.c - base.c);
        render(false);
      },
      onEnd: () => render(),
    });
  }

  const linePts = (intercept, slope) => {
    const q1 = slope > 0 ? xMax : Math.min(xMax, intercept / Math.abs(slope));
    const p1 = intercept + slope * q1;
    const qEnd = p1 > yMax ? (yMax - intercept) / slope : q1;
    return [x(0), y(intercept), x(qEnd), y(intercept + slope * qEnd)];
  };

  function setLine(node, intercept, slope) {
    const [x1, y1, x2, y2] = linePts(intercept, slope);
    for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) node.setAttribute(k, v);
  }

  function drawLine(g, intercept, slope, cls, stroke, extra = {}) {
    const [x1, y1, x2, y2] = linePts(intercept, slope);
    return el("line", { x1, y1, x2, y2, class: cls, stroke, ...extra }, g);
  }

  function poly(points, fill, opacity, label, value) {
    if (value <= 0.01) return;
    const node = el("polygon", { points: points.map(([q, pr]) => `${x(q)},${y(pr)}`).join(" "), fill, "fill-opacity": opacity }, layers.areas);
    node.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      tip.show(svg, ((e.clientX - r.left) / r.width) * vb.width, ((e.clientY - r.top) / r.height) * vb.height, `${label}: ${fmt(value)}`);
    });
    node.addEventListener("pointerleave", () => tip.hide());
  }

  let first = true;
  function render(notify = true) {
    for (const g of Object.values(layers)) g.replaceChildren();
    const m = { a: s.a, b: base.b, c: s.c, d: base.d, policy: s.policy, tax: s.tax, ceiling: s.ceiling, floor: s.floor };
    const r = solve(m);

    for (const [k, b] of Object.entries(policyButtons)) b.classList.toggle("on", k === s.policy);
    taxSlider.node.hidden = s.policy !== "tax";
    ceilSlider.node.hidden = s.policy !== "ceiling";
    floorSlider.node.hidden = s.policy !== "floor";

    // surplus areas
    if (s.showSurplus) {
      const q = r.q;
      if (s.policy === "ceiling" && r.binding) {
        poly([[0, m.a], [0, r.pBuyer], [q, r.pBuyer], [q, m.a - m.b * q]], color(1), 0.16, "Consumer surplus", r.cs);
        poly([[0, m.c], [0, r.pSeller], [q, r.pSeller]], color(2), 0.18, "Producer surplus", r.ps);
        poly([[q, m.a - m.b * q], [q, r.pSeller], [r.qStar, r.pStar]], color(8), 0.42, "Deadweight loss", r.dwl);
      } else if (s.policy === "floor" && r.binding) {
        poly([[0, m.a], [0, r.pBuyer], [q, r.pBuyer]], color(1), 0.16, "Consumer surplus", r.cs);
        poly([[0, m.c], [0, r.pSeller], [q, r.pSeller], [q, m.c + m.d * q]], color(2), 0.18, "Producer surplus", r.ps);
        poly([[q, r.pBuyer], [q, m.c + m.d * q], [r.qStar, r.pStar]], color(8), 0.42, "Deadweight loss", r.dwl);
      } else {
        poly([[0, m.a], [0, r.pBuyer], [q, r.pBuyer]], color(1), 0.16, "Consumer surplus", r.cs);
        poly([[0, m.c], [0, r.pSeller], [q, r.pSeller]], color(2), 0.18, "Producer surplus", r.ps);
        if (r.taxRevenue > 0) poly([[0, r.pBuyer], [q, r.pBuyer], [q, r.pSeller], [0, r.pSeller]], color(3), 0.26, "Tax revenue", r.taxRevenue);
        if (r.dwl > 0) poly([[q, r.pBuyer], [q, r.pSeller], [r.qStar, r.pStar]], color(8), 0.42, "Deadweight loss", r.dwl);
      }
    }

    // ghosts of the starting curves after a shift
    if (s.a !== base.a) drawLine(layers.ghosts, base.a, -base.b, "curve", color(1), { "stroke-opacity": 0.35, "stroke-dasharray": "6 6" });
    if (s.c !== base.c) drawLine(layers.ghosts, base.c, base.d, "curve", color(2), { "stroke-opacity": 0.35, "stroke-dasharray": "6 6" });

    // curves
    drawLine(layers.curves, m.a, -m.b, `curve${first ? " anim-draw" : ""}`, color(1));
    drawLine(layers.curves, m.c, m.d, `curve${first ? " anim-draw" : ""}`, color(2));
    setLine(dHit, m.a, -m.b);
    setLine(sHit, m.c, m.d);
    labelAtEnd(m.a, -m.b, "D");
    labelAtEnd(m.c, m.d, "S");

    // policy lines
    if (s.policy === "ceiling") policyLine(s.ceiling, `Ceiling $${s.ceiling}${r.binding ? "" : " (not binding)"}`);
    if (s.policy === "floor") policyLine(s.floor, `Floor $${s.floor}${r.binding ? "" : " (not binding)"}`);

    // guides + points
    guideTo(r.q, r.pBuyer);
    if (Math.abs(r.pBuyer - r.pSeller) > 0.01) guideTo(r.q, r.pSeller);
    if (r.binding) {
      el("circle", { cx: x(r.qStar), cy: y(r.pStar), r: 4, fill: "var(--surface)", stroke: "var(--muted)", "stroke-width": 1.5 }, layers.marks);
    }
    el("circle", { cx: x(r.q), cy: y(r.pBuyer), r: 6, class: "dot", fill: "var(--ink)" }, layers.marks);
    const hot = el("circle", { cx: x(r.q), cy: y(r.pBuyer), r: 16, class: "handle-hit" }, layers.marks);
    hot.addEventListener("pointerenter", () => tip.show(svg, x(r.q), y(r.pBuyer), `Q = ${fmt(r.q, 1)}, P = $${fmt(r.pBuyer, 2)}`));
    hot.addEventListener("pointerleave", () => tip.hide());

    if (r.shortage > 0.01) bracket(r.qs, r.qd, s.ceiling, `Shortage: ${fmt(r.shortage, 1)}`);
    if (r.excess > 0.01) bracket(r.qd, r.qs, s.floor, `Surplus (unsold): ${fmt(r.excess, 1)}`);

    // stats
    statsCard.replaceChildren(html("h3", { text: "What's happening" }));
    if (Math.abs(r.pBuyer - r.pSeller) > 0.01) {
      statsCard.append(statRow("Buyers pay", `$${fmt(r.pBuyer, 2)}`), statRow("Sellers keep", `$${fmt(r.pSeller, 2)}`));
    } else {
      statsCard.append(statRow("Price", `$${fmt(r.pBuyer, 2)}`));
    }
    statsCard.append(
      statRow("Quantity traded", fmt(r.q, 1)),
      statRow("Consumer surplus", fmt(r.cs), color(1)),
      statRow("Producer surplus", fmt(r.ps), color(2)),
    );
    if (r.taxRevenue > 0) statsCard.append(statRow("Tax revenue", fmt(r.taxRevenue), color(3)));
    statsCard.append(statRow("Deadweight loss", fmt(r.dwl), color(8)));
    if (r.shortage > 0.01) statsCard.append(statRow("Shortage", fmt(r.shortage, 1)));
    if (r.excess > 0.01) statsCard.append(statRow("Unsold surplus", fmt(r.excess, 1)));

    first = false;
    if (notify) onStateChange?.();
  }

  function labelAtEnd(intercept, slope, txt) {
    const [, , x2, y2] = linePts(intercept, slope);
    el("text", { x: x2 + 6, y: y2 + (slope < 0 ? -4 : 12), class: "ink", "font-weight": 600 }, layers.curves).textContent = txt;
  }
  function guideTo(q, pr) {
    el("path", { class: "guide", d: `M${x(0)},${y(pr)} H${x(q)} V${y(0)}` }, layers.guides);
  }
  function policyLine(price, label) {
    el("line", { x1: x(0), x2: x(xMax), y1: y(price), y2: y(price), stroke: "var(--ink)", "stroke-width": 1.5, "stroke-dasharray": "8 4" }, layers.guides);
    el("text", { x: x(xMax) - 4, y: y(price) - 6, "text-anchor": "end", class: "ink", "font-weight": 600 }, layers.guides).textContent = label;
  }
  function bracket(q1, q2, price, label) {
    const yy = y(price) + 14;
    el("path", { d: `M${x(q1)},${yy - 5} V${yy} H${x(q2)} V${yy - 5}`, stroke: "var(--ink)", "stroke-width": 1.5, fill: "none" }, layers.guides);
    el("text", { x: (x(q1) + x(q2)) / 2, y: yy + 14, "text-anchor": "middle", class: "ink" }, layers.guides).textContent = label;
  }

  hookDrag(dHit, "d");
  hookDrag(sHit, "s");
  render(false);

  function describe() {
    const r = solve({ a: s.a, b: base.b, c: s.c, d: base.d, policy: s.policy, tax: s.tax, ceiling: s.ceiling, floor: s.floor });
    const parts = [
      `Demand P = ${fmt(s.a, 2)} − ${fmt(base.b, 2)}·Q, supply P = ${fmt(s.c, 2)} + ${fmt(base.d, 2)}·Q.`,
      `Free-market equilibrium: P=$${fmt(r.pStar, 2)}, Q=${fmt(r.qStar, 2)}.`,
    ];
    if (s.policy === "tax") parts.push(`Policy: tax $${s.tax}/unit → buyers pay $${fmt(r.pBuyer, 2)}, sellers keep $${fmt(r.pSeller, 2)}, Q=${fmt(r.q, 2)}.`);
    if (s.policy === "ceiling") parts.push(`Policy: price ceiling $${s.ceiling} (${r.binding ? `binding; shortage ${fmt(r.shortage, 2)}` : "not binding"}).`);
    if (s.policy === "floor") parts.push(`Policy: price floor $${s.floor} (${r.binding ? `binding; unsold surplus ${fmt(r.excess, 2)}` : "not binding"}).`);
    parts.push(`CS=${fmt(r.cs, 1)}, PS=${fmt(r.ps, 1)}${r.taxRevenue ? `, tax revenue=${fmt(r.taxRevenue, 1)}` : ""}, DWL=${fmt(r.dwl, 1)}.`);
    return parts.join(" ");
  }

  return {
    summary: describe,
    changed: () => JSON.stringify(s) !== JSON.stringify(startState),
    reset() {
      s = { ...startState };
      taxSlider.set(s.tax); ceilSlider.set(s.ceiling); floorSlider.set(s.floor);
      dSlider.set(s.a - base.a); sSlider.set(s.c - base.c);
      surplusToggle.checked = s.showSurplus;
      render(false);
    },
  };
}

function signed(v) {
  return v > 0 ? `+${v}` : `${v}`;
}
