import app from './app';
import { env } from './config/env';
import { safeErrorForLog } from './security/redaction';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Foody API server running on http://localhost:${PORT}`);
  console.log(`   Health:     http://localhost:${PORT}/health`);
  console.log(`   Products:   http://localhost:${PORT}/api/products`);
  console.log(`   Categories: http://localhost:${PORT}/api/categories`);
  console.log(`   Banners:    http://localhost:${PORT}/api/banners`);
  console.log(`\n   Environment: ${env.NODE_ENV}\n`);
});

server.on('error', (error) => {
  console.error('API server error:', safeErrorForLog(error));
});
