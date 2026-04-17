import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useResponsesStore } from './responsesStore';
import type { ResponseRecord } from '../types/api';

function makeRecord(overrides: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    _id: 'resp-1',
    url: 'https://httpbin.org/anything',
    method: 'POST',
    status: 200,
    ok: true,
    responseTimeMs: 120,
    responseSizeBytes: 512,
    isAnomaly: false,
    zScore: null,
    predictedResponseTimeMs: 100,
    anomalyReason: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('responsesStore', () => {
  beforeEach(() => {
    useResponsesStore.setState({ items: [], maxItems: 200 });
  });

  afterEach(() => {
    useResponsesStore.setState({ items: [], maxItems: 200 });
  });

  it('replaces items with setItems', () => {
    const items = [makeRecord({ _id: 'resp-1' }), makeRecord({ _id: 'resp-2' })];

    useResponsesStore.getState().setItems(items);

    expect(useResponsesStore.getState().items).toEqual(items);
  });

  it('prepends new items and ignores duplicates', () => {
    const existing = makeRecord({ _id: 'resp-1', responseTimeMs: 100 });
    const incoming = makeRecord({ _id: 'resp-2', responseTimeMs: 250 });

    useResponsesStore.getState().setItems([existing]);
    useResponsesStore.getState().prependItem(incoming);
    useResponsesStore.getState().prependItem(incoming);

    expect(useResponsesStore.getState().items).toEqual([incoming, existing]);
  });

  it('trims items to maxItems when prepending', () => {
    useResponsesStore.setState({ maxItems: 2 });

    useResponsesStore.getState().prependItem(makeRecord({ _id: 'resp-1' }));
    useResponsesStore.getState().prependItem(makeRecord({ _id: 'resp-2' }));
    useResponsesStore.getState().prependItem(makeRecord({ _id: 'resp-3' }));

    expect(useResponsesStore.getState().items.map((item) => item._id)).toEqual(['resp-3', 'resp-2']);
  });

  it('clears all items', () => {
    useResponsesStore.getState().setItems([makeRecord()]);

    useResponsesStore.getState().clear();

    expect(useResponsesStore.getState().items).toEqual([]);
  });
});
