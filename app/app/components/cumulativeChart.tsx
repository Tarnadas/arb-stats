import chroma from 'chroma-js';
import dayjs from 'dayjs';
import { createChart } from 'lightweight-charts';
import { FC, useEffect, useRef, useState } from 'react';

import { BotDatafeed, priceFormatter } from '~/botDatafeed';
import { ChartData } from '~/types';

export const CumulativeChart: FC<{
  botIds: string[];
  botDatafeed: BotDatafeed;
  startDate: dayjs.Dayjs;
  endDate: dayjs.Dayjs;
  combine: boolean;
}> = ({ botIds, botDatafeed, startDate, endDate, combine }) => {
  const [loading, setLoading] = useState(false);
  const offsets = useRef<[number, number]>([0, 0]);
  const series = useRef<
    Record<string, ReturnType<ReturnType<typeof createChart>['addAreaSeries']>>
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
        priceFormatter
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
        for (const { botId, chartData, color } of datafeed) {
          series.current[botId] = chart.addAreaSeries({
            lineColor: color,
            topColor: chroma(color).alpha(0.4).hex(),
            bottomColor: chroma(color).alpha(0).hex(),
            title: botId
          });
          const convertedChartData: ChartData[] = [];
          let cumulated = 0;
          let index = 0;
          for (const data of chartData) {
            cumulated += data.value;
            convertedChartData[index++] = {
              value: cumulated,
              time: data.time
            };
          }
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
                  for (const { botId, chartData } of datafeed) {
                    const convertedChartData: ChartData[] = [];
                    let cumulated = 0;
                    let index = 0;
                    for (const data of chartData) {
                      cumulated += data.value;
                      convertedChartData[index++] = {
                        value: cumulated,
                        time: data.time
                      };
                    }
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
  }, [botIds, botDatafeed, startDate, endDate, combine]);

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
