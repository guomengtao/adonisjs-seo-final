import env from '#start/env'

async function getAiAnalysis(prompt: string) {
  const accountId = env.get('CF_ACCOUNT_ID')
  const apiToken = env.get('CF_API_TOKEN')
  // 推荐使用 llama-3，对 SEO JSON 格式支持很好
  const model = '@cf/meta/llama-3-8b-instruct' 

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are an SEO expert. Output JSON only." },
          { role: "user", content: prompt }
        ],
      }),
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(`CF AI Error: ${JSON.stringify(result.errors)}`);
  }

  // Cloudflare 返回的结构是 { result: { response: "..." } }
  return result.result.response;
}