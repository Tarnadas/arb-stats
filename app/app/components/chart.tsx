import { createChart } from 'lightweight-charts';
import { FC, useEffect, useRef } from 'react';

import { ChartData } from '~/types';

export const Chart: FC<{
  botData: {
    chartData: ChartData[];
    color: string;
  }[];
  loading: boolean;
}> = ({ botData, loading }) => {
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
      // layout: {
      //   background: { type: ColorType.Solid, color: backgroundColor },
      //   textColor
      // },
      width: chartContainerRef.current.clientWidth,
      height: 300
    });
    chart.timeScale().fitContent();

    for (const { chartData, color } of botData) {
      const newSeries = chart.addLineSeries({
        color
        // topColor: areaTopColor,
        // bottomColor: areaBottomColor
      });
      newSeries.setData(chartData ?? []);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);

      chart.remove();
    };
  }, [
    botData
    // backgroundColor,
    // lineColor,
    // textColor,
    // areaTopColor,
    // areaBottomColor
  ]);

  if (loading) {
    return <div className="loading loading-spinner loading-lg" />;
  }

  return <div className="w-full" ref={chartContainerRef} />;
};
