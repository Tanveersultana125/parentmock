/**
 * callAI — universal client-side AI caller
 *
 * Routes ALL OpenAI requests through the `parentAIProxy` Cloud Function.
 * The OpenAI API key NEVER leaves the server — this file contains zero secrets.
 *
 * Usage:
 *   const result = await callAI(prompt);              // JSON response
 *   const text   = await callAI(prompt, { jsonMode: false }); // plain text
 *   const ans    = await callAI(prompt, { imageBase64: "..." }); // vision
 */

import { functions } from "../../lib/firebase";
import { httpsCallable } from "firebase/functions";

export interface CallAIOptions {
  jsonMode?: boolean;
  imageBase64?: string;
  model?: string;
  systemPrompt?: string;
}

// Lazy singleton callable. Built on first invocation so the module can be
// imported in mock/demo builds (where `functions` is null) without crashing.
let proxyFn: ReturnType<typeof httpsCallable<
  { prompt: string; systemPrompt?: string; jsonMode?: boolean; imageBase64?: string; model?: string },
  { content: string }
>> | null = null;

export async function callAI(prompt: string, options: CallAIOptions = {}): Promise<any> {
  const { jsonMode = true, imageBase64, model, systemPrompt } = options;

  if (!functions) {
    // Mock/demo build — no Firebase backend. Caller's catch block will
    // serve its fallback content.
    throw new Error("AI backend disabled in mock build");
  }
  if (!proxyFn) {
    proxyFn = httpsCallable<
      { prompt: string; systemPrompt?: string; jsonMode?: boolean; imageBase64?: string; model?: string },
      { content: string }
    >(functions, "parentAIProxy", { timeout: 60000 });
  }

  const result = await proxyFn({ prompt, systemPrompt, jsonMode, imageBase64, model });
  const content = result.data?.content;

  if (!content) throw new Error("Empty AI response from server.");

  // Plain text or vision — return as-is
  if (!jsonMode || imageBase64) return content;

  // JSON mode — parse with markdown-fence fallback
  try {
    return JSON.parse(content);
  } catch {
    const stripped = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(stripped);
  }
}
