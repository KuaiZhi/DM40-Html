window.DM40Protocol = {
  HEADER: [0xdf, 0x05, 0x03, 0x09],
  FLAG_INFO: {
    0x00: ["VDC", "600mV"], 0x08: ["VDC", "6V"], 0x10: ["VDC", "60V"], 0x18: ["VDC", "600V"], 0x20: ["VDC", "1000V"], 0x28: ["VDC", "AUTO"], 0x30: ["VDC", "AUTO+"],
    0x40: ["VAC", "600mV"], 0x48: ["VAC", "6V"], 0x50: ["VAC", "60V"], 0x58: ["VAC", "600V"], 0x60: ["VAC", "1000V"], 0x68: ["VAC", "AUTO"], 0x70: ["VAC", "AUTO+"],
    0x80: ["VDC+AC", "600mV"], 0x88: ["VDC+AC", "6V"], 0x90: ["VDC+AC", "60V"], 0x98: ["VDC+AC", "600V"], 0xa0: ["VDC+AC", "1000V"], 0xa8: ["VDC+AC", "AUTO"], 0xb0: ["VDC+AC", "AUTO+"],
    0x01: ["ADC", "600uA"], 0x09: ["ADC", "6mA"], 0x11: ["ADC", "60mA"], 0x19: ["ADC", "600mA"], 0x21: ["ADC", "6A"], 0x29: ["ADC", "10A"], 0x31: ["ADC", "AUTO"], 0x39: ["ADC", "AUTO+"],
    0x41: ["AAC", "600uA"], 0x49: ["AAC", "6mA"], 0x51: ["AAC", "60mA"], 0x59: ["AAC", "600mA"], 0x61: ["AAC", "6A"], 0x69: ["AAC", "10A"], 0x71: ["AAC", "AUTO"], 0x79: ["AAC", "AUTO+"],
    0x81: ["ADC+AC", "600uA"], 0x89: ["ADC+AC", "6mA"], 0x91: ["ADC+AC", "60mA"], 0x99: ["ADC+AC", "600mA"], 0xa1: ["ADC+AC", "6A"], 0xa9: ["ADC+AC", "10A"], 0xb1: ["ADC+AC", "AUTO"], 0xb9: ["ADC+AC", "AUTO+"],
    0x02: ["RES", "600Ω"], 0x0a: ["RES", "6kΩ"], 0x12: ["RES", "60kΩ"], 0x1a: ["RES", "600kΩ"], 0x22: ["RES", "6MΩ"], 0x2a: ["RES", "60MΩ"], 0x32: ["RES", "AUTO"],
    0x42: ["RES_ONLINE", "600Ω"], 0x4a: ["RES_ONLINE", "6kΩ"], 0x52: ["RES_ONLINE", "60kΩ"], 0x5a: ["RES_ONLINE", "600kΩ"], 0x62: ["RES_ONLINE", "6MΩ"], 0x6a: ["RES_ONLINE", "60MΩ"], 0x72: ["RES_ONLINE", "AUTO"],
    0x03: ["CAP", "AUTO"], 0x04: ["DIODE", "AUTO"], 0x44: ["CONT", "AUTO"], 0x05: ["FREQ", "AUTO"], 0x45: ["TEMP", "AUTO"]
  },
  MODE_SLOTS: { VDC: ["M1"], VAC: ["M1", "DUTY", "FREQ"], "VDC+AC": ["M1", "DC", "AC"], ADC: ["M1"], AAC: ["M1", "DUTY", "FREQ"], "ADC+AC": ["M1", "DC", "AC"], RES: ["M1"], RES_ONLINE: ["M1"], CAP: ["M1"], DIODE: ["M1", "RES"], CONT: ["M1"], FREQ: ["FREQ"], TEMP: ["TC"] }
};
