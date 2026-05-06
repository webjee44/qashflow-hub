import { it } from 'vitest';
import { computeBPModel } from '../computeBPModel';
import { minimalBPInput } from './__fixtures__/minimal-bp';

it('measure baseline imbalances', () => {
  const m = computeBPModel(minimalBPInput);
  for (let i = 0; i < m.pl.years.length; i++) {
    const a = m.balanceSheet.totals.totalAssets[i] || 0;
    const l = m.balanceSheet.totals.totalLiabilities[i] || 0;
    console.log(`Y${i+1}: assets=${a.toFixed(0)} liab=${l.toFixed(0)} imbalance=${Math.abs(a-l).toFixed(0)}`);
  }
  console.log('errors:', m.validation.summary.errors, 'warnings:', m.validation.summary.warnings);
  console.log('codes:', m.validation.issues.map(i => `${i.code}/y${(i.yearIndex??-1)+1}/${i.delta?.toFixed(0)}`).join('\n'));
});
