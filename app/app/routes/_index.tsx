import type { MetaFunction } from '@remix-run/cloudflare';
import chroma from 'chroma-js';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import Select, { StylesConfig } from 'react-select';

import { BotDatafeed } from '~/botDatafeed';
import { DailyChart } from '~/components';
import { CumulativeChart } from '~/components/cumulativeChart';
import { MarketShareChart } from '~/components/marketShareChart';
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
    dayjs.utc().subtract(13, 'days')
  );
  const [endDate, setEndDate] = useState<dayjs.Dayjs>(dayjs.utc());
  const [combine, setCombine] = useState(false);
  const [movingAverageSize, setMovingAverageSize] = useState(3);

  const botIds = useMemo(
    () => botIdValues.map(({ value }) => value),
    [botIdValues]
  );

  return (
    <div className="flex flex-col items-center gap-6 p-4 max-w-4xl m-auto">
      <h1 className="font-bold text-4xl self-center mb-4">
        Near Arbitrage Statistics
      </h1>

      <div className="collapse bg-base-200 text-white">
        <input type="checkbox" />
        <div className="collapse-title text-xl font-medium">
          This dashboard provides statistics about all cyclic arbitrage bots on
          Ref Finance. Click for more info
        </div>
        <div className="collapse-content flex flex-col gap-3 text-md">
          <p>
            Cyclic arbitrage works by finding a route through a single DEX with
            the same input and output token. On Near Protocol this is generally
            done by finding a route with wNEAR as input and output token. There
            is an arbitrage opportunity, if the amount of output tokens is
            higher than the amount of input tokens + gas fees. Arbitrage bots
            are scanning all pools on Ref Finance to find such a potential
            route.
          </p>
          <p>
            Arbitrage bots are developed by individuals and it&apos;s basically
            impossible to share revenue. If you see someone trying to let you
            invest into arbitrage trading, then it&apos;s 100% a scam.
          </p>
          <p>
            This dashboard is hosted on a Shitzu subdomain, but there is no
            affiliation or revenue share planned.
          </p>
        </div>
      </div>

      <Select
        className="w-full z-20"
        options={allBots}
        styles={styles}
        isMulti
        value={botIdValues}
        onChange={values => {
          setBotIdValues(Array.from(values));
          setStartDate(dayjs.utc().subtract(13, 'days'));
          setEndDate(dayjs.utc());
        }}
        closeMenuOnSelect={false}
      />
      <label className="swap text-xl self-start">
        <input
          type="checkbox"
          checked={combine}
          onChange={value => {
            setCombine(value.target.checked);
          }}
        />

        <div className="swap-on">👨 Combine bots to common owner</div>
        <div className="swap-off">🤖 Display bots individually</div>
      </label>
      <label className="swap text-xl self-start">
        <input
          type="checkbox"
          onClick={() => {
            if (botIds.length === allBots.length) {
              setBotIdValues([]);
            } else {
              setBotIdValues(allBots);
            }
          }}
        />

        <div>
          {botIds.length === allBots.length
            ? '👪'
            : botIds.length === 0
              ? '🫥'
              : '⚪️'}{' '}
          Toggle all
        </div>
      </label>

      <div className="flex flex-col gap-2 items-stretch w-full mb-2">
        <h2 className="font-bold text-3xl self-center">Daily Revenue</h2>
        <DailyChart
          botIds={botIds}
          botDatafeed={botDatafeed}
          startDate={startDate}
          endDate={endDate}
          combine={combine}
        />
      </div>
      <div className="flex flex-col gap-2 items-stretch w-full mb-2">
        <h2 className="font-bold text-3xl self-center">Cumulative Revenue</h2>
        <CumulativeChart
          botIds={botIds}
          botDatafeed={botDatafeed}
          startDate={startDate}
          endDate={endDate}
          combine={combine}
        />
      </div>
      <div className="flex flex-col gap-2 items-stretch w-full mb-2">
        <h2 className="font-bold text-3xl self-center">
          Moving Average Market Share
        </h2>
        <div className="join">
          <button
            className={`join-item btn ${movingAverageSize === 3 ? 'btn-active' : ''}`}
            onClick={() => setMovingAverageSize(3)}
          >
            3d
          </button>
          <button
            className={`join-item btn ${movingAverageSize === 7 ? 'btn-active' : ''}`}
            onClick={() => setMovingAverageSize(7)}
          >
            1w
          </button>
          <button
            className={`join-item btn ${movingAverageSize === 14 ? 'btn-active' : ''}`}
            onClick={() => setMovingAverageSize(14)}
          >
            2w
          </button>
        </div>
        <MarketShareChart
          botIds={botIds}
          botDatafeed={botDatafeed}
          startDate={startDate}
          endDate={endDate}
          combine={combine}
          movingAverageSize={movingAverageSize}
        />
      </div>
    </div>
  );
}
