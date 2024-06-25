import dayjs from 'dayjs';

import { DailyGasStats, DailyProfitStats } from '../../api/src';

import { allBots } from './config';

import { client } from '~/api';
import { ChartData } from '~/types';

export type DatafeedResponse = {
  botId: string;
  chartData: ChartData[];
  color: string;
}[];

const earliestDate = dayjs('2024-04-16');

export class BotDatafeed {
  private profitsCache: Record<
    string,
    Record<string, DailyProfitStats> | undefined
  > = {};
  private profitsCacheBoundaries: Record<string, dayjs.Dayjs | undefined> = {};
  private gasCache: Record<string, Record<string, DailyGasStats> | undefined> =
    {};
  private gasCacheBoundaries: Record<string, dayjs.Dayjs | undefined> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fetchCache: Record<string, Promise<any>> = {};

  public async getData({
    botIds,
    startDate,
    endDate
  }: {
    botIds: string[];
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs;
  }): Promise<DatafeedResponse> {
    if (startDate.isBefore(earliestDate)) {
      startDate = earliestDate.clone();
    }

    const { profits: profitsData, gas: gasData } = await this.updateData({
      botIds,
      startDate,
      endDate
    });

    const profits = Object.fromEntries(
      Object.entries(profitsData).filter(([botId]) => botIds.includes(botId))
    );
    const gas = Object.fromEntries(
      Object.entries(gasData).filter(([botId]) => botIds.includes(botId))
    );
    const chartData = Object.fromEntries(
      botIds.map(botId => [
        botId,
        gas[botId]?.map(({ date, nearBurnt }, index) => ({
          time: date,
          value:
            Number(profits[botId]?.[index]?.profitsNear ?? 0) -
            Number(nearBurnt)
        })) ?? []
      ])
    );

    return Object.values(chartData ?? {}).map((data, index) => ({
      botId: botIds[index],
      chartData: data ?? [],
      color: allBots.find(bot => bot.value === botIds[index])?.color ?? ''
    }));
  }

  private async updateData({
    botIds,
    startDate,
    endDate
  }: {
    botIds: string[];
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs;
  }): Promise<{
    profits: Record<string, DailyProfitStats[] | undefined>;
    gas: Record<string, DailyGasStats[] | undefined>;
  }> {
    const now = dayjs();

    const profitsPromise = Promise.all(
      botIds.map(botId => {
        if (this.profitsCache[botId] == null) {
          this.profitsCache[botId] = {};
        }

        const promises: Promise<void>[] = [];
        let from = startDate;
        if (this.profitsCacheBoundaries[botId] != null) {
          if (this.profitsCacheBoundaries[botId]?.isBefore(startDate)) {
            return Promise.resolve();
          }
          while (startDate.isBefore(this.profitsCacheBoundaries[botId])) {
            from = this.profitsCacheBoundaries[botId]!.subtract(7, 'days');
            this.profitsCacheBoundaries[botId] = from;
          }
        }
        this.profitsCacheBoundaries[botId] = from;
        let until = endDate;
        if (from.add(6, 'days').isBefore(until)) {
          until = from.add(6, 'days');
        }

        while (from.isBefore(now) && from.isBefore(endDate)) {
          promises.push(
            new Promise<void>((resolve, reject) => {
              const cacheKey = `/bots/${botId}/daily/profit?startDate=${from.format('YYYY-MM-DD')}&endDate=${until.format('YYYY-MM-DD')}`;
              if (this.fetchCache[cacheKey] != null) {
                this.fetchCache[cacheKey].then(resolve);
                return;
              }
              const fetch = client.GET('/bots/{bot_id}/daily/profit', {
                params: {
                  path: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    bot_id: botId as any
                  },
                  query: {
                    startDate: from.format('YYYY-MM-DD'),
                    endDate: until.format('YYYY-MM-DD')
                  }
                }
              });
              this.fetchCache[cacheKey] = fetch;
              fetch.then(res => {
                if (res.error != null) {
                  reject(res.error);
                  return;
                }
                for (const data of res.data) {
                  this.profitsCache[botId]![data.date] = data;
                }
                resolve();
              });
            })
          );
          from = from.add(7, 'days');
          until = from.add(6, 'days');
        }
        return Promise.all(promises);
      })
    );

    const gasPromise = Promise.all(
      botIds.map(botId => {
        if (this.gasCache[botId] == null) {
          this.gasCache[botId] = {};
        }

        const promises: Promise<void>[] = [];
        let from = startDate;
        if (this.gasCacheBoundaries[botId] != null) {
          if (this.gasCacheBoundaries[botId]?.isBefore(startDate)) {
            return Promise.resolve();
          }
          while (startDate.isBefore(this.gasCacheBoundaries[botId])) {
            from = this.gasCacheBoundaries[botId]!.subtract(7, 'days');
            this.gasCacheBoundaries[botId] = from;
          }
        }
        this.gasCacheBoundaries[botId] = from;
        let until = endDate;
        if (from.add(6, 'days').isBefore(until)) {
          until = from.add(6, 'days');
        }

        while (from.isBefore(now) && from.isBefore(endDate)) {
          promises.push(
            new Promise<void>((resolve, reject) => {
              const cacheKey = `/bots/${botId}/daily/gas?startDate=${from.format('YYYY-MM-DD')}&endDate=${until.format('YYYY-MM-DD')}`;
              if (this.fetchCache[cacheKey] != null) {
                this.fetchCache[cacheKey].then(resolve);
                return;
              }
              const fetch = client.GET('/bots/{bot_id}/daily/gas', {
                params: {
                  path: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    bot_id: botId as any
                  },
                  query: {
                    startDate: from.format('YYYY-MM-DD'),
                    endDate: until.format('YYYY-MM-DD')
                  }
                }
              });
              this.fetchCache[cacheKey] = fetch;
              fetch.then(res => {
                if (res.error != null) {
                  reject(res.error);
                  return;
                }
                for (const data of res.data) {
                  this.gasCache[botId]![data.date] = data;
                }
                resolve();
              });
            })
          );
          from = from.add(7, 'days');
          until = from.add(6, 'days');
        }
        return Promise.all(promises);
      })
    );

    try {
      await profitsPromise;
      await gasPromise;

      const profits = Object.fromEntries(
        botIds.map(botId => {
          let current = startDate.clone();
          const res = [];
          while (current.isBefore(now) && current.isBefore(endDate)) {
            const currentDate = current.format('YYYY-MM-DD');
            res.push(this.profitsCache[botId]![currentDate]);
            current = current.add(1, 'day');
          }
          return [botId, res] as const;
        })
      );

      const gas = Object.fromEntries(
        botIds.map(botId => {
          let current = startDate.clone();
          const res = [];
          while (current.isBefore(now) && current.isBefore(endDate)) {
            const currentDate = current.format('YYYY-MM-DD');
            res.push(this.gasCache[botId]![currentDate]);
            current = current.add(1, 'day');
          }
          return [botId, res] as const;
        })
      );

      return { profits, gas };
    } catch (err) {
      console.error(err);
      return {
        profits: {},
        gas: {}
      };
    }
  }
}
