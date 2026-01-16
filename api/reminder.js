export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhX-LYVwII54R_kUULqTBLsYh7LPVjhPPIlBE88K_QkwfdYoT1SbAixbZxmqTfrDAd/exec";

  try {
    const r = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    const text = await r.text();
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: e.toString() });
  }
}
