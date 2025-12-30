const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      secure: false,
      timeout: 10000,
      onError: (err, req, res) => {
        console.error('代理错误:', err.message);
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('代理请求:', req.method, req.url, '->', proxyReq.path);
      }
    })
  );
  
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      ws: true,
      logLevel: 'debug'
    })
  );
  
  // 代理上传的文件（头像等）
  app.use(
    '/uploads',
    createProxyMiddleware({
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      secure: false
    })
  );
};

