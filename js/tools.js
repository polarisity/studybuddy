// Tool definitions the teacher can call, plus client-side validation and dispatch.
// Inputs stream eagerly (unvalidated by the API), so every input is checked here
// before anything is drawn.
import { PRESETS as LORENZ_PRESETS } from "./visuals/lorenz.js";
import { PRESETS as GAME_PRESETS } from "./visuals/gameMatrix.js";
import { PRESETS as MAP_PRESETS } from "./visuals/conceptMap.js";

const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const num = (description) => ({ type: "number", description });
const str = (description) => ({ type: "string", description });
const strArr = (description) => ({ type: "array", items: { type: "string" }, description });
const numArr = (description) => ({ type: "array", items: { type: "number" }, description });

const DISPLAY = {
  title: str("Short title shown above the visual, e.g. 'What a $10 tax does to the coffee market'."),
  caption: str("One or two sentences telling the student what to look at or try (e.g. 'Drag the tax slider and watch the red triangle')."),
};

export const TOOL_DEFS = [
  {
    name: "show_supply_demand",
    description:
      "Draw an interactive linear supply-and-demand diagram on the student's whiteboard. Demand: P = demand_intercept − demand_slope·Q. Supply: P = supply_intercept + supply_slope·Q. Shades consumer surplus, producer surplus, tax revenue and deadweight loss. The student can drag both curves, switch between free market / tax / price ceiling / price floor and move sliders. Use for markets, prices, elasticity, taxes, subsidies, rent control, minimum wages and shifts in supply or demand. To show a shift, pass shift_demand or shift_supply (added to the intercept); the original curve stays visible as a dashed ghost. Returns exact equilibrium numbers. Only set one of tax / price_ceiling / price_floor.",
    input_schema: obj(
      {
        ...DISPLAY,
        demand_intercept: num("Price where demand hits zero quantity. Typical 50–200."),
        demand_slope: num("Positive number; how much price falls per extra unit demanded. Typical 0.2–3."),
        supply_intercept: num("Lowest price at which anything is supplied. Typical 0–60, below demand_intercept."),
        supply_slope: num("Positive number; how much price rises per extra unit supplied. Typical 0.2–3."),
        tax: num("Optional per-unit tax (in price units) to start with."),
        price_ceiling: num("Optional maximum legal price (binding if below equilibrium)."),
        price_floor: num("Optional minimum legal price (binding if above equilibrium)."),
        shift_demand: num("Optional change to the demand intercept, e.g. +20 for a rise in demand. The original curve is shown dashed."),
        shift_supply: num("Optional change to the supply intercept, e.g. +15 for higher costs (supply shifts up/left). The original curve is shown dashed."),
        x_label: str("Optional quantity axis label, e.g. 'Cups of coffee per day'."),
        y_label: str("Optional price axis label, e.g. 'Price per cup ($)'."),
      },
      ["title", "caption", "demand_intercept", "demand_slope", "supply_intercept", "supply_slope"],
    ),
  },
  {
    name: "show_lorenz_curve",
    description:
      "Draw an interactive Lorenz curve with the Gini coefficient. The student gets a slider applying a flat tax returned as an equal cash transfer, and can watch the curve move toward equality. Use for inequality, distribution, redistribution and comparing countries. Pass either a preset or quintile_shares (5 percentages, poorest to richest, roughly summing to 100). Optionally overlay compare_shares. Preset figures are rounded approximations for teaching; say so if the student asks.",
    input_schema: obj(
      {
        ...DISPLAY,
        preset: { type: "string", enum: Object.keys(LORENZ_PRESETS), description: "Built-in approximate distribution." },
        quintile_shares: numArr("Five income shares in percent, bottom 20% first."),
        label: str("Name of the main distribution, e.g. 'Before taxes'."),
        compare_shares: numArr("Optional second distribution (five shares) to overlay."),
        compare_label: str("Name of the comparison distribution."),
      },
      ["title", "caption"],
    ),
  },
  {
    name: "show_game_matrix",
    description:
      "Draw an interactive 2×2 payoff matrix. Underlines best responses, highlights Nash equilibria and the outcome with the best total, and lets the student click outcomes and play repeated rounds against Tit-for-Tat, Grudger, Random or fixed strategies. Use for the prisoner's dilemma, collective action, public goods, coordination, arms races, cartels and trade wars. Use a preset, or give custom strategies and payoffs. Put the cooperative strategy first. Payoff order: [row0/col0, row0/col1, row1/col0, row1/col1], each {row, col}.",
    input_schema: obj(
      {
        ...DISPLAY,
        preset: { type: "string", enum: Object.keys(GAME_PRESETS), description: "Built-in game." },
        row_player: str("Name of the row player (the student plays this side), e.g. 'You' or 'Country A'."),
        col_player: str("Name of the column player."),
        row_strategies: strArr("Exactly two row strategies, cooperative one first."),
        col_strategies: strArr("Exactly two column strategies, cooperative one first."),
        payoffs: {
          type: "array",
          description: "Exactly four outcomes in order row0/col0, row0/col1, row1/col0, row1/col1.",
          items: obj({ row: num("Row player's payoff"), col: num("Column player's payoff") }, ["row", "col"]),
        },
      },
      ["title", "caption"],
    ),
  },
  {
    name: "show_commons_simulation",
    description:
      "Run an animated tragedy-of-the-commons simulation: a shared resource (fish, pasture, groundwater…) regrows logistically, and N users each take a fixed amount per round. Shows when it collapses compared with the maximum sustainable harvest (regen·capacity/4). The student can change the number of users, the amount each takes, the regrowth rate, and turn on a community quota (Ostrom-style governance). Use for collective action, externalities, common-pool resources, climate and overfishing.",
    input_schema: obj(
      {
        ...DISPLAY,
        resource_name: str("What is being shared, e.g. 'Fish' or 'Grass'."),
        herders: num("Number of users, 1–30."),
        take_per_herder: num("Amount each user takes per round. Omit for a default that over-harvests."),
        regen_rate: num("Regrowth rate, 0.05–1 (default 0.4)."),
        capacity: num("Maximum stock (default 1000)."),
        rounds: num("Rounds to simulate, 10–100 (default 40)."),
        quota: num("Optional total quota per round to start with."),
      },
      ["title", "caption"],
    ),
  },
  {
    name: "show_concept_map",
    description:
      "Draw a clickable map of thinkers, ideas or events laid out on a timeline, with one lane per school of thought and labelled arrows for influences and debates. Clicking a node asks you about it. Use for schools of thought, intellectual history and how ideas relate. Use preset 'schools_of_thought' for the standard Smith → Ricardo → Marx → Marshall → Keynes vs Hayek → Friedman → Buchanan / Ostrom overview, or give your own nodes (≤ 16, ≤ 8 schools) and edges.",
    input_schema: obj(
      {
        ...DISPLAY,
        preset: { type: "string", enum: Object.keys(MAP_PRESETS), description: "Built-in map." },
        nodes: {
          type: "array",
          description: "Nodes to draw.",
          items: obj(
            {
              id: str("Short unique id, e.g. 'smith'."),
              label: str("Display name, ≤ 18 characters."),
              detail: str("Key idea or work, ≤ 26 characters."),
              year: num("Year, for timeline placement."),
              school: str("School or group; becomes the lane."),
            },
            ["id", "label", "school"],
          ),
        },
        edges: {
          type: "array",
          description: "Directed links between node ids.",
          items: obj({ from: str("Source node id"), to: str("Target node id"), label: str("Optional short relation, e.g. 'critiqued'") }, ["from", "to"]),
        },
      },
      ["title", "caption"],
    ),
  },
  {
    name: "show_quiz",
    description:
      "Show a multiple-choice question on the whiteboard to check understanding. When the student answers, the result comes back to you as a chat message starting with [Quiz]. Prefer questions that test reasoning ('what happens if…') over recall. Use 3–4 options with plausible distractors.",
    input_schema: obj(
      {
        question: str("The question."),
        options: strArr("2–5 answer options."),
        correct_index: { type: "integer", description: "0-based index of the correct option." },
        explanation: str("Short explanation revealed after answering."),
      },
      ["question", "options", "correct_index", "explanation"],
    ),
  },
  {
    name: "suggest_replies",
    description:
      "Offer the student 2–3 short, clickable follow-up replies shown under your message, e.g. a 'tell me more' option, a 'give me an example' option and a challenge. Call this at the end of most turns. Write each option in the student's voice and keep it under 60 characters.",
    input_schema: obj({ options: strArr("2–3 short replies in the student's voice.") }, ["options"]),
  },
].map((t) => ({ ...t, strict: true, eager_input_streaming: true }));

// ---------- validation ----------
class InvalidInput extends Error {}
const fail = (msg) => { throw new InvalidInput(msg); };
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const optNum = (v, name, lo, hi) => {
  if (v === undefined || v === null) return undefined;
  if (!isNum(v)) fail(`${name} must be a number`);
  return Math.min(hi, Math.max(lo, v));
};
const reqNum = (v, name, lo, hi) => {
  if (!isNum(v)) fail(`${name} is required and must be a number`);
  return Math.min(hi, Math.max(lo, v));
};
const optStr = (v, name, max = 200) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") fail(`${name} must be a string`);
  return v.slice(0, max);
};
const strList = (v, name, min, max) => {
  if (!Array.isArray(v) || v.some((s) => typeof s !== "string" || !s.trim())) fail(`${name} must be an array of strings`);
  if (v.length < min || v.length > max) fail(`${name} must have ${min === max ? min : `${min}–${max}`} items`);
  return v.map((s) => s.slice(0, 160));
};
const display = (i) => ({ title: optStr(i.title, "title", 90), caption: optStr(i.caption, "caption", 400) });

const VALIDATORS = {
  show_supply_demand(i) {
    const p = {
      demand_intercept: reqNum(i.demand_intercept, "demand_intercept", 1, 10000),
      demand_slope: reqNum(i.demand_slope, "demand_slope", 0.01, 1000),
      supply_intercept: reqNum(i.supply_intercept, "supply_intercept", 0, 10000),
      supply_slope: reqNum(i.supply_slope, "supply_slope", 0.01, 1000),
      tax: optNum(i.tax, "tax", 0, 10000),
      price_ceiling: optNum(i.price_ceiling, "price_ceiling", 0, 10000),
      price_floor: optNum(i.price_floor, "price_floor", 0, 10000),
      shift_demand: optNum(i.shift_demand, "shift_demand", -10000, 10000),
      shift_supply: optNum(i.shift_supply, "shift_supply", -10000, 10000),
      x_label: optStr(i.x_label, "x_label", 60),
      y_label: optStr(i.y_label, "y_label", 60),
    };
    if (p.supply_intercept >= p.demand_intercept) fail("supply_intercept must be below demand_intercept, or the curves never cross");
    if ([p.tax, p.price_ceiling, p.price_floor].filter((v) => v !== undefined && v !== 0).length > 1) fail("set only one of tax, price_ceiling, price_floor");
    return { kind: "supply_demand", params: strip(p), ...display(i) };
  },
  show_lorenz_curve(i) {
    const shares = (v, name) => {
      if (v === undefined || v === null) return undefined;
      if (!Array.isArray(v) || v.length !== 5 || v.some((x) => !isNum(x) || x < 0)) fail(`${name} must be 5 non-negative numbers`);
      if (v.reduce((a, b) => a + b, 0) <= 0) fail(`${name} must not all be zero`);
      return v;
    };
    if (i.preset !== undefined && !LORENZ_PRESETS[i.preset]) fail(`unknown preset ${i.preset}`);
    const p = { preset: i.preset, quintile_shares: shares(i.quintile_shares, "quintile_shares"), label: optStr(i.label, "label", 50), compare_shares: shares(i.compare_shares, "compare_shares"), compare_label: optStr(i.compare_label, "compare_label", 50) };
    if (!p.preset && !p.quintile_shares) fail("give a preset or quintile_shares");
    return { kind: "lorenz", params: strip(p), ...display(i) };
  },
  show_game_matrix(i) {
    if (i.preset !== undefined && !GAME_PRESETS[i.preset]) fail(`unknown preset ${i.preset}`);
    const p = { preset: i.preset };
    if (i.row_player !== undefined) p.row_player = optStr(i.row_player, "row_player", 30);
    if (i.col_player !== undefined) p.col_player = optStr(i.col_player, "col_player", 30);
    if (i.row_strategies !== undefined) p.row_strategies = strList(i.row_strategies, "row_strategies", 2, 2);
    if (i.col_strategies !== undefined) p.col_strategies = strList(i.col_strategies, "col_strategies", 2, 2);
    if (i.payoffs !== undefined) {
      if (!Array.isArray(i.payoffs) || i.payoffs.length !== 4 || i.payoffs.some((x) => !x || !isNum(x.row) || !isNum(x.col))) fail("payoffs must be exactly 4 {row, col} number pairs");
      p.payoffs = i.payoffs.map(({ row, col }) => ({ row, col }));
    }
    if (!p.preset && !(p.row_strategies && p.col_strategies && p.payoffs)) fail("give a preset, or row_strategies, col_strategies and payoffs");
    p.row_player ??= GAME_PRESETS[p.preset]?.row_player ?? "You";
    p.col_player ??= GAME_PRESETS[p.preset]?.col_player ?? "Them";
    return { kind: "game_matrix", params: strip(p), ...display(i) };
  },
  show_commons_simulation(i) {
    const p = {
      resource_name: optStr(i.resource_name, "resource_name", 20),
      herders: optNum(i.herders, "herders", 1, 30),
      take_per_herder: optNum(i.take_per_herder, "take_per_herder", 0, 100000),
      regen_rate: optNum(i.regen_rate, "regen_rate", 0.05, 1),
      capacity: optNum(i.capacity, "capacity", 10, 1000000),
      rounds: optNum(i.rounds, "rounds", 10, 100),
      quota: optNum(i.quota, "quota", 0, 1000000),
    };
    if (p.herders) p.herders = Math.round(p.herders);
    if (p.rounds) p.rounds = Math.round(p.rounds);
    return { kind: "commons", params: strip(p), ...display(i) };
  },
  show_concept_map(i) {
    if (i.preset !== undefined && !MAP_PRESETS[i.preset]) fail(`unknown preset ${i.preset}`);
    const p = { preset: i.preset };
    if (i.nodes !== undefined) {
      if (!Array.isArray(i.nodes) || !i.nodes.length || i.nodes.length > 16) fail("nodes must be 1–16 items");
      const ids = new Set();
      p.nodes = i.nodes.map((n, k) => {
        if (!n || typeof n.id !== "string" || typeof n.label !== "string") fail(`nodes[${k}] needs string id and label`);
        if (ids.has(n.id)) fail(`duplicate node id ${n.id}`);
        ids.add(n.id);
        return strip({ id: n.id, label: n.label.slice(0, 40), detail: optStr(n.detail, "detail", 60), year: optNum(n.year, "year", -3000, 3000), school: optStr(n.school, "school", 30) || "Other" });
      });
      if (new Set(p.nodes.map((n) => n.school)).size > 8) fail("use at most 8 schools");
      if (i.edges !== undefined) {
        if (!Array.isArray(i.edges)) fail("edges must be an array");
        p.edges = i.edges.map((e, k) => {
          if (!e || !ids.has(e.from) || !ids.has(e.to)) fail(`edges[${k}] must link existing node ids`);
          return strip({ from: e.from, to: e.to, label: optStr(e.label, "label", 30) });
        });
      }
    }
    if (!p.preset && !p.nodes) fail("give a preset or nodes");
    return { kind: "concept_map", params: strip(p), ...display(i) };
  },
  show_quiz(i) {
    if (typeof i.question !== "string" || !i.question.trim()) fail("question is required");
    const options = strList(i.options, "options", 2, 5);
    if (!Number.isInteger(i.correct_index) || i.correct_index < 0 || i.correct_index >= options.length) fail("correct_index must point at an option");
    return { kind: "quiz", params: { question: i.question.slice(0, 400), options, correct_index: i.correct_index, explanation: optStr(i.explanation, "explanation", 600) ?? "" }, title: "Quick check" };
  },
  suggest_replies(i) {
    return { kind: "replies", options: strList(i.options, "options", 1, 3).map((s) => s.slice(0, 80)) };
  },
};

function strip(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/**
 * Runs one tool call. Returns { content, is_error? } for the tool_result.
 * `ui` supplies: showVisual(kind, params, display) → entry, showReplies(options).
 */
export function runTool(name, input, ui) {
  const validate = VALIDATORS[name];
  if (!validate) return { is_error: true, content: `Unknown tool ${name}` };
  let spec;
  try {
    if (!input || typeof input !== "object") throw new InvalidInput("input must be an object");
    spec = validate(input);
  } catch (err) {
    if (!(err instanceof InvalidInput)) throw err;
    return { is_error: true, content: JSON.stringify({ INVALID_INPUT: err.message, received: input }) };
  }
  if (spec.kind === "replies") {
    ui.showReplies(spec.options);
    return { content: "Reply buttons shown to the student." };
  }
  try {
    const entry = ui.showVisual(spec.kind, spec.params, { title: spec.title, caption: spec.caption });
    if (spec.kind === "quiz") return { content: "Quiz shown. The student's answer will arrive as their next message." };
    return { content: `Shown on the whiteboard. Current numbers: ${entry.instance.summary()}` };
  } catch (err) {
    console.error(err);
    return { is_error: true, content: `Could not draw that visual: ${err.message}` };
  }
}
