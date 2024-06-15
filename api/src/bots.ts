import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { FixedNumber } from '@tarnadas/fixed-number';
import dayjs from 'dayjs';
import { Hono } from 'hono';

import { Arbitrage, zArbitrage } from './events';
import { binarySearch } from './util';

const zDailyProfitStats = z.object({
  date: z.string(),
  from: z.number(),
  to: z.number(),
  profits: z.string(),
  profitsNear: z.string()
});

type DailyProfitStats = z.infer<typeof zDailyProfitStats>;

const zDailyGasStats = z.object({
  hourlyTimestamp: z.string(),
  gas: z.string()
});

type DailyGasStats = z.infer<typeof zDailyGasStats>;

const botIds = z.enum([
  'bot.marior.near',
  'bot0.marior.near',
  'bot2.marior.near',
  'bot3.marior.near',
  'bot4.marior.near',
  'bot5.marior.near',
  'bot6.marior.near',
  'aldor.near',
  'frisky.near',
  'sneaky1.near',
  'kagool.near',
  'zalevsky.near',
  'foxboss.near',
  'xy_k.near'
]);

export const bots = new OpenAPIHono();
bots
  .openapi(
    createRoute({
      description: 'Returns daily arbitrage statistics',
      method: 'get',
      path: '/{bot_id}/daily/profit',
      request: {
        params: z.object({
          bot_id: botIds
        }),
        query: z.object({
          limit: z.coerce.number().max(20).default(20).optional(),
          skip: z.coerce.number().default(0).optional()
        })
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: zDailyProfitStats.array()
            }
          },
          description: 'daily arbitrage statistics'
        }
      }
    }),
    async c => {
      const botId = c.req.param('bot_id');
      const addr = c.env.BOTS.idFromName(botId);
      const obj = c.env.BOTS.get(addr);
      let { limit, skip } = c.req.query();
      limit = limit || '100';
      skip = skip || '0';
      const res = await obj.fetch(
        `${new URL(c.req.url).origin}/daily/profit?limit=${limit}&skip=${skip}`
      );
      const game = await res.json<DailyProfitStats[]>();
      return c.json(game);
    }
  )
  .openapi(
    createRoute({
      description: 'Returns daily gas usage',
      method: 'get',
      path: '/{bot_id}/daily/gas',
      request: {
        params: z.object({
          bot_id: botIds
        }),
        query: z.object({
          limit: z.coerce.number().max(20).default(20).optional(),
          skip: z.coerce.number().default(0).optional()
        })
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: zDailyGasStats.array()
            }
          },
          description: 'daily gas usage'
        }
      }
    }),
    async c => {
      const botId = c.req.param('bot_id');
      const addr = c.env.BOTS.idFromName(botId);
      const obj = c.env.BOTS.get(addr);
      const res = await obj.fetch(`${new URL(c.req.url).origin}/daily/gas`);
      const game = await res.json<DailyGasStats[]>();
      return c.json(game);
    }
  )
  .openapi(
    createRoute({
      description: 'Returns all arbitrage trades filtered by success value',
      method: 'get',
      path: '/{bot_id}',
      request: {
        params: z.object({
          bot_id: botIds
        }),
        query: z.object({
          status: z.enum(['success', 'failure']).default('success').optional(),
          limit: z.coerce.number().max(100).default(100).optional(),
          skip: z.coerce.number().default(0).optional()
        })
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: zArbitrage.array()
            }
          },
          description: 'arbitrage trades'
        },
        400: {
          description: '`limit` and `skip` search param must be an integer'
        }
      }
    }),
    async c => {
      const botId = c.req.param('bot_id');
      const addr = c.env.BOTS.idFromName(botId);
      const obj = c.env.BOTS.get(addr);
      let { limit, skip, status } = c.req.query();
      limit = limit || '100';
      skip = skip || '0';
      status = status || 'success';
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
        `${new URL(c.req.url).origin}?limit=${limit}&skip=${skip}&status=${status}`
      );
      const arbitrages = await res.json<Arbitrage[]>();
      return c.json(arbitrages);
    }
  );

export class BotIds {
  private state: DurableObjectState;
  private app: Hono;
  private botIds: string[];

  constructor(state: DurableObjectState) {
    this.state = state;
    this.botIds = [];
    this.state.blockConcurrencyWhile(async () => {
      this.botIds = (await this.state.storage.get<string[]>(`botIds`)) ?? [];
    });

    this.app = new Hono();
    this.app
      .get('*', async c => {
        return c.json(this.botIds);
      })
      .post('*', async c => {
        const botIds = await c.req.json<string[]>();

        this.botIds = Array.from(new Set([...this.botIds, ...botIds]));
        await this.state.storage.put('botIds', this.botIds);

        return new Response(null, { status: 204 });
      });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}

export class Bots {
  private state: DurableObjectState;
  private app: Hono;
  private arbitrages: Arbitrage[];
  private arbitrageFailures: Arbitrage[];
  private index: number;
  private readonly pageSize = 200;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.arbitrages = [];
    this.arbitrageFailures = [];
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
      for (; ; this.index++) {
        const arbitrageFailures = await this.state.storage.get<Arbitrage[]>(
          `arbitrageFailures${this.index}`
        );
        if (arbitrageFailures == null || arbitrageFailures.length === 0) {
          if (this.index > 0) {
            this.index--;
          }
          break;
        }
        this.arbitrageFailures =
          this.arbitrageFailures.concat(arbitrageFailures);
      }
    });

    this.app = new Hono();
    this.app
      .get('/daily/profit', async c => {
        const { limit: limitStr, skip: skipStr } = c.req.query();
        const limit = Number(limitStr);
        const skip = Number(skipStr);

        let date = dayjs.utc(
          this.arbitrages[this.arbitrages.length - 1].timestamp / 1_000_000
        );
        date = date.subtract(skip, 'days');
        date = date.startOf('day');

        // TODO binary search start index
        let index = binarySearch(
          this.arbitrages,
          date.endOf('day').valueOf(),
          (arb, needle) => arb.timestamp / 1_000_000 - needle
        );
        index = Math.min(index, this.arbitrages.length - 1);
        if (
          date.endOf('day').valueOf() <
          this.arbitrages[0].timestamp / 1_000_000
        ) {
          index = -1;
        }

        const stats: DailyProfitStats[] = [];
        let profits = 0n;
        for (let i = index; i >= 0; i--) {
          const arb = this.arbitrages[i];
          if (arb.timestamp / 1_000_000 < date.valueOf()) {
            stats.push({
              date: date.format('YYYY-MM-DD'),
              from: date.valueOf(),
              to: date.endOf('day').valueOf(),
              profits: profits.toString(),
              profitsNear: new FixedNumber(profits, 24).format({
                maximumFractionDigits: 3
              })
            });
            profits = 0n;
            date = date.subtract(1, 'day');
            if (stats.length === limit) {
              break;
            }
          }
          if (arb.status === 'success') {
            profits += BigInt(arb.profit);
          }
        }
        if (profits > 0n) {
          stats.push({
            date: date.format('YYYY-MM-DD'),
            from: date.valueOf(),
            to: date.endOf('day').valueOf(),
            profits: profits.toString(),
            profitsNear: new FixedNumber(profits, 24).format({
              maximumFractionDigits: 3
            })
          });
        }

        return c.json(stats);
      })
      .get('/daily/gas', async () => {
        return new Response('', { status: 503 });
      })
      .get('*', async c => {
        const { limit: limitStr, skip: skipStr, status } = c.req.query();
        const limit = Number(limitStr);
        const skip = Number(skipStr);

        if (status === 'failure') {
          const length = this.arbitrageFailures.length;
          const slice = this.arbitrageFailures
            .slice(length - limit - skip, length - skip)
            .reverse();

          return c.json(slice);
        } else {
          const length = this.arbitrages.length;
          const slice = this.arbitrages
            .slice(length - limit - skip, length - skip)
            .reverse();

          return c.json(slice);
        }
      })
      .post('*', async c => {
        const events = await c.req.json<Arbitrage[]>();

        const arbitrageSuccesses = events.filter(
          arb => arb.status === 'success'
        );
        this.arbitrages = this.arbitrages.concat(arbitrageSuccesses);
        let slice = this.arbitrages.slice(this.index * this.pageSize);
        if (slice.length > this.pageSize) {
          this.index++;
          slice = this.arbitrages.slice(this.index * this.pageSize);
        }
        await this.state.storage.put(`arbitrages${this.index}`, slice);

        const arbitrageFailures = events.filter(
          arb => arb.status === 'failure'
        );
        this.arbitrageFailures =
          this.arbitrageFailures.concat(arbitrageFailures);
        slice = this.arbitrageFailures.slice(this.index * this.pageSize);
        if (slice.length > this.pageSize) {
          this.index++;
          slice = this.arbitrageFailures.slice(this.index * this.pageSize);
        }
        await this.state.storage.put(`arbitrageFailures${this.index}`, slice);

        return new Response(null, { status: 204 });
      })
      .delete('*', async () => {
        this.arbitrages = [];
        this.arbitrageFailures = [];
        this.index = 0;
        await this.state.storage.deleteAll();
        return new Response(null, { status: 204 });
      });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}
