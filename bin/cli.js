#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { Command } = require("commander");
const packageJson = require("../package.json");
const {
  PRESETS,
  detectGhostscript,
  PdfFilesizeReducer
} = require("../lib");

function printErrorAndExit(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function getDefaultOutput(inputPath) {
  const resolvedInput = path.resolve(inputPath);
  return path.join(
    path.dirname(resolvedInput),
    `${path.basename(resolvedInput, path.extname(resolvedInput))}.reduced.pdf`
  );
}

function printGhostscriptInstallInstructions() {
  console.error("Ghostscript is required but was not found in PATH.");
  console.error("Install Ghostscript and try again:");
  console.error("  macOS : brew install ghostscript");
  console.error("  Ubuntu: sudo apt install ghostscript");
  console.error("  Windows: https://www.ghostscript.com/download/gsdnld.html");
}

const program = new Command();

program
  .name("pdf-fs-reducer")
  .description("Reduce PDF file size by downsampling images with Ghostscript.")
  .version(packageJson.version)
  .argument("<input>", "Input PDF path")
  .option(
    "-o, --output <path>",
    "Output PDF path (default: <input-basename>.reduced.pdf in same directory)"
  )
  .option("-p, --preset <name>", "Quality preset (screen, ebook, printer, prepress)", "ebook")
  .option("-d, --dpi <number>", "Custom DPI, overrides --preset")
  .option(
    "-s, --size <percent>",
    "Reduce quality by percentage (example: --size=30 reduces quality by 30%)"
  )
  .option("-c, --compatibility <ver>", "PDF compatibility level", "1.4")
  .showHelpAfterError()
  .addHelpText(
    "after",
    `
Examples:
  npx pdf-fs-reducer input.pdf
  npx pdf-fs-reducer input.pdf -o output.pdf
  npx pdf-fs-reducer input.pdf --preset screen
  npx pdf-fs-reducer input.pdf --dpi 120
  npx pdf-fs-reducer input.pdf --size 30
  npx pdf-fs-reducer input.pdf -p printer -o high-quality.pdf

Presets:
  screen   -> 72 DPI  (smallest, for on-screen viewing)
  ebook    -> 150 DPI (default, good balance)
  printer  -> 300 DPI (high quality printing)
  prepress -> 300 DPI (maximum quality, publishing)

Quality reduction:
  --size 30 means quality is reduced by 30% from the selected base DPI.
  Base DPI comes from --dpi if provided, otherwise from --preset.

Requires Ghostscript installed:
  macOS:   brew install ghostscript
  Ubuntu:  sudo apt install ghostscript
  Windows: https://www.ghostscript.com/download/gsdnld.html
`
  );

program.action(async (input, options) => {
  const inputPath = path.resolve(input);
  const outputPath = options.output
    ? path.resolve(options.output)
    : getDefaultOutput(inputPath);

  if (!fs.existsSync(inputPath)) {
    printErrorAndExit(`Input file does not exist: ${inputPath}`);
  }

  if (path.extname(inputPath).toLowerCase() !== ".pdf") {
    printErrorAndExit("Input file must have a .pdf extension.");
  }

  let parsedDpi;
  if (options.dpi !== undefined) {
    parsedDpi = Number(options.dpi);
    if (!Number.isInteger(parsedDpi) || parsedDpi < 1 || parsedDpi > 1200) {
      printErrorAndExit("Option --dpi must be an integer between 1 and 1200.");
    }
  }

  let parsedSize;
  if (options.size !== undefined) {
    parsedSize = Number(options.size);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0 || parsedSize >= 100) {
      printErrorAndExit("Option --size must be a number greater than 0 and less than 100.");
    }
  }

  const preset = String(options.preset || "ebook");
  if (options.dpi === undefined && !PRESETS[preset]) {
    printErrorAndExit(
      `Invalid preset "${preset}". Valid presets: ${Object.keys(PRESETS).join(", ")}`
    );
  }

  try {
    detectGhostscript();
  } catch (error) {
    if (error && error.type === "GS_NOT_FOUND") {
      printGhostscriptInstallInstructions();
      process.exit(1);
    }
    throw error;
  }

  try {
    await PdfFilesizeReducer.reduce({
      input: inputPath,
      output: outputPath,
      preset,
      dpi: parsedDpi,
      size: parsedSize,
      compatibility: options.compatibility,
      showProgress: true
    });
  } catch (error) {
    printErrorAndExit(error.message || "Unknown error.");
  }
});

program.parse(process.argv);
