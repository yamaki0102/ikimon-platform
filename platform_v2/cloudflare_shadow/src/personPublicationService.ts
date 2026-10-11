import { PERSON_PUBLICATIONS } from "../../src/content/personPublications";
import { receivePersonEdition, readPersonEdition, PersonExchangeError,
  type PersonD1, type PersonEditionBlobStore, type PersonEditionEnvelope, type VerifiedPersonIssuer,
  type StoredPersonRow } from "./personPublicationExchange";
import { personPublicationPath } from "./personPublication";

export interface PersonPublicationResources {
  readonly CORE_DB?: PersonD1;
  readonly ASSET_BUCKET?: PersonEditionBlobStore;
}
export interface PersonPublicationDelivery {
  readonly schema: "zukan.person-publication-delivery/v1";
  readonly publicId: string;
  readonly revision: number;
  readonly editionId: string;
  readonly state: "published" | "withdrawn";
  readonly path: string | null;
  readonly disposition: "created" | "updated" | "replayed";
}

/** Stable, opaque identity. Only the NOCOSIL server constructs the publisher reference. */
export async function publicIdForNocosilPublisher(issuerPublicRef: string): Promise<string> {
  if (!/^publisher_[a-f0-9]{64}$/u.test(issuerPublicRef)) throw new PersonExchangeError("person_publisher_reference_invalid", 400);
  const bytes = new TextEncoder().encode("nocosil-zukan-public-profile/v1:" + issuerPublicRef);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
function resources(env: PersonPublicationResources): { db: PersonD1; blobs: PersonEditionBlobStore } {
  if (!env.CORE_DB || !env.ASSET_BUCKET) throw new PersonExchangeError("person_publication_storage_unavailable", 503);
  return { db: env.CORE_DB, blobs: env.ASSET_BUCKET };
}

/**
 * Private service-binding consumer, not an HTTP endpoint. The trusted NOCOSIL
 * publisher rechecks current membership, subject rights and exact-edition consent.
 * Do not expose this function through the anonymous Worker fetch handler.
 */
export async function deliverNocosilPersonEdition(env: PersonPublicationResources,
  envelope: PersonEditionEnvelope, issuer: VerifiedPersonIssuer): Promise<PersonPublicationDelivery> {
  if (!envelope || !issuer || issuer.actorAuthorized !== true || issuer.subjectConsent !== true
    || issuer.issuerPublicRef !== envelope.issuerPublicRef) throw new PersonExchangeError("person_publication_authority_denied", 403);
  if (await publicIdForNocosilPublisher(issuer.issuerPublicRef) !== envelope.publicId
    || PERSON_PUBLICATIONS.some(person => person.publicId === envelope.publicId)) {
    throw new PersonExchangeError("person_publication_subject_binding_denied", 403);
  }
  const { db, blobs } = resources(env);
  const receipt = await receivePersonEdition(db, blobs, envelope, issuer);
  const row = await db.prepare("SELECT public_id, issuer_public_ref, current_revision, edition_id, digest, publication_state, content_key FROM zukan_person_publications WHERE public_id = ?")
    .bind(envelope.publicId).first<StoredPersonRow>();
  if (!row || row.issuer_public_ref !== issuer.issuerPublicRef || row.current_revision !== envelope.revision
    || row.edition_id !== envelope.editionId || row.publication_state !== (envelope.action === "withdraw" ? "withdrawn" : "published")) {
    throw new PersonExchangeError("person_delivery_superseded", 409);
  }
  const current = await readPersonEdition(db, blobs, envelope.publicId);
  if (!current.found || (envelope.action === "publish" && current.profile === null)
    || (envelope.action === "withdraw" && current.profile !== null)) {
    throw new PersonExchangeError("person_delivery_readback_mismatch", 503);
  }
  const observed = await db.prepare("SELECT * FROM zukan_person_publications WHERE public_id = ?")
    .bind(envelope.publicId).first<StoredPersonRow>();
  if (!observed || observed.current_revision !== row.current_revision || observed.digest !== row.digest) {
    throw new PersonExchangeError("person_delivery_superseded", 409);
  }
  return { schema: "zukan.person-publication-delivery/v1", publicId: row.public_id,
    revision: row.current_revision, editionId: row.edition_id, state: row.publication_state,
    path: current.profile === null ? null : personPublicationPath(current.profile), disposition: receipt };
}
