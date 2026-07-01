// EdgeOne Makers (Cloud Functions)
// 文件路径: cloud-functions/index.js
// 专门处理根路径 "/" 的请求

import { readFile } from 'fs/promises';

// API 配置 - 支持的代理服务
const API_CONFIGS = {
  openai: {
    host: 'api.openai.com',
    paths: ['/v1/'],
    description: "OpenAI API 代理服务",
    logo: "🤖"
  },
  gemini: {
    host: 'generativelanguage.googleapis.com',
    paths: ['/v1beta/models/'],
    description: "Google Gemini API 代理服务",
    logo: "🌟"
  },
  claude: {
    host: 'api.anthropic.com',
    paths: ['/v1/'],
    description: "Claude API 代理服务",
    logo: "🧠"
  },
  grok: {
    host: 'api.x.ai',
    paths: ['/v1/'],
    description: "Grok API 代理服务",
    logo: "⚡"
  },
  github: {
    host: 'github.com',
    paths: ['/'],
    description: "GitHub API 代理服务",
    logo: "📦"
  },
  telegram: {
    host: 'api.telegram.org',
    paths: ['/bot'],
    description: "Telegram Bot API 代理服务",
    logo: "📱"
  }
};

/**
 * 兼容性函数：获取请求头
 */
function getHeader(headers, name) {
  try {
    if (headers && typeof headers.get === 'function') {
      return headers.get(name);
    }
    if (headers && typeof headers === 'object') {
      if (headers[name]) return headers[name];
      const lowerName = name.toLowerCase();
      if (headers[lowerName]) return headers[lowerName];
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lowerName) {
          return value;
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`[EdgeOne] Error getting header ${name}:`, error);
    return null;
  }
}

/**
 * 动态获取当前请求的origin（域名）- EdgeOne Makers优化版
 */
function getCurrentOrigin(request) {
  console.log(`[EdgeOne] getCurrentOrigin - request.url: "${request.url}"`);

  // 方法1: 尝试从 request.url 直接提取（如果它是完整URL）
  try {
    const url = new URL(request.url);
    if (url.origin && !url.origin.includes('localhost')) {
      console.log(`[EdgeOne] ✅ Extracted origin from request.url: ${url.origin}`);
      return url.origin;
    }
  } catch (e) {
    console.log(`[EdgeOne] request.url is relative, checking headers...`);
  }

  // 方法2: 从请求头中检测
  try {
    const headers = request.headers;
    const possibleHosts = [
      getHeader(headers, 'x-forwarded-host'),
      getHeader(headers, 'x-original-host'),
      getHeader(headers, 'x-real-host'),
      getHeader(headers, 'x-forwarded-server'),
      getHeader(headers, 'host'),
      getHeader(headers, ':authority')
    ].filter(Boolean);

    console.log(`[EdgeOne] Found hosts:`, possibleHosts);

    for (const host of possibleHosts) {
      const hostStr = host.replace(/:\d+$/, '').toLowerCase(); // 去掉端口号
      // 跳过内部资源域名
      const internalDomains = ['pages-scf', 'qcloudteo.com', 'edgeone.cool', 'dnsoe6.com', 'pages.dev'];
      const isInternal = internalDomains.some(d => hostStr.includes(d));
      if (host && !isInternal) {
        const protocol = getHeader(headers, 'x-forwarded-proto') || 'https';
        const origin = `${protocol}://${host}`;
        console.log(`[EdgeOne] ✅ Using valid host: ${origin}`);
        return origin;
      }
    }
  } catch (error) {
    console.error(`[EdgeOne] Error checking headers:`, error);
  }

  // 方法3: 最后退路 - 从相对路径的 request.url 反向构建
  // EdgeOne Makers 中 request.url 是相对路径，但我们知道域名必须是从请求来的
  // 用 request.url 的 host 部分构造（不可能，因为是相对路径）
  // 只能返回一个能让页面正常工作的值
  const fallback = 'https://' + (getHeader(request.headers, 'host') || getHeader(request.headers, ':authority') || 'unknown-domain');
  console.log(`[EdgeOne] ⚠️ Ultimate fallback origin: ${fallback}`);
  return fallback;
}

/**
 * 生成动态HTML模板
 */
function generateHTMLTemplate(origin) {
  console.log(`[EdgeOne] Generating homepage HTML template for origin: ${origin}`);

  return `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Hub - EdgeOne Pages</title>
    <link rel="icon" href="${origin}/favicon.ico">
    <style>
        :root {
            --bg: #f0f2f5;
            --card-bg: #ffffff;
            --text: #1a1a1a;
            --text-secondary: #666666;
            --border: #eaeaea;
            --primary: #0066ff;
            --gradient: linear-gradient(120deg, #FF0080, #7928CA, #0066ff);
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
        }
        .container {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
            padding: 2rem 0 1rem;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            background: var(--gradient);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: gradient 8s ease infinite;
            background-size: 200% auto;
        }
        .header p {
            color: var(--text-secondary);
            font-size: 1.1rem;
            margin-bottom: 1rem;
        }
        .badge {
            display: inline-block;
            background: var(--gradient);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-size: 0.9rem;
            font-weight: 500;
        }
        .domain-info {
            background: rgba(0, 102, 255, 0.1);
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            border: 1px solid rgba(0, 102, 255, 0.2);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 1.5rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }
        .card-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }
        .logo {
            font-size: 2rem;
        }
        .title {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text);
        }
        .description {
            color: var(--text-secondary);
            margin-bottom: 1rem;
            font-size: 0.9rem;
            line-height: 1.4;
        }
        .endpoint {
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
            font-size: 0.875rem;
            padding: 0.75rem;
            border-radius: 8px;
            background: linear-gradient(135deg, #2f3542 0%, #40485e 100%);
            color: #f1f2f6;
            margin: 1rem 0;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 API 代理服务</h1>
            <p>EdgeOne Pages 驱动的高性能 API 代理服务</p>
            <div class="badge">⚡ Powered by EdgeOne Pages</div>
        </div>

        <div class="domain-info">
            <p>🌐 当前服务域名: <strong>${origin}</strong></p>
            <p>✨ 所有API端点将自动使用当前域名</p>
            <p>📱 特别优化：Telegram Bot API 国内直连访问</p>
        </div>

        <div class="grid" id="api-grid">
            ${Object.entries(API_CONFIGS).map(([provider, config]) => `
                <div class="card">
                    <div class="card-header">
                        <span class="logo">${config.logo}</span>
                        <span class="title">${provider.toUpperCase()}</span>
                    </div>
                    <div class="description">${config.description}</div>
                    <div class="endpoint">${config.directUrl ? `https://${config.host}` : `${origin}/${provider}/`}</div>
                </div>
            `).join('')}
        </div>

        <div style="text-align: center; margin-top: 3rem; padding: 2rem 0; border-top: 1px solid var(--border); color: var(--text-secondary); font-size: 0.9rem;">
            <p>🚀 基于腾讯云 EdgeOne Pages 构建 | 全球加速访问 | 高可用保障</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * EdgeOne Pages Node Functions - 根路径专用处理器
 */
export async function onRequest(context) {
  const { request } = context;

  console.log(`[EdgeOne-Index] ${request.method} ${request.url || '/'}`);
  console.log(`[EdgeOne-Index] 🎯 Root path handler triggered!`);

  // 只处理GET请求的根路径
  if (request.method === 'GET') {
    const origin = getCurrentOrigin(request);
    console.log(`[EdgeOne-Index] ✅ Serving homepage for origin: ${origin}`);

    return new Response(generateHTMLTemplate(origin), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Page-Type': 'homepage',
        'X-Handler': 'root-index',
        'X-EdgeOne-Compatible': 'v2.3',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 其他方法返回405
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      'Allow': 'GET',
      'X-Handler': 'root-index'
    }
  });
}