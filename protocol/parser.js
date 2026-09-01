window.DM40Parser = (() => {
  const P = window.DM40Protocol;
  const scales = {
    V: { 4: [0.6, "mV", 1000, 2], 8: [6, "V", 1, 4], 0x18: [6, "V", 1, 4], 0x16: [60, "V", 1, 3], 0x14: [600, "V", 1, 2], 0x12: [6000, "V", 1, 1] },
    A: { 4: [600e-6, "uA", 1e6, 2], 2: [6000e-6, "uA", 1e6, 1], 0x16: [60e-3, "mA", 1e3, 3], 0x14: [600e-3, "mA", 1e3, 2], 0x28: [6, "A", 1, 4], 0x26: [60, "A", 1, 3] },
    R: { 4: [600, "Ω", 1, 2], 2: [6000, "Ω", 1, 1], 0x18: [6000, "kΩ", .001, 4], 0x16: [60000, "kΩ", .001, 3], 0x14: [600000, "kΩ", .001, 2], 0x28: [6e6, "MΩ", 1e-6, 4], 0x26: [6e7, "MΩ", 1e-6, 3] },
    F: { 6: [60, "Hz", 1, 3], 4: [600, "Hz", 1, 2], 2: [6000, "Hz", 1, 1], 0x18: [6000, "kHz", .001, 4], 0x16: [60000, "kHz", .001, 3], 0x14: [600000, "kHz", .001, 2] },
    C: { 6: [6e-9, "nF", 1e9, 3], 4: [60e-9, "nF", 1e9, 2], 2: [600e-9, "nF", 1e9, 1], 0x16: [6e-6, "uF", 1e6, 3], 0x14: [60e-6, "uF", 1e6, 2], 0x12: [600e-6, "uF", 1e6, 1] }
  };

  function scaleFor(kind, flag) {
    const key = flag & 0xfe;
    if (kind === "FREQ") return scales.F[key];
    if (kind === "CAP") return scales.C[key];
    if (kind.startsWith("V") || kind === "DIODE") return scales.V[key];
    if (kind.startsWith("A")) return scales.A[key];
    if (["RES", "RES_ONLINE", "CONT"].includes(kind)) return scales.R[key];
    if (kind === "TEMP") return [6000, "℃", 1, 1];
    return null;
  }

  function slot(slot, counts, flag, kind) {
    if (counts === 0xffff) return { text: "OL", unit: "" };
    if (slot === "DUTY") return { text: (counts * .1).toFixed(1), unit: "%" };
    if (slot === "FREQ") return { text: String(counts), unit: "Hz" };
    if (slot === "TC") return { text: (counts * .1).toFixed(1), unit: "C" };
    const info = scaleFor(kind, flag);
    if (!info) return { text: "", unit: "" };
    const [fullScale, unit, mul, decimals] = info;
    const sign = flag & 1 ? -1 : 1;
    return { text: (sign * counts * fullScale / 60000 * mul).toFixed(decimals), unit };
  }

  function parse(data) {
    const result = { valid: false, raw: data, mode: "---", range: "", value: "---", unit: "", status: "" };
    if (data.length < 16 || !P.HEADER.every((v, i) => data[i] === v)) return result;
    const flag = data[5];
    const info = P.FLAG_INFO[flag];
    if (!info) return result;
    const [kind, range] = info;
    const m1 = data[14] | (data[15] << 8);
    // The final byte is CRC. Keep the original parser's negative offsets:
    // M1 scale is data[-8], which is index 9 in the 17-byte packet.
    const m1ScaleFlag = data[data.length - 8];
    const scale = scaleFor(kind, m1ScaleFlag);
    if (!scale) return result;
    const [fullScale, unit, mul, decimals] = scale;
    result.valid = true;
    result.mode = kind;
    result.range = range;
    result.unit = unit;
    const sign = m1ScaleFlag & 1 ? -1 : 1;
    result.normValue = m1 === 0xffff ? null : sign * m1 * fullScale / 60000;
    result.value = m1 === 0xffff ? "OL" : (m1 * fullScale / 60000 * mul * sign).toFixed(decimals);
    const status = data[6];
    result.battery = status & 7;
    result.charging = (status & 8) !== 0;
    result.hold = (status & 0x80) !== 0;
    return result;
  }
  return { parse };
})();
