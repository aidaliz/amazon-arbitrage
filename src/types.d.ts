// Mock types for Cloudflare Workers
declare module '@cloudflare/workers-types' {
  export interface D1Database {
    prepare: (query: string) => {
      bind: (...params: any[]) => {
        first: () => Promise<any>;
        run: () => Promise<any>;
        all: () => Promise<any[]>;
      };
    };
  }
}
