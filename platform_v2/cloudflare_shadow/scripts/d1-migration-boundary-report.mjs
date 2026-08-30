import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const shadowRoot = process.cwd();
const repoRoot = path.resolve(shadowRoot, "..", "..");
const platformRoot = path.join(repoRoot, "platform_v2");
const PG_DEPENDENCY_TABLE_LIMIT = 80;
const STOP_BLOCKER_TABLE_LIMIT = 120;
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];
const P0_DISPOSITION_TERMINAL_STATUSES = new Set(["migrated", "replaced-route", "product-accepted-drop"]);
const P0_DISPOSITION_ALLOWED_STATUSES = new Set(["blocked", ...P0_DISPOSITION_TERMINAL_STATUSES]);

function walk(dir, predicate, output = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".wrangler" || entry.name === ".deploy") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, predicate, output);
    else if (predicate(fullPath)) output.push(fullPath);
  }
  return output;
}

function read(file) {
  return readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function rel(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}

function isTestSourceFile(relativeFile) {
  const normalized = relativeFile.replaceAll("\\", "/");
  return /(?:^|\/)(?:test|tests|__tests__|__mocks__)\//.test(normalized)
    || /\.(?:test|spec)\.(?:ts|tsx|js|mjs)$/.test(normalized);
}

function maintenancePgDependencyReason(relativeFile) {
  const normalized = relativeFile.replaceAll("\\", "/");
  const exactGatedOpsServices = {
    "platform_v2/src/services/stagingFixtureCleanup.ts": "gated_staging_fixture_ops",
    "platform_v2/src/services/stagingRallyFixtures.ts": "gated_staging_fixture_ops",
    "platform_v2/src/services/stagingRegressionFixtures.ts": "gated_staging_fixture_ops"
  };
  if (exactGatedOpsServices[normalized]) return exactGatedOpsServices[normalized];
  const exactAdminOpsDiagnostics = {
    "platform_v2/src/routes/adminDataHealth.ts": "admin_ops_diagnostic_dashboard",
    "platform_v2/src/routes/adminMonitoringWorkspace.ts": "admin_monitoring_diagnostic_readonly",
    "platform_v2/src/routes/adminRegionalKnowledge.ts": "admin_regional_knowledge_review_dashboard",
    "platform_v2/src/routes/adminSiteEvidence.ts": "admin_evidence_report",
    "platform_v2/src/routes/knowledgeNavigationApi.ts": "internal_knowledge_navigation_admin_api",
    "platform_v2/src/routes/curatorProposalsApi.ts": "internal_curator_proposal_receiver",
    "platform_v2/src/services/audioPropagation.ts": "admin_audio_review_residual_after_vector_retirement",
    "platform_v2/src/services/audioReview.ts": "admin_audio_review_residual_after_vector_retirement",
    "platform_v2/src/services/alertDispatcher.ts": "manual_ai_reassessment_alert_dispatcher",
    "platform_v2/src/services/monitoringWorkspaceData.ts": "admin_monitoring_diagnostic_readmodel",
    "platform_v2/src/services/plotMonitoring.ts": "admin_plot_monitoring_backstage_api",
    "platform_v2/src/services/readiness.ts": "legacy_cutover_readiness_report"
  };
  if (exactAdminOpsDiagnostics[normalized]) return exactAdminOpsDiagnostics[normalized];
  if (normalized === "platform_v2/src/services/guideHypothesisEvalSet.ts") return "manual_audit_report_tool";
  const scriptPrefix = "platform_v2/src/scripts/";
  if (!normalized.startsWith(scriptPrefix)) return null;
  if (normalized === "platform_v2/src/scripts/applyMigrations.ts") return "migration_cli_tool";
  if (normalized === "platform_v2/src/scripts/embedRegionalKnowledgeCards.ts") return "manual_embedding_batch";
  if (normalized === "platform_v2/src/scripts/reportMissingObservationPhotos.ts") return "manual_integrity_report";
  if (normalized === "platform_v2/src/scripts/importObservationFields.ts") return "manual_field_import";
  if (normalized === "platform_v2/src/scripts/ingestPlaceEnvironmentSnapshots.ts") return "manual_environment_ingest";
  const exactMaintenanceScripts = {
    "platform_v2/src/scripts/applyZukanFoundationV2SourceRegistryImport.ts": "foundation_v2_operator_apply_tool",
    "platform_v2/src/scripts/applyTierPromotionBulk.ts": "manual_admin_batch_tool",
    "platform_v2/src/scripts/auditObservationFieldEntityKeys.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/auditObservationLocations.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/backfillAuthorityRank.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/backfillFieldPolygonBbox.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/backfillObservationLocalityFromAdminAreas.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/backfillGuideNonBiologicalSpecies.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/bootstrapLegacyImport.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/cleanupObservationSameSubjectAiCandidates.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/cleanupStagingSmokeFixtures.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/cleanupProductionUiSmoke.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/compileKnowledgeNavigation.ts": "deploy_or_postdeploy_tool",
    "platform_v2/src/scripts/diagnoseGuideEnvironmentMesh.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/enhanceSchoolFieldBoundaries.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/exportGuideHypothesisEvalSet.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/generateGuideHypothesisPromptImprovements.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/generateRegionalHypotheses.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/importGlobalAdministrativeAreas.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importInvasiveKnowledgeClaims.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importInvasiveReportingContacts.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importLegacyAiAssessments.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importN03Administrative.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importObservationEvidence.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importObservationFeedbackKnowledgeClaims.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importObservationIdentification.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importObservationMeaning.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importObservationPlaceCondition.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importOsmLeisureParks.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importRegionalKnowledgeCards.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importRememberTokens.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/importTrackSessions.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/materializeLegacyVerifySnapshot.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/monitorProductionSmokeCleanup.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/planObservationLedger.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/processPlaceMemoryPhotos.ts": "manual_media_batch_tool",
    "platform_v2/src/scripts/processAudioSegments.ts": "manual_audio_detection_batch_tool",
    "platform_v2/src/scripts/cron/runCacheInvalidate.ts": "scheduled_legacy_cache_and_freshness_maintenance",
    "platform_v2/src/scripts/cron/runCurator.ts": "scheduled_curator_proposal_batch",
    "platform_v2/src/scripts/cron/curators/invasive-law.ts": "scheduled_curator_proposal_batch",
    "platform_v2/src/scripts/readinessReport.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/rebuildGuideEnvironmentMesh.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/refreshPublicMapSnapshot.ts": "manual_materialization_tool",
    "platform_v2/src/scripts/refreshRecentObservationAi.ts": "manual_ai_batch_tool",
    "platform_v2/src/scripts/repairObservationLocationLabels.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/repairHamamatsuWardLabels.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/repairMissingManualOccurrences.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/repairObservationFieldSourcePolicy.ts": "deploy_or_postdeploy_tool",
    "platform_v2/src/scripts/repairObservationSpatialMeshSchema.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/repairStagingNatsIdentity.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/replacementReadinessReport.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/reportLegacyDrift.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/reportMigrationBaseline.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/reportVisitWindows.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/rehearseCutover.ts": "manual_audit_report_tool",
    "platform_v2/src/scripts/runZukanFoundationV2PostgresDatabaseFixtures.ts": "foundation_v2_scratch_fixture_tool",
    "platform_v2/src/scripts/runZukanFoundationV2PostgresReadOnlyEvidence.ts": "foundation_v2_read_only_evidence_tool",
    "platform_v2/src/scripts/runGuideEnvironmentPostDeploy.ts": "deploy_or_postdeploy_tool",
    "platform_v2/src/scripts/runAiForMissing.ts": "manual_ai_batch_tool",
    "platform_v2/src/scripts/setExistingUserPassword.ts": "manual_repair_or_admin_tool",
    "platform_v2/src/scripts/smokeInvasiveReportingDelivery.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/smokePassiveAudioIngest.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/smokePlatformReadLane.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/smokeProductionMediaUpload.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/smokePublicMapSnapshotAlert.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/syncLegacyDelta.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/syncLegacyUserAuth.ts": "manual_import_or_legacy_sync_tool",
    "platform_v2/src/scripts/verifyLegacyParity.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/verifyProductionShadowParity.ts": "manual_verification_or_smoke_tool",
    "platform_v2/src/scripts/writeLegacyCompatibility.ts": "manual_import_or_legacy_sync_tool"
  };
  return exactMaintenanceScripts[normalized] ?? null;
}

function replacedProductionRuntimePgDependencyReason(relativeFile) {
  const normalized = relativeFile.replaceAll("\\", "/");
  const exactReplacedProductionRuntime = {
    "platform_v2/src/services/mapSnapshot.ts": "cloudflare_public_map_snapshot_readmodel",
    "platform_v2/src/services/sensitiveSpeciesMasking.ts": "cloudflare_public_map_and_area_snapshot_masking_readmodels",
    "platform_v2/src/services/landingSnapshot.ts": "cloudflare_materialized_landing_and_home_readmodel",
    "platform_v2/src/services/readModels.ts": "cloudflare_materialized_public_readmodels",
    "platform_v2/src/services/areaSnapshotVisitScope.ts": "cloudflare_area_and_place_snapshot_visit_scope_readmodel",
    "platform_v2/src/services/areaPlaceSnapshot.ts": "cloudflare_area_snapshot_field_detail_readmodel",
    "platform_v2/src/services/placeSnapshot.ts": "cloudflare_place_snapshot_readmodel",
    "platform_v2/src/services/placeAtlasProfile.ts": "cloudflare_place_atlas_profile_native",
    "platform_v2/src/services/placeRegistry.ts": "cloudflare_place_registry_native",
    "platform_v2/src/services/fixedPointStation.ts": "cloudflare_fixed_point_station_readmodel",
    "platform_v2/src/services/areaPolygons.ts": "cloudflare_area_polygon_readmodel",
    "platform_v2/src/services/fieldManagers.ts": "cloudflare_field_manager_runtime",
    "platform_v2/src/services/mapOwnObservations.ts": "cloudflare_owner_map_observations_native",
    "platform_v2/src/services/mapEffort.ts": "cloudflare_public_map_effort_shim",
    "platform_v2/src/services/publicMapSnapshotOpsAlerts.ts": "cloudflare_public_map_snapshot_ops_inventory",
    "platform_v2/src/routes/observationEventApi.ts": "cloudflare_observation_event_core_api",
    "platform_v2/src/services/observationRally.ts": "cloudflare_observation_rally_api",
    "platform_v2/src/services/observationRallyAutoMatch.ts": "cloudflare_observation_rally_post_save_auto_match",
    "platform_v2/src/services/authSession.ts": "cloudflare_auth_session_api",
    "platform_v2/src/services/authUsers.ts": "cloudflare_auth_user_account_api",
    "platform_v2/src/services/observationWrite.ts": "cloudflare_observation_write_api",
    "platform_v2/src/services/observationPhotoUpload.ts": "cloudflare_observation_photo_upload_api",
    "platform_v2/src/services/observationAiAssessment.ts": "cloudflare_observation_detail_readmodel_dependency",
    "platform_v2/src/services/observationPackage.ts": "cloudflare_observation_package_runtime",
    "platform_v2/src/services/observationPackageDataChain.ts": "cloudflare_observation_package_data_chain_replaced_dependency",
    "platform_v2/src/services/observationReactions.ts": "cloudflare_observation_reactions_api",
    "platform_v2/src/services/recordReadingCards.ts": "cloudflare_record_reading_cards_api",
    "platform_v2/src/services/uiKpi.ts": "cloudflare_ui_kpi_event_api",
    "platform_v2/src/services/observationVisitBundle.ts": "cloudflare_observation_detail_readmodel",
    "platform_v2/src/services/observationEventLive.ts": "cloudflare_observation_event_live_api",
    "platform_v2/src/services/observationEventDualWrite.ts": "cloudflare_observation_event_dual_write_side_effects",
    "platform_v2/src/services/observationEventEffort.ts": "cloudflare_observation_event_effort_api",
    "platform_v2/src/services/observationEventModeManager.ts": "cloudflare_observation_event_mode_api",
    "platform_v2/src/services/observationEventRecap.ts": "cloudflare_observation_event_recap_api",
    "platform_v2/src/services/observationEventParticipantAccess.ts": "cloudflare_observation_event_participant_identity_runtime",
    "platform_v2/src/services/observationEventContext.ts": "cloudflare_observation_event_static_quest_context_dependency",
    "platform_v2/src/services/observationEventQuestEngine.ts": "cloudflare_observation_event_static_quest_runtime",
    "platform_v2/src/services/observationEventCapsule.ts": "cloudflare_observation_event_capsule_api",
    "platform_v2/src/services/observationEventOfficialReport.ts": "cloudflare_observation_event_official_report_api",
    "platform_v2/src/services/areaSketchAssessments.ts": "cloudflare_area_sketch_assessment_runtime",
    "platform_v2/src/routes/observationEventPages.ts": "cloudflare_observation_event_pages_runtime",
    "platform_v2/src/routes/meSubscriptionsApi.ts": "cloudflare_personal_subscription_alert_api",
    "platform_v2/src/services/contactSubmit.ts": "cloudflare_contact_submit_api",
    "platform_v2/src/services/userWrite.ts": "cloudflare_user_profile_write_api",
    "platform_v2/src/services/rememberTokenWrite.ts": "cloudflare_remember_token_api",
    "platform_v2/src/routes/write.ts": "cloudflare_app_write_route_boundary",
    "platform_v2/src/services/observationDataRights.ts": "cloudflare_observation_data_rights_api",
    "platform_v2/src/services/publicationFeed.ts": "cloudflare_publication_feed_native_runtime",
    "platform_v2/src/services/civicNatureContext.ts": "cloudflare_civic_observation_context_runtime",
    "platform_v2/src/services/evidenceAssetMediaRole.ts": "cloudflare_observation_media_role_dependency",
    "platform_v2/src/services/mediaProcessingJobs.ts": "cloudflare_media_processing_queue_dependency",
    "platform_v2/src/routes/stewardshipActions.ts": "cloudflare_stewardship_action_form_and_write_runtime",
    "platform_v2/src/routes/adminGuidePrograms.ts": "cloudflare_guide_program_admin_api",
    "platform_v2/src/routes/adminGuidePromptImprovements.ts": "cloudflare_guide_prompt_improvement_admin_api",
    "platform_v2/src/services/guideCorrectionEval.ts": "cloudflare_guide_correction_eval_readmodel",
    "platform_v2/src/services/guideEnvironmentMesh.ts": "cloudflare_guide_environment_mesh_readmodel",
    "platform_v2/src/services/guideEnvironmentOps.ts": "cloudflare_guide_environment_dashboard_api",
    "platform_v2/src/services/guideHypothesisPromptImprovements.ts": "cloudflare_guide_prompt_improvement_admin_api",
    "platform_v2/src/services/guideInteractions.ts": "cloudflare_guide_interaction_api",
    "platform_v2/src/services/guidePrograms.ts": "cloudflare_guide_program_admin_api",
    "platform_v2/src/routes/guideRecordsDebug.ts": "cloudflare_guide_outcomes_and_route_layer_runtime",
    "platform_v2/src/routes/researchApi.ts": "cloudflare_research_export_runtime",
    "platform_v2/src/services/guideRouteTrack.ts": "cloudflare_guide_telemetry_route_points_runtime",
    "platform_v2/src/services/guideTransectQuality.ts": "cloudflare_guide_route_layer_quality_runtime",
    "platform_v2/src/services/guideUnlocks.ts": "cloudflare_guide_unlock_api",
    "platform_v2/src/services/guideSession.ts": "cloudflare_guide_scene_static_runtime",
    "platform_v2/src/services/mobileFieldSessions.ts": "cloudflare_mobile_field_session_digest_runtime",
    "platform_v2/src/services/guideSessionPublicSummary.ts": "cloudflare_guide_session_public_summary_runtime",
    "platform_v2/src/services/guideRecordPromotion.ts": "cloudflare_guide_record_promotion_request_ledger",
    "platform_v2/src/services/regionalHypotheses.ts": "cloudflare_guide_regional_hypothesis_api",
    "platform_v2/src/services/fieldscanAudio.ts": "cloudflare_fieldscan_audio_runtime",
    "platform_v2/src/services/passiveAudioIngest.ts": "cloudflare_passive_audio_ingest_runtime",
    "platform_v2/src/services/resolveFieldsForPoint.ts": "cloudflare_replaced_field_resolution_helper_dependency",
    "platform_v2/src/services/walkWrite.ts": "cloudflare_walk_session_api",
    "platform_v2/src/services/trackWrite.ts": "cloudflare_track_upsert_api",
    "platform_v2/src/services/observationRecordAiReview.ts": "cloudflare_observation_record_ai_review_api",
    "platform_v2/src/services/waterRecordExtension.ts": "cloudflare_observation_water_record_extension_runtime",
    "platform_v2/src/services/placeManagementPolicy.ts": "cloudflare_place_management_policy_runtime",
    "platform_v2/src/services/placeMemory.ts": "cloudflare_place_memory_runtime",
    "platform_v2/src/services/referenceLibrary.ts": "cloudflare_reference_library_runtime",
    "platform_v2/src/scripts/runSentinelEnvironmentWorker.ts": "cloudflare_sentinel_environment_snapshot_runtime",
    "platform_v2/src/services/environmentSnapshotWriter.ts": "cloudflare_sentinel_environment_snapshot_runtime",
    "platform_v2/src/services/observationFieldRegistry.ts": "cloudflare_observation_field_registry_runtime",
    "platform_v2/src/services/identificationParticipation.ts": "cloudflare_identification_participation_runtime",
    "platform_v2/src/services/identificationConsensus.ts": "cloudflare_identification_consensus_runtime",
    "platform_v2/src/services/identificationWorkbenchHolds.ts": "cloudflare_identification_workbench_hold_runtime",
    "platform_v2/src/services/specialistReview.ts": "cloudflare_specialist_review_runtime",
    "platform_v2/src/services/reviewerAuthorities.ts": "cloudflare_specialist_authority_runtime",
    "platform_v2/src/services/authorityRecommendations.ts": "cloudflare_specialist_authority_runtime",
    "platform_v2/src/services/writeGuardsPg.ts": "cloudflare_replaced_or_residual_write_guard_pg_helper",
    "platform_v2/src/services/writeSupportPg.ts": "cloudflare_replaced_or_residual_write_support_pg_helper",
    "platform_v2/src/services/visitSubjects.ts": "cloudflare_visit_subject_summary_replaced_dependency"
  };
  return exactReplacedProductionRuntime[normalized] ?? null;
}

function optionalRuntimePgDependencyReason(relativeFile) {
  const normalized = relativeFile.replaceAll("\\", "/");
  const exactOptionalRuntime = {
    "platform_v2/src/services/siteSignalsCache.ts": "optional_site_signals_cache_falls_back_without_database",
    "platform_v2/src/services/gbifBackboneMatch.ts": "optional_gbif_match_cache_falls_back_to_remote_api",
    "platform_v2/src/services/officialNoticeCache.ts": "optional_official_notice_cache_falls_back_to_remote_or_stale_snapshot",
    "platform_v2/src/services/runtimeVersion.ts": "optional_runtime_version_migration_head",
    "platform_v2/src/services/glossaryTerms.ts": "optional_glossary_terms_builtin_fallback_and_nonfatal_candidate_log",
    "platform_v2/src/routes/invasiveSpecies.ts": "optional_invasive_reporting_visibility_falls_back_unavailable",
    "platform_v2/src/services/invasiveReporting.ts": "optional_invasive_reporting_delivery_falls_back_empty",
    "platform_v2/src/services/placeEnvironmentSignals.ts": "optional_place_environment_evidence_falls_back_empty",
    "platform_v2/src/services/observationContext.ts": "optional_observation_detail_context_falls_back_empty",
    "platform_v2/src/services/observationDetailHeavy.ts": "optional_observation_detail_heavy_falls_back_empty",
    "platform_v2/src/services/observerStats.ts": "optional_observation_detail_observer_stats_card",
    "platform_v2/src/services/placeVegetationTrend.ts": "optional_place_vegetation_trend_card_falls_back_null",
    "platform_v2/src/services/regionalStory.ts": "optional_regional_story_seed_fallback_and_nonfatal_exposure_log",
    "platform_v2/src/services/taxonInsights.ts": "optional_observation_detail_taxon_insight_card",
    "platform_v2/src/services/aiCostLogger.ts": "optional_ops_ai_cost_logging_and_budget_health",
    "platform_v2/src/services/areaWatchNotifications.ts": "optional_area_watch_notification_enrichment",
    "platform_v2/src/services/profileNoteDigest.ts": "optional_profile_note_digest_enrichment",
    "platform_v2/src/services/relationshipScore.queries.ts": "optional_relationship_score_readonly_queries",
    "platform_v2/src/services/relationshipScoreSnapshot.ts": "optional_relationship_score_report_snapshot",
    "platform_v2/src/services/tierPromotion.ts": "optional_evidence_tier_enrichment"
  };
  return exactOptionalRuntime[normalized] ?? null;
}

function forcedRuntimePgDependency(relativeFile) {
  void relativeFile;
  return false;
}

function exclusiveMaintenancePgDependencyReason(relativeFile, importersByTarget, seen = new Set()) {
  if (forcedRuntimePgDependency(relativeFile)) return null;
  const explicitReason = maintenancePgDependencyReason(relativeFile);
  if (explicitReason) return explicitReason;
  if (seen.has(relativeFile)) return null;
  seen.add(relativeFile);

  const importers = [...(importersByTarget.get(relativeFile) ?? [])]
    .filter((importer) => !isTestSourceFile(importer));
  if (importers.length === 0) return null;

  const importerReasons = [];
  for (const importer of importers) {
    const reason = exclusiveMaintenancePgDependencyReason(importer, importersByTarget, new Set(seen));
    if (!reason) return null;
    importerReasons.push(reason);
  }
  return `${[...new Set(importerReasons)].sort().join("+")}_dependency`;
}

function maintenanceWorkflowDependencyReason(relativeFile) {
  const normalized = relativeFile.replaceAll("\\", "/");
  const exactMaintenanceWorkflows = {
    ".github/workflows/ci.yml": "ci_local_postgres_service",
    ".github/workflows/curator-staging-wet-run.yml": "manual_staging_wet_run",
    ".github/workflows/enhance-school-boundaries.yml": "manual_import_or_repair_workflow",
    ".github/workflows/import-n03-admin.yml": "manual_import_or_repair_workflow",
    ".github/workflows/import-osm-area-parks.yml": "manual_import_or_repair_workflow",
    ".github/workflows/import-school-fields.yml": "manual_import_or_repair_workflow",
    ".github/workflows/refresh-observation-ai.yml": "manual_ai_batch_workflow",
    ".github/workflows/deploy-staging.yml": "legacy_vps_staging_replaced_by_cloudflare_staging"
  };
  return exactMaintenanceWorkflows[normalized] ?? null;
}

function workflowDependencySignals(text) {
  const hasRealSshOrScp = /uses:\s*appleboy\/ssh-action@/i.test(text)
    || /^\s*(?:ssh|scp)\b/im.test(text);
  return [
    /DATABASE_URL/i.test(text) ? "DATABASE_URL" : null,
    /VPS_/i.test(text) ? "VPS" : null,
    /\bpsql\b/i.test(text) ? "psql" : null,
    hasRealSshOrScp ? "ssh/scp" : null,
    /applyMigrations/i.test(text) ? "migrations" : null
  ].filter(Boolean);
}

function extractLocalImportSpecifiers(text) {
  const specifiers = [];
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]?.startsWith(".")) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function resolveLocalImport(fromRelativeFile, specifier, knownRelativeFiles) {
  const fromDir = path.dirname(path.join(repoRoot, fromRelativeFile));
  const rawTarget = path.resolve(fromDir, specifier);
  const candidates = [];
  if (SOURCE_EXTENSIONS.some((extension) => rawTarget.endsWith(extension))) {
    candidates.push(rawTarget);
    const parsed = path.parse(rawTarget);
    const extensionlessTarget = path.join(parsed.dir, parsed.name);
    for (const extension of SOURCE_EXTENSIONS) candidates.push(`${extensionlessTarget}${extension}`);
  } else {
    for (const extension of SOURCE_EXTENSIONS) candidates.push(`${rawTarget}${extension}`);
    for (const extension of SOURCE_EXTENSIONS) candidates.push(path.join(rawTarget, `index${extension}`));
  }
  return candidates
    .map((candidate) => rel(candidate))
    .find((candidate) => knownRelativeFiles.has(candidate)) ?? null;
}

function count(pattern, text) {
  return [...text.matchAll(pattern)].length;
}

function extractSqlTables(sql) {
  const tables = new Set();
  for (const match of sql.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi)) {
    tables.add(match[1]);
  }
  return [...tables].sort();
}

function extractD1Bindings(wranglerText) {
  const bindings = [];
  let searchFrom = 0;
  while (true) {
    const keyIndex = wranglerText.indexOf('"d1_databases"', searchFrom);
    if (keyIndex === -1) break;
    const arrayStart = wranglerText.indexOf("[", keyIndex);
    if (arrayStart === -1) break;
    let depth = 0;
    let inString = false;
    let escape = false;
    let objectStart = -1;
    for (let i = arrayStart; i < wranglerText.length; i += 1) {
      const ch = wranglerText[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === "\"") inString = false;
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "[") depth += 1;
      if (ch === "]") {
        depth -= 1;
        if (depth === 0) {
          searchFrom = i + 1;
          break;
        }
      }
      if (ch === "{" && depth === 1) objectStart = i;
      if (ch === "}" && depth === 1 && objectStart !== -1) {
        const objectText = wranglerText.slice(objectStart, i + 1);
        const binding = objectText.match(/"binding"\s*:\s*"([^"]+)"/)?.[1];
        const database = objectText.match(/"database_name"\s*:\s*"([^"]+)"/)?.[1];
        const id = objectText.match(/"database_id"\s*:\s*"([^"]+)"/)?.[1];
        if (binding && database && id) bindings.push({ binding, database, id });
        objectStart = -1;
      }
    }
    if (searchFrom <= keyIndex) break;
  }
  return bindings;
}

function parseWranglerConfig(wranglerText) {
  try {
    return JSON.parse(wranglerText);
  } catch {
    return {};
  }
}

function productionVarsFromWrangler(config) {
  const vars = config?.env?.production?.vars;
  return vars && typeof vars === "object" ? vars : {};
}

function hasPgVectorSignal(text) {
  return /pgvector|using\s+(?:ivfflat|hnsw)\b|vector_(?:l2|ip|cosine|l1)_ops|create\s+extension(?:\s+if\s+not\s+exists)?\s+vector\b|::\s*vector\b|\bas\s+vector\b|<=>|<->|<#>|<\+>|\bvector\s*\(/i.test(text);
}

function classifyPg(text) {
  const flags = [];
  if (/\bST_[A-Za-z0-9_]+\s*\(|PostGIS|\bgeometry\b|\bgeography\b/i.test(text)) flags.push("postgis");
  if (hasPgVectorSignal(text)) flags.push("vector");
  if (/tsvector|to_tsvector|plainto_tsquery|websearch_to_tsquery/i.test(text)) flags.push("full_text");
  if (/(?:^|[^.\w])(?:LISTEN|NOTIFY)\s+[A-Za-z_"]|\bSKIP\s+LOCKED\b/i.test(text)) flags.push("job_locking");
  if (/\bFOR\s+UPDATE\b/i.test(text)) flags.push("row_locking");
  if (/DATABASE_URL|PGHOST|PGUSER|PGPASSWORD/i.test(text)) flags.push("pg_env");
  const hasPgArray = /\barray\s*\[/i.test(text) || /\barray\s*\(\s*select\b/i.test(text);
  if (/jsonb|::jsonb|unnest\(/i.test(text) || hasPgArray) flags.push("pg_types");
  const importsDbClientHelper = /import\s*\{[^}]*\bgetClient\b[^}]*\}\s*from\s*["'][^"']*\/db(?:\.js)?["']/m.test(text);
  if (/getPool|pool\.query|client\.query|withTransaction/i.test(text) || (importsDbClientHelper && /\bgetClient\s*\(/.test(text))) flags.push("runtime_query");
  return flags;
}

function classifySuppressedPgNoise(text) {
  const signals = [];
  if (/addEventListener|\.listen\s*\(|\bnotify\s*\(/i.test(text)) signals.push("js_listener_or_notify");
  if (/\bArray(?:\.isArray|\s*[<(])/.test(text)) signals.push("js_array_helper_or_type");
  if (/\b(?:embedding|vector)\b/i.test(text) && !hasPgVectorSignal(text)) signals.push("non_pg_embedding_or_vector_text");
  return signals;
}

const PG_INVENTORY_ONLY_FLAGS = new Set(["postgis", "pg_env", "pg_types"]);

function isNoRuntimeQueryPgInventoryOnly(item) {
  return !item.flags.includes("runtime_query")
    && !item.flags.includes("vector")
    && !item.flags.includes("full_text")
    && !item.flags.includes("job_locking")
    && !item.flags.includes("row_locking")
    && item.flags.length > 0
    && item.flags.every((flag) => PG_INVENTORY_ONLY_FLAGS.has(flag));
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

function classifyFallbackReason(reason) {
  if (/materialized_miss|html_personalized_request|static_asset|thumb|area_snapshot/i.test(reason)) return "materialized_origin_fallback";
  if (/auth|oauth|session/i.test(reason)) return "auth_origin_fallback";
  if (/unsupported_observation_api|legacy_observation(?:_[a-z0-9]+)*_origin_fallback|legacy_observation_api|legacy_observation_event_api|public_write_origin_mode/i.test(reason)) return "api_origin_fallback";
  if (/map_area_polygons/i.test(reason)) return "map_origin_fallback";
  if (/public_custom_domain_path/i.test(reason)) return "broad_public_origin_fallback";
  return "origin_fallback";
}

function extractOriginFallbackCalls(file, text) {
  const calls = [];
  const pattern = /fetchOriginFallback\s*\(/g;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    const lineStart = text.lastIndexOf("\n", start) + 1;
    const linePrefix = text.slice(lineStart, start);
    if (/\bfunction\s+$/.test(linePrefix)) continue;

    const openParen = start + match[0].length - 1;
    const args = extractBalancedCallArgs(text, openParen);
    if (!args) continue;
    const quoted = [...args.matchAll(/"([^"]+)"/g)].map((item) => item[1]);
    const reason = quoted.findLast((value) => /fallback|origin|auth|oauth|session|materialized|unsupported|polygon|path|miss|mode|personalized|html|thumb|asset/i.test(value))
      ?? "origin_fallback_default";
    calls.push({
      file: rel(file),
      line: lineForOffset(text, start),
      reason,
      category: classifyFallbackReason(reason)
    });
  }
  return calls;
}

function extractBalancedCallArgs(text, openParen) {
  let depth = 0;
  let inString = false;
  let quote = "";
  let escape = false;
  for (let i = openParen; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(openParen + 1, i);
    }
  }
  return null;
}

function blockerSeverity(item) {
  if (item.type === "origin_fallback" && item.category === "api_origin_fallback") return "P0";
  if (item.type === "origin_fallback" && item.category === "auth_origin_fallback") return "P0";
  if (item.type === "origin_fallback" && item.category === "broad_public_origin_fallback") return "P0";
  if (item.type === "origin_fallback" && item.category === "materialized_origin_fallback") return "P1";
  if (item.type === "origin_fallback" && item.category === "map_origin_fallback") return "P1";
  if (item.type === "pg_dependency" && item.flags.includes("vector")) return "P0";
  if (item.type === "pg_dependency" && item.flags.includes("job_locking")) return "P0";
  if (item.type === "pg_dependency" && item.flags.includes("runtime_query")) return "P1";
  return "P2";
}

function configuredStateForFallback(item, productionVars) {
  const originFallbackConfigured = typeof productionVars.ORIGIN_FALLBACK_BASE_URL === "string"
    && productionVars.ORIGIN_FALLBACK_BASE_URL.trim() !== "";
  const publicWriteMode = String(productionVars.PUBLIC_WRITE_MODE ?? "");
  const publicCustomDomainFallbackMode = String(productionVars.PUBLIC_CUSTOM_DOMAIN_ORIGIN_FALLBACK_MODE ?? "enabled").trim().toLowerCase();
  const originSessionImportMode = String(productionVars.ORIGIN_SESSION_IMPORT_MODE ?? "disabled").trim().toLowerCase();
  if (!originFallbackConfigured) {
    return { active: false, note: "origin_fallback_not_configured" };
  }
  if (item.reason === "origin_session_probe" && originSessionImportMode === "disabled") {
    return { active: false, note: "inactive_origin_session_import_disabled" };
  }
  if (item.reason === "public_custom_domain_path" && publicCustomDomainFallbackMode === "disabled") {
    return { active: false, note: "inactive_public_custom_domain_origin_fallback_disabled" };
  }
  if (item.reason === "public_write_origin_mode" && publicWriteMode !== "origin_fallback") {
    return { active: false, note: `inactive_public_write_mode_${publicWriteMode || "unset"}` };
  }
  if (item.reason === "oauth_provider_not_configured") {
    return { active: true, note: "active_if_oauth_secret_missing" };
  }
  return { active: true, note: "active_in_production_config" };
}

function configuredStateForBlocker(item, productionVars) {
  if (item.type !== "origin_fallback") return { active: true, note: "not_config_gated" };
  return configuredStateForFallback(item, productionVars);
}

function scorePg(flags, text) {
  let score = flags.length;
  if (flags.includes("postgis")) score += 5;
  if (flags.includes("vector")) score += 5;
  if (flags.includes("job_locking")) score += 3;
  score += Math.min(count(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/gi, text), 12);
  return score;
}

function section(title) {
  return [`## ${title}`, ""];
}

function loadP0DispositionManifest() {
  const file = path.join(shadowRoot, "config", "vps-stop-p0-dispositions.json");
  if (!existsSync(file)) {
    return { file: rel(file), items: [], missing: true };
  }
  const manifest = readJson(file);
  return {
    file: rel(file),
    schemaVersion: manifest.schemaVersion,
    items: Array.isArray(manifest.items) ? manifest.items : [],
    missing: false
  };
}

function blockerEvidenceKeys(item) {
  const keys = new Set([item.key, `${item.type}:${item.key}`]);
  if (item.type === "origin_fallback") {
    keys.add(item.reason);
    keys.add(`${item.type}:${item.reason}`);
  }
  if (item.type === "pg_dependency") {
    keys.add(`pg_dependency:${item.key}`);
  }
  return keys;
}

function dispositionForBlocker(item, dispositions) {
  const evidenceKeys = blockerEvidenceKeys(item);
  return dispositions.find((disposition) =>
    Array.isArray(disposition.evidenceKeys)
      && disposition.evidenceKeys.some((evidenceKey) => evidenceKeys.has(evidenceKey))
  ) ?? null;
}

function validateP0DispositionManifest(manifest) {
  const issues = [];
  if (manifest.missing) issues.push("manifest_missing");
  if (manifest.schemaVersion !== 1) issues.push(`unsupported_schema_version:${manifest.schemaVersion ?? "unset"}`);

  const seenKeys = new Set();
  for (const item of manifest.items) {
    if (!item || typeof item !== "object") {
      issues.push("invalid_item");
      continue;
    }
    if (typeof item.key !== "string" || item.key.trim() === "") issues.push("item_missing_key");
    else if (seenKeys.has(item.key)) issues.push(`duplicate_key:${item.key}`);
    else seenKeys.add(item.key);

    if (!P0_DISPOSITION_ALLOWED_STATUSES.has(item.status)) {
      issues.push(`invalid_status:${item.key ?? "unknown"}:${item.status ?? "unset"}`);
    }
    if (!Array.isArray(item.evidenceKeys) || item.evidenceKeys.length === 0) {
      issues.push(`missing_evidence_keys:${item.key ?? "unknown"}`);
    }
    if (P0_DISPOSITION_TERMINAL_STATUSES.has(item.status)) {
      if (typeof item.proof !== "string" || item.proof.trim() === "") issues.push(`terminal_missing_proof:${item.key}`);
      if (typeof item.verifiedAt !== "string" || item.verifiedAt.trim() === "") issues.push(`terminal_missing_verified_at:${item.key}`);
      if (item.status === "product-accepted-drop") {
        if (typeof item.acceptedBy !== "string" || item.acceptedBy.trim() === "") issues.push(`drop_missing_accepted_by:${item.key}`);
        if (typeof item.acceptedAt !== "string" || item.acceptedAt.trim() === "") issues.push(`drop_missing_accepted_at:${item.key}`);
      }
    }
  }
  return issues;
}

const wranglerPath = path.join(shadowRoot, "wrangler.jsonc");
const wrangler = read(wranglerPath);
const wranglerConfig = parseWranglerConfig(wrangler);
const productionVars = productionVarsFromWrangler(wranglerConfig);
const d1Bindings = [...new Map(
  extractD1Bindings(wrangler).map((item) => [`${item.binding}:${item.database}:${item.id}`, item])
).values()];

const migrationDirs = [
  path.join(shadowRoot, "migrations", "core"),
  path.join(shadowRoot, "migrations", "observations")
].filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());

const d1Tables = [];
for (const dir of migrationDirs) {
  for (const file of walk(dir, (candidate) => candidate.endsWith(".sql"))) {
    const sql = read(file);
    d1Tables.push({
      migration: rel(file),
      tables: extractSqlTables(sql)
    });
  }
}

const fallbackSourceRoots = [
  path.join(shadowRoot, "src"),
  path.join(platformRoot, "src", "routes"),
  path.join(platformRoot, "src", "services"),
  path.join(platformRoot, "src", "scripts")
].filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());

const pgSourceRoots = [
  path.join(platformRoot, "src", "routes"),
  path.join(platformRoot, "src", "services"),
  path.join(platformRoot, "src", "scripts")
].filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());

const pgFiles = [];
const suppressedPgSignalNoiseFiles = [];
const originFallbackCalls = [];
const pgSourceFiles = [...new Set(
  pgSourceRoots.flatMap((dir) => walk(dir, (candidate) => /\.(ts|tsx|js|mjs)$/.test(candidate)))
)].sort((a, b) => rel(a).localeCompare(rel(b)));
const knownPgSourceFiles = new Set(pgSourceFiles.map((file) => rel(file)));
const runtimeImportedTestSourceFiles = new Set();
const importersByTarget = new Map();

function recordImporter(target, importer) {
  if (!importersByTarget.has(target)) importersByTarget.set(target, new Set());
  importersByTarget.get(target).add(importer);
}

for (const file of pgSourceFiles) {
  const relativeFile = rel(file);
  for (const specifier of extractLocalImportSpecifiers(read(file))) {
    const target = resolveLocalImport(relativeFile, specifier, knownPgSourceFiles);
    if (!target) continue;
    recordImporter(target, relativeFile);
    if (!isTestSourceFile(relativeFile) && isTestSourceFile(target)) runtimeImportedTestSourceFiles.add(target);
  }
}

for (const dir of fallbackSourceRoots) {
  for (const file of walk(dir, (candidate) => /\.(ts|tsx|js|mjs)$/.test(candidate))) {
    const text = read(file);
    originFallbackCalls.push(...extractOriginFallbackCalls(file, text));
  }
}

for (const file of pgSourceFiles) {
  const text = read(file);
  const flags = classifyPg(text);
  const suppressedNoise = classifySuppressedPgNoise(text);
  if (flags.length === 0 && suppressedNoise.length > 0) {
    suppressedPgSignalNoiseFiles.push({
      file: rel(file),
      signals: suppressedNoise
    });
  }
  if (flags.length === 0) continue;
  pgFiles.push({
    file: rel(file),
    flags,
    score: scorePg(flags, text),
    queryCount: count(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/gi, text)
  });
}

pgFiles.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
const maintenancePgFiles = pgFiles
  .filter((item) => !isTestSourceFile(item.file) && exclusiveMaintenancePgDependencyReason(item.file, importersByTarget))
  .map((item) => ({ ...item, maintenanceReason: exclusiveMaintenancePgDependencyReason(item.file, importersByTarget) }));
const replacedProductionRuntimePgFiles = pgFiles
  .filter((item) => !isTestSourceFile(item.file) && replacedProductionRuntimePgDependencyReason(item.file))
  .map((item) => ({ ...item, replacedReason: replacedProductionRuntimePgDependencyReason(item.file) }));
const optionalRuntimePgFiles = pgFiles
  .filter((item) => !isTestSourceFile(item.file) && optionalRuntimePgDependencyReason(item.file))
  .map((item) => ({ ...item, optionalReason: optionalRuntimePgDependencyReason(item.file) }));
const runtimePgFiles = pgFiles.filter((item) =>
  (!isTestSourceFile(item.file) || runtimeImportedTestSourceFiles.has(item.file))
    && !exclusiveMaintenancePgDependencyReason(item.file, importersByTarget)
    && !replacedProductionRuntimePgDependencyReason(item.file)
    && !optionalRuntimePgDependencyReason(item.file)
    && !isNoRuntimeQueryPgInventoryOnly(item)
);
const noRuntimeQueryPgInventoryFiles = pgFiles.filter((item) =>
  (!isTestSourceFile(item.file) || runtimeImportedTestSourceFiles.has(item.file))
    && !exclusiveMaintenancePgDependencyReason(item.file, importersByTarget)
    && !replacedProductionRuntimePgDependencyReason(item.file)
    && !optionalRuntimePgDependencyReason(item.file)
    && isNoRuntimeQueryPgInventoryOnly(item)
);
const testPgFiles = pgFiles.filter((item) => isTestSourceFile(item.file) && !runtimeImportedTestSourceFiles.has(item.file));
const runtimeImportedTestPgFiles = pgFiles.filter((item) => runtimeImportedTestSourceFiles.has(item.file));
originFallbackCalls.sort((a, b) => a.category.localeCompare(b.category) || a.reason.localeCompare(b.reason) || a.file.localeCompare(b.file) || a.line - b.line);

const fallbackCategoryCounts = new Map();
for (const item of originFallbackCalls) {
  fallbackCategoryCounts.set(item.category, (fallbackCategoryCounts.get(item.category) ?? 0) + 1);
}

const workflowsRoot = path.join(repoRoot, ".github", "workflows");
const workflowFiles = statSync(workflowsRoot, { throwIfNoEntry: false })?.isDirectory()
  ? walk(workflowsRoot, (candidate) => candidate.endsWith(".yml") || candidate.endsWith(".yaml"))
  : [];
const vpsWorkflows = workflowFiles
  .map((file) => ({ file: rel(file), text: read(file) }))
  .map(({ file, text }) => ({ file, signals: workflowDependencySignals(text) }))
  .filter(({ signals }) => signals.length > 0);
const maintenanceVpsWorkflows = vpsWorkflows
  .map((item) => ({ ...item, maintenanceReason: maintenanceWorkflowDependencyReason(item.file) }))
  .filter((item) => item.maintenanceReason);
const runtimeVpsWorkflows = vpsWorkflows.filter((item) => !maintenanceWorkflowDependencyReason(item.file));

const stopBlockers = [
  ...originFallbackCalls.map((item) => ({
    type: "origin_fallback",
    key: `${item.reason}@${item.file}:${item.line}`,
    reason: item.reason,
    category: item.category,
    severity: blockerSeverity({ type: "origin_fallback", category: item.category })
  })),
  ...runtimePgFiles.map((item) => ({
    type: "pg_dependency",
    key: item.file,
    category: item.flags.join(","),
    severity: blockerSeverity({ type: "pg_dependency", flags: item.flags })
  })),
  ...runtimeVpsWorkflows.map((item) => ({
    type: "workflow_dependency",
    key: item.file,
    category: item.signals.join(","),
    severity: "P1"
  }))
];

const configuredStopBlockers = stopBlockers
  .map((item) => ({ ...item, configured: configuredStateForBlocker(item, productionVars) }))
  .filter((item) => item.configured.active);

const p0DispositionManifest = loadP0DispositionManifest();
const p0DispositionItems = p0DispositionManifest.items;
const p0DispositionValidationIssues = validateP0DispositionManifest(p0DispositionManifest);
const configuredP0StopBlockers = configuredStopBlockers.filter((item) => item.severity === "P0");
const configuredP0StopBlockersWithDisposition = configuredP0StopBlockers.map((item) => ({
  ...item,
  disposition: dispositionForBlocker(item, p0DispositionItems)
}));
const configuredP0StopBlockersWithoutDisposition = configuredP0StopBlockersWithDisposition.filter((item) => !item.disposition);
const openP0DispositionItems = p0DispositionItems.filter((item) => !P0_DISPOSITION_TERMINAL_STATUSES.has(item.status));
const terminalP0DispositionItems = p0DispositionItems.filter((item) => P0_DISPOSITION_TERMINAL_STATUSES.has(item.status));
const p0DispositionGateReady = p0DispositionValidationIssues.length === 0
  && configuredP0StopBlockersWithoutDisposition.length === 0
  && openP0DispositionItems.length === 0;

const stopBlockerCounts = stopBlockers.reduce((acc, item) => {
  acc[item.severity] = (acc[item.severity] ?? 0) + 1;
  return acc;
}, {});

const vpsStopReady = stopBlockers.length === 0;
const configuredVpsStopReady = configuredStopBlockers.length === 0 && p0DispositionGateReady;

const lines = [
  "# ikimon.life D1 / VPS PostgreSQL Migration Boundary Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  ...section("D1 Bindings"),
  ...d1Bindings.map((item) => `- ${item.binding}: ${item.database} (${item.id})`),
  "",
  ...section("D1 Migration Tables"),
  ...d1Tables.flatMap((item) => [
    `- ${item.migration}`,
    item.tables.length ? `  - tables: ${item.tables.join(", ")}` : "  - tables: none"
  ]),
  "",
  ...section("PostgreSQL Runtime Dependencies"),
  "- blocker_scope: files with PostgreSQL runtime query APIs, vector/full-text signals, or locking signals; standalone test/source-test files, Cloudflare-replaced production runtime files, optional runtime cache files, and no-runtime-query inventory files are reported below but excluded from blocker_count.",
  `- files_scanned_with_pg_signals: ${pgFiles.length}`,
  `- runtime_pg_dependency_files: ${runtimePgFiles.length}`,
  `- replaced_production_runtime_pg_dependency_files: ${replacedProductionRuntimePgFiles.length}`,
  `- optional_runtime_pg_dependency_files: ${optionalRuntimePgFiles.length}`,
  `- no_runtime_query_pg_inventory_files: ${noRuntimeQueryPgInventoryFiles.length}`,
  `- maintenance_pg_dependency_files: ${maintenancePgFiles.length}`,
  `- test_pg_dependency_files: ${testPgFiles.length}`,
  `- runtime_imported_test_pg_dependency_files: ${runtimeImportedTestPgFiles.length}`,
  `- displayed_pg_dependencies: ${Math.min(PG_DEPENDENCY_TABLE_LIMIT, runtimePgFiles.length)} of ${runtimePgFiles.length}`,
  "",
  "| score | file | flags | query_count |",
  "|---:|---|---|---:|",
  ...runtimePgFiles.slice(0, PG_DEPENDENCY_TABLE_LIMIT).map((item) => `| ${item.score} | ${item.file} | ${item.flags.join(", ")} | ${item.queryCount} |`),
  "",
  ...section("PostgreSQL Maintenance Dependencies"),
  "- blocker_scope: CLI/manual maintenance tools and explicitly gated staging fixture ops only; these are PostgreSQL-dependent but do not keep ordinary production request runtime dependent on the VPS.",
  `- maintenance_pg_dependency_files: ${maintenancePgFiles.length}`,
  "",
  "| score | file | flags | query_count | maintenance_reason |",
  "|---:|---|---|---:|---|",
  ...maintenancePgFiles.slice(0, 40).map((item) => `| ${item.score} | ${item.file} | ${item.flags.join(", ")} | ${item.queryCount} | ${item.maintenanceReason} |`),
  "",
  ...section("PostgreSQL Cloudflare-Replaced Production Runtime"),
  "- blocker_scope: visible inventory only; these legacy Node/VPS PostgreSQL runtime files are excluded because production traffic is already owned by Cloudflare Worker + D1/R2 routes with regression tests.",
  `- replaced_production_runtime_pg_dependency_files: ${replacedProductionRuntimePgFiles.length}`,
  "",
  "| score | file | flags | query_count | replaced_reason |",
  "|---:|---|---|---:|---|",
  ...replacedProductionRuntimePgFiles.slice(0, 40).map((item) => `| ${item.score} | ${item.file} | ${item.flags.join(", ")} | ${item.queryCount} | ${item.replacedReason} |`),
  "",
  ...section("PostgreSQL Optional Runtime Dependencies"),
  "- blocker_scope: visible inventory only; these production runtime files may attempt PostgreSQL cache reads/writes but are explicitly non-fatal and fall back when PostgreSQL is unavailable.",
  `- optional_runtime_pg_dependency_files: ${optionalRuntimePgFiles.length}`,
  "",
  "| score | file | flags | query_count | optional_reason |",
  "|---:|---|---|---:|---|",
  ...optionalRuntimePgFiles.slice(0, 40).map((item) => `| ${item.score} | ${item.file} | ${item.flags.join(", ")} | ${item.queryCount} | ${item.optionalReason} |`),
  "",
  ...section("PostgreSQL No-Runtime-Query Inventory"),
  "- blocker_scope: visible audit inventory only; these files contain PostGIS, DATABASE_URL/PG env, or PostgreSQL type SQL text but no PostgreSQL runtime query API, vector/full-text, or locking signal.",
  `- no_runtime_query_pg_inventory_files: ${noRuntimeQueryPgInventoryFiles.length}`,
  "",
  "| score | file | flags | query_count |",
  "|---:|---|---|---:|",
  ...noRuntimeQueryPgInventoryFiles.slice(0, 40).map((item) => `| ${item.score} | ${item.file} | ${item.flags.join(", ")} | ${item.queryCount} |`),
  "",
  ...section("PostgreSQL Test Source Dependencies"),
  "- blocker_scope: visible audit inventory only; these files must not be read as VPS-stop-ready while runtime blockers remain.",
  `- test_pg_dependency_files: ${testPgFiles.length}`,
  "",
  "| score | file | flags | query_count |",
  "|---:|---|---|---:|",
  ...testPgFiles.slice(0, 40).map((item) => `| ${item.score} | ${item.file} | ${item.flags.join(", ")} | ${item.queryCount} |`),
  "",
  ...section("PostgreSQL Signal Noise Suppression"),
  `- js_noise_suppressed_files: ${suppressedPgSignalNoiseFiles.length}`,
  "",
  "| file | suppressed_signals |",
  "|---|---|",
  ...suppressedPgSignalNoiseFiles.slice(0, 40).map((item) => `| ${item.file} | ${item.signals.join(", ")} |`),
  "",
  ...section("Origin Fallback Dependencies"),
  `- fallback_call_count: ${originFallbackCalls.length}`,
  `- categories: ${[...fallbackCategoryCounts.entries()].map(([category, value]) => `${category}=${value}`).join(", ") || "none"}`,
  "",
  "| category | reason | file | line |",
  "|---|---|---|---:|",
  ...originFallbackCalls.map((item) => `| ${item.category} | ${item.reason} | ${item.file} | ${item.line} |`),
  "",
  ...section("Production Fallback Configuration"),
  `- PUBLIC_WRITE_MODE: ${productionVars.PUBLIC_WRITE_MODE ?? "unset"}`,
  `- ORIGIN_SESSION_IMPORT_MODE: ${productionVars.ORIGIN_SESSION_IMPORT_MODE ?? "unset"}`,
  `- ORIGIN_FALLBACK_BASE_URL: ${productionVars.ORIGIN_FALLBACK_BASE_URL ? "configured" : "unset"}`,
  `- ORIGIN_FALLBACK_RESOLVE_OVERRIDE: ${productionVars.ORIGIN_FALLBACK_RESOLVE_OVERRIDE ? "configured" : "unset"}`,
  "",
  "| reason | configured_state | note |",
  "|---|---|---|",
  ...originFallbackCalls.map((item) => {
    const state = configuredStateForFallback(item, productionVars);
    return `| ${item.reason} | ${state.active ? "active" : "dormant"} | ${state.note} |`;
  }),
  "",
  ...section("VPS Workflow Runtime Dependencies"),
  "- blocker_scope: workflows that still deploy, call, or configure production/staging runtime paths through VPS, PostgreSQL, SSH, SCP, or migration commands.",
  `- runtime_vps_workflow_files: ${runtimeVpsWorkflows.length}`,
  "",
  "| file | signals |",
  "|---|---|",
  ...runtimeVpsWorkflows.map((item) => `| ${item.file} | ${item.signals.join(", ")} |`),
  "",
  ...section("VPS Workflow Maintenance Dependencies"),
  "- blocker_scope: CI/manual maintenance workflow inventory only; these workflows may use PostgreSQL or VPS credentials but do not keep ordinary production request runtime dependent on the VPS.",
  `- maintenance_vps_workflow_files: ${maintenanceVpsWorkflows.length}`,
  "",
  "| file | signals | maintenance_reason |",
  "|---|---|---|",
  ...maintenanceVpsWorkflows.map((item) => `| ${item.file} | ${item.signals.join(", ")} | ${item.maintenanceReason} |`),
  "",
  ...section("P0 Capability Disposition Gate"),
  "- purpose: a P0 capability is not resolved just because a file or fallback reason disappears; it must be migrated, replaced by an equivalent route, or explicitly accepted as a product drop.",
  `- manifest: ${p0DispositionManifest.file}`,
  `- status: ${p0DispositionGateReady ? "ready" : "blocked"}`,
  `- p0_capability_items: ${p0DispositionItems.length}`,
  `- p0_open_capabilities: ${openP0DispositionItems.length}`,
  `- p0_terminal_capabilities: ${terminalP0DispositionItems.length}`,
  `- configured_p0_blockers_without_disposition: ${configuredP0StopBlockersWithoutDisposition.length}`,
  `- validation_issues: ${p0DispositionValidationIssues.length ? p0DispositionValidationIssues.join(", ") : "none"}`,
  "",
  "| key | status | owner | scope | evidence_keys | next_proof_required |",
  "|---|---|---|---|---|---|",
  ...p0DispositionItems.map((item) => `| ${item.key} | ${item.status} | ${item.owner ?? ""} | ${item.scope ?? ""} | ${(item.evidenceKeys ?? []).join("<br>")} | ${item.nextProofRequired ?? item.proof ?? ""} |`),
  "",
  "| severity | type | category | key |",
  "|---|---|---|---|",
  ...configuredP0StopBlockersWithoutDisposition.map((item) => `| ${item.severity} | ${item.type} | ${item.category} | ${item.key} |`),
  "",
  ...section("VPS Stop Readiness Gate"),
  `- status: ${vpsStopReady ? "ready" : "blocked"}`,
  `- blocker_count: ${stopBlockers.length}`,
  `- p0_blockers: ${stopBlockerCounts.P0 ?? 0}`,
  `- p1_blockers: ${stopBlockerCounts.P1 ?? 0}`,
  `- p2_blockers: ${stopBlockerCounts.P2 ?? 0}`,
  "",
  "| severity | type | category | key |",
  "|---|---|---|---|",
  ...stopBlockers
    .sort((a, b) => a.severity.localeCompare(b.severity) || a.type.localeCompare(b.type) || a.key.localeCompare(b.key))
    .slice(0, STOP_BLOCKER_TABLE_LIMIT)
    .map((item) => `| ${item.severity} | ${item.type} | ${item.category} | ${item.key} |`),
  "",
  ...section("Configured Production VPS Stop Readiness Gate"),
  `- status: ${configuredVpsStopReady ? "ready" : "blocked"}`,
  `- blocker_count: ${configuredStopBlockers.length}`,
  `- p0_blockers: ${configuredStopBlockers.filter((item) => item.severity === "P0").length}`,
  `- p1_blockers: ${configuredStopBlockers.filter((item) => item.severity === "P1").length}`,
  `- p2_blockers: ${configuredStopBlockers.filter((item) => item.severity === "P2").length}`,
  `- p0_disposition_gate: ${p0DispositionGateReady ? "ready" : "blocked"}`,
  "",
  "| severity | type | category | configured_note | key |",
  "|---|---|---|---|---|",
  ...configuredStopBlockers
    .sort((a, b) => a.severity.localeCompare(b.severity) || a.type.localeCompare(b.type) || a.key.localeCompare(b.key))
    .slice(0, STOP_BLOCKER_TABLE_LIMIT)
    .map((item) => `| ${item.severity} | ${item.type} | ${item.category} | ${item.configured.note} | ${item.key} |`),
  "",
  ...section("Migration Priority Heuristic"),
  "- P0: active origin fallbacks, PostgreSQL vector dependencies, and true background/job fanout locking such as SKIP LOCKED, LISTEN, or NOTIFY.",
  "- P1: authenticated/user-facing PostgreSQL runtime dependencies, including ordinary FOR UPDATE row-locking workflows that still need D1 parity.",
  "- P2: remaining PostgreSQL dependencies without runtime-query evidence but with vector/full-text or locking signals that still need manual disposition.",
  "- P3: PostGIS/vector/background-job heavy services; these need redesign, not mechanical SQL conversion.",
  ""
];

console.log(lines.join("\n"));

if (process.argv.includes("--fail-on-vps-blockers") && !configuredVpsStopReady) {
  process.exitCode = 2;
}
