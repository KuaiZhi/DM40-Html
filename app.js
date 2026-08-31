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

const $ = (id) => document.getElementById(id);
const scanButton = $("scanButton");
const disconnectButton = $("disconnectButton");
const rawLog = $("rawLog");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const modeGroups = {
  V: [{ mode: "VDC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x30] }, { mode: "VAC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x70] }, { mode: "VDC+AC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0xb0] }],
  A: [{ mode: "ADC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x39] }, { mode: "AAC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x79] }, { mode: "ADC+AC", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0xb9] }],
  R: [{ mode: "RES", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x32] }, { mode: "RES_ONLINE", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x72] }],
  C: [{ mode: "CAP", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x03] }],
  D: [{ mode: "DIODE", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x04] }, { mode: "CONT", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x44] }],
  F: [{ mode: "FREQ", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x05] }, { mode: "TEMP", prefix: [0xaf, 0x05, 0x03, 0x06, 0x01, 0x45] }]
};
const modeLabels = {
  VDC: "直流电压", VAC: "交流电压", "VDC+AC": "交直流电压",
  ADC: "直流电流", AAC: "交流电流", "ADC+AC": "交直流电流",
  RES: "电阻", RES_ONLINE: "在线电阻", CAP: "电容",
  DIODE: "二极管", CONT: "通断", FREQ: "频率", TEMP: "温度"
};
const defaultModeLabels = { V: "直流电压", A: "直流电流", R: "电阻", C: "电容", D: "二极管", F: "频率" };

function formatBytes(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function commandFrame(prefix) {
  const checksum = (-prefix.reduce((sum, value) => sum + value, 0)) & 0xff;
  return new Uint8Array([...prefix, checksum]);
}

function log(line) {
  const followTail = rawLog.scrollHeight - rawLog.scrollTop - rawLog.clientHeight < 4;
  if (rawLog.textContent === "等待连接设备...") rawLog.textContent = "";
  rawLog.textContent += `${new Date().toLocaleTimeString()}  ${line}\n`;
  if (followTail) rawLog.scrollTop = rawLog.scrollHeight;
}

function setMessage(message, isError = false) {
  const element = $("message");
  element.textContent = message;
  element.style.color = isError ? "#ff7d7d" : "#ffbf72";
}

function setModeButtons(activeMode) {
  for (const button of modeButtons) {
    const options = modeGroups[button.dataset.modeGroup] || [];
    const active = options.some((option) => option.mode === activeMode);
    const current = options.find((option) => option.mode === activeMode) || options[0];
    button.classList.toggle("active", active);
    if (current) button.textContent = modeLabels[current.mode] || current.mode;
  }
}

async function selectMode(groupKey) {
  const options = modeGroups[groupKey];
  if (!writeCharacteristic || !options) return;
  const activeIndex = options.findIndex((option) => option.mode === window.currentMode);
  const next = options[(activeIndex + 1) % options.length];
  try {
    await writeCommand(next.prefix, next.mode);
  } catch (error) {
    setMessage(`模式切换失败：${error.message}`, true);
  }
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
      $("statusValue").textContent = measurement.status;
      $("rangeValue").textContent = measurement.range || "--";
      $("batteryStatus").textContent = `电量 ${measurement.battery}/5`;
      window.currentMode = measurement.mode;
      setModeButtons(measurement.mode);
    }
  } catch (error) {
    setMessage(`数据解析失败：${error.message}`, true);
  }
  log(`RX ${formatBytes(data)}  CRC:${data.length ? (crc ? "PASS" : "FAIL") : "N/A"}`);
  waitingForPacket = false;
  schedulePoll();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    if (!writeCharacteristic || waitingForPacket) return;
    readOnce();
  }, 120);
}

async function readOnce() {
  if (!writeCharacteristic || waitingForPacket) return;
  waitingForPacket = true;
  try {
    await writeCommand(CMD_READ, "READ");
  } catch (error) {
    waitingForPacket = false;
    setMessage(`读取失败：${error.message}`, true);
  }
}

async function connectSelected() {
  if (!selectedDevice) {
    setMessage("请先扫描并选择一个 DM40 设备。", true);
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
    $("connectionState").textContent = "已连接";
    $("connectionState").dataset.state = "online";
    disconnectButton.disabled = false;
    modeButtons.forEach((button) => { button.disabled = false; });
    setMessage("已连接，正在请求设备信息...");
    await writeCommand(CMD_ID, "ID");
    await readOnce();
  } catch (error) {
    disconnect();
    setMessage(`连接失败：${error.message}`, true);
  }
}

async function scan() {
  if (!navigator.bluetooth) {
    setMessage("当前 Edge 环境没有 Web Bluetooth API。请使用 HTTPS 的桌面版 Edge。", true);
    return;
  }
  try {
    setMessage("请选择蓝牙设备（例如 dm40x）...");
    // Web Bluetooth 的设备选择器就是网页能使用的 BLE 扫描入口。
    // 不依赖广播名称过滤：部分 DM40 设备在系统蓝牙列表中显示 dm40x，
    // 但广播包里的名称可能为空或大小写不同。
    selectedDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
    setMessage(`已选择 ${selectedDevice.name || "DM40"}，正在连接...`);
    await connectSelected();
  } catch (error) {
    if (error.name !== "NotFoundError") setMessage(`扫描失败：${error.message}`, true);
  }
}

function disconnect() {
  clearTimeout(pollTimer);
  waitingForPacket = false;
  if (notifyCharacteristic) {
    notifyCharacteristic.removeEventListener("characteristicvaluechanged", handleNotification);
  }
  if (device?.gatt?.connected) device.gatt.disconnect();
  device = server = notifyCharacteristic = writeCharacteristic = null;
  selectedDevice = null;
  $("deviceName").textContent = "--";
  $("readingValue").textContent = "---";
  $("statusValue").textContent = "--";
  $("rangeValue").textContent = "--";
  $("batteryStatus").textContent = "电量 --";
  $("connectionState").textContent = "未连接";
  $("connectionState").dataset.state = "offline";
  disconnectButton.disabled = true;
  modeButtons.forEach((button) => {
    button.disabled = true;
    button.classList.remove("active");
    button.textContent = defaultModeLabels[button.dataset.modeGroup] || "模式";
  });
  window.currentMode = null;
}

scanButton.addEventListener("click", scan);
disconnectButton.addEventListener("click", disconnect);
modeButtons.forEach((button) => {
  button.addEventListener("click", () => selectMode(button.dataset.modeGroup));
});
$("clearButton").addEventListener("click", () => { rawLog.textContent = ""; });

// Keep browser/environment failures visible without requiring DevTools.
if (!window.isSecureContext) {
  setMessage("当前页面不是安全上下文。请使用 GitHub Pages HTTPS 或 localhost，不要直接用 file:// 打开。", true);
} else if (!navigator.bluetooth) {
  setMessage("当前 Edge 没有 Web Bluetooth API。请使用桌面版 Edge，并检查浏览器策略是否禁用了 Web Bluetooth。", true);
} else {
  setMessage("页面已就绪，请点击“扫描设备”。");
}
