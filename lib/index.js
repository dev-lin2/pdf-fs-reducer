const {
  PRESETS,
  formatBytes,
  detectGhostscript,
  reducePDF
} = require("./reducer");

class PdfFilesizeReducer {
  static reduce(options) {
    return reducePDF(options);
  }

  static getPresets() {
    return { ...PRESETS };
  }

  static detectGhostscript() {
    return detectGhostscript();
  }
}

module.exports = PdfFilesizeReducer;
module.exports.PdfFilesizeReducer = PdfFilesizeReducer;
module.exports.PRESETS = PRESETS;
module.exports.formatBytes = formatBytes;
module.exports.detectGhostscript = detectGhostscript;
module.exports.reduce = reducePDF;
module.exports.reducePDF = reducePDF;
