import { validatePhoto } from "../model/validation.js";

const DECODE_TIMEOUT = 15000;

const PHOTO_SCAN_BYTES = 512 * 1024;

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const B64_VALUES = (function(){
  const t = new Int8Array(128).fill(-1);
  for(let i = 0; i < 64; i++) t[B64_ALPHABET.charCodeAt(i)] = i;
  return t;
})();

function photoBytes(src){
  const url = validatePhoto(src);
  if(!url) return null;
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if(!m) return null;
  const payload = m[2];
  if(payload.length % 4 !== 0) return null;

  const want = Math.min(PHOTO_SCAN_BYTES, (payload.length / 4) * 3);
  const bytes = new Uint8Array(want);
  let at = 0, acc = 0, bits = 0;
  for(let i = 0; i < payload.length && at < want; i++){
    const code = payload.charCodeAt(i);
    if(code === 61) break;
    const v = code < 128 ? B64_VALUES[code] : -1;
    if(v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if(bits >= 8){
      bits -= 8;
      bytes[at++] = (acc >> bits) & 255;
    }
  }
  return {mime: m[1], bytes: at === bytes.length ? bytes : bytes.subarray(0, at)};
}

function be32(b, at){
  return (b[at] * 16777216) + (b[at+1] << 16) + (b[at+2] << 8) + b[at+3];
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

function pngHeaderSize(b){
  if(b.length < 8 + 4 + 4 + 13) return null;
  for(let i = 0; i < 8; i++) if(b[i] !== PNG_SIGNATURE[i]) return null;

  if(b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) return null;

  if(be32(b, 8) !== 13) return null;
  const w = be32(b, 16), h = be32(b, 20);
  if(!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return {w:w, h:h};
}

function isSofMarker(m){
  return m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC;
}

const JPEG_MAX_SEGMENTS = 512;

function jpegHeaderSize(b){
  if(b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
  let at = 2;
  for(let seen = 0; seen < JPEG_MAX_SEGMENTS; seen++){

    while(at + 1 < b.length && b[at] === 0xFF && b[at+1] === 0xFF) at++;
    if(at + 1 >= b.length) return null;
    if(b[at] !== 0xFF) return null;
    const marker = b[at+1];

    if(marker === 0x01 || marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7)){ at += 2; continue; }

    if(marker === 0xD9 || marker === 0xDA) return null;
    if(at + 3 >= b.length) return null;
    const len = (b[at+2] << 8) | b[at+3];
    if(len < 2) return null;
    if(at + 2 + len > b.length) return null;
    if(isSofMarker(marker)){
      if(len < 8) return null;
      const h = (b[at+5] << 8) | b[at+6];
      const w = (b[at+7] << 8) | b[at+8];
      if(w <= 0 || h <= 0) return null;
      return {w:w, h:h};
    }
    at += 2 + len;
  }
  return null;
}

function photoHeader(src){
  const got = photoBytes(src);
  if(!got) return null;
  return got.mime === "png" ? pngHeaderSize(got.bytes) : jpegHeaderSize(got.bytes);
}

export { DECODE_TIMEOUT, PHOTO_SCAN_BYTES, B64_ALPHABET, B64_VALUES, photoBytes, be32, PNG_SIGNATURE, pngHeaderSize, isSofMarker, JPEG_MAX_SEGMENTS, jpegHeaderSize, photoHeader };
