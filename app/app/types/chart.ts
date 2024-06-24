import { LineData, Time, WhitespaceData } from 'lightweight-charts';

export type ChartData = LineData<Time> | WhitespaceData<Time>;
