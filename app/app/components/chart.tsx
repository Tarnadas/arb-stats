import dayjs from 'dayjs';
import { createChart } from 'lightweight-charts';
import {
  Dispatch,
  FC,
  SetStateAction,
  useEffect,
  useRef,
  useState
} from 'react';

import { BotDatafeed } from '~/botDatafeed';

export const Chart: FC<{
  botIds: string[];
  botDatafeed: BotDatafeed;
  startDate: dayjs.Dayjs;
  setStartDate: Dispatch<SetStateAction<dayjs.Dayjs>>;
  endDate: dayjs.Dayjs;
  setEndDate: Dispatch<SetStateAction<dayjs.Dayjs>>;
}> = ({
  botIds,
  botDatafeed,
  startDate,
  setStartDate,
  endDate,
  setEndDate
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

    setLoading(true);
    botDatafeed
      .getData({
        botIds,
        startDate,
        endDate
      })
      .then(datafeed => {
        for (const { botId, chartData, color } of datafeed) {
          series.current[botId] = chart.addLineSeries({
            color
          });
          series.current[botId].setData(chartData ?? []);
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
                setStartDate(currentStartDate);
              }
              const endOffset = Math.round(newOffsets[1]);
              if (endOffset > 0) {
                currentEndDate = currentEndDate.add(endOffset, 'days');
                setEndDate(currentEndDate);
              }
              botDatafeed
                .getData({
                  botIds,
                  startDate: currentStartDate,
                  endDate: currentEndDate
                })
                .then(datafeed => {
                  for (const { botId, chartData } of datafeed) {
                    series.current[botId].setData(chartData ?? []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botIds, botDatafeed]);

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
