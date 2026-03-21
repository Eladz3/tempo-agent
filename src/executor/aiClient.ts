import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function loadTempoEnv(): void {
  const envPath = path.join(process.cwd(), '.tempo', '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && value) {
      process.env[key] = value;
    }
  }
}

export async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  loadTempoEnv();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Add it to .tempo/.env (GEMINI_API_KEY=your-key) or set it as an environment variable.'
    );
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
