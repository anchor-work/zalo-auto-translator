# Zalo Auto Translator

한국 사용자가 Zalo Web 입력창에서 작성한 한국어를 베트남어로 번역하고,
전송 전에 검토할 수 있게 하는 Chromium 확장프로그램입니다.

현재 개발 버전은 Gemini 연동 v0.7.5이며, 스토어에서 심사 중인 v0.6.0과 별도로
테스트합니다.

- Zalo Web의 현재 대화 입력창 연결
- 확장 패널에서 한국어 직접 입력
- 베트남어 번역 미리보기
- 첫 번째 Enter로 번역하고 두 번째 Enter로 Zalo 전송
- 번역문을 직접 수정한 뒤 전송 가능
- 자연스럽게/정중하게/친구/동료/고객/연장자 말투 선택
- 베트남어 관계별 호칭(tôi/bạn, em/anh, em/chị, anh/em, chị/em 등) 선택
- 한국어 메시지를 베트남어 또는 영어로 번역
- 받은 베트남어·영어 메시지를 버튼 또는 자동 모드로 한국어 번역
- 메시지 본문을 저장하지 않는 로컬 사용량 집계
- 전송 성공 후 원문과 번역문 자동 초기화
- Gemini 3.1 Flash-Lite Cloud Run 백엔드
- Gemini 고수요 시에만 3.5 Flash-Lite 대체

확장프로그램은 번역 결과가 준비된 상태에서 사용자가 두 번째 `Enter`를 누르거나
**Zalo로 전송** 버튼을 눌렀을 때만 전송을 시도합니다.

## 개발 환경

- Node.js 20 이상
- npm 10 이상
- Chrome 또는 Edge

```bash
npm ci
cp apps/api/.env.example apps/api/.env.local
```

`apps/api/.env.local`의 `ZALO_GEMINI_API_KEY`에 Google AI Studio에서 발급한 개발용
키를 설정합니다. 이 파일은 Git에 포함되지 않습니다. 클라우드 환경에서는 파일 대신
동일한 이름의 Secret을 사용합니다.

백엔드와 확장프로그램 개발 서버를 각각 실행합니다.

```bash
npm run api:dev
npm run dev
```

개발 서버가 실행되면 `.output/chrome-mv3-dev` 디렉터리가 생성됩니다.
Chrome의 `chrome://extensions`에서 개발자 모드를 켜고 **압축해제된 확장 프로그램을
로드합니다**를 선택한 뒤 이 디렉터리를 지정합니다.

1. `https://chat.zalo.me/`를 엽니다.
2. 전송할 대화방의 메시지 입력창을 한 번 클릭해 연결합니다.
3. 화면 오른쪽 아래 번역 패널의 **한국어 메시지** 입력란에 작성합니다.
4. 첫 번째 `Enter`를 누르면 번역 미리보기가 표시됩니다.
5. 번역문을 확인하거나 직접 수정한 뒤 두 번째 `Enter`를 누르면 Zalo로 전송됩니다.
6. 전송이 확인되면 원문과 번역문이 자동으로 비워집니다.

`Shift+Enter`는 줄바꿈이고 `Esc`는 번역 결과만 취소합니다. **모두 지우기**는 원문과
번역문을 함께 초기화합니다. 원문이나 말투를 변경하면 기존 번역은 전송할 수 없으며
새 설정으로 자동 재번역합니다. Zalo의 현재 화면 구조에서 자동 전송을 확인하지 못하면 번역문을
Zalo 입력창에 남기고 사용자가 직접 전송하도록 안전하게 중단합니다.

받은 텍스트 메시지 옆의 번역 아이콘을 누르면 원문 바로 아래에 번역이 표시됩니다.
패널에서 **새로 받은 메시지 자동 번역**을 켜면 이후 도착한 메시지만 자동 번역하며,
기존 대화 전체를 일괄 전송하지 않습니다.

## 번역 백엔드

스토어 빌드는 운영 Cloud Run 서버에 연결됩니다. `npm run dev`로 실행한 개발 빌드에서만
팝업을 통해 데모 모드나 `http://localhost:8787` 개발 서버를 선택할 수 있습니다. 로컬
개발 주소를 사용할 때는 브라우저와 API 서버가 같은 컴퓨터에서 실행되어야 합니다.

```http
POST /v1/translations
Content-Type: application/json

{
  "text": "지금 어디에 있어요?",
  "sourceLanguage": "ko",
  "targetLanguage": "vi",
  "tone": "natural",
  "requestId": "..."
}
```

```json
{
  "translatedText": "Bây giờ bạn đang ở đâu?",
  "provider": "gemini",
  "model": "gemini-3.1-flash-lite",
  "usage": {
    "inputCharacters": 11,
    "promptTokens": 97,
    "outputTokens": 9,
    "totalTokens": 106
  }
}
```

API 키는 백엔드에서만 읽으며 확장프로그램 번들에 포함되지 않습니다. 로컬 API는 개발
검증용이므로 인터넷에 직접 공개하면 안 됩니다. 운영 배포 전에는 사용자 인증, 구독
확인, 사용량 제한, 배포 도메인 CORS 설정을 추가해야 합니다.

Cloud Run과 GitHub Actions의 최초 1회 설정은
[Cloud Run 자동 배포 안내](docs/cloud-run-setup.md)를 따릅니다. 백엔드 관련 파일이
`main` 브랜치에 반영되면 테스트 성공 후 새 Cloud Run 리비전이 자동 배포됩니다.

Chrome 웹 스토어 미등록 테스트의 패키지, 등록 문구와 업로드 순서는
[스토어 등록 안내](store/README.md)를 따릅니다. 개인정보처리방침은 GitHub Pages로
게시할 수 있도록 [docs/privacy/index.md](docs/privacy/index.md)에 준비되어 있습니다.

## 검증 명령

```bash
npm run typecheck
npm test
npm run build
```

## 개인정보 원칙

- 개발 빌드의 데모 모드는 메시지를 외부로 전송하지 않습니다.
- 사용량 통계에는 날짜, 번역 횟수, 원문 문자 수, 오류 횟수만 저장됩니다.
- 백엔드 로그에는 요청 ID, 문자 수, 모델, 처리 시간과 오류 코드만 기록됩니다.
- 원문, 번역문, 대화 상대, 대화방 정보는 저장하지 않습니다.
- Zalo 세션 쿠키나 인증정보에 접근하지 않습니다.
