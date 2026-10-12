export type BiosecurityPhotoMetadata = {
  time: {
    source: "photo_exif" | "unknown";
    localDateTime: string | null;
    offsetMinutes: number | null;
    instant: string | null;
    precision: "second" | "minute" | "date" | "unknown";
  };
  location: { lat: number; lng: number; source: "photo_exif" } | null;
};

export const BIOSECURITY_PHOTO_METADATA_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Read a bounded prefix locally, before re-encoding. Only DateTimeOriginal and
 * its own OffsetTimeOriginal are capture-time candidates; modification,
 * digitization, GPS clock, file timestamps and the current clock are not.
 * This is untrusted photo metadata, not proof of where/when a photo was taken.
 *
 * TIFF follows CIPA Exif; PNG eXIf omits the JPEG Exif identifier (PNG §11.3.4.5).
 * HEIF supports ordinary iloc file/idat extents with a declared TIFF offset.
 * Unsupported layouts, external item data and metadata beyond 8 MiB stay unknown.
 * Keep this function self-contained: its exact compiled body is also the browser helper.
 */
export function readBiosecurityPhotoMetadata(buffer: ArrayBuffer): BiosecurityPhotoMetadata {
  const empty = (): BiosecurityPhotoMetadata => ({
    time: { source: "unknown", localDateTime: null, offsetMinutes: null, instant: null, precision: "unknown" },
    location: null,
  });
  try {
    const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8 * 1024 * 1024));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const size = bytes.byteLength;
    const has = (start: number, count: number, end = size) => Number.isSafeInteger(start) && Number.isSafeInteger(count) && start >= 0 && count >= 0 && start <= end && count <= end - start;
    const text = (start: number, count: number) => has(start, count) ? String.fromCharCode(...bytes.subarray(start, start + count)) : "";
    const candidates: BiosecurityPhotoMetadata[] = [];
    let metadataCount = 0;

    const parseTime = (raw: string | null, offset: string | null): BiosecurityPhotoMetadata["time"] => {
      const match = raw?.match(/^(\d{4}):(\d{2}):(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
      if (!match) return empty().time;
      const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
      const hour = Number(match[4] ?? 0), minute = Number(match[5] ?? 0), second = Number(match[6] ?? 0);
      const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]! || hour > 23 || minute > 59 || second > 59) return empty().time;
      const precision = match[4] === undefined ? "date" : match[6] === undefined ? "minute" : "second";
      const localDateTime = `${match[1]}-${match[2]}-${match[3]}` + (precision === "date" ? "" : `T${match[4]}:${match[5]}` + (precision === "second" ? `:${match[6]}` : ""));
      const offsetMatch = offset?.match(/^([+-])(\d{2}):(\d{2})$/);
      let offsetMinutes: number | null = null;
      if (offsetMatch && offset !== "-00:00") {
        const hours = Number(offsetMatch[2]), minutes = Number(offsetMatch[3]);
        if (hours <= 14 && minutes <= 59 && (hours !== 14 || minutes === 0)) offsetMinutes = (offsetMatch[1] === "-" ? -1 : 1) * (hours * 60 + minutes);
      }
      let instant: string | null = null;
      if (offsetMinutes !== null && precision !== "date") {
        const date = new Date(0);
        date.setUTCFullYear(year, month - 1, day);
        date.setUTCHours(hour, minute - offsetMinutes, second, 0);
        // Never emit an expanded/signed ISO year outside the supported capture contract.
        if (date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999) instant = date.toISOString();
      }
      return { source: "photo_exif", localDateTime, offsetMinutes, instant, precision };
    };

    const tiff = (data: Uint8Array): BiosecurityPhotoMetadata => {
      const result = empty();
      if (data.byteLength < 8 || data.byteLength > 256 * 1024) return result;
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const order = dv.getUint16(0), little = order === 0x4949;
      if ((!little && order !== 0x4d4d) || dv.getUint16(2, little) !== 42) return result;
      const fits = (start: number, count: number) => has(start, count, data.byteLength);
      type Entry = { type: number; count: number; start: number };
      const visited = new Set<number>();
      const ifd = (offset: number): Map<number, Entry | null> => {
        const entries = new Map<number, Entry | null>();
        if (visited.has(offset) || offset < 8 || !fits(offset, 2)) return entries;
        visited.add(offset);
        const count = dv.getUint16(offset, little);
        if (count > 256 || !fits(offset + 2, count * 12 + 4)) return entries;
        for (let index = 0; index < count; index++) {
          const at = offset + 2 + index * 12, tag = dv.getUint16(at, little);
          if (entries.has(tag)) { entries.set(tag, null); continue; }
          const type = dv.getUint16(at + 2, little), n = dv.getUint32(at + 4, little);
          const width = type === 2 ? 1 : type === 4 ? 4 : type === 5 ? 8 : 0;
          if (!width || n < 1 || n > 256) { entries.set(tag, null); continue; }
          const length = n * width, start = length <= 4 ? at + 8 : dv.getUint32(at + 8, little);
          const entry = start >= 8 && fits(start, length) ? { type, count: n, start } : null;
          entries.set(tag, entry);
        }
        return entries;
      };
      const ascii = (entry: Entry | null | undefined): string | null => {
        if (!entry || entry.type !== 2 || entry.count > 64) return null;
        let out = "", ended = false;
        for (let index = 0; index < entry.count; index++) {
          const value = data[entry.start + index]!;
          if (value === 0) { ended = true; continue; }
          if (ended || value < 32 || value > 126) return null;
          out += String.fromCharCode(value);
        }
        return out.trim();
      };
      const pointer = (entry: Entry | null | undefined) => entry?.type === 4 && entry.count === 1 ? dv.getUint32(entry.start, little) : 0;
      const ifd0 = ifd(dv.getUint32(4, little));
      const exif = ifd(pointer(ifd0.get(0x8769)));
      result.time = parseTime(ascii(exif.get(0x9003)), ascii(exif.get(0x9011)));
      const gps = ifd(pointer(ifd0.get(0x8825)));
      const coordinate = (entry: Entry | null | undefined, reference: string | null, positive: string, negative: string, maximum: number): number | null => {
        if (!entry || entry.type !== 5 || entry.count !== 3 || (reference !== positive && reference !== negative)) return null;
        const parts: number[] = [];
        for (let index = 0; index < 3; index++) {
          const denominator = dv.getUint32(entry.start + index * 8 + 4, little);
          if (denominator === 0) return null;
          parts.push(dv.getUint32(entry.start + index * 8, little) / denominator);
        }
        if (parts[0]! > maximum || parts[1]! >= 60 || parts[2]! >= 60) return null;
        const value = parts[0]! + parts[1]! / 60 + parts[2]! / 3600;
        return value <= maximum ? (reference === negative ? -value : value) : null;
      };
      const lat = coordinate(gps.get(2), ascii(gps.get(1)), "N", "S", 90);
      const lng = coordinate(gps.get(4), ascii(gps.get(3)), "E", "W", 180);
      if (lat !== null && lng !== null) result.location = { lat, lng, source: "photo_exif" };
      return result;
    };
    const add = (data: Uint8Array) => {
      metadataCount++;
      if (metadataCount <= 4) candidates.push(tiff(data));
    };

    if (size >= 4 && view.getUint16(0) === 0xffd8) {
      let at = 2;
      for (let segments = 0; segments < 2048 && has(at, 2); segments++) {
        if (bytes[at++] !== 0xff) break;
        while (has(at, 1) && bytes[at] === 0xff) at++;
        if (!has(at, 1)) break;
        const marker = bytes[at++]!;
        if (marker === 0xda || marker === 0xd9) break;
        if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        if (!has(at, 2)) break;
        const length = view.getUint16(at);
        if (length < 2 || !has(at, length)) break;
        if (marker === 0xe1 && length >= 8 && text(at + 2, 6) === "Exif\0\0") add(bytes.subarray(at + 8, at + length));
        at += length;
      }
    } else if (size >= 8 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
      let at = 8;
      for (let chunks = 0; chunks < 2048 && has(at, 12); chunks++) {
        const length = view.getUint32(at), kind = text(at + 4, 4);
        if (!has(at + 8, length + 4)) break;
        if (kind === "eXIf" && length <= 256 * 1024) {
          let crc = 0xffffffff;
          for (let index = at + 4; index < at + 8 + length; index++) {
            crc ^= bytes[index]!;
            for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
          }
          if (((crc ^ 0xffffffff) >>> 0) === view.getUint32(at + 8 + length)) add(bytes.subarray(at + 8, at + 8 + length));
        }
        at += 12 + length;
        if (kind === "IEND") break;
      }
    } else if (size >= 12 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
      const end = Math.min(size, view.getUint32(4, true) + 8);
      let at = 12;
      for (let chunks = 0; chunks < 2048 && has(at, 8, end); chunks++) {
        const length = view.getUint32(at + 4, true), kind = text(at, 4);
        if (!has(at + 8, length + (length & 1), end)) break;
        if (kind === "EXIF") {
          const start = at + 8 + (length >= 6 && text(at + 8, 6) === "Exif\0\0" ? 6 : 0);
          add(bytes.subarray(start, at + 8 + length));
        }
        at += 8 + length + (length & 1);
      }
    } else if (size >= 16 && text(4, 4) === "ftyp") {
      type Box = { type: string; start: number; end: number };
      let boxCount = 0;
      const boxes = (start: number, end: number): Box[] => {
        const out: Box[] = [];
        for (let at = start; has(at, 8, end);) {
          if (++boxCount > 512) return [];
          let length = view.getUint32(at), header = 8;
          if (length === 1) {
            if (!has(at, 16, end)) break;
            length = view.getUint32(at + 8) * 4294967296 + view.getUint32(at + 12); header = 16;
          } else if (length === 0) length = end - at;
          if (length < header || !has(at, length, end)) break;
          out.push({ type: text(at + 4, 4), start: at + header, end: at + length });
          at += length;
        }
        return out;
      };
      const top = boxes(0, size), ftyp = top.find(box => box.type === "ftyp");
      const brands = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis"]);
      let supported = !!ftyp && brands.has(text(ftyp.start, 4));
      if (ftyp) for (let at = ftyp.start + 8; at + 4 <= ftyp.end && at < ftyp.start + 256; at += 4) if (brands.has(text(at, 4))) supported = true;
      if (!supported) return empty();
      const metas = top.filter(box => box.type === "meta");
      if (metas.length !== 1) return empty();
      const meta = metas[0]!;
      if (!has(meta.start, 4, meta.end) || view.getUint32(meta.start) !== 0) return empty();
      const child = boxes(meta.start + 4, meta.end);
      const iinf = child.filter(box => box.type === "iinf"), iloc = child.filter(box => box.type === "iloc");
      if (iinf.length !== 1 || iloc.length !== 1) return empty();
      const info = iinf[0]!;
      if (!has(info.start, 6, info.end)) return empty();
      const infoVersion = view.getUint8(info.start);
      if (infoVersion > 1 || !has(info.start, infoVersion === 0 ? 6 : 8, info.end)) return empty();
      const entries = boxes(info.start + (infoVersion === 0 ? 6 : 8), info.end);
      const expected = infoVersion === 0 ? view.getUint16(info.start + 4) : view.getUint32(info.start + 4);
      if (entries.length !== expected || expected > 128) return empty();
      const exifIds: number[] = [];
      for (const entry of entries) {
        if (entry.type !== "infe" || !has(entry.start, 12, entry.end)) continue;
        const version = view.getUint8(entry.start), wide = version === 3;
        if (version !== 2 && version !== 3) continue;
        if (!has(entry.start, wide ? 14 : 12, entry.end)) continue;
        const id = wide ? view.getUint32(entry.start + 4) : view.getUint16(entry.start + 4);
        if (text(entry.start + (wide ? 10 : 8), 4) === "Exif") exifIds.push(id);
      }
      // Do not choose a thumbnail/burst's unrelated Exif item when the file has several.
      if (exifIds.length !== 1) return empty();
      const location = iloc[0]!;
      let cursor = location.start;
      const take = (length: number): number => {
        if (length > 8 || !has(cursor, length, location.end)) throw new Error("metadata_bounds");
        let value = 0;
        for (let index = 0; index < length; index++) value = value * 256 + bytes[cursor++]!;
        if (!Number.isSafeInteger(value)) throw new Error("metadata_bounds");
        return value;
      };
      const version = take(1); take(3);
      if (version > 2) return empty();
      const lengths = take(1), bases = take(1);
      const offsetSize = lengths >>> 4, lengthSize = lengths & 15, baseSize = bases >>> 4, indexSize = version ? bases & 15 : 0;
      if ([offsetSize, lengthSize, baseSize, indexSize].some(n => n > 8) || (!version && (bases & 15))) return empty();
      const items = take(version < 2 ? 2 : 4);
      if (items > 128) return empty();
      const idats = child.filter(box => box.type === "idat"), mdats = top.filter(box => box.type === "mdat");
      let found = false;
      for (let index = 0; index < items; index++) {
        const id = take(version < 2 ? 2 : 4), method = version ? take(2) : 0, reference = take(2), base = take(baseSize), count = take(2);
        if (count > 16) return empty();
        const pieces: Uint8Array[] = [];
        let total = 0, usable = reference === 0 && (method === 0 || method === 1);
        for (let extent = 0; extent < count; extent++) {
          if (version && indexSize) take(indexSize);
          const offset = take(offsetSize), length = take(lengthSize);
          if (id !== exifIds[0]) continue;
          const container = method === 1 && idats.length === 1 ? idats[0]! : null;
          const start = base + offset + (container?.start ?? 0);
          const inContainer = method === 1 ? !!container && has(start, length, container.end) && start >= container.start : mdats.some(box => start >= box.start && has(start, length, box.end));
          total += length;
          if (!usable || !length || total > 256 * 1024 || !inContainer || !has(start, length)) { usable = false; continue; }
          pieces.push(bytes.subarray(start, start + length));
        }
        if (id === exifIds[0]) {
          if (found || !usable || pieces.length !== count || total < 12) return empty();
          found = true;
          const joined = new Uint8Array(total);
          let at = 0;
          for (const piece of pieces) { joined.set(piece, at); at += piece.length; }
          const offset = new DataView(joined.buffer).getUint32(0);
          if (offset > total - 12) return empty();
          add(joined.subarray(4 + offset));
        }
      }
    }
    if (metadataCount > 4) return empty();
    const result = empty();
    const times = candidates.filter(item => item.time.source === "photo_exif").map(item => item.time);
    const locations = candidates.flatMap(item => item.location ? [item.location] : []);
    if (times.length && times.every(item => JSON.stringify(item) === JSON.stringify(times[0]))) result.time = times[0]!;
    if (locations.length && locations.every(item => JSON.stringify(item) === JSON.stringify(locations[0]))) result.location = locations[0]!;
    return result;
  } catch {
    return empty();
  }
}

// __name is the harmless function-name helper inserted by the existing tsx/esbuild
// materialization path. The parser otherwise has no closure, imports, network or DOM use.
export const BIOSECURITY_PHOTO_METADATA_SCRIPT = `(() => { const __name = (value) => value; window.BIOSECURITY_PHOTO_METADATA_MAX_BYTES = ${BIOSECURITY_PHOTO_METADATA_MAX_BYTES}; window.readBiosecurityPhotoMetadata = (${readBiosecurityPhotoMetadata.toString()}); })();`;
