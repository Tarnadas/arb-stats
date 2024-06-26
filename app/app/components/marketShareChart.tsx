import dayjs from 'dayjs';
import { LineType, createChart } from 'lightweight-charts';
import { FC, useEffect, useRef, useState } from 'react';

import { BotDatafeed } from '~/botDatafeed';
import { ChartData } from '~/types';

export const MarketShareChart: FC<{
  botIds: string[];
  botDatafeed: BotDatafeed;
  startDate: dayjs.Dayjs;
  endDate: dayjs.Dayjs;
  combine: boolean;
  movingAverageSize: number;
}> = ({
  botIds,
  botDatafeed,
  startDate,
  endDate,
  combine,
  movingAverageSize
}) => {
  const [loading, setLoading] = useState(false);
  const offsets = useRef<[number, number]>([0, 0]);
  const series = useRef<
    Record<string, ReturnType<ReturnType<typeof createChart>['addLineSeries']>>
  >({});
  const chartContainerRef = useRef<HTMLDivElement>(null);

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
      width: chartContainerRef.current.clientWidth,
      height: 300
    });
    chart.applyOptions({
      localization: {
        priceFormatter: (value: number) =>
          `${Intl.NumberFormat('en-US', {
            maximumFractionDigits: 2,
            minimumIntegerDigits: 1
          }).format(value * 100)}%`
      }
    });

    setLoading(true);
    botDatafeed
      .getData({
        botIds,
        startDate,
        endDate,
        combine
      })
      .then(datafeed => {
        const sumChartData: number[] = [];
        for (const { chartData } of datafeed) {
          chartData.forEach((data, index) => {
            sumChartData[index] = (sumChartData[index] ?? 0) + data.value;
          });
        }
        const currentValues: number[] = [];
        const sumMovingAverageChartData = sumChartData.map(data => {
          currentValues.push(data);
          if (currentValues.length > movingAverageSize) {
            currentValues.splice(0, 1);
          }
          return (
            currentValues.reduce((acc, cur) => acc + cur, 0) /
            currentValues.length
          );
        });
        for (const { botId, chartData, color } of datafeed) {
          series.current[botId] = chart.addLineSeries({
            color,
            title: botId,
            lineType: LineType.Curved
          });
          const currentValues: ChartData[] = [];
          const convertedChartData = chartData.map((data, index) => {
            currentValues.push(data);
            if (currentValues.length > movingAverageSize) {
              currentValues.splice(0, 1);
            }
            return {
              ...data,
              value:
                currentValues.reduce((acc, cur) => acc + cur.value, 0) /
                currentValues.length /
                sumMovingAverageChartData[index]
            };
          });
          series.current[botId].setData(convertedChartData ?? []);
        }
        chart.timeScale().fitContent();
        setLoading(false);

        let firstRenderDone = false;
        let currentStartDate = startDate.clone();
        let currentEndDate = endDate.clone();
        chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRange => {
          if (logicalRange == null) return;
          if (!firstRenderDone) {
            firstRenderDone = true;
          } else {
            const newOffsets = [
              Math.min(Math.round(logicalRange.from), 0),
              Math.max(Math.round(logicalRange.to - 13), 0)
            ] as [number, number];
            if (
              (newOffsets[0] !== 0 || newOffsets[1] !== 0) &&
              (newOffsets[0] < offsets.current[0] ||
                newOffsets[1] > offsets.current[1])
            ) {
              offsets.current = newOffsets;
              const startOffset = Math.round(newOffsets[0]);
              if (startOffset < 0) {
                currentStartDate = currentStartDate.add(startOffset, 'days');
              }
              const endOffset = Math.round(newOffsets[1]);
              if (endOffset > 0) {
                currentEndDate = currentEndDate.add(endOffset, 'days');
              }
              botDatafeed
                .getData({
                  botIds,
                  startDate: currentStartDate,
                  endDate: currentEndDate,
                  combine
                })
                .then(datafeed => {
                  const sumChartData: number[] = [];
                  for (const { chartData } of datafeed) {
                    chartData.forEach((data, index) => {
                      sumChartData[index] =
                        (sumChartData[index] ?? 0) + data.value;
                    });
                  }
                  const currentValues: number[] = [];
                  const sumMovingAverageChartData = sumChartData.map(data => {
                    currentValues.push(data);
                    if (currentValues.length > movingAverageSize) {
                      currentValues.splice(0, 1);
                    }
                    return (
                      currentValues.reduce((acc, cur) => acc + cur, 0) /
                      currentValues.length
                    );
                  });
                  for (const { botId, chartData } of datafeed) {
                    const currentValues: ChartData[] = [];
                    const convertedChartData = chartData.map((data, index) => {
                      currentValues.push(data);
                      if (currentValues.length > movingAverageSize) {
                        currentValues.splice(0, 1);
                      }
                      return {
                        ...data,
                        value:
                          currentValues.reduce(
                            (acc, cur) => acc + cur.value,
                            0
                          ) /
                          currentValues.length /
                          sumMovingAverageChartData[index]
                      };
                    });
                    series.current[botId].setData(convertedChartData ?? []);
                  }

                  offsets.current = [0, 0];
                });
            }
          }
        });
      });

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);

      chart.remove();
    };
  }, [botIds, botDatafeed, startDate, endDate, combine, movingAverageSize]);

  return (
    <>
      <div className="w-full relative" ref={chartContainerRef}>
        {loading && (
          <div className="absolute w-full h-full top-0 z-10">
            <div className="w-full h-full flex items-center justify-center">
              <div className="loading loading-spinner loading-lg" />
            </div>
          </div>
        )}
      </div>
    </>
  );
};
