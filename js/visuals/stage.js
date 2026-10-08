// The whiteboard: mounts visuals, keeps a filmstrip of earlier ones, and tracks
// student interactions so they can be reported back to the teacher.
import * as supplyDemand from "./supplyDemand.js";
import * as lorenz from "./lorenz.js";
import * as gameMatrix from "./gameMatrix.js";
import * as commons from "./commons.js";
import * as conceptMap from "./conceptMap.js";
import * as quiz from "./quiz.js";
import { html } from "./svg.js";

export const VISUALS = { supply_demand: supplyDemand, lorenz, game_matrix: gameMatrix, commons, concept_map: conceptMap, quiz };

const $ = (id) => document.getElementById(id);

export function createStage({ onDirty, onSend, onShown }) {
  const body = $("stage-body");
  const film = $("filmstrip");
  const emptyMarkup = body.innerHTML;
  const entries = [];
  let active = null;
  const dirty = new Set();

  $("stage-reset").addEventListener("click", () => {
    if (!active) return;
    active.instance.reset();
    dirty.delete(active);
    onDirty?.(dirty.size > 0);
  });
  $("stage-ask").addEventListener("click", () => {
    if (!active) return;
    dirty.delete(active);
    onDirty?.(dirty.size > 0);
    onSend?.(`Can you walk me through what I'm looking at on the whiteboard?\n\n[Visual state: ${active.instance.summary()}]`);
  });

  function show(kind, params, { title, caption } = {}) {
    const mod = VISUALS[kind];
    if (!mod) throw new Error(`Unknown visual "${kind}"`);
    if (!entries.length) body.replaceChildren();
    const box = html("div", { class: "stage-entry" });
    body.append(box);
    const entry = { kind, title: title || params.title || mod.title, caption: caption || "", box };
    try {
      entry.instance = mod.mount(box, params, {
        onStateChange: () => {
          if (entry.instance?.changed()) dirty.add(entry);
          else dirty.delete(entry);
          onDirty?.(dirty.size > 0);
        },
        onAsk: (text) => onSend?.(`${text}\n\n[Visual state: ${entry.instance.summary()}]`),
        onAnswer: (text) => onSend?.(text),
      });
    } catch (err) {
      box.remove();
      if (!entries.length) body.replaceChildren();
      throw err;
    }
    entries.push(entry);
    entry.chip = html("button", { type: "button", class: "film", text: `${entries.length}. ${entry.title}`, title: entry.title, onclick: () => activate(entry) });
    film.append(entry.chip);
    activate(entry);
    onShown?.(entry);
    return entry;
  }

  function activate(entry) {
    active = entry;
    for (const e of entries) {
      e.box.hidden = e !== entry;
      e.chip.classList.toggle("active", e === entry);
    }
    $("stage-eyebrow").textContent = `Whiteboard · ${entries.indexOf(entry) + 1} of ${entries.length}`;
    $("stage-title").textContent = entry.title;
    $("stage-caption").textContent = entry.caption;
    $("stage-caption").hidden = !entry.caption;
    $("stage-actions").hidden = entry.kind === "quiz";
    entry.chip.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /** Summaries of visuals the student changed since the teacher last heard about them. */
  function takeChanges() {
    const notes = [...dirty].map((e) => e.instance.summary());
    dirty.clear();
    onDirty?.(false);
    return notes;
  }

  function discardChanges() {
    dirty.clear();
    onDirty?.(false);
  }

  function clear() {
    entries.length = 0;
    active = null;
    dirty.clear();
    film.replaceChildren();
    body.innerHTML = emptyMarkup;
    $("stage-eyebrow").textContent = "Whiteboard";
    $("stage-title").textContent = "Nothing drawn yet";
    $("stage-caption").hidden = false;
    $("stage-caption").textContent = "When your teacher wants to show you something, it appears here. You can drag, slide and click everything.";
    $("stage-actions").hidden = true;
  }

  return { show, takeChanges, discardChanges, clear, get count() { return entries.length; } };
}
