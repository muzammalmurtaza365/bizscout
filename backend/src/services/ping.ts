import axios, { AxiosError } from 'axios';
import { faker } from '@faker-js/faker';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ResponseModel } from '../models/Response';
import { evaluateAnomaly } from './anomaly';
import { emitResponse } from '../sockets/server';
import { anomaliesTotal, pingDurationMs, pingsTotal } from '../utils/metrics';

export interface PingResult {
  success: boolean;
  status: number;
  responseTimeMs: number;
  isAnomaly: boolean;
  id: string;
}

export function generateRandomPayload(): Record<string, unknown> {
  return {
    requestId: faker.string.uuid(),
    timestamp: new Date().toISOString(),
    user: {
      id: faker.string.alphanumeric(10),
      name: faker.person.fullName(),
      email: faker.internet.email(),
    },
    event: {
      type: faker.helpers.arrayElement(['click', 'view', 'purchase', 'signup', 'logout']),
      value: faker.number.int({ min: 1, max: 1000 }),
      tags: faker.helpers.arrayElements(['web', 'mobile', 'api', 'cli', 'beta'], { min: 1, max: 3 }),
    },
    metadata: {
      source: faker.internet.domainName(),
      version: faker.system.semver(),
    },
  };
}

export async function runPing(): Promise<PingResult> {
  const payload = generateRandomPayload();
  const startedAt = Date.now();

  let status = 0;
  let responseBody: Record<string, unknown> = {};
  let headers: Record<string, string> = {};
  let responseSizeBytes = 0;
  let error: string | null = null;
  let ok = false;

  try {
    const res = await axios.post(env.PING_TARGET_URL, payload, {
      timeout: env.PING_TIMEOUT_MS,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'bizscout-monitor/1.0',
      },
      validateStatus: () => true,
    });
    status = res.status;
    ok = res.status >= 200 && res.status < 400;
    responseBody = typeof res.data === 'object' && res.data !== null ? res.data : { raw: res.data };
    headers = Object.fromEntries(
      Object.entries(res.headers ?? {}).map(([k, v]) => [k, String(v)]),
    );
    responseSizeBytes = Buffer.byteLength(JSON.stringify(res.data ?? ''), 'utf-8');
  } catch (err) {
    const axErr = err as AxiosError;
    error = axErr.message;
    status = axErr.response?.status ?? 0;
    logger.warn({ err: axErr.message, code: axErr.code }, 'ping request failed');
  }

  const responseTimeMs = Date.now() - startedAt;

  pingDurationMs.observe(responseTimeMs);
  if (status === 0) pingsTotal.inc({ outcome: 'network_error' });
  else if (ok) pingsTotal.inc({ outcome: 'success' });
  else pingsTotal.inc({ outcome: 'http_error' });

  const anomaly = await evaluateAnomaly(responseTimeMs);
  if (anomaly.isAnomaly) anomaliesTotal.inc();

  const doc = await ResponseModel.create({
    url: env.PING_TARGET_URL,
    method: 'POST',
    requestPayload: payload,
    status,
    ok,
    responseTimeMs,
    responseSizeBytes,
    responseBody,
    headers,
    error,
    isAnomaly: anomaly.isAnomaly,
    zScore: anomaly.zScore,
    predictedResponseTimeMs: anomaly.predicted,
    anomalyReason: anomaly.reason,
  });

  const emitted = {
    _id: doc._id.toString(),
    url: doc.url,
    method: doc.method,
    status: doc.status,
    ok: doc.ok,
    responseTimeMs: doc.responseTimeMs,
    responseSizeBytes: doc.responseSizeBytes,
    isAnomaly: doc.isAnomaly,
    zScore: doc.zScore,
    predictedResponseTimeMs: doc.predictedResponseTimeMs,
    anomalyReason: doc.anomalyReason,
    createdAt: doc.createdAt,
  };

  emitResponse('response:new', emitted);
  if (doc.isAnomaly) {
    emitResponse('incident:new', emitted);
  }

  logger.info(
    {
      status,
      ms: responseTimeMs,
      anomaly: anomaly.isAnomaly,
      z: anomaly.zScore,
    },
    'ping complete',
  );

  return {
    success: ok,
    status,
    responseTimeMs,
    isAnomaly: anomaly.isAnomaly,
    id: doc._id.toString(),
  };
}
