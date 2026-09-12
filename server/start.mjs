import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 4317);
const { server, store } = createApp({
  dataDir: process.env.DATA_DIR || '.data',
  port,
  username: process.env.BOOTSTRAP_USERNAME,
  password: process.env.BOOTSTRAP_PASSWORD,
});
server.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`房东采集台已启动：http://localhost:${port}`);
  if (store.credentialFile) console.log(`本机登录信息：${store.credentialFile}`);
});
function shutdown() {
  server.close(() => { store.db.close(); process.exit(0); });
  server.closeIdleConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
