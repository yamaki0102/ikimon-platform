import { createHash } from "node:crypto";
import { FACE_PRIVACY_CLIENT_SCRIPT } from "../../src/ui/facePrivacyScript";
import { PHOTO_UPLOAD_PREPARATION_SCRIPT } from "../../src/ui/photoUploadPreparation";
import type { HashedStaticAsset } from "../../src/ui/mapExplorerAssets";
import { ZUKAN_RECORD_PLACE_TIME_SCRIPT } from "./zukanRecordPlaceAndTime";
import { ZUKAN_RECORD_INPUT_SCRIPT } from "./zukanRecordInput";
import { ZUKAN_RECORD_MEMO_ONLY_SCRIPT } from "./zukanRecordMemoOnly";
import { ZUKAN_RECORD_CAPTURE_SCRIPT } from "./zukanRecordEntry";

const RECORD_PAGE_SCRIPT_BODY = `window.ikimonFacePrivacyAssetBase = "/assets/face-privacy";
${FACE_PRIVACY_CLIENT_SCRIPT}
${ZUKAN_RECORD_PLACE_TIME_SCRIPT}
${ZUKAN_RECORD_INPUT_SCRIPT}
${ZUKAN_RECORD_MEMO_ONLY_SCRIPT}
  (() => {
    const __rc = JSON.parse(document.getElementById("record-page-config").textContent || "{}");
    const copy = __rc.copy;
    ${PHOTO_UPLOAD_PREPARATION_SCRIPT}
    const form = document.getElementById("record-form");
    const status = document.getElementById("record-status");
    const savedLinks = document.getElementById("record-saved-links");
    const initialPlaceId = new URLSearchParams(location.search).get("placeId") || "";
    const submitPanel = document.getElementById("record-submit-panel");
    const confirmDialog = document.getElementById("record-confirm");
    const reviewOpen = document.getElementById("record-review-open");
    const confirmCount = document.getElementById("record-confirm-count");
    const confirmNote = document.getElementById("record-confirm-note");
    const confirmLocation = document.getElementById("record-confirm-location");
    const cameraInput = document.getElementById("record-media-camera");
    const photoInput = document.getElementById("record-media-photo");
    const videoInput = document.getElementById("record-media-video");
    const recordPrefix = __rc.prefix;
    const eventContext = {
      eventCode: document.body.dataset.eventCode || "",
      eventSessionId: document.body.dataset.eventSessionId || "",
      teamId: document.body.dataset.eventTeamId || "",
      participantRole: document.body.dataset.eventParticipantRole || ""
    };
    let mediaKind = document.body.dataset.recordStart === "video" ? "video" : "photo";
    function showSavedRecordLinks(visitId, resolvedPlaceId) {
      if (typeof stageSaved === "function") stageSaved(visitId, resolvedPlaceId);
      if (!savedLinks) return;
      savedLinks.textContent = "";
      const isEn = recordPrefix === "/en";
      const items = [
        { href: recordPrefix + "/observations/" + encodeURIComponent(visitId), label: isEn ? "Open this record" : "この記録を見る", primary: true },
        { href: recordPrefix + "/records?view=mine", label: isEn ? "My records" : "自分の記録", primary: false }
      ];
      if (eventContext.eventSessionId) {
        items.push({ href: recordPrefix + "/events/" + encodeURIComponent(eventContext.eventSessionId) + "/live", label: isEn ? "Back to event" : "観察会に戻る", primary: false });
      }
      if (resolvedPlaceId) {
        items.push({ href: recordPrefix + "/places/" + encodeURIComponent(resolvedPlaceId), label: isEn ? "Open place" : "場所ページを見る", primary: false });
      } else {
        items.push({ href: recordPrefix + "/map", label: isEn ? "Open map" : "地図を見る", primary: false });
      }
      for (const item of items) {
        const anchor = document.createElement("a");
        anchor.href = item.href;
        anchor.textContent = item.label;
        if (item.primary) anchor.className = "is-primary";
        savedLinks.appendChild(anchor);
      }
      savedLinks.hidden = false;
    }
    function setStatus(message, error) {
      if (typeof stageStatus === "function") stageStatus(message, error);
      if (!status) return;
      status.textContent = message;
      status.style.color = error ? "#b42318" : "";
    }
    let selectedPhotos = [];
    let photoPreviewUrls = [];
    let capturedVideoFile = null;
    function selectedFiles() {
      const input = mediaKind === "video" ? videoInput : photoInput;
      if (mediaKind === "photo") return selectedPhotos;
      if (capturedVideoFile) return [capturedVideoFile];
      return input && input.files && input.files[0] ? [input.files[0]] : [];
    }
    function removePhotoAt(index) {
      selectedPhotos.splice(index, 1);
      preparedPhotoUploads.splice(index, 1);
      renderPhotoReview();
      if (selectedPhotos.length === 0) {
        clearTimeout(draftTimer);
        draftTimer = null;
        draftRevision += 1;
        draftWrites = draftWrites.then(async () => {
          await deleteRecordDraft();
          volatileDraft = false;
          setStatus(copy.emptySelection, false);
        }).catch(() => setStatus(copy.draftFailed, true));
        return;
      }
      queueDraftSave();
    }
    function renderPhotoReview() {
      const review = document.getElementById("record-photo-review");
      const grid = document.getElementById("record-photo-grid");
      const count = document.getElementById("record-photo-count");
      if (!review || !grid || !count) return;
      photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
      photoPreviewUrls = [];
      review.hidden = mediaKind !== "photo" || selectedPhotos.length === 0;
      count.textContent = String(selectedPhotos.length);
      grid.replaceChildren();
      selectedPhotos.forEach((file, index) => {
        const item = document.createElement("div"); item.className = "cf-record-photo";
        const image = document.createElement("img"); image.src = URL.createObjectURL(file); photoPreviewUrls.push(image.src); image.alt = "";
        const zoom = document.createElement("button"); zoom.type = "button"; zoom.className = "cf-record-photo-zoom"; zoom.textContent = copy.zoomPhoto;
        zoom.addEventListener("click", () => { const dialog = document.getElementById("record-photo-zoom"); const preview = dialog.querySelector("img"); preview.src = image.src; preview.alt = file.name || copy.photo; dialog.showModal(); });
        const remove = document.createElement("button"); remove.type = "button"; remove.className = "cf-record-photo-remove"; remove.textContent = "×"; remove.setAttribute("aria-label", copy.removePhoto + ": " + (file.name || (index + 1)));
        remove.addEventListener("click", () => removePhotoAt(index));
        item.append(image, zoom, remove); grid.append(item);
      });
    }
    document.querySelector("#record-photo-zoom button")?.addEventListener("click", () => document.getElementById("record-photo-zoom").close());
    document.getElementById("record-add-photo")?.addEventListener("click", () => photoInput?.click());
    reviewOpen?.addEventListener("click", () => {
      const values = new FormData(form);
      const latitude = String(values.get("latitude") || "").trim();
      const longitude = String(values.get("longitude") || "").trim();
      confirmCount.textContent = String(selectedFiles().length);
      confirmNote.textContent = String(values.get("note") || "").trim() || copy.reviewUnknown;
      confirmLocation.textContent = latitude && longitude ? latitude + ", " + longitude : copy.reviewUnknown;
      confirmDialog.showModal();
    });
    document.getElementById("record-confirm-back")?.addEventListener("click", () => confirmDialog.close());
    const draftOwnerKey = "user:" + form.dataset.userId;
    const draftStorageKey = "latest:" + draftOwnerKey;
    function openRecordDraftDb() {
      return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) return reject(new Error("indexeddb_unavailable"));
        const request = indexedDB.open("ikimon-record-draft", 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("drafts")) request.result.createObjectStore("drafts");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("indexeddb_open_failed"));
      });
    }
    async function writeRecordDraft(draft) {
      const db = await openRecordDraftDb();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction("drafts", "readwrite");
          tx.objectStore("drafts").put(draft, draftStorageKey);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error || new Error("indexeddb_write_failed"));
        });
      } finally {
        db.close();
      }
    }
    async function deleteRecordDraft() {
      const db = await openRecordDraftDb();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction("drafts", "readwrite");
          tx.objectStore("drafts").delete(draftStorageKey);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error || new Error("indexeddb_delete_failed"));
        });
      } finally {
        db.close();
      }
    }
    function recordRecoveryHref() {
      const target = new URL(recordPrefix + "/record", window.location.origin);
      target.searchParams.set("retry", "media");
      target.searchParams.set("start", mediaKind);
      target.searchParams.set("source", "upload_failed");
      for (const [key, value] of Object.entries({
        event: eventContext.eventCode,
        eventSessionId: eventContext.eventSessionId,
        teamId: eventContext.teamId,
        participantRole: eventContext.participantRole
      })) {
        if (value) target.searchParams.set(key, value);
      }
      return target.pathname + target.search;
    }
    let preparedPhotoUploads = [];
    let completedPhotoIndexes = new Set();
    let recoverySubmissionId = "";
    let recoveryObservedAt = "";
    let pendingVideoUid = "";
    let pendingVideoUploadUrl = "";
    let pendingVideoBodyUploaded = false;
    let pendingVideoIdempotencyKey = "";
    function newVideoUploadKey() {
      const suffix = window.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
      return "record-video:" + suffix;
    }
    async function persistRecordDraftProgress(formData, patch = {}) {
      const files = selectedFiles();
      if (!files.length) throw new Error("record_draft_media_missing");
      const latitude = String(formData.get("latitude") || "").trim();
      const longitude = String(formData.get("longitude") || "").trim();
      await writeRecordDraft({
        ownerKey: draftOwnerKey,
        continuationToken: null,
        file: files[0],
        files,
        kind: mediaKind,
        savedAt: Date.now(),
        metadata: {
          ...patch,
          preparedPhotoUploads,
          photoPreparationVersion: "webp2560-v1",
          recoverySubmissionId,
          pendingMediaRetryVideoIdempotencyKey: pendingVideoIdempotencyKey,
          recoveryObservedAt,
          eventContext,
          formValues: {
            note: String(formData.get("note") || ""),
            latitude,
            longitude
          },
          location: { latitude, longitude }
        }
      });
    }
    let draftWrites = Promise.resolve();
    let draftClaimed = false;
    let draftClaimDeclined = false;
    let draftRevision = 0;
    let draftTimer = null;
    let submitting = false;
    let submitRequested = false;
    let serverSaved = false;
    let volatileDraft = false;
    async function claimDraft(force = false) {
      if (draftClaimed) return true;
      if (draftClaimDeclined && !force) return false;
      const db = await openRecordDraftDb();
      let existing;
      try { existing = await new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readonly");
        const req = tx.objectStore("drafts").get(draftStorageKey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }); } finally { db.close(); }
      if (existing && existing.ownerKey !== draftOwnerKey) throw new Error("draft_owner_mismatch");
      if (existing && !window.confirm(copy.replaceDraft)) { draftClaimDeclined = true; return false; }
      draftClaimed = true;
      return true;
    }
    function queueDraftSave() {
      if (!selectedFiles().length || submitting || serverSaved) return;
      volatileDraft = true;
      draftRevision += 1;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(flushDraftSave, 300);
    }
    function flushDraftSave() {
      clearTimeout(draftTimer);
      draftTimer = null;
      const revision = draftRevision;
      draftWrites = draftWrites.then(async () => {
        if (!selectedFiles().length || submitting || serverSaved || revision !== draftRevision) return;
        if (!await claimDraft()) { setStatus(copy.draftFailed, true); return; }
        await persistRecordDraftProgress(new FormData(form));
        if (revision === draftRevision) {
          volatileDraft = false;
          setStatus(copy.draftSaved, false);
        }
      }).catch(() => setStatus(copy.draftFailed, true));
      return draftWrites;
    }
    form?.addEventListener("input", queueDraftSave);
    window.addEventListener("beforeunload", (event) => {
      if (volatileDraft || submitting) { event.preventDefault(); event.returnValue = ""; }
    });
    document.getElementById("record-use-location")?.addEventListener("click", () => {
      if (!navigator.geolocation) { setStatus(copy.positionRequired, true); return; }
      navigator.geolocation.getCurrentPosition((position) => {
        form.elements.latitude.value = String(position.coords.latitude);
        form.elements.longitude.value = String(position.coords.longitude);
        queueDraftSave();
      }, () => setStatus(copy.positionRequired, true), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    });
    const ztCopyData = __rc.capture;
    ${ZUKAN_RECORD_CAPTURE_SCRIPT}
    function reveal(kind) {
      mediaKind = kind;
      stageSync();
      queueDraftSave();
    }
    function eventMetric(eventName, values = {}) {
      if (!eventContext.eventSessionId) return Promise.resolve();
      return fetch("/api/v1/observation-events/" + encodeURIComponent(eventContext.eventSessionId) + "/analytics", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_name: eventName,
          page: "record",
          auth_state: "signed_in",
          network_state: navigator.onLine === false ? "offline" : "online",
          ...values
        })
      }).then(() => undefined).catch(() => undefined);
    }
    function observationFailureReason(error) {
      const message = String(error instanceof Error ? error.message : "").toLowerCase();
      if (message.includes("timeout")) return "timeout";
      if (message.includes("forbidden") || message.includes("permission") || message.includes("session_required")) return "permission";
      if (message.includes("invalid") || message.includes("missing") || message.includes("required")) return "validation";
      if (/\\b5\\d\\d\\b/.test(message)) return "5xx";
      if (/\\b4\\d\\d\\b/.test(message)) return "4xx";
      return "unknown";
    }
    function addPhotoFiles(input) {
      if (submitting || submitRequested || serverSaved) return;
      const incoming = input && input.files ? Array.from(input.files).filter(file => file instanceof File && file.size > 0) : [];
      pendingVideoUid = "";
      pendingVideoUploadUrl = "";
      pendingVideoBodyUploaded = false;
      pendingVideoIdempotencyKey = "";
      selectedPhotos.push(...incoming);
      if (input) input.value = "";
      reveal("photo");
      void eventMetric("event_photo_selected");
    }
    cameraInput?.addEventListener("change", () => addPhotoFiles(cameraInput));
    photoInput?.addEventListener("change", () => addPhotoFiles(photoInput));
    if (new URLSearchParams(location.search).get("from") === "quick_camera") {
      void (async () => {
        try {
          const db = await openRecordDraftDb();
          const entry = await new Promise((resolve) => {
            const tx = db.transaction("drafts", "readwrite");
            const store = tx.objectStore("drafts");
            const req = store.get("quick-camera-latest");
            req.onsuccess = () => {
              const val = req.result || null;
              if (val) store.delete("quick-camera-latest");
              resolve(val);
            };
            req.onerror = () => resolve(null);
            tx.oncomplete = () => db.close();
          });
          if (entry && Array.isArray(entry.files) && entry.files.length) {
            addPhotoFiles({ files: entry.files, value: "" });
          }
        } catch {}
      })();
    }
    videoInput?.addEventListener("change", () => {
      pendingVideoUid = "";
      pendingVideoUploadUrl = "";
      pendingVideoBodyUploaded = false;
      pendingVideoIdempotencyKey = newVideoUploadKey();
      reveal("video");
    });
    async function postJson(path, body) {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "request_failed");
      }
      return payload;
    }
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting || serverSaved || submitRequested) return;
      submitRequested = true;
      try {
      await flushDraftSave();
      await draftWrites;
      const files = selectedFiles();
      if (!files.length) {
        setStatus(copy.missingMedia, true);
        return;
      }
      const formData = new FormData(form);
      const latitudeText = String(formData.get("latitude") || "").trim();
      const longitudeText = String(formData.get("longitude") || "").trim();
      const locationUnset = !latitudeText && !longitudeText;
      const latitude = locationUnset ? null : Number(latitudeText);
      const longitude = locationUnset ? null : Number(longitudeText);
      const userId = form.dataset.userId || "";
      if (!locationUnset && (!latitudeText || !longitudeText || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
        setStatus(copy.positionRequired, true);
        return;
      }
      const explicitObservedAtMs = new Date(String(formData.get("observedAtLocal") || "")).getTime();
      try { if (!await claimDraft(true)) { setStatus(copy.draftFailed, true); return; } } catch { setStatus(copy.draftFailed, true); return; }
      submitting = true;
      confirmDialog.close();
      document.querySelectorAll(".cf-record-picker input, #record-form input, #record-form textarea, #record-use-location").forEach(el => el.disabled = true);
      document.querySelectorAll("#record-photo-review button").forEach(el => el.disabled = true);
      reviewOpen.disabled = true;
      document.getElementById("record-confirm-save").disabled = true;
      if (!recoverySubmissionId) {
        recoverySubmissionId = "record-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
        recoveryObservedAt = Number.isFinite(explicitObservedAtMs) && explicitObservedAtMs <= Date.now() && explicitObservedAtMs >= Date.UTC(1900, 0, 1)
          ? new Date(explicitObservedAtMs).toISOString()
          : new Date().toISOString();
      }
      if (mediaKind === "video" && !pendingVideoIdempotencyKey) pendingVideoIdempotencyKey = newVideoUploadKey();
      if (!recoveryObservedAt) recoveryObservedAt = new Date().toISOString();
      const observationId = recoverySubmissionId;
      let observationStored = false;
      let visitId = "";
      setStatus(copy.saving, false);
      void eventMetric("event_observation_submit_started");
      try {
        await persistRecordDraftProgress(formData, {
          pendingMediaRetryVisitId: "",
          pendingMediaRetryVideoUid: "",
          pendingMediaRetryVideoUploadUrl: "",
          pendingMediaRetryVideoBodyUploaded: false,
          pendingMediaRetryVideoIdempotencyKey: pendingVideoIdempotencyKey
        });
        const observation = await postJson("/api/v1/observations/upsert", {
          observationId,
          clientSubmissionId: observationId + "-cloudflare-record-form",
          userId,
          siteId: String(formData.get("placeId") || "").trim() || null,
          observedAt: recoveryObservedAt,
          latitude,
          longitude,
          visibility: "private",
          note: String(formData.get("note") || ""),
          taxon: { vernacularName: "未同定", rank: "unknown" },
          eventCode: eventContext.eventCode || null,
          eventSessionId: eventContext.eventSessionId || null,
          teamId: eventContext.teamId || null,
          participantRole: eventContext.participantRole || null,
          sourcePayload: {
            source: "cloudflare_record_session_form",
            place_id_hint: String(formData.get("placeId") || "").trim() || null,
            mediaKind,
            eventCode: eventContext.eventCode || null,
            eventSessionId: eventContext.eventSessionId || null,
            teamId: eventContext.teamId || null,
            participantRole: eventContext.participantRole || null
          }
        });
        observationStored = true;
        visitId = String(observation.visitId || observation.observationId || observationId);
        try {
          await persistRecordDraftProgress(formData, { pendingMediaRetryVisitId: visitId });
        } catch (draftError) {
          console.error(draftError);
        }
        if (mediaKind === "photo") {
          for (let index = 0; index < files.length; index += 1) {
            if (completedPhotoIndexes.has(index)) continue;
            setStatus(copy.preparing + " " + (index + 1) + "/" + files.length, false);
            const upload = preparedPhotoUploads[index] || await preparePhotoUpload(files[index]);
            preparedPhotoUploads[index] = upload;
            await persistRecordDraftProgress(formData, { pendingMediaRetryVisitId: visitId });
            setStatus(copy.uploading + " " + (index + 1) + "/" + files.length, false);
            await postJson("/api/v1/observations/" + encodeURIComponent(visitId) + "/photos/upload", {
              ...upload,
              mediaRole: index === 0 ? "primary" : "context",
            position: index,
              facePrivacy: photoFacePrivacyStatus(upload)
            });
            preparedPhotoUploads[index] = null;
            completedPhotoIndexes.add(index);
            await persistRecordDraftProgress(formData, { pendingMediaRetryVisitId: visitId, completedPhotoIndexes: Array.from(completedPhotoIndexes).sort((a, b) => a - b) });
          }
          await deleteRecordDraft();
          serverSaved = true;
          submitting = false;
          volatileDraft = false;
          showSavedRecordLinks(visitId, (observation && observation.placeId) || initialPlaceId);
          setStatus(copy.saved + " " + files.length + copy.photoSaved, false);
          return;
        }
      const file = files[0];
      const direct = await postJson("/api/v1/videos/direct-upload", {
          filename: file.name || "record-video.mp4",
          observationId: visitId,
          mediaRole: "observation_video",
          fileSizeBytes: file.size,
          uploadProtocol: "post",
          maxDurationSeconds: 60,
          clientUploadKey: pendingVideoIdempotencyKey
        });
        if (!direct.uploadUrl || !direct.uid) throw new Error("video_direct_upload_failed");
        pendingVideoUid = String(direct.uid);
        pendingVideoUploadUrl = String(direct.uploadUrl);
        pendingVideoBodyUploaded = false;
        await persistRecordDraftProgress(formData, {
          pendingMediaRetryVisitId: visitId,
          pendingMediaRetryVideoUid: pendingVideoUid,
          pendingMediaRetryVideoUploadUrl: pendingVideoUploadUrl,
          pendingMediaRetryVideoBodyUploaded: false,
          pendingMediaRetryVideoIdempotencyKey: pendingVideoIdempotencyKey
        });
        const bodyResponse = await fetch(String(direct.uploadUrl || ""), {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": file.type || "video/mp4" },
          body: file
        });
        if (!bodyResponse.ok) {
          pendingVideoUid = "";
          pendingVideoUploadUrl = "";
          pendingVideoBodyUploaded = false;
          throw new Error("video_body_upload_failed");
        }
        pendingVideoBodyUploaded = true;
        await persistRecordDraftProgress(formData, {
          pendingMediaRetryVisitId: visitId,
          pendingMediaRetryVideoUid: pendingVideoUid,
          pendingMediaRetryVideoUploadUrl: pendingVideoUploadUrl,
          pendingMediaRetryVideoBodyUploaded: true,
          pendingMediaRetryVideoIdempotencyKey: pendingVideoIdempotencyKey
        });
        await postJson("/api/v1/videos/" + encodeURIComponent(String(direct.uid || "")) + "/finalize", {
          observationId: visitId,
          durationMs: 1000,
          readyToStream: true
        });
        await deleteRecordDraft();
          serverSaved = true;
          submitting = false;
          volatileDraft = false;
        showSavedRecordLinks(visitId, (observation && observation.placeId) || initialPlaceId);
        setStatus(copy.saved + " " + copy.videoSaved, false);
      } catch (error) {
        submitting = false;
        document.querySelectorAll(".cf-record-picker input, #record-form input, #record-form textarea, #record-use-location").forEach(el => el.disabled = false);
        document.querySelectorAll("#record-photo-review button").forEach(el => el.disabled = false);
        reviewOpen.disabled = false;
        document.getElementById("record-confirm-save").disabled = false;
        console.error(error);
        if (!observationStored) {
          void eventMetric("event_observation_failed", { result_reason: observationFailureReason(error) });
        }
        try {
          await persistRecordDraftProgress(formData, {
            pendingMediaRetryVisitId: visitId,
            pendingMediaRetryVideoUid: pendingVideoUid,
            pendingMediaRetryVideoUploadUrl: pendingVideoUploadUrl,
            pendingMediaRetryVideoBodyUploaded: pendingVideoBodyUploaded,
            pendingMediaRetryVideoIdempotencyKey: pendingVideoIdempotencyKey
          });
          void eventMetric("event_media_retry_queued", { retry_kind: mediaKind });
          location.assign(recordRecoveryHref());
          return;
        } catch (draftError) {
          console.error(draftError);
        }
        setStatus(copy.failed, true);
      }
      } finally { submitRequested = false; }
    });
  })();
`;

let cached: HashedStaticAsset | null = null;

export function recordPageScriptAsset(): HashedStaticAsset {
  if (cached) return cached;
  const content = Buffer.from(RECORD_PAGE_SCRIPT_BODY, "utf8");
  const sha256 = createHash("sha256").update(content).digest("hex");
  cached = {
    path: `/assets/ui/record-page.${sha256.slice(0, 12)}.js`,
    content,
    contentType: "application/javascript; charset=utf-8",
    etag: `"${sha256.slice(0, 24)}"`,
    sri: "",
  };
  return cached;
}
