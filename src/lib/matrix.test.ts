import { describe, expect, it } from 'vitest';
import { decodeMatrix, encodeMatrix } from './matrix.ts';

describe('encodeMatrix / decodeMatrix', () => {
  it('round-trips values, keeping NaN as NaN and 0 as 0', () => {
    const rows = [
      [1, 2.5, Number.NaN],
      [0, -3, 4],
    ];
    const bytes = encodeMatrix(rows);
    const decoded = decodeMatrix(bytes, 2, 3);

    expect(decoded.rows).toBe(2);
    expect(decoded.cols).toBe(3);
    expect(decoded.get(0, 0)).toBe(1);
    expect(decoded.get(0, 1)).toBe(2.5);
    expect(decoded.get(0, 2)).toBeNull();
    expect(decoded.get(1, 0)).toBe(0);
    expect(decoded.get(1, 1)).toBe(-3);
  });

  it('writes 4 bytes per cell, little-endian', () => {
    const bytes = encodeMatrix([[1, 2]]);
    expect(bytes.byteLength).toBe(8);
    expect(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(0, true)).toBe(1);
  });

  it('rejects ragged rows', () => {
    expect(() => encodeMatrix([[1, 2], [3]])).toThrow(/ragged/);
  });

  it('rejects a buffer that does not match the stated shape', () => {
    const bytes = encodeMatrix([[1, 2, 3]]);
    expect(() => decodeMatrix(bytes, 2, 3)).toThrow(/size/);
  });
});
