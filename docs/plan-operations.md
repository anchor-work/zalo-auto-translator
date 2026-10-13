# 요금제 운영 안내

결제 연동 전에는 Firestore의 사용자 문서를 수동으로 변경해 Pro 권한을 검증합니다.
API에 공개 관리자 엔드포인트를 두지 않으며, 메시지 원문은 저장하거나 수정하지 않습니다.

## Firebase Console에서 변경

1. Firestore의 `users` 컬렉션을 엽니다.
2. 대상 사용자의 문서를 이메일 필드로 확인합니다.
3. `plan`을 `free` 또는 `pro`로 변경합니다.
4. `status`는 `active`로 유지합니다.
5. 확장 프로그램 팝업과 Zalo 탭을 새로고침합니다.

Pro 사용자는 보내는 번역, 받은 메시지 수동 번역 및 자동 번역에 Pro 한도가 적용됩니다.
Free로 되돌려도 기존 월간 사용량은 삭제되지 않습니다.

## 관리자 CLI에서 변경

Firebase Admin SDK용 Application Default Credentials가 설정된 관리자 환경에서만 실행합니다.
서비스 계정 키를 저장소나 채팅에 넣지 마세요. 현재 운영 데이터베이스 ID도 함께 지정합니다.

```bash
ZALO_FIRESTORE_DATABASE_ID=default npm run account:set-plan -- user@example.com pro
ZALO_FIRESTORE_DATABASE_ID=default npm run account:set-plan -- FIREBASE_UID free
```

대상 사용자는 먼저 확장 프로그램에서 로그인하여 `users/{uid}` 문서가 생성되어 있어야 합니다.
명령은 `plan`, `status`, `planSource`, 변경 시각만 갱신하며 월간 사용량은 초기화하지 않습니다.

## Pro 검증 순서

1. Free 계정에서 자동 번역이 비활성화되는지 확인합니다.
2. 계정을 Pro로 변경하고 팝업을 다시 열어 `Pro` 표시를 확인합니다.
3. Zalo 탭을 새로고침하고 받은 메시지 자동 번역을 켭니다.
4. 보내는 번역과 받은 메시지 사용량이 각각 증가하는지 확인합니다.
5. Free로 되돌린 뒤 자동 번역이 다시 비활성화되는지 확인합니다.

결제 연동 단계에서는 결제 웹훅만 이 문서의 `plan`과 `status`를 갱신하도록 대체합니다.
