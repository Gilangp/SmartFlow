/**
 * lib/ninerouter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper khusus untuk memanggil NineRouter Gateway API.
 * Mendukung model `finto` (dikendalikan via env NINE_ROUTER_MODEL="finto")
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function callNineRouterText(
  prompt: string,
  systemPrompt?: string
): Promise<string | null> {
  const nineRouterKey = process.env.NINE_ROUTER_API_KEY || process.env.LOCAL_AI_API_KEY;
  const nineRouterUrl = process.env.NINE_ROUTER_BASE_URL || 'http://localhost:20128/v1';

  if (!nineRouterKey) return null;

  try {
    const endpoint = `${nineRouterUrl.replace(/\/+$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const modelName = process.env.NINE_ROUTER_MODEL || 'finto';
    console.log(`[NineRouter Text] Memanggil model "${modelName}" via NineRouter...`);

    const nrRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nineRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.2,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (nrRes.ok) {
      const nrData = await nrRes.json();
      const text = nrData.choices?.[0]?.message?.content || '';
      if (text) {
        console.log(`[NineRouter Text] ✅ Berhasil via NineRouter (${modelName}).`);
        return text.trim();
      }
    }
  } catch (err: any) {
    console.warn('[NineRouter Text] Error:', err.message);
  }
  return null;
}

export async function callNineRouterVision(
  prompt: string,
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<string | null> {
  const nineRouterKey = process.env.NINE_ROUTER_API_KEY || process.env.LOCAL_AI_API_KEY;
  const nineRouterUrl = process.env.NINE_ROUTER_BASE_URL || 'http://localhost:20128/v1';

  if (!nineRouterKey) return null;

  try {
    const endpoint = `${nineRouterUrl.replace(/\/+$/, '')}/chat/completions`;
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const dataUrl = `data:${mimeType};base64,${cleanBase64}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const modelName = process.env.NINE_ROUTER_MODEL || 'finto';
    console.log(`[NineRouter Vision] Memanggil model "${modelName}" via NineRouter...`);

    const nrRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nineRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (nrRes.ok) {
      const nrData = await nrRes.json();
      const text = nrData.choices?.[0]?.message?.content || '';
      if (text) {
        console.log(`[NineRouter Vision] ✅ Berhasil via NineRouter (${modelName}).`);
        return text.trim();
      }
    }
  } catch (err: any) {
    console.warn('[NineRouter Vision] Error:', err.message);
  }
  return null;
}
