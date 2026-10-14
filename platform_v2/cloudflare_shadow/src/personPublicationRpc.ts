import { WorkerEntrypoint } from "cloudflare:workers";
import { deliverNocosilPersonEdition, type PersonPublicationResources } from "./personPublicationService";
import type { PersonEditionEnvelope, VerifiedPersonIssuer } from "./personPublicationExchange";

/**
 * Private, explicitly registered NOCOSIL service binding only. No fetch handler,
 * public HTTP ingress, cookie forwarding, shared OAuth secret, or cross-DB access.
 */
export class NocosilPublications extends WorkerEntrypoint<PersonPublicationResources> {
  async deliver(envelope: PersonEditionEnvelope, issuer: VerifiedPersonIssuer) {
    return deliverNocosilPersonEdition(this.env, envelope, issuer);
  }
}
