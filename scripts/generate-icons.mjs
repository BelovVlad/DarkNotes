import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
for (const [file, size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(new URL('../public/' + file, import.meta.url), png);
}
const maskable = new Resvg(svg.toString().replace('rx="112"', 'rx="0"'), { fitTo: { mode: 'width', value: 512 } }).render().asPng();
await writeFile(new URL('../public/icon-maskable.png', import.meta.url), maskable);
