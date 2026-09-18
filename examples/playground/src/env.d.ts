/// <reference types="vite/client" />

// `vite/client` declares `*.css`, but zero exposes its base stylesheet through
// an extensionless export subpath, which that glob cannot match.
declare module '@sigx/zero/css';
