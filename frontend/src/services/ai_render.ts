const RENDER_API_URL = process.env.EXPO_PUBLIC_RENDER_API_URL;

export async function callGemini(prompt: string, systemInstruction: string) {
  const response = await fetch(`${RENDER_API_URL}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemInstruction }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

export async function callGroq(messages: any[], model?: string) {
  const response = await fetch(`${RENDER_API_URL}/api/groq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}
