import { Hono } from 'hono';

import { Arbitrage } from './events';

type DailyArbStats = {
  hourlyTimestamp: string;
  profits: string;
};

export const bots = new Hono()
  .get('/:bot_id/daily', async c => {
    const botId = c.req.param('bot_id');
    const addr = c.env.BOTS.idFromName(botId);
    const obj = c.env.BOTS.get(addr);
    const res = await obj.fetch(`${new URL(c.req.url).origin}/daily`);
    const game = await res.json<DailyArbStats[]>();
    return c.json(game);
  })
  .get('/:bot_id', async c => {
    const botId = c.req.param('bot_id');
    const addr = c.env.BOTS.idFromName(botId);
    const obj = c.env.BOTS.get(addr);
    let { limit, skip } = c.req.query();
    limit = limit || '100';
    skip = skip || '0';
    try {
      parseInt(limit);
      parseInt(skip);
    } catch (err) {
      return new Response(
        '`limit` and `skip` search param must be an integer',
        { status: 400 }
      );
    }
    const res = await obj.fetch(
      `${new URL(c.req.url).origin}?limit=${limit}&skip=${skip}`
    );
    const game = await res.json<Arbitrage[]>();
    return c.json(game);
  });

export class Bots {
  private state: DurableObjectState;
  private app: Hono;
  private arbitrages: Arbitrage[];
  private index: number;
  private readonly pageSize = 1_000;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.arbitrages = [];
    this.index = 0;
    this.state.blockConcurrencyWhile(async () => {
      for (; ; this.index++) {
        const arbitrages = await this.state.storage.get<Arbitrage[]>(
          `arbitrages${this.index}`
        );
        if (arbitrages == null || arbitrages.length === 0) {
          if (this.index > 0) {
            this.index--;
          }
          break;
        }
        this.arbitrages = this.arbitrages.concat(arbitrages);
      }
    });

    this.app = new Hono();
    this.app
      .get('/daily', async () => {
        return new Response('', { status: 503 });
      })
      .get('/', async c => {
        const { limit: limitStr, skip: skipStr } = c.req.query();
        const limit = Number(limitStr);
        const skip = Number(skipStr);

        const length = this.arbitrages.length;
        const slice = this.arbitrages
          .slice(length - limit - skip, length - skip)
          .reverse();

        return c.json(slice);
      })
      .post('/', async c => {
        const events = await c.req.json<Arbitrage[]>();

        this.arbitrages.concat(events);
        let slice = this.arbitrages.slice(this.index * this.pageSize);
        if (slice.length > this.pageSize) {
          this.index++;
          slice = this.arbitrages.slice(this.index * this.pageSize);
        }
        await this.state.storage.put(`arbitrage${this.index}`, slice);

        return new Response(null, { status: 204 });
      });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}
