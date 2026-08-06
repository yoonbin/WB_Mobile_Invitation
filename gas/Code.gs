/**
 * 모바일청첩장 백엔드 (Google Apps Script)
 * 방명록을 구글 시트에 저장합니다.
 *
 * 배포 방법은 gas/README.md 를 보세요.
 *
 * 삭제 권한에 대하여
 * -----------------
 * 하객에게 비밀번호를 받지 않습니다. 대신 글을 남길 때 청첩장이 임의의 토큰을
 * 만들어 함께 보내고, 그 토큰을 하객 휴대폰에도 저장해 둡니다.
 * 삭제할 때 같은 토큰을 보내야 지워지므로, 글을 쓴 그 기기에서만 삭제됩니다.
 * 토큰은 그대로 두지 않고 해시로 바꿔 저장하므로 시트를 봐도 알 수 없습니다.
 *
 * 스팸 글을 지워야 할 때는 스크립트 속성에 ADMIN_PW 를 넣어 두고
 * 그 값을 token 으로 보내면 어떤 글이든 지울 수 있습니다.
 * (파일 > 프로젝트 설정 > 스크립트 속성 에서 추가)
 */

var SHEET_GUESTBOOK = '방명록';
var HEADERS = ['id', '작성일시', '이름', '메시지', '삭제토큰해시', '삭제됨'];

/* ---------- 공통 ---------- */

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_GUESTBOOK);
  if (!sh) {
    sh = ss.insertSheet(SHEET_GUESTBOOK);
    sh.appendRow(HEADERS);
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
  if (action !== 'list') { return json_({ ok: false, error: 'UNKNOWN_ACTION' }); }

  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) { return json_({ ok: true, items: [] }); }

  var rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var items = [];
  // 최근 글이 위로 오도록 뒤에서부터 담는다
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i][5] === true || rows[i][5] === 'Y') { continue; }
    items.push({
      id: String(rows[i][0]),
      createdAt: rows[i][1] instanceof Date ? rows[i][1].toISOString() : String(rows[i][1]),
      name: String(rows[i][2]),
      message: String(rows[i][3])
      // 토큰 해시는 절대 내보내지 않는다
    });
  }
  return json_({ ok: true, items: items });
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
      default:          return json_({ ok: false, error: 'UNKNOWN_ACTION' });
    }
  } finally {
    lock.releaseLock();
  }
}

function addGuestbook_(body) {
  var name = str_(body.name, 20);
  var message = str_(body.message, 300);
  var token = str_(body.token, 100);

  if (!name || !message || !token) {
    return json_({ ok: false, error: 'MISSING_FIELD' });
  }

  var id = Utilities.getUuid();
  sheet_().appendRow([id, new Date(), name, message, hash_(token), false]);
  // 청첩장이 이 id 와 토큰을 짝지어 저장해 두었다가 삭제할 때 쓴다
  return json_({ ok: true, id: id });
}

function deleteGuestbook_(body) {
  var id = str_(body.id, 64);
  var token = str_(body.token, 100);
  if (!id || !token) { return json_({ ok: false, error: 'MISSING_FIELD' }); }

  var adminPw = PropertiesService.getScriptProperties().getProperty('ADMIN_PW');
  var isAdmin = adminPw && token === adminPw;

  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) { return json_({ ok: false, error: 'NOT_FOUND' }); }

  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) !== id) { continue; }
    var row = i + 2;
    if (!isAdmin && sh.getRange(row, 5).getValue() !== hash_(token)) {
      return json_({ ok: false, error: 'FORBIDDEN' });
    }
    // 줄을 지우지 않고 '삭제됨' 으로 표시만 한다. 실수로 지웠을 때 되살릴 수 있다.
    sh.getRange(row, 6).setValue(true);
    return json_({ ok: true });
  }
  return json_({ ok: false, error: 'NOT_FOUND' });
}
