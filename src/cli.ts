#!/usr/bin/env node

import { program } from "commander"
import { Options, start } from ".";


program.version('0.1.0')

program
  .option('-s, --swagger <version>', 'swagger version')
  .option('-u, --url <path>', 'swagger url')
  .option('-o, --outdir <path>', 'outDir');

program.parse(process.argv);

const opts = program.opts();

const options: Options = {
  version: 'v2',
  outdir: 'src'
}

if (opts.swagger) {
  options.version = opts.swagger
}
if (opts.url) {
  options.url = opts.url
}
if (opts.outdir) {
  options.outdir = opts.outdir
}
console.log(options);

start(options)


