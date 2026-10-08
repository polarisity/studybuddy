// The AI teacher: Claude via the official SDK, called straight from the browser
// with the student's own API key. Streaming manual tool loop.
import Anthropic from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm";
import { TOOL_DEFS, runTool } from "./tools.js";

export const SYSTEM_PROMPT = `You are "Professor Mill", a warm, sharp and slightly playful tutor of political economy. You teach one student through a chat window next to an interactive whiteboard that you control with tools.

How to teach:
- Keep each turn short, usually 3–6 sentences. One idea at a time; the student sets the pace.
- Be Socratic. Ask the student to predict before you reveal ("What do you think happens to the price if…?"), then show it.
- Whenever a concept has a shape (markets, surplus, taxes, inequality, strategic dilemmas, commons, the history of ideas), draw it on the whiteboard with a tool, then invite the student to *do* something with it: drag a curve, move a slider, click an outcome, play a round. Write captions that say what to try.
- The tool results give you exact numbers. Quote them instead of estimating.
- Messages may end with "[Visual state: …]". That is what the student currently sees after changing the whiteboard. React to what they did ("You raised the tax to $30, and notice the red triangle grew…").
- Check understanding regularly with show_quiz, roughly every few turns once a concept has been introduced. When a "[Quiz]" answer arrives, respond to it: praise briefly if right, and if wrong, diagnose the misconception kindly.
- End most turns with suggest_replies so the student always has an easy next step.
- Use concrete, real-world examples (rent control in a big city, coffee prices, minimum wage debates, fisheries, climate agreements, OPEC).
- Political economy is contested. When a question is normative or disputed, present the main perspectives fairly (e.g. classical/liberal, Marxian, Keynesian, Austrian, institutionalist, public choice), say which view is which, and separate evidence from values. Don't push your own politics.
- At the very start, briefly ask what the student already knows or why they're studying, so you can pitch the level right, unless they've already said.
- Use light markdown: **bold** for key terms, short lists only when they help. No headings.
- If the student seems stuck or frustrated, slow down, use an analogy, and make the next step smaller.`;

const MAX_TOOL_ROUNDS = 8;

export class Teacher {
  constructor({ getKey, getModel, ui }) {
    this.getKey = getKey;
    this.getModel = getModel;
    this.ui = ui; // { startTurn, onText, endTurn, showVisual, showReplies, notice }
    this.messages = [];
    this.busy = false;
    this.compat = false; // set if the API rejects strict / eager / fallback options
  }

  reset() {
    this.messages = [];
  }

  client() {
    return new Anthropic({ apiKey: this.getKey(), dangerouslyAllowBrowser: true, maxRetries: 2 });
  }

  request() {
    const model = this.getModel();
    const tools = this.compat ? TOOL_DEFS.map(({ strict, eager_input_streaming, ...t }) => t) : TOOL_DEFS;
    const req = {
      model,
      max_tokens: 64000,
      system: SYSTEM_PROMPT,
      tools,
      messages: this.messages,
      output_config: { effort: model === "claude-haiku-5-5" ? "low" : "medium" },
      cache_control: { type: "ephemeral" },
    };
    // Server-side refusal fallback (not offered for Haiku).
    if (!this.compat && model !== "claude-haiku-5-5") {
      req.betas = ["server-side-fallback-2026-07-01"];
      req.fallbacks = "default";
    }
    return req;
  }

  /** Send one student message and run the teacher until it finishes its turn. */
  async send(text) {
    if (this.busy) return;
    this.busy = true;
    // History is append-only: never edit earlier turns (keeps preserved thinking and the cache valid).
    const last = this.messages.at(-1);
    if (last?.role === "user" && Array.isArray(last.content)) {
      // Tool results not yet sent (e.g. after suggest_replies): the student's text joins them.
      last.content.push({ type: "text", text });
    } else {
      this.messages.push({ role: "user", content: text });
    }
    try {
      await this.loop();
    } finally {
      this.busy = false;
    }
  }

  async loop() {
    const client = this.client();
    let jsonRetries = 0;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      this.ui.startTurn();
      let message;
      try {
        const stream = client.beta.messages.stream(this.request());
        stream.on("text", (delta) => this.ui.onText(delta));
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        this.ui.endTurn({ failed: true });
        if (err instanceof Anthropic.BadRequestError && !this.compat) {
          console.warn("Request rejected, retrying in compatibility mode:", err.message);
          this.compat = true;
          round--;
          continue;
        }
        if (err instanceof Anthropic.APIError) return this.reportApiError(err);
        if (jsonRetries++ < 2) {
          console.warn("Tool input could not be parsed; re-issuing the turn", err);
          continue;
        }
        this.ui.notice("Something went wrong talking to the teacher. Please try again.", true);
        console.error(err);
        return;
      }

      this.ui.endTurn({});

      if (message.stop_reason === "refusal") {
        this.messages.push({ role: "assistant", content: message.content });
        this.ui.notice("The teacher couldn't answer that one. Try rephrasing your question.", true);
        return;
      }
      const toolUses = message.content.filter((b) => b.type === "tool_use");
      if (message.stop_reason === "max_tokens" && toolUses.length) {
        this.ui.notice("The teacher's reply was cut off. Please ask again.", true);
        return;
      }
      this.messages.push({ role: "assistant", content: message.content });
      if (message.stop_reason !== "tool_use" || !toolUses.length) return;

      // Run every tool, then send all results back in one user message.
      const results = toolUses.map((tu) => {
        const r = runTool(tu.name, tu.input, this.ui);
        return { type: "tool_result", tool_use_id: tu.id, content: r.content, ...(r.is_error ? { is_error: true } : {}) };
      });
      this.messages.push({ role: "user", content: results });

      // Replies are the last thing a turn needs; skip a model round-trip if that was all.
      if (toolUses.every((tu) => tu.name === "suggest_replies")) return;
    }
  }

  reportApiError(err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      this.ui.notice("Your API key was rejected. Please check it in Settings.", true);
      this.ui.openSettings?.();
    } else if (err instanceof Anthropic.RateLimitError) {
      this.ui.notice("Rate limit reached. Wait a moment and try again.", true);
    } else if (err instanceof Anthropic.APIConnectionError) {
      this.ui.notice("Couldn't reach Anthropic's API. Check your connection.", true);
    } else {
      this.ui.notice(`The API returned an error: ${err.message}`, true);
    }
    // Drop the unanswered user message so the conversation stays well-formed.
    this.rollbackDangling();
  }

  rollbackDangling() {
    const last = this.messages.at(-1);
    if (last?.role !== "user") return;
    if (typeof last.content === "string") this.messages.pop();
    else if (last.content.at(-1)?.type === "text") last.content.pop();
  }
}
