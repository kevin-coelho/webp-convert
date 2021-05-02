#!/usr/bin/env node

const { program } = require('commander');
const prompts = require('prompts');
const omelette = require('omelette');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const webp = require('webp-converter');
webp.grant_permission();

function handleAutoComplete() {
  const completion = omelette(`convert-webp <file>`);

  completion.on('file', ({ before, reply }) => {
    const { debug } = program.opts();
    if (debug) console.log('Autocomplete', {
      before,
      dir: path.resolve(path.join(process.cwd(), before)),
    });
    if (before.startsWith('.'))
      reply(fs.readdirSync(path.resolve(path.join(process.cwd(), before))));
    else reply(fs.readdirSync(path.resolve(before)));
  });

  completion.init();

  // If you want to have a setup feature, you can use `omeletteInstance.setupShellInitFile()` function.
  if (~process.argv.indexOf('--setup')) {
    completion.setupShellInitFile();
    console.log(chalk.green('convert-webp autocomplete setup complete!'));
  }

  // Similarly, if you want to tear down autocompletion, use `omeletteInstance.cleanupShellInitFile()`
  if (~process.argv.indexOf('--cleanup')) {
    completion.cleanupShellInitFile();
    console.log(chalk.green('convert-webp autocomplete cleanup complete!'));
  }
}

async function convertToWebp(file, out) {
  const { q, z, lossless, verbose, debug } = program.opts();
  if (debug) console.log('Convert to webp', {
    file,
    out
  });
  const options = { q, z, lossless };
  const option = Object.keys(options)
    .filter((k) => options[k] !== null && typeof options[k] !== 'undefined')
    .map((k) => `-${k} ${options[k]}`)
    .join(' ');
  await webp.cwebp(file, out, option, verbose ? '-v' : undefined);
}

async function convertFromWebp(file, ext, out) {
  const { verbose, debug } = program.opts();
  if (debug) console.log('Convert from webp', {
    file,
    ext,
    out
  });
  await webp.dwebp(file, out, '-o', verbose ? '-v' : undefined);
}

function generateOutfile(file, out, isWebp, ext) {
  const { debug } = program.opts();
  if (debug) console.log('Generate outfile', {
    file,
    out,
    isWebp,
    ext,
  });
  const _file = file.replace(/\.[^/.]+$/, '');
  if (!out) {
    out = isWebp ? `${_file}.${ext}` : `${_file}.webp`;
    try {
      fs.statSync(out);
      return `${out.replace(/\.[^/.]+$/, '')} (copy)${path.extname(out)}`;
    } catch (err) {
      return out;
    }
  }
  if (path.extname(out)) {
    return out;
  }
  return isWebp ? `${out}.${ext}` : `${out}.webp`;
}

async function handleFile(file) {
  const { debug } = program.opts();
  if (debug) console.log('handleFile', {
    file
  });
  try {
    file = path.resolve(file);
    fs.statSync(file);
    const isWebp = path.extname(file).toLowerCase() === '.webp';
    const { out: _out, ext: _ext } = program.opts();
    if (isWebp) {
      let ext;
      if (!_ext) {
        const response = await prompts(
          {
            type: 'select',
            name: 'ext',
            message: 'Choose an extension',
            choices: ['png', 'jpg', 'gif', 'tiff'].map((value) => ({
              title: value,
              value,
            })),
            initial: 0,
          },
          {
            onCancel: () => exitProgram(),
          },
        );
        ext = response.ext;
      }
      return convertFromWebp(
        file,
        ext,
        generateOutfile(file, _out, isWebp, ext),
      );
    }
    await convertToWebp(file, generateOutfile(file, _out, isWebp, _ext));
  } catch (err) {
    if (err.message.includes('ENOENT')) {
      console.error(chalk.yellow(`File ${file} not found`));
      exitProgram();
    }
    console.error(err);
    exitProgram(err);
  }
  exitProgram();
}

function exitProgram(errFlag = false) {
  if (errFlag) {
    console.warn('Exiting with error...');
    process.exit(1);
  }
  process.exit(0);
}

handleAutoComplete();
program.version('0.0.1');
program
  .name('convert-webp')
  .usage('[flags] file')
  .option('--setup', 'Set up this command line tool for autocompletion')
  .option('--cleanup', 'Undo autocompletion setups (remove files from ~)')
  .option('--debug', 'Print debug messages')
  .option('-v, --verbose', 'Output logging from conversion')
  .option('-O, --out', 'Output file name. Specify without file extension')
  .option(
    '-E, --ext',
    'Specify a file extension for the output. Otherwise, you will be prompted to select this',
  )
  .option('-q <factor>', 'Compression factor (0-100) for compression to webp')
  .option('--lossless', 'Use lossless conversion to webp')
  .option('-z <level>', 'Use lossless compression mode with level (0-9)')
  .arguments('<file>')
  .description(
    'Convert an image from or to webp format. This program will guess which you mean based on the file extension of provided argument.' +
      'For more information on compression flags for conversion to webp, see https://developers.google.com/speed/webp/docs/cwebp',
    {
      file: 'Image file to convert',
    },
  )
  .action(handleFile)
  .allowExcessArguments(false);

async function main() {
  await program.parseAsync(process.argv);
}

return main();
