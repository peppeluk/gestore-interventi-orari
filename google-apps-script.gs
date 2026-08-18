// ============================================================
// Google Apps Script - Deploy come Web App
// Copia questo codice su https://script.google.com
// Segui le istruzioni in README_google_sheets.md
// ============================================================

const SHEET_NAME = "Dati";
const HEADERS = [
  "type", "id", "name", "hourlyRate",
  "clientId", "date", "start", "end", "minutes",
  "description", "status", "paidAt", "createdAt", "updatedAt", "deleted"
];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground("#16423c")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
  }
  return sheet;
}

function rowsToObjects(rows) {
  const records = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    for (let j = 0; j < HEADERS.length; j++) {
      const val = row[j];
      if (val === "" || val === null || val === undefined) {
        obj[HEADERS[j]] = null;
      } else if (HEADERS[j] === "hourlyRate" || HEADERS[j] === "minutes") {
        obj[HEADERS[j]] = Number(val) || 0;
      } else {
        obj[HEADERS[j]] = String(val);
      }
    }
    records.push(obj);
  }
  return records;
}

function objectToRow(obj) {
  return HEADERS.map(h => {
    const val = obj[h];
    if (val === undefined || val === null) return "";
    return val;
  });
}

function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ clients: [], interventions: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    const records = rowsToObjects(rows);

    const clients = [];
    const interventions = [];
    for (const rec of records) {
      if (rec.deleted === "true") continue;
      if (rec.type === "client") {
        clients.push({
          id: rec.id,
          name: rec.name,
          hourlyRate: rec.hourlyRate,
          updatedAt: rec.updatedAt
        });
      } else if (rec.type === "intervention") {
        interventions.push({
          id: rec.id,
          clientId: rec.clientId,
          date: rec.date,
          start: rec.start,
          end: rec.end,
          minutes: rec.minutes,
          description: rec.description,
          status: rec.status,
          paidAt: rec.paidAt,
          createdAt: rec.createdAt,
          updatedAt: rec.updatedAt
        });
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ clients, interventions }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();

    // Read existing data for merge
    let existingRecords = [];
    if (lastRow >= 2) {
      const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
      existingRecords = rowsToObjects(rows);
    }

    // Build index of existing records by id
    const existingMap = new Map();
    for (const rec of existingRecords) {
      if (rec.id) existingMap.set(rec.id, rec);
    }

    // Merge: clients
    const incomingClients = body.clients || [];
    const incomingInterventions = body.interventions || [];
    const incomingAll = [
      ...incomingClients.map(c => ({ ...c, type: "client" })),
      ...incomingInterventions.map(i => ({ ...i, type: "intervention" }))
    ];

    const now = new Date().toISOString();
    for (const item of incomingAll) {
      const existing = existingMap.get(item.id);
      if (existing) {
        // Update only if incoming is newer
        const incomingTime = item.updatedAt || "";
        const existingTime = existing.updatedAt || "";
        if (incomingTime >= existingTime) {
          existing.name = item.name || existing.name;
          existing.hourlyRate = item.hourlyRate != null ? item.hourlyRate : existing.hourlyRate;
          existing.clientId = item.clientId || existing.clientId;
          existing.date = item.date || existing.date;
          existing.start = item.start || existing.start;
          existing.end = item.end || existing.end;
          existing.minutes = item.minutes != null ? item.minutes : existing.minutes;
          existing.description = item.description != null ? item.description : existing.description;
          existing.status = item.status || existing.status;
          existing.paidAt = item.paidAt != null ? item.paidAt : existing.paidAt;
          existing.createdAt = item.createdAt || existing.createdAt;
          existing.updatedAt = incomingTime || now;
          existing.type = item.type || existing.type;
          existing.deleted = item.deleted || "false";
        }
      } else {
        // New record
        existingMap.set(item.id, {
          ...item,
          type: item.type,
          hourlyRate: item.hourlyRate != null ? item.hourlyRate : 0,
          minutes: item.minutes != null ? item.minutes : 0,
          updatedAt: item.updatedAt || now,
          deleted: item.deleted || "false"
        });
      }
    }

    // Write all records back
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clear();
    }
    const allRecords = Array.from(existingMap.values());
    if (allRecords.length > 0) {
      const rows = allRecords.map(r => objectToRow(r));
      sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, count: allRecords.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
