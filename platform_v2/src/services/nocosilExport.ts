import { getPool } from '../db.js';
import { NocosilExportPostgresSource } from './nocosilExportPostgresSource.js';
import { NocosilExportRepository } from './nocosilExportRepository.js';
import {
  createAndSendNocosilExport,
  type NocosilExportRequest,
  type NocosilExportServiceConfig,
  type NocosilExportServiceResult,
} from './nocosilExportService.js';

/** Server-only entry point. actorUserId must come from the existing authenticated
 * session. Enabling the feature and supplying the signing key are deployment
 * configuration responsibilities; no public route or automatic export is enabled.
 */
export async function exportSelectedObservationsToNocosil(
  request: NocosilExportRequest,
  config: NocosilExportServiceConfig = {},
): Promise<NocosilExportServiceResult> {
  if (config.enabled !== true) return { status: 'disabled' };
  const db = getPool();
  return createAndSendNocosilExport(request, {
    source: new NocosilExportPostgresSource(db),
    repository: new NocosilExportRepository(db),
    config,
  });
}
