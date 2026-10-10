# Chrome 웹 스토어 미등록 테스트 준비

## 준비된 파일

- 업로드 패키지: `.output/zalo-auto-translator-0.10.0-chrome.zip`
- 스토어 아이콘: `store/assets/icon-128.png`
- 스토어 스크린샷: `store/assets/screenshots/01-translation-preview-1280x800.png`
- 등록 문구와 권한 설명: `store/listing-ko.md`
- 개인정보처리방침 원문: `docs/privacy/index.md`

## 최초 등록 순서

1. GitHub 저장소의 **Settings → Pages**에서 `Deploy from a branch`, `main`, `/docs`를
   선택하고 저장합니다.
2. `https://anchor-work.github.io/zalo-auto-translator/privacy/`가 열리는지 확인합니다.
3. Chrome 웹 스토어 개발자 대시보드에서 **새 항목**을 만들고 ZIP을 업로드합니다.
4. `store/listing-ko.md`의 이름·설명·권한 설명·개인정보 공개 내용을 입력합니다.
5. 실제 Zalo 화면 스크린샷을 개인정보가 보이지 않도록 가공해 등록합니다.
6. 배포 범위는 **미등록(Unlisted)** 으로 선택합니다.
7. 모든 필수 항목과 판매자 확인이 완료되면 심사를 제출합니다.

업데이트할 때는 `package.json`과 `wxt.config.ts`의 버전을 올리고 `npm run zip`으로 만든
새 ZIP을 기존 항목의 새 패키지로 업로드합니다. 이미 설치한 사용자는 새 버전이 승인된
후 Chrome이 자동 업데이트하므로 확장프로그램을 다시 설치할 필요가 없습니다.

> 현재 번역 API는 로그인과 사용자별 사용량 제한이 없는 개인 테스트 단계입니다.
> 미등록 링크를 다른 테스터에게 배포하기 전 인증, 구독 확인 및 요청 제한을 먼저
> 구현해야 합니다.

