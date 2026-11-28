import { readFileSync } from "node:fs";

export function readDbf(path, encoding = "shift_jis") {
  const b = readFileSync(path);
  const n = b.readUInt32LE(4);
  const hl = b.readUInt16LE(8);
  const rl = b.readUInt16LE(10);
  const td = new TextDecoder(encoding);
  const fields = [];
  let p = 32;
  let off = 1;
  while (b[p] !== 0x0d) {
    const name = b.toString("latin1", p, p + 11).replace(/\0.*$/, "");
    const len = b[p + 16];
    fields.push({ name, off, len });
    off += len;
    p += 32;
  }
  const rows = [];
  for (let i = 0; i < n; i++) {
    const s = hl + i * rl;
    const row = { _deleted: b[s] === 0x2a };
    for (const f of fields) row[f.name] = td.decode(b.subarray(s + f.off, s + f.off + f.len)).trim();
    rows.push(row);
  }
  return rows;
}

export function readShpPolygons(path) {
  const b = readFileSync(path);
  const out = [];
  let p = 100;
  while (p + 8 <= b.length) {
    const len = b.readInt32BE(p + 4) * 2;
    const s = p + 8;
    const type = b.readInt32LE(s);
    if (type === 5 || type === 15 || type === 25) {
      const np = b.readInt32LE(s + 36);
      const npts = b.readInt32LE(s + 40);
      const parts = [];
      for (let i = 0; i < np; i++) parts.push(b.readInt32LE(s + 44 + i * 4));
      const ps = s + 44 + np * 4;
      const rings = [];
      for (let i = 0; i < np; i++) {
        const a = parts[i];
        const e = i + 1 < np ? parts[i + 1] : npts;
        const ring = [];
        for (let k = a; k < e; k++) ring.push([b.readDoubleLE(ps + k * 16), b.readDoubleLE(ps + k * 16 + 8)]);
        rings.push(ring);
      }
      out.push(rings);
    } else out.push(null);
    p += 8 + len;
  }
  return out;
}

export function signedArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return a / 2;
}

export function ringsToPolygons(rings, pointInRing) {
  const sorted = rings.filter((r) => r.length >= 4).map((r) => ({ r, a: Math.abs(signedArea(r)) })).sort((x, y) => y.a - x.a);
  const done = [];
  const polys = [];
  for (const item of sorted) {
    let host = null;
    for (const d of done) if (pointInRing(item.r[0][0], item.r[0][1], d.r)) host = d;
    if (host && host.kind === 'outer') {
      host.poly.push(item.r);
      done.push({ r: item.r, kind: 'hole' });
    } else {
      const poly = [item.r];
      polys.push(poly);
      done.push({ r: item.r, kind: 'outer', poly });
    }
  }
  return polys;
}
