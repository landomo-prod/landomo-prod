import { config } from './config';

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message: string; code?: string };
}

/**
 * Build the API URL and auth header based on endpoint format.
 * Supports both Azure native and OpenAI-compatible (Azure AI Foundry) endpoints,
 * matching the same pattern used in bazos azureClient.ts.
 */
function getRequestConfig(): { url: string; headers: Record<string, string> } {
  const { endpoint, apiKey, deployment, apiVersion } = config.ai;
  const isOpenAICompatible = endpoint.includes('/openai/v1');

  if (isOpenAICompatible) {
    const baseUrl = endpoint.endsWith('/') ? endpoint : endpoint + '/';
    return {
      url: `${baseUrl}chat/completions`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };
  }

  // Azure native format
  return {
    url: `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
  };
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  const { endpoint, apiKey, deployment, maxRetries } = config.ai;

  if (!endpoint || !apiKey) {
    console.warn('[ai-provider] Azure OpenAI not configured, skipping AI generation');
    return null;
  }

  const { url, headers } = getRequestConfig();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: deployment,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 200,
          temperature: 0.8,
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
        console.warn(`[ai-provider] HTTP ${res.status}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      const data = (await res.json()) as ChatCompletionResponse;

      if (data.error) {
        console.error(`[ai-provider] API error: ${data.error.message}`);
        return null;
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        console.warn('[ai-provider] Empty response from API');
        return null;
      }

      return content;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
        console.warn(`[ai-provider] Error: ${msg}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error(`[ai-provider] All ${maxRetries} attempts failed: ${msg}`);
        return null;
      }
    }
  }

  return null;
}
