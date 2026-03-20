import axios, { AxiosError } from 'axios';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  let response;
  try {
    response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
      },
      {
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response) {
      const body = JSON.stringify(axiosErr.response.data);
      throw new Error(`API error ${axiosErr.response.status}: ${body}`);
    }
    throw err;
  }

  const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Unexpected response format from Gemini API');
  }
  return text;
}
