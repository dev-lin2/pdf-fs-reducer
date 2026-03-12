const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const ora = require("ora");
const chalk = require("chalk");

const PRESETS = {
  screen: { dpi: 72, label: "Screen (72 DPI) - smallest file, on-screen use" },
  ebook: { dpi: 150, label: "eBook (150 DPI) - balanced quality and size" },
  printer: { dpi: 300, label: "Printer (300 DPI) - high quality" },
  prepress: { dpi: 300, label: "Prepress (300+ DPI) - maximum quality" }
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getGhostscriptCandidates() {
  if (process.platform === "win32") {
    return ["gswin64c", "gswin32c", "gs"];
  }
  return ["gs"];
}

function detectGhostscript() {
  const candidates = getGhostscriptCandidates();

  for (const command of candidates) {
    const result = spawnSync(command, ["--version"], {
      encoding: "utf8",
      stdio: "pipe"
    });

    if (!result.error && result.status === 0) {
      return command;
    }
  }

  const error = new Error("Ghostscript was not found in PATH.");
  error.type = "GS_NOT_FOUND";
  error.candidates = candidates;
  throw error;
}

function validateOptions({ input, preset, dpi, size, compatibility }) {
  if (!input) {
    throw new Error("Input path is required.");
  }

  const inputAbsolute = path.resolve(input);

  if (!fs.existsSync(inputAbsolute)) {
    throw new Error(`Input file does not exist: ${inputAbsolute}`);
  }

  if (path.extname(inputAbsolute).toLowerCase() !== ".pdf") {
    throw new Error("Input must be a PDF file (.pdf).");
  }

  if (dpi !== undefined && dpi !== null) {
    const value = Number(dpi);
    if (!Number.isInteger(value) || value < 1 || value > 1200) {
      throw new Error("Custom DPI must be an integer between 1 and 1200.");
    }
  } else if (!PRESETS[preset]) {
    throw new Error(
      `Invalid preset "${preset}". Valid presets: ${Object.keys(PRESETS).join(", ")}`
    );
  }

  if (!/^\d+(\.\d+)?$/.test(String(compatibility))) {
    throw new Error("Compatibility must be a valid PDF version, for example 1.4.");
  }

  if (size !== undefined && size !== null) {
    const value = Number(size);
    if (!Number.isFinite(value) || value <= 0 || value >= 100) {
      throw new Error("Size percentage must be a number greater than 0 and less than 100.");
    }
  }
}

function getBaseDpi({ preset, dpi }) {
  if (dpi !== undefined && dpi !== null) {
    return Number(dpi);
  }

  return PRESETS[preset].dpi;
}

function resolveEffectiveDpi({ preset, dpi, size }) {
  if (size === undefined || size === null) {
    return dpi !== undefined && dpi !== null ? Number(dpi) : null;
  }

  const baseDpi = getBaseDpi({ preset, dpi });
  const effectiveDpi = Math.max(1, Math.round((baseDpi * (100 - Number(size))) / 100));
  return effectiveDpi;
}

function resolveModeLabel({ preset, dpi, size, effectiveDpi }) {
  if (size !== undefined && size !== null) {
    const baseDpi = getBaseDpi({ preset, dpi });
    return `Quality -${Number(size)}% (${baseDpi} DPI -> ${effectiveDpi} DPI)`;
  }

  if (dpi !== undefined && dpi !== null) {
    return `Custom DPI (${dpi})`;
  }

  return (PRESETS[preset] && PRESETS[preset].label) || `Preset (${preset})`;
}

function buildGhostscriptArgs({
  inputPath,
  outputPath,
  preset,
  effectiveDpi,
  compatibility
}) {
  const args = [
    "-sDEVICE=pdfwrite",
    `-dCompatibilityLevel=${compatibility}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH"
  ];

  if (effectiveDpi !== undefined && effectiveDpi !== null) {
    args.push(
      "-dDownsampleColorImages=true",
      "-dDownsampleGrayImages=true",
      "-dDownsampleMonoImages=true",
      "-dColorImageDownsampleType=/Bicubic",
      "-dGrayImageDownsampleType=/Bicubic",
      `-dColorImageResolution=${effectiveDpi}`,
      `-dGrayImageResolution=${effectiveDpi}`,
      `-dMonoImageResolution=${effectiveDpi}`
    );
  } else {
    args.push(`-dPDFSETTINGS=/${preset}`);
  }

  args.push(`-sOutputFile=${outputPath}`, inputPath);
  return args;
}

function printRunHeader({ inputPath, inputSize, outputPath, modeLabel, gsCommand }) {
  const line = "-".repeat(60);
  console.log(chalk.cyan("pdf-fs-reducer"));
  console.log(chalk.gray(line));
  console.log(`Input : ${inputPath} (${formatBytes(inputSize)})`);
  console.log(`Output: ${outputPath}`);
  console.log(`Mode  : ${modeLabel}`);
  console.log(`Engine: ${gsCommand}`);
  console.log(chalk.gray(line));
}

function printResult({ inputSize, outputSize, saved, percent, outputPath }) {
  console.log(chalk.green("Completed."));
  console.log(`Original: ${formatBytes(inputSize)}`);
  console.log(`Reduced : ${formatBytes(outputSize)}`);

  if (saved > 0) {
    console.log(`Saved   : ${formatBytes(saved)} (${percent.toFixed(1)}% reduction)`);
  } else {
    console.log("Warning : File size did not decrease. The PDF may already be optimized.");
  }

  console.log(`Saved to: ${outputPath}`);
}

function runGhostscript({
  command,
  args,
  spinnerTextPrefix,
  showProgress
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    let stdout = "";
    let spinner = null;
    const startTime = Date.now();

    if (showProgress) {
      spinner = ora({
        text: `${spinnerTextPrefix} (0s)`,
        color: "cyan"
      }).start();
    }

    const interval = setInterval(() => {
      if (!spinner) return;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      spinner.text = `${spinnerTextPrefix} (${elapsedSeconds}s)`;
    }, 1000);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (!spinner) return;

      const pageMatch = text.match(/Page\s+(\d+)/i);
      if (pageMatch) {
        spinner.text = `${spinnerTextPrefix} (page ${pageMatch[1]})`;
      }
    });

    child.on("error", (error) => {
      clearInterval(interval);
      if (spinner) spinner.fail("Ghostscript failed to start.");
      reject(error);
    });

    child.on("close", (code) => {
      clearInterval(interval);

      if (code === 0) {
        if (spinner) spinner.succeed("Processing finished.");
        resolve({ code, stdout, stderr });
        return;
      }

      if (spinner) spinner.fail("Processing failed.");
      const error = new Error(
        `Ghostscript exited with code ${code}.\n${stderr || stdout || "No output received."}`
      );
      error.type = "GS_FAILED";
      error.exitCode = code;
      error.stderr = stderr;
      error.stdout = stdout;
      reject(error);
    });
  });
}

async function reducePDF({
  input,
  output,
  preset = "ebook",
  dpi,
  size,
  compatibility = "1.4",
  showProgress = true
}) {
  validateOptions({ input, preset, dpi, size, compatibility });

  const inputPath = path.resolve(input);
  const outputPath = output
    ? path.resolve(output)
    : path.join(
        path.dirname(inputPath),
        `${path.basename(inputPath, path.extname(inputPath))}.reduced.pdf`
      );

  if (inputPath === outputPath) {
    throw new Error("Input and output paths must be different files.");
  }

  const gsCommand = detectGhostscript();
  const inputSize = fs.statSync(inputPath).size;
  const effectiveDpi = resolveEffectiveDpi({ preset, dpi, size });
  const modeLabel = resolveModeLabel({ preset, dpi, size, effectiveDpi });

  printRunHeader({
    inputPath,
    inputSize,
    outputPath,
    modeLabel,
    gsCommand
  });

  const args = buildGhostscriptArgs({
    inputPath,
    outputPath,
    preset,
    effectiveDpi,
    compatibility
  });

  await runGhostscript({
    command: gsCommand,
    args,
    spinnerTextPrefix: "Processing PDF",
    showProgress
  });

  const outputSize = fs.statSync(outputPath).size;
  const saved = inputSize - outputSize;
  const percent = saved > 0 ? (saved / inputSize) * 100 : 0;

  const result = {
    inputPath,
    outputPath,
    inputSize,
    outputSize,
    saved,
    percent,
    effectiveDpi,
    qualityReduction: size !== undefined && size !== null ? Number(size) : null
  };

  printResult(result);
  return result;
}

module.exports = {
  PRESETS,
  formatBytes,
  detectGhostscript,
  reducePDF
};
