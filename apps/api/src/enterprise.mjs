const TEAM_SIZES = new Set(["1-10", "11-50", "51-200", "201+", "unknown"]);
const LANGUAGES = new Set(["ko", "en", "vi"]);

export class EnterpriseInquiryError extends Error {
  constructor(message, statusCode = 400, code = "invalid_enterprise_inquiry") {
    super(message);
    this.name = "EnterpriseInquiryError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function cleanText(value, label, minimum, maximum) {
  if (typeof value !== "string") throw new EnterpriseInquiryError(`${label}을(를) 확인해 주세요.`);
  const cleaned = value.replace(/\u0000/g, "").trim();
  const length = [...cleaned].length;
  if (length < minimum || length > maximum) throw new EnterpriseInquiryError(`${label}은(는) ${minimum}~${maximum}자로 입력해 주세요.`);
  return cleaned;
}

export function validateEnterpriseInquiry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EnterpriseInquiryError("문의 내용을 확인해 주세요.");
  const teamSize = typeof value.teamSize === "string" ? value.teamSize : "";
  const language = typeof value.language === "string" ? value.language : "";
  if (!TEAM_SIZES.has(teamSize)) throw new EnterpriseInquiryError("예상 사용 인원을 선택해 주세요.");
  if (!LANGUAGES.has(language)) throw new EnterpriseInquiryError("문의 언어를 확인해 주세요.");
  return {
    name: cleanText(value.name, "담당자 이름", 1, 80),
    company: cleanText(value.company, "회사·팀 이름", 1, 120),
    teamSize,
    message: cleanText(value.message, "문의 내용", 10, 2000),
    language
  };
}

export function createEnterpriseInquiryService({
  apiKey = process.env.RESEND_API_KEY,
  recipient = process.env.ENTERPRISE_CONTACT_TO,
  sender = process.env.ENTERPRISE_CONTACT_FROM,
  fetchImpl = fetch
} = {}) {
  return {
    async send(inquiry, identity) {
      if (!apiKey || !recipient || !sender) {
        throw new EnterpriseInquiryError("문의 접수가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.", 503, "inquiry_service_unavailable");
      }
      if (typeof identity?.email !== "string" || !identity.email.includes("@")) {
        throw new EnterpriseInquiryError("로그인 계정의 이메일을 확인할 수 없습니다.", 400, "account_email_missing");
      }
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: sender,
          to: [recipient],
          reply_to: identity.email,
          subject: `[Zalo Language Bridge] Enterprise 문의 · ${inquiry.company}`,
          text: [
            `담당자: ${inquiry.name}`,
            `회사·팀: ${inquiry.company}`,
            `예상 인원: ${inquiry.teamSize}`,
            `문의 언어: ${inquiry.language}`,
            `회신 이메일: ${identity.email}`,
            "",
            inquiry.message
          ].join("\n")
        })
      });
      if (!response.ok) {
        throw new EnterpriseInquiryError("문의를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", 502, "inquiry_delivery_failed");
      }
      return { received: true };
    }
  };
}
