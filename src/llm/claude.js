import Anthropic from "@anthropic-ai/sdk";

export const ANALYSIS_MODEL = "claude-opus-5-5";

export class AnalysisRefusedError extends Error {
  name = "AnalysisRefusedError";
}

/**
 * Thin wrapper around the Anthropic SDK: one structured-output request per
 * analysis. Returns the parsed JSON object that matches `schema`.
 *
 * @param {{ apiKey?: string, client?: { beta: { messages: { stream: Function } } }, model?: string }} opts
 */
export function createClaudeAnalyzer({ apiKey, client, model = ANALYSIS_MODEL } = {}) {
  const anthropic = client ?? new Anthropic({ apiKey });

  return {
    model,
    async complete({ system, prompt, schema }) {
      const message = await anthropic.beta.messages
        .stream({
          model,
          max_tokens: 32000,
          // Re-run on Anthropic's recommended fallback model if a safety classifier declines.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort: "high", format: { type: "json_schema", schema } },
          system,
          messages: [{ role: "user", content: prompt }],
        })
        .finalMessage();

      if (message.stop_reason === "refusal") {
        throw new AnalysisRefusedError(`analysis declined (${message.stop_details?.category ?? "no category"})`);
      }
      if (message.stop_reason === "max_tokens") throw new Error("analysis output truncated (max_tokens)");
      const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      return { output: JSON.parse(text), model: message.model };
    },
  };
}
