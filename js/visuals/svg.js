// Small helpers shared by the hand-rolled SVG visuals.

const NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  if (parent) parent.appendChild(node);
  return node;
}

export function html(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

export function linear(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  f.invert = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
  return f;
}

function niceStep(max, count) {
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
}

/** Rounds an axis maximum up to a clean tick value. */
export function niceMax(max, count = 5) {
  const step = niceStep(max, count);
  return Math.ceil(max / step - 1e-9) * step;
}

export function niceTicks(max, count = 5) {
  const step = niceStep(max, count);
  const ticks = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

/** Draws a gridded plot frame. Returns { svg, plot, x, y, W, H, M }. */
export function frame(container, { width = 640, height = 420, xMax, yMax, xLabel, yLabel, xTicks, yTicks, fmtX = fmt, fmtY = fmt, margin } = {}) {
  const yTickVals = yTicks ?? niceTicks(yMax);
  const widest = Math.max(...yTickVals.map((t) => fmtY(t).length));
  const M = { top: 16, right: 24, bottom: 46, left: Math.max(56, widest * 7 + 34), ...margin };
  const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  container.appendChild(svg);
  const x = linear([0, xMax], [M.left, width - M.right]);
  const y = linear([0, yMax], [height - M.bottom, M.top]);
  const grid = el("g", { class: "grid" }, svg);
  for (const t of yTickVals) {
    el("line", { x1: M.left, x2: width - M.right, y1: y(t), y2: y(t) }, grid);
    el("text", { x: M.left - 8, y: y(t) + 4, "text-anchor": "end" }, svg).textContent = fmtY(t);
  }
  for (const t of xTicks ?? niceTicks(xMax)) {
    el("text", { x: x(t), y: height - M.bottom + 18, "text-anchor": "middle" }, svg).textContent = fmtX(t);
  }
  el("line", { class: "axis", x1: M.left, x2: width - M.right, y1: y(0), y2: y(0) }, svg);
  el("line", { class: "axis", x1: M.left, x2: M.left, y1: M.top, y2: y(0) }, svg);
  if (xLabel) el("text", { x: (M.left + width - M.right) / 2, y: height - 8, "text-anchor": "middle", class: "ink-2" }, svg).textContent = xLabel;
  if (yLabel) {
    const t = el("text", { x: 14, y: (M.top + height - M.bottom) / 2, "text-anchor": "middle", class: "ink-2", transform: `rotate(-90 14 ${(M.top + height - M.bottom) / 2})` }, svg);
    t.textContent = yLabel;
  }
  const plot = el("g", {}, svg);
  return { svg, plot, x, y, W: width, H: height, M };
}

export function fmt(v, digits = 0) {
  if (!Number.isFinite(v)) return "–";
  const r = Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(digits === 0 && Math.abs(v) < 10 && v % 1 ? 1 : digits);
  return r.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function round(v, d = 2) {
  return Math.round(v * 10 ** d) / 10 ** d;
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Pointer-drag on an SVG element, reporting positions in viewBox coordinates. */
export function draggable(svg, target, { onStart, onMove, onEnd } = {}) {
  const toLocal = (evt) => {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  target.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    target.setPointerCapture(evt.pointerId);
    const start = toLocal(evt);
    onStart?.(start);
    const move = (e) => onMove?.(toLocal(e), start);
    const up = (e) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      onEnd?.(toLocal(e));
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  });
}

/** A labelled range slider. Returns { node, input, set(v) }. */
export function slider({ label, min, max, step = 1, value, format = (v) => v, onInput }) {
  const out = html("output", { text: format(value) });
  const input = html("input", { type: "range", min, max, step, value, "aria-label": label });
  input.addEventListener("input", () => {
    out.textContent = format(+input.value);
    onInput(+input.value);
  });
  const node = html("div", { class: "control" }, [html("label", {}, [html("span", { text: label }), out]), input]);
  return {
    node,
    input,
    set(v) {
      input.value = v;
      out.textContent = format(v);
    },
  };
}

export function statRow(label, value, color) {
  const k = html("span", { class: "k" }, [color ? html("span", { class: "swatch", style: `background:${color}` }) : null, label]);
  return html("div", { class: "stat-row" }, [k, html("span", { class: "v", text: value })]);
}

/** Simple hover tooltip anchored inside a positioned container. */
export function tooltip(container) {
  const tip = html("div", { class: "tooltip" });
  container.style.position = "relative";
  container.appendChild(tip);
  return {
    show(svg, vx, vy, text) {
      const box = svg.getBoundingClientRect();
      const host = container.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      tip.textContent = text;
      tip.style.left = `${box.left - host.left + (vx / vb.width) * box.width}px`;
      tip.style.top = `${box.top - host.top + (vy / vb.height) * box.height}px`;
      tip.classList.add("show");
    },
    hide() {
      tip.classList.remove("show");
    },
  };
}

export const color = (n) => `var(--series-${n})`;
