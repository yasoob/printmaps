const ROUND_CONSTANTS = Uint32Array.from(
  '428a2f98 71374491 b5c0fbcf e9b5dba5 3956c25b 59f111f1 923f82a4 ab1c5ed5 d807aa98 12835b01 243185be 550c7dc3 72be5d74 80deb1fe 9bdc06a7 c19bf174 e49b69c1 efbe4786 0fc19dc6 240ca1cc 2de92c6f 4a7484aa 5cb0a9dc 76f988da 983e5152 a831c66d b00327c8 bf597fc7 c6e00bf3 d5a79147 06ca6351 14292967 27b70a85 2e1b2138 4d2c6dfc 53380d13 650a7354 766a0abb 81c2c92e 92722c85 a2bfe8a1 a81a664b c24b8b70 c76c51a3 d192e819 d6990624 f40e3585 106aa070 19a4c116 1e376c08 2748774c 34b0bcb5 391c0cb3 4ed8aa4a 5b9cca4f 682e6ff3 748f82ee 78a5636f 84c87814 8cc70208 90befffa a4506ceb bef9a3f7 c67178f2'
    .split(' '),
  (hexadecimal) => Number.parseInt(hexadecimal, 16),
);
const INITIAL_HASH = '6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19'
  .split(' ')
  .map((hexadecimal) => Number.parseInt(hexadecimal, 16));

const rotateRight = (value: number, places: number) => ((value >>> places) | (value << (32 - places))) >>> 0;

function paddedMessage(bytes: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLength = BigInt(bytes.length) * 8n;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Number(bitLength >> 32n), false);
  view.setUint32(paddedLength - 4, Number(BigInt.asUintN(32, bitLength)), false);
  return padded;
}

function extendWords(view: DataView, offset: number): Uint32Array {
  const words = new Uint32Array(64);
  for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
  for (let index = 16; index < 64; index += 1) {
    const before15 = words[index - 15];
    const before2 = words[index - 2];
    const sigma0 = rotateRight(before15, 7) ^ rotateRight(before15, 18) ^ (before15 >>> 3);
    const sigma1 = rotateRight(before2, 17) ^ rotateRight(before2, 19) ^ (before2 >>> 10);
    words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
  }
  return words;
}

function compress(hash: Uint32Array, words: Uint32Array): void {
  let [a, b, c, d, e, f, g, h] = hash;
  for (let index = 0; index < 64; index += 1) {
    const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
    const choice = (e & f) ^ (~e & g);
    const temporary1 = (h + sum1 + choice + ROUND_CONSTANTS[index] + words[index]) >>> 0;
    const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
    const majority = (a & b) ^ (a & c) ^ (b & c);
    const temporary2 = (sum0 + majority) >>> 0;
    h = g;
    g = f;
    f = e;
    e = (d + temporary1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temporary1 + temporary2) >>> 0;
  }
  const compressed = [a, b, c, d, e, f, g, h];
  for (let index = 0; index < hash.length; index += 1) hash[index] = (hash[index] + compressed[index]) >>> 0;
}

export function sha256Hex(bytes: Uint8Array): string {
  const padded = paddedMessage(bytes);
  const view = new DataView(padded.buffer);
  const hash = new Uint32Array(INITIAL_HASH);
  for (let offset = 0; offset < padded.length; offset += 64) compress(hash, extendWords(view, offset));
  return [...hash].map((value) => value.toString(16).padStart(8, '0')).join('');
}
