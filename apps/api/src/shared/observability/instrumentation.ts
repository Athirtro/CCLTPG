import { shutdownTracing, startTracing } from './tracing.js';

const tracingSdk = startTracing();

if (tracingSdk) {
  process.once('SIGTERM', () => {
    void shutdownTracing();
  });
  process.once('SIGINT', () => {
    void shutdownTracing();
  });
}

export { shutdownTracing, tracingSdk };
