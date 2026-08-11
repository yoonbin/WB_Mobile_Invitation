/* =============================================================
   모바일청첩장 동작 스크립트
   설정은 assets/js/config.js 에서만 바꾸세요. 이 파일은 손댈 필요 없습니다.
   ============================================================= */
(function () {
  'use strict';

  var C = window.CONFIG;
  if (!C) { return; }

  var IMG_DIR = 'assets/images/';
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- 자리표시 이미지 (사진이 아직 없을 때) ---------- */
  function placeholder(label) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">' +
      // 배경이 흰색이라 자리표시도 중성 회색으로 둔다(예전 값 #E6EAE1 은 연녹색이었다).
      // 사진을 넣기 전에는 이 자리표시가 갤러리 18칸을 전부 채우므로 눈에 가장 많이 띈다.
      '<rect width="300" height="400" fill="#F2F2F2"/>' +
      '<g fill="none" stroke="#2E4034" stroke-opacity=".16">' +
      '<path d="M0 100h300M0 200h300M0 300h300M100 0v400M200 0v400"/></g>' +
      '<text x="150" y="196" text-anchor="middle" font-family="serif" font-size="15" fill="#5C6159">사진 준비 중</text>' +
      '<text x="150" y="222" text-anchor="middle" font-family="monospace" font-size="11" fill="#8A9086">' +
      String(label || '').replace(/[<>&]/g, '') + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function withFallback(img, file) {
    img.onerror = function () {
      img.onerror = null;
      img.src = placeholder(file);
    };
    img.src = IMG_DIR + file;
  }

  /* ---------- 토스트 ---------- */
  var toastEl = $('#toast');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }

  function copy(text, okMsg) {
    var done = function () { toast(okMsg || '복사했습니다'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }
  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { toast('복사에 실패했습니다. 길게 눌러 복사해 주세요.'); }
    document.body.removeChild(ta);
  }

  /* ---------- data-bind 로 단순 텍스트 채우기 ---------- */
  function pick(path) {
    return path.split('.').reduce(function (o, k) { return (o == null ? o : o[k]); }, C);
  }
  $$('[data-bind]').forEach(function (el) {
    var v = pick(el.getAttribute('data-bind'));
    el.textContent = (v == null ? '' : v);
  });

  /* ---------- 메타 ----------
     주의: og: 태그는 여기서 건드리지 않는다.
     카카오톡·페이스북 스크래퍼는 자바스크립트를 실행하지 않으므로
     JS 로 넣은 og 태그는 링크 미리보기에 절대 반영되지 않는다.
     공유 미리보기 문구·이미지는 index.html <head> 에서 직접 고칠 것. */
  if (C.meta && C.meta.title) { document.title = C.meta.title; }

  /* =============================================================
     표지
     ============================================================= */
  var W = C.wedding || {};
  var weddingAt = new Date(W.datetime);
  var hasDate = !isNaN(weddingAt.getTime());
  var DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];

  withFallback($('#coverImage'), (C.gallery && C.gallery.cover) || 'cover.jpg');

  // 표지 날짜는 config 의 dateText 를 그대로 쓴다.
  // 예식 안내 섹션과 같은 문구가 되어 한 곳만 고치면 둘이 함께 바뀐다.
  if (hasDate) { $('#coverDate').textContent = W.dateText || koreanDate(weddingAt); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // dateText 를 비워둔 경우의 예비 표기: '2026년 11월 22일 일요일 오후 2시'
  function koreanDate(d) {
    var h = d.getHours();
    var mm = d.getMinutes();
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' +
      DOW_KR[d.getDay()] + '요일 ' + (h < 12 ? '오전 ' : '오후 ') +
      (h % 12 === 0 ? 12 : h % 12) + '시' + (mm ? ' ' + mm + '분' : '');
  }

  /* =============================================================
     인사말 · 혼주
     ============================================================= */
  var G = C.greeting || {};
  if (G.body) { $('#greetingBody').innerHTML = ''; appendLines($('#greetingBody'), G.body); }

  function appendLines(el, lines) {
    lines.forEach(function (line, i) {
      if (i) { el.appendChild(document.createElement('br')); }
      if (line) { el.appendChild(document.createTextNode(line)); }
    });
  }

  var familyEl = $('#family');
  [C.groom, C.bride].forEach(function (p) {
    if (!p) { return; }
    var row = document.createElement('p');
    row.className = 'family__row';

    var parents = [p.father && p.father.name, p.mother && p.mother.name].filter(Boolean).join(' · ');
    if (parents) {
      // 부모 이름 / 아들·딸 / 이름을 각각 따로 둔다.
      // 가운데 칸을 고정 폭으로 잡아야 '딸'(1자) 이 '아들'(2자) 자리 가운데에 놓인다.
      row.appendChild(span('family__parents', parents + '의'));
      row.appendChild(span('family__role', p.role || ''));
    }
    // 아버지 성이 바로 앞에 나오므로 이름만 적는다(전통적 표기). 오원빈 → 원빈
    // 부모 이름이 없으면 성을 떼면 누구인지 알 수 없으므로 그대로 둔다.
    row.appendChild(span('family__child', parents ? givenName(p) : p.name));
    familyEl.appendChild(row);
  });
  /* 성을 떼고 이름만 돌려준다 — 혼주 소개 줄에서만 쓴다.
     성은 "아버지 이름과 앞에서 겹치는 만큼"으로 구한다.
       '오성택' + '오원빈' → 겹침 '오'   → '원빈'
       '남궁성택' + '남궁원빈' → 겹침 '남궁' → '원빈'   (두 자 성도 맞는다)
       '오성택' + '원빈'   → 겹침 없음   → '원빈'      (config 에 이미 이름만 적힌 경우)
     글자 수를 세서 자르는 방식(slice(1))은 위 세 경우 중 하나에서 반드시 틀린다. */
  function givenName(p) {
    var f = (p.father && p.father.name) || '';
    var i = 0;
    // 이름을 통째로 먹지 않도록 마지막 한 글자는 남긴다
    while (i < f.length && i < p.name.length - 1 && f.charAt(i) === p.name.charAt(i)) { i++; }
    return p.name.slice(i);
  }

  function span(cls, text) {
    var s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  }

  /* ---------- 연락처 시트 ---------- */
  (function buildContacts() {
    var list = $('#contactList');
    var people = [];
    [['신랑', C.groom], ['신부', C.bride]].forEach(function (pair) {
      var label = pair[0], p = pair[1];
      if (!p) { return; }
      people.push([label, p.name, p.tel]);
      if (p.father) { people.push([label + ' 아버지', p.father.name, p.father.tel]); }
      if (p.mother) { people.push([label + ' 어머니', p.mother.name, p.mother.tel]); }
    });
    var shown = people.filter(function (x) { return x[2]; });

    if (!shown.length) {
      var none = document.createElement('p');
      none.className = 'prose prose--sm';
      none.textContent = '등록된 연락처가 없습니다.';
      list.appendChild(none);
      return;
    }

    shown.forEach(function (x) {
      var row = document.createElement('div');
      row.className = 'contact-row';

      var who = document.createElement('div');
      who.className = 'contact-row__who';
      who.appendChild(document.createTextNode(x[0] + ' '));
      var b = document.createElement('b');
      b.textContent = x[1];
      who.appendChild(b);

      var acts = document.createElement('div');
      acts.className = 'contact-row__acts';
      acts.appendChild(link('tel:' + x[2], '전화'));
      acts.appendChild(link('sms:' + x[2], '문자'));

      row.appendChild(who);
      row.appendChild(acts);
      list.appendChild(row);
    });
  })();
  function link(href, text) {
    var a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    return a;
  }

  /* =============================================================
     매초 갱신 (D-day)
     -------------------------------------------------------------
     el 이 화면에 보이는 동안만 tick 을 1초마다 부른다.
     청첩장은 열어둔 채 방치되는 일이 많아, 매초 DOM 을 다시 만들면 배터리만 쓴다.

     단, 기본값은 "돌아가는 쪽"이다(fail-open).
     IntersectionObserver 가 콜백을 늦게 주거나 아예 주지 않는 환경이 있는데,
     기본값을 멈춤으로 두면 카운터가 로드 시점 값에 얼어붙어 고장난 것처럼 보인다.
     관찰자가 "화면 밖"이라고 확인해 준 경우에만 끈다.

     tick 이 false 를 돌려주면 더 셀 것이 없다는 뜻이므로 영구히 멈춘다.
     ============================================================= */
  function tickWhileVisible(el, tick) {
    var timer = null;
    var onScreen = true;
    var done = false;

    function run() { if (tick() === false) { done = true; stop(); } }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      if (timer || done) { return; }
      run();
      // run() 안에서 끝났다고 알려오면 타이머를 아예 걸지 않는다
      if (!done) { timer = setInterval(run, 1000); }
    }
    function sync() { if (onScreen && !document.hidden) { start(); } else { stop(); } }

    // 첫 그림은 조건 없이 한 번 그린다.
    // 백그라운드 탭에서 열리면(카톡 링크를 새 탭으로 여는 흔한 경우) document.hidden 이 true 라,
    // 첫 렌더링까지 게이트 뒤에 두면 화면에 빈 줄만 남는다. 게이트는 '반복'에만 걸어야 한다.
    run();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        sync();
      }, { threshold: 0 }).observe(el);
    }
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  /* =============================================================
     달력 · D-day
     ============================================================= */
  // 달력 위 사진 (선택)
  (function calendarPhoto() {
    var file = (C.calendar && C.calendar.image) || '';
    if (!file) { return; }
    var box = $('#calPhoto');
    var img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    // 여기서는 자리표시로 대체하지 않는다. 없어도 되는 사진이라
    // 파일이 없으면 '사진 준비 중' 을 띄우는 대신 조용히 자리를 비운다.
    img.onerror = function () { box.hidden = true; };
    img.src = IMG_DIR + file;
    box.appendChild(img);
    box.hidden = false;
  })();

  if (hasDate) {
    $('#dateLine').textContent = W.dateText ||
      (weddingAt.getFullYear() + '년 ' + (weddingAt.getMonth() + 1) + '월 ' + weddingAt.getDate() + '일 ' +
       DOW_KR[weddingAt.getDay()] + '요일');

    var y = weddingAt.getFullYear(), m = weddingAt.getMonth();

    // 달력 위의 '11월' 표시
    $('#calMonth').textContent = (m + 1) + '월';

    // 요일 머리글은 한글 한 자(일 월 화 …). 일요일만 색을 달리한다.
    var head = $('#calHead');
    DOW_KR.forEach(function (d, i) {
      var c = document.createElement('span');
      if (i === 0) { c.className = 'cal__head--sun'; }
      c.textContent = d;
      head.appendChild(c);
    });

    var grid = $('#calGrid');
    var first = new Date(y, m, 1).getDay();
    var last = new Date(y, m + 1, 0).getDate();

    for (var i = 0; i < first; i++) { grid.appendChild(document.createElement('span')); }
    for (var d = 1; d <= last; d++) {
      var cell = document.createElement('span');
      cell.className = 'cal__day';
      var inner = document.createElement('span');
      inner.textContent = d;
      cell.appendChild(inner);
      if (d === weddingAt.getDate()) {
        cell.classList.add('cal__day--mark');
        cell.setAttribute('aria-label', '예식일 ' + (m + 1) + '월 ' + d + '일');
      }
      grid.appendChild(cell);
    }

    // 예식 시각(자정이 아니라 config 의 datetime)까지 남은 시간을 매초 센다.
    var weddingDay = new Date(y, m, weddingAt.getDate());   // 예식일 자정
    var dd = $('#dday');
    var flip = makeFlip($('#flip'), [['일', 3], ['시간', 2], ['분', 2], ['초', 2]]);
    var lastDays = null;

    function renderDday() {
      var now = new Date();
      var sec = Math.floor((weddingAt - now) / 1000);

      if (sec <= 0) {
        // 예식 시각이 지났어도 그날 하루는 '오늘'로 남긴다
        var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        $('#flip').hidden = true;
        dd.textContent = midnight.getTime() === weddingDay.getTime()
          ? '오늘은 저희가 결혼하는 날입니다'
          : '함께해 주셔서 감사합니다';
        return false;   // 더 셀 것이 없다 — 타이머를 멈춘다
      }

      var parts = [
        Math.floor(sec / 86400),
        Math.floor(sec / 3600) % 24,
        Math.floor(sec / 60) % 60,
        sec % 60
      ];
      flip.set(parts);

      // 플립은 aria-hidden 이므로 스크린리더가 읽을 문장을 따로 둔다.
      // 날짜(일)만 쓰므로 값이 바뀌는 하루에 한 번만 다시 그린다 —
      // 매초 다시 만들면 스크린리더가 같은 문장을 계속 다시 읽는다.
      if (parts[0] !== lastDays) {
        lastDays = parts[0];
        dd.innerHTML = '';
        // ♥ 는 장식이라 읽지 않게 한다. '원빈 하트 경란' 으로 읽히면 어색하다.
        var heart = document.createElement('span');
        heart.setAttribute('aria-hidden', 'true');
        heart.textContent = ' ♥ ';

        dd.appendChild(document.createTextNode(givenName(C.groom) || '신랑'));
        dd.appendChild(heart);
        dd.appendChild(document.createTextNode((givenName(C.bride) || '신부') + '의 결혼식이 '));
        var b = document.createElement('b');
        b.textContent = String(parts[0]);
        dd.appendChild(b);
        dd.appendChild(document.createTextNode('일 남았습니다.'));
      }
    }

    tickWhileVisible(dd, renderDday);
  }

  /* =============================================================
     플립 시계
     -------------------------------------------------------------
     units: [[라벨, 자릿수], ...]. set([값들]) 로 갱신한다.
     값이 바뀐 칸만 종이가 넘어가고, 안 바뀐 칸은 건드리지 않는다
     (매초 네 칸이 전부 펄럭이면 시끄럽다).
     ============================================================= */
  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // 종이 두 장이 넘어가는 데 걸리는 시간. style.css 의 .flip__flap 애니메이션
  // (0.42s + 0.42s 지연)과 맞춰야 한다. 한쪽만 고치면 카드가 덜 넘어간 채로 굳는다.
  var FLIP_MS = 880;

  function makeFlip(root, units) {
    if (!root) { return { set: function () {} }; }
    var cards = [];

    units.forEach(function (u) {
      var unit = document.createElement('div');
      unit.className = 'flip__unit';

      var card = document.createElement('div');
      card.className = 'flip__card';
      card.appendChild(half('flip__top', ''));
      card.appendChild(half('flip__bottom', ''));
      card.appendChild(half('flip__flap flip__flap--top', ''));
      card.appendChild(half('flip__flap flip__flap--bottom', ''));

      var label = document.createElement('span');
      label.className = 'flip__label';
      label.textContent = u[0];

      unit.appendChild(card);
      unit.appendChild(label);
      root.appendChild(unit);
      cards.push({ el: card, digits: u[1], value: null });
    });

    function half(cls, text) {
      var d = document.createElement('div');
      d.className = cls;
      var s = document.createElement('span');
      s.textContent = text;
      d.appendChild(s);
      return d;
    }
    function text(card, cls, v) { card.querySelector('.' + cls + ' span').textContent = v; }

    function set(values) {
      values.forEach(function (raw, i) {
        var c = cards[i];
        var next = String(raw);
        while (next.length < c.digits) { next = '0' + next; }
        if (next === c.value) { return; }

        var prev = c.value;
        c.value = next;

        // 첫 그림, 그리고 모션을 줄여 달라고 한 경우에는 넘기는 연출 없이 값만 앉힌다.
        // 후자에서 종이는 CSS 로 숨겨져 animationend 가 오지 않으므로,
        // 여기서 아래 절반까지 확정하지 않으면 옛 숫자가 그대로 남는다.
        if (prev === null || reduceMotion()) {
          text(c.el, 'flip__top', next);
          text(c.el, 'flip__bottom', next);
          return;
        }

        text(c.el, 'flip__top', next);          // 위 절반은 곧바로 새 값
        text(c.el, 'flip__bottom', prev);       // 아래 절반은 넘어갈 때까지 이전 값
        text(c.el, 'flip__flap--top', prev);    // 접히는 종이 = 이전 값
        text(c.el, 'flip__flap--bottom', next); // 펴지는 종이 = 새 값

        c.el.classList.remove('is-flipping');
        void c.el.offsetWidth;                  // 애니메이션을 처음부터 다시 돌린다
        c.el.classList.add('is-flipping');

        // 종이가 다 넘어가면 아래 절반을 새 값으로 확정한다.
        // animationend 에 맡기지 않는 이유: 배경 탭처럼 브라우저가 애니메이션을
        // 아예 돌리지 않는 상황에서는 그 이벤트가 오지 않아 카드가 중간 상태로 굳는다.
        // 시간으로 끊으면 애니메이션이 돌든 안 돌든 항상 제자리를 찾는다.
        clearTimeout(c.timer);
        c.timer = setTimeout(function () {
          c.el.classList.remove('is-flipping');
          text(c.el, 'flip__bottom', c.value);
        }, FLIP_MS);
      });
    }

    return { set: set };
  }

  /* =============================================================
     갤러리 · 라이트박스
     ============================================================= */
  var photos = (C.gallery && C.gallery.images) || [];
  (function buildGallery() {
    var grid = $('#galleryGrid');
    if (!photos.length) { $('#gallery').hidden = true; return; }

    // 처음에는 previewCount 장만 만든다. 나머지는 '더보기'를 눌렀을 때 만든다.
    // 미리 만들어 두고 숨기면 안 볼 사진까지 브라우저가 준비하게 된다.
    var preview = Number(C.gallery && C.gallery.previewCount) || photos.length;
    var shown = 0;
    var moreBtn = $('#galleryMore');

    function addCells(upto) {
      for (; shown < upto && shown < photos.length; shown++) {
        grid.appendChild(cell(photos[shown], shown));
      }
      var left = photos.length - shown;
      moreBtn.hidden = left <= 0;
      moreBtn.textContent = '사진 더보기 (' + left + '장)';
    }

    function cell(file, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'grid__cell';
      btn.setAttribute('aria-label', '사진 ' + (idx + 1) + '번 크게 보기');
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      // 디코드를 메인 스레드 밖으로 넘긴다. 12장을 한꺼번에 그릴 때
      // 화면이 멈춘 듯한 느낌을 줄인다.
      img.decoding = 'async';
      withFallback(img, file);
      btn.appendChild(img);
      btn.addEventListener('click', function () { openLightbox(idx); });
      return btn;
    }

    // 펼친 뒤에는 되돌릴 일이 없으므로 한 번에 전부 연다.
    moreBtn.addEventListener('click', function () {
      var first = shown;                       // 새로 생긴 첫 사진
      addCells(photos.length);
      var target = grid.children[first];
      if (target) { target.focus(); }          // 키보드·스크린리더가 이어서 읽도록
    });

    addCells(preview);
  })();

  var lb = $('#lightbox'), lbImg = $('#lbImg'), lbCount = $('#lbCount');
  var lbIndex = 0, lbOpener = null;

  function openLightbox(i) {
    lbOpener = document.activeElement;
    lbIndex = i;
    renderLightbox();
    lb.hidden = false;
    lockScroll(true);
    setPaperInert(true);
    $('.lightbox__close', lb).focus();
  }
  function renderLightbox() {
    var file = photos[lbIndex];
    // src 를 지우지 않고 바로 갈아끼운다. 지웠다 넣으면 캐시에 있는 사진도
    // 다시 디코드해서 한 번 흰 화면이 됐다가 뜬다 — 그게 '느리다'의 정체였다.
    withFallback(lbImg, file);
    lbImg.alt = '사진 ' + (lbIndex + 1);
    lbCount.textContent = (lbIndex + 1) + ' / ' + photos.length;

    // 좌우로 넘길 사진을 미리 받아 둔다. 넘기는 순간 기다릴 것이 없다.
    [lbIndex + 1, lbIndex - 1].forEach(function (i) {
      var f = photos[(i + photos.length) % photos.length];
      if (f) { new Image().src = IMG_DIR + f; }
    });
  }
  function moveLightbox(step) {
    lbIndex = (lbIndex + step + photos.length) % photos.length;
    renderLightbox();
  }
  function closeLightbox() {
    lb.hidden = true;
    if (!anyOverlayOpen()) { lockScroll(false); setPaperInert(false); }
    if (lbOpener) { lbOpener.focus(); lbOpener = null; }
  }
  $('#lbPrev').addEventListener('click', function () { moveLightbox(-1); });
  $('#lbNext').addEventListener('click', function () { moveLightbox(1); });
  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target.hasAttribute('data-close')) { closeLightbox(); }
  });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) { return; }
    if (e.key === 'Escape') { closeLightbox(); }
    if (e.key === 'ArrowLeft') { moveLightbox(-1); }
    if (e.key === 'ArrowRight') { moveLightbox(1); }
  });
  // 좌우 스와이프
  (function swipe() {
    var x0 = null, y0 = null;

    lb.addEventListener('touchstart', function (e) {
      // 손가락이 둘 이상이면 확대·축소하려는 것이다. 스와이프로 세지 않는다.
      // (핀치 중에 첫 손가락이 옆으로 꽤 움직여서 다음 사진으로 넘어가 버렸다)
      if (e.touches.length > 1) { x0 = y0 = null; return; }
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });

    // 도중에 손가락이 늘어나면(한 손가락으로 시작해 핀치로 바뀜) 그때도 취소한다.
    lb.addEventListener('touchmove', function (e) {
      if (e.touches.length > 1) { x0 = y0 = null; }
    }, { passive: true });

    lb.addEventListener('touchend', function (e) {
      if (x0 === null) { return; }
      var t = e.changedTouches[0];
      var dx = t.clientX - x0;
      var dy = t.clientY - y0;
      // 가로로 확실히 더 많이 움직였을 때만 사진을 넘긴다.
      // 확대한 사진을 위아래로 훑는 동작이 넘김으로 오해되는 것도 막는다.
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        moveLightbox(dx < 0 ? 1 : -1);
      }
      x0 = y0 = null;
    });
  })();

  /* =============================================================
     오시는 길
     ============================================================= */
  (function buildLocation() {
    var full = [W.address, W.addressDetail].filter(Boolean).join(' ');
    $('#addressText').textContent = full;
    $('#copyAddress').addEventListener('click', function () { copy(W.address || full, '주소를 복사했습니다'); });

    var name = [W.venue, W.hall].filter(Boolean).join(' ');
    var q = encodeURIComponent([W.venue, W.address].filter(Boolean).join(' '));
    var hasXY = W.lat && W.lng;

    $('#navNaver').href = 'https://map.naver.com/p/search/' + q;
    $('#navKakao').href = hasXY
      ? 'https://map.kakao.com/link/to/' + encodeURIComponent(name) + ',' + W.lat + ',' + W.lng
      : 'https://map.kakao.com/link/search/' + q;
    $('#navTmap').href = hasXY
      ? 'tmap://route?goalname=' + encodeURIComponent(name) + '&goalx=' + W.lng + '&goaly=' + W.lat
      : 'tmap://search?name=' + encodeURIComponent(W.venue || name);

    /* ---------- 지도 ----------
       발급받을 키도, 찾아 넣을 좌표도 없다. 주소(또는 좌표가 있으면 좌표)를
       그대로 넘기면 지도가 그 자리를 찾아 준다.

       왜 네이버 지도를 직접 띄우지 않는가:
       네이버 지도 API 는 네이버클라우드 콘솔에서 키를 발급받고 배포 도메인까지
       등록해야 한다. 청첩장 하나 띄우자고 넘기에는 문턱이 높다.
       대신 '네이버지도로 보기' 버튼을 얹어 두어, 누르면 네이버 지도로 넘어간다
       (그 링크는 키가 필요 없다). 아래 길찾기 버튼들도 마찬가지다.

       핀이 엉뚱한 곳에 찍히면 config 의 lat/lng 를 채운다 — 그러면 주소 대신
       좌표를 쓴다. 교정 수단은 이 하나로 충분하다. */
    (function naverMap() {
      var key = (W.naverMapClientId || '').trim();
      var box = $('#mapBox');

      // 좌표와 Client ID 가 모두 있어야 지도를 띄운다.
      // 하나라도 없으면 안내 문구를 그대로 두고 조용히 지나간다 —
      // 지도가 없어도 아래 주소와 길찾기 버튼으로 찾아올 수 있다.
      if (!hasXY || !key) {
        $('#mapPlaceholder').textContent = key
          ? 'config.js 의 lat · lng 를 채우면 지도가 나옵니다'
          : 'config.js 의 naverMapClientId 를 채우면 지도가 나옵니다';
        return;
      }

      var s = document.createElement('script');
      // ncpKeyId: 2024년 이후 발급 키. 예전에 발급한 키라면 ncpClientId 로 바꿔야 한다.
      s.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + encodeURIComponent(key);
      s.onerror = function () {
        $('#mapPlaceholder').textContent = '지도를 불러오지 못했습니다 (네트워크 확인)';
      };
      s.onload = function () {
        if (!window.naver || !window.naver.maps) {
          $('#mapPlaceholder').textContent = '지도 인증에 실패했습니다 (Client ID·서비스 URL 확인)';
          return;
        }
        var canvas = document.createElement('div');
        canvas.className = 'map__canvas';
        box.insertBefore(canvas, box.firstChild);
        $('#mapPlaceholder').hidden = true;

        var at = new window.naver.maps.LatLng(Number(W.lat), Number(W.lng));
        var map = new window.naver.maps.Map(canvas, {
          center: at,
          zoom: 16,
          // 주변을 둘러볼 수 있게 이동·확대를 연다.
          draggable: true,
          pinchZoom: true,
          keyboardShortcuts: true,
          zoomControl: true,
          zoomControlOptions: { position: window.naver.maps.Position.TOP_RIGHT },
          // 마우스 휠만 잠근다. 페이지를 굴려 내려오다 포인터가 지도에 걸리면
          // 스크롤이 지도 확대로 먹혀서 페이지가 멈춘 것처럼 보인다.
          scrollWheel: false,
          scaleControl: false,
          mapDataControl: false
        });

        // 마커: 빨간 핀 안에 하트, 아래에 예식장 이름.
        // 좌표가 가리키는 지점은 핀의 뾰족한 끝(anchor 32,44)이다.
        new window.naver.maps.Marker({
          position: at,
          map: map,
          title: name,
          icon: {
            content:
              '<div class="mappin">' +
                '<svg class="mappin__pin" viewBox="0 0 64 88" aria-hidden="true" focusable="false">' +
                  '<path fill="#E23B47" d="M32 0C14.3 0 0 14.3 0 32c0 21.3 32 56 32 56s32-34.7 32-56C64 14.3 49.7 0 32 0z"/>' +
                  '<path fill="#FFFFFF" d="M32 48.6l-2.6-2.4C22.1 39.6 17 34.9 17 29.2c0-4.6 3.6-8.2 8.2-8.2 2.6 0 5.1 1.2 6.8 3.1 1.7-1.9 4.2-3.1 6.8-3.1 4.6 0 8.2 3.6 8.2 8.2 0 5.7-5.1 10.4-12.4 17l-2.6 2.4z"/>' +
                '</svg>' +
                // HTML 문자열로 넘기는 자리라 꺾쇠·앰퍼샌드를 걷어낸다.
                // 홀 이름까지 붙이면 길어서 예식장 이름만 쓴다.
                '<span class="mappin__label">' +
                  String(W.venue || '').replace(/[<>&"]/g, '') +
                '</span>' +
              '</div>',
            anchor: new window.naver.maps.Point(32, 44)
          }
        });

        // 자세히 보거나 길찾기는 네이버지도 앱·웹으로 넘긴다.
        var a = link('https://map.naver.com/p/search/' + q, '네이버지도로 보기');
        a.className = 'map__open';
        a.target = '_blank';
        a.rel = 'noopener';
        box.appendChild(a);
      };
      document.head.appendChild(s);
    })();

    var t = $('#transport');
    (W.transport || []).forEach(function (item) {
      var wrap = document.createElement('div');
      wrap.className = 'transport__item';
      var dt = document.createElement('dt');
      dt.textContent = item.label;
      var dd = document.createElement('dd');
      dd.textContent = item.desc;
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      t.appendChild(wrap);
    });
    if (!(W.transport || []).length) { t.hidden = true; }

    if (W.venueTel) {
      var tel = $('#venueTel');
      tel.hidden = false;
      tel.appendChild(document.createTextNode('예식장 문의 '));
      tel.appendChild(link('tel:' + W.venueTel, W.venueTel));
    }
  })();

  /* =============================================================
     마음 전하실 곳
     ============================================================= */
  (function accounts() {
    var A = C.account || {};
    if (!A.enabled) { return; }

    var valid = function (list) {
      return (list || []).filter(function (x) { return x.bank && x.number; });
    };
    var sides = [
      { title: '신랑측 계좌번호', people: valid(A.groomSide) },
      { title: '신부측 계좌번호', people: valid(A.brideSide) }
    ].filter(function (s) { return s.people.length; });

    if (!sides.length) { return; }

    $('#account').hidden = false;
    if (A.message) { appendLines($('#accountMessage'), A.message); }

    var wrap = $('#accountList');
    sides.forEach(function (side) {
      var acc = document.createElement('div');
      acc.className = 'acc';

      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'acc__head';
      head.setAttribute('aria-expanded', 'false');
      head.appendChild(document.createTextNode(side.title));

      var body = document.createElement('div');
      body.className = 'acc__body';

      side.people.forEach(function (p) {
        var row = document.createElement('div');
        row.className = 'bank';

        var who = document.createElement('p');
        who.className = 'bank__who';
        who.textContent = p.role + ' ' + p.name;

        var num = document.createElement('div');
        num.className = 'bank__num';
        num.appendChild(document.createTextNode(p.bank + ' ' + p.number));
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip';
        btn.textContent = '복사';
        btn.addEventListener('click', function () {
          copy(p.bank + ' ' + p.number, '계좌번호를 복사했습니다');
        });
        num.appendChild(btn);

        row.appendChild(who);
        row.appendChild(num);
        if (p.kakaopay) {
          var k = link(p.kakaopay, '카카오페이로 송금');
          k.className = 'bank__kakao';
          k.target = '_blank';
          k.rel = 'noopener';
          row.appendChild(k);
        }
        body.appendChild(row);
      });

      head.addEventListener('click', function () {
        var open = acc.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(open));
      });

      acc.appendChild(head);
      acc.appendChild(body);
      wrap.appendChild(acc);
    });
  })();

  /* =============================================================
     서버 통신 (Google Apps Script)
     ============================================================= */
  var GAS = (C.gasUrl || '').trim();

  function api(payload) {
    if (!GAS) { return Promise.reject(new Error('NO_ENDPOINT')); }
    return fetch(GAS, {
      method: 'POST',
      // text/plain 으로 보내야 사전요청(preflight) 없이 통과합니다
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function apiList() {
    if (!GAS) { return Promise.reject(new Error('NO_ENDPOINT')); }
    return fetch(GAS + '?action=list&t=' + Date.now()).then(function (r) { return r.json(); });
  }

  /* =============================================================
     방명록
     ============================================================= */
  (function guestbook() {
    var GB = C.guestbook || {};
    if (!GB.enabled) { return; }
    $('#guestbook').hidden = false;

    var listEl = $('#gbList');
    var moreBtn = $('#gbMore');
    var form = $('#gbForm');
    var err = $('#gbError');
    var items = [];
    var shownCount = 5;

    /* 삭제 권한을 비밀번호 대신 '이 기기가 쓴 글인가'로 판단한다.
       글을 남길 때 임의의 토큰을 만들어 서버에 함께 보내고 이 기기에도 저장해 둔다.
       삭제 버튼은 토큰을 가진 글에만 보이고, 서버도 토큰이 맞아야 지운다.
       하객이 외울 것이 없고, 남의 글을 지우려면 토큰을 알아야 한다.
       한계: 기기를 바꾸거나 브라우저 저장소를 지우면 본인 글도 못 지운다
             (그때는 신랑·신부가 구글 시트에서 직접 지우면 된다). */
    var MINE_KEY = 'gbMine';
    function mine() {
      try { return JSON.parse(localStorage.getItem(MINE_KEY)) || {}; }
      catch (e) { return {}; }
    }
    function remember(id, token) {
      var m = mine();
      m[id] = token;
      try { localStorage.setItem(MINE_KEY, JSON.stringify(m)); } catch (e) { /* 저장 못 해도 글은 남는다 */ }
    }
    function forget(id) {
      var m = mine();
      delete m[id];
      try { localStorage.setItem(MINE_KEY, JSON.stringify(m)); } catch (e) {}
    }
    function newToken() {
      if (window.crypto && window.crypto.randomUUID) { return window.crypto.randomUUID(); }
      if (window.crypto && window.crypto.getRandomValues) {
        var a = new Uint8Array(16);
        window.crypto.getRandomValues(a);
        return Array.prototype.map.call(a, function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      }
      // 구형 브라우저 예비책. 추측 난이도는 낮지만 방명록에는 충분하다.
      return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    function render() {
      listEl.innerHTML = '';
      if (!items.length) {
        var empty = document.createElement('li');
        empty.className = 'gb-empty';
        empty.textContent = '아직 작성된 방명록이 없습니다. 첫 축하 인사를 남겨주세요.';
        listEl.appendChild(empty);
        moreBtn.hidden = true;
        return;
      }
      items.slice(0, shownCount).forEach(function (it) {
        var li = document.createElement('li');
        li.className = 'gb-item';

        var top = document.createElement('div');
        top.className = 'gb-item__top';
        top.appendChild(span('gb-item__name', it.name));
        top.appendChild(span('gb-item__date', formatDate(it.createdAt)));

        var msg = document.createElement('p');
        msg.className = 'gb-item__msg';
        msg.textContent = it.message;

        li.appendChild(top);
        li.appendChild(msg);

        // 이 기기에서 남긴 글에만 삭제 버튼을 붙인다
        if (mine()[it.id]) {
          var del = document.createElement('button');
          del.type = 'button';
          del.className = 'gb-item__del';
          del.textContent = '삭제';
          del.addEventListener('click', function () { removeEntry(it.id); });
          li.appendChild(del);
        }
        listEl.appendChild(li);
      });
      moreBtn.hidden = items.length <= shownCount;
    }

    function formatDate(iso) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) { return ''; }
      return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
    }

    function removeEntry(id) {
      var token = mine()[id];
      if (!token) { return; }
      if (!window.confirm('남기신 축하 메시지를 지울까요?')) { return; }
      api({ action: 'delete', id: id, token: token }).then(function (res) {
        if (!res || !res.ok) { throw new Error(res && res.error || 'FAIL'); }
        forget(id);
        toast('삭제했습니다');
        load();
      }).catch(function (e) {
        // 서버에 이미 없는 글이면 이 기기의 기록도 정리한다
        if (e.message === 'NOT_FOUND') { forget(id); load(); }
        toast('삭제하지 못했습니다');
      });
    }

    function load() {
      apiList().then(function (res) {
        items = (res && res.items) || [];
        render();
      }).catch(function () {
        listEl.innerHTML = '';
        var li = document.createElement('li');
        li.className = 'gb-empty';
        li.textContent = GAS ? '방명록을 불러오지 못했습니다.' : '방명록은 준비 중입니다.';
        listEl.appendChild(li);
        moreBtn.hidden = true;
      });
    }

    moreBtn.addEventListener('click', function () { shownCount += 5; render(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      // 구글 앱스 스크립트는 처음 깨어날 때 몇 초가 걸린다. 그건 줄일 수 없으니
      // 기다리는 중이라는 것만 확실히 보여 준다. 아무 반응이 없으면 하객이
      // 버튼을 다시 누른다.
      submit.textContent = '보내는 중…';

      var data = new FormData(form);
      var token = newToken();
      var entry = {
        name: (data.get('name') || '').trim(),
        message: (data.get('message') || '').trim()
      };

      api({
        action: 'guestbook',
        name: entry.name,
        message: entry.message,
        token: token
      }).then(function (res) {
        if (!res || !res.ok) { throw new Error(res && res.error || 'FAIL'); }
        // 서버가 준 id 와 짝지어 저장해야 나중에 이 글을 지울 수 있다
        if (res.id) { remember(res.id, token); }
        closeSheet($('#gbSheet'));
        form.reset();
        toast('축하 메시지를 남겼습니다. 감사합니다.');

        // 목록을 다시 받아오지 않고 방금 쓴 글을 바로 얹는다.
        // 재조회는 앱스 스크립트를 한 번 더 깨우는 일이라 그만큼 더 기다리게 된다.
        items.unshift({
          id: res.id,
          createdAt: new Date().toISOString(),
          name: entry.name,
          message: entry.message
        });
        render();
      }).catch(function (e2) {
        err.hidden = false;
        err.textContent = e2.message === 'NO_ENDPOINT'
          ? '아직 저장 기능이 연결되지 않았습니다. (gasUrl 설정 필요)'
          : '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.';
      }).then(function () {
        submit.disabled = false;
        submit.textContent = '남기기';
      });
    });

    load();
  })();

  /* =============================================================
     공유하기
     ============================================================= */
  (function share() {
    var btn = $('#shareBtn');
    var K = C.kakao || {};

    if (K.appKey) {
      var s = document.createElement('script');
      s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
      s.onload = function () {
        try { window.Kakao.init(K.appKey); } catch (e) { /* 앱키 오류 시 링크 복사로 동작 */ }
      };
      document.head.appendChild(s);
    }

    // 공유 문구·이미지의 원본은 index.html 의 og: 태그다.
    // 카카오 공유 버튼도 같은 값을 써야 링크 미리보기와 내용이 어긋나지 않는다.
    function og(prop, fallback) {
      var m = document.querySelector('meta[property="' + prop + '"]');
      var v = m && m.getAttribute('content');
      // 배포 주소를 아직 안 바꾼 상태면 그 값은 쓰지 않는다
      if (!v || v.indexOf('여기에-배포주소') !== -1) { return fallback || ''; }
      return v;
    }

    btn.addEventListener('click', function () {
      var url = location.href;
      var title = og('og:title', (C.meta && C.meta.title) || document.title);
      var desc = og('og:description', (C.meta && C.meta.description) || '');
      var image = og('og:image', '');

      if (window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized()) {
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: title,
            description: desc,
            imageUrl: image,
            link: { mobileWebUrl: url, webUrl: url }
          },
          buttons: [{ title: '청첩장 보기', link: { mobileWebUrl: url, webUrl: url } }]
        });
        return;
      }
      if (navigator.share) {
        navigator.share({ title: title, text: desc, url: url }).catch(function () {});
        return;
      }
      copy(url, '청첩장 주소를 복사했습니다');
    });
  })();

  /* =============================================================
     배경음악
     ============================================================= */
  (function bgm() {
    var B = C.bgm || {};
    if (!B.file) { return; }

    var audio = new Audio('assets/audio/' + B.file);
    audio.loop = true;
    audio.volume = .5;

    var btn = $('#bgmToggle');
    btn.hidden = false;

    function setState(on) {
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? '배경음악 끄기' : '배경음악 켜기');
    }
    btn.addEventListener('click', function () {
      if (audio.paused) { audio.play().then(function () { setState(true); }, function () { toast('재생할 수 없습니다'); }); }
      else { audio.pause(); setState(false); }
    });

    if (B.autoplay) {
      audio.play().then(function () { setState(true); }, function () { /* 브라우저가 막으면 버튼으로 */ });
    }
  })();

  /* =============================================================
     시트(모달) 공통
     ============================================================= */
  var sheetOpener = null;
  var paperEl = $('.paper');

  function lockScroll(on) {
    document.body.style.overflow = on ? 'hidden' : '';
  }
  function anyOverlayOpen() {
    return !!document.querySelector('.sheet:not([hidden]), .lightbox:not([hidden])');
  }
  // 모달이 열려 있는 동안 뒤쪽 본문은 탭 이동에서도, 스크린리더에서도 빠진다.
  // inert 한 줄이 포커스 트랩과 aria-hidden 을 동시에 해결한다.
  function setPaperInert(on) {
    if (!paperEl) { return; }
    if (on) { paperEl.setAttribute('inert', ''); }
    else { paperEl.removeAttribute('inert'); }
  }

  function openSheet(el) {
    if (!el) { return; }
    sheetOpener = document.activeElement;
    el.hidden = false;
    lockScroll(true);
    setPaperInert(true);
    var focusable = el.querySelector('input, select, textarea, button');
    if (focusable) { focusable.focus(); }
  }
  function closeSheet(el) {
    if (!el) { return; }
    el.hidden = true;
    if (!anyOverlayOpen()) { lockScroll(false); setPaperInert(false); }
    // inert 를 푼 뒤에 포커스를 돌려줘야 실제로 포커스가 들어간다
    if (sheetOpener) { sheetOpener.focus(); sheetOpener = null; }
  }

  $$('[data-open]').forEach(function (btn) {
    btn.addEventListener('click', function () { openSheet($('#' + btn.getAttribute('data-open'))); });
  });
  $$('.sheet').forEach(function (sheet) {
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet || e.target.hasAttribute('data-close')) { closeSheet(sheet); }
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') { return; }
    var open = document.querySelector('.sheet:not([hidden])');
    if (open) { closeSheet(open); }
  });

  /* =============================================================
     사진 저장·복사 막기
     -------------------------------------------------------------
     CSS 로 길게 누르기·끌기·선택을 막고, 여기서 우클릭 메뉴와
     끌어놓기를 한 번 더 막는다.

     ※ 완전히 막을 수는 없다. 화면 캡처와 개발자도구는 어떤 방법으로도 못 막고,
       주소를 알면 사진 파일을 그대로 받을 수 있다.
       '무심코 저장'을 막는 문턱일 뿐이라는 점을 전제로 둔 코드다.
     ============================================================= */
  document.addEventListener('contextmenu', function (e) {
    if (e.target && e.target.tagName === 'IMG') { e.preventDefault(); }
  });
  document.addEventListener('dragstart', function (e) {
    if (e.target && e.target.tagName === 'IMG') { e.preventDefault(); }
  });

})();
