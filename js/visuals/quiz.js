// A single multiple-choice check-for-understanding card.
import { html } from "./svg.js";

export const title = "Quick check";

export function mount(container, params, { onAnswer, onStateChange } = {}) {
  let answered = null;
  const root = html("div", { class: "viz quiz" });
  const opts = html("div", { class: "quiz-opts" });
  const expl = html("div", { class: "callout quiz-expl", hidden: true });
  root.append(html("p", { class: "quiz-q", text: params.question }), opts, expl);
  container.append(root);

  const buttons = params.options.map((text, i) => {
    const b = html("button", { type: "button", class: "quiz-opt" }, [html("span", { class: "letter", text: String.fromCharCode(65 + i) }), html("span", { text })]);
    b.addEventListener("click", () => choose(i));
    opts.append(b);
    return b;
  });

  function choose(i) {
    if (answered !== null) return;
    answered = i;
    const right = i === params.correct_index;
    buttons.forEach((b, j) => {
      b.disabled = true;
      if (j === params.correct_index) b.classList.add("correct");
      else if (j === i) b.classList.add("wrong");
    });
    expl.hidden = false;
    expl.replaceChildren(html("strong", { text: right ? "Correct! " : "Not quite. " }), params.explanation ?? "");
    onStateChange?.();
    onAnswer?.(`[Quiz] I chose ${String.fromCharCode(65 + i)}) "${params.options[i]}", which is ${right ? "correct" : `wrong (the answer was ${String.fromCharCode(65 + params.correct_index)})`}.`);
  }

  return {
    summary: () => `Quiz: "${params.question}" options ${params.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join(" ")}; correct ${String.fromCharCode(65 + params.correct_index)}.${answered !== null ? ` Student answered ${String.fromCharCode(65 + answered)}.` : " Not answered yet."}`,
    changed: () => false, // the answer is already sent as a chat message
    reset() {},
  };
}
