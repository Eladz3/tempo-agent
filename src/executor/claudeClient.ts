import axios, { AxiosError } from 'axios';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  let response;
  try {
    response = await axios.post(
      CLAUDE_API_URL,
      {
        model: DEFAULT_MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
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

  const block = response.data.content?.[0];
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected response format from Claude API');
  }
  return block.text as string;
}
