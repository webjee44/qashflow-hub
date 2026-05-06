import { describe, it, expect } from 'vitest';
import { computeBPModel } from '../computeBPModel';
import { serializeBPModelForSnapshot } from './serializeBPModel';
import { minimalBPInput } from './__fixtures__/minimal-bp';

// Golden snapshot — guards against silent numerical regressions during refactors.
// To regenerate after an INTENTIONAL change: run `vitest -u` and document the diff.
describe('computeBPModel — golden snapshots', () => {
  it('minimal-bp fixture is stable', () => {
    const model = computeBPModel(minimalBPInput);
    const snapshot = serializeBPModelForSnapshot(model);
    expect(snapshot).toMatchSnapshot();
  });
});
