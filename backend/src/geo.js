// Parse a PostGIS geography/geometry POINT as returned by PostgREST
// (hex EWKB string, or GeoJSON) into { lat, lng }. Returns null if unknown.
const parseLocation = (loc) => {
  try {
    if (!loc) return null;
    if (typeof loc === 'object' && Array.isArray(loc.coordinates)) {
      return { lng: loc.coordinates[0], lat: loc.coordinates[1] };
    }
    if (typeof loc === 'string') {
      const m = loc.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
      if (m) return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
      if (/^[0-9a-fA-F]+$/.test(loc) && loc.length >= 42) {
        const buf = Buffer.from(loc, 'hex');
        const little = buf[0] === 1;
        const type = little ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
        const hasSrid = (type & 0x20000000) !== 0;
        const off = 5 + (hasSrid ? 4 : 0);
        const rd = (o) => (little ? buf.readDoubleLE(o) : buf.readDoubleBE(o));
        return { lng: rd(off), lat: rd(off + 8) };
      }
    }
  } catch (e) {
    /* fall through */
  }
  return null;
};

module.exports = { parseLocation };
