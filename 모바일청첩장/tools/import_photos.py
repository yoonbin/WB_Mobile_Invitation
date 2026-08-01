# -*- coding: utf-8 -*-
"""
청첩장 사진 채우기

사진 폴더(또는 사진 파일들)를 받아서
  · 회전 정보(EXIF)를 반영해 똑바로 세우고
  · 위치정보(GPS) 등 EXIF 를 전부 제거하고        ← 공개 페이지라 중요합니다
  · 휴대폰에서 빠르게 열리는 크기로 줄이고
  · cover.jpg / gallery-01.jpg ... 로 이름을 바꿔 assets/images 에 넣고
  · config.js 의 갤러리 목록과 index.html 의 캐시 번호까지 맞춰줍니다.

쓰는 법은 두 가지입니다.
  1) 사진넣기.bat 에 폴더나 사진들을 끌어다 놓기   (권장)
  2) python tools/import_photos.py "사진폴더경로"
"""

import os
import re
import sys
import shutil

try:
    from PIL import Image, ImageOps
except ImportError:
    print('\n[오류] Pillow 라이브러리가 없습니다.')
    print('  다음 명령을 한 번 실행한 뒤 다시 시도하세요:\n')
    print('  pip install Pillow\n')
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, 'assets', 'images')
CONFIG = os.path.join(ROOT, 'assets', 'js', 'config.js')
INDEX = os.path.join(ROOT, 'index.html')

READABLE = ('.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff')
NEEDS_CONVERT = ('.heic', '.heif')

# (최대 가로, 최대 세로) — 비율은 유지합니다. 잘라내기는 화면(CSS)이 알아서 합니다.
COVER_MAX = (1000, 1400)
GALLERY_MAX = (1400, 1400)
SHARE_SIZE = (1200, 630)   # 카카오톡 링크 미리보기용 (2:1 에 가까운 고정 크기)
QUALITY = 82


def log(msg=''):
    print(msg)


# 편집기나 브라우저에서 경로를 복사해 오면 BOM(﻿)이나 폭 없는 공백이 섞여 들어온다.
# 눈에 보이지 않아서 "경로 없음" 이라는 엉뚱한 메시지만 보게 되므로 미리 걷어낸다.
INVISIBLE = '﻿​‌‍⁠ '


def clean_path(raw):
    s = ''.join(ch for ch in str(raw) if ch not in INVISIBLE)
    s = s.strip().strip('"').strip("'").strip()
    return s


def collect(paths):
    """받은 경로들에서 이미지 파일을 모은다. 폴더면 그 안을 훑는다."""
    found, skipped = [], []
    for raw in paths:
        p = clean_path(raw)
        if not p:
            continue
        if os.path.isdir(p):
            for name in sorted(os.listdir(p)):
                full = os.path.join(p, name)
                if os.path.isfile(full):
                    classify(full, found, skipped)
        elif os.path.isfile(p):
            classify(p, found, skipped)
        else:
            log('  건너뜀 (경로 없음): %s' % p)
    return found, skipped


def classify(path, found, skipped):
    ext = os.path.splitext(path)[1].lower()
    if ext in READABLE:
        found.append(path)
    elif ext in NEEDS_CONVERT:
        skipped.append(path)


def load(path):
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)          # 세로로 찍은 사진 바로 세우기
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')
    elif img.mode == 'L':
        img = img.convert('RGB')
    return img


def save_fitted(img, dest, max_size):
    out = img.copy()
    out.thumbnail(max_size, Image.LANCZOS)
    # exif 를 넘기지 않으므로 촬영 위치·기기 정보가 저장되지 않습니다
    out.save(dest, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    return os.path.getsize(dest)


def save_share(img, dest):
    """링크 미리보기용 고정 비율 이미지. 인물 사진을 가로로 자르므로 위쪽을 남긴다."""
    target_w, target_h = SHARE_SIZE
    src_ratio = img.width / img.height
    target_ratio = target_w / target_h

    if src_ratio > target_ratio:                # 원본이 더 가로로 넓다 → 좌우를 자름
        new_w = int(img.height * target_ratio)
        left = (img.width - new_w) // 2
        box = (left, 0, left + new_w, img.height)
    else:                                       # 원본이 더 세로로 길다 → 위쪽 위주로 남김
        new_h = int(img.width / target_ratio)
        top = int((img.height - new_h) * 0.28)  # 얼굴이 보통 위쪽 1/3 에 있다
        box = (0, top, img.width, top + new_h)

    out = img.crop(box).resize(SHARE_SIZE, Image.LANCZOS)
    out.save(dest, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    return os.path.getsize(dest)


def kb(n):
    return '%d KB' % round(n / 1024)


def update_config(count):
    if not os.path.exists(CONFIG):
        return False
    with open(CONFIG, encoding='utf-8') as f:
        text = f.read()

    names = ["'gallery-%02d.jpg'" % (i + 1) for i in range(count)]
    lines = []
    for i in range(0, len(names), 3):
        lines.append('      ' + ', '.join(names[i:i + 3]) + ',')
    if lines:
        lines[-1] = lines[-1].rstrip(',')
    block = 'images: [\n' + '\n'.join(lines) + '\n    ]'

    new_text, n = re.subn(r'images:\s*\[[^\]]*\]', block, text, count=1)
    if n == 0:
        return False
    with open(CONFIG, 'w', encoding='utf-8') as f:
        f.write(new_text)
    return True


def bump_cache_version():
    """?v=1 → ?v=2 : 하객 휴대폰이 예전 사진을 계속 보여주는 걸 막는다."""
    if not os.path.exists(INDEX):
        return None
    with open(INDEX, encoding='utf-8') as f:
        text = f.read()

    versions = [int(v) for v in re.findall(r'\?v=(\d+)', text)]
    if not versions:
        return None
    nxt = max(versions) + 1
    text = re.sub(r'\?v=\d+', '?v=%d' % nxt, text)
    with open(INDEX, 'w', encoding='utf-8') as f:
        f.write(text)
    return nxt


def main(argv):
    log()
    log('=' * 52)
    log('  청첩장 사진 채우기')
    log('=' * 52)

    if not argv:
        log()
        log('사진이 든 폴더를 이 창에 끌어다 놓고 Enter 를 누르세요.')
        log('(취소하려면 그냥 Enter)')
        log()
        try:
            typed = clean_path(input('> '))
        except EOFError:
            typed = ''
        if not typed:
            log('취소했습니다.')
            return 0
        argv = [typed]

    found, skipped = collect(argv)

    if skipped:
        log()
        log('[안내] 아이폰 HEIC 사진 %d장은 이 도구가 읽지 못합니다.' % len(skipped))
        log('  해결 방법 중 하나를 쓰세요.')
        log('   · 아이폰: 설정 → 카메라 → 포맷 → "높은 호환성" 으로 바꾸고 다시 촬영/전송')
        log('   · 이미 찍은 사진: 아이폰에서 카카오톡·메일로 보내면 대개 JPG 로 변환됩니다')
        log('   · PC에서 변환: pip install pillow-heif 설치 후 이 도구를 다시 실행')

    if not found:
        log()
        log('[중단] 처리할 사진을 찾지 못했습니다.')
        log('  읽을 수 있는 형식: %s' % ', '.join(READABLE))
        return 1

    found.sort(key=lambda p: os.path.basename(p).lower())

    log()
    log('사진 %d장을 찾았습니다.' % len(found))
    log('  첫 번째 사진이 표지가 됩니다: %s' % os.path.basename(found[0]))
    log('  나머지 %d장은 갤러리로 들어갑니다.' % max(0, len(found) - 1))
    log()
    log('assets/images 폴더의 기존 cover.jpg / gallery-*.jpg 는 덮어씁니다.')
    try:
        answer = input('진행할까요? (y/n) > ').strip().lower()
    except EOFError:
        answer = 'y'
    if answer not in ('y', 'yes', '예', 'ㅇ', ''):
        log('취소했습니다.')
        return 0

    if not os.path.isdir(IMAGES):
        os.makedirs(IMAGES)

    # 기존 갤러리 파일 정리 (장수가 줄어들 때 옛 파일이 남지 않도록)
    for name in os.listdir(IMAGES):
        if re.match(r'^gallery-\d+\.jpg$', name):
            os.remove(os.path.join(IMAGES, name))

    log()
    total = 0

    cover_img = load(found[0])
    size = save_fitted(cover_img, os.path.join(IMAGES, 'cover.jpg'), COVER_MAX)
    total += size
    log('  표지    cover.jpg        %s' % kb(size))

    size = save_share(cover_img, os.path.join(IMAGES, 'share.jpg'))
    total += size
    log('  공유용  share.jpg        %s  (카카오톡 미리보기)' % kb(size))

    gallery_sources = found[1:] if len(found) > 1 else found
    for i, src in enumerate(gallery_sources, start=1):
        name = 'gallery-%02d.jpg' % i
        size = save_fitted(load(src), os.path.join(IMAGES, name), GALLERY_MAX)
        total += size
        log('  갤러리  %-16s %s' % (name, kb(size)))

    log()
    log('  합계 %s' % kb(total))
    if total > 6 * 1024 * 1024:
        log('  [주의] 전체 용량이 큽니다. 사진 장수를 줄이면 하객 데이터가 절약됩니다.')

    log()
    if update_config(len(gallery_sources)):
        log('  config.js 갤러리 목록을 %d장으로 맞췄습니다.' % len(gallery_sources))
    else:
        log('  [확인 필요] config.js 를 자동으로 못 고쳤습니다. gallery.images 목록을 직접 맞춰주세요.')

    nxt = bump_cache_version()
    if nxt:
        log('  index.html 캐시 번호를 v=%d 로 올렸습니다.' % nxt)

    log()
    log('-' * 52)
    log('완료했습니다. 브라우저에서 index.html 을 새로고침해 확인하세요.')
    log()
    log('확인할 것')
    log('  · 표지 사진 윗부분이 아치(둥근 모양)로 잘립니다. 머리가 잘리지 않았는지')
    log('  · share.jpg 는 가로로 잘린 이미지입니다. 얼굴이 어색하면 직접 만들어 교체하세요')
    log('  · 사진 순서를 바꾸려면 원본 파일 이름을 01_, 02_ 처럼 붙여 다시 실행하세요')
    log('-' * 52)
    return 0


if __name__ == '__main__':
    try:
        code = main(sys.argv[1:])
    except KeyboardInterrupt:
        log('\n중단했습니다.')
        code = 130
    sys.exit(code)
