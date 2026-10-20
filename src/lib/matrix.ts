const BYTES_PER_CELL = 4;

/** Row-major Float32, little-endian. NaN marks "sem dado". */
export function encodeMatrix(rows: readonly (readonly number[])[]): Uint8Array {
  const cols = rows[0]?.length ?? 0;
  const bytes = new Uint8Array(rows.length * cols * BYTES_PER_CELL);
  const view = new DataView(bytes.buffer);
  rows.forEach((row, r) => {
    if (row.length !== cols) throw new Error(`Matrix has ragged rows: row ${String(r)} has ${String(row.length)} cells, expected ${String(cols)}`);
    row.forEach((value, c) => {
      view.setFloat32((r * cols + c) * BYTES_PER_CELL, value, true);
    });
  });
  return bytes;
}

export interface DecodedMatrix {
  rows: number;
  cols: number;
  /** `null` when the cell is "sem dado". */
  get: (row: number, col: number) => number | null;
}

export function decodeMatrix(bytes: Uint8Array, rows: number, cols: number): DecodedMatrix {
  const expected = rows * cols * BYTES_PER_CELL;
  if (bytes.byteLength !== expected) {
    throw new Error(`Matrix size mismatch: got ${String(bytes.byteLength)} bytes, expected ${String(expected)} for ${String(rows)}x${String(cols)}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    rows,
    cols,
    get(row, col) {
      const value = view.getFloat32((row * cols + col) * BYTES_PER_CELL, true);
      return Number.isNaN(value) ? null : value;
    },
  };
}
