import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResponsesTable } from './ResponsesTable';
import type { ResponseRecord } from '../types/api';

function makeRecord(overrides: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    _id: 'abc123',
    url: 'https://httpbin.org/anything',
    method: 'POST',
    status: 200,
    ok: true,
    responseTimeMs: 123,
    responseSizeBytes: 2048,
    isAnomaly: false,
    zScore: null,
    predictedResponseTimeMs: 118,
    anomalyReason: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ResponsesTable', () => {
  it('shows loading state when loading and no items', () => {
    render(<ResponsesTable items={[]} loading />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when no items and not loading', () => {
    render(<ResponsesTable items={[]} />);
    expect(screen.getByText(/no responses yet/i)).toBeInTheDocument();
  });

  it('shows error state when error is present', () => {
    render(<ResponsesTable items={[]} error="Boom" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
  });

  it('renders a row per item with status and response time', () => {
    const items = [makeRecord({ _id: '1', status: 200, responseTimeMs: 100 })];
    render(<ResponsesTable items={items} />);

    const rows = screen.getAllByTestId('response-row');
    expect(rows).toHaveLength(1);
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('100 ms')).toBeInTheDocument();
  });

  it('highlights anomaly rows and shows z-score', () => {
    const items = [
      makeRecord({
        _id: '1',
        isAnomaly: true,
        zScore: 3.42,
        anomalyReason: 'z=3.42 exceeds 3',
      }),
    ];
    render(<ResponsesTable items={items} />);

    expect(screen.getByText(/z=3\.42/)).toBeInTheDocument();
    const row = screen.getByTestId('response-row');
    expect(row).toHaveClass('bg-red-50/60');
  });

  it('formats size in KB for values ≥ 1024', () => {
    const items = [makeRecord({ _id: '1', responseSizeBytes: 2048 })];
    render(<ResponsesTable items={items} />);
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('renders multiple rows in order', () => {
    const items = [
      makeRecord({ _id: '1', status: 200 }),
      makeRecord({ _id: '2', status: 500, ok: false }),
    ];
    render(<ResponsesTable items={items} />);
    expect(screen.getAllByTestId('response-row')).toHaveLength(2);
    expect(screen.getByText('500')).toBeInTheDocument();
  });
});
