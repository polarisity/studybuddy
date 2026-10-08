// 2×2 normal-form game: best responses, Nash equilibria, and a playable repeated game.
import { html, statRow, color } from "./svg.js";

export const title = "Game theory";

export const PRESETS = {
  prisoners_dilemma: {
    title: "Prisoner's dilemma",
    row_player: "You", col_player: "Them",
    row_strategies: ["Cooperate", "Defect"], col_strategies: ["Cooperate", "Defect"],
    payoffs: [{ row: 3, col: 3 }, { row: 0, col: 5 }, { row: 5, col: 0 }, { row: 1, col: 1 }],
  },
  public_goods: {
    title: "Public goods game",
    row_player: "You", col_player: "Neighbour",
    row_strategies: ["Contribute", "Free-ride"], col_strategies: ["Contribute", "Free-ride"],
    payoffs: [{ row: 2, col: 2 }, { row: -1, col: 3 }, { row: 3, col: -1 }, { row: 0, col: 0 }],
  },
  stag_hunt: {
    title: "Stag hunt",
    row_player: "You", col_player: "Partner",
    row_strategies: ["Hunt stag", "Hunt hare"], col_strategies: ["Hunt stag", "Hunt hare"],
    payoffs: [{ row: 4, col: 4 }, { row: 0, col: 3 }, { row: 3, col: 0 }, { row: 3, col: 3 }],
  },
  chicken: {
    title: "Chicken",
    row_player: "You", col_player: "Rival",
    row_strategies: ["Swerve", "Straight"], col_strategies: ["Swerve", "Straight"],
    payoffs: [{ row: 0, col: 0 }, { row: -1, col: 1 }, { row: 1, col: -1 }, { row: -10, col: -10 }],
  },
  coordination: {
    title: "Coordination game",
    row_player: "You", col_player: "Other driver",
    row_strategies: ["Drive left", "Drive right"], col_strategies: ["Drive left", "Drive right"],
    payoffs: [{ row: 2, col: 2 }, { row: 0, col: 0 }, { row: 0, col: 0 }, { row: 2, col: 2 }],
  },
};

/** payoffs index: 0 = (r0,c0), 1 = (r0,c1), 2 = (r1,c0), 3 = (r1,c1) */
export function analyze(payoffs) {
  const P = (r, c) => payoffs[r * 2 + c];
  const rowBR = [0, 1].map((c) => {
    const best = Math.max(P(0, c).row, P(1, c).row);
    return [0, 1].filter((r) => P(r, c).row === best);
  });
  const colBR = [0, 1].map((r) => {
    const best = Math.max(P(r, 0).col, P(r, 1).col);
    return [0, 1].filter((c) => P(r, c).col === best);
  });
  const nash = [];
  for (const r of [0, 1]) for (const c of [0, 1]) if (rowBR[c].includes(r) && colBR[r].includes(c)) nash.push([r, c]);
  const totals = payoffs.map((p) => p.row + p.col);
  const bestTotal = Math.max(...totals);
  const dominant = {
    row: [0, 1].find((r) => [0, 1].every((c) => rowBR[c].includes(r)) && rowBR.every((br) => br.length === 1)),
    col: [0, 1].find((c) => [0, 1].every((r) => colBR[r].includes(c)) && colBR.every((br) => br.length === 1)),
  };
  return { rowBR, colBR, nash, totals, bestTotal, dominant };
}

const OPPONENTS = {
  tit_for_tat: { label: "Tit-for-Tat", move: (hist) => (hist.length ? hist.at(-1).you : 0) },
  always_0: { label: "Always 1st", move: () => 0 },
  always_1: { label: "Always 2nd", move: () => 1 },
  grudger: { label: "Grudger", move: (hist) => (hist.some((h) => h.you === 1) ? 1 : 0) },
  random: { label: "Random", move: () => (Math.random() < 0.5 ? 0 : 1) },
};

export function mount(container, params, { onStateChange } = {}) {
  const preset = params.preset && PRESETS[params.preset];
  const g = { ...preset, ...stripNull(params) };
  if (!g.payoffs || g.payoffs.length !== 4) Object.assign(g, PRESETS.prisoners_dilemma);
  const a = analyze(g.payoffs);
  const S = (r) => g.row_strategies[r];
  const T = (c) => g.col_strategies[c];

  let selected = null;
  let history = [];
  let opponent = "tit_for_tat";

  const root = html("div", { class: "viz" });
  const grid = html("div", { class: "viz-grid" });
  const left = html("div");
  const panel = html("div", { class: "panel" });
  grid.append(left, panel);
  root.append(
    html("div", { class: "legend" }, [
      html("span", {}, [html("span", { class: "swatch", style: `background:${color(1)}` }), `${g.row_player} (rows) – first number`]),
      html("span", {}, [html("span", { class: "swatch", style: `background:${color(2)}` }), `${g.col_player} (columns) – second number`]),
    ]),
    grid,
  );
  container.append(root);

  // ---- matrix ----
  const matrix = html("div", { class: "matrix" });
  matrix.append(html("div", { class: "hdr corner", text: `${g.row_player} ↓ · ${g.col_player} →` }), html("div", { class: "hdr", text: T(0) }), html("div", { class: "hdr", text: T(1) }));
  const cells = [];
  for (const r of [0, 1]) {
    matrix.append(html("div", { class: "hdr", text: S(r) }));
    for (const c of [0, 1]) {
      const p = g.payoffs[r * 2 + c];
      const isNash = a.nash.some(([nr, nc]) => nr === r && nc === c);
      const rowU = a.rowBR[c].includes(r);
      const colU = a.colBR[r].includes(c);
      const tags = [];
      if (isNash) tags.push("Nash");
      if (a.totals[r * 2 + c] === a.bestTotal) tags.push("Best total");
      const cell = html("button", { type: "button", class: `cell${isNash ? " nash" : ""}`, "aria-label": `${S(r)} vs ${T(c)}: ${p.row}, ${p.col}` }, [
        tags.length ? html("span", { class: "nash-tag", text: tags.join(" · ") }) : null,
        html("span", { class: "pay" }, [
          html("span", { class: "r", text: String(p.row), style: rowU ? "text-decoration:underline;text-underline-offset:4px" : "" }),
          html("span", { text: " , ", style: "color:var(--muted)" }),
          html("span", { class: "c", text: String(p.col), style: colU ? "text-decoration:underline;text-underline-offset:4px" : "" }),
        ]),
      ]);
      cell.addEventListener("click", () => { selected = [r, c]; renderSelection(); onStateChange?.(); });
      cells.push(cell);
      matrix.append(cell);
    }
  }
  const explain = html("div", { class: "callout", style: "margin-top:14px" });
  left.append(matrix, html("p", { class: "stage-caption", style: "font-size:12.5px", text: "Underlined = best response to the other player's choice. A cell where both numbers are underlined is a Nash equilibrium: nobody gains by switching alone." }), explain);

  function renderSelection() {
    cells.forEach((cell, i) => cell.classList.toggle("selected", selected && i === selected[0] * 2 + selected[1]));
    if (!selected) {
      explain.textContent = "Click any outcome to ask: would either player want to switch?";
      return;
    }
    const [r, c] = selected;
    const p = g.payoffs[r * 2 + c];
    const rowAlt = g.payoffs[(1 - r) * 2 + c].row;
    const colAlt = g.payoffs[r * 2 + (1 - c)].col;
    const msgs = [];
    msgs.push(rowAlt > p.row ? `${g.row_player} would switch to "${S(1 - r)}" (${p.row} → ${rowAlt}).` : `${g.row_player} is happy staying (${p.row} vs ${rowAlt}).`);
    msgs.push(colAlt > p.col ? `${g.col_player} would switch to "${T(1 - c)}" (${p.col} → ${colAlt}).` : `${g.col_player} is happy staying (${p.col} vs ${colAlt}).`);
    explain.textContent = msgs.join(" ");
  }
  renderSelection();

  // ---- repeated game ----
  const playCard = html("div", { class: "card" }, [html("h3", { text: "Play it repeatedly" })]);
  const oppSeg = html("div", { class: "seg" });
  const oppButtons = {};
  for (const [k, o] of Object.entries(OPPONENTS)) {
    const label = k === "always_0" ? `Always ${T(0)}` : k === "always_1" ? `Always ${T(1)}` : o.label;
    oppButtons[k] = html("button", { type: "button", text: label, onclick: () => { opponent = k; history = []; renderPlay(); } });
    oppSeg.append(oppButtons[k]);
  }
  const moveBtns = html("div", { style: "margin-top:10px;display:flex;gap:6px;flex-wrap:wrap" }, [0, 1].map((r) => html("button", { type: "button", class: "btn accent small", text: `Play “${S(r)}”`, onclick: () => play(r) })));
  const roundsBox = html("div", { class: "rounds", style: "margin-top:10px" });
  const scoreBox = html("div", { style: "margin-top:8px" });
  const resetBtn = html("button", { type: "button", class: "btn ghost small", style: "margin-top:8px", text: "Clear rounds", onclick: () => { history = []; renderPlay(); onStateChange?.(); } });
  playCard.append(html("div", { style: "font-size:12.5px;color:var(--ink-2);margin-bottom:6px", text: `You are ${g.row_player === "You" ? "the row player" : g.row_player}. Opponent strategy:` }), oppSeg, moveBtns, roundsBox, scoreBox, resetBtn);

  const factsCard = html("div", { class: "card" }, [html("h3", { text: "Analysis" })]);
  factsCard.append(statRow("Nash equilibria", a.nash.length ? a.nash.map(([r, c]) => `${S(r)} / ${T(c)}`).join("; ") : "none in pure strategies"));
  if (a.dominant.row !== undefined) factsCard.append(statRow(`Dominant strategy (${g.row_player})`, S(a.dominant.row)));
  if (a.dominant.col !== undefined) factsCard.append(statRow(`Dominant strategy (${g.col_player})`, T(a.dominant.col)));
  panel.append(factsCard, playCard);

  function play(r) {
    const c = OPPONENTS[opponent].move(history);
    const p = g.payoffs[r * 2 + c];
    history.push({ you: r, them: c, yp: p.row, tp: p.col });
    if (history.length > 30) history.shift();
    renderPlay();
    onStateChange?.();
  }
  function renderPlay() {
    for (const [k, b] of Object.entries(oppButtons)) b.classList.toggle("on", k === opponent);
    roundsBox.replaceChildren(...history.map((h, i) =>
      html("div", { class: "round", title: `Round ${i + 1}: you ${S(h.you)}, them ${T(h.them)}` }, [
        html("b", { class: h.you === 0 ? "C" : "D", text: S(h.you)[0] }),
        html("b", { class: h.them === 0 ? "C" : "D", text: T(h.them)[0] }),
      ])));
    const you = history.reduce((s, h) => s + h.yp, 0);
    const them = history.reduce((s, h) => s + h.tp, 0);
    scoreBox.replaceChildren(statRow("Your total", String(you), color(1)), statRow("Opponent total", String(them), color(2)));
    if (!history.length) roundsBox.append(html("span", { style: "font-size:12.5px;color:var(--muted)", text: "Top letter = you, bottom = opponent." }));
  }
  renderPlay();

  return {
    summary() {
      const cellsTxt = [0, 1].flatMap((r) => [0, 1].map((c) => `(${S(r)}, ${T(c)}) → ${g.row_player} ${g.payoffs[r * 2 + c].row}, ${g.col_player} ${g.payoffs[r * 2 + c].col}`)).join("; ");
      let t = `${g.title ?? "2×2 game"}: ${cellsTxt}. Pure-strategy Nash equilibria: ${a.nash.length ? a.nash.map(([r, c]) => `(${S(r)}, ${T(c)})`).join(", ") : "none"}.`;
      if (selected) t += ` Student is looking at outcome (${S(selected[0])}, ${T(selected[1])}).`;
      if (history.length) {
        const you = history.reduce((s, h) => s + h.yp, 0);
        const them = history.reduce((s, h) => s + h.tp, 0);
        t += ` Student played ${history.length} rounds vs ${OPPONENTS[opponent].label}: moves ${history.map((h) => `${S(h.you)[0]}/${T(h.them)[0]}`).join(" ")}; scores you ${you}, opponent ${them}.`;
      }
      return t;
    },
    changed: () => selected !== null || history.length > 0,
    reset() {
      selected = null;
      history = [];
      renderSelection();
      renderPlay();
    },
  };
}

function stripNull(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
}
