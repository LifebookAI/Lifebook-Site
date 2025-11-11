export async function summarize(input: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return `SUMMARY (stub): ${input.slice(0, 200)}...`;
  }
  // Minimal, no dependency: call OpenAI responses API
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [{ role: "system", content: "Summarize concisely." }, { role: "user", content: input }],
      max_tokens: 250
    })
  });
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "SUMMARY_FAILED";
}
export async function extract(input: string, what: string): Promise<string> {
  return `EXTRACT (stub for "${what}"): ${input.slice(0, 120)}...`;
}