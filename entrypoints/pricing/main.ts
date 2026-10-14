import { browser } from "wxt/browser";
import type { AccountUsage, AuthState, BackgroundMessage, BackgroundResponse, BillingRedirect, ExtensionSettings, TranslationLanguage } from "../../src/types";
import "./style.css";

type Copy = {
  heroTitle: string; heroDescription: string; trust: string[]; freeKicker: string; freePrice: string; freeDescription: string;
  freeFeatures: string[]; continueFree: string; freeNote: string; proBadge: string; proKicker: string; perMonth: string;
  proRenewal: string; proDescription: string; proFeatures: string[]; startPro: string; managePro: string; proNote: string;
  enterpriseKicker: string; enterprisePrice: string; enterpriseDescription: string; enterpriseFeatures: string[]; contact: string;
  enterpriseNote: string; privacyTitle: string; privacyCopy: string; privacyLink: string; comparisonTitle: string; featureHeading: string;
  comparison: string[][]; faqTitle: string; faq: Array<[string, string]>; opening: string; failed: string; freeUsage: (used: number, limit: number) => string;
};

const copies: Record<TranslationLanguage, Copy> = {
  ko: {
    heroTitle: "무료로 충분히 시작하고, 필요할 때만 업그레이드하세요.",
    heroDescription: "가끔 쓰는 번역은 Free로 충분합니다. 더 자주 대화하거나 새 메시지를 자동으로 번역하고 싶을 때 Pro를 선택하세요.",
    trust: ["당사 서버·DB에 메시지 원문 저장 안 함", "Zalo 비밀번호·쿠키 접근 안 함", "장기 약정 없이 언제든 해지"],
    freeKicker: "가볍게 시작하기", freePrice: "무료", freeDescription: "결제정보 없이 핵심 번역 기능을 사용합니다.",
    freeFeatures: ["보내는 번역 월 30회", "받은 메시지 번역 월 30회", "보내는 번역 월 3,000자", "직접 눌러 받은 메시지 번역", "말투와 베트남어 호칭 설정"],
    continueFree: "무료로 계속 사용", freeNote: "기간 제한과 결제정보 등록이 없습니다.", proBadge: "개인 사용자 추천", proKicker: "대화를 자주 한다면", perMonth: "/ 월",
    proRenewal: "매월 자동 갱신 · 언제든 해지 가능", proDescription: "한도 걱정을 줄이고 새로 받은 메시지도 자동으로 번역합니다.",
    proFeatures: ["보내는 번역 월 1,000회", "받은 메시지 번역 월 1,000회", "각 번역 유형 월 150,000자", "새로 받은 메시지 자동 번역", "결제 후 바로 Pro 적용"],
    startPro: "월 $4.99로 Pro 시작", managePro: "현재 구독 관리", proNote: "세금은 결제 화면에서 확인됩니다. 해지 후에도 결제 기간 종료일까지 사용할 수 있습니다.",
    enterpriseKicker: "팀과 조직을 위한 도입", enterprisePrice: "별도 문의", enterpriseDescription: "인원과 사용량, 보안 검토 요구사항에 맞춰 도입을 상담합니다.",
    enterpriseFeatures: ["팀 단위 사용량 협의", "대량 번역 한도 협의", "회사 결제 및 증빙 상담", "보안·개인정보 처리 검토", "도입 및 운영 지원"],
    contact: "Enterprise 도입 문의", enterpriseNote: "필요 인원과 사용량을 확인한 후 제공 범위를 안내합니다.",
    privacyTitle: "대화 내용을 모으기 위한 서비스가 아닙니다.", privacyCopy: "번역을 요청한 문장만 처리하며, 기존 Zalo 대화 전체를 수집하지 않습니다. 당사 서버 로그와 데이터베이스에는 메시지 원문과 번역문을 저장하지 않습니다.", privacyLink: "개인정보 처리 방식 자세히 보기",
    comparisonTitle: "한눈에 비교하기", featureHeading: "기능", comparison: [["보내는 번역", "월 30회", "월 1,000회", "협의"], ["받은 메시지 번역", "월 30회", "월 1,000회", "협의"], ["자동 번역", "—", "지원", "협의"], ["메시지 원문 저장", "저장하지 않음", "저장하지 않음", "별도 정책 협의"], ["사용자", "1명", "1명", "팀 단위"]],
    faqTitle: "자주 묻는 질문", faq: [["언제든 해지할 수 있나요?", "네. 구독 관리에서 언제든 해지할 수 있으며, 예약 해지 후에도 현재 결제 기간 종료일까지 Pro를 사용할 수 있습니다."], ["결제 후 언제 적용되나요?", "일반적으로 결제 완료 후 수 초 안에 Pro가 자동 적용됩니다."], ["무료 버전을 계속 사용해도 되나요?", "네. Free는 기간 제한 없이 제공되며 결제정보가 필요하지 않습니다."], ["메시지가 서버에 저장되나요?", "당사는 번역 원문과 결과를 서버 로그나 데이터베이스에 저장하지 않습니다. 번역 처리를 위해 요청한 문장만 Google Gemini API로 암호화 전송됩니다."]],
    opening: "안전한 결제 페이지를 여는 중입니다…", failed: "결제 페이지를 열지 못했습니다. 잠시 후 다시 시도해 주세요.", freeUsage: (used, limit) => `이번 달 보내는 번역을 ${used}회 사용했습니다. Free 한도는 ${limit}회입니다.`
  },
  en: {
    heroTitle: "Start free. Upgrade only when you need more.", heroDescription: "Free covers occasional translation. Choose Pro when you chat more often or want new incoming messages translated automatically.", trust: ["No message content stored in our server database", "No access to Zalo passwords or cookies", "Cancel anytime with no long-term contract"],
    freeKicker: "Start simply", freePrice: "Free", freeDescription: "Use essential translation without payment details.", freeFeatures: ["30 outgoing translations/month", "30 incoming translations/month", "3,000 outgoing characters/month", "Manual incoming translation", "Tone and Vietnamese address settings"], continueFree: "Continue free", freeNote: "No time limit or payment details required.",
    proBadge: "Recommended for individuals", proKicker: "For frequent conversations", perMonth: "/ month", proRenewal: "Renews monthly · Cancel anytime", proDescription: "Translate more and automatically understand new incoming messages.", proFeatures: ["1,000 outgoing translations/month", "1,000 incoming translations/month", "150,000 characters per translation type", "Automatic new-message translation", "Pro activates right after payment"], startPro: "Start Pro for $4.99/month", managePro: "Manage current subscription", proNote: "Taxes are shown at checkout. Access continues through the paid period after cancellation.",
    enterpriseKicker: "For teams and organizations", enterprisePrice: "Contact us", enterpriseDescription: "Discuss team size, usage, and security review requirements.", enterpriseFeatures: ["Team usage planning", "Higher limits by agreement", "Company billing consultation", "Security and privacy review", "Onboarding and operational support"], contact: "Contact Enterprise", enterpriseNote: "We confirm your needs before proposing scope.",
    privacyTitle: "We are not building a database of your conversations.", privacyCopy: "Only text you request to translate is processed. We do not collect entire Zalo conversations or store message content and translations in our server logs or database.", privacyLink: "See how data is handled", comparisonTitle: "Compare plans", featureHeading: "Feature", comparison: [["Outgoing translation", "30/mo", "1,000/mo", "Custom"], ["Incoming translation", "30/mo", "1,000/mo", "Custom"], ["Auto translation", "—", "Included", "Custom"], ["Message content storage", "Not stored", "Not stored", "Policy by agreement"], ["Users", "1", "1", "Team"]], faqTitle: "Frequently asked questions", faq: [["Can I cancel anytime?", "Yes. Cancel in subscription management and keep Pro through the current paid period."], ["When does Pro activate?", "Usually within seconds after payment."], ["Can I stay on Free?", "Yes. Free has no time limit and requires no payment details."], ["Are messages stored?", "We do not store message content in our server logs or database. Requested text is encrypted in transit to Google Gemini API for translation."]], opening: "Opening the secure checkout…", failed: "Could not open checkout. Please try again.", freeUsage: (used, limit) => `You used ${used} of ${limit} outgoing translations this month.`
  },
  vi: {
    heroTitle: "Bắt đầu miễn phí. Chỉ nâng cấp khi bạn thực sự cần.", heroDescription: "Free đủ cho nhu cầu dịch không thường xuyên. Chọn Pro khi bạn trò chuyện nhiều hơn hoặc muốn tự động dịch tin nhắn mới.", trust: ["Không lưu nội dung tin nhắn trong cơ sở dữ liệu máy chủ", "Không truy cập mật khẩu hoặc cookie Zalo", "Hủy bất cứ lúc nào, không cam kết dài hạn"],
    freeKicker: "Bắt đầu nhẹ nhàng", freePrice: "Miễn phí", freeDescription: "Dùng tính năng dịch thiết yếu mà không cần thông tin thanh toán.", freeFeatures: ["30 lượt dịch gửi/tháng", "30 lượt dịch nhận/tháng", "3.000 ký tự gửi/tháng", "Dịch thủ công tin nhắn nhận", "Cài đặt giọng điệu và xưng hô"], continueFree: "Tiếp tục miễn phí", freeNote: "Không giới hạn thời gian và không cần thông tin thanh toán.",
    proBadge: "Đề xuất cho cá nhân", proKicker: "Khi bạn trò chuyện thường xuyên", perMonth: "/ tháng", proRenewal: "Gia hạn hàng tháng · Hủy bất cứ lúc nào", proDescription: "Dịch nhiều hơn và tự động hiểu tin nhắn mới nhận.", proFeatures: ["1.000 lượt dịch gửi/tháng", "1.000 lượt dịch nhận/tháng", "150.000 ký tự cho mỗi loại dịch", "Tự động dịch tin nhắn mới", "Kích hoạt Pro ngay sau thanh toán"], startPro: "Bắt đầu Pro với $4.99/tháng", managePro: "Quản lý gói hiện tại", proNote: "Thuế được hiển thị khi thanh toán. Sau khi hủy, bạn vẫn dùng được đến hết kỳ đã trả tiền.",
    enterpriseKicker: "Dành cho nhóm và tổ chức", enterprisePrice: "Liên hệ", enterpriseDescription: "Trao đổi theo số người dùng, mức sử dụng và yêu cầu bảo mật.", enterpriseFeatures: ["Thỏa thuận mức dùng theo nhóm", "Hạn mức lớn theo nhu cầu", "Tư vấn thanh toán doanh nghiệp", "Rà soát bảo mật và quyền riêng tư", "Hỗ trợ triển khai và vận hành"], contact: "Liên hệ Enterprise", enterpriseNote: "Chúng tôi xác nhận nhu cầu trước khi đề xuất phạm vi.",
    privacyTitle: "Dịch vụ không được tạo ra để thu thập cuộc trò chuyện.", privacyCopy: "Chỉ nội dung bạn yêu cầu dịch mới được xử lý. Chúng tôi không thu thập toàn bộ cuộc trò chuyện Zalo hay lưu nội dung và bản dịch trong nhật ký hoặc cơ sở dữ liệu máy chủ.", privacyLink: "Xem cách xử lý dữ liệu", comparisonTitle: "So sánh gói", featureHeading: "Tính năng", comparison: [["Dịch gửi", "30/tháng", "1.000/tháng", "Thỏa thuận"], ["Dịch nhận", "30/tháng", "1.000/tháng", "Thỏa thuận"], ["Dịch tự động", "—", "Có", "Thỏa thuận"], ["Lưu nội dung", "Không lưu", "Không lưu", "Theo thỏa thuận"], ["Người dùng", "1", "1", "Nhóm"]], faqTitle: "Câu hỏi thường gặp", faq: [["Có thể hủy bất cứ lúc nào không?", "Có. Bạn có thể hủy trong phần quản lý và tiếp tục dùng Pro đến hết kỳ đã thanh toán."], ["Khi nào Pro được kích hoạt?", "Thông thường trong vài giây sau khi thanh toán."], ["Có thể tiếp tục dùng Free không?", "Có. Free không giới hạn thời gian và không cần thông tin thanh toán."], ["Tin nhắn có được lưu không?", "Chúng tôi không lưu nội dung trong nhật ký hoặc cơ sở dữ liệu máy chủ. Nội dung yêu cầu dịch được mã hóa khi truyền tới Google Gemini API."]], opening: "Đang mở trang thanh toán an toàn…", failed: "Không thể mở trang thanh toán. Vui lòng thử lại.", freeUsage: (used, limit) => `Bạn đã dùng ${used}/${limit} lượt dịch gửi trong tháng này.`
  }
};

function byId<T extends HTMLElement>(id: string): T { const value = document.getElementById(id); if (!value) throw new Error(`Missing ${id}`); return value as T; }
function setText(id: string, value: string): void { byId(id).textContent = value; }
function fillList(id: string, values: string[]): void { const list = byId<HTMLUListElement>(id); list.replaceChildren(...values.map((value) => { const item = document.createElement("li"); item.textContent = value; return item; })); }

async function load(): Promise<void> {
  const [settingsResponse, authResponse, usageResponse] = await Promise.all([
    browser.runtime.sendMessage({ type: "get-settings" } satisfies BackgroundMessage) as Promise<BackgroundResponse<ExtensionSettings>>,
    browser.runtime.sendMessage({ type: "get-auth-state" } satisfies BackgroundMessage) as Promise<BackgroundResponse<AuthState>>,
    browser.runtime.sendMessage({ type: "get-account-usage" } satisfies BackgroundMessage) as Promise<BackgroundResponse<AccountUsage>>
  ]);
  const language = settingsResponse.ok ? settingsResponse.data.userLanguage : "ko";
  const copy = copies[language]; document.documentElement.lang = language;
  setText("hero-title", copy.heroTitle); setText("hero-description", copy.heroDescription);
  ["trust-storage", "trust-zalo", "trust-cancel"].forEach((id, index) => setText(id, copy.trust[index] ?? ""));
  setText("free-kicker", copy.freeKicker); setText("free-price", copy.freePrice); setText("free-description", copy.freeDescription); fillList("free-features", copy.freeFeatures); setText("continue-free", copy.continueFree); setText("free-note", copy.freeNote);
  setText("pro-badge", copy.proBadge); setText("pro-kicker", copy.proKicker); setText("per-month", copy.perMonth); setText("pro-renewal", copy.proRenewal); setText("pro-description", copy.proDescription); fillList("pro-features", copy.proFeatures); setText("start-pro", copy.startPro); setText("manage-pro", copy.managePro); setText("pro-note", copy.proNote);
  setText("enterprise-kicker", copy.enterpriseKicker); setText("enterprise-price", copy.enterprisePrice); setText("enterprise-description", copy.enterpriseDescription); fillList("enterprise-features", copy.enterpriseFeatures); setText("enterprise-contact", copy.contact); setText("enterprise-note", copy.enterpriseNote);
  setText("privacy-title", copy.privacyTitle); setText("privacy-copy", copy.privacyCopy); setText("privacy-link", copy.privacyLink); setText("comparison-title", copy.comparisonTitle); setText("feature-heading", copy.featureHeading); setText("faq-title", copy.faqTitle);
  const tbody = byId<HTMLTableSectionElement>("comparison-body"); tbody.replaceChildren(...copy.comparison.map((row) => { const tr = document.createElement("tr"); row.forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.append(td); }); return tr; }));
  const faqList = byId("faq-list"); faqList.replaceChildren(...copy.faq.map(([question, answer]) => { const details = document.createElement("details"); const summary = document.createElement("summary"); const paragraph = document.createElement("p"); summary.textContent = question; paragraph.textContent = answer; details.append(summary, paragraph); return details; }));
  if (authResponse.ok && authResponse.data.configured && authResponse.data.signedIn) setText("account-email", authResponse.data.user.email);
  if (usageResponse.ok) {
    const { plan, used, limits } = usageResponse.data;
    const usageMessage = byId("usage-message"); usageMessage.textContent = plan === "pro" ? copy.managePro : copy.freeUsage(used.outgoing.requests, limits.outgoing.requests); usageMessage.hidden = false;
    byId<HTMLButtonElement>("start-pro").hidden = plan === "pro"; byId<HTMLButtonElement>("manage-pro").hidden = plan !== "pro";
  }
  byId<HTMLButtonElement>("continue-free").addEventListener("click", () => window.close());
  const openBilling = async (type: "create-billing-checkout" | "create-billing-portal") => {
    const button = byId<HTMLButtonElement>(type === "create-billing-checkout" ? "start-pro" : "manage-pro"); button.disabled = true; setText("status", copy.opening);
    try { const response = await browser.runtime.sendMessage({ type } satisfies BackgroundMessage) as BackgroundResponse<BillingRedirect>; if (!response.ok) throw new Error(response.error); await browser.tabs.create({ url: response.data.url }); }
    catch (error) { setText("status", error instanceof Error ? error.message : copy.failed); button.disabled = false; }
  };
  byId("start-pro").addEventListener("click", () => void openBilling("create-billing-checkout"));
  byId("manage-pro").addEventListener("click", () => void openBilling("create-billing-portal"));
}

void load().catch((error) => { setText("status", error instanceof Error ? error.message : "Unable to load plans."); });
