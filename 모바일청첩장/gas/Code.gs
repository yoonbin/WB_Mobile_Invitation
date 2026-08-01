/**
 * 모바일청첩장 백엔드 (Google Apps Script)
 * 방명록 + 참석 여부를 구글 시트에 저장합니다.
 *
 * 배포 방법은 gas/README.md 를 보세요.
 */

var SHEET_GUESTBOOK = '방명록';
var SHEET_RSVP = '참석여부';

/* ---------- 공통 ---------- */

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function hash_(text) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function str_(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

/* ---------- 조회 ---------- */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'list') {
    var sh = sheet_(SHEET_GUESTBOOK, ['id', '작성일시', '이름', '메시지', '비밀번호해시', '삭제됨']);
    var last = sh.getLastRow();
    if (last < 2) { return json_({ ok: true, items: [] }); }

    var rows = sh.getRange(2, 1, last - 1, 6).getValues();
    var items = [];
    for (var i = rows.length - 1; i >= 0; i--) {
      if (rows[i][5] === true || rows[i][5] === 'Y') { continue; }
      items.push({
        id: String(rows[i][0]),
        createdAt: rows[i][1] instanceof Date ? rows[i][1].toISOString() : String(rows[i][1]),
        name: String(rows[i][2]),
        message: String(rows[i][3])
      });
    }
    return json_({ ok: true, items: items });
  }

  return json_({ ok: false, error: 'UNKNOWN_ACTION' });
}

/* ---------- 저장 ---------- */

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'BAD_REQUEST' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err2) {
    return json_({ ok: false, error: 'BUSY' });
  }

  try {
    switch (body.action) {
      case 'guestbook': return addGuestbook_(body);
      case 'delete':    return deleteGuestbook_(body);
      case 'rsvp':      return addRsvp_(body);
      default:          return json_({ ok: false, error: 'UNKNOWN_ACTION' });
    }
  } finally {
    lock.releaseLock();
  }
}

function addGuestbook_(body) {
  var name = str_(body.name, 20);
  var message = str_(body.message, 300);
  var password = str_(body.password, 20);

  if (!name || !message || !password) {
    return json_({ ok: false, error: 'MISSING_FIELD' });
  }

  var sh = sheet_(SHEET_GUESTBOOK, ['id', '작성일시', '이름', '메시지', '비밀번호해시', '삭제됨']);
  var id = Utilities.getUuid();
  sh.appendRow([id, new Date(), name, message, hash_(password), false]);
  return json_({ ok: true, id: id });
}

function deleteGuestbook_(body) {
  var id = str_(body.id, 64);
  var password = str_(body.password, 20);
  if (!id || !password) { return json_({ ok: false, error: 'MISSING_FIELD' }); }

  var adminPw = PropertiesService.getScriptProperties().getProperty('ADMIN_PW');
  var isAdmin = adminPw && password === adminPw;

  var sh = sheet_(SHEET_GUESTBOOK, ['id', '작성일시', '이름', '메시지', '비밀번호해시', '삭제됨']);
  var last = sh.getLastRow();
  if (last < 2) { return json_({ ok: false, error: 'NOT_FOUND' }); }

  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) !== id) { continue; }
    var row = i + 2;
    if (!isAdmin && sh.getRange(row, 5).getValue() !== hash_(password)) {
      return json_({ ok: false, error: 'WRONG_PASSWORD' });
    }
    sh.getRange(row, 6).setValue(true);
    return json_({ ok: true });
  }
  return json_({ ok: false, error: 'NOT_FOUND' });
}

function addRsvp_(body) {
  var name = str_(body.name, 20);
  if (!name) { return json_({ ok: false, error: 'MISSING_FIELD' }); }

  var count = parseInt(body.count, 10);
  if (isNaN(count) || count < 1 || count > 20) { count = 1; }

  var sh = sheet_(SHEET_RSVP,
    ['제출일시', '구분', '참석여부', '성함', '인원', '식사', '전하실 말씀']);
  sh.appendRow([
    new Date(),
    str_(body.side, 10),
    str_(body.attend, 10),
    name,
    count,
    str_(body.meal, 10),
    str_(body.memo, 200)
  ]);
  return json_({ ok: true });
}
