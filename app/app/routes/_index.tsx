import type { MetaFunction } from '@remix-run/cloudflare';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import Select from 'react-select';

import { Chart } from '~/components';
import { useBots } from '~/hooks';

export const meta: MetaFunction = () => {
  return [
    { title: 'Arbitrage Statistics on Near' },
    {
      name: 'description',
      content:
        'Provides statistics about all cyclic arbitrage bots on Ref Finance'
    }
  ];
};

const allBots = [
  { value: 'bot.marior.near', label: 'bot.marior.near', color: '#c00' },
  { value: 'bot0.marior.near', label: 'bot0.marior.near', color: '#000' },
  { value: 'bot2.marior.near', label: 'bot2.marior.near', color: '#000' },
  { value: 'bot3.marior.near', label: 'bot3.marior.near', color: '#000' },
  { value: 'bot4.marior.near', label: 'bot4.marior.near', color: '#000' },
  { value: 'bot5.marior.near', label: 'bot5.marior.near', color: '#000' },
  { value: 'bot6.marior.near', label: 'bot6.marior.near', color: '#000' },
  { value: 'aldor.near', label: 'aldor.near', color: '#0c0' },
  { value: 'frisky.near', label: 'frisky.near', color: '#000' },
  { value: 'sneaky1.near', label: 'sneaky1.near', color: '#000' },
  { value: 'kagool.near', label: 'kagool.near', color: '#000' },
  { value: 'zalevsky.near', label: 'zalevsky.near', color: '#000' },
  { value: 'foxboss.near', label: 'foxboss.near', color: '#000' },
  { value: 'xy_k.near', label: 'xy_k.near', color: '#000' },
  { value: 'shitake.near', label: 'shitake.near', color: '#000' }
];

export default function Index() {
  const [botIdValues, setBotIdValues] = useState([allBots[0], allBots[7]]);
  const [startDate, setStartDate] = useState<dayjs.Dayjs>(
    dayjs().subtract(13, 'days')
  );
  const [endDate, setEndDate] = useState<dayjs.Dayjs>(dayjs());

  const botIds = useMemo(
    () => botIdValues.map(({ value }) => value),
    [botIdValues]
  );

  const { chartData, loading } = useBots({
    botIds,
    startDate,
    endDate
  });

  const botData = useMemo(() => {
    return Object.values(chartData ?? {}).map((data, index) => ({
      chartData: data ?? [],
      color: allBots.find(bot => bot.value === botIds[index])?.color ?? ''
    }));
  }, [chartData, botIds]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 max-w-4xl m-auto">
      <h1 className="font-bold text-4xl self-center mb-4">
        Near Arbitrage Statistics
      </h1>
      <Select
        className="w-full z-10"
        options={allBots}
        isMulti
        value={botIdValues}
        onChange={values => {
          setBotIdValues(Array.from(values));
        }}
      />
      <Chart botData={botData} loading={loading}></Chart>
    </div>
  );
}
