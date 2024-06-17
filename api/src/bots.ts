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
  date: z.string(),
  from: z.number(),
  to: z.number(),
  gasBurnt: z.string(),
  nearBurnt: z.string()
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
      limit = limit || '20';
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
      let { limit, skip } = c.req.query();
      limit = limit || '20';
      skip = skip || '0';
      const res = await obj.fetch(
        `${new URL(c.req.url).origin}/daily/gas?limit=${limit}&skip=${skip}`
      );
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
  private index: number;

  private arbitrageFailures: Arbitrage[];
  private indexFailures: number;

  private dailyProfitsCache: Record<string, DailyProfitStats> = {};
  private dailyGasCache: Record<string, DailyGasStats> = {};

  private readonly pageSize = 200;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.arbitrages = [];
    this.index = 0;
    this.arbitrageFailures = [];
    this.indexFailures = 0;
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
      for (; ; this.indexFailures++) {
        const arbitrageFailures = await this.state.storage.get<Arbitrage[]>(
          `arbitrageFailures${this.indexFailures}`
        );
        if (arbitrageFailures == null || arbitrageFailures.length === 0) {
          if (this.indexFailures > 0) {
            this.indexFailures--;
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
        let isFirst = true;
        for (let i = index; i >= 0; i--, isFirst = false) {
          const arb = this.arbitrages[i];
          const formattedDate = date.format('YYYY-MM-DD');
          if (
            !isFirst &&
            stats.length > 0 &&
            this.dailyProfitsCache[formattedDate] != null
          ) {
            if (stats[stats.length - 1].date !== formattedDate) {
              stats.push(this.dailyProfitsCache[formattedDate]);
            }
            if (arb.timestamp / 1_000_000 < date.valueOf()) {
              date = date.subtract(1, 'day');
            }
            if (stats.length === limit) {
              break;
            }
            continue;
          }
          if (arb.timestamp / 1_000_000 < date.valueOf()) {
            const arbStats = {
              date: formattedDate,
              from: date.valueOf(),
              to: date.endOf('day').valueOf(),
              profits: profits.toString(),
              profitsNear: new FixedNumber(profits, 24).format({
                maximumFractionDigits: 3
              })
            };
            if (stats.length > 0) {
              this.dailyProfitsCache[formattedDate] = arbStats;
            }
            stats.push(arbStats);
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
          const formattedDate = date.format('YYYY-MM-DD');
          const arbStats = {
            date: formattedDate,
            from: date.valueOf(),
            to: date.endOf('day').valueOf(),
            profits: profits.toString(),
            profitsNear: new FixedNumber(profits, 24).format({
              maximumFractionDigits: 3
            })
          };
          if (stats.length > 0) {
            this.dailyProfitsCache[formattedDate] = arbStats;
          }
          stats.push(arbStats);
        }

        return c.json(stats);
      })
      .get('/daily/gas', async c => {
        const { limit: limitStr, skip: skipStr } = c.req.query();
        const limit = Number(limitStr);
        const skip = Number(skipStr);

        let date = dayjs.utc(
          this.arbitrages[this.arbitrages.length - 1].timestamp / 1_000_000
        );
        const dateFailures = dayjs.utc(
          this.arbitrageFailures[this.arbitrageFailures.length - 1].timestamp /
            1_000_000
        );
        if (dateFailures.isBefore(date)) {
          date = dateFailures;
        }
        date = date.subtract(skip, 'days');
        date = date.startOf('day');
        const startDate = date.clone();

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

        const stats: DailyGasStats[] = [];
        let gasBurnt = 0n;
        for (let i = index; i >= 0; i--) {
          const arb = this.arbitrages[i];
          if (arb.timestamp / 1_000_000 < date.valueOf()) {
            stats.push({
              date: date.format('YYYY-MM-DD'),
              from: date.valueOf(),
              to: date.endOf('day').valueOf(),
              gasBurnt: gasBurnt.toString(),
              nearBurnt: new FixedNumber(gasBurnt, 16).format({
                maximumFractionDigits: 5
              })
            });
            gasBurnt = 0n;
            date = date.subtract(1, 'day');
            if (stats.length === limit) {
              break;
            }
          }
          gasBurnt += BigInt(arb.gasBurnt);
        }
        if (gasBurnt > 0n) {
          stats.push({
            date: date.format('YYYY-MM-DD'),
            from: date.valueOf(),
            to: date.endOf('day').valueOf(),
            gasBurnt: gasBurnt.toString(),
            nearBurnt: new FixedNumber(gasBurnt, 16).format({
              maximumFractionDigits: 5
            })
          });
        }

        // failures
        date = startDate;

        index = binarySearch(
          this.arbitrageFailures,
          date.endOf('day').valueOf(),
          (arb, needle) => arb.timestamp / 1_000_000 - needle
        );
        index = Math.min(index, this.arbitrageFailures.length - 1);
        if (
          date.endOf('day').valueOf() <
          this.arbitrageFailures[0].timestamp / 1_000_000
        ) {
          index = -1;
        }

        const statsFailures: DailyGasStats[] = [];
        gasBurnt = 0n;
        for (let i = index; i >= 0; i--) {
          const arb = this.arbitrageFailures[i];
          if (arb.timestamp / 1_000_000 < date.valueOf()) {
            statsFailures.push({
              date: date.format('YYYY-MM-DD'),
              from: date.valueOf(),
              to: date.endOf('day').valueOf(),
              gasBurnt: gasBurnt.toString(),
              nearBurnt: new FixedNumber(gasBurnt, 16).format({
                maximumFractionDigits: 5
              })
            });
            gasBurnt = 0n;
            date = date.subtract(1, 'day');
            if (statsFailures.length === limit) {
              break;
            }
          }
          gasBurnt += BigInt(arb.gasBurnt);
        }
        if (gasBurnt > 0n) {
          statsFailures.push({
            date: date.format('YYYY-MM-DD'),
            from: date.valueOf(),
            to: date.endOf('day').valueOf(),
            gasBurnt: gasBurnt.toString(),
            nearBurnt: new FixedNumber(gasBurnt, 16).format({
              maximumFractionDigits: 5
            })
          });
        }

        const allStats: DailyGasStats[] = [];
        for (let i = 0, j = 0; i < stats.length || j < statsFailures.length; ) {
          if (stats[i].from < statsFailures[j].from) {
            allStats.push(stats[i]);
            i++;
          } else if (stats[i].from > statsFailures[j].from) {
            allStats.push(statsFailures[j]);
            j++;
          } else {
            allStats.push({
              date: stats[i].date,
              from: stats[i].from,
              to: stats[i].to,
              gasBurnt: (
                BigInt(stats[i].gasBurnt) + BigInt(statsFailures[j].gasBurnt)
              ).toString(),
              nearBurnt: new FixedNumber(
                BigInt(stats[i].gasBurnt) + BigInt(statsFailures[j].gasBurnt),
                16
              ).format({
                maximumFractionDigits: 5
              })
            });
            i++;
            j++;
          }
        }

        return c.json(allStats);
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
        let slice = this.arbitrages.slice(
          this.index * this.pageSize,
          (this.index + 1) * this.pageSize
        );
        await this.state.storage.put(`arbitrages${this.index}`, slice);
        // eslint-disable-next-line no-constant-condition
        while (true) {
          slice = this.arbitrages.slice(
            (this.index + 1) * this.pageSize,
            (this.index + 2) * this.pageSize
          );
          if (slice.length > 0) {
            this.index++;
            await this.state.storage.put(`arbitrages${this.index}`, slice);
          } else {
            break;
          }
        }

        const arbitrageFailures = events.filter(
          arb => arb.status === 'failure'
        );
        this.arbitrageFailures =
          this.arbitrageFailures.concat(arbitrageFailures);
        slice = this.arbitrageFailures.slice(
          this.indexFailures * this.pageSize,
          (this.indexFailures + 1) * this.pageSize
        );
        await this.state.storage.put(
          `arbitrageFailures${this.indexFailures}`,
          slice
        );
        // eslint-disable-next-line no-constant-condition
        while (true) {
          slice = this.arbitrageFailures.slice(
            (this.indexFailures + 1) * this.pageSize,
            (this.indexFailures + 2) * this.pageSize
          );
          if (slice.length > 0) {
            this.indexFailures++;
            await this.state.storage.put(
              `arbitrageFailures${this.indexFailures}`,
              slice
            );
          } else {
            break;
          }
        }

        return new Response(null, { status: 204 });
      })
      .delete('*', async () => {
        this.arbitrages = [];
        this.index = 0;
        this.arbitrageFailures = [];
        this.indexFailures = 0;
        await this.state.storage.deleteAll();
        return new Response(null, { status: 204 });
      });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}
