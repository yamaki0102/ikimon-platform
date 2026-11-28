import { extractHamamatsuOdpf, HAMAMATSU_ODPF_URL } from "./extractHamamatsuOdpf";
import type { ExtractedFact } from "./types";

export interface SourceAdapter {
  url: string;
  extract(body: string, sourceId: string, fetchedAt: string): Promise<ExtractedFact[]>;
}

export const SOURCE_ADAPTERS: Record<string, SourceAdapter> = {
  E1: { url: HAMAMATSU_ODPF_URL, extract: extractHamamatsuOdpf },
};
