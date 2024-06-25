import type { MetaFunction } from '@remix-run/cloudflare';
import chroma from 'chroma-js';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import Select, { StylesConfig } from 'react-select';

import { BotDatafeed } from '~/botDatafeed';
import { Chart } from '~/components';
import { BotOption, allBots } from '~/config';

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
  const [botDatafeed] = useState(new BotDatafeed());
  const [startDate, setStartDate] = useState<dayjs.Dayjs>(
    dayjs().subtract(13, 'days')
  );
  const [endDate, setEndDate] = useState<dayjs.Dayjs>(dayjs());

  const botIds = useMemo(
    () => botIdValues.map(({ value }) => value),
    [botIdValues]
  );

  return (
    <div className="flex flex-col items-center gap-4 p-4 max-w-4xl m-auto">
      <h1 className="font-bold text-4xl self-center mb-4">
        Near Arbitrage Statistics
      </h1>
      <Select
        className="w-full z-20"
        options={allBots}
        styles={styles}
        isMulti
        value={botIdValues}
        onChange={values => {
          setBotIdValues(Array.from(values));
          setStartDate(dayjs().subtract(13, 'days'));
          setEndDate(dayjs());
        }}
        closeMenuOnSelect={false}
      />
      <Chart
        botIds={botIds}
        botDatafeed={botDatafeed}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
      ></Chart>
    </div>
  );
}
