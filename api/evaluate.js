// api/evaluate.js
const OpenAI = require('openai');
const { EVAL_PROMPTS } = require('../lib/prompts');

const client = new OpenAI({
  baseURL: process.env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1',
  apiKey: process.env.SENSENOVA_API_KEY || 'sk-RvRxRuXRJ9p4WiVOiley5aexxzUQGWhr',
});
const MODEL = process.env.SENSENOVA_MODEL || 'deepseek-v4-flash';

async function evaluatePlayerResponse(level, playerInput, conversationHistory) {
  const evalPrompt = EVAL_PROMPTS[level] || EVAL_PROMPTS[1];

  const recentHistory = (conversationHistory || []).slice(-4).map(m =>
    `${m.role === 'player' ? '玩家' : '对方'}：${m.content}`
  ).join('\n');

  const messages = [
    { role: 'system', content: evalPrompt },
    { role: 'user', content: `当前关卡：第${level}关\n最近对话：\n${recentHistory}\n\n玩家的最新回应：${playerInput}\n\n请给出评分。` }
  ];

  const resp = await client.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 150,
  });

  const text = resp.choices[0].message.content.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      bChange: Math.round(parsed.bChange) || 0,
      sChange: Math.round(parsed.sChange) || 0,
      tactic: parsed.tactic || '中性回应',
      reason: parsed.reason || '',
      advice: parsed.advice || ''
    };
  }
  throw new Error('AI 返回格式异常');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '请使用 POST 请求' });
  }

  const { level, playerInput, conversationHistory } = req.body;
  if (!level || !playerInput) {
    return res.status(400).json({ error: '参数不完整' });
  }

  try {
    const result = await evaluatePlayerResponse(level, playerInput, conversationHistory || []);
    res.status(200).json(result);
  } catch (err) {
    console.error('评估失败:', err);
    // 返回基础评分兜底
    const lower = playerInput.toLowerCase();
    let bChange = 0, sChange = 0, tactic = '中性回应';
    if (/对不起|抱歉|我错了/.test(lower)) { bChange = -10; sChange = -4; tactic = '退缩道歉'; }
    else if (/^好$|^好的$|^行$|^可以$|听你的/.test(lower)) { bChange = -8; sChange = 1; tactic = '顺从妥协'; }
    else if (/你才|滚|你有病/.test(lower)) { bChange = -5; sChange = -10; tactic = '攻击性反击'; }
    else if (/我觉得|我的感受|我不/.test(lower)) { bChange = 6; sChange = 4; tactic = '坚定划界'; }
    else { bChange = 2; sChange = 1; }
    res.status(200).json({ bChange, sChange, tactic, reason: '本地评分（AI暂不可用）', advice: '继续练习，争取在下一回合做出更坚定的回应。' });
  }
};