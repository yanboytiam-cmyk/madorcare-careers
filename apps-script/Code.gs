/**
 * MaDorCARE — careers form backend.
 *
 * Lives inside the Google Sheet that collects applications:
 *   Extensions > Apps Script > paste this file > Deploy > New deployment
 *   Type: Web app | Execute as: Me | Who has access: Anyone
 *
 * It writes one row per application and drops each resume into a Drive folder
 * owned by whoever deploys it. New questions become new columns on their own.
 */

const SHEET_NAME = 'Applications';
const RESUME_FOLDER = 'MaDorCARE Resumes';

/** Leave empty to skip email alerts. Comma-separate several addresses. */
const NOTIFY = '';

/** Columns pinned to the left, in this order. The rest follow as they appear. */
const PINNED = [
  ['submitted_at', 'Submitted'],
  ['reference', 'Reference'],
  ['roleLabel', 'Role'],
  ['name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['city', 'City'],
  ['resume_url', 'Resume'],
];

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) {
      return reply({ ok: false, error: 'Empty request.' });
    }

    const data = JSON.parse(e.postData.contents);
    const sheet = getSheet();
    const reference = makeReference(sheet);

    const row = {
      submitted_at: formatDate(data.submittedAt),
      reference: reference,
      roleLabel: data.roleLabel || '',
      resume_url: '',
    };

    (data.answers || []).forEach(function (a) {
      if (a.id === 'cv') return;            // the link replaces the filename
      row[a.id] = a.answer;
    });

    if (data.resume && data.resume.data) {
      row.resume_url = saveResume(data.resume, reference, row.name || 'applicant');
    }

    writeRow(sheet, row, data.answers || []);

    if (NOTIFY) notify(row, data);

    return reply({ ok: true, reference: reference });

  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

/** Lets you confirm the deployment is live by opening the URL in a browser. */
function doGet() {
  return reply({ ok: true, service: 'MaDorCARE careers intake', ready: true });
}

function reply(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
    const headers = PINNED.map(function (p) { return p[1]; });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#16305c')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.getDataRange().createDeveloperMetadata('keys', PINNED.map(function (p) { return p[0]; }).join('|'));
  }

  return sheet;
}

/**
 * Column keys live in a hidden metadata row so a header can be renamed in the
 * sheet without breaking the mapping.
 */
function keyRow(sheet) {
  const props = PropertiesService.getDocumentProperties();
  const stored = props.getProperty('columnKeys');
  if (stored) return stored.split('|');

  const keys = PINNED.map(function (p) { return p[0]; });
  props.setProperty('columnKeys', keys.join('|'));
  return keys;
}

function setKeyRow(sheet, keys) {
  PropertiesService.getDocumentProperties().setProperty('columnKeys', keys.join('|'));
}

function writeRow(sheet, row, answers) {
  let keys = keyRow(sheet);

  // Any question we have not seen before earns a new column on the right.
  const labels = {};
  answers.forEach(function (a) { labels[a.id] = a.question; });

  Object.keys(row).forEach(function (k) {
    if (keys.indexOf(k) === -1) {
      keys.push(k);
      const col = keys.length;
      sheet.getRange(1, col).setValue(labels[k] || k)
        .setFontWeight('bold')
        .setBackground('#16305c')
        .setFontColor('#ffffff');
    }
  });
  setKeyRow(sheet, keys);

  const values = keys.map(function (k) {
    return row[k] === undefined ? '' : row[k];
  });

  sheet.appendRow(values);
  sheet.autoResizeColumns(1, Math.min(keys.length, 12));
}

function makeReference(sheet) {
  const year = new Date().getFullYear();
  const count = Math.max(sheet.getLastRow(), 1);   // header counts as 1
  return 'MDC-' + year + '-' + ('000' + count).slice(-4);
}

function saveResume(resume, reference, applicantName) {
  const folder = getFolder();
  const safeName = String(applicantName).replace(/[^\w\s.-]/g, '').trim() || 'applicant';
  const ext = (resume.name.match(/\.[a-z0-9]+$/i) || ['.pdf'])[0];

  const blob = Utilities.newBlob(
    Utilities.base64Decode(resume.data),
    resume.type || 'application/octet-stream',
    reference + ' — ' + safeName + ext
  );

  const file = folder.createFile(blob);
  return file.getUrl();
}

function getFolder() {
  const found = DriveApp.getFoldersByName(RESUME_FOLDER);
  return found.hasNext() ? found.next() : DriveApp.createFolder(RESUME_FOLDER);
}

function formatDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

function notify(row, data) {
  const lines = (data.answers || []).map(function (a) {
    return a.question + '\n  ' + (a.answer || '—');
  }).join('\n\n');

  MailApp.sendEmail({
    to: NOTIFY,
    subject: 'New application — ' + row.roleLabel + ' — ' + (row.name || 'no name') + ' (' + row.reference + ')',
    body:
      row.name + ' applied for ' + row.roleLabel + '.\n\n' +
      'Email: ' + (row.email || '—') + '\n' +
      'Phone: ' + (row.phone || '—') + '\n' +
      'Resume: ' + (row.resume_url || 'not attached') + '\n\n' +
      '----\n\n' + lines,
  });
}
