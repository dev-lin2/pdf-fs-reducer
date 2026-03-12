# pdf-fs-reducer

Reduce PDF file size by downsampling embedded images through Ghostscript.

[![npm version](https://img.shields.io/npm/v/pdf-fs-reducer)](https://www.npmjs.com/package/pdf-fs-reducer)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Prerequisites

Ghostscript must be installed and available in your system `PATH`.

| Platform | Install command / link |
| --- | --- |
| macOS | `brew install ghostscript` |
| Ubuntu / Debian | `sudo apt install ghostscript` |
| Windows | https://www.ghostscript.com/download/gsdnld.html |

## Usage

```bash
npx pdf-fs-reducer <input.pdf> [options]
```

## Examples

```bash
# default mode (ebook preset)
npx pdf-fs-reducer report.pdf

# custom output file path
npx pdf-fs-reducer report.pdf -o report.reduced.pdf

# smallest output for screen viewing
npx pdf-fs-reducer report.pdf --preset screen

# force custom image DPI (overrides preset)
npx pdf-fs-reducer report.pdf --dpi 120

# high quality print-oriented output
npx pdf-fs-reducer report.pdf -p printer -o report.print.pdf
```

## Options

| Flag | Description | Default |
| --- | --- | --- |
| `<input>` | Input PDF path (required positional argument) | n/a |
| `-o, --output <path>` | Output PDF path | `<input-basename>.reduced.pdf` in same directory |
| `-p, --preset <name>` | Quality preset (`screen`, `ebook`, `printer`, `prepress`) | `ebook` |
| `-d, --dpi <number>` | Custom DPI, overrides `--preset` | n/a |
| `-c, --compatibility <ver>` | PDF compatibility level | `1.4` |
| `-V, --version` | Show version | n/a |
| `-h, --help` | Show help | n/a |

## Presets

| Preset | DPI | Best use |
| --- | --- | --- |
| `screen` | 72 | smallest size, on-screen viewing |
| `ebook` | 150 | balanced quality and file size |
| `printer` | 300 | high-quality printing |
| `prepress` | 300+ | maximum quality for publishing |

## Programmatic API

Install:

```bash
npm install pdf-fs-reducer
```

Use in Node.js:

```js
const { PdfFilesizeReducer } = require("pdf-fs-reducer");

async function run() {
  const result = await PdfFilesizeReducer.reduce({
    input: "./input.pdf",
    output: "./output.pdf",
    preset: "ebook",
    compatibility: "1.4"
  });

  console.log(result);
}

run().catch(console.error);
```

Return value:

```js
{
  inputPath: "absolute-input-path",
  outputPath: "absolute-output-path",
  inputSize: 123456,
  outputSize: 98765,
  saved: 24691,
  percent: 19.99
}
```

## Sample output

```text
pdf-fs-reducer
------------------------------------------------------------
Input : C:\docs\report.pdf (8.91 MB)
Output: C:\docs\report.reduced.pdf
Mode  : eBook (150 DPI) - balanced quality and size
Engine: gswin64c
------------------------------------------------------------
- Processing PDF (3s)
Completed.
Original: 8.91 MB
Reduced : 3.72 MB
Saved   : 5.19 MB (58.2% reduction)
Saved to: C:\docs\report.reduced.pdf
```

## How It Works

`pdf-fs-reducer` calls Ghostscript (`pdfwrite`) to rebuild the PDF with lower image resolution.  
In custom DPI mode, images are downsampled with bicubic interpolation.  
Text and vector drawing instructions are preserved, so reductions mainly come from image-heavy pages.

## License

MIT
