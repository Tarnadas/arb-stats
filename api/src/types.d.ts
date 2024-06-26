declare module 'hono' {
  interface Env {
    Variables: {
      user: User | null;
      session: Session | null;
      db: DB;
    };
    Bindings: {
      // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
      // MY_KV_NAMESPACE: KVNamespace;
      //
      // Durable Objects. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
      INFO: DurableObjectNamespace;
      BOTS: DurableObjectNamespace;
      BOT_IDS: DurableObjectNamespace;
      //
      // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
      // MY_BUCKET: R2Bucket;
      //
      // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
      // MY_SERVICE: Fetcher;
      //
      // Secret variables
      INDEXER_SECRET: string;
      //
      // Environment variables
    };
  }
}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>;
