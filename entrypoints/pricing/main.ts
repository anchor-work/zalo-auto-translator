import { browser } from "wxt/browser";
import type { AccountUsage, AuthState, BackgroundMessage, BackgroundResponse, BillingRedirect, EnterpriseInquiry, ExtensionSettings, TranslationLanguage } from "../../src/types";
import "./style.css";

type Copy = {
  title: string; hero: [string, string]; trust: string[];
  free: [string, string, string, string[], string, string];
  pro: [string, string, string, string, string, string[], string, string, string];
  enterprise: [string, string, string, string[], string, string];
  privacy: [string, string, string]; comparisonTitle: string; feature: string; comparison: string[][];
  faqTitle: string; faq: Array<[string, string]>; opening: string; failed: string; usage: (used: number, limit: number) => string;
  inquiry: { kicker: string; title: string; description: string; labels: [string, string, string, string, string]; options: Array<[EnterpriseInquiry["teamSize"], string]>; consent: string; cancel: string; submit: string; sending: string; success: string; failed: string; close: string };
};

const copies: Record<TranslationLanguage, Copy> = {
  ko: {
    title: "Zalo Language Bridge 요금제",
    hero: ["무료로 시작하고, 필요할 때 Pro를 선택하세요.", "가끔 번역한다면 무료 요금제로 충분합니다. 대화가 잦아지거나 받은 메시지를 자동으로 번역하고 싶을 때 Pro로 바꿀 수 있습니다."],
    trust: ["번역 문장 서버 보관 없음", "Zalo 비밀번호·쿠키 접근 없음", "언제든 구독 해지"],
    free: ["가끔 번역한다면", "무료", "결제 정보 없이 기본 번역 기능을 사용할 수 있습니다.", ["보내는 번역 월 30회", "받은 메시지 번역 월 30회", "보내는 번역 월 3,000자", "받은 메시지 직접 번역", "말투와 베트남어 호칭 설정"], "무료로 계속 사용", "사용 기간 제한이 없고 카드 등록도 필요하지 않습니다."],
    pro: ["가장 많이 선택하는 요금제", "대화를 자주 한다면", "/월", "매월 자동 갱신 · 언제든 해지 가능", "번역 한도를 넉넉하게 늘리고, 새로 받은 메시지도 자동으로 번역합니다.", ["보내는 번역 월 1,000회", "받은 메시지 번역 월 1,000회", "번역 유형별 월 150,000자", "새로 받은 메시지 자동 번역", "결제 후 바로 Pro 적용"], "월 $4.99로 Pro 시작", "구독 관리", "세금은 결제 화면에서 확인할 수 있습니다. 해지해도 결제 기간이 끝날 때까지 Pro를 사용할 수 있습니다."],
    enterprise: ["팀에서 함께 사용한다면", "별도 문의", "인원, 사용량, 보안 검토 범위에 맞춰 도입 방법을 함께 정합니다.", ["팀 단위 사용량 설계", "대량 번역 한도 협의", "회사 결제 및 증빙 상담", "보안·개인정보 처리 검토", "도입과 운영 지원"], "Enterprise 문의하기", "필요한 기능과 규모를 알려주시면 확인 후 답변드리겠습니다."],
    privacy: ["번역한 문장은 당사 서버에 보관하지 않습니다.", "사용자가 번역을 요청한 문장만 처리하며, 기존 Zalo 대화 전체를 수집하지 않습니다. 번역 원문과 결과는 당사 서버 로그나 데이터베이스에 저장하지 않습니다.", "개인정보 처리 방식 자세히 보기"],
    comparisonTitle: "요금제 비교", feature: "기능", comparison: [["보내는 번역", "월 30회", "월 1,000회", "협의"], ["받은 메시지 번역", "월 30회", "월 1,000회", "협의"], ["자동 번역", "—", "지원", "협의"], ["메시지 원문 저장", "저장하지 않음", "저장하지 않음", "정책 협의"], ["사용 인원", "1명", "1명", "팀 단위"]],
    faqTitle: "자주 묻는 질문", faq: [["언제든 해지할 수 있나요?", "네. 구독 관리에서 언제든 해지할 수 있습니다. 해지 후에도 현재 결제 기간이 끝날 때까지 Pro를 사용할 수 있습니다."], ["결제하면 바로 적용되나요?", "대부분 결제 완료 후 몇 초 안에 Pro가 적용됩니다."], ["무료 버전을 계속 사용해도 되나요?", "네. 무료 요금제는 사용 기간 제한이 없고 결제 정보도 필요하지 않습니다."], ["메시지가 서버에 저장되나요?", "번역 원문과 결과는 당사 서버 로그나 데이터베이스에 저장하지 않습니다. 번역을 위해 요청한 문장만 암호화된 통신으로 Google Gemini API에 전달됩니다."]],
    opening: "결제 페이지를 여는 중입니다…", failed: "결제 페이지를 열지 못했습니다. 잠시 후 다시 시도해 주세요.", usage: (used, limit) => `이번 달 보내는 번역을 ${used}회 사용했습니다. 무료 한도는 ${limit}회입니다.`,
    inquiry: { kicker: "Enterprise", title: "도입에 필요한 내용을 알려주세요", description: "문의는 로그인한 계정의 이메일로 답변드립니다. 보통 영업일 기준 1~2일 안에 확인합니다.", labels: ["담당자 이름", "회사·팀 이름", "예상 사용 인원", "문의 내용", "필요한 언어, 예상 사용량, 보안 검토 사항 등을 적어주세요."], options: [["1-10", "1~10명"], ["11-50", "11~50명"], ["51-200", "51~200명"], ["201+", "201명 이상"], ["unknown", "아직 정하지 못함"]], consent: "문의 답변을 위해 입력한 정보와 계정 이메일을 처리하는 데 동의합니다.", cancel: "취소", submit: "문의 보내기", sending: "문의를 보내는 중입니다…", success: "문의가 접수되었습니다. 확인 후 로그인 계정의 이메일로 답변드리겠습니다.", failed: "문의를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", close: "문의 창 닫기" }
  },
  en: {
    title: "Zalo Language Bridge Plans", hero: ["Start free. Choose Pro when you need it.", "Free is enough for occasional translation. Move to Pro when conversations become frequent or you want incoming messages translated automatically."], trust: ["Translation text is not stored", "No access to Zalo passwords or cookies", "Cancel anytime"],
    free: ["For occasional translation", "Free", "Use the essential translation features without payment details.", ["30 outgoing translations/month", "30 incoming translations/month", "3,000 outgoing characters/month", "Manual incoming translation", "Tone and Vietnamese address settings"], "Continue free", "No time limit and no card required."],
    pro: ["Most popular", "For frequent conversations", "/month", "Renews monthly · Cancel anytime", "Get higher limits and automatically translate new incoming messages.", ["1,000 outgoing translations/month", "1,000 incoming translations/month", "150,000 characters per translation type", "Automatic incoming translation", "Pro activates after payment"], "Start Pro for $4.99/month", "Manage subscription", "Taxes are shown at checkout. After cancellation, Pro remains available through the paid period."],
    enterprise: ["For teams", "Let's talk", "We will plan around your team size, expected usage, and security review.", ["Team usage planning", "Custom high-volume limits", "Company billing support", "Security and privacy review", "Onboarding and operations support"], "Contact Enterprise", "Tell us what you need and we will reply after reviewing it."],
    privacy: ["We do not store the text you translate.", "We process only text you ask us to translate, not your full Zalo conversation history. Source text and translations are not stored in our server logs or database.", "Read how data is handled"], comparisonTitle: "Compare plans", feature: "Feature", comparison: [["Outgoing translation", "30/mo", "1,000/mo", "Custom"], ["Incoming translation", "30/mo", "1,000/mo", "Custom"], ["Automatic translation", "—", "Included", "Custom"], ["Message content storage", "Not stored", "Not stored", "By agreement"], ["Users", "1", "1", "Team"]],
    faqTitle: "Frequently asked questions", faq: [["Can I cancel anytime?", "Yes. You can cancel in subscription management and keep Pro through the current paid period."], ["When does Pro activate?", "Pro usually activates within a few seconds after payment."], ["Can I stay on Free?", "Yes. Free has no time limit and requires no payment details."], ["Are messages stored?", "We do not store source text or translations in our server logs or database. Text you request to translate is sent to the Google Gemini API over an encrypted connection."]], opening: "Opening checkout…", failed: "We could not open checkout. Please try again.", usage: (used, limit) => `You have used ${used} of ${limit} outgoing translations this month.`,
    inquiry: { kicker: "Enterprise", title: "Tell us what your team needs", description: "We will reply to the email on your signed-in account, usually within one or two business days.", labels: ["Your name", "Company or team", "Expected users", "What do you need?", "Include languages, expected usage, or security requirements."], options: [["1-10", "1–10"], ["11-50", "11–50"], ["51-200", "51–200"], ["201+", "201+"], ["unknown", "Not sure yet"]], consent: "I agree that my form details and account email may be used to respond to this inquiry.", cancel: "Cancel", submit: "Send inquiry", sending: "Sending your inquiry…", success: "Your inquiry has been sent. We will reply to your account email.", failed: "We could not send your inquiry. Please try again shortly.", close: "Close inquiry" }
  },
  vi: {
    title: "Bảng giá Zalo Language Bridge", hero: ["Bắt đầu miễn phí. Chọn Pro khi bạn cần.", "Gói Free đủ cho nhu cầu dịch thỉnh thoảng. Chuyển sang Pro khi bạn trò chuyện thường xuyên hoặc muốn tự động dịch tin nhắn đến."], trust: ["Không lưu nội dung bản dịch", "Không truy cập mật khẩu hoặc cookie Zalo", "Hủy bất cứ lúc nào"],
    free: ["Khi thỉnh thoảng cần dịch", "Miễn phí", "Dùng các tính năng dịch cơ bản mà không cần thông tin thanh toán.", ["30 lượt dịch gửi/tháng", "30 lượt dịch nhận/tháng", "3.000 ký tự gửi/tháng", "Dịch thủ công tin nhắn nhận", "Cài đặt giọng điệu và xưng hô"], "Tiếp tục miễn phí", "Không giới hạn thời gian và không cần thẻ."],
    pro: ["Được chọn nhiều nhất", "Khi trò chuyện thường xuyên", "/tháng", "Gia hạn hàng tháng · Hủy bất cứ lúc nào", "Tăng hạn mức và tự động dịch tin nhắn mới nhận.", ["1.000 lượt dịch gửi/tháng", "1.000 lượt dịch nhận/tháng", "150.000 ký tự cho mỗi loại dịch", "Tự động dịch tin nhắn nhận", "Kích hoạt Pro sau thanh toán"], "Bắt đầu Pro với $4.99/tháng", "Quản lý gói", "Thuế được hiển thị khi thanh toán. Sau khi hủy, bạn vẫn dùng Pro đến hết kỳ đã trả tiền."],
    enterprise: ["Dành cho nhóm", "Liên hệ", "Chúng tôi cùng bạn lên kế hoạch theo quy mô, mức sử dụng và yêu cầu bảo mật.", ["Kế hoạch sử dụng theo nhóm", "Hạn mức lớn theo nhu cầu", "Hỗ trợ thanh toán doanh nghiệp", "Rà soát bảo mật và quyền riêng tư", "Hỗ trợ triển khai và vận hành"], "Liên hệ Enterprise", "Hãy cho chúng tôi biết nhu cầu. Chúng tôi sẽ xem xét và phản hồi."],
    privacy: ["Chúng tôi không lưu nội dung bạn dịch.", "Chỉ nội dung bạn yêu cầu mới được xử lý, không phải toàn bộ lịch sử trò chuyện Zalo. Văn bản gốc và bản dịch không được lưu trong nhật ký hoặc cơ sở dữ liệu máy chủ.", "Xem cách xử lý dữ liệu"], comparisonTitle: "So sánh gói", feature: "Tính năng", comparison: [["Dịch gửi", "30/tháng", "1.000/tháng", "Thỏa thuận"], ["Dịch nhận", "30/tháng", "1.000/tháng", "Thỏa thuận"], ["Dịch tự động", "—", "Có", "Thỏa thuận"], ["Lưu nội dung", "Không lưu", "Không lưu", "Theo thỏa thuận"], ["Người dùng", "1", "1", "Nhóm"]],
    faqTitle: "Câu hỏi thường gặp", faq: [["Có thể hủy bất cứ lúc nào không?", "Có. Bạn có thể hủy trong phần quản lý và tiếp tục dùng Pro đến hết kỳ đã thanh toán."], ["Khi nào Pro được kích hoạt?", "Pro thường được kích hoạt trong vài giây sau khi thanh toán."], ["Có thể tiếp tục dùng Free không?", "Có. Free không giới hạn thời gian và không cần thông tin thanh toán."], ["Tin nhắn có được lưu không?", "Chúng tôi không lưu văn bản gốc hoặc bản dịch trong nhật ký hay cơ sở dữ liệu máy chủ. Nội dung cần dịch được gửi tới Google Gemini API qua kết nối mã hóa."]], opening: "Đang mở trang thanh toán…", failed: "Không thể mở trang thanh toán. Vui lòng thử lại.", usage: (used, limit) => `Bạn đã dùng ${used}/${limit} lượt dịch gửi trong tháng này.`,
    inquiry: { kicker: "Enterprise", title: "Hãy cho chúng tôi biết nhu cầu của nhóm", description: "Chúng tôi sẽ phản hồi qua email của tài khoản đang đăng nhập, thường trong một đến hai ngày làm việc.", labels: ["Tên người phụ trách", "Công ty hoặc nhóm", "Số người dự kiến", "Nội dung cần trao đổi", "Vui lòng ghi ngôn ngữ, mức sử dụng dự kiến hoặc yêu cầu bảo mật."], options: [["1-10", "1–10 người"], ["11-50", "11–50 người"], ["51-200", "51–200 người"], ["201+", "Từ 201 người"], ["unknown", "Chưa xác định"]], consent: "Tôi đồng ý cho phép xử lý thông tin đã nhập và email tài khoản để trả lời yêu cầu này.", cancel: "Hủy", submit: "Gửi yêu cầu", sending: "Đang gửi yêu cầu…", success: "Yêu cầu đã được gửi. Chúng tôi sẽ phản hồi qua email tài khoản.", failed: "Không thể gửi yêu cầu. Vui lòng thử lại sau.", close: "Đóng cửa sổ liên hệ" }
  }
};

function el<T extends HTMLElement>(id: string): T { const node = document.getElementById(id); if (!node) throw new Error(`Missing ${id}`); return node as T; }
function text(id: string, value: string): void { el(id).textContent = value; }
function list(id: string, values: string[]): void { el<HTMLUListElement>(id).replaceChildren(...values.map((value) => Object.assign(document.createElement("li"), { textContent: value }))); }

let language: TranslationLanguage = "ko";
let usage: AccountUsage | null = null;

function render(nextLanguage: TranslationLanguage): void {
  language = nextLanguage; const copy = copies[language]; const [freeKicker, freePrice, freeDescription, freeFeatures, continueFree, freeNote] = copy.free; const [badge, proKicker, perMonth, renewal, proDescription, proFeatures, startPro, managePro, proNote] = copy.pro; const [enterpriseKicker, enterprisePrice, enterpriseDescription, enterpriseFeatures, contact, enterpriseNote] = copy.enterprise;
  document.documentElement.lang = language; document.title = copy.title;
  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => { const selected = button.dataset.language === language; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected)); });
  text("hero-title", copy.hero[0]); text("hero-description", copy.hero[1]); ["trust-storage", "trust-zalo", "trust-cancel"].forEach((id, i) => text(id, copy.trust[i] ?? ""));
  text("free-kicker", freeKicker); text("free-price", freePrice); text("free-description", freeDescription); list("free-features", freeFeatures); text("continue-free", continueFree); text("free-note", freeNote);
  text("pro-badge", badge); text("pro-kicker", proKicker); text("per-month", perMonth); text("pro-renewal", renewal); text("pro-description", proDescription); list("pro-features", proFeatures); text("start-pro", startPro); text("manage-pro", managePro); text("pro-note", proNote);
  text("enterprise-kicker", enterpriseKicker); text("enterprise-price", enterprisePrice); text("enterprise-description", enterpriseDescription); list("enterprise-features", enterpriseFeatures); text("enterprise-contact", contact); text("enterprise-note", enterpriseNote);
  text("privacy-title", copy.privacy[0]); text("privacy-copy", copy.privacy[1]); text("privacy-link", copy.privacy[2]); text("comparison-title", copy.comparisonTitle); text("feature-heading", copy.feature); text("faq-title", copy.faqTitle);
  el<HTMLTableSectionElement>("comparison-body").replaceChildren(...copy.comparison.map((row) => { const tr = document.createElement("tr"); row.forEach((value) => tr.append(Object.assign(document.createElement("td"), { textContent: value }))); return tr; }));
  el("faq-list").replaceChildren(...copy.faq.map(([q, a]) => { const details = document.createElement("details"); details.append(Object.assign(document.createElement("summary"), { textContent: q }), Object.assign(document.createElement("p"), { textContent: a })); return details; }));
  const inquiry = copy.inquiry; text("inquiry-kicker", inquiry.kicker); text("inquiry-title", inquiry.title); text("inquiry-description", inquiry.description); ["name-label", "company-label", "team-size-label", "message-label", "message-help"].forEach((id, i) => text(id, inquiry.labels[i] ?? "")); text("consent-label", inquiry.consent); text("cancel-inquiry", inquiry.cancel); text("submit-inquiry", inquiry.submit); el("close-inquiry").setAttribute("aria-label", inquiry.close);
  el<HTMLSelectElement>("inquiry-team-size").replaceChildren(...inquiry.options.map(([value, label]) => Object.assign(document.createElement("option"), { value, textContent: label })));
  if (usage) { const message = el("usage-message"); message.textContent = usage.plan === "pro" ? managePro : copy.usage(usage.used.outgoing.requests, usage.limits.outgoing.requests); message.hidden = false; }
}

async function billing(type: "create-billing-checkout" | "create-billing-portal"): Promise<void> {
  const button = el<HTMLButtonElement>(type === "create-billing-checkout" ? "start-pro" : "manage-pro"); button.disabled = true; text("status", copies[language].opening);
  try { const response = await browser.runtime.sendMessage({ type } satisfies BackgroundMessage) as BackgroundResponse<BillingRedirect>; if (!response.ok) throw new Error(response.error); await browser.tabs.create({ url: response.data.url }); text("status", ""); }
  catch (error) { text("status", error instanceof Error ? error.message : copies[language].failed); }
  finally { button.disabled = false; }
}

async function submitInquiry(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const copy = copies[language].inquiry; const button = el<HTMLButtonElement>("submit-inquiry"); button.disabled = true; text("inquiry-status", copy.sending);
  const payload: EnterpriseInquiry = { name: el<HTMLInputElement>("inquiry-name").value.trim(), company: el<HTMLInputElement>("inquiry-company").value.trim(), teamSize: el<HTMLSelectElement>("inquiry-team-size").value as EnterpriseInquiry["teamSize"], message: el<HTMLTextAreaElement>("inquiry-message").value.trim(), language };
  try { const response = await browser.runtime.sendMessage({ type: "submit-enterprise-inquiry", payload } satisfies BackgroundMessage) as BackgroundResponse<{ received: true }>; if (!response.ok) throw new Error(response.error); el<HTMLFormElement>("enterprise-form").reset(); text("inquiry-status", copy.success); button.hidden = true; }
  catch (error) { text("inquiry-status", error instanceof Error ? error.message : copy.failed); button.disabled = false; }
}

async function load(): Promise<void> {
  const [settings, auth, account] = await Promise.all([
    browser.runtime.sendMessage({ type: "get-settings" } satisfies BackgroundMessage) as Promise<BackgroundResponse<ExtensionSettings>>,
    browser.runtime.sendMessage({ type: "get-auth-state" } satisfies BackgroundMessage) as Promise<BackgroundResponse<AuthState>>,
    browser.runtime.sendMessage({ type: "get-account-usage" } satisfies BackgroundMessage) as Promise<BackgroundResponse<AccountUsage>>
  ]);
  usage = account.ok ? account.data : null; render(settings.ok ? settings.data.userLanguage : "ko");
  if (usage) { el<HTMLButtonElement>("start-pro").hidden = usage.plan === "pro"; el<HTMLButtonElement>("manage-pro").hidden = usage.plan !== "pro"; }
  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => button.addEventListener("click", () => render(button.dataset.language as TranslationLanguage)));
  el("continue-free").addEventListener("click", () => window.close()); el("start-pro").addEventListener("click", () => void billing("create-billing-checkout")); el("manage-pro").addEventListener("click", () => void billing("create-billing-portal"));
  const dialog = el<HTMLDialogElement>("enterprise-dialog"); el("enterprise-contact").addEventListener("click", () => { text("inquiry-status", ""); const submit = el<HTMLButtonElement>("submit-inquiry"); submit.hidden = false; submit.disabled = false; dialog.showModal(); }); el("close-inquiry").addEventListener("click", () => dialog.close()); el("cancel-inquiry").addEventListener("click", () => dialog.close()); el<HTMLFormElement>("enterprise-form").addEventListener("submit", (event) => void submitInquiry(event)); dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  if (!auth.ok || !auth.data.configured || !auth.data.signedIn) el<HTMLButtonElement>("enterprise-contact").disabled = true;
}

void load().catch((error) => text("status", error instanceof Error ? error.message : "Unable to load plans."));
