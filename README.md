# Retro Heli FPS Defense - GitHub Multi File Edition

업로드된 단일 HTML 게임을 GitHub Pages 배포용 멀티파일 구조로 분리한 버전입니다.

## 실행

1. 이 폴더 전체를 GitHub 저장소에 업로드합니다.
2. Settings → Pages → Deploy from a branch → main / root 선택
3. 생성된 Pages 주소로 접속합니다.

## 파일 구조

```txt
index.html
style.css
config.js
game.js
assets/images/*.svg
assets/sounds/README.txt
```

## 이미지 교체 방법

`assets/images` 안의 SVG 파일을 같은 이름의 PNG/WebP/SVG로 교체하거나, `config.js`에서 경로만 바꾸면 됩니다.

권장 파일명은 영어 소문자와 밑줄만 사용하세요. 예: `attack_heli.webp`

## 배포 주의

GitHub Pages는 대소문자 경로를 구분합니다. `assets/images/bg_city.svg`와 `Assets/Images/bg_city.svg`는 서로 다릅니다.
