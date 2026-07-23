import type { ObservationMediaDedupInput } from "./observationMediaDedup.js";

export const RECORD_1780552463658_REGRESSION = {
  source: "public_page_and_public_derivatives_only",
  sourceSha: "2e8c22242abc6eccb3a54137af4ed4d063fc6371",
  recordId: "record-1780552463658",
  expected: {
    sourceMediaCount: 6,
    uniqueDisplayMediaCount: 3,
    aiRepresentativeImageCount: 3,
    exactDuplicateClusters: 3,
    observationCount: 1,
    representativeMediaIds: [
      "36e7dba9-9e6e-4e1b-8ddd-5a26076ba9ea",
      "8ed39677-0959-44d5-a58e-6c4a8502f1c8",
      "9f0eb001-0c30-46b7-8e29-6c0b0e45d4a9",
    ],
    evidenceRoles: {
      "36e7dba9-9e6e-4e1b-8ddd-5a26076ba9ea": "primary_morphology",
      "8ed39677-0959-44d5-a58e-6c4a8502f1c8": "perch_context",
      "9f0eb001-0c30-46b7-8e29-6c0b0e45d4a9": "environment_context",
    },
  },
  media: [
    {
      mediaId: "36e7dba9-9e6e-4e1b-8ddd-5a26076ba9ea",
      displayOrder: 0,
      contentSha256: "0aeb0c5a8125e3c039f9c4a04f2418e713361b58c4d8d2a07aee802be44e8c6c",
      bytes: 28032,
    },
    {
      mediaId: "8ed39677-0959-44d5-a58e-6c4a8502f1c8",
      displayOrder: 1,
      contentSha256: "31cbd78411d9d75b500afd4d94e4224ecacb4bb240a7ecc4a7f6440a15bd3358",
      bytes: 40784,
    },
    {
      mediaId: "9f0eb001-0c30-46b7-8e29-6c0b0e45d4a9",
      displayOrder: 2,
      contentSha256: "e89245d213dbcbbb0986aa40110dd5119ab9129ddcb91825e6ea5a89fc8af4a0",
      bytes: 290908,
    },
    {
      mediaId: "a6c4e4ea-ddb2-4bc1-b22d-c2bccc3730a0",
      displayOrder: 3,
      contentSha256: "0aeb0c5a8125e3c039f9c4a04f2418e713361b58c4d8d2a07aee802be44e8c6c",
      bytes: 28032,
    },
    {
      mediaId: "bddcb6bd-91bf-441e-b7ad-de12247c9ebe",
      displayOrder: 4,
      contentSha256: "31cbd78411d9d75b500afd4d94e4224ecacb4bb240a7ecc4a7f6440a15bd3358",
      bytes: 40784,
    },
    {
      mediaId: "c81eefaa-80ce-46d2-a204-dc57d674daab",
      displayOrder: 5,
      contentSha256: "e89245d213dbcbbb0986aa40110dd5119ab9129ddcb91825e6ea5a89fc8af4a0",
      bytes: 290908,
    },
  ] satisfies ObservationMediaDedupInput[],
} as const;

export const SYNTHETIC_NEAR_DUPLICATE_FIXTURE = [
  {
    mediaId: "compressed-source",
    displayOrder: 0,
    widthPx: 1600,
    heightPx: 1200,
    perceptualHashes: ["0f0f0f0f0f0f0f0f"],
  },
  {
    mediaId: "compressed-copy",
    displayOrder: 1,
    widthPx: 800,
    heightPx: 600,
    perceptualHashes: ["0f0f0f0f0f0f0f1f"],
  },
  {
    mediaId: "rotated-copy",
    displayOrder: 2,
    widthPx: 1200,
    heightPx: 1600,
    perceptualHashes: ["f0f0f0f0f0f0f0f0", "0f0f0f0f0f0f0f1f"],
  },
  {
    mediaId: "same-bird-different-moment",
    displayOrder: 3,
    widthPx: 1600,
    heightPx: 1200,
    perceptualHashes: ["cccc3333cccc3333"],
  },
  {
    mediaId: "same-bird-closeup",
    displayOrder: 4,
    widthPx: 1200,
    heightPx: 1600,
    perceptualHashes: ["aaaaaaaa55555555"],
  },
] satisfies ObservationMediaDedupInput[];
