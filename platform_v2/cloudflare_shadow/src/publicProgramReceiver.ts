import {
  parsePublicProgram,
  programDigest,
  ProgramInputError,
  type PublicProgram,
} from "../../src/services/publicProgram";

export const PUBLIC_PROGRAM_RECEIVER_SCHEMA = "zukan.public-program-receiver/v1" as const;

export interface PublicProgramReceiverStatement {
  bind(...values: Array<string | number | null>): PublicProgramReceiverStatement;
}

export interface PublicProgramReceiverDatabase {
  prepare(query: string): PublicProgramReceiverStatement;
  batch(statements: PublicProgramReceiverStatement[]): Promise<unknown[]>;
}

export interface PublicProgramReceiverSession {
  sessionId: string;
  organizerUserId: string;
  config: Record<string, unknown>;
}

export interface PublicProgramReceiverDependencies {
  actorUserId: string;
  body: Record<string, unknown>;
  database: PublicProgramReceiverDatabase;
  loadSession(sessionId: string): Promise<PublicProgramReceiverSession | null>;
  loadSessionByEventCode(eventCode: string): Promise<PublicProgramReceiverSession | null>;
  loadRally(sessionId: string): Promise<unknown>;
}

export type PublicProgramReceiverResult = {
  readonly status: 200 | 201 | 400 | 409 | 500;
  readonly body: Record<string, unknown>;
};

function receiverConfig(program: PublicProgram, digest: string, confirmed: boolean) {
  return {
    schema: PUBLIC_PROGRAM_RECEIVER_SCHEMA,
    source: "nocosil",
    publicProgramSchema: program.schema,
    publicProgramDigest: digest,
    profile: program.profile,
    placeLabel: program.placeLabel,
    description: program.description,
    conditions: program.conditions,
    public_listed: confirmed,
    program_receiver_private: !confirmed,
  };
}

function configMatches(
  session: PublicProgramReceiverSession,
  program: PublicProgram,
  digest: string,
): boolean {
  return session.config.schema === PUBLIC_PROGRAM_RECEIVER_SCHEMA
    && session.config.source === "nocosil"
    && session.config.publicProgramSchema === program.schema
    && session.config.publicProgramDigest === digest
    && session.config.profile === program.profile;
}

async function success(
  dependencies: PublicProgramReceiverDependencies,
  program: PublicProgram,
  session: PublicProgramReceiverSession,
  replayed: boolean,
): Promise<PublicProgramReceiverResult> {
  const rally = program.profile === "stamp_rally"
    ? await dependencies.loadRally(session.sessionId)
    : null;
  return {
    status: replayed ? 200 : 201,
    body: {
      schema: PUBLIC_PROGRAM_RECEIVER_SCHEMA,
      replayed,
      publicationState: session.config.public_listed === true ? "public" : "created_private",
      programId: session.sessionId,
      profile: program.profile,
      session,
      rally,
    },
  };
}

export function decodePublicProgramHandoffPayload(payload: string): PublicProgram {
  const encoded = payload.trim();
  if (!/^[A-Za-z0-9_-]{1,32768}$/u.test(encoded)) throw new ProgramInputError("handoff");
  const normalized = encoded.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return parsePublicProgram(parsed, true);
  } catch (error) {
    if (error instanceof ProgramInputError) throw error;
    throw new ProgramInputError("handoff");
  }
}

async function publicEventCode(program: PublicProgram, attempt: number): Promise<string> {
  if (attempt === 0) return ("P" + program.requestId.replace(/-/gu, "").slice(0, 7)).toUpperCase();
  const digest = await programDigest({ schema: "zukan.public-program-code/v1", requestId: program.requestId, attempt });
  return "P" + (BigInt("0x" + digest) % (36n ** 7n)).toString(36).padStart(7, "0").toUpperCase();
}

function isEventCodeUniqueFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const messages = [error.message];
  // D1 exposes SQLite detail in message and (on older bindings) cause.message.
  if ((error.message === "D1_ERROR" || error.message.startsWith("D1_ERROR:")) && error.cause instanceof Error) {
    messages.push(error.cause.message);
  }
  return messages.some(message => /^(?:D1_ERROR:\s*)?UNIQUE constraint failed: observation_event_sessions\.event_code(?:: SQLITE_CONSTRAINT(?:_UNIQUE)?)?$/u.test(message.trim()));
}

async function writeWithAvailableEventCode(
  dependencies: PublicProgramReceiverDependencies,
  program: PublicProgram,
  digest: string,
  confirmed: boolean,
  statements: (eventCode: string | null) => PublicProgramReceiverStatement[],
): Promise<PublicProgramReceiverResult | null> {
  // Keep established short invite codes. Only a confirmed collision with another
  // session permits a bounded deterministic alternative; requestId stays canonical.
  for (let attempt = 0; attempt < 8; attempt++) {
    const eventCode = confirmed ? await publicEventCode(program, attempt) : null;
    try {
      await dependencies.database.batch(statements(eventCode));
      return null;
    } catch (error) {
      const existing = await dependencies.loadSession(program.requestId);
      if (existing) {
        if (existing.organizerUserId !== dependencies.actorUserId || !configMatches(existing, program, digest)) {
          return { status: 409, body: { error: "public_program_idempotency_conflict" } };
        }
        if (!confirmed || existing.config.public_listed === true) {
          return success(dependencies, program, existing, true);
        }
      }
      if (!isEventCodeUniqueFailure(error)) {
        return { status: 500, body: { error: "public_program_receive_failed" } };
      }
      const codeOwner = eventCode ? await dependencies.loadSessionByEventCode(eventCode) : null;
      if (!codeOwner || codeOwner.sessionId === program.requestId) {
        return { status: 500, body: { error: "public_program_receive_failed" } };
      }
    }
  }
  return { status: 500, body: { error: "public_program_event_code_unavailable" } };
}

export async function receivePublicProgram(
  dependencies: PublicProgramReceiverDependencies,
): Promise<PublicProgramReceiverResult> {
  let program: PublicProgram;
  try {
    program = parsePublicProgram(dependencies.body.program, true);
  } catch (error) {
    return {
      status: 400,
      body: {
        error: "public_program_invalid",
        field: error instanceof ProgramInputError ? error.field : "program",
      },
    };
  }

  const digest = await programDigest(program);
  const confirmPublication = dependencies.body.confirmPublication === true;
  const existing = await dependencies.loadSession(program.requestId);
  if (existing) {
    if (
      existing.organizerUserId !== dependencies.actorUserId
      || !configMatches(existing, program, digest)
    ) {
      return { status: 409, body: { error: "public_program_idempotency_conflict" } };
    }
    if (confirmPublication && existing.config.public_listed !== true) {
      const confirmedConfig = receiverConfig(program, digest, true);
      const writeFailure = await writeWithAvailableEventCode(dependencies, program, digest, true, (eventCode) => [
        dependencies.database.prepare(
          "UPDATE observation_event_sessions SET event_code = COALESCE(event_code, ?), config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND organizer_user_id = ?"
        ).bind(eventCode, JSON.stringify(confirmedConfig), program.requestId, dependencies.actorUserId),
      ]);
      if (writeFailure) return writeFailure;
      const promoted = await dependencies.loadSession(program.requestId);
      if (!promoted || promoted.organizerUserId !== dependencies.actorUserId || !configMatches(promoted, program, digest) || promoted.config.public_listed !== true) {
        return { status: 500, body: { error: "public_program_publication_readback_failed" } };
      }
      return success(dependencies, program, promoted, true);
    }
    return success(dependencies, program, existing, true);
  }

  const config = receiverConfig(program, digest, confirmPublication);
  const statements = (eventCode: string | null): PublicProgramReceiverStatement[] => {
    const result: PublicProgramReceiverStatement[] = [
      dependencies.database.prepare(
        "INSERT INTO observation_event_sessions ("
        + "session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id, "
        + "plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m, "
        + "started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id"
        + ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        program.requestId, null, eventCode, program.title, dependencies.actorUserId, null,
        "community", "discovery", JSON.stringify(["discovery"]), null, null, 1000,
        program.startsAt, program.endsAt || null, JSON.stringify([]), JSON.stringify(config), null, null,
      ),
    ];

    if (program.profile === "stamp_rally") {
      const courseId = "program-rally-" + program.requestId;
      result.push(
        dependencies.database.prepare(
          "INSERT INTO observation_rally_courses "
          + "(course_id, session_id, title, status, config_json, created_by) "
          + "VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          courseId,
          program.requestId,
          program.title,
          "preflight",
          JSON.stringify({ source: "nocosil", publicProgramDigest: digest }),
          dependencies.actorUserId,
        ),
      );
      for (const [index, station] of program.stations.entries()) {
        result.push(
          dependencies.database.prepare(
            "INSERT INTO observation_rally_stations ("
            + "station_id, course_id, field_id, code, name, description, lat, lng, radius_m, "
            + "polygon_json, route_geojson, is_private, access_note, danger_note, status, sort_order"
            + ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)"
          ).bind(
            "program-station-" + program.requestId + "-" + station.id,
            courseId, null, station.id, station.name, "", null, null, null,
            JSON.stringify(null), JSON.stringify(null), 0, "", "", index,
          ),
        );
      }
    }
    return result;
  };
  const writeFailure = await writeWithAvailableEventCode(dependencies, program, digest, confirmPublication, statements);
  if (writeFailure) return writeFailure;

  const created = await dependencies.loadSession(program.requestId);
  if (
    !created
    || created.organizerUserId !== dependencies.actorUserId
    || !configMatches(created, program, digest)
  ) {
    return { status: 500, body: { error: "public_program_readback_failed" } };
  }
  return success(dependencies, program, created, false);
}
