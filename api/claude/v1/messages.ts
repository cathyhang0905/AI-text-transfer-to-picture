export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: 'SILICONFLOW_API_KEY not configured' } });
    return;
  }

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e: any) {
    res.status(500).json({ error: { message: e.message ?? '请求失败' } });
  }
}
