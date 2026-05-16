export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface Provider {
  name: string;
  complete(messages: ChatMessage[], opts?: { json?: boolean; maxTokens?: number }): Promise<string>;
}

class AnthropicProvider implements Provider {
  name = 'anthropic';
  constructor(private apiKey: string, private model: string) {}
  async complete(messages: ChatMessage[], opts: { json?: boolean; maxTokens?: number } = {}) {
    const system = messages.find(m => m.role === 'system')?.content;
    const rest = messages.filter(m => m.role !== 'system');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts.maxTokens ?? 2048,
        system,
        messages: rest.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: Array<{ text: string }> };
    return data.content.map(c => c.text).join('');
  }
}

class OpenAIProvider implements Provider {
  name = 'openai';
  constructor(private apiKey: string, private model: string) {}
  async complete(messages: ChatMessage[], opts: { json?: boolean; maxTokens?: number } = {}) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: opts.maxTokens ?? 2048,
        response_format: opts.json ? { type: 'json_object' } : undefined,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message.content ?? '';
  }
}

class OllamaProvider implements Provider {
  name = 'ollama';
  constructor(private baseUrl: string, private model: string) {}
  async complete(messages: ChatMessage[], opts: { json?: boolean } = {}) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        format: opts.json ? 'json' : undefined,
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { message: { content: string } };
    return data.message.content;
  }
}

export function getProvider(name?: string): Provider {
  const which = (name || process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  if (which === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY missing');
    return new AnthropicProvider(key, process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6');
  }
  if (which === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY missing');
    return new OpenAIProvider(key, process.env.OPENAI_MODEL || 'gpt-4o-mini');
  }
  if (which === 'ollama') {
    return new OllamaProvider(
      process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      process.env.OLLAMA_MODEL || 'llama3.1',
    );
  }
  throw new Error(`Unknown AI provider: ${which}`);
}

export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const arr = raw.indexOf('[');
  const first = start === -1 ? arr : arr === -1 ? start : Math.min(start, arr);
  if (first === -1) throw new Error(`No JSON found in: ${text.slice(0, 200)}`);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  return JSON.parse(raw.slice(first, end + 1)) as T;
}
