import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const file = new URL("../dist/elm-clipboard.iife.js", import.meta.url);
const bytes = gzipSync(readFileSync(file)).length;
const budget = 5 * 1024;
console.log(`elm-clipboard.iife.js: ${bytes} bytes gzipped (budget ${budget})`);
if (bytes > budget) process.exit(1);
