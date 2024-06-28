import chroma from 'chroma-js';
import dayjs from 'dayjs';
import { createChart } from 'lightweight-charts';
import { FC, useEffect, useRef, useState } from 'react';

import { BotDatafeed, priceFormatter } from '~/botDatafeed';
import { allBotOwners, allBots } from '~/config';
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
      },
      crosshair: {
        horzLine: {
          visible: false,
          labelVisible: false
        },
        vertLine: {
          labelVisible: false
        }
      }
    });

    const toolTip = document.createElement('div');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (toolTip as any).style =
      `position: absolute; display: none; padding: 8px; box-sizing: border-box; font-size: 12px; text-align: left; z-index: 1000; top: 12px; left: 12px; pointer-events: none; border: 1px solid; border-radius: 2px;font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; flex-direction: column; max-height: 284px; flex-wrap: wrap; gap: 0 0.6rem;`;
    toolTip.style.background = '#eee';
    toolTip.style.color = 'black';
    toolTip.style.borderColor = '#333';
    chartContainerRef.current.appendChild(toolTip);

    // update tooltip
    chart.subscribeCrosshairMove(param => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current!.clientHeight
      ) {
        toolTip.style.display = 'none';
      } else {
        const dateStr = param.time;
        toolTip.style.display = 'flex';

        const format = new Intl.NumberFormat('en-US', {
          compactDisplay: 'short',
          maximumFractionDigits: 2
        }).format;
        let filteredBotIds: string[];
        if (combine) {
          filteredBotIds = Array.from(
            new Set(
              botIds.map(
                botId =>
                  allBotOwners.find(bot => bot.bots.includes(botId))?.value ??
                  botId
              )
            )
          );
        } else {
          filteredBotIds = botIds;
        }
        const innerHTML =
          filteredBotIds
            .sort((botIdA, botIdB) => {
              const dataA = param.seriesData.get(
                series.current[botIdA]
              ) as ChartData;
              const dataB = param.seriesData.get(
                series.current[botIdB]
              ) as ChartData;
              return dataB.value - dataA.value;
            })
            .reduce((html, botId) => {
              const data = param.seriesData.get(
                series.current[botId]
              ) as ChartData;
              const color =
                allBots.find(bot => bot.value === botId)?.color ??
                allBotOwners.find(bot => bot.value === botId)?.color ??
                '#000';
              return (
                html +
                `<div style="border-bottom: 1px dashed gray;"><div style="color: ${color}; font-weight: 600">${botId}</div><div style="font-size: 1.15rem; ">
            ${format(data.value)}
            </div></div>`
              );
            }, '') +
          `<div>
            ${dateStr}
            </div>`;

        toolTip.innerHTML = innerHTML;
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
