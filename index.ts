import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import es from 'event-stream';

const app = express();

app.use(bodyParser.json());

// 初始化URL和失败计数器
const url = "https://chat-gpt-next-web-tandk8600.vercel.app/api/openai/v1/chat/completions";  // 替换为你的URL
let urlFailureCount: Record<string, number> = {};
urlFailureCount[url] = 0;

app.post('/api/v1/chat/completions', async (req, res) => {
  let payload = req.body;
  let shouldStream = payload.stream || false;
  
  try {
    let response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed with status code: ${response.status}`);
    }

    urlFailureCount[url] = 0;  // 成功响应，重置失败计数

    // 如果不需要流传输，则获取完整的响应数据
    if (!shouldStream) {
      let data = await response.json();
      console.info(`非流式成功： ${url}`);
      return res.json(data);
    }

    // 如果需要流传输，则使用 event-stream 来处理响应流
    console.info(`流式成功： ${url}`);
    response.body.pipe(es.split(/\r?\n\r?\n/)).pipe(es.mapSync((data) => {
      if (data) {
        res.write(`${data}\n\n`);
      }
    })).on('end', () => {
      res.end();
    }).on('error', (err) => {
      res.status(502).json({ error: `Stream processing failed: ${err.message}` });
    });

  } catch (e) {
    console.error(`请求异常： ${url} - ${e}`);

    // 更新失败计数
    urlFailureCount[url] += 1;
    if (urlFailureCount[url] >= 3) {
      // 如果URL失败超过3次，返回错误
      return res.status(502).json({ error: "URL failed or were removed." });
    }
  
    // 如果尝试了所有URL但没有成功，也返回错误
    return res.status(502).json({ error: "URL failed to provide a successful response." });
  }
});

// Vercel使用的是serverless函数，我们需要以这种方式导出我们的应用
module.exports = app;
