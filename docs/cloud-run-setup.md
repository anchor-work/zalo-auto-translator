# Cloud Run 및 GitHub 자동 배포 설정

이 문서는 `anchor-work/zalo-auto-translator` 저장소의 번역 API를 Google Cloud Run에
자동 배포하기 위한 최초 1회 설정입니다.

## 고정 값

```text
Google Cloud 프로젝트: gen-lang-client-0890959839
리전: asia-northeast3
Cloud Run 서비스: zalo-translator-api
Artifact Registry: zalo-translator
GitHub 저장소: anchor-work/zalo-auto-translator
```

## 1. API 활성화

Google Cloud Console의 Cloud Shell에서 실행합니다.

```bash
gcloud config set project gen-lang-client-0890959839

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com
```

## 2. Artifact Registry와 서비스 계정 생성

```bash
gcloud artifacts repositories create zalo-translator \
  --repository-format=docker \
  --location=asia-northeast3 \
  --description="Zalo translator container images"

gcloud iam service-accounts create zalo-translator-runtime \
  --display-name="Zalo Translator Cloud Run runtime"

gcloud iam service-accounts create github-cloud-run-deployer \
  --display-name="GitHub Cloud Run deployer"
```

이미 존재한다는 메시지가 나오면 다시 만들 필요가 없습니다.

두 서비스 계정이 실제로 생성됐는지 확인합니다.

```bash
gcloud iam service-accounts describe \
  zalo-translator-runtime@gen-lang-client-0890959839.iam.gserviceaccount.com

gcloud iam service-accounts describe \
  github-cloud-run-deployer@gen-lang-client-0890959839.iam.gserviceaccount.com
```

`NOT_FOUND`가 나오면 다음 단계로 넘어가지 말고 해당 서비스 계정 생성 명령을 다시
실행합니다.

## 3. Gemini API 키를 Secret Manager에 저장

API 키가 터미널 기록에 남지 않도록 Google Cloud Console에서 진행합니다.

1. **보안 → Secret Manager**로 이동합니다.
2. **보안 비밀 만들기**를 선택합니다.
3. 이름을 `ZALO_GEMINI_API_KEY`로 입력합니다.
4. 보안 비밀 값에 Gemini API 키를 입력하고 저장합니다.

Cloud Run 실행 계정에 해당 Secret을 읽을 권한만 부여합니다.

```bash
gcloud secrets add-iam-policy-binding ZALO_GEMINI_API_KEY \
  --member="serviceAccount:zalo-translator-runtime@gen-lang-client-0890959839.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 4. GitHub 배포 계정 권한 설정

```bash
gcloud projects add-iam-policy-binding gen-lang-client-0890959839 \
  --member="serviceAccount:github-cloud-run-deployer@gen-lang-client-0890959839.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding gen-lang-client-0890959839 \
  --member="serviceAccount:github-cloud-run-deployer@gen-lang-client-0890959839.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding gen-lang-client-0890959839 \
  --member="serviceAccount:github-cloud-run-deployer@gen-lang-client-0890959839.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer"

gcloud iam service-accounts add-iam-policy-binding \
  zalo-translator-runtime@gen-lang-client-0890959839.iam.gserviceaccount.com \
  --member="serviceAccount:github-cloud-run-deployer@gen-lang-client-0890959839.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

## 5. GitHub와 Google Cloud 연결

서비스 계정 JSON 키 대신 만료 시간이 짧은 임시 인증을 사용하는 Workload Identity
Federation을 설정합니다.

```bash
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="anchor-work/zalo-auto-translator" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='anchor-work/zalo-auto-translator'"
```

프로젝트 번호와 Workload Identity Provider 전체 이름을 가져옵니다.

```bash
PROJECT_NUMBER="$(gcloud projects describe gen-lang-client-0890959839 --format='value(projectNumber)')"

gcloud iam service-accounts add-iam-policy-binding \
  github-cloud-run-deployer@gen-lang-client-0890959839.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/anchor-work/zalo-auto-translator"

gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format='value(name)'
```

마지막 명령의 출력과 배포 서비스 계정 주소를 GitHub 저장소의
**Settings → Secrets and variables → Actions → Variables**에 등록합니다.

| GitHub 변수 | 값 |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | 마지막 명령이 출력한 `projects/.../providers/github-provider` 전체 값 |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `github-cloud-run-deployer@gen-lang-client-0890959839.iam.gserviceaccount.com` |

두 값은 인증 비밀번호가 아니며, 저장소가 허용된 경우에만 임시 인증을 발급합니다.

## 6. 최초 배포

GitHub 저장소의 **Actions → Deploy translation API to Cloud Run → Run workflow**를
선택합니다. 이후 `main` 브랜치에서 백엔드 관련 파일이 변경되면 같은 워크플로가 자동
실행됩니다.

배포가 성공하면 Actions 로그 마지막에 Cloud Run URL이 출력됩니다. URL은 다음과 같은
형식입니다.

```text
https://zalo-translator-api-....asia-northeast3.run.app
```

확장프로그램 팝업의 **번역 API 주소**에 이 URL을 입력하고 저장합니다.

## 공개 전 보안 주의사항

현재 자동 배포 설정은 개인 기능 테스트를 위해 Cloud Run 호출을 공개 허용합니다.
Cloud Run URL은 비밀값이 아니며 CORS는 인증 기능이 아닙니다. 외부 사용자에게 배포하기
전에는 사용자 로그인, 구독 확인, 사용자별 문자 한도와 요청 속도 제한을 반드시
추가해야 합니다. Google Cloud 예산 알림과 Gemini API 할당량도 함께 설정합니다.
