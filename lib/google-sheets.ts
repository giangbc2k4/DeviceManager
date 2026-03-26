// Lấy log thiết bị từ sheet DEVICE_LOGS
export async function listDeviceLogs(mac?: string, limit: number = 100) {
  const { spreadsheetId } = getSheetsConfig();
  const sheets = await getSheetsClient();
  const logSheetName = "DEVICE_LOGS";
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${logSheetName}!A2:E`,
  });
  let rows = response.data.values || [];
  // Lọc theo MAC nếu có
  if (mac) {
    const macNorm = mac.trim().toUpperCase();
    rows = rows.filter(row => (row[1] || "").toUpperCase() === macNorm);
  }
  // Lấy dòng mới nhất trước
  rows = rows.slice(-limit).reverse();
  return rows.map(row => ({
    timestamp: row[0],
    mac: row[1],
    room: row[2],
    level: row[3],
    message: row[4],
  }));
}
import { google } from "googleapis";

const CHAT_ID_MAP: Record<string, string> = {
  "-5021046267": "-1003686987675",
};

export type DeviceRow = {
  rowNumber: number;
  mac: string;
  room: string;
  status: string;
  license: string;
  startDate: string;
  expireDate: string;
  version: string;
  debug: boolean;
};


export type DailyRoomSummary = {
  room: string;
  totalMinutes: number;
  count: number;
};

export type DailyChartData = {
  dateLabel: string;
  totalMinutes: number;
  rooms: DailyRoomSummary[];
};

export type DailyDebugData = {
  dateLabel: string;
  windowStart: string;
  windowEnd: string;
  windowStartIso: string;
  windowEndIso: string;
  totalMinutes: number;
  rooms: Array<{
    room: string;
    count: number;
    totalMinutes: number;
    mergedSessions: Array<{
      start: string;
      end: string;
      startIso: string;
      endIso: string;
      minutes: number;
    }>;
  }>;
  rawRows: Array<{
    room: string;
    start: string;
    end: string;
    startIso: string;
    endIso: string;
    status: string;
    duration: string;
    lastSeen: string;
  }>;
};

export type Sheet1SessionRow = {
  rowNumber: number;
  room: string;
  chatId: string;
  start: string;
  end: string;
  duration: string;
  status: string;
  lastSeen: string;
  wifiSignal: string;
  fwVersion: string;
  startIso: string;
  endIso: string;
  minutes: number;
};

export type Sheet1DayGroup = {
  dateKey: string;
  dateLabel: string;
  totalSessions: number;
  totalMinutes: number;
  rows: Sheet1SessionRow[];
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSheetsConfig() {
  return {
    spreadsheetId: getRequiredEnv("GOOGLE_SHEETS_SPREADSHEET_ID"),
    sheetName: process.env.GOOGLE_SHEETS_DEVICE_SHEET || "MAC_REGISTRY",
    activitySheetName: process.env.GOOGLE_SHEETS_ACTIVITY_SHEET || "Sheet1",
    tzOffsetMinutes: Number(process.env.GOOGLE_SHEETS_TZ_OFFSET_MINUTES || "420"),
    clientEmail: getRequiredEnv("GOOGLE_SHEETS_CLIENT_EMAIL"),
    privateKey: getRequiredEnv("GOOGLE_SHEETS_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

async function getSheetsClient() {
  const { clientEmail, privateKey } = getSheetsConfig();

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await auth.authorize();

  return google.sheets({ version: "v4", auth });
}

async function getSheetId(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetName: string,
) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const sheet = metadata.data.sheets?.find(
    (item) => item.properties?.title === sheetName,
  );

  const sheetId = sheet?.properties?.sheetId;

  if (sheetId === undefined) {
    throw new Error("Device sheet not found");
  }

  return sheetId;
}

function toText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function resolveCanonicalRawChatId(chatId: string) {
  const base = toText(chatId);
  if (!base) return "";

  // Source alias -> canonical destination.
  if (CHAT_ID_MAP[base]) {
    return CHAT_ID_MAP[base];
  }

  // Destination ids remain canonical as-is.
  for (const key of Object.keys(CHAT_ID_MAP)) {
    if (CHAT_ID_MAP[key] === base) {
      return base;
    }
  }

  // No mapping rule: use input as-is.
  return base;
}

async function findDeviceByMac(mac: string) {
  const normalizedMac = toText(mac).toUpperCase();

  if (!normalizedMac) {
    throw new Error("Missing MAC address");
  }

  const devices = await listDevices();
  const target = devices.find((device) => device.mac.toUpperCase() === normalizedMac);

  if (!target) {
    throw new Error("Device not found");
  }

  return target;
}

export async function listDevices(): Promise<DeviceRow[]> {
  const { spreadsheetId, sheetName } = getSheetsConfig();
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:I`,
  });

  const rows = response.data.values || [];

  return rows
    .map((row, index) => ({
      rowNumber: index + 2,
      mac: toText(row[0]),
      room: toText(row[1]),
      status: toText(row[2]),
      license: toText(row[3]),
      startDate: toText(row[4]),
      expireDate: toText(row[5]),
      version: toText(row[8]),
      debug: toText(row[7]).toUpperCase() === "ON",
    }))
    .filter((row) => row.mac !== "");
}

// Lấy danh sách phòng đang mở (status ON trong Sheet1)
export async function getOpenRooms(): Promise<Set<string>> {
  const { spreadsheetId, activitySheetName } = getSheetsConfig();
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${activitySheetName}!A2:F`,
  });

  const rows = response.data.values || [];
  const openRooms = new Set<string>();

  for (const row of rows) {
    const room = toText(row[0]);
    const status = toText(row[5]);
    if (room && status.toUpperCase() === "ON") {
      openRooms.add(room);
    }
  }

  return openRooms;
}

// Cập nhật trạng thái debug cho thiết bị (cột H - DEBUG)
export async function updateDeviceDebug(mac: string, debug: boolean) {
  const target = await findDeviceByMac(mac);
  const { spreadsheetId, sheetName } = getSheetsConfig();
  const sheets = await getSheetsClient();

  // Cột DEBUG là cột H (thứ 8)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!H${target.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[debug ? "ON" : "OFF"]],
    },
  });

  return { mac: target.mac, debug };
}

export async function toggleDeviceLock(mac: string) {
  const target = await findDeviceByMac(mac);

  const action = target.status === "LOCKED" ? "UNLOCK" : "LOCK";
  const nextStatus = action === "LOCK" ? "LOCKED" : "ACTIVE";

  const appsScriptUrl = process.env.APPS_SCRIPT_URL;

  if (appsScriptUrl) {
    const res = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, mac: target.mac }),
      redirect: "follow",
    });

    const text = await res.text();
    let result: { error?: string; newStatus?: string };
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("Apps Script returned invalid response");
    }

    if (result.error) {
      throw new Error(result.error);
    }

    return { mac: target.mac, status: result.newStatus ?? nextStatus };
  }

  const { spreadsheetId, sheetName } = getSheetsConfig();
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!C${target.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[nextStatus]],
    },
  });

  return { mac: target.mac, status: nextStatus };
}

export async function updateDeviceLicense(mac: string, license: string) {
  const normalizedLicense = toText(license).toUpperCase();

  if (!["TRIAL", "LIFETIME"].includes(normalizedLicense)) {
    throw new Error("Invalid license value");
  }

  const target = await findDeviceByMac(mac);

  const { spreadsheetId, sheetName } = getSheetsConfig();
  const sheets = await getSheetsClient();

  const data: Array<{ range: string; values: string[][] }> = [{
    range: `${sheetName}!D${target.rowNumber}`,
    values: [[normalizedLicense]],
  }];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: data.map((item) => ({
        range: item.range,
        values: item.values,
      })),
    },
  });

  return { mac: target.mac, license: normalizedLicense };
}

export async function updateExpireDate(mac: string, expireDate: string) {
  const target = await findDeviceByMac(mac);

  const { spreadsheetId, sheetName } = getSheetsConfig();
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!F${target.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[expireDate]],
    },
  });

  return { mac: target.mac, expireDate };
}

export async function deleteDevice(mac: string) {
  const target = await findDeviceByMac(mac);

  const { spreadsheetId, sheetName } = getSheetsConfig();
  const sheets = await getSheetsClient();
  const sheetId = await getSheetId(sheets, spreadsheetId, sheetName);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: target.rowNumber - 1,
              endIndex: target.rowNumber,
            },
          },
        },
      ],
    },
  });

  return { mac: target.mac, deleted: true };
}

function mergeSessions(
  sessions: Array<{ start: Date; end: Date }>,
  gapLimitMs: number,
  minDurationMs: number,
) {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Array<{ start: Date; end: Date }> = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const gap = next.start.getTime() - current.end.getTime();

    if (gap <= gapLimitMs) {
      if (next.end.getTime() > current.end.getTime()) {
        current.end = new Date(next.end);
      }
      continue;
    }

    if (current.end.getTime() - current.start.getTime() >= minDurationMs) {
      merged.push(current);
    }

    current = { ...next };
  }

  if (current.end.getTime() - current.start.getTime() >= minDurationMs) {
    merged.push(current);
  }

  return merged;
}

function shiftToSheetLocal(date: Date, tzOffsetMinutes: number) {
  return new Date(date.getTime() + tzOffsetMinutes * 60 * 1000);
}

function formatDateLabel(date: Date, tzOffsetMinutes: number) {
  const shifted = shiftToSheetLocal(date, tzOffsetMinutes);
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const y = shifted.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

function formatDateTimeLabel(date: Date, tzOffsetMinutes: number) {
  const shifted = shiftToSheetLocal(date, tzOffsetMinutes);
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const y = shifted.getUTCFullYear();
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} ${d}/${m}/${y}`;
}

function parseSheetDate(value: unknown, tzOffsetMinutes = 0) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    // SERIAL_NUMBER is a sheet-local datetime; convert to UTC by removing sheet offset.
    return new Date(excelEpoch + value * 24 * 60 * 60 * 1000 - tzOffsetMinutes * 60 * 1000);
  }

  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);

    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]) - 1;
      const year = Number(m[3]);
      const hour = Number(m[4]);
      const minute = Number(m[5]);
      const second = Number(m[6] || "0");
      // Parse sheet-local datetime to UTC by subtracting configured sheet offset.
      const parsed = new Date(
        Date.UTC(year, month, day, hour, minute, second) - tzOffsetMinutes * 60 * 1000,
      );
      if (!isNaN(parsed.getTime())) return parsed;
    }

    const fallback = new Date(text);
    if (!isNaN(fallback.getTime())) return fallback;
  }

  return null;
}

function getSheetLocalDateKey(date: Date, tzOffsetMinutes: number) {
  const shifted = new Date(date.getTime() + tzOffsetMinutes * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabelFromKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map((x) => Number(x));
  if (!y || !m || !d) return dateKey;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function parseDateParam(dateStr: string): { day: number; month: number; year: number } | null {
  const m = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!m) return null;
  return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
}

export function getDefaultReportDate(): string {
  const { tzOffsetMinutes } = getSheetsConfig();
  const endHourLocal = 6;
  const nowUtc = Date.now();
  const nowLocal = new Date(nowUtc + tzOffsetMinutes * 60 * 1000);

  const y = nowLocal.getUTCFullYear();
  const m = nowLocal.getUTCMonth();
  const d = nowLocal.getUTCDate();

  const endLocalAsUtcMs = Date.UTC(y, m, d, endHourLocal, 0, 0, 0);
  const endPeriod = new Date(endLocalAsUtcMs - tzOffsetMinutes * 60 * 1000);
  const startPeriod = new Date(endPeriod.getTime() - 24 * 60 * 60 * 1000);

  return formatDateLabel(startPeriod, tzOffsetMinutes);
}

function getDailyWindowBySheetOffset(tzOffsetMinutes: number, endHourLocal = 6, targetDate?: string) {
  if (targetDate) {
    const parsed = parseDateParam(targetDate);
    if (parsed) {
      const startLocalAsUtcMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day, endHourLocal, 0, 0, 0);
      const startPeriod = new Date(startLocalAsUtcMs - tzOffsetMinutes * 60 * 1000);
      const endPeriod = new Date(startPeriod.getTime() + 24 * 60 * 60 * 1000);
      return { startPeriod, endPeriod };
    }
  }

  const nowUtc = Date.now();
  const nowLocal = new Date(nowUtc + tzOffsetMinutes * 60 * 1000);

  const y = nowLocal.getUTCFullYear();
  const m = nowLocal.getUTCMonth();
  const d = nowLocal.getUTCDate();

  const endLocalAsUtcMs = Date.UTC(y, m, d, endHourLocal, 0, 0, 0);
  const endPeriod = new Date(endLocalAsUtcMs - tzOffsetMinutes * 60 * 1000);
  const startPeriod = new Date(endPeriod.getTime() - 24 * 60 * 60 * 1000);

  return { startPeriod, endPeriod };
}

export async function getSheet1SessionsByDay(): Promise<Sheet1DayGroup[]> {
  const { spreadsheetId, activitySheetName, tzOffsetMinutes } = getSheetsConfig();
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${activitySheetName}!A2:I`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  const rows = response.data.values || [];
  const grouped: Record<string, Sheet1SessionRow[]> = {};

  rows.forEach((row, index) => {
    const room = toText(row[0]);
    const chatId = toText(row[1]);
    const startRaw = row[2];
    const endRaw = row[3];
    const duration = toText(row[4]);
    const status = toText(row[5]);
    const lastSeenRaw = row[6];
    const wifiSignal = toText(row[7]);
    const fwVersionRaw = toText(row[8]);

    const start = parseSheetDate(startRaw, tzOffsetMinutes);
    const end = endRaw ? parseSheetDate(endRaw, tzOffsetMinutes) : null;
    const lastSeen = lastSeenRaw ? parseSheetDate(lastSeenRaw, tzOffsetMinutes) : null;

    if (!room || !start) return;

    const dateKey = getSheetLocalDateKey(start, tzOffsetMinutes);
    const minutes = end ? Math.max(Math.floor((end.getTime() - start.getTime()) / 60000), 0) : 0;

    const mappedRow: Sheet1SessionRow = {
      rowNumber: index + 2,
      room,
      chatId,
      start: formatDateTimeLabel(start, tzOffsetMinutes),
      end: end ? formatDateTimeLabel(end, tzOffsetMinutes) : "",
      duration,
      status,
      lastSeen: lastSeen ? formatDateTimeLabel(lastSeen, tzOffsetMinutes) : "",
      wifiSignal,
      fwVersion: fwVersionRaw,
      startIso: start.toISOString(),
      endIso: end ? end.toISOString() : "",
      minutes,
    };

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }

    grouped[dateKey].push(mappedRow);
  });

  return Object.keys(grouped)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((dateKey) => {
      const dayRows = grouped[dateKey].sort(
        (a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime(),
      );
      const totalMinutes = dayRows.reduce((sum, item) => sum + item.minutes, 0);

      return {
        dateKey,
        dateLabel: formatDateLabelFromKey(dateKey),
        totalSessions: dayRows.length,
        totalMinutes,
        rows: dayRows,
      };
    });
}

export async function getDailyChartByChatId(chatId: string): Promise<DailyChartData> {
  const canonicalChatId = resolveCanonicalRawChatId(chatId);
  if (!canonicalChatId) {
    return {
      dateLabel: formatDateLabel(new Date(), 420),
      totalMinutes: 0,
      rooms: [],
    };
  }

  const { spreadsheetId, activitySheetName, tzOffsetMinutes } = getSheetsConfig();
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${activitySheetName}!A2:H`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  const rows = response.data.values || [];

  const { startPeriod, endPeriod } = getDailyWindowBySheetOffset(tzOffsetMinutes);

  const byRoom: Record<string, Array<{ start: Date; end: Date }>> = {};

  for (const row of rows) {
    const room = toText(row[0]);
    const rowChatId = toText(row[1]);
    const startRaw = row[2];
    const endRaw = row[3];

    if (!room || !rowChatId || !startRaw) continue;
    if (resolveCanonicalRawChatId(rowChatId) !== canonicalChatId) continue;

    const start = parseSheetDate(startRaw, tzOffsetMinutes);
    const end = endRaw ? parseSheetDate(endRaw, tzOffsetMinutes) : endPeriod;

    if (!start || !end) continue;
    if (end < startPeriod || start > endPeriod) continue;

    const realStart = start < startPeriod ? startPeriod : start;
    const realEnd = end > endPeriod ? endPeriod : end;

    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push({ start: realStart, end: realEnd });
  }

  const GAP_LIMIT = 10 * 60 * 1000;
  const MIN_DURATION = 10 * 60 * 1000;

  const rooms: DailyRoomSummary[] = [];

  Object.keys(byRoom).forEach((room) => {
    const merged = mergeSessions(byRoom[room], GAP_LIMIT, MIN_DURATION);
    if (merged.length === 0) return;

    const totalMs = merged.reduce((sum, session) => sum + (session.end.getTime() - session.start.getTime()), 0);

    rooms.push({
      room,
      totalMinutes: Math.floor(totalMs / 60000),
      count: merged.length,
    });
  });

  rooms.sort((a, b) => b.totalMinutes - a.totalMinutes);

  return {
    dateLabel: formatDateLabel(startPeriod, tzOffsetMinutes),
    totalMinutes: rooms.reduce((sum, room) => sum + room.totalMinutes, 0),
    rooms,
  };
}

export async function getDailyDebugByChatId(chatId: string, reportDate?: string): Promise<DailyDebugData> {
  const canonicalChatId = resolveCanonicalRawChatId(chatId);

  const { tzOffsetMinutes } = getSheetsConfig();
  const { startPeriod, endPeriod } = getDailyWindowBySheetOffset(tzOffsetMinutes, 6, reportDate);

  if (!canonicalChatId) {
    return {
      dateLabel: formatDateLabel(startPeriod, tzOffsetMinutes),
      windowStart: formatDateTimeLabel(startPeriod, tzOffsetMinutes),
      windowEnd: formatDateTimeLabel(endPeriod, tzOffsetMinutes),
      windowStartIso: startPeriod.toISOString(),
      windowEndIso: endPeriod.toISOString(),
      totalMinutes: 0,
      rooms: [],
      rawRows: [],
    };
  }

  const { spreadsheetId, activitySheetName } = getSheetsConfig();
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${activitySheetName}!A2:H`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  const rows = response.data.values || [];
  const byRoom: Record<string, Array<{ start: Date; end: Date }>> = {};
  const rawRows: DailyDebugData["rawRows"] = [];

  for (const row of rows) {
    const room = toText(row[0]);
    const rowChatId = toText(row[1]);
    const startRaw = row[2];
    const endRaw = row[3];
    const duration = toText(row[4]);
    const status = toText(row[5]);
    const lastSeenRaw = row[6];

    if (!room || !rowChatId || !startRaw) continue;
    if (resolveCanonicalRawChatId(rowChatId) !== canonicalChatId) continue;

    const start = parseSheetDate(startRaw, tzOffsetMinutes);
    const end = endRaw ? parseSheetDate(endRaw, tzOffsetMinutes) : endPeriod;
    const lastSeen = lastSeenRaw ? parseSheetDate(lastSeenRaw, tzOffsetMinutes) : null;

    if (!start || !end) continue;
    if (end < startPeriod || start > endPeriod) continue;

    const realStart = start < startPeriod ? startPeriod : start;
    const realEnd = end > endPeriod ? endPeriod : end;

    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push({ start: realStart, end: realEnd });

    rawRows.push({
      room,
      start: formatDateTimeLabel(start, tzOffsetMinutes),
      end: formatDateTimeLabel(end, tzOffsetMinutes),
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      status,
      duration,
      lastSeen: lastSeen ? formatDateTimeLabel(lastSeen, tzOffsetMinutes) : "",
    });
  }

  const GAP_LIMIT = 10 * 60 * 1000;
  const MIN_DURATION = 10 * 60 * 1000;

  const rooms: DailyDebugData["rooms"] = [];

  Object.keys(byRoom).forEach((room) => {
    const merged = mergeSessions(byRoom[room], GAP_LIMIT, MIN_DURATION);
    if (merged.length === 0) return;

    const totalMs = merged.reduce(
      (sum, session) => sum + (session.end.getTime() - session.start.getTime()),
      0,
    );

    const mergedSessions = merged.map((session) => {
      const minutes = Math.floor((session.end.getTime() - session.start.getTime()) / 60000);
      return {
        start: formatDateTimeLabel(session.start, tzOffsetMinutes),
        end: formatDateTimeLabel(session.end, tzOffsetMinutes),
        startIso: session.start.toISOString(),
        endIso: session.end.toISOString(),
        minutes,
      };
    });

    const totalMinutes = Math.floor(totalMs / 60000);

    rooms.push({
      room,
      count: mergedSessions.length,
      totalMinutes,
      mergedSessions,
    });
  });

  rooms.sort((a, b) => b.totalMinutes - a.totalMinutes);

  rawRows.sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  return {
    dateLabel: formatDateLabel(startPeriod, tzOffsetMinutes),
    windowStart: formatDateTimeLabel(startPeriod, tzOffsetMinutes),
    windowEnd: formatDateTimeLabel(endPeriod, tzOffsetMinutes),
    windowStartIso: startPeriod.toISOString(),
    windowEndIso: endPeriod.toISOString(),
    totalMinutes: rooms.reduce((sum, room) => sum + room.totalMinutes, 0),
    rooms,
    rawRows,
  };
}
