declare module 'node:fs' {
  export function readFileSync(path: string | URL): Uint8Array;
}

declare module 'node:zlib' {
  export function inflateSync(buf: Uint8Array): Uint8Array;
}
