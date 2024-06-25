import dayjs from 'dayjs';

import { DailyGasStats, DailyProfitStats } from '../../api/src';

import { allBotOwners, allBots } from './config';

import { client } from '~/api';
import { ChartData } from '~/types';

export type DatafeedResponse = {
  botId: string;
  chartData: ChartData[];
  color: string;
}[];

const earliestDate = dayjs.utc('2024-03-16');

export const priceFormatter = (value: number) =>
  `${Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumIntegerDigits: 1
  }).format(value)} NEAR`;

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
    endDate,
    combine
  }: {
    botIds: string[];
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs;
    combine?: boolean;
  }): Promise<DatafeedResponse> {
    if (startDate.isBefore(earliestDate)) {
      startDate = earliestDate.clone();
    }

    const { profits: profitsData, gas: gasData } = await this.updateData({
      botIds,
      startDate,
      endDate,
      combine
    });

    const profits = Object.fromEntries(Object.entries(profitsData));
    const gas = Object.fromEntries(Object.entries(gasData));
    const filteredBotIds = Array.from(
      new Set([...Object.keys(gas), ...Object.keys(profits)])
    );
    const chartData = Object.fromEntries(
      filteredBotIds.map(botId => [
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
      botId: filteredBotIds[index],
      chartData: data ?? [],
      color:
        allBots.find(bot => bot.value === filteredBotIds[index])?.color ??
        allBotOwners.find(bot => bot.value === filteredBotIds[index])?.color ??
        '#000'
    }));
  }

  private async updateData({
    botIds,
    startDate,
    endDate,
    combine
  }: {
    botIds: string[];
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs;
    combine?: boolean;
  }): Promise<{
    profits: Record<string, DailyProfitStats[] | undefined>;
    gas: Record<string, DailyGasStats[] | undefined>;
  }> {
    const now = dayjs.utc();

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

      const profits: Record<string, DailyProfitStats[]> = Object.fromEntries(
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
      if (combine) {
        for (const botOwner of allBotOwners) {
          const bots = botOwner.bots.filter(botId => botIds.includes(botId));
          for (const botId of bots) {
            delete profits[botId];
          }
          if (bots.length > 0) {
            let current = startDate.clone();
            const res = [];
            while (current.isBefore(now) && current.isBefore(endDate)) {
              const currentDate = current.format('YYYY-MM-DD');
              const combinedProfits = bots.reduce(
                (acc, botId) =>
                  acc +
                  (Number(
                    this.profitsCache[botId]?.[currentDate].profitsNear
                  ) ?? 0),
                0
              );
              const value = {
                ...this.profitsCache[bots[0]]![currentDate]
              };
              value.profitsNear = String(combinedProfits);
              res.push(value);
              current = current.add(1, 'day');
            }
            profits[botOwner.value] = res;
          }
        }
      }

      const gas: Record<string, DailyGasStats[]> = Object.fromEntries(
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
      if (combine) {
        for (const botOwner of allBotOwners) {
          const bots = botOwner.bots.filter(botId => botIds.includes(botId));
          for (const botId of bots) {
            delete gas[botId];
          }
          if (bots.length > 0) {
            let current = startDate.clone();
            const res = [];
            while (current.isBefore(now) && current.isBefore(endDate)) {
              const currentDate = current.format('YYYY-MM-DD');
              const combinedNearBurnt = bots.reduce(
                (acc, botId) =>
                  acc +
                  (Number(this.gasCache[botId]?.[currentDate].nearBurnt) ?? 0),
                0
              );
              const value = { ...this.gasCache[bots[0]]![currentDate] };
              value.nearBurnt = String(combinedNearBurnt);
              res.push(value);
              current = current.add(1, 'day');
            }
            gas[botOwner.value] = res;
          }
        }
      }

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
