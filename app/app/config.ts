import chroma from 'chroma-js';

export const marioColor = '#b90000';
export const aldorColor = '#0044b9';

export const allBotOwners = [
  {
    value: 'marior.near',
    label: 'marior.near',
    color: chroma(marioColor).hex(),
    bots: [
      'bot.marior.near',
      'bot0.marior.near',
      'bot2.marior.near',
      'bot3.marior.near',
      'bot4.marior.near',
      'bot5.marior.near',
      'bot6.marior.near'
    ]
  },
  {
    value: 'dsaving.near',
    label: 'dsaving.near',
    color: chroma(aldorColor).hex(),
    bots: [
      'aldor.near',
      'frisky.near',
      'sneaky1.near',
      'kagool.near',
      'zalevsky.near',
      'shitake.near',
      'drooling.near'
    ]
  }
];

export const allBots = [
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

export type BotOption = (typeof allBots)[0];
