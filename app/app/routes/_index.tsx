import type { MetaFunction } from '@remix-run/cloudflare';
import chroma from 'chroma-js';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import Select, { StylesConfig } from 'react-select';

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

const marioColor = '#b90000';
const aldorColor = '#0044b9';

const allBots = [
  {
    value: 'bot.marior.near',
    label: 'bot.marior.near',
    color: chroma(marioColor).hex()
  },
  {
    value: 'bot0.marior.near',
    label: 'bot0.marior.near',
    color: chroma(marioColor).desaturate().hex()
  },
  {
    value: 'bot2.marior.near',
    label: 'bot2.marior.near',
    color: chroma(marioColor).darken().hex()
  },
  {
    value: 'bot3.marior.near',
    label: 'bot3.marior.near',
    color: chroma(marioColor).brighten().hex()
  },
  {
    value: 'bot4.marior.near',
    label: 'bot4.marior.near',
    color: chroma(marioColor).desaturate().darken(2).hex()
  },
  {
    value: 'bot5.marior.near',
    label: 'bot5.marior.near',
    color: chroma(marioColor).desaturate().brighten(2).hex()
  },
  {
    value: 'bot6.marior.near',
    label: 'bot6.marior.near',
    color: chroma(marioColor).darken(2).saturate(2).hex()
  },
  { value: 'aldor.near', label: 'aldor.near', color: chroma(aldorColor).hex() },
  {
    value: 'frisky.near',
    label: 'frisky.near',
    color: chroma(aldorColor).darken().hex()
  },
  {
    value: 'sneaky1.near',
    label: 'sneaky1.near',
    color: chroma(aldorColor).brighten().hex()
  },
  {
    value: 'kagool.near',
    label: 'kagool.near',
    color: chroma(aldorColor).desaturate().darken(2).hex()
  },
  {
    value: 'zalevsky.near',
    label: 'zalevsky.near',
    color: chroma(aldorColor).desaturate().brighten(2).hex()
  },
  {
    value: 'shitake.near',
    label: 'shitake.near',
    color: chroma(aldorColor).darken(2).saturate(2).hex()
  },
  {
    value: 'drooling.near',
    label: 'drooling.near',
    color: chroma(aldorColor).darken(2).saturate(2).hex()
  },
  {
    value: 'foxboss.near',
    label: 'foxboss.near',
    color: '#000'
  },
  { value: 'xy_k.near', label: 'xy_k.near', color: '#000' }
];
type BotOption = (typeof allBots)[0];

const styles: StylesConfig<BotOption, true> = {
  control: styles => ({ ...styles, backgroundColor: 'white' }),
  option: (styles, { data, isDisabled, isFocused, isSelected }) => {
    const color = chroma(data.color);
    return {
      ...styles,
      backgroundColor: isDisabled
        ? undefined
        : isSelected
          ? data.color
          : isFocused
            ? color.alpha(0.1).css()
            : undefined,
      color: isDisabled
        ? '#ccc'
        : isSelected
          ? chroma.contrast(color, 'white') > 2
            ? 'white'
            : 'black'
          : data.color,
      cursor: isDisabled ? 'not-allowed' : 'default',

      ':active': {
        ...styles[':active'],
        backgroundColor: !isDisabled
          ? isSelected
            ? data.color
            : color.alpha(0.3).css()
          : undefined
      }
    };
  },
  multiValue: (styles, { data }) => {
    const color = chroma(data.color);
    return {
      ...styles,
      backgroundColor: color.alpha(0.1).css()
    };
  },
  multiValueLabel: (styles, { data }) => ({
    ...styles,
    color: data.color
  }),
  multiValueRemove: (styles, { data }) => ({
    ...styles,
    color: data.color,
    ':hover': {
      backgroundColor: data.color,
      color: 'white'
    }
  })
};

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
        styles={styles}
        isMulti
        value={botIdValues}
        onChange={values => {
          setBotIdValues(Array.from(values));
        }}
        closeMenuOnSelect={false}
      />
      <Chart botData={botData} loading={loading}></Chart>
    </div>
  );
}
