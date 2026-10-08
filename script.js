/**
 * LOCAL BUSINESS DIGITAL KIT GENERATOR
 * Pure Vanilla JavaScript - 100% Static, Client-Side, Offline Capable
 * GitHub Pages & Mobile-First Compatible
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. PURE JAVASCRIPT QR CODE ENGINE (Zero external dependencies)
     Based on standard QR Code model (ISO/IEC 18004).
     Handles byte mode, error correction, and canvas drawing directly.
     ========================================================================== */
  const QRMath = {
    glog: function (n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function (n) {
      while (n < 0) n += 255;
      while (n >= 256) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };
  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) {
    QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  function QRPolynomial(num, shift) {
    if (num.length === undefined) throw new Error(num.length + "/" + shift);
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  QRPolynomial.prototype = {
    get: function (index) { return this.num[index]; },
    getLength: function () { return this.num.length; },
    multiply: function (e) {
      const num = new Array(this.getLength() + e.getLength() - 1);
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    },
    mod: function (e) {
      if (this.getLength() - e.getLength() < 0) return this;
      const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      const num = new Array(this.getLength());
      for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  function QRRSBlock(totalCount, dataCount) {
    this.totalCount = totalCount;
    this.dataCount = dataCount;
  }
  QRRSBlock.RS_BLOCK_TABLE = [
    // 1-10
    [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
    [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
    [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
    [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
    [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
    [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
    [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
    [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
    [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
    [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]
  ];
  QRRSBlock.getRSBlocks = function (typeNumber, errorCorrectLevel) {
    const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
    if (!rsBlock) throw new Error("bad rs block: " + typeNumber + "/" + errorCorrectLevel);
    const length = rsBlock.length / 3;
    const list = [];
    for (let i = 0; i < length; i++) {
      const count = rsBlock[i * 3 + 0];
      const totalCount = rsBlock[i * 3 + 1];
      const dataCount = rsBlock[i * 3 + 2];
      for (let j = 0; j < count; j++) list.push(new QRRSBlock(totalCount, dataCount));
    }
    return list;
  };
  QRRSBlock.getRsBlockTable = function (typeNumber, errorCorrectLevel) {
    switch (errorCorrectLevel) {
      case 1: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case 0: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case 3: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case 2: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default: return undefined;
    }
  };

  function QRBitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype = {
    get: function (index) {
      const bufIndex = Math.floor(index / 8);
      return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1;
    },
    put: function (num, length) {
      for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    },
    putBit: function (bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  function QRCodeGenerator(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  QRCodeGenerator.prototype = {
    addData: function (data) {
      this.dataList.push(data);
      this.dataCache = null;
    },
    isDark: function (row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) throw new Error(row + "," + col);
      return this.modules[row][col];
    },
    getModuleCount: function () { return this.moduleCount; },
    make: function () {
      if (this.typeNumber < 1) {
        let typeNumber = 1;
        for (; typeNumber < 10; typeNumber++) {
          const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
          const buffer = new QRBitBuffer();
          let totalData = 0;
          for (let i = 0; i < rsBlocks.length; i++) totalData += rsBlocks[i].dataCount;
          for (let i = 0; i < this.dataList.length; i++) {
            const data = this.dataList[i];
            buffer.put(4, 4); // 8-bit byte mode
            buffer.put(data.length, typeNumber < 10 ? 8 : 16);
            for (let j = 0; j < data.length; j++) buffer.put(data.charCodeAt(j), 8);
          }
          if (buffer.length <= totalData * 8) break;
        }
        this.typeNumber = Math.min(typeNumber, 10);
      }
      this.makeImpl(false, this.getBestMaskPattern());
    },
    makeImpl: function (test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (let row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
        for (let col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupTimingPattern();
      this.setupPositionAdjustPattern();
      this.setupTypeInfo(test, maskPattern);
      if (this.typeNumber >= 7) this.setupTypeNumber(test);
      if (this.dataCache === null) this.dataCache = QRCodeGenerator.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
      this.mapData(this.dataCache, maskPattern);
    },
    setupPositionProbePattern: function (row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
              (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
              (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },
    setupTimingPattern: function () {
      for (let r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] !== null) continue;
        this.modules[r][6] = (r % 2 === 0);
      }
      for (let c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] !== null) continue;
        this.modules[6][c] = (c % 2 === 0);
      }
    },
    setupPositionAdjustPattern: function () {
      const pos = QRCodeGenerator.PATTERN_POSITION_TABLE[this.typeNumber - 1];
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i];
          const col = pos[j];
          if (this.modules[row][col] !== null) continue;
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    },
    setupTypeInfo: function (test, maskPattern) {
      const data = (this.errorCorrectLevel << 3) | maskPattern;
      const bits = QRCodeGenerator.getBCHTypeInfo(data);
      for (let i = 0; i < 15; i++) {
        const mod = (!test && ((bits >> i) & 1) === 1);
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;
      }
      for (let i = 0; i < 15; i++) {
        const mod = (!test && ((bits >> i) & 1) === 1);
        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = (!test);
    },
    setupTypeNumber: function (test) {
      const bits = QRCodeGenerator.getBCHTypeNumber(this.typeNumber);
      for (let i = 0; i < 18; i++) {
        const mod = (!test && ((bits >> i) & 1) === 1);
        this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    },
    mapData: function (data, maskPattern) {
      let inc = -1;
      let row = this.moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      for (let col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this.modules[row][col - c] === null) {
              let dark = false;
              if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
              const mask = QRCodeGenerator.getMask(maskPattern, row, col - c);
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    },
    getBestMaskPattern: function () {
      let minLostPoint = 0;
      let pattern = 0;
      for (let i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        const lostPoint = QRCodeGenerator.getLostPoint(this);
        if (i === 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    }
  };

  QRCodeGenerator.PATTERN_POSITION_TABLE = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];
  QRCodeGenerator.G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
  QRCodeGenerator.G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
  QRCodeGenerator.G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

  QRCodeGenerator.getBCHTypeInfo = function (data) {
    let d = data << 10;
    while (QRCodeGenerator.getBCHDigit(d) - QRCodeGenerator.getBCHDigit(QRCodeGenerator.G15) >= 0) {
      d ^= (QRCodeGenerator.G15 << (QRCodeGenerator.getBCHDigit(d) - QRCodeGenerator.getBCHDigit(QRCodeGenerator.G15)));
    }
    return ((data << 10) | d) ^ QRCodeGenerator.G15_MASK;
  };
  QRCodeGenerator.getBCHTypeNumber = function (data) {
    let d = data << 12;
    while (QRCodeGenerator.getBCHDigit(d) - QRCodeGenerator.getBCHDigit(QRCodeGenerator.G18) >= 0) {
      d ^= (QRCodeGenerator.G18 << (QRCodeGenerator.getBCHDigit(d) - QRCodeGenerator.getBCHDigit(QRCodeGenerator.G18)));
    }
    return (data << 12) | d;
  };
  QRCodeGenerator.getBCHDigit = function (data) {
    let digit = 0;
    while (data !== 0) { digit++; data >>>= 1; }
    return digit;
  };
  QRCodeGenerator.getMask = function (maskPattern, i, j) {
    switch (maskPattern) {
      case 0: return (i + j) % 2 === 0;
      case 1: return i % 2 === 0;
      case 2: return j % 3 === 0;
      case 3: return (i + j) % 3 === 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return (i * j) % 2 + (i * j) % 3 === 0;
      case 6: return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
      case 7: return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
      default: throw new Error("bad maskPattern: " + maskPattern);
    }
  };
  QRCodeGenerator.getLostPoint = function (qrCode) {
    const moduleCount = qrCode.getModuleCount();
    let lostPoint = 0;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        let sameCount = 0;
        const dark = qrCode.isDark(row, col);
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || moduleCount <= row + r) continue;
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || moduleCount <= col + c || (r === 0 && c === 0)) continue;
            if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
          }
        }
        if (sameCount > 5) lostPoint += (3 + sameCount - 5);
      }
    }
    return lostPoint;
  };
  QRCodeGenerator.createData = function (typeNumber, errorCorrectLevel, dataList) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
    const buffer = new QRBitBuffer();
    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i];
      buffer.put(4, 4); // 8-bit byte
      buffer.put(data.length, typeNumber < 10 ? 8 : 16);
      for (let j = 0; j < data.length; j++) buffer.put(data.charCodeAt(j), 8);
    }
    let totalDataCount = 0;
    for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
    if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
    while (buffer.length % 8 !== 0) buffer.putBit(false);
    while (true) {
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0xec, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0x11, 8);
    }
    return QRCodeGenerator.createBytes(buffer, rsBlocks);
  };
  QRCodeGenerator.createBytes = function (buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;
    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);
    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (let i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
      offset += dcCount;
      const rsPoly = QRCodeGenerator.getErrorCorrectPolynomial(ecCount);
      const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecdata[r].length; i++) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
      }
    }
    let totalCodeCount = 0;
    for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
    const data = new Array(totalCodeCount);
    let index = 0;
    for (let i = 0; i < maxDcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
    }
    for (let i = 0; i < maxEcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
    }
    return data;
  };
  QRCodeGenerator.getErrorCorrectPolynomial = function (errorCorrectLength) {
    let a = new QRPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i++) {
      a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
    }
    return a;
  };

  /**
   * Helper: Render QR text directly to a canvas element
   */
  function renderQRCodeToCanvas(text, canvas, options = {}) {
    if (!text || !canvas) return;
    const size = options.size || 280;
    const fgColor = options.fgColor || "#0f172a";
    const bgColor = options.bgColor || "#ffffff";
    const padding = options.padding !== undefined ? options.padding : 16;

    try {
      // UTF-8 encode string
      const utf8Text = unescape(encodeURIComponent(text));
      const qr = new QRCodeGenerator(0, 1); // Auto version, M level
      qr.addData(utf8Text);
      qr.make();

      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);

      const moduleCount = qr.getModuleCount();
      const cellSize = (size - padding * 2) / moduleCount;

      ctx.fillStyle = fgColor;
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            const x = Math.round(padding + col * cellSize);
            const y = Math.round(padding + row * cellSize);
            const w = Math.ceil(cellSize);
            const h = Math.ceil(cellSize);
            ctx.fillRect(x, y, w, h);
          }
        }
      }
    } catch (err) {
      console.error("QR Code Generation Error:", err);
    }
  }

  /* ==========================================================================
     2. SVG ICONS REPOSITORY (Crisp, 100% Offline, Zero Layout Shift)
     ========================================================================== */
  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    services: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    photos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    catalogue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h2v2h-2zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z"/></svg>',
    promo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    preview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    saved: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    kit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    duplicate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  };

  function getIcon(name) {
    return ICONS[name] || '';
  }

  /* ==========================================================================
     3. DEMO DATA SEED (Royal Cuts Salon)
     ========================================================================== */
  const DEMO_BUSINESS = {
    id: "royal-cuts-salon",
    name: "Royal Cuts Salon",
    category: "Salon",
    ownerName: "Vikram Sharma",
    phone: "+91 98765 43210",
    whatsapp: "+91 98765 43210",
    email: "contact@royalcutssalon.com",
    address: "Shop 12, Crystal Plaza, Linking Road, Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    openingHours: "09:00 AM - 09:00 PM",
    workingDays: "Tue - Sun (Monday Closed)",
    description: "Premium unisex salon and luxury grooming studio. We offer top-tier haircuts, styling, beard grooming, organic facials, and relaxing hair spa treatments by certified styling masters.",
    tagline: "Look Royal. Feel Confident.",
    mapsUrl: "https://maps.google.com/?q=Royal+Cuts+Salon+Bandra+Mumbai",
    gbpUrl: "https://search.google.com/local/writereview?placeid=royalcutssalon",
    instagram: "https://instagram.com/royalcutssalon",
    facebook: "https://facebook.com/royalcutssalon",
    youtube: "",
    website: "https://royalcutssalon.com",
    currency: "₹",
    status: "completed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Clean SVG Data URI Logo & Banner for instant offline display
    logo: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='24' fill='%236366f1'/><path d='M30 70 L50 30 L70 70 Z' fill='none' stroke='%23ffffff' stroke-width='8' stroke-linejoin='round'/><circle cx='50' cy='52' r='8' fill='%23fbbf24'/></svg>",
    coverPhoto: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%231e1b4b'/><stop offset='100%25' stop-color='%234338ca'/></linearGradient></defs><rect width='800' height='300' fill='url(%23g)'/><circle cx='100' cy='80' r='140' fill='%236366f1' opacity='0.25'/><circle cx='700' cy='220' r='180' fill='%238b5cf6' opacity='0.25'/><text x='400' y='160' fill='%23ffffff' font-family='sans-serif' font-size='32' font-weight='bold' text-anchor='middle'>ROYAL CUTS SALON</text></svg>",
    galleryPhotos: [],
    customCategories: ["Hair", "Beard", "Facial", "Spa", "Packages"],
    services: [
      {
        id: "srv-1",
        name: "Haircut (Classic & Styling)",
        description: "Precision haircut tailored to your face shape, followed by hair wash, blow dry and styling.",
        price: 199,
        oldPrice: 249,
        category: "Hair",
        image: ""
      },
      {
        id: "srv-2",
        name: "Beard Trim & Shape",
        description: "Custom beard shaping, hot towel treatment and luxury organic beard oil massage.",
        price: 99,
        oldPrice: 129,
        category: "Beard",
        image: ""
      },
      {
        id: "srv-3",
        name: "Hair + Beard Combo",
        description: "Complete grooming package including designer haircut, hair wash, and sharp beard shaping.",
        price: 249,
        oldPrice: 329,
        category: "Packages",
        image: ""
      },
      {
        id: "srv-4",
        name: "Hair Spa Nourishing Treatment",
        description: "Deep conditioning steam spa with keratin treatment to repair dry hair and prevent dandruff.",
        price: 499,
        oldPrice: 699,
        category: "Spa",
        image: ""
      },
      {
        id: "srv-5",
        name: "Charcoal Detox Facial",
        description: "Deep pore cleansing, exfoliation scrub, activated charcoal mask and refreshing steam.",
        price: 399,
        oldPrice: 499,
        category: "Facial",
        image: ""
      }
    ]
  };

  /* ==========================================================================
     4. APPLICATION STATE & PERSISTENCE
     ========================================================================== */
  const STORAGE_KEY = "localbiz_digital_kits_v1";

  const AppState = {
    businesses: [],
    currentBusinessId: null,
    activeView: "dashboard",
    formStep: 1,
    previewTab: "home",
    serviceCategoryFilter: "All",
    qrSettings: {
      target: "whatsapp",
      customUrl: "",
      fgColor: "#0f172a",
      bgColor: "#ffffff"
    },
    promoSettings: {
      template: "SPECIAL OFFER",
      ratio: "1:1",
      theme: "dark-gold",
      serviceId: "",
      customHeadline: "SPECIAL OFFER",
      customPrice: "Starting @ ₹199",
      customCta: "Book Your Slot Now"
    }
  };

  // Safe localStorage helper
  function loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          AppState.businesses = parsed;
          AppState.currentBusinessId = parsed[0].id;
          return;
        }
      }
    } catch (e) {
      console.warn("Storage load error:", e);
    }
    // Seed with Demo Business if empty
    AppState.businesses = [JSON.parse(JSON.stringify(DEMO_BUSINESS))];
    AppState.currentBusinessId = DEMO_BUSINESS.id;
    saveToStorage();
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState.businesses));
      updateStorageStatusIndicator();
    } catch (e) {
      console.error("Local storage error:", e);
      showToast("Storage quota warning: please use smaller photos.", "error");
    }
  }

  function getCurrentBusiness() {
    return AppState.businesses.find(b => b.id === AppState.currentBusinessId) || AppState.businesses[0] || null;
  }

  /* ==========================================================================
     5. IMAGE RESIZER / DOWNSCALER (Prevents LocalStorage 5MB quota exhaustion)
     ========================================================================== */
  function compressImage(file, maxDimension = 800, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ==========================================================================
     6. TOAST NOTIFICATIONS & CONFIRMATION MODALS
     ========================================================================== */
  function showToast(message, type = "info") {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = type === 'success' ? getIcon('check') : (type === 'error' ? getIcon('close') : getIcon('help'));
    toast.innerHTML = `<span style="display:flex;width:18px;height:18px;">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  let modalConfirmCallback = null;
  function showConfirmModal(title, message, confirmBtnText, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    confirmBtn.textContent = confirmBtnText || 'Confirm';
    modalConfirmCallback = onConfirm;
    modal.classList.add('open');
  }

  function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.remove('open');
    modalConfirmCallback = null;
  }

  /* ==========================================================================
     7. NAVIGATION & VIEW SWITCHER
     ========================================================================== */
  function switchView(viewName) {
    AppState.activeView = viewName;

    // Update active state in sidebar
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update active state in mobile bottom nav
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Close mobile drawer if open
    document.getElementById('sidebar')?.classList.remove('mobile-open');

    // Render active view content
    renderActiveView();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderActiveView() {
    const container = document.getElementById('view-content');
    if (!container) return;

    const b = getCurrentBusiness();
    if (!b && AppState.activeView !== 'new-business') {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:3rem 1.5rem;">
          <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:0.75rem;">No Business Selected</h2>
          <p style="color:var(--text-secondary);margin-bottom:1.5rem;">Create a new business or load the demo business to get started.</p>
          <button class="btn btn-primary" onclick="window.App.startNewBusiness()">+ Create New Business</button>
        </div>
      `;
      return;
    }

    switch (AppState.activeView) {
      case 'dashboard':
        renderDashboardView(container);
        break;
      case 'business-form':
        renderBusinessFormView(container);
        break;
      case 'services':
        renderServicesView(container);
        break;
      case 'photos':
        renderPhotosView(container);
        break;
      case 'card':
        renderCardView(container);
        break;
      case 'catalogue':
        renderCatalogueView(container);
        break;
      case 'qr':
        renderQRView(container);
        break;
      case 'promo':
        renderPromoView(container);
        break;
      case 'kit':
        renderKitView(container);
        break;
      case 'preview':
        renderPhonePreviewView(container);
        break;
      case 'saved':
        renderSavedBusinessesView(container);
        break;
      case 'export':
        renderExportView(container);
        break;
      case 'guide':
        renderGuideView(container);
        break;
      default:
        renderDashboardView(container);
    }

    // Refresh business switcher in sidebar
    updateBusinessSwitcher();
  }

  /* ==========================================================================
     8. VIEW RENDERERS
     ========================================================================== */

  // 8.1 DASHBOARD VIEW
  function renderDashboardView(container) {
    const total = AppState.businesses.length;
    const completed = AppState.businesses.filter(b => b.status === 'completed').length;
    const drafts = total - completed;
    const current = getCurrentBusiness();

    let businessesCardsHtml = '';
    AppState.businesses.forEach(biz => {
      const isCurr = biz.id === AppState.currentBusinessId;
      const srvCount = biz.services?.length || 0;
      const logoHtml = biz.logo ? `<img src="${biz.logo}" alt="Logo" class="business-card-logo">` : `<div class="business-card-logo">${biz.name.charAt(0)}</div>`;

      businessesCardsHtml += `
        <div class="business-card ${isCurr ? 'active-border' : ''}">
          <div class="business-card-header">
            ${logoHtml}
            <div class="business-card-info">
              <h3>${biz.name}</h3>
              <span class="business-badge ${biz.status === 'completed' ? 'badge-success' : 'badge-draft'}">
                ${biz.category || 'General'} • ${biz.status === 'completed' ? 'Kit Ready' : 'Draft'}
              </span>
            </div>
          </div>
          <div class="business-card-meta">
            <div class="business-card-meta-item">
              <span style="display:flex;width:15px;height:15px;">${getIcon('map')}</span>
              <span>${biz.city ? `${biz.city}, ${biz.state || ''}` : 'Location not set'}</span>
            </div>
            <div class="business-card-meta-item">
              <span style="display:flex;width:15px;height:15px;">${getIcon('services')}</span>
              <span>${srvCount} Services / Products added</span>
            </div>
          </div>
          <div class="business-card-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.App.selectAndEdit('${biz.id}')">
              ${getIcon('edit')} Edit
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.App.selectAndPreview('${biz.id}')">
              ${getIcon('preview')} Preview
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.App.selectAndKit('${biz.id}')">
              ${getIcon('kit')} Kit
            </button>
            <button class="btn btn-outline btn-sm" title="Duplicate" onclick="window.App.duplicateBusiness('${biz.id}')">
              ${getIcon('duplicate')}
            </button>
            <button class="btn btn-danger btn-sm" title="Delete" onclick="window.App.confirmDeleteBusiness('${biz.id}')">
              ${getIcon('trash')}
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('dashboard')} Local Business Dashboard</h1>
            <p class="view-subtitle">Generate complete marketing & digital kits for salons, restaurants, shops & clinics.</p>
          </div>
          <div style="display:flex;gap:0.65rem;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="window.App.startNewBusiness()">
              ${getIcon('plus')} + Create New Business
            </button>
            <button class="btn btn-secondary" onclick="window.App.loadDemoAgain()">
              Load Demo Salon
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(99,102,241,0.15);color:#818cf8;">${getIcon('dashboard')}</div>
          <div>
            <div class="stat-val">${total}</div>
            <div class="stat-title">Total Businesses</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,185,129,0.15);color:#34d399;">${getIcon('check')}</div>
          <div>
            <div class="stat-val">${completed}</div>
            <div class="stat-title">Completed Kits</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24;">${getIcon('edit')}</div>
          <div>
            <div class="stat-val">${drafts}</div>
            <div class="stat-title">In Progress / Drafts</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(139,92,246,0.15);color:#c084fc;">${getIcon('kit')}</div>
          <div>
            <div class="stat-val">${total * 6}</div>
            <div class="stat-title">Digital Assets Ready</div>
          </div>
        </div>
      </div>

      ${current ? `
      <!-- Currently Active Business Highlight Card -->
      <div class="card" style="margin-bottom:1.75rem;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(15,23,42,0.95));border:1px solid rgba(99,102,241,0.35);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
          <div style="display:flex;align-items:center;gap:1rem;">
            ${current.logo ? `<img src="${current.logo}" style="width:58px;height:58px;border-radius:14px;object-fit:cover;border:2px solid #6366f1;">` : `<div style="width:58px;height:58px;border-radius:14px;background:#6366f1;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:bold;color:#fff;">${current.name.charAt(0)}</div>`}
            <div>
              <span style="font-size:0.75rem;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:0.05em;">Currently Selected Business</span>
              <h2 style="font-size:1.35rem;font-weight:800;color:#fff;">${current.name}</h2>
              <p style="font-size:0.85rem;color:var(--text-secondary);">${current.category} • ${current.city || 'No city set'} • ${current.services?.length || 0} services</p>
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="window.App.switchView('card')">${getIcon('card')} Digital Card</button>
            <button class="btn btn-secondary btn-sm" onclick="window.App.switchView('catalogue')">${getIcon('catalogue')} Catalogue</button>
            <button class="btn btn-secondary btn-sm" onclick="window.App.switchView('qr')">${getIcon('qr')} QR Codes</button>
            <button class="btn btn-primary btn-sm" onclick="window.App.switchView('kit')">${getIcon('kit')} Generate Complete Kit</button>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Businesses List Grid -->
      <div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;">
        <h3 style="font-size:1.15rem;font-weight:700;">Saved Businesses (${total})</h3>
        <span style="font-size:0.8rem;color:var(--text-muted);">Saved automatically in browser storage</span>
      </div>
      <div class="business-grid">
        ${businessesCardsHtml}
      </div>
    `;
  }

  // 8.2 BUSINESS DETAILS MULTI-STEP FORM VIEW
  function renderBusinessFormView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    const step = AppState.formStep;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('edit')} Business Details: ${b.name}</h1>
            <p class="view-subtitle">Enter business contact info, operating hours, and location links.</p>
          </div>
          <button class="btn btn-primary" onclick="window.App.saveBusinessForm(false)">
            ${getIcon('check')} Save Changes
          </button>
        </div>
      </div>

      <!-- Stepper Header -->
      <div class="stepper-nav">
        <div class="stepper-item ${step === 1 ? 'active' : (step > 1 ? 'completed' : '')}" onclick="window.App.setFormStep(1)">
          <div class="stepper-bubble">${step > 1 ? '✓' : '1'}</div>
          <span>Basic & Contact Info</span>
        </div>
        <div class="stepper-item ${step === 2 ? 'active' : (step > 2 ? 'completed' : '')}" onclick="window.App.setFormStep(2)">
          <div class="stepper-bubble">${step > 2 ? '✓' : '2'}</div>
          <span>Hours & Bio</span>
        </div>
        <div class="stepper-item ${step === 3 ? 'active' : ''}" onclick="window.App.setFormStep(3)">
          <div class="stepper-bubble">3</div>
          <span>Online & Social Links</span>
        </div>
      </div>

      <form id="business-form" onsubmit="event.preventDefault(); window.App.saveBusinessForm(true);" class="card">
        ${renderFormStepContent(b, step)}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2rem;padding-top:1.25rem;border-top:1px solid var(--border-color);">
          ${step > 1 ? `
            <button type="button" class="btn btn-secondary" onclick="window.App.setFormStep(${step - 1})">← Previous Step</button>
          ` : `<div></div>`}

          <div style="display:flex;gap:0.65rem;">
            <button type="button" class="btn btn-outline" onclick="window.App.saveBusinessForm(false)">Save Draft</button>
            ${step < 3 ? `
              <button type="button" class="btn btn-primary" onclick="window.App.nextFormStep()">Next Step →</button>
            ` : `
              <button type="submit" class="btn btn-success">${getIcon('check')} Finish & Manage Services</button>
            `}
          </div>
        </div>
      </form>
    `;
  }

  function renderFormStepContent(b, step) {
    if (step === 1) {
      return `
        <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:1.25rem;">Step 1: Business Information & Contact</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Business Name <span class="required">*</span></label>
            <input type="text" id="f-name" class="form-input" required value="${escapeHtml(b.name || '')}" placeholder="e.g. Royal Cuts Salon">
          </div>
          <div class="form-group">
            <label class="form-label">Business Category</label>
            <select id="f-category" class="form-select">
              ${['Salon', 'Restaurant', 'Cafe', 'Gym', 'Boutique', 'Shop', 'Coaching', 'Hotel', 'Photographer', 'Repair Services', 'Doctor/Clinic', 'Other'].map(cat => `
                <option value="${cat}" ${b.category === cat ? 'selected' : ''}>${cat}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Owner / Manager Name</label>
            <input type="text" id="f-owner" class="form-input" value="${escapeHtml(b.ownerName || '')}" placeholder="e.g. Vikram Sharma">
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number (Calling)</label>
            <input type="tel" id="f-phone" class="form-input" value="${escapeHtml(b.phone || '')}" placeholder="e.g. +91 98765 43210">
            <span class="form-hint">Used for the "Call Now" button (tel: scheme)</span>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">
              <span>WhatsApp Number</span>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.15rem 0.4rem;font-size:0.72rem;" onclick="document.getElementById('f-whatsapp').value = document.getElementById('f-phone').value;">Same as Phone</button>
            </label>
            <input type="tel" id="f-whatsapp" class="form-input" value="${escapeHtml(b.whatsapp || '')}" placeholder="e.g. +91 98765 43210">
            <span class="form-hint">Used for wa.me direct WhatsApp chat links</span>
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="f-email" class="form-input" value="${escapeHtml(b.email || '')}" placeholder="e.g. contact@business.com">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Street Address / Shop No.</label>
          <input type="text" id="f-address" class="form-input" value="${escapeHtml(b.address || '')}" placeholder="e.g. Shop 12, Crystal Plaza, Linking Road">
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">City</label>
            <input type="text" id="f-city" class="form-input" value="${escapeHtml(b.city || '')}" placeholder="e.g. Mumbai">
          </div>
          <div class="form-group">
            <label class="form-label">State</label>
            <input type="text" id="f-state" class="form-input" value="${escapeHtml(b.state || '')}" placeholder="e.g. Maharashtra">
          </div>
          <div class="form-group">
            <label class="form-label">PIN / Postal Code</label>
            <input type="text" id="f-pincode" class="form-input" value="${escapeHtml(b.pincode || '')}" placeholder="e.g. 400050">
          </div>
        </div>
      `;
    }

    if (step === 2) {
      return `
        <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:1.25rem;">Step 2: Operating Hours & Description</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Opening & Closing Hours</label>
            <input type="text" id="f-hours" class="form-input" value="${escapeHtml(b.openingHours || '')}" placeholder="e.g. 09:00 AM - 09:00 PM">
            <div style="display:flex;gap:0.4rem;margin-top:0.35rem;flex-wrap:wrap;">
              <button type="button" class="btn btn-outline btn-sm" style="font-size:0.72rem;padding:0.15rem 0.45rem;" onclick="document.getElementById('f-hours').value='09:00 AM - 09:00 PM'">9 AM - 9 PM</button>
              <button type="button" class="btn btn-outline btn-sm" style="font-size:0.72rem;padding:0.15rem 0.45rem;" onclick="document.getElementById('f-hours').value='10:00 AM - 08:00 PM'">10 AM - 8 PM</button>
              <button type="button" class="btn btn-outline btn-sm" style="font-size:0.72rem;padding:0.15rem 0.45rem;" onclick="document.getElementById('f-hours').value='Open 24 Hours'">24/7 Open</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Weekly Working Days</label>
            <input type="text" id="f-days" class="form-input" value="${escapeHtml(b.workingDays || '')}" placeholder="e.g. Tue - Sun (Monday Closed)">
            <div style="display:flex;gap:0.4rem;margin-top:0.35rem;flex-wrap:wrap;">
              <button type="button" class="btn btn-outline btn-sm" style="font-size:0.72rem;padding:0.15rem 0.45rem;" onclick="document.getElementById('f-days').value='Mon - Sat (Sunday Closed)'">Mon - Sat</button>
              <button type="button" class="btn btn-outline btn-sm" style="font-size:0.72rem;padding:0.15rem 0.45rem;" onclick="document.getElementById('f-days').value='Open All 7 Days'">All 7 Days</button>
              <button type="button" class="btn btn-outline btn-sm" style="font-size:0.72rem;padding:0.15rem 0.45rem;" onclick="document.getElementById('f-days').value='Tue - Sun (Monday Closed)'">Tue - Sun</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Tagline / Slogan</label>
          <input type="text" id="f-tagline" class="form-input" value="${escapeHtml(b.tagline || '')}" placeholder="e.g. Look Royal. Feel Confident.">
        </div>

        <div class="form-group">
          <label class="form-label">Short Business Description</label>
          <textarea id="f-desc" class="form-textarea" rows="4" placeholder="Briefly describe what makes this business special, years of experience, or main specialties...">${escapeHtml(b.description || '')}</textarea>
          <span class="form-hint">Displayed prominently on the Digital Business Card and Catalogue header.</span>
        </div>
      `;
    }

    if (step === 3) {
      return `
        <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:1.25rem;">Step 3: Online Presence & Direct Links</h3>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1.25rem;">
          These links will be embedded into the Digital Card, QR Codes, and Catalogue buttons. All fields are optional.
        </p>

        <div class="form-group">
          <label class="form-label">Google Maps Link (Get Directions)</label>
          <input type="url" id="f-maps" class="form-input" value="${escapeHtml(b.mapsUrl || '')}" placeholder="https://maps.google.com/?q=Your+Business+Name">
          <span class="form-hint">Paste the share link from Google Maps app so customers can navigate directly.</span>
        </div>

        <div class="form-group">
          <label class="form-label">Google Business Profile / Review Link</label>
          <input type="url" id="f-gbp" class="form-input" value="${escapeHtml(b.gbpUrl || '')}" placeholder="https://search.google.com/local/writereview?placeid=...">
          <span class="form-hint">The direct URL where customers can leave a review. Used for the printable review QR card.</span>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Instagram Profile Link</label>
            <input type="url" id="f-instagram" class="form-input" value="${escapeHtml(b.instagram || '')}" placeholder="https://instagram.com/yourhandle">
          </div>
          <div class="form-group">
            <label class="form-label">Facebook Page Link</label>
            <input type="url" id="f-facebook" class="form-input" value="${escapeHtml(b.facebook || '')}" placeholder="https://facebook.com/yourpage">
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Website Link</label>
            <input type="url" id="f-website" class="form-input" value="${escapeHtml(b.website || '')}" placeholder="https://yourbusiness.com">
          </div>
          <div class="form-group">
            <label class="form-label">YouTube Link</label>
            <input type="url" id="f-youtube" class="form-input" value="${escapeHtml(b.youtube || '')}" placeholder="https://youtube.com/@channel">
          </div>
        </div>
      `;
    }
  }

  // 8.3 SERVICES & PRICING VIEW
  function renderServicesView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    if (!b.services) b.services = [];
    if (!b.customCategories) b.customCategories = ["General"];

    // Unique categories from items + custom categories
    const allCategories = Array.from(new Set([...b.customCategories, ...b.services.map(s => s.category || 'General')])).filter(Boolean);
    const filter = AppState.serviceCategoryFilter;
    const filteredServices = filter === 'All' ? b.services : b.services.filter(s => s.category === filter);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('services')} Services & Pricing</h1>
            <p class="view-subtitle">Manage menu items, prices, discounts, and categories for ${b.name}.</p>
          </div>
          <div style="display:flex;gap:0.65rem;">
            <button class="btn btn-secondary" onclick="window.App.openCustomCategoryModal()">
              + Custom Category
            </button>
            <button class="btn btn-primary" onclick="window.App.openAddServiceModal()">
              ${getIcon('plus')} + Add Service / Product
            </button>
          </div>
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="services-filter-bar">
        <button class="filter-chip ${filter === 'All' ? 'active' : ''}" onclick="window.App.setServiceCategoryFilter('All')">
          All Services (${b.services.length})
        </button>
        ${allCategories.map(cat => {
          const count = b.services.filter(s => s.category === cat).length;
          return `
            <button class="filter-chip ${filter === cat ? 'active' : ''}" onclick="window.App.setServiceCategoryFilter('${escapeHtml(cat)}')">
              ${escapeHtml(cat)} (${count})
            </button>
          `;
        }).join('')}
      </div>

      <!-- Services Grid -->
      ${filteredServices.length === 0 ? `
        <div class="card" style="text-align:center;padding:3rem 1.5rem;">
          <div style="font-size:2.5rem;margin-bottom:0.75rem;">🏷️</div>
          <h3 style="font-size:1.15rem;font-weight:700;">No services found in this category</h3>
          <p style="color:var(--text-secondary);margin:0.5rem 0 1.25rem;">Add services to populate the Digital Catalogue and Business Card.</p>
          <button class="btn btn-primary" onclick="window.App.openAddServiceModal()">+ Add New Service</button>
        </div>
      ` : `
        <div class="service-grid">
          ${filteredServices.map(srv => {
            const hasOldPrice = srv.oldPrice && Number(srv.oldPrice) > Number(srv.price);
            const discount = hasOldPrice ? Math.round(((srv.oldPrice - srv.price) / srv.oldPrice) * 100) : 0;
            return `
              <div class="service-card">
                <div class="service-card-top">
                  <div class="service-card-img">
                    ${srv.image ? `<img src="${srv.image}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm);">` : `<span style="font-size:1.5rem;">✨</span>`}
                  </div>
                  <div class="service-card-details">
                    <div class="service-card-name">${escapeHtml(srv.name)}</div>
                    <span class="business-badge" style="font-size:0.68rem;padding:0.1rem 0.45rem;">${escapeHtml(srv.category || 'General')}</span>
                    ${srv.description ? `<p class="service-card-desc">${escapeHtml(srv.description)}</p>` : ''}
                    <div class="service-card-pricing">
                      <span class="price-current">${b.currency || '₹'}${srv.price}</span>
                      ${hasOldPrice ? `<span class="price-old">${b.currency || '₹'}${srv.oldPrice}</span>` : ''}
                      ${discount > 0 ? `<span class="price-discount">${discount}% OFF</span>` : ''}
                    </div>
                  </div>
                </div>
                <div class="service-card-actions">
                  <button class="btn btn-outline btn-sm" onclick="window.App.editService('${srv.id}')">${getIcon('edit')} Edit</button>
                  <button class="btn btn-outline btn-sm" onclick="window.App.duplicateService('${srv.id}')">${getIcon('duplicate')} Duplicate</button>
                  <button class="btn btn-danger btn-sm" onclick="window.App.deleteService('${srv.id}')">${getIcon('trash')}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  // 8.4 PHOTOS & LOGO VIEW
  function renderPhotosView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    if (!b.galleryPhotos) b.galleryPhotos = [];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('photos')} Business Photos & Logo</h1>
            <p class="view-subtitle">Upload business logo, hero banner cover, and shop photos for ${b.name}.</p>
          </div>
        </div>
      </div>

      <div class="form-grid" style="margin-bottom:1.5rem;">
        <!-- Logo Uploader -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Business Logo</h3>
            ${b.logo ? `<button class="btn btn-danger btn-sm" onclick="window.App.removeLogo()">Remove Logo</button>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;">
            <div style="width:100px;height:100px;border-radius:24px;border:2px dashed var(--border-color);display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);overflow:hidden;flex-shrink:0;">
              ${b.logo ? `<img src="${b.logo}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:2rem;color:var(--text-muted);">${b.name.charAt(0)}</span>`}
            </div>
            <div style="flex:1;">
              <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.75rem;">
                Square image recommended (500x500px). Used on digital cards, catalogues, and QR badges.
              </p>
              <label class="btn btn-primary btn-sm" style="display:inline-flex;cursor:pointer;">
                ${getIcon('plus')} Upload Logo
                <input type="file" accept="image/*" style="display:none;" onchange="window.App.handleLogoUpload(this)">
              </label>
            </div>
          </div>
        </div>

        <!-- Cover Photo Uploader -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Cover Photo / Banner</h3>
            ${b.coverPhoto ? `<button class="btn btn-danger btn-sm" onclick="window.App.removeCoverPhoto()">Remove Banner</button>` : ''}
          </div>
          <div style="height:110px;width:100%;border-radius:var(--radius-md);border:2px dashed var(--border-color);overflow:hidden;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;margin-bottom:0.75rem;">
            ${b.coverPhoto ? `<img src="${b.coverPhoto}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="color:var(--text-muted);font-size:0.85rem;">No cover banner set</span>`}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.8rem;color:var(--text-muted);">Landscape 1200x500px recommended</span>
            <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
              ${getIcon('plus')} Upload Cover
              <input type="file" accept="image/*" style="display:none;" onchange="window.App.handleCoverUpload(this)">
            </label>
          </div>
        </div>
      </div>

      <!-- Business Gallery / Product Photos -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Gallery & Product Photos (${b.galleryPhotos.length})</h3>
            <p style="font-size:0.85rem;color:var(--text-secondary);">Photos of your shop interior, happy clients, or featured items.</p>
          </div>
          <label class="btn btn-primary btn-sm" style="cursor:pointer;">
            ${getIcon('plus')} + Add Photos
            <input type="file" accept="image/*" multiple style="display:none;" onchange="window.App.handleGalleryUpload(this)">
          </label>
        </div>

        ${b.galleryPhotos.length === 0 ? `
          <div class="upload-dropzone" onclick="this.querySelector('input').click()">
            <input type="file" accept="image/*" multiple style="display:none;" onchange="window.App.handleGalleryUpload(this)">
            <div style="font-size:2rem;color:#818cf8;">📷</div>
            <p style="font-weight:600;">Click to upload business or product photos</p>
            <span style="font-size:0.8rem;color:var(--text-muted);">Supports PNG, JPG, WebP. Compressed automatically.</span>
          </div>
        ` : `
          <div class="gallery-grid">
            ${b.galleryPhotos.map((photo, idx) => `
              <div class="gallery-item">
                <img src="${photo}" alt="Gallery ${idx + 1}">
                <button class="gallery-item-delete" title="Remove Photo" onclick="window.App.removeGalleryPhoto(${idx})">
                  ${getIcon('trash')}
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // 8.5 DIGITAL BUSINESS CARD VIEW
  function renderCardView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    const phoneLink = b.phone ? `tel:${b.phone.replace(/[^0-9+]/g, '')}` : '#';
    const waClean = b.whatsapp ? b.whatsapp.replace(/[^0-9]/g, '') : '';
    const waLink = waClean ? `https://wa.me/${waClean}?text=${encodeURIComponent(`Hi ${b.name}, I found your digital card and would like to know more about your services.`)}` : '#';
    const mapsLink = b.mapsUrl || (b.address ? `https://maps.google.com/?q=${encodeURIComponent(b.name + ' ' + b.address + ' ' + (b.city || ''))}` : '#');
    const igLink = b.instagram || '#';
    const reviewLink = b.gbpUrl || mapsLink;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('card')} Digital Business Card</h1>
            <p class="view-subtitle">Interactive customer-facing smart card with direct call, WhatsApp, and navigation actions.</p>
          </div>
          <div style="display:flex;gap:0.65rem;flex-wrap:wrap;">
            <button class="btn btn-success" onclick="window.App.downloadVCard()">
              ${getIcon('download')} Save Contact (.vcf)
            </button>
            <button class="btn btn-secondary" onclick="window.App.downloadCardHTML()">
              ${getIcon('download')} Download Card HTML
            </button>
            <button class="btn btn-outline" onclick="window.App.shareCardLink()">
              ${getIcon('share')} Share Card
            </button>
          </div>
        </div>
      </div>

      <div class="digital-card-container">
        <div class="digital-card" id="digital-card-preview">
          <!-- Card Cover Banner -->
          <div class="digital-card-cover">
            ${b.coverPhoto ? `<img src="${b.coverPhoto}" alt="Cover">` : ''}
          </div>

          <!-- Avatar & Header -->
          <div class="digital-card-avatar-wrap">
            <div class="digital-card-avatar">
              ${b.logo ? `<img src="${b.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:20px;">` : b.name.charAt(0)}
            </div>
            <div style="background:rgba(99,102,241,0.25);border:1px solid rgba(99,102,241,0.5);color:#a5b4fc;font-size:0.7rem;font-weight:700;padding:0.2rem 0.65rem;border-radius:99px;margin-bottom:8px;">
              VERIFIED BUSINESS
            </div>
          </div>

          <div class="digital-card-body">
            <h2 class="digital-card-title">${escapeHtml(b.name)}</h2>
            <div class="digital-card-category">${escapeHtml(b.category || 'Local Business')} • ${escapeHtml(b.ownerName ? `Managed by ${b.ownerName}` : 'Owner')}</div>

            ${b.description ? `<p class="digital-card-desc">${escapeHtml(b.description)}</p>` : ''}

            <!-- Action Buttons Grid -->
            <div class="digital-card-buttons">
              <a href="${phoneLink}" class="card-btn card-btn-call">
                <span style="display:flex;width:16px;height:16px;">${getIcon('phone')}</span>
                <span>CALL NOW</span>
              </a>

              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="card-btn card-btn-wa">
                <span style="display:flex;width:16px;height:16px;">${getIcon('whatsapp')}</span>
                <span>WHATSAPP</span>
              </a>

              <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" class="card-btn card-btn-map">
                <span style="display:flex;width:16px;height:16px;">${getIcon('map')}</span>
                <span>DIRECTIONS</span>
              </a>

              ${b.instagram ? `
                <a href="${igLink}" target="_blank" rel="noopener noreferrer" class="card-btn card-btn-ig">
                  <span style="display:flex;width:16px;height:16px;">${getIcon('instagram')}</span>
                  <span>INSTAGRAM</span>
                </a>
              ` : `
                <button type="button" class="card-btn card-btn-services" onclick="window.App.switchView('catalogue')">
                  <span style="display:flex;width:16px;height:16px;">${getIcon('catalogue')}</span>
                  <span>SERVICES</span>
                </button>
              `}

              <button type="button" class="card-btn card-btn-services" onclick="window.App.switchView('catalogue')">
                <span style="display:flex;width:16px;height:16px;">${getIcon('catalogue')}</span>
                <span>CATALOGUE</span>
              </button>

              <a href="${reviewLink}" target="_blank" rel="noopener noreferrer" class="card-btn card-btn-review">
                <span style="display:flex;width:16px;height:16px;">${getIcon('star')}</span>
                <span>REVIEW US</span>
              </a>
            </div>

            <!-- Business Information Sheet Box -->
            <div class="digital-card-info-box">
              ${b.address ? `
                <div class="card-info-row">
                  <span style="display:flex;">${getIcon('map')}</span>
                  <span>${escapeHtml(b.address)}${b.city ? `, ${escapeHtml(b.city)}` : ''}${b.pincode ? ` - ${escapeHtml(b.pincode)}` : ''}</span>
                </div>
              ` : ''}

              ${b.openingHours ? `
                <div class="card-info-row">
                  <span style="display:flex;">${getIcon('clock')}</span>
                  <span>${escapeHtml(b.openingHours)}${b.workingDays ? ` (${escapeHtml(b.workingDays)})` : ''}</span>
                </div>
              ` : ''}

              ${b.email ? `
                <div class="card-info-row">
                  <span style="display:flex;">${getIcon('globe')}</span>
                  <a href="mailto:${escapeHtml(b.email)}" style="color:#a5b4fc;text-decoration:none;">${escapeHtml(b.email)}</a>
                </div>
              ` : ''}

              ${b.website ? `
                <div class="card-info-row">
                  <span style="display:flex;">${getIcon('globe')}</span>
                  <a href="${escapeHtml(b.website)}" target="_blank" rel="noopener noreferrer" style="color:#a5b4fc;text-decoration:none;">${escapeHtml(b.website)}</a>
                </div>
              ` : ''}
            </div>

            <div style="margin-top:1.25rem;">
              <button class="btn btn-secondary btn-block" onclick="window.App.downloadVCard()">
                ${getIcon('download')} Add to Phone Contacts (.vcf)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 8.6 DIGITAL CATALOGUE VIEW
  function renderCatalogueView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    if (!b.services) b.services = [];
    const categories = Array.from(new Set(b.services.map(s => s.category || 'General')));

    const phoneLink = b.phone ? `tel:${b.phone.replace(/[^0-9+]/g, '')}` : '#';
    const waClean = b.whatsapp ? b.whatsapp.replace(/[^0-9]/g, '') : '';
    const mapsLink = b.mapsUrl || '#';

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('catalogue')} Digital Catalogue</h1>
            <p class="view-subtitle">Customer-ready pricing catalogue with instant WhatsApp order & enquiry triggers.</p>
          </div>
          <div style="display:flex;gap:0.65rem;flex-wrap:wrap;">
            <button class="btn btn-secondary" onclick="window.App.printCatalogue()">
              ${getIcon('print')} Print Catalogue
            </button>
            <button class="btn btn-primary" onclick="window.App.downloadCatalogueHTML()">
              ${getIcon('download')} Download Catalogue HTML
            </button>
          </div>
        </div>
      </div>

      <div class="card" style="max-width:820px;margin:0 auto;padding:2rem;">
        <!-- Catalogue Header -->
        <div style="text-align:center;padding-bottom:1.5rem;border-bottom:1px solid var(--border-color);margin-bottom:1.75rem;">
          ${b.logo ? `<img src="${b.logo}" style="width:72px;height:72px;border-radius:20px;object-fit:cover;margin:0 auto 0.75rem;box-shadow:0 6px 16px rgba(0,0,0,0.4);">` : ''}
          <h2 style="font-size:1.6rem;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(b.name)}</h2>
          <p style="color:#818cf8;font-weight:600;font-size:0.88rem;margin-top:0.25rem;">${escapeHtml(b.category || 'Local Business')}</p>
          ${b.description ? `<p style="color:var(--text-secondary);font-size:0.85rem;max-width:560px;margin:0.5rem auto 0;">${escapeHtml(b.description)}</p>` : ''}

          <div style="display:flex;justify-content:center;gap:0.85rem;margin-top:1rem;flex-wrap:wrap;">
            <a href="${phoneLink}" class="btn btn-outline btn-sm">${getIcon('phone')} Call Now</a>
            <a href="https://wa.me/${waClean}" target="_blank" class="btn btn-success btn-sm">${getIcon('whatsapp')} WhatsApp</a>
            <a href="${mapsLink}" target="_blank" class="btn btn-outline btn-sm">${getIcon('map')} Get Directions</a>
          </div>
        </div>

        <!-- Categorized List -->
        ${categories.length === 0 ? `
          <div style="text-align:center;padding:2rem;">
            <p style="color:var(--text-secondary);">No services entered yet.</p>
            <button class="btn btn-primary btn-sm" style="margin-top:0.75rem;" onclick="window.App.switchView('services')">+ Add Services</button>
          </div>
        ` : categories.map(cat => {
          const items = b.services.filter(s => (s.category || 'General') === cat);
          return `
            <div style="margin-bottom:2rem;">
              <div style="display:flex;align-items:center;gap:0.65rem;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:2px solid rgba(99,102,241,0.25);">
                <h3 style="font-size:1.15rem;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:#a5b4fc;">${escapeHtml(cat)}</h3>
                <span style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">(${items.length} items)</span>
              </div>

              <div style="display:flex;flex-direction:column;gap:0.85rem;">
                ${items.map(item => {
                  const hasOldPrice = item.oldPrice && Number(item.oldPrice) > Number(item.price);
                  const discount = hasOldPrice ? Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100) : 0;
                  const itemWaMsg = encodeURIComponent(`Hi ${b.name}, I would like to book/enquire about: "${item.name}" (Price: ${b.currency || '₹'}${item.price}). Please share availability.`);
                  const itemWaLink = waClean ? `https://wa.me/${waClean}?text=${itemWaMsg}` : '#';

                  return `
                    <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:1rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;">
                      <div style="flex:1;min-width:200px;">
                        <h4 style="font-size:1rem;font-weight:700;">${escapeHtml(item.name)}</h4>
                        ${item.description ? `<p style="font-size:0.82rem;color:var(--text-secondary);margin-top:0.25rem;">${escapeHtml(item.description)}</p>` : ''}
                      </div>

                      <div style="display:flex;align-items:center;gap:1rem;">
                        <div style="text-align:right;">
                          <div style="font-size:1.15rem;font-weight:800;color:#34d399;">${b.currency || '₹'}${item.price}</div>
                          ${hasOldPrice ? `<div style="font-size:0.78rem;color:var(--text-muted);text-decoration:line-through;">${b.currency || '₹'}${item.oldPrice}</div>` : ''}
                          ${discount > 0 ? `<span style="font-size:0.7rem;font-weight:700;color:#fbbf24;background:rgba(245,158,11,0.12);padding:0.1rem 0.35rem;border-radius:4px;">${discount}% OFF</span>` : ''}
                        </div>

                        <a href="${itemWaLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="color:#25d366;border-color:rgba(37,211,102,0.35);" title="Enquire on WhatsApp">
                          ${getIcon('whatsapp')} Enquire
                        </a>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}

        <!-- Catalogue Sticky Action Bar -->
        <div style="margin-top:2rem;padding-top:1.25rem;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
          <div style="font-size:0.85rem;color:var(--text-muted);">
            📍 ${escapeHtml(b.address || 'Address')} • ⏰ ${escapeHtml(b.openingHours || 'Hours')}
          </div>
          <div style="display:flex;gap:0.5rem;">
            <a href="${phoneLink}" class="btn btn-secondary btn-sm">${getIcon('phone')} Call</a>
            <a href="https://wa.me/${waClean}" target="_blank" class="btn btn-success btn-sm">${getIcon('whatsapp')} WhatsApp Chat</a>
          </div>
        </div>
      </div>
    `;
  }

  // 8.7 QR GENERATOR VIEW
  function renderQRView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    const qrTarget = AppState.qrSettings.target;
    let targetUrl = getQRTargetUrl(b, qrTarget);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('qr')} QR Code & Table Standee Generator</h1>
            <p class="view-subtitle">Generate scannable QR codes for WhatsApp, Maps, Google Reviews, and print table tent cards.</p>
          </div>
          <div style="display:flex;gap:0.65rem;">
            <button class="btn btn-primary" onclick="window.App.downloadQRImage()">
              ${getIcon('download')} Download QR PNG
            </button>
            <button class="btn btn-secondary" onclick="window.App.printReviewStandee()">
              ${getIcon('print')} Print Review Standee
            </button>
          </div>
        </div>
      </div>

      <div class="qr-view-grid">
        <!-- Controls Card -->
        <div class="card">
          <h3 class="card-title" style="margin-bottom:1.25rem;">QR Code Configuration</h3>

          <div class="form-group">
            <label class="form-label">Select QR Destination</label>
            <select id="qr-target-select" class="form-select" onchange="window.App.handleQRTargetChange(this.value)">
              <option value="whatsapp" ${qrTarget === 'whatsapp' ? 'selected' : ''}>WhatsApp Direct Chat (wa.me)</option>
              <option value="phone" ${qrTarget === 'phone' ? 'selected' : ''}>Call Phone Number (tel:)</option>
              <option value="maps" ${qrTarget === 'maps' ? 'selected' : ''}>Google Maps Location & Directions</option>
              <option value="reviews" ${qrTarget === 'reviews' ? 'selected' : ''}>Google Review Link (Table Standee)</option>
              <option value="catalogue" ${qrTarget === 'catalogue' ? 'selected' : ''}>Business Digital Catalogue</option>
              <option value="instagram" ${qrTarget === 'instagram' ? 'selected' : ''}>Instagram Profile</option>
              <option value="custom" ${qrTarget === 'custom' ? 'selected' : ''}>Custom Website / URL</option>
            </select>
          </div>

          ${qrTarget === 'custom' ? `
            <div class="form-group">
              <label class="form-label">Custom URL</label>
              <input type="url" id="qr-custom-url" class="form-input" value="${escapeHtml(AppState.qrSettings.customUrl || '')}" placeholder="https://example.com" oninput="window.App.updateQRCustomUrl(this.value)">
            </div>
          ` : ''}

          <div class="form-group">
            <label class="form-label">Encoded Destination URL</label>
            <input type="text" class="form-input" readonly value="${escapeHtml(targetUrl)}" style="background:var(--bg-glass);font-size:0.82rem;color:var(--text-secondary);">
            <span class="form-hint">Scanned by any smartphone camera app to open this link directly.</span>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">QR Foreground Color</label>
              <input type="color" id="qr-fg-color" class="form-input" style="height:44px;padding:4px;" value="${AppState.qrSettings.fgColor}" onchange="window.App.updateQRColors(this.value, null)">
            </div>
            <div class="form-group">
              <label class="form-label">QR Background Color</label>
              <input type="color" id="qr-bg-color" class="form-input" style="height:44px;padding:4px;" value="${AppState.qrSettings.bgColor}" onchange="window.App.updateQRColors(null, this.value)">
            </div>
          </div>

          <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:12px;padding:1rem;margin-top:1rem;">
            <div style="font-size:0.82rem;font-weight:700;color:#818cf8;margin-bottom:0.35rem;">ℹ️ Review Policy Notice</div>
            <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.4;">
              Google Reviews policy requires honest customer feedback. Do not create fake reviews or incentivize exclusively positive reviews.
            </p>
          </div>
        </div>

        <!-- Standee / Preview Card -->
        <div>
          <!-- Printable Review Standee Tent Card -->
          <div class="review-standee-card" id="printable-review-standee">
            <div class="standee-header">
              <h3>HOW WAS YOUR EXPERIENCE?</h3>
              <p>Scan the QR code to leave your feedback</p>
            </div>

            <div class="standee-qr-frame">
              <canvas id="qr-live-canvas" width="220" height="220"></canvas>
            </div>

            <div class="standee-footer">
              ⭐ "Thank you for visiting us!" ⭐
            </div>

            <div class="standee-brand">
              ${b.logo ? `<img src="${b.logo}" style="width:28px;height:28px;border-radius:8px;object-fit:cover;">` : ''}
              <span class="standee-brand-name">${escapeHtml(b.name)}</span>
            </div>
          </div>

          <div style="display:flex;justify-content:center;gap:0.75rem;margin-top:1.25rem;">
            <button class="btn btn-secondary btn-sm" onclick="window.App.downloadQRImage()">
              ${getIcon('download')} Download QR (PNG)
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.App.printReviewStandee()">
              ${getIcon('print')} Print Review Standee
            </button>
          </div>
        </div>
      </div>
    `;

    // Render QR Code onto the live canvas
    setTimeout(() => {
      const canvas = document.getElementById('qr-live-canvas');
      if (canvas) {
        renderQRCodeToCanvas(targetUrl, canvas, {
          size: 220,
          fgColor: AppState.qrSettings.fgColor,
          bgColor: AppState.qrSettings.bgColor,
          padding: 12
        });
      }
    }, 50);
  }

  function getQRTargetUrl(b, target) {
    const waClean = b.whatsapp ? b.whatsapp.replace(/[^0-9]/g, '') : '';
    switch (target) {
      case 'whatsapp':
        return waClean ? `https://wa.me/${waClean}?text=${encodeURIComponent(`Hi ${b.name}, I scanned your QR code and would like more details!`)}` : 'https://wa.me/';
      case 'phone':
        return b.phone ? `tel:${b.phone.replace(/[^0-9+]/g, '')}` : 'tel:';
      case 'maps':
        return b.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(b.name + ' ' + (b.address || ''))}`;
      case 'reviews':
        return b.gbpUrl || b.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(b.name + ' ' + (b.address || ''))}`;
      case 'catalogue':
        return window.location.href;
      case 'instagram':
        return b.instagram || 'https://instagram.com';
      case 'custom':
        return AppState.qrSettings.customUrl || 'https://google.com';
      default:
        return 'https://wa.me/' + waClean;
    }
  }

  // 8.8 PROMOTIONAL POST GENERATOR VIEW
  function renderPromoView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    if (!b.services) b.services = [];

    const templates = [
      "SPECIAL OFFER", "NEW ARRIVAL", "BOOK NOW", "LIMITED OFFER",
      "WEEKEND SPECIAL", "NEW COLLECTION", "TODAY'S SPECIAL",
      "CONTACT US", "VISIT US", "THANK YOU"
    ];

    const ratios = [
      { id: "1:1", label: "Square (1:1)", sub: "Post / DP" },
      { id: "4:5", label: "Portrait (4:5)", sub: "IG Feed" },
      { id: "9:16", label: "Story (9:16)", sub: "Reel / Status" }
    ];

    const themes = [
      { id: "dark-gold", name: "Luxury Dark & Gold", bg: "#090d16", accent: "#fbbf24" },
      { id: "royal-blue", name: "Royal Sapphire Blue", bg: "#0f172a", accent: "#6366f1" },
      { id: "emerald", name: "Fresh Emerald Green", bg: "#022c22", accent: "#34d399" },
      { id: "sunset", name: "Warm Sunset Coral", bg: "#431407", accent: "#f97316" }
    ];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('promo')} Promotional Creative Generator</h1>
            <p class="view-subtitle">Generate high-resolution social media banners, story posts, and promotional offers.</p>
          </div>
          <button class="btn btn-primary" onclick="window.App.downloadPromoCreative()">
            ${getIcon('download')} Download PNG Creative
          </button>
        </div>
      </div>

      <div class="promo-generator-grid">
        <!-- Controls Column -->
        <div class="card">
          <h3 class="card-title" style="margin-bottom:1rem;">Creative Controls</h3>

          <!-- Aspect Ratio Picker -->
          <div class="form-group">
            <label class="form-label">Aspect Ratio</label>
            <div class="aspect-ratio-selector">
              ${ratios.map(r => `
                <button type="button" class="aspect-btn ${AppState.promoSettings.ratio === r.id ? 'active' : ''}" onclick="window.App.setPromoRatio('${r.id}')">
                  ${r.label}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Template Style Picker -->
          <div class="form-group">
            <label class="form-label">Promo Headline Template</label>
            <div class="template-picker-grid">
              ${templates.map(tpl => `
                <button type="button" class="template-pill ${AppState.promoSettings.template === tpl ? 'active' : ''}" onclick="window.App.setPromoTemplate('${tpl}')">
                  ${tpl}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Color Theme Picker -->
          <div class="form-group">
            <label class="form-label">Color Theme</label>
            <select class="form-select" onchange="window.App.setPromoTheme(this.value)">
              ${themes.map(th => `
                <option value="${th.id}" ${AppState.promoSettings.theme === th.id ? 'selected' : ''}>${th.name}</option>
              `).join('')}
            </select>
          </div>

          <!-- Featured Service / Product -->
          <div class="form-group">
            <label class="form-label">Feature a Service / Product</label>
            <select class="form-select" onchange="window.App.selectPromoService(this.value)">
              <option value="">-- Custom Text Below --</option>
              ${b.services.map(s => `
                <option value="${s.id}" ${AppState.promoSettings.serviceId === s.id ? 'selected' : ''}>
                  ${s.name} (${b.currency || '₹'}${s.price})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Headline / Service Title</label>
            <input type="text" id="promo-headline" class="form-input" value="${escapeHtml(AppState.promoSettings.customHeadline)}" oninput="window.App.updatePromoHeadline(this.value)">
          </div>

          <div class="form-group">
            <label class="form-label">Price / Offer Tag</label>
            <input type="text" id="promo-price" class="form-input" value="${escapeHtml(AppState.promoSettings.customPrice)}" oninput="window.App.updatePromoPrice(this.value)">
          </div>

          <div class="form-group">
            <label class="form-label">Call to Action (CTA)</label>
            <input type="text" id="promo-cta" class="form-input" value="${escapeHtml(AppState.promoSettings.customCta)}" oninput="window.App.updatePromoCta(this.value)">
          </div>
        </div>

        <!-- Canvas Display Column -->
        <div class="promo-canvas-wrapper">
          <canvas id="promo-canvas"></canvas>

          <div style="display:flex;gap:0.75rem;margin-top:1.25rem;">
            <button class="btn btn-primary" onclick="window.App.downloadPromoCreative()">
              ${getIcon('download')} Download High-Res PNG
            </button>
          </div>
        </div>
      </div>
    `;

    // Draw promo creative on canvas
    setTimeout(() => {
      renderPromoCanvas();
    }, 50);
  }

  function renderPromoCanvas() {
    const canvas = document.getElementById('promo-canvas');
    if (!canvas) return;

    const b = getCurrentBusiness();
    if (!b) return;

    const ratio = AppState.promoSettings.ratio;
    let width = 1080;
    let height = 1080;
    if (ratio === '4:5') height = 1350;
    if (ratio === '9:16') height = 1920;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    const theme = AppState.promoSettings.theme;

    // Background styling
    let grad = ctx.createLinearGradient(0, 0, width, height);
    if (theme === 'royal-blue') {
      grad.addColorStop(0, '#0a0f1d');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#312e81');
    } else if (theme === 'emerald') {
      grad.addColorStop(0, '#021f17');
      grad.addColorStop(0.5, '#064e3b');
      grad.addColorStop(1, '#022c22');
    } else if (theme === 'sunset') {
      grad.addColorStop(0, '#2b0a04');
      grad.addColorStop(0.5, '#7c2d12');
      grad.addColorStop(1, '#431407');
    } else {
      // dark-gold default
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.5, '#18181b');
      grad.addColorStop(1, '#090d16');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative geometric rings
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(width * 0.85, height * 0.15, 260, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width * 0.15, height * 0.85, 340, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Accent line header
    ctx.fillStyle = theme === 'dark-gold' ? '#fbbf24' : (theme === 'emerald' ? '#34d399' : (theme === 'sunset' ? '#fb923c' : '#818cf8'));
    ctx.fillRect(width * 0.1, height * 0.08, 120, 8);

    // Top Brand Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(b.name.toUpperCase(), width * 0.1, height * 0.14);

    // Business Category Badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText((b.category || 'Specialist').toUpperCase(), width * 0.1, height * 0.18);

    // Main Big Headline / Template
    const headline = AppState.promoSettings.template || 'SPECIAL OFFER';
    ctx.fillStyle = theme === 'dark-gold' ? '#fbbf24' : (theme === 'emerald' ? '#34d399' : (theme === 'sunset' ? '#f97316' : '#a5b4fc'));
    ctx.font = '900 86px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(headline, width * 0.1, height * 0.32);

    // Feature Service Title
    const subTitle = AppState.promoSettings.customHeadline || (b.services[0]?.name || 'Premium Service');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    // Text wrap helper for long service titles
    wrapText(ctx, subTitle, width * 0.1, height * 0.42, width * 0.8, 64);

    // Price Badge Box
    const priceText = AppState.promoSettings.customPrice || 'Exclusive Deal';
    const boxY = height * 0.58;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(width * 0.1, boxY, width * 0.8, 120, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(priceText, width * 0.15, boxY + 80);

    // Call To Action Button
    const ctaText = (AppState.promoSettings.customCta || 'Book Your Slot Today').toUpperCase();
    const ctaY = height * 0.74;
    ctx.fillStyle = theme === 'dark-gold' ? '#fbbf24' : (theme === 'emerald' ? '#10b981' : (theme === 'sunset' ? '#ea580c' : '#6366f1'));
    ctx.beginPath();
    ctx.roundRect(width * 0.1, ctaY, width * 0.8, 90, 20);
    ctx.fill();

    ctx.fillStyle = theme === 'dark-gold' ? '#090d16' : '#ffffff';
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ctaText, width * 0.5, ctaY + 58);
    ctx.textAlign = 'left';

    // Bottom Contact Bar
    const bottomY = height - 120;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(0, bottomY, width, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const contactStr = `📞 ${b.phone || 'Call Us'}   💬 ${b.whatsapp || ''}   📍 ${b.city || ''}`;
    ctx.fillText(contactStr, width * 0.1, bottomY + 70);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  // 8.9 BUSINESS KIT GENERATOR & REPORT VIEW
  function renderKitView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    const isDone = b.status === 'completed';

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('kit')} Business Kit Generator</h1>
            <p class="view-subtitle">Generate and deliver the complete digital marketing package for ${b.name}.</p>
          </div>
          ${isDone ? `
            <div style="display:flex;gap:0.65rem;">
              <button class="btn btn-secondary" onclick="window.App.printDeliverableReport()">
                ${getIcon('print')} Print Executive Report
              </button>
              <button class="btn btn-primary" onclick="window.App.downloadStandaloneKit()">
                ${getIcon('download')} Download Complete Website
              </button>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="kit-progress-box">
        <div style="font-size:3rem;margin-bottom:0.75rem;">📦</div>
        <h2 style="font-size:1.6rem;font-weight:800;letter-spacing:-0.02em;">
          ${isDone ? 'YOUR BUSINESS KIT IS READY' : 'GENERATE COMPLETE BUSINESS KIT'}
        </h2>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:0.35rem;">
          ${isDone ? 'All digital marketing assets have been compiled and are ready to deliver to the client.' : 'Click below to compile the digital card, catalogue, QR codes, promo creatives, and website.'}
        </p>

        <!-- Progress List -->
        <div class="progress-list">
          <div class="progress-item ${b.name ? 'done' : ''}">
            <span>1. Business Profile & Contact Information</span>
            <div class="progress-icon">${b.name ? '✓' : '1'}</div>
          </div>
          <div class="progress-item ${b.services?.length ? 'done' : ''}">
            <span>2. Digital Services & Pricing Catalogue (${b.services?.length || 0} items)</span>
            <div class="progress-icon">${b.services?.length ? '✓' : '2'}</div>
          </div>
          <div class="progress-item ${isDone ? 'done' : ''}">
            <span>3. Automatic Digital Business Card</span>
            <div class="progress-icon">${isDone ? '✓' : '3'}</div>
          </div>
          <div class="progress-item ${isDone ? 'done' : ''}">
            <span>4. Direct QR Codes & Printable Review Standee</span>
            <div class="progress-icon">${isDone ? '✓' : '4'}</div>
          </div>
          <div class="progress-item ${isDone ? 'done' : ''}">
            <span>5. Promotional Creatives & Social Posts</span>
            <div class="progress-icon">${isDone ? '✓' : '5'}</div>
          </div>
          <div class="progress-item ${isDone ? 'done' : ''}">
            <span>6. Standalone Customer Website (Single HTML file)</span>
            <div class="progress-icon">${isDone ? '✓' : '6'}</div>
          </div>
        </div>

        ${!isDone ? `
          <button class="btn btn-primary btn-lg btn-block" onclick="window.App.runKitGeneration()">
            ${getIcon('kit')} GENERATE COMPLETE BUSINESS KIT
          </button>
        ` : `
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center;">
            <button class="btn btn-primary" onclick="window.App.switchView('preview')">
              ${getIcon('preview')} PREVIEW KIT
            </button>
            <button class="btn btn-success" onclick="window.App.downloadStandaloneKit()">
              ${getIcon('download')} DOWNLOAD KIT
            </button>
            <button class="btn btn-secondary" onclick="window.App.switchView('business-form')">
              ${getIcon('edit')} EDIT BUSINESS
            </button>
            <button class="btn btn-outline" onclick="window.App.shareCardLink()">
              ${getIcon('share')} SHARE
            </button>
          </div>
        `}
      </div>

      <!-- Deliverable Business Kit Report Section -->
      ${isDone ? `
        <div style="margin-top:2.5rem;">
          <div class="deliverable-report" id="deliverable-report-box">
            <div class="report-header">
              <div class="report-title">
                <h2>BUSINESS DIGITAL KIT</h2>
                <p style="font-size:0.85rem;color:#64748b;margin-top:0.2rem;">Deliverable Documentation & Digital Asset Manifest</p>
              </div>
              <span class="report-badge">✓ READY TO DELIVER</span>
            </div>

            <div class="report-grid">
              <div class="report-field">
                <span class="report-label">Business Name</span>
                <span class="report-val">${escapeHtml(b.name)}</span>
              </div>
              <div class="report-field">
                <span class="report-label">Category</span>
                <span class="report-val">${escapeHtml(b.category || 'Local Business')}</span>
              </div>
              <div class="report-field">
                <span class="report-label">Calling Phone</span>
                <span class="report-val">${escapeHtml(b.phone || 'Not set')}</span>
              </div>
              <div class="report-field">
                <span class="report-label">WhatsApp Contact</span>
                <span class="report-val">${escapeHtml(b.whatsapp || 'Not set')}</span>
              </div>
              <div class="report-field" style="grid-column:span 2;">
                <span class="report-label">Address</span>
                <span class="report-val">${escapeHtml(b.address || '')}${b.city ? `, ${escapeHtml(b.city)}` : ''}</span>
              </div>
            </div>

            <div class="report-checklist">
              <h4>Digital Assets Included in Deliverable:</h4>
              <div class="report-check-item">
                <span style="color:#10b981;font-weight:bold;">✓</span>
                <span><strong>Digital Business Card:</strong> Interactive smart card with Click-to-Call, WhatsApp, Maps & vCard.</span>
              </div>
              <div class="report-check-item">
                <span style="color:#10b981;font-weight:bold;">✓</span>
                <span><strong>Digital Catalogue:</strong> Categorized service & pricing sheet with direct WhatsApp order links.</span>
              </div>
              <div class="report-check-item">
                <span style="color:#10b981;font-weight:bold;">✓</span>
                <span><strong>QR Codes & Review Standee:</strong> High-res QR codes for WhatsApp, Maps, and printable table tent.</span>
              </div>
              <div class="report-check-item">
                <span style="color:#10b981;font-weight:bold;">✓</span>
                <span><strong>Promotional Post Creatives:</strong> Ready-to-publish social media graphics in 1:1, 4:5, and 9:16 sizes.</span>
              </div>
              <div class="report-check-item">
                <span style="color:#10b981;font-weight:bold;">✓</span>
                <span><strong>Standalone Client Website:</strong> Self-contained website deployable to GitHub Pages with zero coding.</span>
              </div>
            </div>

            <div style="font-size:0.8rem;color:#64748b;text-align:center;padding-top:1rem;border-top:1px solid #e2e8f0;">
              Generated via Local Business Digital Kit Generator • Deployable to GitHub Pages & Static Hosting
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }

  // 8.10 REALISTIC MOBILE PHONE PREVIEW VIEW
  function renderPhonePreviewView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    const tab = AppState.previewTab;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('preview')} Realistic Mobile Phone Preview</h1>
            <p class="view-subtitle">Experience exactly how your customers will interact with ${b.name}'s digital portal.</p>
          </div>
          <div style="display:flex;gap:0.65rem;">
            <button class="btn btn-secondary btn-sm" onclick="window.App.openStandalonePreviewInWindow()">
              ${getIcon('globe')} Open in New Window
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.App.downloadStandaloneKit()">
              ${getIcon('download')} Download Web Kit
            </button>
          </div>
        </div>
      </div>

      <div class="phone-preview-wrapper">
        <div class="smartphone-mockup">
          <div class="phone-screen">
            <!-- Smartphone Top Status Bar -->
            <div class="phone-status-bar">
              <span>${timeStr}</span>
              <div class="phone-notch"></div>
              <span>📶 🔋</span>
            </div>

            <!-- Screen Body Content (Driven by Phone Bottom Navigation) -->
            <div style="flex:1;overflow-y:auto;padding-bottom:1rem;">
              ${renderPhoneScreenContent(b, tab)}
            </div>

            <!-- Phone Bottom Navigation Bar -->
            <div class="phone-bottom-nav">
              <button class="phone-nav-item ${tab === 'home' ? 'active' : ''}" onclick="window.App.setPhoneTab('home')">
                <span style="display:flex;">${getIcon('card')}</span>
                <span>Home</span>
              </button>
              <button class="phone-nav-item ${tab === 'services' ? 'active' : ''}" onclick="window.App.setPhoneTab('services')">
                <span style="display:flex;">${getIcon('services')}</span>
                <span>Services</span>
              </button>
              <button class="phone-nav-item ${tab === 'catalogue' ? 'active' : ''}" onclick="window.App.setPhoneTab('catalogue')">
                <span style="display:flex;">${getIcon('catalogue')}</span>
                <span>Catalogue</span>
              </button>
              <button class="phone-nav-item ${tab === 'contact' ? 'active' : ''}" onclick="window.App.setPhoneTab('contact')">
                <span style="display:flex;">${getIcon('phone')}</span>
                <span>Contact</span>
              </button>
              <button class="phone-nav-item ${tab === 'reviews' ? 'active' : ''}" onclick="window.App.setPhoneTab('reviews')">
                <span style="display:flex;">${getIcon('star')}</span>
                <span>Reviews</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPhoneScreenContent(b, tab) {
    const phoneLink = b.phone ? `tel:${b.phone.replace(/[^0-9+]/g, '')}` : '#';
    const waClean = b.whatsapp ? b.whatsapp.replace(/[^0-9]/g, '') : '';
    const mapsLink = b.mapsUrl || '#';
    const reviewLink = b.gbpUrl || mapsLink;

    if (tab === 'home') {
      return `
        <!-- Home Tab inside Smartphone -->
        <div style="padding:1rem;">
          <div style="height:100px;background:var(--accent-gradient);border-radius:18px;margin-bottom:-35px;overflow:hidden;">
            ${b.coverPhoto ? `<img src="${b.coverPhoto}" style="width:100%;height:100%;object-fit:cover;">` : ''}
          </div>

          <div style="display:flex;align-items:flex-end;gap:0.75rem;padding:0 0.5rem;margin-bottom:0.75rem;">
            <div style="width:64px;height:64px;border-radius:18px;border:3px solid #090d16;background:#1e293b;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#fff;">
              ${b.logo ? `<img src="${b.logo}" style="width:100%;height:100%;object-fit:cover;">` : b.name.charAt(0)}
            </div>
            <div>
              <h3 style="font-size:1.15rem;font-weight:800;color:#fff;line-height:1.2;">${escapeHtml(b.name)}</h3>
              <span style="font-size:0.75rem;color:#818cf8;font-weight:600;">${escapeHtml(b.category || 'Local Business')}</span>
            </div>
          </div>

          ${b.description ? `<p style="font-size:0.78rem;color:#94a3b8;line-height:1.4;margin:0.5rem 0.5rem 1rem;">${escapeHtml(b.description)}</p>` : ''}

          <!-- Quick Actions -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem;">
            <a href="${phoneLink}" class="card-btn card-btn-call" style="padding:0.6rem;font-size:0.75rem;">
              <span style="display:flex;width:14px;height:14px;">${getIcon('phone')}</span> Call Now
            </a>
            <a href="https://wa.me/${waClean}" target="_blank" class="card-btn card-btn-wa" style="padding:0.6rem;font-size:0.75rem;">
              <span style="display:flex;width:14px;height:14px;">${getIcon('whatsapp')}</span> WhatsApp
            </a>
            <a href="${mapsLink}" target="_blank" class="card-btn card-btn-map" style="padding:0.6rem;font-size:0.75rem;">
              <span style="display:flex;width:14px;height:14px;">${getIcon('map')}</span> Directions
            </a>
            <a href="${reviewLink}" target="_blank" class="card-btn card-btn-review" style="padding:0.6rem;font-size:0.75rem;">
              <span style="display:flex;width:14px;height:14px;">${getIcon('star')}</span> Review
            </a>
          </div>

          <!-- Featured Services Sneak Peek -->
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:0.75rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem;">
              <span style="font-size:0.8rem;font-weight:700;color:#fff;">Popular Services</span>
              <span style="font-size:0.7rem;color:#818cf8;cursor:pointer;" onclick="window.App.setPhoneTab('services')">View All →</span>
            </div>
            ${(b.services || []).slice(0, 3).map(s => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.78rem;">
                <span style="color:#cbd5e1;">${escapeHtml(s.name)}</span>
                <span style="font-weight:700;color:#34d399;">${b.currency || '₹'}${s.price}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (tab === 'services' || tab === 'catalogue') {
      return `
        <!-- Services Tab inside Smartphone -->
        <div style="padding:1rem;">
          <h3 style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:0.75rem;">Services & Pricing</h3>
          <div style="display:flex;flex-direction:column;gap:0.65rem;">
            ${(b.services || []).map(s => `
              <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:0.75rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <div>
                    <h4 style="font-size:0.88rem;font-weight:700;color:#fff;">${escapeHtml(s.name)}</h4>
                    <span style="font-size:0.68rem;color:#818cf8;">${escapeHtml(s.category || 'General')}</span>
                  </div>
                  <span style="font-size:0.95rem;font-weight:800;color:#34d399;">${b.currency || '₹'}${s.price}</span>
                </div>
                ${s.description ? `<p style="font-size:0.72rem;color:#94a3b8;margin-top:0.35rem;">${escapeHtml(s.description)}</p>` : ''}
                <div style="margin-top:0.5rem;text-align:right;">
                  <a href="https://wa.me/${waClean}?text=${encodeURIComponent(`Hi, I would like to book ${s.name} (${b.currency || '₹'}${s.price})`)}" target="_blank" class="btn btn-outline btn-sm" style="font-size:0.68rem;padding:0.2rem 0.5rem;color:#25d366;border-color:rgba(37,211,102,0.4);">
                    ${getIcon('whatsapp')} Book
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (tab === 'contact') {
      return `
        <!-- Contact Tab inside Smartphone -->
        <div style="padding:1rem;">
          <h3 style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:0.75rem;">Contact & Location</h3>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:1rem;display:flex;flex-direction:column;gap:0.75rem;font-size:0.8rem;">
            <div>
              <span style="color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:bold;">Address</span>
              <p style="color:#f8fafc;margin-top:0.15rem;">${escapeHtml(b.address || 'Address not set')}, ${escapeHtml(b.city || '')}</p>
            </div>
            <div>
              <span style="color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:bold;">Working Hours</span>
              <p style="color:#f8fafc;margin-top:0.15rem;">${escapeHtml(b.openingHours || 'Hours not set')}</p>
              <p style="color:#94a3b8;font-size:0.72rem;">${escapeHtml(b.workingDays || '')}</p>
            </div>
            <div>
              <span style="color:#64748b;font-size:0.7rem;text-transform:uppercase;font-weight:bold;">Direct Phone</span>
              <p><a href="${phoneLink}" style="color:#818cf8;text-decoration:none;">${escapeHtml(b.phone || 'None')}</a></p>
            </div>
          </div>

          <div style="margin-top:1rem;">
            <a href="${mapsLink}" target="_blank" class="btn btn-primary btn-block btn-sm">
              ${getIcon('map')} Open Google Maps
            </a>
          </div>
        </div>
      `;
    }

    if (tab === 'reviews') {
      return `
        <!-- Reviews Tab inside Smartphone -->
        <div style="padding:1rem;text-align:center;">
          <h3 style="font-size:1.1rem;font-weight:800;color:#fff;">Customer Reviews</h3>
          <p style="font-size:0.75rem;color:#94a3b8;margin:0.35rem 0 1rem;">We value your honest feedback!</p>

          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:1.25rem;">
            <div style="font-size:1.5rem;color:#fbbf24;margin-bottom:0.35rem;">⭐⭐⭐⭐⭐</div>
            <p style="font-size:0.82rem;font-weight:600;color:#fff;">How was your experience at ${escapeHtml(b.name)}?</p>
            <p style="font-size:0.72rem;color:#94a3b8;margin:0.35rem 0 1rem;">Leave an authentic Google review to help other local customers discover us.</p>
            <a href="${reviewLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm btn-block">
              ${getIcon('star')} Write a Review
            </a>
          </div>
        </div>
      `;
    }
  }

  // 8.11 SAVED BUSINESSES VIEW
  function renderSavedBusinessesView(container) {
    const total = AppState.businesses.length;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('saved')} Saved Businesses (${total})</h1>
            <p class="view-subtitle">Manage, duplicate, export, or create new local business profiles.</p>
          </div>
          <div style="display:flex;gap:0.65rem;">
            <button class="btn btn-outline" onclick="window.App.triggerImportJSON()">
              ${getIcon('download')} Import JSON
            </button>
            <button class="btn btn-primary" onclick="window.App.startNewBusiness()">
              ${getIcon('plus')} + Create New Business
            </button>
          </div>
        </div>
      </div>

      <!-- Search & Category Filters -->
      <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap;">
        <input type="text" id="saved-search-input" class="form-input" style="max-width:320px;" placeholder="Search business name or city..." oninput="window.App.filterSavedBusinesses(this.value)">
      </div>

      <div class="business-grid" id="saved-businesses-grid">
        ${renderSavedBusinessesList(AppState.businesses)}
      </div>
    `;
  }

  function renderSavedBusinessesList(list) {
    if (list.length === 0) {
      return `
        <div class="card" style="grid-column:1/-1;text-align:center;padding:2.5rem;">
          <p style="color:var(--text-secondary);">No businesses match your search.</p>
        </div>
      `;
    }

    return list.map(biz => {
      const isCurr = biz.id === AppState.currentBusinessId;
      const srvCount = biz.services?.length || 0;
      const logoHtml = biz.logo ? `<img src="${biz.logo}" alt="Logo" class="business-card-logo">` : `<div class="business-card-logo">${biz.name.charAt(0)}</div>`;

      return `
        <div class="business-card ${isCurr ? 'active-border' : ''}">
          <div class="business-card-header">
            ${logoHtml}
            <div class="business-card-info">
              <h3>${escapeHtml(biz.name)}</h3>
              <span class="business-badge ${biz.status === 'completed' ? 'badge-success' : 'badge-draft'}">
                ${biz.category || 'General'} • ${biz.status === 'completed' ? 'Kit Ready' : 'Draft'}
              </span>
            </div>
          </div>
          <div class="business-card-meta">
            <div class="business-card-meta-item">
              <span style="display:flex;width:15px;height:15px;">${getIcon('map')}</span>
              <span>${biz.city ? `${escapeHtml(biz.city)}, ${escapeHtml(biz.state || '')}` : 'Location not set'}</span>
            </div>
            <div class="business-card-meta-item">
              <span style="display:flex;width:15px;height:15px;">${getIcon('services')}</span>
              <span>${srvCount} Services / Products</span>
            </div>
          </div>
          <div class="business-card-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.App.selectAndEdit('${biz.id}')">
              ${getIcon('edit')} Edit
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.App.selectAndPreview('${biz.id}')">
              ${getIcon('preview')} Preview
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.App.selectAndKit('${biz.id}')">
              ${getIcon('kit')} Kit
            </button>
            <button class="btn btn-outline btn-sm" title="Duplicate" onclick="window.App.duplicateBusiness('${biz.id}')">
              ${getIcon('duplicate')}
            </button>
            <button class="btn btn-outline btn-sm" title="Export JSON" onclick="window.App.exportBusinessJSON('${biz.id}')">
              ${getIcon('download')}
            </button>
            <button class="btn btn-danger btn-sm" title="Delete" onclick="window.App.confirmDeleteBusiness('${biz.id}')">
              ${getIcon('trash')}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 8.12 EXPORT & DOWNLOAD HUB VIEW
  function renderExportView(container) {
    const b = getCurrentBusiness();
    if (!b) return;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('download')} Export & Download Suite</h1>
            <p class="view-subtitle">Download independent static assets for ${b.name} or deploy to GitHub Pages.</p>
          </div>
        </div>
      </div>

      <div class="form-grid">
        <!-- Standalone Website Package -->
        <div class="card" style="border:1px solid rgba(99,102,241,0.4);">
          <div class="card-header">
            <h3 class="card-title">🌐 Standalone Customer Website</h3>
            <span class="business-badge badge-success">GitHub Pages Ready</span>
          </div>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;">
            Download a single, 100% self-contained HTML file containing the complete digital card, catalogue, contact actions, and maps integration. Works anywhere with zero backend or Node.js!
          </p>
          <button class="btn btn-primary btn-block" onclick="window.App.downloadStandaloneKit()">
            ${getIcon('download')} Download Standalone Website (HTML)
          </button>
        </div>

        <!-- Digital Business Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">💳 Digital Business Card</h3>
          </div>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;">
            Export the interactive smart business card with tap-to-call, WhatsApp deep links, directions, and vCard address book contacts.
          </p>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-secondary btn-block" onclick="window.App.downloadCardHTML()">
              ${getIcon('download')} Card HTML
            </button>
            <button class="btn btn-success btn-block" onclick="window.App.downloadVCard()">
              ${getIcon('download')} Save Contact (.vcf)
            </button>
          </div>
        </div>

        <!-- Catalogue PDF / Print -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📖 Digital Catalogue</h3>
          </div>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;">
            Export the structured service list & price sheet or print it directly to an A4 / letterhead PDF document.
          </p>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-secondary btn-block" onclick="window.App.downloadCatalogueHTML()">
              ${getIcon('download')} Catalogue HTML
            </button>
            <button class="btn btn-outline btn-block" onclick="window.App.printCatalogue()">
              ${getIcon('print')} Print / PDF
            </button>
          </div>
        </div>

        <!-- QR Code & Standee -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🖨️ QR Codes & Table Tent Standee</h3>
          </div>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;">
            Export high-definition PNG QR codes or print the table tent feedback standee card for the shop checkout desk.
          </p>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-secondary btn-block" onclick="window.App.downloadQRImage()">
              ${getIcon('download')} QR Code (PNG)
            </button>
            <button class="btn btn-outline btn-block" onclick="window.App.printReviewStandee()">
              ${getIcon('print')} Print Standee
            </button>
          </div>
        </div>

        <!-- Promotional Graphic -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🎨 Promotional Creative Graphic</h3>
          </div>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;">
            High-resolution canvas-generated promotional graphic ready for Instagram, Facebook, and WhatsApp Status.
          </p>
          <button class="btn btn-primary btn-block" onclick="window.App.downloadPromoCreative()">
            ${getIcon('download')} Download Creative (PNG)
          </button>
        </div>

        <!-- Backup Data JSON -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">💾 Backup & JSON Data</h3>
          </div>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;">
            Backup your business data or export all businesses for restoration on any other device or browser.
          </p>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-outline btn-block" onclick="window.App.exportBusinessJSON('${b.id}')">
              Export Business JSON
            </button>
            <button class="btn btn-outline btn-block" onclick="window.App.exportAllJSON()">
              Backup All JSON
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 8.13 GITHUB PAGES DEPLOYMENT GUIDE VIEW
  function renderGuideView(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-row">
          <div>
            <h1 class="view-title">${getIcon('help')} GitHub Pages Deployment Guide</h1>
            <p class="view-subtitle">How to host this tool and your clients' generated websites 100% free with SSL.</p>
          </div>
        </div>
      </div>

      <div class="card" style="max-width:860px;margin:0 auto;padding:2rem;">
        <h2 style="font-size:1.35rem;font-weight:800;margin-bottom:1rem;color:#818cf8;">
          Deploying to GitHub Pages in 3 Simple Steps
        </h2>

        <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.6;margin-bottom:1.5rem;">
          This entire application is 100% static (HTML, CSS, and vanilla JavaScript). It does not require Node.js, databases, or PHP. You can deploy it to GitHub Pages or host client websites with zero monthly server costs.
        </p>

        <div style="display:flex;flex-direction:column;gap:1.25rem;margin-bottom:2rem;">
          <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:14px;padding:1.25rem;">
            <h3 style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:0.35rem;">
              Step 1: Create a Free GitHub Repository
            </h3>
            <p style="font-size:0.85rem;color:var(--text-secondary);">
              Log in to <a href="https://github.com" target="_blank" style="color:#818cf8;">github.com</a>, click <strong>"New repository"</strong>, name it (e.g., <code>digital-kit-generator</code> or <code>royal-cuts-salon</code>), and set it to <strong>Public</strong>.
            </p>
          </div>

          <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:14px;padding:1.25rem;">
            <h3 style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:0.35rem;">
              Step 2: Upload Files
            </h3>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.5rem;">
              Upload the files:
            </p>
            <ul style="padding-left:1.5rem;font-size:0.85rem;color:var(--text-secondary);line-height:1.5;">
              <li>To host this generator tool: upload <code>index.html</code>, <code>style.css</code>, and <code>script.js</code>.</li>
              <li>To host a customer's website: click <strong>"Download Standalone Website (HTML)"</strong> in the Export Suite, rename the downloaded file to <code>index.html</code>, and upload it to the client's repository!</li>
            </ul>
          </div>

          <div style="background:var(--bg-glass);border:1px solid var(--border-color);border-radius:14px;padding:1.25rem;">
            <h3 style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:0.35rem;">
              Step 3: Enable GitHub Pages
            </h3>
            <p style="font-size:0.85rem;color:var(--text-secondary);">
              In your GitHub repository, go to <strong>Settings</strong> → <strong>Pages</strong>.<br>
              Under <em>"Build and deployment"</em>, select <strong>Source: Deploy from a branch</strong>, choose <strong>main</strong> (or master) branch and <strong>/(root)</strong> folder, then click <strong>Save</strong>.
            </p>
            <div style="margin-top:0.75rem;padding:0.75rem;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;font-size:0.82rem;color:#34d399;">
              🎉 Your website will be live in 60 seconds with free SSL HTTPS at: <code>https://yourusername.github.io/repository-name/</code>!
            </div>
          </div>
        </div>

        <div style="text-align:center;">
          <button class="btn btn-primary" onclick="window.App.switchView('dashboard')">
            ← Return to Dashboard
          </button>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
     9. STANDALONE CUSTOMER WEBSITE GENERATOR (Single File HTML)
     Produces a 100% self-contained website ready for GitHub Pages or sharing!
     ========================================================================== */
  function buildStandaloneHTML(b) {
    const waClean = b.whatsapp ? b.whatsapp.replace(/[^0-9]/g, '') : '';
    const phoneClean = b.phone ? b.phone.replace(/[^0-9+]/g, '') : '';
    const mapsLink = b.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(b.name + ' ' + (b.address || ''))}`;
    const reviewLink = b.gbpUrl || mapsLink;
    const currency = b.currency || '₹';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(b.name)} | Official Digital Portal</title>
  <meta name="description" content="${escapeHtml(b.description || b.name)}">
  <style>
    :root {
      --bg: #090d16;
      --card: #131b2e;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #6366f1;
      --success: #10b981;
      --wa: #25d366;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding-bottom: 70px; -webkit-font-smoothing: antialiased; }
    .container { max-width: 480px; margin: 0 auto; min-height: 100vh; position: relative; background: var(--bg); }
    .cover { height: 140px; width: 100%; background: linear-gradient(135deg, #4338ca, #6366f1); position: relative; overflow: hidden; }
    .cover img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-wrap { margin-top: -45px; padding: 0 1.25rem; display: flex; justify-content: space-between; align-items: flex-end; }
    .avatar { width: 84px; height: 84px; border-radius: 22px; border: 4px solid var(--bg); background: #1e293b; object-fit: cover; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; color: #fff; box-shadow: 0 8px 16px rgba(0,0,0,0.5); }
    .content { padding: 1rem 1.25rem 2rem; }
    h1 { font-size: 1.45rem; font-weight: 800; color: #fff; line-height: 1.2; }
    .category { font-size: 0.85rem; color: #818cf8; font-weight: 600; margin-top: 0.2rem; }
    .desc { font-size: 0.88rem; color: #cbd5e1; line-height: 1.45; margin-top: 0.65rem; }
    .btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin: 1.25rem 0; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 0.5rem; border-radius: 12px; font-size: 0.82rem; font-weight: 700; text-decoration: none; color: #fff; text-align: center; }
    .btn-call { background: var(--success); }
    .btn-wa { background: var(--wa); }
    .btn-map { background: #3b82f6; }
    .btn-review { background: #f59e0b; }
    .info-box { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1rem; margin-bottom: 1.5rem; font-size: 0.84rem; color: var(--muted); }
    .info-row { display: flex; align-items: flex-start; gap: 0.6rem; margin-bottom: 0.5rem; }
    .section-title { font-size: 1.1rem; font-weight: 800; margin-bottom: 0.85rem; color: #fff; }
    .service-card { background: var(--card); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
    .srv-name { font-size: 0.95rem; font-weight: 700; }
    .srv-desc { font-size: 0.78rem; color: var(--muted); margin-top: 0.2rem; }
    .srv-price { font-size: 1.1rem; font-weight: 800; color: #34d399; }
    .btn-book { padding: 0.35rem 0.75rem; background: rgba(37,211,102,0.15); border: 1px solid var(--wa); color: var(--wa); border-radius: 8px; font-size: 0.75rem; font-weight: 700; text-decoration: none; display: inline-block; margin-top: 0.35rem; }
    .sticky-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 60px; background: rgba(15,23,42,0.96); backdrop-filter: blur(12px); border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-around; max-width: 480px; margin: 0 auto; z-index: 50; padding: 0 1rem; }
    .sticky-bar a { flex: 1; margin: 0 4px; padding: 0.6rem; border-radius: 10px; font-size: 0.8rem; font-weight: 700; text-align: center; text-decoration: none; color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="cover">
      ${b.coverPhoto ? `<img src="${b.coverPhoto}" alt="Cover">` : ''}
    </div>

    <div class="avatar-wrap">
      <div class="avatar">
        ${b.logo ? `<img src="${b.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:18px;">` : b.name.charAt(0)}
      </div>
    </div>

    <div class="content">
      <h1>${escapeHtml(b.name)}</h1>
      <div class="category">${escapeHtml(b.category || 'Local Business')} • ${escapeHtml(b.city || '')}</div>
      ${b.description ? `<p class="desc">${escapeHtml(b.description)}</p>` : ''}

      <div class="btn-grid">
        <a href="${phoneClean ? `tel:${phoneClean}` : '#'}" class="btn btn-call">📞 CALL NOW</a>
        <a href="https://wa.me/${waClean}?text=${encodeURIComponent(`Hi ${b.name}, I would like to enquire about your services.`)}" target="_blank" class="btn btn-wa">💬 WHATSAPP</a>
        <a href="${mapsLink}" target="_blank" class="btn btn-map">📍 DIRECTIONS</a>
        <a href="${reviewLink}" target="_blank" class="btn btn-review">⭐ REVIEWS</a>
      </div>

      <div class="info-box">
        ${b.address ? `<div class="info-row">📍 <span>${escapeHtml(b.address)}, ${escapeHtml(b.city || '')}</span></div>` : ''}
        ${b.openingHours ? `<div class="info-row">⏰ <span>${escapeHtml(b.openingHours)} (${escapeHtml(b.workingDays || 'Open')})</span></div>` : ''}
        ${b.phone ? `<div class="info-row">📞 <span>${escapeHtml(b.phone)}</span></div>` : ''}
      </div>

      <div class="section-title">Services & Pricing</div>
      ${(b.services || []).map(s => `
        <div class="service-card">
          <div style="flex:1;">
            <div class="srv-name">${escapeHtml(s.name)}</div>
            ${s.description ? `<div class="srv-desc">${escapeHtml(s.description)}</div>` : ''}
            <a href="https://wa.me/${waClean}?text=${encodeURIComponent(`Hi, I want to book ${s.name} (${currency}${s.price}) at ${b.name}`)}" target="_blank" class="btn-book">💬 Book on WhatsApp</a>
          </div>
          <div style="text-align:right;margin-left:1rem;">
            <div class="srv-price">${currency}${s.price}</div>
            ${s.oldPrice ? `<div style="font-size:0.75rem;color:var(--muted);text-decoration:line-through;">${currency}${s.oldPrice}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="sticky-bar">
      <a href="${phoneClean ? `tel:${phoneClean}` : '#'}" style="background:var(--success);">Call Now</a>
      <a href="https://wa.me/${waClean}" style="background:var(--wa);">WhatsApp</a>
      <a href="${mapsLink}" style="background:#3b82f6;">Directions</a>
    </div>
  </div>
</body>
</html>`;
  }

  /* ==========================================================================
     10. FILE DOWNLOAD UTILITIES & ACTIONS
     ========================================================================== */
  function downloadFile(content, fileName, mimeType = "text/plain") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded: ${fileName}`, "success");
  }

  function downloadCanvasAsImage(canvas, filename) {
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloaded: ${filename}`, "success");
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updateStorageStatusIndicator() {
    const count = AppState.businesses.length;
    const el = document.getElementById('storage-business-count');
    if (el) el.textContent = `${count} ${count === 1 ? 'Business' : 'Businesses'} Saved`;
  }

  function updateBusinessSwitcher() {
    const select = document.getElementById('sidebar-business-select');
    if (!select) return;
    select.innerHTML = AppState.businesses.map(biz => `
      <option value="${biz.id}" ${biz.id === AppState.currentBusinessId ? 'selected' : ''}>
        ${escapeHtml(biz.name)}
      </option>
    `).join('');
  }

  /* ==========================================================================
     11. PUBLIC APPLICATION CONTROLLER (Attached to window.App)
     ========================================================================== */
  window.App = {
    // Nav & View
    switchView: function (view) {
      switchView(view);
    },

    toggleMobileMenu: function () {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('mobile-open');
    },

    handleBusinessSwitch: function (businessId) {
      AppState.currentBusinessId = businessId;
      renderActiveView();
      showToast("Switched business.", "info");
    },

    // Business CRUD
    startNewBusiness: function () {
      const id = "biz-" + Date.now();
      const newBiz = {
        id: id,
        name: "New Local Business",
        category: "Salon",
        ownerName: "",
        phone: "",
        whatsapp: "",
        email: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        openingHours: "09:00 AM - 08:00 PM",
        workingDays: "Mon - Sat",
        description: "",
        tagline: "",
        mapsUrl: "",
        gbpUrl: "",
        instagram: "",
        facebook: "",
        youtube: "",
        website: "",
        currency: "₹",
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        logo: "",
        coverPhoto: "",
        galleryPhotos: [],
        customCategories: ["General"],
        services: []
      };

      AppState.businesses.unshift(newBiz);
      AppState.currentBusinessId = id;
      AppState.formStep = 1;
      saveToStorage();
      switchView('business-form');
      showToast("Created new business draft. Enter details below.", "success");
    },

    loadDemoAgain: function () {
      const exists = AppState.businesses.some(b => b.id === DEMO_BUSINESS.id);
      if (!exists) {
        AppState.businesses.unshift(JSON.parse(JSON.stringify(DEMO_BUSINESS)));
      }
      AppState.currentBusinessId = DEMO_BUSINESS.id;
      saveToStorage();
      switchView('dashboard');
      showToast("Demo 'Royal Cuts Salon' loaded.", "success");
    },

    selectAndEdit: function (id) {
      AppState.currentBusinessId = id;
      AppState.formStep = 1;
      switchView('business-form');
    },

    selectAndPreview: function (id) {
      AppState.currentBusinessId = id;
      switchView('preview');
    },

    selectAndKit: function (id) {
      AppState.currentBusinessId = id;
      switchView('kit');
    },

    duplicateBusiness: function (id) {
      const original = AppState.businesses.find(b => b.id === id);
      if (!original) return;
      const clone = JSON.parse(JSON.stringify(original));
      clone.id = "biz-" + Date.now();
      clone.name = clone.name + " (Copy)";
      clone.createdAt = new Date().toISOString();
      clone.updatedAt = new Date().toISOString();
      AppState.businesses.unshift(clone);
      AppState.currentBusinessId = clone.id;
      saveToStorage();
      renderActiveView();
      showToast(`Duplicated: ${clone.name}`, "success");
    },

    confirmDeleteBusiness: function (id) {
      const biz = AppState.businesses.find(b => b.id === id);
      if (!biz) return;
      showConfirmModal(
        "Delete Business?",
        `Are you sure you want to permanently delete "${biz.name}"? This action cannot be undone.`,
        "Delete Forever",
        () => {
          AppState.businesses = AppState.businesses.filter(b => b.id !== id);
          if (AppState.currentBusinessId === id) {
            AppState.currentBusinessId = AppState.businesses[0]?.id || null;
          }
          saveToStorage();
          closeConfirmModal();
          renderActiveView();
          showToast(`Deleted ${biz.name}`, "info");
        }
      );
    },

    // Stepper Form Actions
    setFormStep: function (step) {
      this.saveFormInputsToState();
      AppState.formStep = step;
      renderActiveView();
    },

    nextFormStep: function () {
      this.saveFormInputsToState();
      const b = getCurrentBusiness();
      if (AppState.formStep === 1 && (!b.name || !b.name.trim())) {
        showToast("Business Name is required.", "error");
        document.getElementById('f-name')?.focus();
        return;
      }
      AppState.formStep = Math.min(AppState.formStep + 1, 3);
      renderActiveView();
    },

    saveFormInputsToState: function () {
      const b = getCurrentBusiness();
      if (!b) return;

      const fName = document.getElementById('f-name');
      if (fName) b.name = fName.value.trim();

      const fCat = document.getElementById('f-category');
      if (fCat) b.category = fCat.value;

      const fOwner = document.getElementById('f-owner');
      if (fOwner) b.ownerName = fOwner.value.trim();

      const fPhone = document.getElementById('f-phone');
      if (fPhone) b.phone = fPhone.value.trim();

      const fWa = document.getElementById('f-whatsapp');
      if (fWa) b.whatsapp = fWa.value.trim();

      const fEmail = document.getElementById('f-email');
      if (fEmail) b.email = fEmail.value.trim();

      const fAddr = document.getElementById('f-address');
      if (fAddr) b.address = fAddr.value.trim();

      const fCity = document.getElementById('f-city');
      if (fCity) b.city = fCity.value.trim();

      const fState = document.getElementById('f-state');
      if (fState) b.state = fState.value.trim();

      const fPin = document.getElementById('f-pincode');
      if (fPin) b.pincode = fPin.value.trim();

      const fHours = document.getElementById('f-hours');
      if (fHours) b.openingHours = fHours.value.trim();

      const fDays = document.getElementById('f-days');
      if (fDays) b.workingDays = fDays.value.trim();

      const fTag = document.getElementById('f-tagline');
      if (fTag) b.tagline = fTag.value.trim();

      const fDesc = document.getElementById('f-desc');
      if (fDesc) b.description = fDesc.value.trim();

      const fMaps = document.getElementById('f-maps');
      if (fMaps) b.mapsUrl = fMaps.value.trim();

      const fGbp = document.getElementById('f-gbp');
      if (fGbp) b.gbpUrl = fGbp.value.trim();

      const fIg = document.getElementById('f-instagram');
      if (fIg) b.instagram = fIg.value.trim();

      const fFb = document.getElementById('f-facebook');
      if (fFb) b.facebook = fFb.value.trim();

      const fYt = document.getElementById('f-youtube');
      if (fYt) b.youtube = fYt.value.trim();

      const fWeb = document.getElementById('f-website');
      if (fWeb) b.website = fWeb.value.trim();

      b.updatedAt = new Date().toISOString();
      saveToStorage();
    },

    saveBusinessForm: function (isFinal) {
      this.saveFormInputsToState();
      const b = getCurrentBusiness();
      if (!b.name || !b.name.trim()) {
        showToast("Business Name is required.", "error");
        document.getElementById('f-name')?.focus();
        return;
      }
      showToast("Business details saved.", "success");
      if (isFinal) {
        switchView('services');
      }
    },

    // Services Actions
    setServiceCategoryFilter: function (cat) {
      AppState.serviceCategoryFilter = cat;
      renderActiveView();
    },

    openAddServiceModal: function () {
      const b = getCurrentBusiness();
      if (!b) return;
      this.openServiceModal(null);
    },

    editService: function (srvId) {
      const b = getCurrentBusiness();
      const srv = b.services.find(s => s.id === srvId);
      if (srv) this.openServiceModal(srv);
    },

    duplicateService: function (srvId) {
      const b = getCurrentBusiness();
      const srv = b.services.find(s => s.id === srvId);
      if (!srv) return;
      const clone = JSON.parse(JSON.stringify(srv));
      clone.id = "srv-" + Date.now();
      clone.name = clone.name + " (Copy)";
      b.services.push(clone);
      saveToStorage();
      renderActiveView();
      showToast(`Duplicated: ${clone.name}`, "success");
    },

    deleteService: function (srvId) {
      const b = getCurrentBusiness();
      b.services = b.services.filter(s => s.id !== srvId);
      saveToStorage();
      renderActiveView();
      showToast("Service deleted.", "info");
    },

    openServiceModal: function (srv) {
      const b = getCurrentBusiness();
      const isEdit = !!srv;
      const categories = Array.from(new Set([...(b.customCategories || []), "General"]));

      const modalHtml = `
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Service' : 'Add New Service / Product'}</h3>
          <button class="modal-close" onclick="window.App.closeModal()">✕</button>
        </div>
        <form onsubmit="event.preventDefault(); window.App.saveServiceModal('${srv ? srv.id : ''}');" class="modal-body">
          <div class="form-group">
            <label class="form-label">Service / Product Name <span class="required">*</span></label>
            <input type="text" id="srv-modal-name" class="form-input" required value="${srv ? escapeHtml(srv.name) : ''}" placeholder="e.g. Haircut Classic">
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="srv-modal-cat" class="form-select">
              ${categories.map(c => `<option value="${c}" ${srv && srv.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Price (${b.currency || '₹'}) <span class="required">*</span></label>
              <input type="number" id="srv-modal-price" class="form-input" required value="${srv ? srv.price : ''}" placeholder="199">
            </div>
            <div class="form-group">
              <label class="form-label">Old Price (Strike-through)</label>
              <input type="number" id="srv-modal-oldprice" class="form-input" value="${srv && srv.oldPrice ? srv.oldPrice : ''}" placeholder="249">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Description (Optional)</label>
            <textarea id="srv-modal-desc" class="form-textarea" rows="2" placeholder="Brief details about what is included...">${srv && srv.description ? escapeHtml(srv.description) : ''}</textarea>
          </div>
          <div class="modal-footer" style="padding:1rem 0 0;margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : '+ Add Service'}</button>
          </div>
        </form>
      `;

      const modalBox = document.getElementById('general-modal-box');
      if (modalBox) {
        modalBox.innerHTML = modalHtml;
        document.getElementById('general-modal').classList.add('open');
      }
    },

    saveServiceModal: function (srvId) {
      const b = getCurrentBusiness();
      const name = document.getElementById('srv-modal-name').value.trim();
      const cat = document.getElementById('srv-modal-cat').value;
      const price = Number(document.getElementById('srv-modal-price').value) || 0;
      const oldPriceVal = document.getElementById('srv-modal-oldprice').value;
      const oldPrice = oldPriceVal ? Number(oldPriceVal) : null;
      const desc = document.getElementById('srv-modal-desc').value.trim();

      if (!name) return;

      if (srvId) {
        const item = b.services.find(s => s.id === srvId);
        if (item) {
          item.name = name;
          item.category = cat;
          item.price = price;
          item.oldPrice = oldPrice;
          item.description = desc;
        }
      } else {
        b.services.push({
          id: "srv-" + Date.now(),
          name: name,
          category: cat,
          price: price,
          oldPrice: oldPrice,
          description: desc,
          image: ""
        });
      }

      saveToStorage();
      this.closeModal();
      renderActiveView();
      showToast(srvId ? "Service updated." : "Service added.", "success");
    },

    openCustomCategoryModal: function () {
      const modalHtml = `
        <div class="modal-header">
          <h3>Add Custom Category</h3>
          <button class="modal-close" onclick="window.App.closeModal()">✕</button>
        </div>
        <form onsubmit="event.preventDefault(); window.App.saveCustomCategory();" class="modal-body">
          <div class="form-group">
            <label class="form-label">Category Name</label>
            <input type="text" id="custom-cat-input" class="form-input" required placeholder="e.g. Combos, Bridal, Specials...">
          </div>
          <div class="modal-footer" style="padding:1rem 0 0;margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">+ Add Category</button>
          </div>
        </form>
      `;
      const modalBox = document.getElementById('general-modal-box');
      if (modalBox) {
        modalBox.innerHTML = modalHtml;
        document.getElementById('general-modal').classList.add('open');
      }
    },

    saveCustomCategory: function () {
      const input = document.getElementById('custom-cat-input');
      const val = input ? input.value.trim() : '';
      if (!val) return;
      const b = getCurrentBusiness();
      if (!b.customCategories) b.customCategories = [];
      if (!b.customCategories.includes(val)) {
        b.customCategories.push(val);
        saveToStorage();
      }
      this.closeModal();
      renderActiveView();
      showToast(`Category "${val}" added.`, "success");
    },

    closeModal: function () {
      document.getElementById('general-modal')?.classList.remove('open');
    },

    // Photos Actions
    handleLogoUpload: function (input) {
      if (!input.files || !input.files[0]) return;
      compressImage(input.files[0], 500, 0.85).then(dataUrl => {
        const b = getCurrentBusiness();
        b.logo = dataUrl;
        saveToStorage();
        renderActiveView();
        showToast("Logo updated.", "success");
      }).catch(err => {
        showToast("Error reading image file.", "error");
      });
    },

    removeLogo: function () {
      const b = getCurrentBusiness();
      b.logo = "";
      saveToStorage();
      renderActiveView();
      showToast("Logo removed.", "info");
    },

    handleCoverUpload: function (input) {
      if (!input.files || !input.files[0]) return;
      compressImage(input.files[0], 1000, 0.82).then(dataUrl => {
        const b = getCurrentBusiness();
        b.coverPhoto = dataUrl;
        saveToStorage();
        renderActiveView();
        showToast("Cover banner updated.", "success");
      }).catch(() => {
        showToast("Error processing cover photo.", "error");
      });
    },

    removeCoverPhoto: function () {
      const b = getCurrentBusiness();
      b.coverPhoto = "";
      saveToStorage();
      renderActiveView();
      showToast("Cover photo removed.", "info");
    },

    handleGalleryUpload: function (input) {
      if (!input.files || input.files.length === 0) return;
      const files = Array.from(input.files);
      const b = getCurrentBusiness();
      if (!b.galleryPhotos) b.galleryPhotos = [];

      Promise.all(files.map(f => compressImage(f, 800, 0.8))).then(results => {
        b.galleryPhotos.push(...results);
        saveToStorage();
        renderActiveView();
        showToast(`Uploaded ${results.length} photos.`, "success");
      }).catch(() => {
        showToast("Error processing photos.", "error");
      });
    },

    removeGalleryPhoto: function (index) {
      const b = getCurrentBusiness();
      if (b.galleryPhotos && b.galleryPhotos[index]) {
        b.galleryPhotos.splice(index, 1);
        saveToStorage();
        renderActiveView();
        showToast("Photo removed.", "info");
      }
    },

    // QR Actions
    handleQRTargetChange: function (val) {
      AppState.qrSettings.target = val;
      renderActiveView();
    },

    updateQRCustomUrl: function (url) {
      AppState.qrSettings.customUrl = url;
      const canvas = document.getElementById('qr-live-canvas');
      if (canvas) {
        renderQRCodeToCanvas(url || 'https://google.com', canvas, {
          size: 220,
          fgColor: AppState.qrSettings.fgColor,
          bgColor: AppState.qrSettings.bgColor
        });
      }
    },

    updateQRColors: function (fg, bg) {
      if (fg) AppState.qrSettings.fgColor = fg;
      if (bg) AppState.qrSettings.bgColor = bg;
      const b = getCurrentBusiness();
      const url = getQRTargetUrl(b, AppState.qrSettings.target);
      const canvas = document.getElementById('qr-live-canvas');
      if (canvas) {
        renderQRCodeToCanvas(url, canvas, {
          size: 220,
          fgColor: AppState.qrSettings.fgColor,
          bgColor: AppState.qrSettings.bgColor
        });
      }
    },

    downloadQRImage: function () {
      const b = getCurrentBusiness();
      const url = getQRTargetUrl(b, AppState.qrSettings.target);
      const tempCanvas = document.createElement('canvas');
      renderQRCodeToCanvas(url, tempCanvas, {
        size: 1000, // High-res
        fgColor: AppState.qrSettings.fgColor,
        bgColor: AppState.qrSettings.bgColor,
        padding: 40
      });
      downloadCanvasAsImage(tempCanvas, `${(b.name || 'business').replace(/\s+/g, '_')}_QR.png`);
    },

    printReviewStandee: function () {
      window.print();
    },

    // Promo Creative Actions
    setPromoRatio: function (ratio) {
      AppState.promoSettings.ratio = ratio;
      renderActiveView();
    },

    setPromoTemplate: function (tpl) {
      AppState.promoSettings.template = tpl;
      renderActiveView();
    },

    setPromoTheme: function (theme) {
      AppState.promoSettings.theme = theme;
      renderPromoCanvas();
    },

    selectPromoService: function (srvId) {
      AppState.promoSettings.serviceId = srvId;
      const b = getCurrentBusiness();
      const srv = b.services.find(s => s.id === srvId);
      if (srv) {
        AppState.promoSettings.customHeadline = srv.name;
        AppState.promoSettings.customPrice = `${b.currency || '₹'}${srv.price}`;
      }
      renderActiveView();
    },

    updatePromoHeadline: function (val) {
      AppState.promoSettings.customHeadline = val;
      renderPromoCanvas();
    },

    updatePromoPrice: function (val) {
      AppState.promoSettings.customPrice = val;
      renderPromoCanvas();
    },

    updatePromoCta: function (val) {
      AppState.promoSettings.customCta = val;
      renderPromoCanvas();
    },

    downloadPromoCreative: function () {
      const b = getCurrentBusiness();
      const canvas = document.getElementById('promo-canvas');
      if (canvas) {
        downloadCanvasAsImage(canvas, `${(b.name || 'promo').replace(/\s+/g, '_')}_promo.png`);
      }
    },

    // Business Kit Flow
    runKitGeneration: function () {
      const b = getCurrentBusiness();
      if (!b) return;

      showToast("Compiling complete digital kit...", "info");
      setTimeout(() => {
        b.status = "completed";
        b.updatedAt = new Date().toISOString();
        saveToStorage();
        renderActiveView();
        showToast("🎉 Business Kit Complete & Ready to Deliver!", "success");
      }, 700);
    },

    printDeliverableReport: function () {
      window.print();
    },

    downloadStandaloneKit: function () {
      const b = getCurrentBusiness();
      if (!b) return;
      const html = buildStandaloneHTML(b);
      downloadFile(html, `${(b.name || 'business').replace(/\s+/g, '_')}_website.html`, "text/html");
    },

    downloadCardHTML: function () {
      const b = getCurrentBusiness();
      if (!b) return;
      const html = buildStandaloneHTML(b);
      downloadFile(html, `${(b.name || 'business').replace(/\s+/g, '_')}_digital_card.html`, "text/html");
    },

    downloadCatalogueHTML: function () {
      const b = getCurrentBusiness();
      if (!b) return;
      const html = buildStandaloneHTML(b);
      downloadFile(html, `${(b.name || 'business').replace(/\s+/g, '_')}_catalogue.html`, "text/html");
    },

    printCatalogue: function () {
      window.print();
    },

    downloadVCard: function () {
      const b = getCurrentBusiness();
      if (!b) return;

      const vcard = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${b.name || 'Business'}`,
        `ORG:${b.name || ''}`,
        `TITLE:${b.ownerName ? `Owner: ${b.ownerName}` : (b.category || '')}`,
        `TEL;TYPE=CELL,VOICE:${b.phone || ''}`,
        `EMAIL:${b.email || ''}`,
        `ADR;TYPE=WORK:;;${b.address || ''};${b.city || ''};${b.state || ''};${b.pincode || ''};India`,
        `NOTE:${b.description || ''}`,
        `URL:${b.website || b.mapsUrl || ''}`,
        "END:VCARD"
      ].join("\r\n");

      downloadFile(vcard, `${(b.name || 'business').replace(/\s+/g, '_')}.vcf`, "text/vcard");
    },

    shareCardLink: function () {
      const b = getCurrentBusiness();
      const shareData = {
        title: b.name,
        text: `${b.name} - ${b.tagline || 'Check out our digital card & catalogue!'}`,
        url: window.location.href
      };

      if (navigator.share) {
        navigator.share(shareData).catch(() => {});
      } else {
        navigator.clipboard?.writeText(window.location.href);
        showToast("Link copied to clipboard!", "success");
      }
    },

    // Phone Preview Tab Action
    setPhoneTab: function (tab) {
      AppState.previewTab = tab;
      renderActiveView();
    },

    openStandalonePreviewInWindow: function () {
      const b = getCurrentBusiness();
      if (!b) return;
      const html = buildStandaloneHTML(b);
      const newWin = window.open();
      if (newWin) {
        newWin.document.write(html);
        newWin.document.close();
      }
    },

    // Saved Search Filter
    filterSavedBusinesses: function (query) {
      const grid = document.getElementById('saved-businesses-grid');
      if (!grid) return;
      const q = query.toLowerCase();
      const filtered = AppState.businesses.filter(b => {
        return (b.name && b.name.toLowerCase().includes(q)) ||
               (b.city && b.city.toLowerCase().includes(q)) ||
               (b.category && b.category.toLowerCase().includes(q));
      });
      grid.innerHTML = renderSavedBusinessesList(filtered);
    },

    // JSON Export & Import
    exportBusinessJSON: function (id) {
      const b = AppState.businesses.find(item => item.id === id);
      if (!b) return;
      const json = JSON.stringify(b, null, 2);
      downloadFile(json, `${b.name.replace(/\s+/g, '_')}_data.json`, "application/json");
    },

    exportAllJSON: function () {
      const json = JSON.stringify(AppState.businesses, null, 2);
      downloadFile(json, `LocalBiz_DigitalKits_Backup_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    },

    triggerImportJSON: function () {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            if (Array.isArray(data)) {
              AppState.businesses.push(...data);
            } else if (data && data.name) {
              data.id = "biz-" + Date.now();
              AppState.businesses.unshift(data);
              AppState.currentBusinessId = data.id;
            }
            saveToStorage();
            renderActiveView();
            showToast("Imported successfully!", "success");
          } catch (err) {
            showToast("Invalid JSON file.", "error");
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
  };

  /* ==========================================================================
     12. INITIALIZATION ON DOM READY
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Load data from localStorage
    loadFromStorage();

    // 2. Setup Confirm Modal listeners
    document.getElementById('modal-cancel-btn')?.addEventListener('click', closeConfirmModal);
    document.getElementById('modal-close-icon')?.addEventListener('click', closeConfirmModal);
    document.getElementById('modal-confirm-btn')?.addEventListener('click', () => {
      if (modalConfirmCallback) modalConfirmCallback();
    });

    // 3. Render initial view
    renderActiveView();
  });

})();
