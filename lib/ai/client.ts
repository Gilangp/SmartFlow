/**
 * Finto AI Gateway - Client & Token Rotation
 */

export function getHFToken(preferSecondary: boolean = false): { token: string; label: 'PRIMARY' | 'SECONDARY' } {
  const primary = process.env.HF_TOKEN_PRIMARY || process.env.HF_TOKEN;
  const secondary = process.env.HF_TOKEN_SECONDARY || primary;

  if (preferSecondary && secondary) {
    return { token: secondary, label: 'SECONDARY' };
  }

  if (primary) {
    return { token: primary, label: 'PRIMARY' };
  }

  if (secondary) {
    return { token: secondary, label: 'SECONDARY' };
  }

  throw new Error('HF_TOKEN_PRIMARY atau HF_TOKEN_SECONDARY belum dikonfigurasi di file .env');
}

export async function callHuggingFaceRouterAPI(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; maxTokens?: number; useSecondaryToken?: boolean; timeoutMs?: number } = {}
): Promise<{ text: string; tokenLabel: 'PRIMARY' | 'SECONDARY' }> {
  let { token, label } = getHFToken(options.useSecondaryToken);

  const endpoint = 'https://router.huggingface.co/v1/chat/completions';
  const payload = {
    model,
    messages,
    max_tokens: options.maxTokens ?? 600,
    temperature: options.temperature ?? 0.4,
  };

  const timeoutMs = options.timeoutMs || 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  // Automatic token rotation fallback if primary encounters rate limit (429), auth error (401), or credit depleted (402)
  if (!response.ok && (response.status === 429 || response.status === 401 || response.status === 402)) {
    const backupTokenObj = getHFToken(!options.useSecondaryToken);
    if (backupTokenObj.token !== token) {
      console.warn(`[AI Gateway Router] Token ${label} limit/error (${response.status}). Rotating to token ${backupTokenObj.label}...`);
      token = backupTokenObj.token;
      label = backupTokenObj.label;

      const backupController = new AbortController();
      const backupTimer = setTimeout(() => backupController.abort(), timeoutMs);
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: backupController.signal,
        });
      } finally {
        clearTimeout(backupTimer);
      }
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HF Router API HTTP ${response.status} (${model}): ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { text, tokenLabel: label };
}

export async function callHuggingFaceAPI(
  model: string,
  payload: any,
  useSecondary: boolean = false
): Promise<{ data: any; tokenLabel: 'PRIMARY' | 'SECONDARY' }> {
  let { token, label } = getHFToken(useSecondary);

  const endpoint = `https://api-inference.huggingface.co/models/${model}`;
  
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // Automatic token rotation fallback if primary encounters rate limit (429) or auth error (401)
  if (!response.ok && (response.status === 429 || response.status === 401)) {
    const backupTokenObj = getHFToken(!useSecondary);
    if (backupTokenObj.token !== token) {
      console.warn(`[AI Gateway] Token ${label} limit/error (${response.status}). Rotating to token ${backupTokenObj.label}...`);
      token = backupTokenObj.token;
      label = backupTokenObj.label;

      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HF API HTTP ${response.status} (${model}): ${errText}`);
  }

  const data = await response.json();
  return { data, tokenLabel: label };
}

