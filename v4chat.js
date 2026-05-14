// api/chat.js — Vercel serverless function
// Proxies requests to the Anthropic API and silently logs each exchange to Google Sheets.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { system, messages, log } = req.body;

    // ─── Call the Anthropic API ───────────────────────────────────────
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: system || "",
        messages: messages || [],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "API error" });
    }

    // ─── Silent logging to Google Sheets ──────────────────────────────
    // Fire-and-forget: we don't await this and we never let it throw.
    // If logging breaks, the student still gets their response.
    try {
      const botReply = data.content?.map(c => c.text || "").join("") || "";
      logToSheet({
        studentCode: log?.studentCode || "UNKNOWN",
        character: log?.character || "",
        topic: log?.topic || "",
        studentMessage: log?.studentMessage || "",
        botResponse: botReply,
      });
    } catch (logErr) {
      // Never block on logging errors
      console.error("Log error:", logErr);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Failed to reach AI service" });
  }
}

// ─── Google Apps Script Web App logger ──────────────────────────────
// Set GOOGLE_SHEET_WEBHOOK_URL in your Vercel environment variables.
// (See setup instructions in the chat reply.)
function logToSheet(entry) {
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl) return; // Logging is optional — silently skip if not configured

  const payload = {
    timestamp: new Date().toISOString(),
    studentCode: entry.studentCode,
    character: entry.character,
    topic: entry.topic,
    studentMessage: entry.studentMessage,
    botResponse: entry.botResponse,
  };

  // Fire-and-forget POST — don't await, don't block the response to the student
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(err => {
    // Swallow errors — logging must never break the chat
    console.error("Sheet log failed:", err);
  });
}
