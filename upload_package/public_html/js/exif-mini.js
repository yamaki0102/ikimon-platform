/**
 * exif-mini.js — ikimon.life 用 軽量 EXIF リーダー
 * JPEG / HEIC ファイルから GPS座標 と 撮影日時 のみを抽出する
 * 外部ライブラリ不要（ArrayBuffer ベースのバイナリパース）
 * @version 3.1 — Fix: scan ALL APP1 markers (XMP before EXIF case) + enhanced logging
 */
const EXIF = (() => {
    'use strict';

    /**
     * File オブジェクトから EXIF データを読み取る
     * @param {File} file 
     * @returns {Promise<{lat: number|null, lng: number|null, date: string|null, orientation: number|null, imgDirection: number|null}>}
     */
    async function readFromFile(file) {
        const result = { lat: null, lng: null, date: null, orientation: null, imgDirection: null };

        try {
            // Read first 512KB (HEIC may need more than 256KB)
            const slice = file.slice(0, 524288);
            const buffer = await slice.arrayBuffer();
            const view = new DataView(buffer);

            console.log('[EXIF] Reading file:', file.name, 'type:', file.type, 'size:', file.size,
                'magic:', view.byteLength >= 2 ? '0x' + view.getUint16(0).toString(16) : 'N/A');

            // Detect format by magic bytes
            if (view.byteLength >= 2 && view.getUint16(0) === 0xFFD8) {
                // JPEG
                const r = parseJpegExif(buffer);
                console.log('[EXIF] JPEG result:', r.lat !== null ? 'GPS found' : 'no GPS', r.date ? 'date found' : 'no date');
                return r;
            } else if (view.byteLength >= 12 && isHeifContainer(view)) {
                // HEIC / HEIF (ISOBMFF container)
                const r = parseHeicExif(buffer);
                console.log('[EXIF] HEIC result:', r.lat !== null ? 'GPS found' : 'no GPS', r.date ? 'date found' : 'no date');
                return r;
            } else {
                console.log('[EXIF] Unknown format, trying JPEG parse');
                return parseJpegExif(buffer);
            }
        } catch (e) {
            console.warn('[EXIF] Read failed:', e);
            return result;
        }
    }

    /** Check if buffer is ISOBMFF (HEIC/HEIF) container */
    function isHeifContainer(view) {
        // ISOBMFF: offset 4-7 = 'ftyp'
        if (view.byteLength < 12) return false;
        const ftyp = String.fromCharCode(
            view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7)
        );
        return ftyp === 'ftyp';
    }

    // ===== JPEG EXIF PARSER =====

    function parseJpegExif(buffer) {
        const result = { lat: null, lng: null, date: null, orientation: null, imgDirection: null };
        const view = new DataView(buffer);

        if (view.getUint16(0) !== 0xFFD8) return result;

        let offset = 2;
        while (offset < view.byteLength - 4) {
            const marker = view.getUint16(offset);

            // Stop at SOS (Start of Scan) — no more metadata after this
            if (marker === 0xFFDA) break;

            if (marker === 0xFFE1) {
                const segLen = view.getUint16(offset + 2);
                // Check for 'Exif\0\0' header (0x45786966 0x0000)
                if (offset + 10 < view.byteLength &&
                    view.getUint32(offset + 4) === 0x45786966 &&
                    view.getUint16(offset + 8) === 0x0000) {
                    const tiffOffset = offset + 10;
                    parseTiff(view, tiffOffset, result);
                    return result; // Found EXIF APP1, done
                }
                // Not EXIF (could be XMP) — skip and keep scanning
                offset += 2 + segLen;
                continue;
            }

            if ((marker & 0xFF00) === 0xFF00) {
                const segLen = view.getUint16(offset + 2);
                offset += 2 + segLen;
            } else {
                break;
            }
        }

        return result;
    }

    // ===== HEIC EXIF PARSER (ISOBMFF) =====

    function parseHeicExif(buffer) {
        const result = { lat: null, lng: null, date: null };
        const view = new DataView(buffer);

        try {
            // Walk ISOBMFF boxes to find 'meta' box
            let offset = 0;
            while (offset < view.byteLength - 8) {
                const boxSize = view.getUint32(offset);
                const boxType = readAscii(view, offset + 4, 4);

                if (boxSize < 8) break; // Invalid box

                if (boxType === 'meta') {
                    // Meta box has a 4-byte version/flags field
                    const metaStart = offset + 12; // skip box header (8) + version/flags (4)
                    const metaEnd = offset + boxSize;
                    const exifData = findExifInMeta(view, metaStart, metaEnd, buffer);
                    if (exifData) return exifData;
                }

                offset += boxSize;
            }
        } catch (e) {
            console.warn('HEIC EXIF parse failed:', e);
        }

        return result;
    }

    /** Search for Exif data within the meta box */
    function findExifInMeta(view, start, end, buffer) {
        let offset = start;
        while (offset < end - 8) {
            const boxSize = view.getUint32(offset);
            const boxType = readAscii(view, offset + 4, 4);

            if (boxSize < 8 || offset + boxSize > end) break;

            if (boxType === 'iinf' || boxType === 'pitm' || boxType === 'iloc' || boxType === 'iprp') {
                // Skip known non-Exif meta sub-boxes
                offset += boxSize;
                continue;
            }

            if (boxType === 'Exif') {
                // Exif box: skip box header (8) + 4 bytes TIFF header offset
                let exifStart = offset + 8;
                // Some HEIC files prepend 4 bytes (TIFF offset prefix) before 'Exif\0\0'
                // Look for 'II' or 'MM' TIFF header
                const tiffStart = findTiffHeader(view, exifStart, offset + boxSize);
                if (tiffStart >= 0) {
                    const result = { lat: null, lng: null, date: null };
                    parseTiff(view, tiffStart, result);
                    return result;
                }
            }

            // Recursively search sub-boxes (some containers nest the Exif box)
            if (boxSize > 8) {
                const sub = findExifInMeta(view, offset + 8, offset + boxSize, buffer);
                if (sub) return sub;
            }

            offset += boxSize;
        }

        // Brute force scan: search for TIFF header ('II\x2a\x00' or 'MM\x00\x2a')
        // This catches HEIC files with non-standard Exif embedding
        for (let i = start; i < Math.min(end, view.byteLength) - 8; i++) {
            const b0 = view.getUint8(i);
            const b1 = view.getUint8(i + 1);
            if ((b0 === 0x49 && b1 === 0x49 && view.getUint16(i + 2, true) === 42) ||
                (b0 === 0x4D && b1 === 0x4D && view.getUint16(i + 2, false) === 42)) {
                const result = { lat: null, lng: null, date: null };
                parseTiff(view, i, result);
                if (result.lat !== null || result.date !== null) return result;
            }
        }

        return null;
    }

    /** Find TIFF header (II or MM) within a byte range */
    function findTiffHeader(view, start, end) {
        for (let i = start; i < Math.min(end, view.byteLength) - 4; i++) {
            const b0 = view.getUint8(i);
            const b1 = view.getUint8(i + 1);
            // Little-endian: 'II' (0x4949) + magic 42
            if (b0 === 0x49 && b1 === 0x49 && view.getUint16(i + 2, true) === 42) return i;
            // Big-endian: 'MM' (0x4D4D) + magic 42
            if (b0 === 0x4D && b1 === 0x4D && view.getUint16(i + 2, false) === 42) return i;
        }
        return -1;
    }

    function readAscii(view, offset, length) {
        let str = '';
        for (let i = 0; i < length && offset + i < view.byteLength; i++) {
            str += String.fromCharCode(view.getUint8(offset + i));
        }
        return str;
    }

    // ===== SHARED TIFF/IFD PARSER =====

    function parseTiff(view, tiffStart, result) {
        try {
            if (tiffStart + 8 > view.byteLength) return;
            const byteOrder = view.getUint16(tiffStart);
            const littleEndian = (byteOrder === 0x4949);

            const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
            const firstIFD = tiffStart + ifdOffset;

            const gpsIFDPointer = parseIFD(view, firstIFD, tiffStart, littleEndian, result, false);

            if (gpsIFDPointer) {
                parseIFD(view, tiffStart + gpsIFDPointer, tiffStart, littleEndian, result, true);
            }
        } catch (e) {
            // Corrupt EXIF, ignore
        }
    }

    function parseIFD(view, ifdStart, tiffStart, le, result, isGPS) {
        let gpsPointer = null;
        if (ifdStart + 2 > view.byteLength) return null;
        const count = view.getUint16(ifdStart, le);

        for (let i = 0; i < count; i++) {
            const entryOffset = ifdStart + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) break;

            const tag = view.getUint16(entryOffset, le);
            const type = view.getUint16(entryOffset + 2, le);
            const numValues = view.getUint32(entryOffset + 4, le);
            const valueOffset = entryOffset + 8;

            if (!isGPS) {
                if (tag === 0x8825) {
                    gpsPointer = view.getUint32(valueOffset, le);
                }

                if (tag === 0x9003 && type === 2) {
                    const strOffset = numValues > 4
                        ? tiffStart + view.getUint32(valueOffset, le)
                        : valueOffset;
                    result.date = readString(view, strOffset, numValues - 1);
                }

                if (tag === 0x0132 && type === 2 && !result.date) {
                    const strOffset = numValues > 4
                        ? tiffStart + view.getUint32(valueOffset, le)
                        : valueOffset;
                    result.date = readString(view, strOffset, numValues - 1);
                }

                if (tag === 0x8769) {
                    const exifPointer = view.getUint32(valueOffset, le);
                    parseIFD(view, tiffStart + exifPointer, tiffStart, le, result, false);
                }

                // Orientation (tag 0x0112) — SHORT type
                if (tag === 0x0112 && type === 3) {
                    result.orientation = view.getUint16(valueOffset, le);
                }
            } else {
                // GPS IFD tags
                console.log(`[EXIF GPS IFD] tag=${tag} type=${type} count=${numValues}`);
                if (tag === 1) {
                    result._latRef = String.fromCharCode(view.getUint8(valueOffset));
                    console.log('[EXIF GPS] latRef:', result._latRef);
                }
                if (tag === 3) {
                    result._lngRef = String.fromCharCode(view.getUint8(valueOffset));
                    console.log('[EXIF GPS] lngRef:', result._lngRef);
                }
                if (tag === 2) {
                    console.log('[EXIF GPS] Lat tag: type=' + type + ' numValues=' + numValues);
                    if (type === 5 && numValues === 3) {
                        const dataOffset = tiffStart + view.getUint32(valueOffset, le);
                        console.log('[EXIF GPS] Lat dataOffset=' + dataOffset + ' bufLen=' + view.byteLength);
                        if (dataOffset + 24 <= view.byteLength) {
                            // Log raw bytes
                            const rawBytes = [];
                            for (let b = 0; b < 24; b++) rawBytes.push(view.getUint8(dataOffset + b));
                            console.log('[EXIF GPS] Lat raw bytes:', rawBytes.map(x => x.toString(16).padStart(2,'0')).join(' '));
                            result._latDMS = readRationals(view, dataOffset, 3, le);
                            console.log('[EXIF GPS] Lat DMS:', result._latDMS);
                        } else {
                            console.warn('[EXIF GPS] Lat data out of bounds!');
                        }
                    }
                }
                if (tag === 4) {
                    console.log('[EXIF GPS] Lng tag: type=' + type + ' numValues=' + numValues);
                    if (type === 5 && numValues === 3) {
                        const dataOffset = tiffStart + view.getUint32(valueOffset, le);
                        console.log('[EXIF GPS] Lng dataOffset=' + dataOffset + ' bufLen=' + view.byteLength);
                        if (dataOffset + 24 <= view.byteLength) {
                            const rawBytes = [];
                            for (let b = 0; b < 24; b++) rawBytes.push(view.getUint8(dataOffset + b));
                            console.log('[EXIF GPS] Lng raw bytes:', rawBytes.map(x => x.toString(16).padStart(2,'0')).join(' '));
                            result._lngDMS = readRationals(view, dataOffset, 3, le);
                            console.log('[EXIF GPS] Lng DMS:', result._lngDMS);
                        } else {
                            console.warn('[EXIF GPS] Lng data out of bounds!');
                        }
                    }
                }

                // GPSImgDirection (tag 17 = 0x0011) — RATIONAL type
                if (tag === 17 && type === 5 && numValues === 1) {
                    const dataOffset = tiffStart + view.getUint32(valueOffset, le);
                    if (dataOffset + 8 <= view.byteLength) {
                        const num = view.getUint32(dataOffset, le);
                        const den = view.getUint32(dataOffset + 4, le);
                        if (den !== 0) result.imgDirection = num / den;
                    }
                }
            }
        }

        if (result._latDMS && result._lngDMS) {
            console.log('[EXIF GPS] DMS lat:', JSON.stringify(result._latDMS), 'ref:', result._latRef);
            console.log('[EXIF GPS] DMS lng:', JSON.stringify(result._lngDMS), 'ref:', result._lngRef);
            result._gpsDebug = {latDMS: result._latDMS, lngDMS: result._lngDMS, latRef: result._latRef, lngRef: result._lngRef};
            result.lat = dmsToDecimal(result._latDMS, result._latRef || 'N');
            result.lng = dmsToDecimal(result._lngDMS, result._lngRef || 'E');
            delete result._latDMS;
            delete result._lngDMS;
            delete result._latRef;
            delete result._lngRef;
        } else {
            result._gpsDebug = {latDMS: result._latDMS || null, lngDMS: result._lngDMS || null, error: 'no_dms'};
            console.log('[EXIF GPS] No DMS data found. _latDMS:', result._latDMS, '_lngDMS:', result._lngDMS);
        }

        return gpsPointer;
    }

    function readRationals(view, offset, count, le) {
        const vals = [];
        for (let i = 0; i < count; i++) {
            const num = view.getUint32(offset + i * 8, le);
            const den = view.getUint32(offset + i * 8 + 4, le);
            vals.push(den ? num / den : 0);
        }
        return vals;
    }

    function dmsToDecimal(dms, ref) {
        let val = dms[0] + dms[1] / 60 + dms[2] / 3600;
        if (ref === 'S' || ref === 'W') val = -val;
        return val;
    }

    function readString(view, offset, length) {
        let str = '';
        for (let i = 0; i < length && offset + i < view.byteLength; i++) {
            const c = view.getUint8(offset + i);
            if (c === 0) break;
            str += String.fromCharCode(c);
        }
        return str;
    }

    return { readFromFile };
})();
window.EXIF = EXIF;
