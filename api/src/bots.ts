import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { FixedNumber } from '@tarnadas/fixed-number';
import dayjs from 'dayjs';
import { Hono } from 'hono';

import { Arbitrage, zArbitrage } from './events';

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
  'xy_k.near',
  'shitake.near'
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
          startDate: z.string().date().optional().openapi({
            description: 'format: `YYYY-MM-DD`',
            example: '2024-04-15'
          }),
          endDate: z.string().date().optional().openapi({
            description: 'format: `YYYY-MM-DD`',
            example: '2024-04-22'
          })
        })
      },
      responses: {
        200: {
          description: 'daily arbitrage statistics',
          content: {
            'application/json': {
              schema: zDailyProfitStats.array()
            }
          }
        },
        400: {
          description: '`startDate` and `endDate` are invalid',
          content: {
            'text/plain': {
              schema: z.string()
            }
          }
        },
        404: {
          description: 'No data available'
        },
        500: {
          description: 'Unexpected server error'
        }
      }
    }),
    async c => {
      const botId = c.req.param('bot_id');
      const addr = c.env.BOTS.idFromName(botId);
      const obj = c.env.BOTS.get(addr);
      const { startDate: startDateStr, endDate: endDateStr } = c.req.query();
      let startDate: dayjs.Dayjs | undefined;
      if (startDateStr) {
        startDate = dayjs.utc(startDateStr);
      }
      let endDate: dayjs.Dayjs | undefined;
      if (endDateStr) {
        endDate = dayjs.utc(endDateStr);
      } else if (startDate != null) {
        endDate = startDate.add(7, 'days');
      }
      if (startDate == null && endDate != null) {
        startDate = endDate.subtract(7, 'days');
      }
      if (startDate != null && endDate != null) {
        if (startDate.isAfter(endDate)) {
          return c.text('`startDate` is after `endDate`', 400);
        }
        if (startDate.diff(endDate, 'day') >= 7) {
          return c.text('can only fetch at most 7 days', 400);
        }
      }

      const res = await obj.fetch(
        `${new URL(c.req.url).origin}/daily/profit?startDate=${startDateStr ?? ''}&endDate=${endDateStr ?? ''}`
      );
      if (res.status === 404) {
        return c.text('No data available', 404);
      } else if (res.status === 500) {
        return c.text('Unexpected server error', 500);
      }
      const arbs = await res.json<DailyProfitStats[]>();
      return c.json(arbs);
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
        startDate: z.string().date().optional().openapi({
          description: 'format: `YYYY-MM-DD`',
          example: '2024-04-15'
        }),
        endDate: z.string().date().optional().openapi({
          description: 'format: `YYYY-MM-DD`',
          example: '2024-04-22'
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
        },
        400: {
          description: '`startDate` and `endDate` are invalid',
          content: {
            'text/plain': {
              schema: z.string()
            }
          }
        },
        404: {
          description: 'No data available'
        },
        500: {
          description: 'Unexpected server error'
        }
      }
    }),
    async c => {
      const botId = c.req.param('bot_id');
      const addr = c.env.BOTS.idFromName(botId);
      const obj = c.env.BOTS.get(addr);
      const { startDate: startDateStr, endDate: endDateStr } = c.req.query();
      let startDate: dayjs.Dayjs | undefined;
      if (startDateStr) {
        startDate = dayjs.utc(startDateStr);
      }
      let endDate: dayjs.Dayjs | undefined;
      if (endDateStr) {
        endDate = dayjs.utc(endDateStr);
      } else if (startDate != null) {
        endDate = startDate.add(7, 'days');
      }
      if (startDate == null && endDate != null) {
        startDate = endDate.subtract(7, 'days');
      }
      if (startDate != null && endDate != null) {
        if (startDate.isAfter(endDate)) {
          return c.text('`startDate` is after `endDate`', 400);
        }
        if (startDate.diff(endDate, 'day') >= 7) {
          return c.text('can only fetch at most 7 days', 400);
        }
      }

      const res = await obj.fetch(
        `${new URL(c.req.url).origin}/daily/gas?startDate=${startDateStr ?? ''}&endDate=${endDateStr ?? ''}`
      );
      if (res.status === 404) {
        return c.text('No data available', 404);
      } else if (res.status === 500) {
        return c.text('Unexpected server error', 500);
      }
      const arbs = await res.json<DailyGasStats[]>();
      return c.json(arbs);
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
          date: z.string().date()
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
      const { date: dateStr, status } = c.req.query();
      const res = await obj.fetch(
        `${new URL(c.req.url).origin}?date=${dateStr}&status=${status || 'success'}`
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

  private currentDate?: string;
  private arbitrages: Record<string, Arbitrage[] | undefined>;
  private arbitrageFailures: Record<string, Arbitrage[] | undefined>;

  private dailyProfitsCache: Record<string, DailyProfitStats> = {};
  private dailyGasCache: Record<string, DailyGasStats> = {};

  constructor(state: DurableObjectState) {
    this.state = state;
    this.arbitrages = {};
    this.arbitrageFailures = {};
    this.state.blockConcurrencyWhile(async () => {
      this.currentDate = await this.state.storage.get('currentDate');
    });

    this.app = new Hono();
    this.app
      .get('/daily/profit', async c => {
        if (this.currentDate == null) {
          return new Response(null, { status: 404 });
        }

        const { startDate: startDateStr, endDate: endDateStr } = c.req.query();
        let endDate: dayjs.Dayjs;
        if (endDateStr) {
          endDate = dayjs.utc(endDateStr).add(1, 'day');
        } else {
          endDate = dayjs.utc(this.currentDate).add(1, 'day');
        }
        let date: dayjs.Dayjs;
        if (startDateStr) {
          date = dayjs.utc(startDateStr);
        } else {
          date = endDate.subtract(7, 'days');
        }

        const stats: DailyProfitStats[] = [];
        for (; date.isBefore(endDate); date = date.add(1, 'day')) {
          const formattedDate = date.format('YYYY-MM-DD');
          let profits = 0n;
          const arbs = await this.lazyLoadArbDate(date);
          for (const arb of arbs) {
            if (arb.status === 'success') {
              profits += BigInt(arb.profit);
            }
          }
          const arbStats = {
            date: formattedDate,
            from: date.valueOf(),
            to: date.endOf('day').valueOf(),
            profits: profits.toString(),
            profitsNear: new FixedNumber(profits, 24).format({
              maximumFractionDigits: 3
            })
          };
          if (this.currentDate !== formattedDate) {
            this.dailyProfitsCache[formattedDate] = arbStats;
          }
          stats.push(arbStats);
        }

        return c.json(stats);
      })
      .get('/daily/gas', async c => {
        if (this.currentDate == null) {
          return new Response(null, { status: 404 });
        }

        const { startDate: startDateStr, endDate: endDateStr } = c.req.query();
        let endDate: dayjs.Dayjs;
        if (endDateStr) {
          endDate = dayjs.utc(endDateStr).add(1, 'day');
        } else {
          endDate = dayjs.utc(this.currentDate).add(1, 'day');
        }
        let date: dayjs.Dayjs;
        if (startDateStr) {
          date = dayjs.utc(startDateStr);
        } else {
          date = endDate.subtract(7, 'days');
        }

        const stats: DailyGasStats[] = [];
        for (; date.isBefore(endDate); date = date.add(1, 'day')) {
          const formattedDate = date.format('YYYY-MM-DD');
          let gasBurnt = 0n;
          const arbs = await this.lazyLoadArbDate(date);
          for (const arb of arbs) {
            gasBurnt += BigInt(arb.gasBurnt);
          }
          const arbFailures = await this.lazyLoadArbFailureDate(date);
          for (const arb of arbFailures) {
            gasBurnt += BigInt(arb.gasBurnt);
          }
          const arbStats = {
            date: formattedDate,
            from: date.valueOf(),
            to: date.endOf('day').valueOf(),
            gasBurnt: gasBurnt.toString(),
            nearBurnt: new FixedNumber(gasBurnt, 16).format({
              maximumFractionDigits: 5
            })
          } satisfies DailyGasStats;
          if (this.currentDate !== formattedDate) {
            this.dailyGasCache[formattedDate] = arbStats;
          }
          stats.push(arbStats);
        }

        return c.json(stats);
      })
      .get('*', async c => {
        if (this.currentDate == null) {
          return new Response(null, { status: 404 });
        }

        const { date: dateStr, status } = c.req.query();
        const date = dayjs.utc(dateStr);

        if (status === 'failure') {
          const arbs = await this.lazyLoadArbFailureDate(date);
          return c.json(arbs);
        } else {
          const arbs = await this.lazyLoadArbDate(date);
          return c.json(arbs);
        }
      })
      .post('*', async c => {
        const events = await c.req.json<Arbitrage[]>();

        const arbitrageSuccesses = events.filter(
          arb => arb.status === 'success'
        );
        let dates = new Set<string>();
        for (const arb of arbitrageSuccesses) {
          const date = dayjs.utc(arb.timestamp / 1_000_000);
          this.currentDate = date.format('YYYY-MM-DD');
          if (this.arbitrages[this.currentDate] == null) {
            this.arbitrages[this.currentDate] =
              await this.lazyLoadArbDate(date);
          }
          this.arbitrages[this.currentDate]!.push(arb);
          dates.add(this.currentDate);
        }
        await Promise.all(
          Array.from(dates).map(date =>
            this.storeArbs(this.arbitrages[date]!, dayjs.utc(date))
          )
        );

        const arbitrageFailures = events.filter(
          arb => arb.status === 'failure'
        );
        dates = new Set<string>();
        for (const arb of arbitrageFailures) {
          const date = dayjs.utc(arb.timestamp / 1_000_000);
          this.currentDate = date.format('YYYY-MM-DD');
          if (this.arbitrageFailures[this.currentDate] == null) {
            this.arbitrageFailures[this.currentDate] =
              await this.lazyLoadArbFailureDate(date);
          }
          this.arbitrageFailures[this.currentDate]!.push(arb);
          dates.add(this.currentDate);
        }
        await Promise.all(
          Array.from(dates).map(date =>
            this.storeArbFailures(
              this.arbitrageFailures[date]!,
              dayjs.utc(date)
            )
          )
        );

        await this.state.storage.put('currentDate', this.currentDate);

        return new Response(null, { status: 204 });
      })
      .delete('*', async () => {
        this.currentDate = undefined;
        this.arbitrages = {};
        this.arbitrageFailures = {};
        this.dailyProfitsCache = {};
        this.dailyGasCache = {};
        await this.state.storage.deleteAll();
        return new Response(null, { status: 204 });
      });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }

  private async lazyLoadArbDate(date: dayjs.Dayjs): Promise<Arbitrage[]> {
    const formattedDate = date.format('YYYY-MM-DD');
    if (this.arbitrages[formattedDate] == null) {
      this.arbitrages[formattedDate] = (
        await Promise.all(
          [...Array(24).keys()].map(
            h =>
              new Promise<Arbitrage[]>((resolve, reject) =>
                this.state.storage
                  .get<Uint8Array>(
                    `arbitrages_${date.format('YYYY-MM-DD')}-${h.toString().padStart(2, '00')}`
                  )
                  .then(async hourlyArbs => {
                    if (hourlyArbs != null) {
                      const blob = new Blob([hourlyArbs]);
                      const res = blob
                        .stream()
                        .pipeThrough(new DecompressionStream('gzip'));
                      return new Response(res).json<Arbitrage[]>();
                    }
                    return [];
                  })
                  .then(arbs => resolve(arbs))
                  .catch(err => reject(err))
              )
          )
        )
      ).flat();
    }
    return this.arbitrages[formattedDate]!;
  }

  private async storeArbs(arbs: Arbitrage[], date: dayjs.Dayjs): Promise<void> {
    const encoder = new TextEncoder();
    const startDate = date.startOf('day');

    await Promise.all(
      [...Array(24).keys()].map(
        h =>
          new Promise<void>((resolve, reject) => {
            const hourlyDate = startDate
              .add(h, 'hours')
              .format('YYYY-MM-DD-HH');
            const hourlyArbs = arbs.filter(
              arb =>
                dayjs.utc(arb.timestamp / 1_000_000).format('YYYY-MM-DD-HH') ===
                hourlyDate
            );
            if (hourlyArbs.length === 0) {
              resolve();
              return;
            }
            const blob = new Blob([encoder.encode(JSON.stringify(hourlyArbs))]);
            return new Response(
              blob.stream().pipeThrough(new CompressionStream('gzip'))
            )
              .arrayBuffer()
              .then((buffer: ArrayBuffer) => {
                const data = new Uint8Array(buffer);
                return this.state.storage.put(`arbitrages_${hourlyDate}`, data);
              })
              .then(resolve)
              .catch(reject);
          })
      )
    );
  }

  private async lazyLoadArbFailureDate(
    date: dayjs.Dayjs
  ): Promise<Arbitrage[]> {
    const formattedDate = date.format('YYYY-MM-DD');
    if (this.arbitrageFailures[formattedDate] == null) {
      this.arbitrageFailures[formattedDate] = (
        await Promise.all(
          [...Array(24).keys()].map(
            h =>
              new Promise<Arbitrage[]>((resolve, reject) =>
                this.state.storage
                  .get<Uint8Array>(
                    `arbitrageFailures_${date.format('YYYY-MM-DD')}-${h.toString().padStart(2, '00')}`
                  )
                  .then(async hourlyArbs => {
                    if (hourlyArbs != null) {
                      const blob = new Blob([hourlyArbs]);
                      const res = blob
                        .stream()
                        .pipeThrough(new DecompressionStream('gzip'));
                      return new Response(res).json<Arbitrage[]>();
                    }
                    return [];
                  })
                  .then(arbs => resolve(arbs))
                  .catch(err => reject(err))
              )
          )
        )
      ).flat();
    }
    return this.arbitrageFailures[formattedDate]!;
  }

  private async storeArbFailures(
    arbs: Arbitrage[],
    date: dayjs.Dayjs
  ): Promise<void> {
    const encoder = new TextEncoder();
    const startDate = date.startOf('day');

    await Promise.all(
      [...Array(24).keys()].map(
        h =>
          new Promise<void>((resolve, reject) => {
            const hourlyDate = startDate
              .add(h, 'hours')
              .format('YYYY-MM-DD-HH');
            const hourlyArbs = arbs.filter(
              arb =>
                dayjs.utc(arb.timestamp / 1_000_000).format('YYYY-MM-DD-HH') ===
                hourlyDate
            );
            if (hourlyArbs.length === 0) {
              resolve();
              return;
            }
            const blob = new Blob([encoder.encode(JSON.stringify(hourlyArbs))]);
            return new Response(
              blob.stream().pipeThrough(new CompressionStream('gzip'))
            )
              .arrayBuffer()
              .then((buffer: ArrayBuffer) => {
                const data = new Uint8Array(buffer);
                return this.state.storage.put(
                  `arbitrageFailures_${hourlyDate}`,
                  data
                );
              })
              .then(resolve)
              .catch(reject);
          })
      )
    );
  }
}
