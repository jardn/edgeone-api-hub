// EdgeOne Makers (Cloud Functions)
// 文件路径: cloud-functions/[[default]].js
// 通配符路由 - 处理所有 /{service}/... 的API代理请求

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
 * EdgeOne Pages的headers对象可能不是标准的Headers API
 */
function getHeader(headers, name) {
  try {
    // 方法1: 标准Headers API
    if (headers && typeof headers.get === 'function') {
      return headers.get(name);
    }

    // 方法2: 普通对象
    if (headers && typeof headers === 'object') {
      // 尝试直接访问
      if (headers[name]) return headers[name];

      // 尝试小写
      const lowerName = name.toLowerCase();
      if (headers[lowerName]) return headers[lowerName];

      // 遍历查找（忽略大小写）
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
 * 动态获取当前请求的origin（域名）- EdgeOne Makers兼容版
 * @param {Request} request - 请求对象
 * @returns {string} 当前域名
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

  // 方法3: 最后退路 - 从 host header 构建（无论如何都应该有这个）
  const lastHost = getHeader(request.headers, 'host') || getHeader(request.headers, ':authority');
  if (lastHost) {
    const fallback = `https://${lastHost}`;
    console.log(`[EdgeOne] ⚠️ Ultimate fallback origin: ${fallback}`);
    return fallback;
  }

  // 如果连 host 都没有，返回一个注释性值（实际不应该发生）
  console.log(`[EdgeOne] ❌ Cannot determine origin at all!`);
  return 'https://unknown-domain';
}

/**
 * 获取URL路径信息，兼容EdgeOne Pages的request对象
 * @param {Request} request - 请求对象
 * @returns {Object} 包含pathname和search的对象
 */
function getUrlInfo(request) {
  console.log(`[EdgeOne] getUrlInfo - raw request.url: "${request.url}", type: ${typeof request.url}`);

  try {
    // 尝试标准URL解析
    const url = new URL(request.url);
    console.log(`[EdgeOne] Standard URL parse successful - pathname: "${url.pathname}", origin: "${url.origin}"`);
    return {
      pathname: url.pathname,
      search: url.search,
      origin: url.origin
    };
  } catch (error) {
    console.log(`[EdgeOne] Standard URL parse failed: ${error.message}`);

    // EdgeOne Pages可能返回相对路径，手动解析
    const urlString = request.url || '/';
    console.log(`[EdgeOne] Using manual parsing for: "${urlString}"`);

    const [pathname, search = ''] = urlString.split('?');
    const origin = getCurrentOrigin(request);

    // 特殊处理空路径的情况
    const finalPathname = pathname || '/';
    console.log(`[EdgeOne] Manual parse result - pathname: "${finalPathname}", origin: "${origin}"`);

    return {
      pathname: finalPathname,
      search: search ? `?${search}` : '',
      origin: origin
    };
  }
}

/**
 * 生成动态HTML模板
 * @param {string} origin - 当前域名
 * @returns {string} HTML内容
 */
function generateHTMLTemplate(origin) {
  console.log(`[EdgeOne] Generating HTML template for origin: ${origin}`);

  const html = `<!DOCTYPE html>
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

        @keyframes gradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
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
            animation: float 2s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }

        .domain-info {
            background: rgba(0, 102, 255, 0.1);
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            border: 1px solid rgba(0, 102, 255, 0.2);
        }

        .domain-info code {
            background: rgba(0, 0, 0, 0.1);
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            font-family: monospace;
        }

        .status-info {
            background: rgba(34, 197, 94, 0.1);
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            border: 1px solid rgba(34, 197, 94, 0.2);
            color: #15803d;
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
            animation: fadeInUp 0.6s ease backwards;
            animation-delay: calc(var(--order) * 0.1s);
        }

        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }

        .logo {
            font-size: 2rem;
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
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
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .endpoint::before {
            content: '$ ';
            opacity: 0.6;
            color: #a4b0be;
        }

        .copy-btn {
            width: 100%;
            padding: 0.75rem;
            border: none;
            border-radius: 12px;
            background: var(--gradient);
            color: white;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            font-size: 0.9rem;
        }

        .copy-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0, 102, 255, 0.3);
        }

        .copy-btn:active {
            transform: translateY(0);
        }

        .copy-btn svg {
            width: 16px;
            height: 16px;
        }

        .toast {
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 50px;
            font-size: 0.875rem;
            opacity: 0;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            z-index: 1000;
        }

        .toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(-10px);
        }

        .footer {
            text-align: center;
            margin-top: 3rem;
            padding: 2rem 0;
            border-top: 1px solid var(--border);
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        @media (max-width: 640px) {
            .container {
                padding: 1rem;
            }
            .header h1 {
                font-size: 2rem;
            }
            .grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>API 代理服务</h1>
            <p>EdgeOne Pages 驱动的高性能 API 代理服务</p>
            <div class="badge">⚡ Powered by EdgeOne Pages</div>
        </div>

        <div class="status-info">
            <p>✅ 服务状态：正常运行</p>
            <p>🔧 EdgeOne Pages 兼容性修复已应用</p>
        </div>

        <div class="domain-info">
            <p>🌐 当前服务域名: <code>${origin}</code></p>
            <p>✨ 所有API端点将自动使用当前域名，无需手动配置</p>
            <p>📱 特别优化：Telegram Bot API 国内直连访问</p>
        </div>

        <div class="grid" id="api-grid">
            <!-- API cards will be generated by JavaScript -->
        </div>

        <div class="footer">
            <p>🚀 基于腾讯云 EdgeOne Pages 构建 | 全球加速访问 | 高可用保障</p>
        </div>
    </div>

    <div id="toast" class="toast">✨ 已复制到剪贴板</div>

    <script>
        const API_CONFIGS = ${JSON.stringify(API_CONFIGS)};
        const CURRENT_ORIGIN = '${origin}';

        console.log('[API Hub] Loading with origin:', CURRENT_ORIGIN);

        // 生成 API 卡片
        const apiGrid = document.getElementById('api-grid');

        Object.entries(API_CONFIGS).forEach(([provider, config], index) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.setProperty('--order', index);

            card.innerHTML = \`
                <div class="card-header">
                    <span class="logo">\${config.logo}</span>
                    <span class="title">\${provider.toUpperCase()}</span>
                </div>
                <div class="description">\${config.description}</div>
                <div class="endpoint" id="endpoint-\${provider}"></div>
                <button class="copy-btn" onclick="copyEndpoint('\${provider}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                    </svg>
                    复制端点
                </button>
            \`;

            apiGrid.appendChild(card);
        });

        // 设置端点 URL - 使用动态域名
        Object.entries(API_CONFIGS).forEach(([provider, config]) => {
            const endpointEl = document.getElementById(\`endpoint-\${provider}\`);
            if (endpointEl) {
                const endpoint = config.directUrl ?
                    \`https://\${config.host}\` :
                    \`\${CURRENT_ORIGIN}/\${provider}/\`;
                endpointEl.textContent = endpoint;
            }
        });

        // 复制端点函数
        async function copyEndpoint(provider) {
            const config = API_CONFIGS[provider];
            const endpoint = config.directUrl ?
                \`https://\${config.host}\` :
                \`\${CURRENT_ORIGIN}/\${provider}/\`;

            try {
                await navigator.clipboard.writeText(endpoint);
                showToast();
            } catch (err) {
                // 降级处理
                const textArea = document.createElement('textarea');
                textArea.value = endpoint;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showToast();
            }
        }

        function showToast() {
            const toast = document.getElementById('toast');
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 2000);
        }

        // 页面加载完成提示
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[API Hub] Page loaded successfully with EdgeOne Pages compatibility fixes');
        });
    </script>
</body>
</html>`;

  console.log(`[EdgeOne] HTML template generated, length: ${html.length} characters`);
  return html;
}

/**
 * 处理静态资源请求
 * @param {string} pathname - 请求路径
 * @param {string} origin - 当前域名
 * @returns {Response|null} - 静态资源响应或null
 */
async function handleStaticResource(pathname, origin) {
  // 处理favicon.ico - 简化路径处理，避免导入冲突
  if (pathname === '/favicon.ico') {
    try {
      // 在EdgeOne Pages环境中，直接使用相对路径
      const faviconPath = '../favicon.ico';
      console.log(`[EdgeOne] Attempting to load favicon from: ${faviconPath}`);

      const faviconBuffer = await readFile(faviconPath);
      console.log(`[EdgeOne] Successfully loaded favicon, size: ${faviconBuffer.length} bytes`);

      return new Response(faviconBuffer, {
        headers: {
          'Content-Type': 'image/x-icon',
          'Cache-Control': 'public, max-age=86400', // 24小时缓存
          'Access-Control-Allow-Origin': '*',
          'X-Static-File': 'favicon.ico'
        }
      });
    } catch (error) {
      console.error(`[EdgeOne] Error loading favicon.ico:`, error.message);
      console.log(`[EdgeOne] Falling back to SVG icon`);

      // 降级到SVG图标
      const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🚀</text></svg>`;
      return new Response(faviconSvg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'X-Fallback': 'true'
        }
      });
    }
  }

  // 处理robots.txt - 使用动态域名
  if (pathname === '/robots.txt') {
    const robotsTxt = `User-agent: *
Allow: /
Sitemap: ${origin}/sitemap.xml

# API Hub - EdgeOne Pages
# Current Origin: ${origin}
# Generated: ${new Date().toISOString()}
# Status: Compatible with EdgeOne Pages`;

    return new Response(robotsTxt, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 处理sitemap.xml - 使用动态域名
  if (pathname === '/sitemap.xml') {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- API Service Endpoints -->
${Object.keys(API_CONFIGS).map(service => `  <url>
    <loc>${origin}/${service}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  return null;
}

/**
 * 处理API代理请求
 */
async function handleAPIProxy(request, env, pathname, search, origin) {
  let pathParts = [];
  try {
    pathParts = pathname.split('/').filter(Boolean);
    const service = pathParts[0];

    if (!API_CONFIGS[service]) {
      return new Response(JSON.stringify({
        error: 'Invalid service',
        available_services: Object.keys(API_CONFIGS),
        usage: 'Use /{service}/ as prefix for API calls',
        current_origin: origin,
        pathname: pathname,
        examples: {
          telegram: `${origin}/telegram/bot<YOUR_TOKEN>/getMe`,
          openai: `${origin}/openai/v1/models`,
          gemini: `${origin}/gemini/v1beta/models`
        }
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const config = API_CONFIGS[service];

    // 服务根路径访问处理
    if (request.method === 'GET' && (pathname === `/${service}` || pathname === `/${service}/`)) {
      return new Response(null, {
        status: 302,
        headers: { 'Location': '/' }
      });
    }

    // 构建目标URL
    const targetPath = pathname.replace(`/${service}`, '');
    const targetURL = `https://${config.host}${targetPath}${search}`;

    console.log(`[EdgeOne Proxy] ${request.method} ${targetURL} (Origin: ${origin})`);

    // 处理请求头
    const headers = {};

    // 兼容性处理headers
    try {
      if (request.headers) {
        if (typeof request.headers.entries === 'function') {
          for (const [key, value] of request.headers.entries()) {
            if (!['host', 'connection', 'content-length', 'cf-ray', 'cf-connecting-ip'].includes(key.toLowerCase())) {
              headers[key] = value;
            }
          }
        } else if (typeof request.headers === 'object') {
          for (const [key, value] of Object.entries(request.headers)) {
            if (!['host', 'connection', 'content-length', 'cf-ray', 'cf-connecting-ip'].includes(key.toLowerCase())) {
              headers[key] = value;
            }
          }
        }
      }
    } catch (error) {
      console.error(`[EdgeOne Proxy] Error processing headers:`, error);
    }

    // 创建代理请求
    const proxyRequest = new Request(targetURL, {
      method: request.method,
      headers: headers,
      body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      redirect: 'follow'
    });

    // 发送请求
    const response = await fetch(proxyRequest);

    // 处理响应头
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS, PUT, DELETE, PATCH');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('X-Proxy-Service', service);
    responseHeaders.set('X-Proxy-Origin', origin);
    responseHeaders.set('X-Powered-By', 'EdgeOne Pages');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    console.error(`[EdgeOne Proxy Error] ${error.message}`);
    return new Response(JSON.stringify({
      error: 'Proxy request failed',
      message: error.message,
      service: pathParts[0] || 'unknown',
      current_origin: origin,
      pathname: pathname,
      debug_info: {
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
        headers_type: typeof request.headers,
        has_headers_get: request.headers && typeof request.headers.get === 'function'
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Error-Source': 'EdgeOne Proxy',
        'X-Error-Origin': origin
      }
    });
  }
}

/**
 * 处理CORS预检请求
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS, PUT, DELETE, PATCH',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
      'X-CORS-Handler': 'EdgeOne Pages'
    }
  });
}

/**
 * EdgeOne Pages Node Functions 主入口 - 兼容性修复版本
 * 处理所有通配符路由 [...path]，修复request.headers.get问题
 */
export async function onRequest(context) {
  const { request, env, params } = context;

  console.log(`[EdgeOne] ${request.method} ${request.url}`);
  console.log(`[EdgeOne] Headers type:`, typeof request.headers);
  console.log(`[EdgeOne] Has headers.get:`, request.headers && typeof request.headers.get === 'function');

  // 处理CORS预检
  if (request.method === 'OPTIONS') {
    return handleCORS();
  }

  try {
    // 安全地获取URL信息和当前域名
    const { pathname, search, origin } = getUrlInfo(request);

    console.log(`[EdgeOne] Parsed - pathname: ${pathname}, search: ${search}, origin: ${origin}`);

    // 处理静态资源（使用动态域名）
    const staticResponse = await handleStaticResource(pathname, origin);
    if (staticResponse) {
      console.log(`[EdgeOne] Serving static resource: ${pathname}`);
      return staticResponse;
    }

    // 首页处理（使用动态HTML模板）
    // 增强首页识别逻辑 - EdgeOne Pages可能有不同的路径格式
    console.log(`[EdgeOne] Path analysis - pathname: "${pathname}", request.url: "${request.url}"`);
    console.log(`[EdgeOne] URL type: ${typeof request.url}, pathname type: ${typeof pathname}`);

    const isHomePage = pathname === '/' || pathname === '' || pathname === null || pathname === undefined ||
                      pathname === '/index' || pathname === '/index.html' ||
                      (!pathname && request.url === '/') ||
                      (request.url && (request.url === '/' || request.url === '' || request.url.endsWith('/')));

    console.log(`[EdgeOne] Homepage check - isHomePage: ${isHomePage}`);
    console.log(`[EdgeOne] Individual checks:`, {
      'pathname === "/"': pathname === '/',
      'pathname === ""': pathname === '',
      'pathname null/undefined': pathname === null || pathname === undefined,
      'request.url === "/"': request.url === '/',
      'request.url': request.url
    });

    if (isHomePage) {
      console.log(`[EdgeOne] ✅ Serving homepage - pathname: "${pathname}", request.url: "${request.url}", origin: ${origin}`);
      return new Response(generateHTMLTemplate(origin), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Page-Type': 'homepage',
          'X-Current-Origin': origin,
          'X-EdgeOne-Compatible': 'v2.1',
          'X-Path-Debug': `pathname="${pathname}", url="${request.url}"`,
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // API代理处理（传递动态域名）
    // 检查是否为有效的API路径
    const pathParts = pathname.split('/').filter(Boolean);
    const potentialService = pathParts[0];

    // 如果路径不为空但不是已知的API服务，返回404
    if (pathParts.length > 0 && !API_CONFIGS[potentialService]) {
      console.log(`[EdgeOne] Unknown service "${potentialService}" - pathname: "${pathname}"`);
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: `Service "${potentialService}" not found`,
        available_services: Object.keys(API_CONFIGS),
        current_origin: origin,
        pathname: pathname,
        suggestion: `Try ${origin}/ for homepage or use one of the available services`
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Error-Type': 'Service Not Found'
        }
      });
    }

    console.log(`[EdgeOne] Handling API proxy for: ${pathname}`);
    return handleAPIProxy(request, env, pathname, search, origin);

  } catch (error) {
    console.error(`[EdgeOne] Fatal error in onRequest:`, error);

    // 详细的错误信息，帮助调试EdgeOne Pages兼容性问题
    const errorDetails = {
      error: 'Internal server error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      edgeone_compatibility: 'v2.0',
      request_info: {
        method: request.method,
        url: request.url,
        url_type: typeof request.url,
        has_url: !!request.url,
        headers_type: typeof request.headers,
        has_headers_get: request.headers && typeof request.headers.get === 'function',
        headers_keys: request.headers ? Object.keys(request.headers) : null
      },
      debug_context: {
        user_agent: getHeader(request.headers, 'user-agent') || 'unknown',
        host: getHeader(request.headers, 'host') || 'unknown',
        origin_header: getHeader(request.headers, 'origin') || 'none'
      }
    };

    console.error('[EdgeOne] Error details:', JSON.stringify(errorDetails, null, 2));

    return new Response(JSON.stringify(errorDetails), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Error-Source': 'EdgeOne Fatal Error',
        'X-EdgeOne-Compatible': 'v2.0'
      }
    });
  }
}