// Inlines the IIFE bundle into demo/page.html -> demo/index.html (standalone), plus an optional fragment copy.
import { readFileSync, writeFileSync } from 'node:fs';
const lib = readFileSync(new URL('../dist/impressio.global.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('./page.html', import.meta.url), 'utf8').replace('/*__LIB__*/', () => lib);
writeFileSync(
  new URL('./index.html', import.meta.url),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>\n${page}</body></html>`,
);
if (process.argv[2]) writeFileSync(process.argv[2], page);
