// api/chat.js
const OpenAI = require('openai');
const { SYSTEM_PROMPTS } = require('../lib/prompts');

const client = new OpenAI({
  baseURL: process.env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1',
  apiKey: process.env.SENSENOVA_API_KEY,
});
const MODEL = process.env.SENSENOVA_MODEL || 'deepseek-v4-flash';

async function generateNpcResponse(level, history, playerInput) {
  const systemPrompt = SYSTEM_PROMPTS[level] || SYSTEM_PROMPTS[1];
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({
      role: m.role === 'npc' ? 'assistant' : 'user',
      content: m.content
    })),
    { role: 'user', content: playerInput }
  ];

  const resp = await client.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.8,
    max_tokens: 80,
  });
  return resp.choices[0].message.content.trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '请使用 POST 请求' });
  }

  const { level, history, playerInput } = req.body;
  if (!level || !history || !playerInput) {
    return res.status(400).json({ error: '参数不完整' });
  }

  try {
    const npc = await generateNpcResponse(level, history, playerInput);
    res.status(200).json({ npc });
  } catch (err) {
    console.error('NPC 生成失败:', err);
    res.status(500).json({ error: 'AI 服务暂时不可用' });
  }
};