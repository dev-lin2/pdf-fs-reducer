declare class PdfFsReducer {
  static reduce(options: PdfFsReducer.ReducePdfOptions): Promise<PdfFsReducer.ReducePdfResult>;
  static getPresets(): PdfFsReducer.Presets;
  static detectGhostscript(): string;
}

declare namespace PdfFsReducer {
  type PresetName = "screen" | "ebook" | "printer" | "prepress";

  interface PresetDefinition {
    dpi: number;
    label: string;
  }

  type Presets = Record<PresetName, PresetDefinition>;

  interface ReducePdfOptions {
    input: string;
    output?: string;
    preset?: PresetName;
    dpi?: number;
    size?: number;
    compatibility?: string | number;
    showProgress?: boolean;
  }

  interface ReducePdfResult {
    inputPath: string;
    outputPath: string;
    inputSize: number;
    outputSize: number;
    saved: number;
    percent: number;
    effectiveDpi: number | null;
    qualityReduction: number | null;
  }

  interface GhostscriptNotFoundError extends Error {
    type: "GS_NOT_FOUND";
    candidates: string[];
  }

  interface GhostscriptFailedError extends Error {
    type: "GS_FAILED";
    exitCode: number | null;
    stderr: string;
    stdout: string;
  }

  const PdfFilesizeReducer: typeof PdfFsReducer;
  const PRESETS: Presets;

  function formatBytes(bytes: number): string;
  function reducePDF(options: ReducePdfOptions): Promise<ReducePdfResult>;
}

export = PdfFsReducer;
