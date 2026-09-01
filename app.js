const SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const NOTIFY_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";
const WRITE_UUID = "0000fff3-0000-1000-8000-00805f9b34fb";

// DM40 command prefixes. The final checksum byte is added before writing.
const CMD_ID = [0xaf, 0x05, 0x03, 0x08, 0x00];
const CMD_READ = [0xaf, 0x05, 0x03, 0x09, 0x00];

let device = null;
let server = null;
let notifyCharacteristic = null;
let writeCharacteristic = null;
let pollTimer = null;
let waitingForPacket = false;
let selectedDevice = null;
let pendingCommand = null;

const $ = (id) => document.getElementById(id);
const scanButton = $("scanButton");
const disconnectButton = $("disconnectButton");
const languageButton = $("languageButton");
const rawLog = $("rawLog");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const waveformCanvas = $("waveformCanvas");
const waveformContext = waveformCanvas.getContext("2d");
const waveformSamples = [];
const WAVEFORM_SAMPLE_SPACING = 3;
const WAVEFORM_GRID_SIZE = 36;
let waveformCapacity = 240;
let waveformDrawPending = false;
const modeGroups = {
  V: [{ mode: "VDC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x30] }, { mode: "VAC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x70] }, { mode: "VDC+AC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0xb0] }],
  A: [{ mode: "ADC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x39] }, { mode: "AAC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x79] }, { mode: "ADC+AC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0xb9] }],
  R: [{ mode: "RES", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x32] }, { mode: "RES_ONLINE", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x72] }],
  C: [{ mode: "CAP", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x03] }],
  D: [{ mode: "DIODE", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x04] }, { mode: "CONT", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x44] }],
  F: [{ mode: "FREQ", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x05] }, { mode: "TEMP", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x45] }]
};
const translations = {
  zh: {
    eyebrow: "DM40 网页上位机", appTitle: "DM40 蓝牙控制台",
    scan: "扫描设备", disconnect: "断开", deviceInfo: "设备信息", measurement: "测量值",
    waveform: "实时波形", rawPackets: "原始数据", clear: "清空", expand: "展开", collapse: "收起",
    connected: "已连接", disconnected: "未连接", ready: "页面已就绪，请点击“扫描设备”。",
    secureContext: "当前页面不是安全上下文。请使用 GitHub Pages HTTPS 或 localhost，不要直接用 file:// 打开。",
    noBluetooth: "当前 Edge 没有 Web Bluetooth API。请使用桌面版 Edge，并检查浏览器策略是否禁用了 Web Bluetooth。",
    selectDevice: "请选择蓝牙设备（例如 dm40x）...", selectedDevice: "已选择 {name}，正在连接...",
    connectingInfo: "已连接，正在请求设备信息...", selectFirst: "请先扫描并选择一个 DM40 设备。",
    connectFailed: "连接失败：{error}", scanFailed: "扫描失败：{error}", sendFailed: "发送失败：{error}", parseFailed: "数据解析失败：{error}", modeFailed: "模式切换失败：{error}",
    battery: "电量 {value}/5", charging: "充电", rawWaiting: "等待连接设备...",
    modes: { VDC: "直流电压", VAC: "交流电压", "VDC+AC": "交直流电压", ADC: "直流电流", AAC: "交流电流", "ADC+AC": "交直流电流", RES: "电阻", RES_ONLINE: "在线电阻", CAP: "电容", DIODE: "二极管", CONT: "通断", FREQ: "频率", TEMP: "℃" },
    defaults: { V: "直流电压", A: "直流电流", R: "电阻", C: "电容", D: "二极管", F: "频率" }
  },
  en: {
    eyebrow: "DM40 WEB HOST", appTitle: "DM40 Bluetooth Console",
    scan: "Scan device", disconnect: "Disconnect", deviceInfo: "Device", measurement: "Measurement",
    waveform: "Live waveform", rawPackets: "Raw packets", clear: "Clear", expand: "Expand", collapse: "Collapse",
    connected: "Connected", disconnected: "Disconnected", ready: "Ready. Click Scan device to connect.",
    secureContext: "This page is not a secure context. Use GitHub Pages HTTPS or localhost, not file://.",
    noBluetooth: "Web Bluetooth is unavailable in this Edge environment. Use desktop Edge and check browser policy.",
    selectDevice: "Choose a Bluetooth device (for example dm40x)...", selectedDevice: "Selected {name}. Connecting...",
    connectingInfo: "Connected. Requesting device information...", selectFirst: "Scan and select a DM40 device first.",
    connectFailed: "Connection failed: {error}", scanFailed: "Scan failed: {error}", sendFailed: "Send failed: {error}", parseFailed: "Packet parse failed: {error}", modeFailed: "Mode change failed: {error}",
    battery: "Battery {value}/5", charging: "Charging", rawWaiting: "Waiting for a device connection...",
    modes: { VDC: "VDC", VAC: "VAC", "VDC+AC": "VDC+AC", ADC: "ADC", AAC: "AAC", "ADC+AC": "ADC+AC", RES: "Ω", RES_ONLINE: "Ωon", CAP: "-||-", DIODE: "DIODE", CONT: "CONT", FREQ: "Hz", TEMP: "℃" },
    defaults: { V: "VDC", A: "ADC", R: "Ω", C: "-||-", D: "DIODE", F: "Hz" }
  }
};
let language = "zh";
let messageState = { key: "ready", values: {}, isError: false };
let lastMeasurementStatus = null;

function t(key, values = {}) {
  const template = translations[language][key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => values[name] ?? "");
}

function setConnectionState(connected) {
  $("connectionState").textContent = t(connected ? "connected" : "disconnected");
  $("connectionState").dataset.state = connected ? "online" : "offline";
}

function setMessageKey(key, values = {}, isError = false) {
  messageState = { key, values, isError };
  setMessage(t(key, values), isError);
}

function applyTranslations() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = language === "zh" ? "DM40 Web Bluetooth" : "DM40 Web Bluetooth";
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  languageButton.textContent = language === "zh" ? "EN" : "中";
  setConnectionState(Boolean(device?.gatt?.connected));
  renderBatteryStatus();
  if (rawLog.dataset.waiting === "true") rawLog.textContent = t("rawWaiting");
  renderMeasurementStatus();
  setMessage(t(messageState.key, messageState.values), messageState.isError);
  setModeButtons(window.currentMode);
  document.querySelectorAll("[data-collapse-target]").forEach((button) => {
    button.textContent = t($(button.dataset.collapseTarget).hidden ? "expand" : "collapse");
  });
}

function formatBytes(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function commandFrame(prefix) {
  const checksum = (-prefix.reduce((sum, value) => sum + value, 0)) & 0xff;
  return new Uint8Array([...prefix, checksum]);
}

function log(line) {
  const followTail = rawLog.scrollHeight - rawLog.scrollTop - rawLog.clientHeight < 4;
  if (rawLog.dataset.waiting === "true") {
    rawLog.textContent = "";
    rawLog.dataset.waiting = "false";
  }
  rawLog.textContent += `${new Date().toLocaleTimeString()}  ${line}\n`;
  if (followTail) rawLog.scrollTop = rawLog.scrollHeight;
}

function setMessage(message, isError = false) {
  const element = $("message");
  element.textContent = message;
  element.style.color = isError ? "#ff7d7d" : "#ffbf72";
}

function renderMeasurementStatus() {
  if (!lastMeasurementStatus) {
    $("statusValue").textContent = "--";
    return;
  }
  $("statusValue").textContent = lastMeasurementStatus.hold ? "HOLD" : "--";
}

function renderBatteryStatus() {
  const value = window.lastBattery == null ? "--" : window.lastBattery;
  const charging = lastMeasurementStatus?.charging ? ` · ${t("charging")}` : "";
  $("batteryStatus").textContent = `${t("battery", { value })}${charging}`;
}

function setModeButtons(activeMode) {
  for (const button of modeButtons) {
    const options = modeGroups[button.dataset.modeGroup] || [];
    const active = options.some((option) => option.mode === activeMode);
    const current = options.find((option) => option.mode === activeMode) || options[0];
    button.classList.toggle("active", active);
    if (current) button.textContent = translations[language].modes[current.mode] || current.mode;
  }
}

function drawWaveform() {
  const width = waveformCanvas.clientWidth || 1;
  const height = waveformCanvas.clientHeight || 240;
  const ctx = waveformContext;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(174, 182, 191, .22)";
  ctx.lineWidth = 1;
  const gridSize = WAVEFORM_GRID_SIZE;
  for (let y = gridSize; y < height; y += gridSize) {
    const lineY = Math.round(y) + .5;
    ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(width, lineY); ctx.stroke();
  }
  for (let x = gridSize; x < width; x += gridSize) {
    const lineX = Math.round(x) + .5;
    ctx.beginPath(); ctx.moveTo(lineX, 0); ctx.lineTo(lineX, height); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(174, 182, 191, .5)";
  ctx.strokeRect(.5, .5, Math.max(0, width - 1), Math.max(0, height - 1));
  if (waveformSamples.length < 2) return;
  const lo = Math.min(...waveformSamples);
  const hi = Math.max(...waveformSamples);
  const pad = Math.max((hi - lo) * .12, Math.abs(hi || 1) * .02, 1e-12);
  const min = lo - pad;
  const max = hi + pad;
  $("chartMax").textContent = max.toPrecision(5);
  $("chartMin").textContent = min.toPrecision(5);
  ctx.strokeStyle = "#ff9800";
  ctx.lineWidth = 1;
  ctx.beginPath();
  waveformSamples.forEach((value, index) => {
    const x = index * WAVEFORM_SAMPLE_SPACING;
    const y = height - ((value - min) / (max - min)) * height;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function resizeWaveform() {
  if (waveformCanvas.parentElement.hidden) return;
  waveformCanvas.style.width = "100%";
  waveformCanvas.style.height = "240px";
  const availableWidth = waveformCanvas.clientWidth;
  const availableHeight = waveformCanvas.clientHeight;
  if (availableWidth < 2) return;
  const cssWidth = Math.max(WAVEFORM_GRID_SIZE, Math.floor(availableWidth / WAVEFORM_GRID_SIZE) * WAVEFORM_GRID_SIZE);
  const cssHeight = Math.max(WAVEFORM_GRID_SIZE, Math.floor(availableHeight / WAVEFORM_GRID_SIZE) * WAVEFORM_GRID_SIZE);
  waveformCanvas.style.width = `${cssWidth}px`;
  waveformCanvas.style.height = `${cssHeight}px`;
  const ratio = window.devicePixelRatio || 1;
  waveformCanvas.width = Math.round(cssWidth * ratio);
  waveformCanvas.height = Math.round(cssHeight * ratio);
  waveformContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  waveformCapacity = Math.max(2, Math.floor(Math.max(0, cssWidth - 1) / WAVEFORM_SAMPLE_SPACING) + 1);
  while (waveformSamples.length > waveformCapacity) waveformSamples.shift();
  drawWaveform();
}

function requestWaveformDraw() {
  if (waveformDrawPending) return;
  waveformDrawPending = true;
  requestAnimationFrame(() => {
    waveformDrawPending = false;
    drawWaveform();
  });
}

function pushWaveform(value, unit) {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  if (waveformSamples.length >= waveformCapacity) waveformSamples.shift();
  waveformSamples.push(value);
  waveformCanvas.setAttribute("aria-label", `DM40 实时${unit || "测量"}波形，${waveformSamples.length} 个采样点`);
  requestWaveformDraw();
}

function clearWaveform() {
  waveformSamples.length = 0;
  $("chartMax").textContent = "--";
  $("chartMin").textContent = "--";
  drawWaveform();
}

function selectMode(groupKey) {
  const options = modeGroups[groupKey];
  if (!writeCharacteristic || !options) return;
  const activeIndex = options.findIndex((option) => option.mode === window.currentMode);
  const next = options[(activeIndex + 1) % options.length];
  clearWaveform();
  pendingCommand = { prefix: next.prefix, label: next.mode };
  schedulePoll();
}

async function writeCommand(prefix, label) {
  if (!writeCharacteristic) throw new Error("写入特征尚未连接");
  const frame = commandFrame(prefix);
  if (writeCharacteristic.properties.writeWithoutResponse) {
    await writeCharacteristic.writeValueWithoutResponse(frame);
  } else if (writeCharacteristic.properties.write) {
    await writeCharacteristic.writeValueWithResponse(frame);
  } else {
    await writeCharacteristic.writeValue(frame);
  }
  log(`TX ${label}: ${formatBytes(frame)}`);
}

function handleNotification(event) {
  // DataView may reference a larger shared ArrayBuffer; only consume this
  // notification's bytes, otherwise header/offset checks can be misleading.
  const view = event.target.value;
  const data = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const crc = data.length && (data.reduce((sum, value) => sum + value, 0) & 0xff) === 0;
  try {
    const measurement = window.DM40Parser.parse(data);
    if (measurement.valid) {
      $("readingValue").textContent = `${measurement.value} ${measurement.unit}`.trim();
      lastMeasurementStatus = { charging: measurement.charging, hold: measurement.hold };
      renderMeasurementStatus();
      $("rangeValue").textContent = measurement.range || "--";
      window.lastBattery = measurement.battery;
      renderBatteryStatus();
      if (window.currentMode && window.currentMode !== measurement.mode) {
        clearWaveform();
      }
      pushWaveform(measurement.normValue, measurement.unit);
      window.currentMode = measurement.mode;
      setModeButtons(measurement.mode);
    }
  } catch (error) {
    setMessageKey("parseFailed", { error: error.message }, true);
  }
  log(`RX ${formatBytes(data)}  CRC:${data.length ? (crc ? "PASS" : "FAIL") : "N/A"}`);
  waitingForPacket = false;
  schedulePoll();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    if (!writeCharacteristic || waitingForPacket) return;
    sendNextRequest();
  }, 0);
}

async function sendNextRequest() {
  if (!writeCharacteristic || waitingForPacket) return;
  const command = pendingCommand || { prefix: CMD_READ, label: "READ" };
  pendingCommand = null;
  waitingForPacket = true;
  try {
    await writeCommand(command.prefix, command.label);
  } catch (error) {
    waitingForPacket = false;
    setMessageKey("sendFailed", { error: error.message }, true);
  }
}

async function connectSelected() {
  if (!selectedDevice) {
    setMessageKey("selectFirst", {}, true);
    return;
  }
  try {
    device = selectedDevice;
    device.addEventListener("gattserverdisconnected", disconnect);
    server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    notifyCharacteristic = await service.getCharacteristic(NOTIFY_UUID);
    writeCharacteristic = await service.getCharacteristic(WRITE_UUID);
    notifyCharacteristic.addEventListener("characteristicvaluechanged", handleNotification);
    await notifyCharacteristic.startNotifications();
    // Some adapters expose the name on the selected object only, so keep both
    // references and update the UI only after the GATT connection succeeds.
    $("deviceName").textContent = device.name || selectedDevice.name || "dm40x";
    setConnectionState(true);
    disconnectButton.disabled = false;
    modeButtons.forEach((button) => { button.disabled = false; });
    setMessageKey("connectingInfo");
    waitingForPacket = true;
    await writeCommand(CMD_ID, "ID");
  } catch (error) {
    disconnect();
    setMessageKey("connectFailed", { error: error.message }, true);
  }
}

async function scan() {
  if (!navigator.bluetooth) {
    setMessageKey("noBluetooth", {}, true);
    return;
  }
  try {
    setMessageKey("selectDevice");
    // Web Bluetooth 的设备选择器就是网页能使用的 BLE 扫描入口。
    // 不依赖广播名称过滤：部分 DM40 设备在系统蓝牙列表中显示 dm40x，
    // 但广播包里的名称可能为空或大小写不同。
    selectedDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
    setMessageKey("selectedDevice", { name: selectedDevice.name || "DM40" });
    await connectSelected();
  } catch (error) {
    if (error.name !== "NotFoundError") setMessageKey("scanFailed", { error: error.message }, true);
  }
}

function disconnect() {
  clearTimeout(pollTimer);
  waitingForPacket = false;
  pendingCommand = null;
  if (notifyCharacteristic) {
    notifyCharacteristic.removeEventListener("characteristicvaluechanged", handleNotification);
  }
  if (device?.gatt?.connected) device.gatt.disconnect();
  device = server = notifyCharacteristic = writeCharacteristic = null;
  selectedDevice = null;
  $("deviceName").textContent = "--";
  $("readingValue").textContent = "---";
  lastMeasurementStatus = null;
  renderMeasurementStatus();
  $("rangeValue").textContent = "--";
  window.lastBattery = null;
  renderBatteryStatus();
  clearWaveform();
  setConnectionState(false);
  disconnectButton.disabled = true;
  modeButtons.forEach((button) => {
    button.disabled = true;
    button.classList.remove("active");
    button.textContent = translations[language].defaults[button.dataset.modeGroup] || "Mode";
  });
  window.currentMode = null;
}

scanButton.addEventListener("click", scan);
disconnectButton.addEventListener("click", disconnect);
languageButton.addEventListener("click", () => {
  language = language === "zh" ? "en" : "zh";
  applyTranslations();
});
modeButtons.forEach((button) => {
  button.addEventListener("click", () => selectMode(button.dataset.modeGroup));
});
$("clearButton").addEventListener("click", () => { rawLog.textContent = ""; });
document.querySelectorAll("[data-collapse-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const content = $(button.dataset.collapseTarget);
    const panel = button.closest(".panel");
    const collapsed = !content.hidden;
    content.hidden = collapsed;
    button.textContent = t(collapsed ? "expand" : "collapse");
    if (panel) panel.classList.toggle("is-collapsed", collapsed);
    if (!collapsed && content === waveformCanvas.parentElement) resizeWaveform();
  });
});
window.addEventListener("resize", resizeWaveform);
resizeWaveform();

// Keep browser/environment failures visible without requiring DevTools.
if (!window.isSecureContext) {
  setMessageKey("secureContext", {}, true);
} else if (!navigator.bluetooth) {
  setMessageKey("noBluetooth", {}, true);
} else {
  setMessageKey("ready");
}
