export async function notifySlack(message: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.MC_SLACK_NOTIFY_CHANNEL;
  if (!token || !channel) return;

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text: message }),
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    if (!body.ok) {
      console.warn(`[slack-notify] API error: ${body.error}`);
    }
  } catch (err) {
    console.warn(`[slack-notify] Failed to send:`, err);
  }
}
