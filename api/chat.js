export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const { system, messages } = req.body;
  const models = ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"];

  for (const model of models) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: system || "",
          messages: messages || [],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return res.status(200).json(data);
      }

      // If overloaded, try next model
      if (response.status === 529) continue;

      return res.status(response.status).json({ error: data.error?.message || "API error" });
    } catch (error) {
      continue;
    }
  }

  return res.status(503).json({ error: "All models are busy right now. Try again in a minute!" });
}
