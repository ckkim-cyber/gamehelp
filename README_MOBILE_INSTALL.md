# 모바일 설치 방법

이 앱은 PWA로 구성되어 있어 HTTPS 주소로 배포하면 휴대폰 홈 화면에 설치할 수 있습니다.

## 배포 후 설치

### Android Chrome

1. 배포된 HTTPS 주소를 Chrome에서 엽니다.
2. 우측 상단 메뉴를 누릅니다.
3. `앱 설치` 또는 `홈 화면에 추가`를 선택합니다.
4. 설치 후 홈 화면에서 `gamehelp` 아이콘으로 실행합니다.

### iPhone Safari

1. 배포된 HTTPS 주소를 Safari에서 엽니다.
2. 공유 버튼을 누릅니다.
3. `홈 화면에 추가`를 선택합니다.
4. 추가된 아이콘으로 실행합니다.

## 주의

- `file:///.../index.html`로 열면 설치형 앱으로 등록되지 않습니다.
- PWA 설치와 오프라인 캐시는 `https://` 주소 또는 개발용 `localhost`에서만 동작합니다.
- 휴대폰에서 사용하려면 GitHub Pages, Netlify, Render Static Site 같은 정적 웹 호스팅에 올려야 합니다.

## 추천 배포 방식

가장 간단한 방식은 GitHub Pages입니다.

1. 이 폴더를 GitHub 저장소에 올립니다.
2. GitHub 저장소의 `Settings` > `Pages`로 이동합니다.
3. `Deploy from a branch`를 선택합니다.
4. `main` 브랜치와 `/root`를 선택합니다.
5. 표시되는 `https://...github.io/gamehelp/` 주소를 휴대폰에서 엽니다.
