import dayjs from 'dayjs';
import {
  createChart,
  LineData,
  Time,
  WhitespaceData
} from 'lightweight-charts';
import { FC, useEffect, useRef, useState } from 'react';

import { DailyProfitStats } from '../../../api/src';

import { client } from '~/api';

type ChartData = LineData<Time> | WhitespaceData<Time>;

export const Chart: FC = () => {
  const [data, setData] = useState<ChartData[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const run = async () => {
      let startDate = dayjs('2024-03-16');
      const now = dayjs();

      const promises = [];
      while (startDate.isBefore(now)) {
        promises.push(
          new Promise<DailyProfitStats[]>((resolve, reject) => {
            client
              .GET('/bots/{bot_id}/daily/profit', {
                params: {
                  path: {
                    bot_id: 'bot.marior.near'
                  },
                  query: {
                    startDate: startDate.format('YYYY-MM-DD'),
                    endDate: startDate.add(6, 'days').format('YYYY-MM-DD')
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
        startDate = startDate.add(7, 'days');
      }

      const profitsData = (await Promise.all(promises)).flat();

      setData(
        profitsData.map(
          ({ date, profitsNear }) =>
            ({ time: date, value: Number(profitsNear) }) satisfies ChartData
        )
      );
    };
    run();
  }, []);

  useEffect(() => {
    if (chartContainerRef.current == null) {
      return;
    }

    const handleResize = () => {
      if (chartContainerRef.current == null) {
        return;
      }
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      // layout: {
      //   background: { type: ColorType.Solid, color: backgroundColor },
      //   textColor
      // },
      width: chartContainerRef.current.clientWidth,
      height: 300
    });
    chart.timeScale().fitContent();

    const newSeries = chart.addLineSeries({
      // lineColor,
      // topColor: areaTopColor,
      // bottomColor: areaBottomColor
    });
    newSeries.setData(data);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);

      chart.remove();
    };
  }, [
    data
    // backgroundColor,
    // lineColor,
    // textColor,
    // areaTopColor,
    // areaBottomColor
  ]);

  return <div ref={chartContainerRef} />;
};
