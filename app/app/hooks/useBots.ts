import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { DailyGasStats, DailyProfitStats } from '../../../api/src';

import { client } from '~/api';
import { ChartData } from '~/types';

export const useBots = ({
  botIds,
  startDate,
  endDate
}: {
  botIds: string[];
  startDate: dayjs.Dayjs;
  endDate: dayjs.Dayjs;
}): {
  profits: {
    [k: string]: DailyProfitStats[] | undefined;
  };
  gas: {
    [k: string]: DailyGasStats[] | undefined;
  };
  chartData: {
    [k: string]: ChartData[] | undefined;
  };
  loading: boolean;
} => {
  const [profits, setProfits] = useState<
    Record<string, DailyProfitStats[] | undefined>
  >({});
  const [gas, setGas] = useState<Record<string, DailyGasStats[] | undefined>>(
    {}
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = dayjs();
    const run = async () => {
      setLoading(true);

      const profitsPromise = Promise.all(
        botIds.map(botId => {
          if (profits[botId] == null) {
            profits[botId] = [];
          }

          const promises: Promise<DailyProfitStats[]>[] = [];
          let from = startDate;
          let until = endDate;
          if (startDate.add(6, 'days').isBefore(until)) {
            until = startDate.add(6, 'days');
          }
          while (from.isBefore(now) && from.isBefore(endDate)) {
            promises.push(
              new Promise<DailyProfitStats[]>((resolve, reject) => {
                client
                  .GET('/bots/{bot_id}/daily/profit', {
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
                  })
                  .then(res => {
                    if (res.error != null) {
                      reject(res.error);
                      return;
                    }
                    resolve(res.data);
                  });
              })
            );
            from = from.add(7, 'days');
            until = from.add(6, 'days');
          }
          return Promise.all(promises).then(
            res => [botId, res.flat()] as const
          );
        })
      ).then(newProfits => {
        setProfits(Object.fromEntries(newProfits));
      });

      const gasPromise = Promise.all(
        botIds.map(botId => {
          if (profits[botId] == null) {
            profits[botId] = [];
          }

          const promises: Promise<DailyGasStats[]>[] = [];
          let from = startDate;
          let until = endDate;
          if (startDate.add(6, 'days').isBefore(until)) {
            until = startDate.add(6, 'days');
          }
          while (from.isBefore(now) && from.isBefore(endDate)) {
            promises.push(
              new Promise<DailyGasStats[]>((resolve, reject) => {
                client
                  .GET('/bots/{bot_id}/daily/gas', {
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
                  })
                  .then(res => {
                    if (res.error != null) {
                      reject(res.error);
                      return;
                    }
                    resolve(res.data);
                  });
              })
            );
            from = from.add(7, 'days');
            until = from.add(6, 'days');
          }
          return Promise.all(promises).then(
            res => [botId, res.flat()] as const
          );
        })
      ).then(newGas => {
        setGas(Object.fromEntries(newGas));
      });

      try {
        await profitsPromise;
        await gasPromise;
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botIds, startDate, endDate]);

  return {
    profits: Object.fromEntries(
      Object.entries(profits).filter(([botId]) => botIds.includes(botId))
    ),
    gas: Object.fromEntries(
      Object.entries(gas).filter(([botId]) => botIds.includes(botId))
    ),
    chartData: Object.fromEntries(
      botIds.map(botId => [
        botId,
        gas[botId]?.map(({ date, nearBurnt }, index) => ({
          time: date,
          value:
            Number(profits[botId]?.[index]?.profitsNear ?? 0) -
            Number(nearBurnt)
        })) ?? []
      ])
    ),
    loading
  };
};
