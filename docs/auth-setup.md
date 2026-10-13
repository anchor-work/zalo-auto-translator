# Firebase 및 Google 로그인 설정

확장 프로그램은 Firebase Authentication의 Google 계정과
`chrome.identity`를 사용합니다. Firebase 서비스 계정 키나 Gemini API 키는 확장
프로그램에 포함하지 않습니다.

## 준비 순서

1. 현재 Cloud Run과 같은 Google Cloud 프로젝트에 Firebase를 추가합니다.
2. Firebase Authentication에서 Google 공급자를 활성화합니다.
3. Firebase Web App을 만들고 공개 클라이언트 설정을 확인합니다.
4. Chrome 웹 스토어의 고정 확장 프로그램 ID를 확인합니다.
5. Google Cloud Console에서 해당 ID에 연결된 **Chrome Extension** 유형의 OAuth
   클라이언트를 만듭니다.
6. `.env.example`의 변수를 로컬 `.env` 또는 배포 빌드 환경에 설정합니다.

필요한 변수는 다음과 같습니다.

- `WXT_PUBLIC_FIREBASE_API_KEY`
- `WXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `WXT_PUBLIC_FIREBASE_PROJECT_ID`
- `WXT_PUBLIC_FIREBASE_APP_ID`
- `WXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`
- `WXT_PUBLIC_EXTENSION_KEY`

이 값이 모두 존재하는 빌드에만 manifest의 `oauth2` 설정이 추가됩니다. 값이 없는
개발 빌드는 로그인 버튼을 비활성화하고 설정 누락 안내를 표시합니다.

## 동작 확인

```bash
npm run typecheck
npm test
npm run build
```

빌드된 `.output/chrome-mv3/manifest.json`에 `identity` 권한과 `oauth2` 항목이
있는지 확인합니다. 최초 설치에서는 `onboarding.html`이 한 번 열려야 하며, Google
로그인 후에만 초기 언어 설정 화면이 표시되어야 합니다.

## 개발 빌드의 확장 프로그램 ID 고정

Chrome 웹 스토어 개발자 대시보드에서 해당 항목의 공개 키를 복사해
`WXT_PUBLIC_EXTENSION_KEY`에 넣습니다. PEM의 `BEGIN/END PUBLIC KEY` 문구와
줄바꿈이 포함되어 있어도 빌드 과정에서 제거됩니다. 이 키는 비밀키가 아니라 manifest에
포함되는 공개 키입니다.

빌드 후 `.output/chrome-mv3/manifest.json`에 `key`가 포함되어야 합니다. 압축 해제된
확장 프로그램을 다시 로드한 후 `chrome://extensions`에 표시되는 ID가 Chrome 웹
스토어 항목 ID와 정확히 같은지 확인합니다. 다르면 Google 로그인 테스트를 진행하지
말고 공개 키와 OAuth 클라이언트에 등록한 확장 프로그램 ID를 다시 확인합니다.

현재 단계에서는 확장 프로그램이 Firebase ID 토큰을 번역 요청의 `Authorization:
Bearer ...` 헤더에 넣습니다. 다음 단계에서 Cloud Run이 이 토큰을 검증하고 토큰이
없는 요청을 `401`로 거절하도록 구현해야 합니다.
