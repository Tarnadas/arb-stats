import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Hono } from 'hono';

const zInfoResult = z.object({
  lastBlockHeight: z.number()
});

export type InfoResult = z.infer<typeof zInfoResult>;

export const info = new OpenAPIHono();
info.openapi(
  createRoute({
    description: 'Returns latest indexed block height',
    method: 'get',
    path: '/',
    request: {},
    responses: {
      200: {
        content: {
          'application/json': {
            schema: zInfoResult
          }
        },
        description: 'latest indexed block height'
      }
    }
  }),
  async c => {
    const addr = c.env.INFO.idFromName('');
    const obj = c.env.INFO.get(addr);
    const res = await obj.fetch(`${new URL(c.req.url).origin}/info`);
    const info = await res.json<InfoResult>();
    return c.json(info);
  }
);

export class Info {
  private state: DurableObjectState;
  private app: Hono;
  private info?: InfoResult;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const info = await this.state.storage.get<InfoResult>('info');
      this.info = info ?? { lastBlockHeight: 0 };
    });

    this.app = new Hono();
    this.app
      .get('*', c => {
        return c.json(this.info);
      })
      .post('/last_block_height', async c => {
        if (!this.info) return c.text('', 500);
        const lastBlockHeight = Number(await c.req.text());
        if (lastBlockHeight <= this.info.lastBlockHeight) {
          return new Response(null, { status: 400 });
        }
        this.info.lastBlockHeight = lastBlockHeight;
        await this.state.storage.put('info', this.info);
        return new Response(null, { status: 204 });
      });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}
