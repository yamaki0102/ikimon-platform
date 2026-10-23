import assert from 'node:assert/strict';
import test from 'node:test';
import { exportSelectedObservationsToNocosil } from './nocosilExport.js';

test('PostgreSQL facade remains off by default without touching database or transport', async () => {
  const request = { actorUserId: 'owner', siteId: 'site', period: { start: '2026-10-01', end: '2026-10-31' }, selectedObservationIds: ['o1'], idempotencyKey: 'export-1', allowExactCoordinates: false };
  // No DATABASE_URL or secret is required for the disabled feature.
  assert.deepEqual(await exportSelectedObservationsToNocosil(request), { status: 'disabled' });
});
