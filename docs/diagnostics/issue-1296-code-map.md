# Issue 1296 post-flow code map

- SHA: dad7cfca3bd598024d19a20e782166169a56d3d9
- Generated: 2026-07-12T21:39:01Z

## Candidate files
- `platform_v2/cloudflare_shadow/src/d1-migration-boundary-report.test.ts`
- `platform_v2/cloudflare_shadow/src/data-repair-migrations.test.ts`
- `platform_v2/cloudflare_shadow/src/lenriBoundaryMigration.test.ts`
- `platform_v2/cloudflare_shadow/src/ownerHomeInjectionContract.test.ts`
- `platform_v2/cloudflare_shadow/src/recordRecoveryHtml.test.ts`
- `platform_v2/cloudflare_shadow/src/recordRecoveryHtml.ts`
- `platform_v2/db/migrations/0001_extensions_and_core.sql`
- `platform_v2/db/migrations/0002_programs_and_sync.sql`
- `platform_v2/db/migrations/0003_delta_sync_idempotency.sql`
- `platform_v2/db/migrations/0004_normalize_delta_conflict_indexes.sql`
- `platform_v2/db/migrations/0005_import_ledgers.sql`
- `platform_v2/db/migrations/0006_ui_kpi_events.sql`
- `platform_v2/db/migrations/0007_field_context.sql`
- `platform_v2/db/migrations/0008_site_signals_cache.sql`
- `platform_v2/db/migrations/0009_walk_sessions.sql`
- `platform_v2/db/migrations/0011_guide_records.sql`
- `platform_v2/db/migrations/0012_contact_submissions.sql`
- `platform_v2/db/migrations/0013_video_upload_requests.sql`
- `platform_v2/db/migrations/0014_audio_segments.sql`
- `platform_v2/db/migrations/0015_observation_reactions_and_insights.sql`
- `platform_v2/db/migrations/0016_observation_ai_assessments.sql`
- `platform_v2/db/migrations/0017_taxa_gbif_cache.sql`
- `platform_v2/db/migrations/0018_ai_runs_and_visit_display_state.sql`
- `platform_v2/db/migrations/0018_specialist_authorities.sql`
- `platform_v2/db/migrations/0019_authority_recommendations.sql`
- `platform_v2/db/migrations/0020_audio_privacy_and_bundles.sql`
- `platform_v2/db/migrations/0021_official_notice_cache.sql`
- `platform_v2/db/migrations/0022_taxon_precision_policy.sql`
- `platform_v2/db/migrations/0023_identification_accepted_rank.sql`
- `platform_v2/db/migrations/0024_observation_ai_area_inference.sql`
- `platform_v2/db/migrations/0025_evidence_asset_role_tag.sql`
- `platform_v2/db/migrations/0026_plot_monitoring.sql`
- `platform_v2/db/migrations/0027_observation_quality_reviews.sql`
- `platform_v2/db/migrations/0028_identification_disputes.sql`
- `platform_v2/db/migrations/0029_guide_latency_states.sql`
- `platform_v2/db/migrations/0030_profile_note_digests.sql`
- `platform_v2/db/migrations/0031_relationship_score_foundations.sql`
- `platform_v2/db/migrations/0032_evidence_asset_media_roles.sql`
- `platform_v2/db/migrations/0033_video_processing_jobs.sql`
- `platform_v2/db/migrations/0034_media_processing_jobs.sql`
- `platform_v2/db/migrations/0035_observation_events_realtime.sql`
- `platform_v2/db/migrations/0036_observation_fields.sql`
- `platform_v2/db/migrations/0037_audio_embeddings.sql`
- `platform_v2/db/migrations/0038_sound_clusters.sql`
- `platform_v2/db/migrations/0039_audio_review_workflow.sql`
- `platform_v2/db/migrations/0040_observation_write_idempotency.sql`
- `platform_v2/db/migrations/0045_source_snapshots.sql`
- `platform_v2/db/migrations/0046_freshness_registry.sql`
- `platform_v2/db/migrations/0047_ai_curator_runs.sql`
- `platform_v2/db/migrations/0048_ai_cost_log.sql`
- `platform_v2/db/migrations/0049_knowledge_claims_compat.sql`
- `platform_v2/db/migrations/0050_invasive_status_versions.sql`
- `platform_v2/db/migrations/0051_risk_status_versions.sql`
- `platform_v2/db/migrations/0052_taxonomy_versions.sql`
- `platform_v2/db/migrations/0053_taxon_name_mappings.sql`
- `platform_v2/db/migrations/0054_place_environment_snapshots.sql`
- `platform_v2/db/migrations/0055_claim_review_queue.sql`
- `platform_v2/db/migrations/0056_user_output_cache.sql`
- `platform_v2/db/migrations/0057_staleness_alerts.sql`
- `platform_v2/db/migrations/0058_inferred_absence_candidates.sql`
- `platform_v2/db/migrations/0059_knowledge_claims_embedding.sql`
- `platform_v2/db/migrations/0060_research_paper_ingest_queue.sql`
- `platform_v2/db/migrations/0061_occurrences_three_lenses.sql`
- `platform_v2/db/migrations/0062_taxon_alert_subscriptions.sql`
- `platform_v2/db/migrations/0063_alert_recipients_and_deliveries.sql`
- `platform_v2/db/migrations/0064_user_notification_preferences.sql`
- `platform_v2/db/migrations/0065_curator_run_attempts.sql`
- `platform_v2/db/migrations/0066_curator_run_gemini_telemetry.sql`
- `platform_v2/db/migrations/0067_regional_knowledge_cards.sql`
- `platform_v2/db/migrations/0068_regional_knowledge_embeddings.sql`
- `platform_v2/db/migrations/0069_guide_record_corrections.sql`
- `platform_v2/db/migrations/0070_guide_environment_mesh_cells.sql`
- `platform_v2/db/migrations/0071_knowledge_navigation.sql`
- `platform_v2/db/migrations/0072_regional_hypotheses_and_guide_interactions.sql`
- `platform_v2/db/migrations/0073_guide_environment_ops_loop.sql`
- `platform_v2/db/migrations/0074_guide_prompt_improvement_queue.sql`
- `platform_v2/db/migrations/0075_normalize_shizuoka_locality_labels.sql`
- `platform_v2/db/migrations/0076_expand_observation_ui_kpi_events.sql`
- `platform_v2/db/migrations/0077_civic_nature_context.sql`
- `platform_v2/db/migrations/0079_observation_fields_polygon_index.sql`
- `platform_v2/db/migrations/0080_observation_fields_admin_layer.sql`
- `platform_v2/db/migrations/0081_field_managers.sql`
- `platform_v2/db/migrations/0082_visit_field_resolution.sql`
- `platform_v2/db/migrations/0083_extend_stewardship_action_kinds.sql`
- `platform_v2/db/migrations/0085_expand_ui_kpi_record_funnel_events.sql`
- `platform_v2/db/migrations/0086_observation_field_identity_legacy_columns.sql`
- `platform_v2/db/migrations/0087_observation_field_identity_legacy_column_repair.sql`
- `platform_v2/db/migrations/0088_user_defined_field_identity_backfill.sql`
- `platform_v2/db/migrations/0089_passive_audio_ingest_events.sql`
- `platform_v2/db/migrations/0090_mobile_field_session_receipts.sql`
- `platform_v2/db/migrations/0091_osm_area_tile_cache.sql`
- `platform_v2/db/migrations/0092_evidence_assets_visit_role_lookup.sql`
- `platform_v2/db/migrations/0093_user_area_subscriptions.sql`
- `platform_v2/db/migrations/0094_publish_valid_video_observations.sql`
- `platform_v2/db/migrations/0095_observation_fields_school_source.sql`
- `platform_v2/db/migrations/0096_fix_aikan_renri_official_url.sql`
- `platform_v2/db/migrations/0097_observation_field_source_links.sql`
- `platform_v2/db/migrations/0098_observation_field_verification_model.sql`
- `platform_v2/db/migrations/0099_monitoring_package_foundation.sql`
- `platform_v2/db/migrations/0100_observation_package_data_chain.sql`
- `platform_v2/db/migrations/0101_site_based_monitoring_os.sql`
- `platform_v2/db/migrations/0102_visual_evidence_extracts_and_vertex_ai.sql`
- `platform_v2/db/migrations/0103_observation_record_ai_reviews.sql`
- `platform_v2/db/migrations/0104_observation_event_capsules.sql`
- `platform_v2/db/migrations/0104_reference_library_and_commerce.sql`
- `platform_v2/db/migrations/0105_subject_proposal_notifications.sql`
- `platform_v2/db/migrations/0106_materialize_visible_ai_subject_candidates.sql`
- `platform_v2/db/migrations/0107_record_conversion_kpi_daily_view.sql`
- `platform_v2/db/migrations/0107_text_ids_for_ai_hot_cache.sql`
- `platform_v2/db/migrations/0108_place_management_policies.sql`
- `platform_v2/db/migrations/0109_fix_aikan_renri_city.sql`
- `platform_v2/db/migrations/0109_invasive_reporting_foundation.sql`
- `platform_v2/db/migrations/0110_guide_session_public_summary.sql`
- `platform_v2/db/migrations/0110_observation_rally_foundation.sql`
- `platform_v2/db/migrations/0111_backfill_ai_candidate_scientific_names.sql`
- `platform_v2/db/migrations/0112_backfill_primary_ai_scientific_names.sql`
- `platform_v2/db/migrations/0113_area_watch_notifications.sql`
- `platform_v2/db/migrations/0114_continuous_visit_windows.sql`
- `platform_v2/db/migrations/0114_landing_snapshot_media_indexes.sql`
- `platform_v2/db/migrations/0114_repair_non_biological_subject_labels.sql`
- `platform_v2/db/migrations/0115_record_reading_cards.sql`
- `platform_v2/db/migrations/0116_place_memory_full_v1.sql`
- `platform_v2/db/migrations/0117_glossary_terms.sql`
- `platform_v2/db/migrations/0117_observation_rally_submission_idempotency.sql`
- `platform_v2/db/migrations/0117_public_map_snapshots.sql`
- `platform_v2/db/migrations/0118_glossary_term_candidates.sql`
- `platform_v2/db/migrations/0119_area_sketch_assessments.sql`
- `platform_v2/db/migrations/0119_taxon_insight_context_key.sql`
- `platform_v2/db/migrations/0120_observation_spatial_mesh_keys.sql`
- `platform_v2/db/migrations/0121_guide_unlock_program_p0.sql`
- `platform_v2/db/migrations/0122_guide_program_editor_p1.sql`
- `platform_v2/db/migrations/0123_municipal_walk_maps.sql`
- `platform_v2/db/migrations/0124_record_feedback_ready_notifications.sql`
- `platform_v2/db/migrations/0125_site_intelligence_field_profile_foundation.sql`
- `platform_v2/db/migrations/0126_observation_area_profile_rights.sql`
- `platform_v2/db/migrations/0127_observation_publication_policy.sql`
- `platform_v2/db/migrations/0128_field_public_profile_rules.sql`
- `platform_v2/db/migrations/0129_field_profile_generation_history.sql`
- `platform_v2/db/migrations/0130_aikan_lenri_verified_boundary.sql`
- `platform_v2/src/i18n/observationEventStrings.ts`
- `platform_v2/src/migrationHistoryContract.test.ts`
- `platform_v2/src/routes/adminAudioApi.ts`
- `platform_v2/src/routes/adminDataHealth.test.ts`
- `platform_v2/src/routes/adminDataHealth.ts`
- `platform_v2/src/routes/adminGuidePrograms.test.ts`
- `platform_v2/src/routes/adminGuidePrograms.ts`
- `platform_v2/src/routes/adminGuidePromptImprovements.test.ts`
- `platform_v2/src/routes/adminGuidePromptImprovements.ts`
- `platform_v2/src/routes/adminLenriAreaIntelligence.test.ts`
- `platform_v2/src/routes/adminLenriAreaIntelligence.ts`
- `platform_v2/src/routes/adminMonitoringWorkspace.test.ts`
- `platform_v2/src/routes/adminMonitoringWorkspace.ts`
- `platform_v2/src/routes/adminRegionalKnowledge.ts`
- `platform_v2/src/routes/adminSiteEvidence.test.ts`
- `platform_v2/src/routes/adminSiteEvidence.ts`
- `platform_v2/src/routes/adminSoundReviewPages.ts`
- `platform_v2/src/routes/areaSketchAssessments.routes.test.ts`
- `platform_v2/src/routes/audioVectorRetirement.test.ts`
- `platform_v2/src/routes/auth.routes.test.ts`
- `platform_v2/src/routes/auth.ts`
- `platform_v2/src/routes/authSession.routes.test.ts`
- `platform_v2/src/routes/curatorProposalsApi.ts`
- `platform_v2/src/routes/fieldscanApi.ts`
- `platform_v2/src/routes/fieldscanIdentity.routes.test.ts`
- `platform_v2/src/routes/guideApi.test.ts`
- `platform_v2/src/routes/guideApi.ts`
- `platform_v2/src/routes/guideRead.ts`
- `platform_v2/src/routes/guideRecordsDebug.test.ts`
- `platform_v2/src/routes/guideRecordsDebug.ts`
- `platform_v2/src/routes/health.ts`
- `platform_v2/src/routes/identification.write.routes.test.ts`
- `platform_v2/src/routes/invasiveSpecies.routes.test.ts`
- `platform_v2/src/routes/invasiveSpecies.ts`
- `platform_v2/src/routes/knowledgeNavigationApi.test.ts`
- `platform_v2/src/routes/knowledgeNavigationApi.ts`
- `platform_v2/src/routes/legacyAssets.routes.test.ts`
- `platform_v2/src/routes/legacyAssets.ts`
- `platform_v2/src/routes/llmo.routes.test.ts`
- `platform_v2/src/routes/llmo.ts`
- `platform_v2/src/routes/logout.routes.test.ts`
- `platform_v2/src/routes/map.read.routes.test.ts`
- `platform_v2/src/routes/mapApi.publicMap.routes.test.ts`
- `platform_v2/src/routes/mapApi.siteBrief.routes.test.ts`
- `platform_v2/src/routes/mapApi.ts`
- `platform_v2/src/routes/mapRead.ts`
- `platform_v2/src/routes/marketing.routes.test.ts`
- `platform_v2/src/routes/marketing.ts`
- `platform_v2/src/routes/meSubscriptionsApi.ts`
- `platform_v2/src/routes/mobileFieldSessionsApi.test.ts`
- `platform_v2/src/routes/mobileFieldSessionsApi.ts`
- `platform_v2/src/routes/monitoringBusiness.routes.test.ts`
- `platform_v2/src/routes/monitoringBusiness.ts`
- `platform_v2/src/routes/monitoringWorkspaceApi.routes.test.ts`
- `platform_v2/src/routes/monitoringWorkspaceApi.ts`
- `platform_v2/src/routes/observationDetailFriendlyCopy.test.ts`
- `platform_v2/src/routes/observationDetailSnapshotContract.test.ts`
- `platform_v2/src/routes/observationEventApi.ts`
- `platform_v2/src/routes/observationEventArea.routes.test.ts`
- `platform_v2/src/routes/observationEventCapsule.routes.test.ts`
- `platform_v2/src/routes/observationEventLive.routes.test.ts`
- `platform_v2/src/routes/observationEventPages.ts`
- `platform_v2/src/routes/observationEventRecapApi.ts`
- `platform_v2/src/routes/observationFieldsApi.siteIntelligence.routes.test.ts`
- `platform_v2/src/routes/observationFieldsApi.ts`
- `platform_v2/src/routes/observationPackageApi.routes.test.ts`
- `platform_v2/src/routes/observationPackageApi.ts`
- `platform_v2/src/routes/observationPhotoRecovery.routes.test.ts`
- `platform_v2/src/routes/observationRally.routes.test.ts`
- `platform_v2/src/routes/ops.ts`
- `platform_v2/src/routes/passiveAudioIngestApi.test.ts`
- `platform_v2/src/routes/passiveAudioIngestApi.ts`
- `platform_v2/src/routes/placeFeelingDemoRead.ts`
- `platform_v2/src/routes/placeManagementPolicyApi.ts`
- `platform_v2/src/routes/placeMemoryApi.ts`
- `platform_v2/src/routes/placeStationRead.ts`
- `platform_v2/src/routes/plotMonitoringApi.routes.test.ts`
- `platform_v2/src/routes/plotMonitoringApi.ts`
- `platform_v2/src/routes/productionSmokePrivatePosts.contract.test.ts`
- `platform_v2/src/routes/profileHub.test.ts`
- `platform_v2/src/routes/profilePublicSafety.test.ts`
- `platform_v2/src/routes/publicCopy.routes.test.ts`
- `platform_v2/src/routes/publicEntryRead.ts`
- `platform_v2/src/routes/pwa.routes.test.ts`
- `platform_v2/src/routes/pwa.ts`
- `platform_v2/src/routes/read.ts`
- `platform_v2/src/routes/record.routes.test.ts`
- `platform_v2/src/routes/recordReadingCards.routes.test.ts`
- `platform_v2/src/routes/recordRecoverySource.contract.test.ts`
- `platform_v2/src/routes/recordWaterRecord.routes.test.ts`
- `platform_v2/src/routes/recordsSavedIdSafety.test.ts`
- `platform_v2/src/routes/references.ts`
- `platform_v2/src/routes/researchApi.monitoring.test.ts`
- `platform_v2/src/routes/researchApi.ts`
- `platform_v2/src/routes/retiredRoutes.routes.test.ts`
- `platform_v2/src/routes/runtimeVersion.routes.test.ts`
- `platform_v2/src/routes/sampleReport.ts`
- `platform_v2/src/routes/serviceWorkerCleanup.routes.test.ts`
- `platform_v2/src/routes/siteMap.routes.test.ts`
- `platform_v2/src/routes/siteMapRoutes.ts`
- `platform_v2/src/routes/specialistReadApi.ts`
- `platform_v2/src/routes/stagingFixtures.routes.test.ts`
- `platform_v2/src/routes/stewardshipActions.ts`
- `platform_v2/src/routes/uiKpi.routes.test.ts`
- `platform_v2/src/routes/uiKpi.ts`
- `platform_v2/src/routes/walkApi.ts`
- `platform_v2/src/routes/write.routes.test.ts`
- `platform_v2/src/routes/write.ts`
- `platform_v2/src/scripts/applyMigrations.source.test.ts`
- `platform_v2/src/scripts/applyMigrations.ts`
- `platform_v2/src/scripts/auditObservationFieldEntityKeys.ts`
- `platform_v2/src/scripts/auditObservationLocations.test.ts`
- `platform_v2/src/scripts/auditObservationLocations.ts`
- `platform_v2/src/scripts/backfillObservationLocalityFromAdminAreas.ts`
- `platform_v2/src/scripts/checkObservationCopyQuality.ts`
- `platform_v2/src/scripts/cleanupObservationSameSubjectAiCandidates.test.ts`
- `platform_v2/src/scripts/cleanupObservationSameSubjectAiCandidates.ts`
- `platform_v2/src/scripts/importInvasiveKnowledgeClaims.test.ts`
- `platform_v2/src/scripts/importInvasiveKnowledgeClaims.ts`
- `platform_v2/src/scripts/importLegacyAiAssessments.ts`
- `platform_v2/src/scripts/importObservationEvidence.ts`
- `platform_v2/src/scripts/importObservationFeedbackKnowledgeClaims.test.ts`
- `platform_v2/src/scripts/importObservationFeedbackKnowledgeClaims.ts`
- `platform_v2/src/scripts/importObservationFields.seed.test.ts`
- `platform_v2/src/scripts/importObservationFields.ts`
- `platform_v2/src/scripts/importObservationIdentification.ts`
- `platform_v2/src/scripts/importObservationMeaning.ts`
- `platform_v2/src/scripts/importObservationPlaceCondition.ts`
- `platform_v2/src/scripts/planObservationLedger.ts`
- `platform_v2/src/scripts/refreshRecentObservationAi.ts`
- `platform_v2/src/scripts/repairHamamatsuWardLabels.test.ts`
- `platform_v2/src/scripts/repairHamamatsuWardLabels.ts`
- `platform_v2/src/scripts/repairMissingManualOccurrences.ts`
- `platform_v2/src/scripts/repairObservationFieldSourcePolicy.ts`
- `platform_v2/src/scripts/repairObservationLocationLabels.ts`
- `platform_v2/src/scripts/repairObservationSpatialMeshSchema.ts`
- `platform_v2/src/scripts/repairStagingNatsIdentity.ts`
- `platform_v2/src/scripts/reportMigrationBaseline.test.ts`
- `platform_v2/src/scripts/reportMigrationBaseline.ts`
- `platform_v2/src/scripts/reportMissingObservationPhotos.ts`
- `platform_v2/src/scripts/reportVisitWindows.ts`
- `platform_v2/src/scripts/resolveObservationImageTargets.test.ts`
- `platform_v2/src/scripts/resolveObservationImageTargets.ts`
- `platform_v2/src/scripts/runAiForMissing.ts`
- `platform_v2/src/scripts/runObservationImageTargetE2e.ts`
- `platform_v2/src/scripts/smokeProductionMediaUpload.test.ts`
- `platform_v2/src/scripts/smokeProductionMediaUpload.ts`
- `platform_v2/src/services/aiBudgetGate.ts`
- `platform_v2/src/services/aiCostLogger.ts`
- `platform_v2/src/services/aiJudgementObservationRecords.test.ts`
- `platform_v2/src/services/aiJudgementObservationRecords.ts`
- `platform_v2/src/services/aiModelPricing.test.ts`
- `platform_v2/src/services/aiModelPricing.ts`
- `platform_v2/src/services/aiModelRouter.test.ts`
- `platform_v2/src/services/aiModelRouter.ts`
- `platform_v2/src/services/aiModels.test.ts`
- `platform_v2/src/services/aiModels.ts`
- `platform_v2/src/services/areaSnapshotVisitScope.test.ts`
- `platform_v2/src/services/areaSnapshotVisitScope.ts`
- `platform_v2/src/services/contentClaimsValidator.test.ts`
- `platform_v2/src/services/contentClaimsValidator.ts`
- `platform_v2/src/services/environmentRecord.test.ts`
- `platform_v2/src/services/environmentRecord.ts`
- `platform_v2/src/services/evidenceAssetMediaRole.ts`
- `platform_v2/src/services/fieldProfileGenerationHistory.test.ts`
- `platform_v2/src/services/fieldProfileGenerationHistory.ts`
- `platform_v2/src/services/fieldProfilePolicy.test.ts`
- `platform_v2/src/services/fieldProfilePolicy.ts`
- `platform_v2/src/services/fieldPublicProfile.test.ts`
- `platform_v2/src/services/fieldPublicProfile.ts`
- `platform_v2/src/services/fieldPublicProfileRules.test.ts`
- `platform_v2/src/services/fieldPublicProfileRules.ts`
- `platform_v2/src/services/fieldPublicProfileView.test.ts`
- `platform_v2/src/services/fieldPublicProfileView.ts`
- `platform_v2/src/services/guideRecordInsights.test.ts`
- `platform_v2/src/services/guideRecordInsights.ts`
- `platform_v2/src/services/guideRecordPromotion.test.ts`
- `platform_v2/src/services/guideRecordPromotion.ts`
- `platform_v2/src/services/guideRouteTrack.ts`
- `platform_v2/src/services/knowledgeClaimRetrieval.ts`
- `platform_v2/src/services/lenriAreaIntelligence.test.ts`
- `platform_v2/src/services/lenriAreaIntelligence.ts`
- `platform_v2/src/services/mapOwnObservations.test.ts`
- `platform_v2/src/services/mapOwnObservations.ts`
- `platform_v2/src/services/mapVisitedPlaces.test.ts`
- `platform_v2/src/services/mapVisitedPlaces.ts`
- `platform_v2/src/services/mediaObjectStore.test.ts`
- `platform_v2/src/services/mediaObjectStore.ts`
- `platform_v2/src/services/mediaProcessingJobs.ts`
- `platform_v2/src/services/mediaRole.test.ts`
- `platform_v2/src/services/mediaRole.ts`
- `platform_v2/src/services/monitoringPackageMigration.test.ts`
- `platform_v2/src/services/monitoringRecordContract.test.ts`
- `platform_v2/src/services/monitoringRecordContract.ts`
- `platform_v2/src/services/observationAiAssessment.threeLens.test.ts`
- `platform_v2/src/services/observationAiAssessment.ts`
- `platform_v2/src/services/observationAiRuns.ts`
- `platform_v2/src/services/observationContext.ts`
- `platform_v2/src/services/observationDataRights.test.ts`
- `platform_v2/src/services/observationDataRights.ts`
- `platform_v2/src/services/observationDetailHeavy.ts`
- `platform_v2/src/services/observationDetailLink.ts`
- `platform_v2/src/services/observationEventAreaGeometry.test.ts`
- `platform_v2/src/services/observationEventAreaGeometry.ts`
- `platform_v2/src/services/observationEventAreaPlanner.test.ts`
- `platform_v2/src/services/observationEventAreaPlanner.ts`
- `platform_v2/src/services/observationEventAreaSignals.test.ts`
- `platform_v2/src/services/observationEventAreaSignals.ts`
- `platform_v2/src/services/observationEventCapsule.test.ts`
- `platform_v2/src/services/observationEventCapsule.ts`
- `platform_v2/src/services/observationEventContext.ts`
- `platform_v2/src/services/observationEventDualWrite.ts`
- `platform_v2/src/services/observationEventEffort.ts`
- `platform_v2/src/services/observationEventLive.ts`
- `platform_v2/src/services/observationEventModeManager.ts`
- `platform_v2/src/services/observationEventOfficialReport.test.ts`
- `platform_v2/src/services/observationEventOfficialReport.ts`
- `platform_v2/src/services/observationEventQuestEngine.ts`
- `platform_v2/src/services/observationEventRecap.ts`
- `platform_v2/src/services/observationFieldIdentity.test.ts`
- `platform_v2/src/services/observationFieldIdentity.ts`
- `platform_v2/src/services/observationFieldRegistry.ts`
- `platform_v2/src/services/observationMediaIntegrity.test.ts`
- `platform_v2/src/services/observationMediaIntegrity.ts`
- `platform_v2/src/services/observationPackage.test.ts`
- `platform_v2/src/services/observationPackage.ts`
- `platform_v2/src/services/observationPackageDataChain.test.ts`
- `platform_v2/src/services/observationPackageDataChain.ts`
- `platform_v2/src/services/observationPhotoUpload.test.ts`
- `platform_v2/src/services/observationPhotoUpload.ts`
- `platform_v2/src/services/observationPublicationPolicy.test.ts`
- `platform_v2/src/services/observationPublicationPolicy.ts`
- `platform_v2/src/services/observationQualityGate.test.ts`
- `platform_v2/src/services/observationQualityGate.ts`
- `platform_v2/src/services/observationRally.test.ts`
- `platform_v2/src/services/observationRally.ts`
- `platform_v2/src/services/observationRallyAutoMatch.test.ts`
- `platform_v2/src/services/observationRallyAutoMatch.ts`
- `platform_v2/src/services/observationReactions.ts`
- `platform_v2/src/services/observationReassess.mediaRegions.test.ts`
- `platform_v2/src/services/observationReassess.multiSubjectGuard.test.ts`
- `platform_v2/src/services/observationReassess.ts`
- `platform_v2/src/services/observationReassessPipeline.test.ts`
- `platform_v2/src/services/observationReassessPipeline.ts`
- `platform_v2/src/services/observationReassessSubjectContext.test.ts`
- `platform_v2/src/services/observationRecordAiReview.ts`
- `platform_v2/src/services/observationSceneReadModel.ts`
- `platform_v2/src/services/observationSiteContribution.test.ts`
- `platform_v2/src/services/observationSiteContribution.ts`
- `platform_v2/src/services/observationVisibility.test.ts`
- `platform_v2/src/services/observationVisitBundle.ts`
- `platform_v2/src/services/observationWrite.idempotency.test.ts`
- `platform_v2/src/services/observationWrite.photoRetention.test.ts`
- `platform_v2/src/services/observationWrite.ts`
- `platform_v2/src/services/observerProfileLink.test.ts`
- `platform_v2/src/services/observerProfileLink.ts`
- `platform_v2/src/services/placeFirstRecordState.test.ts`
- `platform_v2/src/services/placeFirstRecordState.ts`
- `platform_v2/src/services/profileDigestPromptLoader.ts`
- `platform_v2/src/services/profileNoteDigest.test.ts`
- `platform_v2/src/services/profileNoteDigest.ts`
- `platform_v2/src/services/reassessFromVideoThumb.test.ts`
- `platform_v2/src/services/reassessFromVideoThumb.ts`
- `platform_v2/src/services/recordPhotoFeedback.test.ts`
- `platform_v2/src/services/recordPhotoFeedback.ts`
- `platform_v2/src/services/recordReadingCards.test.ts`
- `platform_v2/src/services/recordReadingCards.ts`
- `platform_v2/src/services/recordRecoveryHtmlPatch.test.ts`
- `platform_v2/src/services/recordRecoveryHtmlPatch.ts`
- `platform_v2/src/services/recordSafetyProfile.test.ts`
- `platform_v2/src/services/recordSafetyProfile.ts`
- `platform_v2/src/services/schoolAlbumProfiles.ts`
- `platform_v2/src/services/siteBasedMonitoringOsMigration.test.ts`
- `platform_v2/src/services/thumbnailUrl.test.ts`
- `platform_v2/src/services/thumbnailUrl.ts`
- `platform_v2/src/services/visitDisplayState.ts`
- `platform_v2/src/services/visitPlaceAutoLink.test.ts`
- `platform_v2/src/services/visitPlaceAutoLink.ts`
- `platform_v2/src/services/visitSubjects.ts`
- `platform_v2/src/services/visitWindows.test.ts`
- `platform_v2/src/services/visitWindows.ts`
- `platform_v2/src/services/waterRecordExtension.test.ts`
- `platform_v2/src/services/waterRecordExtension.ts`
- `platform_v2/src/ui/fieldNoteMain.test.ts`
- `platform_v2/src/ui/fieldNoteMain.ts`
- `platform_v2/src/ui/mobileQuickRecordContract.test.ts`
- `platform_v2/src/ui/observationCandidatePresentation.test.ts`
- `platform_v2/src/ui/observationCandidatePresentation.ts`
- `platform_v2/src/ui/observationCard.test.ts`
- `platform_v2/src/ui/observationCard.ts`
- `platform_v2/src/ui/observationEventCheckin.test.ts`
- `platform_v2/src/ui/observationEventCheckin.ts`
- `platform_v2/src/ui/observationEventCreate.test.ts`
- `platform_v2/src/ui/observationEventCreate.ts`
- `platform_v2/src/ui/observationEventEdit.ts`
- `platform_v2/src/ui/observationEventList.ts`
- `platform_v2/src/ui/observationEventLive.test.ts`
- `platform_v2/src/ui/observationEventLive.ts`
- `platform_v2/src/ui/observationEventOfficialReport.ts`
- `platform_v2/src/ui/observationEventOrganizerConsole.test.ts`
- `platform_v2/src/ui/observationEventOrganizerConsole.ts`
- `platform_v2/src/ui/observationEventRecap.test.ts`
- `platform_v2/src/ui/observationEventRecap.ts`
- `platform_v2/src/ui/observationEventStyles.ts`
- `platform_v2/src/ui/observationFieldDetail.test.ts`
- `platform_v2/src/ui/observationFieldDetail.ts`
- `platform_v2/src/ui/observationFieldList.test.ts`
- `platform_v2/src/ui/observationFieldList.ts`
- `platform_v2/src/ui/observationMedia.test.ts`
- `platform_v2/src/ui/observationMedia.ts`
- `platform_v2/src/ui/observationRally.test.ts`
- `platform_v2/src/ui/observationRally.ts`
- `platform_v2/src/ui/placeRevisit.test.ts`
- `platform_v2/src/ui/placeRevisit.ts`
- `platform_v2/src/ui/recordCardSizing.ts`
- `platform_v2/src/ui/revisitFlow.ts`

## Relevant source matches
```text
```

## Package scripts
```json
{
  "dev": "tsx watch src/server.ts",
  "build": "npm run check:prompt-schema-leakage && npm run check:observation-copy && npm run check:area-encyclopedia-copy && npm run sync:face-privacy-assets && tsc -p tsconfig.json && node -e \"const fs=require('node:fs');fs.cpSync('src/prompts','dist/prompts',{recursive:true});fs.cpSync('src/content','dist/content',{recursive:true});\"",
  "build:server": "npm run sync:face-privacy-assets && tsc -p tsconfig.json && node -e \"const fs=require('node:fs');fs.cpSync('src/prompts','dist/prompts',{recursive:true});fs.cpSync('src/content','dist/content',{recursive:true});\"",
  "start": "node dist/server.js",
  "typecheck": "tsc --noEmit",
  "test:node": "tsx --test \"src/**/*.test.ts\"",
  "security:audit": "npm audit --omit=dev",
  "test:curator": "tsx --test src/services/aiModelPricing.test.ts src/services/curatorTrustBoundary.test.ts src/services/curatorSqlBuilder.test.ts src/scripts/curatorModelBakeoff.test.ts",
  "eval:navigable-os:generate": "tsx src/scripts/generateNavigableBiodiversityOsEvalCandidate.ts",
  "eval:navigable-os": "tsx src/scripts/scoreNavigableBiodiversityOsEval.ts",
  "compile:knowledge-navigation": "tsx src/scripts/compileKnowledgeNavigation.ts",
  "eval:knowledge-navigation": "npm run eval:navigable-os",
  "bakeoff:curator": "tsx src/scripts/curatorModelBakeoff.ts",
  "smoke:curator:invasive": "tsx src/scripts/smokeInvasiveLawCurator.ts",
  "smoke:invasive-reporting-delivery": "tsx src/scripts/smokeInvasiveReportingDelivery.ts",
  "e2e:staging": "playwright test -c playwright.staging.config.ts \"e2e/.*\\.staging\\.spec\\.ts\"",
  "e2e:staging:smoke": "playwright test -c playwright.staging.config.ts e2e/home.staging.spec.ts",
  "e2e:staging:service-loop": "playwright test -c playwright.staging.config.ts e2e/service-loop.staging.spec.ts",
  "e2e:staging:record-funnel": "playwright test -c playwright.staging.config.ts e2e/record-funnel.staging.spec.ts",
  "e2e:staging:record-feedback-loop": "playwright test -c playwright.staging.config.ts e2e/record-feedback-loop.staging.spec.ts",
  "e2e:staging:map-performance": "playwright test -c playwright.staging.config.ts e2e/map-performance.staging.spec.ts",
  "e2e:local:map-compact-ui": "playwright test -c playwright.staging.config.ts e2e/map-compact-ui.local.spec.ts",
  "e2e:staging:observation-scene": "playwright test -c playwright.staging.config.ts e2e/observation-scene-read-model.staging.spec.ts",
  "plan:staging-non-map-shards": "node scripts/planStagingNonMapShards.mjs",
  "e2e:local:observation-candidates": "playwright test -c playwright.staging.config.ts e2e/observation-candidate-tabs.local.spec.ts",
  "e2e:staging:site-map": "playwright test -c playwright.staging.config.ts e2e/sitemap-registry-visual.staging.spec.ts",
  "e2e:visual-regression": "playwright test -c playwright.staging.config.ts e2e/sitemap-registry-visual.staging.spec.ts",
  "e2e:staging:update-snapshots": "playwright test -c playwright.staging.config.ts --update-snapshots",
  "e2e:production-smoke": "playwright test -c playwright.production-smoke.config.ts",
  "e2e:production-smoke:read-only": "playwright test -c playwright.production-smoke.config.ts --grep-invert \"\\[(auth-write|private-post|private-post-ui|shared-production-write|place-memory-write|public-capsule-write)\\]\"",
  "e2e:production-smoke:private-post": "node scripts/run-production-smoke-private-post.mjs",
  "e2e:production-smoke:private-post-ui": "node scripts/run-production-smoke-private-post-ui.mjs",
  "e2e:observation-target": "playwright test -c playwright.observation-target.config.ts",
  "e2e:observation-image-target": "tsx src/scripts/runObservationImageTargetE2e.ts",
  "resolve:observation-image-targets": "tsx src/scripts/resolveObservationImageTargets.ts",
  "migrate": "tsx src/scripts/applyMigrations.ts",
  "migrate:local:compat": "tsx src/scripts/applyMigrations.ts --local-extension-compat",
  "db:local:municipal-walk-map": "node scripts/bootstrap-municipal-walk-map-local-db.mjs",
  "db:local:municipal-walk-map:stop": "node scripts/bootstrap-municipal-walk-map-local-db.mjs --stop",
  "import:invasive-reporting:shizuoka": "tsx src/scripts/importInvasiveReportingContacts.ts --file=db/seeds/invasive_reporting_contacts.shizuoka_2026-05-16.json",
  "import:legacy": "tsx src/scripts/bootstrapLegacyImport.ts",
  "import:plan:observations": "tsx src/scripts/planObservationLedger.ts",
  "import:observations": "tsx src/scripts/importObservationMeaning.ts",
  "import:observations:evidence": "tsx src/scripts/importObservationEvidence.ts",
  "import:observations:identifications": "tsx src/scripts/importObservationIdentification.ts",
  "import:observations:conditions": "tsx src/scripts/importObservationPlaceCondition.ts",
  "import:admin-global": "tsx src/scripts/importGlobalAdministrativeAreas.ts",
  "import:n03-admin": "tsx src/scripts/importN03Administrative.ts",
  "import:remember-tokens": "tsx src/scripts/importRememberTokens.ts",
  "sync:legacy-auth": "tsx src/scripts/syncLegacyUserAuth.ts",
  "import:tracks": "tsx src/scripts/importTrackSessions.ts",
  "verify:legacy": "tsx src/scripts/verifyLegacyParity.ts",
  "verify:production-shadow": "tsx src/scripts/verifyProductionShadowParity.ts",
  "sync:face-privacy-assets": "node scripts/sync-face-privacy-assets.mjs",
  "backfill:authority-rank": "tsx src/scripts/backfillAuthorityRank.ts",
  "report:replacement-readiness": "tsx src/scripts/replacementReadinessReport.ts",
  "report:municipal-walk-map-sources": "tsx src/scripts/reportMunicipalWalkMapSourceCoverage.ts",
  "report:visit-windows": "tsx src/scripts/reportVisitWindows.ts",
  "materialize:legacy-verify-snapshot": "tsx src/scripts/materializeLegacyVerifySnapshot.ts",
  "report:legacy-drift": "tsx src/scripts/reportLegacyDrift.ts",
  "smoke:platform-lane": "tsx src/scripts/smokePlatformLane.ts",
  "smoke:platform-read-lane": "tsx src/scripts/smokePlatformReadLane.ts",
  "smoke:platform-write-lane": "tsx src/scripts/smokePlatformWriteLane.ts",
  "smoke:production-media": "tsx src/scripts/smokeProductionMediaUpload.ts",
  "cleanup:production-ui-smoke": "tsx src/scripts/cleanupProductionUiSmoke.ts",
  "monitor:production-smoke-cleanup": "tsx src/scripts/monitorProductionSmokeCleanup.ts",
  "smoke:audio-archive": "tsx src/scripts/smokeAudioArchive.ts",
  "smoke:audio-embedding": "tsx src/scripts/smokeAudioEmbedding.ts",
  "smoke:manual-occurrence-map": "tsx src/scripts/smokeManualOccurrenceMap.ts",
  "smoke:public-map-snapshot-alert": "tsx src/scripts/smokePublicMapSnapshotAlert.ts",
  "smoke:specialist-authority": "tsx src/scripts/smokeSpecialistAuthority.ts",
  "smoke:site-brief": "tsx src/scripts/smokeSiteBrief.ts",
  "ingest:place-environment": "tsx src/scripts/ingestPlaceEnvironmentSnapshots.ts",
  "process:place-memory-photos": "tsx src/scripts/processPlaceMemoryPhotos.ts",
  "process:audio-segments": "tsx src/scripts/processAudioSegments.ts",
  "repair:manual-occurrences": "tsx src/scripts/repairMissingManualOccurrences.ts",
  "repair:location-labels": "tsx src/scripts/repairObservationLocationLabels.ts",
  "repair:hamamatsu-ward-labels": "tsx src/scripts/repairHamamatsuWardLabels.ts",
  "repair:observation-spatial-mesh-schema": "tsx src/scripts/repairObservationSpatialMeshSchema.ts",
  "backfill:admin-locality": "tsx src/scripts/backfillObservationLocalityFromAdminAreas.ts",
  "report:missing-photos": "tsx src/scripts/reportMissingObservationPhotos.ts",
  "audit:locations": "tsx src/scripts/auditObservationLocations.ts",
  "audit:field-entity-keys": "tsx src/scripts/auditObservationFieldEntityKeys.ts",
  "repair:user-password": "tsx src/scripts/setExistingUserPassword.ts",
  "sync:legacy": "tsx src/scripts/syncLegacyDelta.ts",
  "write:legacy": "tsx src/scripts/writeLegacyCompatibility.ts",
  "readiness": "tsx src/scripts/readinessReport.ts",
  "rehearse:cutover": "tsx src/scripts/rehearseCutover.ts",
  "check:public-terms": "tsx src/scripts/checkPublicSurfaceTerms.ts",
  "check:observation-copy": "tsx src/scripts/checkObservationCopyQuality.ts",
  "check:area-encyclopedia-copy": "tsx src/scripts/checkAreaEncyclopediaCopyQuality.ts",
  "check:prompt-schema-leakage": "tsx src/scripts/checkPromptSchemaExampleLeakage.ts",
  "import:legacy-ai-assessments": "tsx src/scripts/importLegacyAiAssessments.ts",
  "refresh:recent-observation-ai": "tsx src/scripts/refreshRecentObservationAi.ts",
  "refresh:public-map-snapshot": "tsx src/scripts/refreshPublicMapSnapshot.ts",
  "import:feedback-knowledge": "tsx src/scripts/importObservationFeedbackKnowledgeClaims.ts",
  "import:invasive-knowledge": "tsx src/scripts/importInvasiveKnowledgeClaims.ts",
  "smoke:feedback-knowledge": "tsx src/scripts/smokeObservationFeedbackKnowledge.ts",
  "import:observation-fields": "tsx src/scripts/importObservationFields.ts",
  "import:observation-fields:aikan-renri": "tsx src/scripts/importObservationFields.ts --source=nature_symbiosis_site --file=src/scripts/data/nature_symbiosis_sites.seed.json --certification-id=aikan-renri-ikan-hq",
  "import:schools": "tsx src/scripts/importObservationFields.ts --source=school",
  "import:schools:shizuoka": "tsx src/scripts/importObservationFields.ts --source=school --prefecture-code=22 --prefecture=静岡県",
  "import:osm-parks": "tsx src/scripts/importOsmLeisureParks.ts",
  "enhance:school-boundaries": "tsx src/scripts/enhanceSchoolFieldBoundaries.ts",
  "scrape:nature-symbiosis": "tsx src/scripts/scrapeNatureSymbiosisSites.ts",
  "import:protected-areas": "tsx src/scripts/importProtectedAreas.ts",
  "import:regional-knowledge": "tsx src/scripts/importRegionalKnowledgeCards.ts",
  "generate:lenri-guide-audio": "tsx src/scripts/generateLenriGuideAudio.ts",
  "draft:regional-hooks": "tsx src/scripts/draftRegionalKnowledgeHooks.ts",
  "scrape:adeac-regional": "tsx src/scripts/scrapeAdeacTextListRegionalCards.ts",
  "embed:regional-knowledge": "tsx src/scripts/embedRegionalKnowledgeCards.ts",
  "diagnose:guide-environment-mesh": "tsx src/scripts/diagnoseGuideEnvironmentMesh.ts",
  "generate:regional-hypotheses": "tsx src/scripts/generateRegionalHypotheses.ts",
  "generate:guide-hypothesis-improvements": "tsx src/scripts/generateGuideHypothesisPromptImprovements.ts",
  "postdeploy:guide-environment": "tsx src/scripts/runGuideEnvironmentPostDeploy.ts",
  "backfill:guide-non-biological-species": "tsx src/scripts/backfillGuideNonBiologicalSpecies.ts",
  "export:guide-correction-eval": "tsx src/scripts/exportGuideCorrectionEval.ts",
  "export:guide-hypothesis-eval": "tsx src/scripts/exportGuideHypothesisEvalSet.ts",
  "rebuild:guide-environment-mesh": "tsx src/scripts/rebuildGuideEnvironmentMesh.ts"
}
```

## Cloudflare package scripts
```json
{
  "check": "tsc -p tsconfig.json --noEmit",
  "test": "tsx --test \"src/**/*.test.ts\"",
  "test:full": "npm test",
  "test:quick": "tsx --test --test-skip-pattern \"synthetic 10k daily profile\" \"src/**/*.test.ts\"",
  "test:heavy": "tsx --test --test-name-pattern \"synthetic 10k daily profile\" \"src/**/*.test.ts\"",
  "wrangler:check": "npx wrangler deploy --dry-run --env shadow",
  "wrangler:check:staging": "npx wrangler deploy --dry-run --env staging",
  "dev": "wrangler dev --local --env shadow --port 8787",
  "load:10k": "node scripts/loadtest.mjs --records=10000 --media=3 --url=http://127.0.0.1:8787",
  "build:field-detail-sql": "node scripts/build-field-detail-readmodel-sql.mjs",
  "report:d1-boundary": "node scripts/d1-migration-boundary-report.mjs",
  "report:vps-stop-readiness": "node scripts/d1-migration-boundary-report.mjs --fail-on-vps-blockers",
  "deploy:shadow:preflight": "node scripts/deploy-shadow-guard.mjs --write-preflight-report .deploy/shadow-preflight-latest.json",
  "deploy:shadow:dry-run": "node scripts/deploy-shadow-guard.mjs",
  "deploy:shadow": "node scripts/deploy-shadow-guard.mjs --execute",
  "deploy:staging:preflight": "node scripts/deploy-staging-guard.mjs --write-preflight-report .deploy/staging-preflight-latest.json",
  "deploy:staging:dry-run": "node scripts/deploy-staging-guard.mjs",
  "deploy:staging": "node scripts/deploy-staging-guard.mjs --execute",
  "deploy:production:preflight": "node scripts/deploy-production-guard.mjs --write-preflight-report .deploy/production-preflight-latest.json",
  "deploy:production:quick-preflight": "node scripts/deploy-production-guard.mjs --test-profile quick --write-preflight-report .deploy/production-preflight-latest.json",
  "deploy:production:dry-run": "node scripts/deploy-production-guard.mjs",
  "deploy:production:fast:dry-run": "node scripts/deploy-production-guard.mjs --fast --preflight-report .deploy/production-preflight-latest.json",
  "deploy:production:artifact:pull": "node scripts/pull-production-preflight-artifact.mjs",
  "deploy:production": "node scripts/deploy-production-guard.mjs --execute",
  "deploy:production:fast": "node scripts/deploy-production-guard.mjs --execute --fast --preflight-report .deploy/production-preflight-latest.json",
  "seed:staging-observation-image-targets": "node scripts/seed-staging-observation-image-targets.mjs",
  "materialize:original-ui:dry-run": "tsx scripts/materialize-original-ui-html.mjs",
  "materialize:original-ui": "tsx scripts/materialize-original-ui-html.mjs --execute"
}
```
