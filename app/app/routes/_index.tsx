import type { MetaFunction } from '@remix-run/cloudflare';
import { Chart } from '~/components';

export const meta: MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    {
      name: 'description',
      content: 'Welcome to Remix on Cloudflare Workers!'
    }
  ];
};

export default function Index() {
  return <div className='flex flex-col gap-4 p-4'><Chart></Chart></div>;
}
