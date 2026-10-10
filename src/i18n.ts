import type {
  TranslationLanguage,
  TranslationTone,
  VietnameseAddress
} from "./types";

const copy = {
  ko: {
    appName: "Zalo 번역기",
    popupDescription: "내 언어로 작성하고, 상대방의 언어로 자연스럽게 번역하세요.",
    welcomeTitle: "먼저 내 언어를 선택하세요",
    welcomeDescription: "화면 표시와 받은 메시지 번역에 사용할 기본 언어입니다.",
    languageSelector: "Language · 언어 · Ngôn ngữ",
    userLanguage: "내 기본 언어",
    userGender: "사용자의 성별",
    genderDescription: "관계별 호칭을 자연스럽게 번역하는 데 사용됩니다.",
    male: "남성",
    female: "여성",
    genderRequired: "사용자의 성별을 선택해 주세요.",
    outgoingLanguage: "기본 보내는 언어",
    enabled: "확장프로그램 사용",
    start: "시작하기",
    saved: "자동 저장했습니다. 열려 있는 Zalo 탭을 새로고침해 주세요.",
    saveFailed: "설정을 저장하지 못했습니다.",
    loadFailed: "설정을 불러오지 못했습니다.",
    usageToday: "오늘 사용량",
    translations: "번역",
    characters: "원문",
    errors: "오류",
    times: "회",
    chars: "자",
    languageHint: "내 언어와 같은 받은 메시지는 번역 버튼을 표시하지 않습니다.",
    panelTitle: "메시지 번역",
    collapse: "번역기 접기",
    expand: "번역기 펼치기",
    clickComposer: "전송할 Zalo 메시지 입력창을 한 번 클릭해 주세요.",
    sourceMessage: "{language} 메시지",
    sourcePlaceholder: "여기에 {language}로 입력하세요",
    targetLanguage: "보내는 언어",
    conversationLanguage: "현재 대화의 언어",
    conversationSettings: "대화 설정",
    editConversationSettings: "대화 설정 편집",
    conversationSettingsDone: "설정 완료",
    resetConversationSettings: "재설정",
    relationship: "상대방과의 관계",
    relationshipUnknown: "모름",
    relationshipFriend: "친구",
    relationshipCoworker: "동료",
    relationshipCustomer: "고객",
    relationshipGroup: "단체방",
    relativeAge: "상대방은 나보다",
    ageUnknown: "모름",
    ageOlder: "연상",
    ageSame: "동갑",
    ageYounger: "연하",
    recipientGender: "상대방의 성별",
    genderUnknown: "모름",
    addressRecommendation: "추천 호칭: {address}",
    dragPanel: "제목 영역을 드래그하여 이동",
    resetPanelPosition: "패널 위치 초기화",
    detectAutomatically: "자동 감지",
    vietnameseAddress: "베트남어 호칭 관계",
    tone: "말투",
    autoIncoming: "새로 받은 메시지 자동 번역",
    incomingHint: "내 언어와 다른 메시지만 번역 아이콘을 표시합니다. 짧고 애매한 메시지는 수동으로 번역할 수 있습니다.",
    clearAll: "모두 지우기",
    translateTo: "{language}로 번역",
    translating: "번역 중…",
    translateAgain: "다시 번역",
    preview: "번역 미리보기 · 직접 수정 가능",
    cancel: "번역 취소",
    sendToZalo: "Zalo로 전송",
    sending: "전송 중…",
    keyboardTranslate: "Enter: 번역 · Shift+Enter: 줄바꿈 · Esc: 번역 취소",
    keyboardSend: "Enter: 전송 · Shift+Enter: 줄바꿈 · Esc: 번역 취소",
    keyboardTranslating: "번역 중입니다…",
    keyboardSending: "Zalo로 전송 중입니다…",
    cancelled: "번역을 취소했습니다. 원문은 그대로 유지됩니다.",
    cleared: "내용을 모두 지웠습니다. 새 메시지를 작성하세요.",
    enterAfterInput: "메시지를 입력한 뒤 Enter를 눌러 번역하세요.",
    enterToSend: "Enter를 누르면 번역문을 Zalo로 전송합니다.",
    changed: "원문, 언어, 호칭 또는 말투가 변경되었습니다. 다시 번역합니다.",
    stale: "번역 조건이 변경되었습니다. 다시 번역해 주세요.",
    composerConnectedSend: "Zalo 입력창이 연결되었습니다. Enter를 누르면 번역문을 전송합니다.",
    composerConnectedWrite: "Zalo 입력창이 연결되었습니다. 번역 패널에 메시지를 작성하세요.",
    composerRequired: "전송할 Zalo 대화 입력창을 먼저 한 번 클릭해 주세요.",
    inputRequired: "위 입력란에 번역할 메시지를 입력해 주세요.",
    preparing: "{language} 번역을 준비하고 있습니다.",
    reviewThenSend: "번역을 확인하거나 수정하세요. Enter를 한 번 더 누르면 전송됩니다.",
    translationFailed: "번역에 실패했습니다.",
    checkTranslation: "전송할 {language} 번역문을 확인해 주세요.",
    sendingToZalo: "Zalo로 전송하고 있습니다…",
    sendUnconfirmed: "자동 전송을 확인하지 못했습니다. Zalo 입력창의 번역문을 확인한 뒤 직접 전송해 주세요.",
    sent: "메시지를 전송했습니다. 새 메시지를 작성할 수 있습니다.",
    sendFailed: "Zalo 전송 중 오류가 발생했습니다. 입력창 연결 상태를 확인하고 다시 시도해 주세요.",
    incomingTranslate: "{language}로 번역",
    incomingClose: "{language} 번역 닫기",
    incomingLoading: "{language} 번역 중",
    incomingRetry: "{language} 번역 재시도",
    incomingFailed: "받은 메시지 번역에 실패했습니다.",
    incomingTitle: "{language} 번역 · 클릭하여 닫기",
    closeTranslation: "클릭하면 번역을 닫습니다.",
    autoOn: "지금부터 다른 언어로 받은 새 메시지를 자동 번역합니다.",
    autoOff: "받은 메시지 자동 번역을 껐습니다.",
    autoSaveFailed: "자동 번역 설정을 저장하지 못했습니다.",
    editedPreview: "수정한 번역문을 확인하세요. Enter를 누르면 전송됩니다."
  },
  en: {
    appName: "Zalo Translator", popupDescription: "Write in your language and translate naturally for the recipient.",
    welcomeTitle: "Choose your language first", welcomeDescription: "This language is used for the interface and incoming-message translations.",
    languageSelector: "Language · 언어 · Ngôn ngữ", userLanguage: "My language", userGender: "Your gender",
    genderDescription: "Used to translate relationship-based forms of address naturally.", male: "Male", female: "Female", genderRequired: "Choose your gender.",
    outgoingLanguage: "Default sending language", enabled: "Enable extension", start: "Get started",
    saved: "Saved automatically. Refresh any open Zalo tabs.", saveFailed: "Could not save settings.", loadFailed: "Could not load settings.",
    usageToday: "Today's usage", translations: "Translations", characters: "Source", errors: "Errors", times: "", chars: " chars",
    languageHint: "Incoming messages already in your language will not show a translate button.", panelTitle: "Message translator",
    collapse: "Collapse translator", expand: "Expand translator", clickComposer: "Click the Zalo message box you want to send to.",
    sourceMessage: "Message in {language}", sourcePlaceholder: "Type here in {language}", targetLanguage: "Send in",
    conversationLanguage: "Current chat language", conversationSettings: "Chat settings", editConversationSettings: "Edit chat settings",
    conversationSettingsDone: "Done", resetConversationSettings: "Use defaults", relationship: "Relationship",
    relationshipUnknown: "Unknown", relationshipFriend: "Friend", relationshipCoworker: "Coworker", relationshipCustomer: "Customer", relationshipGroup: "Group chat",
    relativeAge: "The other person is", ageUnknown: "Unknown", ageOlder: "Older than me", ageSame: "The same age", ageYounger: "Younger than me",
    recipientGender: "Other person's gender", genderUnknown: "Unknown", addressRecommendation: "Suggested address: {address}",
    dragPanel: "Drag the title bar to move", resetPanelPosition: "Reset panel position",
    detectAutomatically: "Auto detect", vietnameseAddress: "Vietnamese address terms", tone: "Tone",
    autoIncoming: "Auto-translate new incoming messages", incomingHint: "Only messages in another language show the translate icon. Short or ambiguous messages can be translated manually.",
    clearAll: "Clear all", translateTo: "Translate to {language}", translating: "Translating…", translateAgain: "Translate again",
    preview: "Translation preview · Editable", cancel: "Cancel translation", sendToZalo: "Send to Zalo", sending: "Sending…",
    keyboardTranslate: "Enter: translate · Shift+Enter: new line · Esc: cancel", keyboardSend: "Enter: send · Shift+Enter: new line · Esc: cancel",
    keyboardTranslating: "Translating…", keyboardSending: "Sending to Zalo…", cancelled: "Translation cancelled. Your original message is unchanged.",
    cleared: "Everything was cleared. Write a new message.", enterAfterInput: "Type a message, then press Enter to translate.",
    enterToSend: "Press Enter to send the translation to Zalo.", changed: "The message or translation options changed. Translating again.",
    stale: "Translation options changed. Translate again.", composerConnectedSend: "Zalo message box connected. Press Enter to send.",
    composerConnectedWrite: "Zalo message box connected. Write your message in the translator.", composerRequired: "Click the target Zalo message box first.",
    inputRequired: "Enter a message to translate above.", preparing: "Preparing the {language} translation.",
    reviewThenSend: "Review or edit the translation. Press Enter again to send.", translationFailed: "Translation failed.",
    checkTranslation: "Check the {language} translation before sending.", sendingToZalo: "Sending to Zalo…",
    sendUnconfirmed: "Automatic sending could not be confirmed. Check the text in Zalo and send it manually.",
    sent: "Message sent. You can write a new message.", sendFailed: "An error occurred while sending. Check the Zalo message box and try again.",
    incomingTranslate: "Translate to {language}", incomingClose: "Close {language} translation", incomingLoading: "Translating to {language}",
    incomingRetry: "Retry {language} translation", incomingFailed: "Could not translate the incoming message.",
    incomingTitle: "{language} translation · Click to close", closeTranslation: "Click to close the translation.",
    autoOn: "New messages in other languages will now be translated automatically.", autoOff: "Incoming auto-translation is off.",
    autoSaveFailed: "Could not save the auto-translation setting.", editedPreview: "Review the edited translation. Press Enter to send."
  },
  vi: {
    appName: "Trình dịch Zalo", popupDescription: "Soạn bằng ngôn ngữ của bạn và dịch tự nhiên cho người nhận.",
    welcomeTitle: "Trước tiên, hãy chọn ngôn ngữ của bạn", welcomeDescription: "Ngôn ngữ này dùng cho giao diện và bản dịch tin nhắn nhận được.",
    languageSelector: "Language · 언어 · Ngôn ngữ", userLanguage: "Ngôn ngữ của tôi", userGender: "Giới tính của bạn",
    genderDescription: "Dùng để dịch cách xưng hô theo quan hệ một cách tự nhiên.", male: "Nam", female: "Nữ", genderRequired: "Hãy chọn giới tính của bạn.",
    outgoingLanguage: "Ngôn ngữ gửi mặc định", enabled: "Bật tiện ích", start: "Bắt đầu",
    saved: "Đã tự động lưu. Hãy tải lại các tab Zalo đang mở.", saveFailed: "Không thể lưu cài đặt.", loadFailed: "Không thể tải cài đặt.",
    usageToday: "Mức dùng hôm nay", translations: "Bản dịch", characters: "Ký tự gốc", errors: "Lỗi", times: " lần", chars: " ký tự",
    languageHint: "Tin nhắn nhận được cùng ngôn ngữ với bạn sẽ không hiện nút dịch.", panelTitle: "Dịch tin nhắn",
    collapse: "Thu gọn trình dịch", expand: "Mở rộng trình dịch", clickComposer: "Hãy bấm vào ô nhập tin nhắn Zalo muốn gửi.",
    sourceMessage: "Tin nhắn bằng {language}", sourcePlaceholder: "Nhập bằng {language} tại đây", targetLanguage: "Ngôn ngữ gửi",
    conversationLanguage: "Ngôn ngữ cuộc trò chuyện", conversationSettings: "Cài đặt cuộc trò chuyện", editConversationSettings: "Sửa cài đặt cuộc trò chuyện",
    conversationSettingsDone: "Hoàn tất", resetConversationSettings: "Dùng mặc định", relationship: "Mối quan hệ",
    relationshipUnknown: "Chưa rõ", relationshipFriend: "Bạn bè", relationshipCoworker: "Đồng nghiệp", relationshipCustomer: "Khách hàng", relationshipGroup: "Nhóm chat",
    relativeAge: "Người kia", ageUnknown: "Chưa rõ", ageOlder: "Lớn tuổi hơn tôi", ageSame: "Bằng tuổi", ageYounger: "Nhỏ tuổi hơn tôi",
    recipientGender: "Giới tính người kia", genderUnknown: "Chưa rõ", addressRecommendation: "Xưng hô đề xuất: {address}",
    dragPanel: "Kéo thanh tiêu đề để di chuyển", resetPanelPosition: "Đặt lại vị trí bảng",
    detectAutomatically: "Tự động nhận diện", vietnameseAddress: "Cách xưng hô tiếng Việt", tone: "Giọng điệu",
    autoIncoming: "Tự động dịch tin nhắn mới nhận", incomingHint: "Chỉ tin nhắn khác ngôn ngữ mới hiện biểu tượng dịch. Tin nhắn ngắn hoặc khó xác định có thể dịch thủ công.",
    clearAll: "Xóa tất cả", translateTo: "Dịch sang {language}", translating: "Đang dịch…", translateAgain: "Dịch lại",
    preview: "Xem trước bản dịch · Có thể chỉnh sửa", cancel: "Hủy bản dịch", sendToZalo: "Gửi qua Zalo", sending: "Đang gửi…",
    keyboardTranslate: "Enter: dịch · Shift+Enter: xuống dòng · Esc: hủy", keyboardSend: "Enter: gửi · Shift+Enter: xuống dòng · Esc: hủy",
    keyboardTranslating: "Đang dịch…", keyboardSending: "Đang gửi qua Zalo…", cancelled: "Đã hủy bản dịch. Tin nhắn gốc vẫn được giữ nguyên.",
    cleared: "Đã xóa nội dung. Hãy soạn tin nhắn mới.", enterAfterInput: "Nhập tin nhắn rồi nhấn Enter để dịch.",
    enterToSend: "Nhấn Enter để gửi bản dịch qua Zalo.", changed: "Tin nhắn hoặc tùy chọn dịch đã thay đổi. Hãy dịch lại.",
    stale: "Tùy chọn dịch đã thay đổi. Hãy dịch lại.", composerConnectedSend: "Đã kết nối ô nhập Zalo. Nhấn Enter để gửi.",
    composerConnectedWrite: "Đã kết nối ô nhập Zalo. Hãy soạn tin trong bảng dịch.", composerRequired: "Hãy bấm vào ô nhập Zalo muốn gửi trước.",
    inputRequired: "Hãy nhập tin nhắn cần dịch ở trên.", preparing: "Đang chuẩn bị bản dịch {language}.",
    reviewThenSend: "Kiểm tra hoặc chỉnh sửa bản dịch. Nhấn Enter lần nữa để gửi.", translationFailed: "Dịch thất bại.",
    checkTranslation: "Hãy kiểm tra bản dịch {language} trước khi gửi.", sendingToZalo: "Đang gửi qua Zalo…",
    sendUnconfirmed: "Không thể xác nhận gửi tự động. Hãy kiểm tra nội dung trong Zalo và gửi thủ công.",
    sent: "Đã gửi tin nhắn. Bạn có thể soạn tin mới.", sendFailed: "Có lỗi khi gửi. Hãy kiểm tra ô nhập Zalo và thử lại.",
    incomingTranslate: "Dịch sang {language}", incomingClose: "Đóng bản dịch {language}", incomingLoading: "Đang dịch sang {language}",
    incomingRetry: "Thử dịch lại sang {language}", incomingFailed: "Không thể dịch tin nhắn nhận được.",
    incomingTitle: "Bản dịch {language} · Bấm để đóng", closeTranslation: "Bấm để đóng bản dịch.",
    autoOn: "Tin nhắn mới bằng ngôn ngữ khác sẽ được dịch tự động.", autoOff: "Đã tắt tự động dịch tin nhắn nhận được.",
    autoSaveFailed: "Không thể lưu cài đặt tự động dịch.", editedPreview: "Hãy kiểm tra bản dịch đã sửa. Nhấn Enter để gửi."
  }
} as const;

export type UiTextKey = keyof typeof copy.ko;

export function uiText(
  language: TranslationLanguage,
  key: UiTextKey,
  variables: Record<string, string | number> = {}
): string {
  let value: string = copy[language][key];
  Object.entries(variables).forEach(([name, replacement]) => {
    value = value.replaceAll(`{${name}}`, String(replacement));
  });
  return value;
}

const languageNames: Record<TranslationLanguage, Record<TranslationLanguage, string>> = {
  ko: { ko: "한국어", en: "영어", vi: "베트남어" },
  en: { ko: "Korean", en: "English", vi: "Vietnamese" },
  vi: { ko: "Tiếng Hàn", en: "Tiếng Anh", vi: "Tiếng Việt" }
};

export function languageName(uiLanguage: TranslationLanguage, value: TranslationLanguage): string {
  return languageNames[uiLanguage][value];
}

const toneNames: Record<TranslationLanguage, Record<TranslationTone, string>> = {
  ko: { natural: "자연스럽게", polite: "정중하게", friendly: "친구에게", coworker: "동료에게", customer: "고객에게", elder: "연장자에게" },
  en: { natural: "Natural", polite: "Polite", friendly: "Friendly", coworker: "For a coworker", customer: "For a customer", elder: "Respectful" },
  vi: { natural: "Tự nhiên", polite: "Lịch sự", friendly: "Thân thiện", coworker: "Với đồng nghiệp", customer: "Với khách hàng", elder: "Kính trọng" }
};

export function toneName(uiLanguage: TranslationLanguage, value: TranslationTone): string {
  return toneNames[uiLanguage][value];
}

const addressNames: Record<TranslationLanguage, Record<VietnameseAddress, string>> = {
  ko: { neutral: "관계 모름 · tôi / bạn", older_male: "상대가 약간 연상 남성 · em / anh", older_female: "상대가 약간 연상 여성 · em / chị", younger_from_male: "내가 연상 남성 · anh / em", younger_from_female: "내가 연상 여성 · chị / em", same_age: "동갑 또는 친구 · mình / bạn", much_older_male: "상대가 많이 연상 남성 · cháu / chú", much_older_female: "상대가 많이 연상 여성 · cháu / cô", customer: "고객 · tôi / anh·chị·quý khách" },
  en: { neutral: "Unknown relationship · tôi / bạn", older_male: "Slightly older man · em / anh", older_female: "Slightly older woman · em / chị", younger_from_male: "I am an older man · anh / em", younger_from_female: "I am an older woman · chị / em", same_age: "Same age or friend · mình / bạn", much_older_male: "Much older man · cháu / chú", much_older_female: "Much older woman · cháu / cô", customer: "Customer · tôi / anh·chị·quý khách" },
  vi: { neutral: "Chưa rõ quan hệ · tôi / bạn", older_male: "Nam lớn tuổi hơn một chút · em / anh", older_female: "Nữ lớn tuổi hơn một chút · em / chị", younger_from_male: "Tôi là nam lớn tuổi hơn · anh / em", younger_from_female: "Tôi là nữ lớn tuổi hơn · chị / em", same_age: "Bằng tuổi hoặc bạn bè · mình / bạn", much_older_male: "Nam lớn tuổi hơn nhiều · cháu / chú", much_older_female: "Nữ lớn tuổi hơn nhiều · cháu / cô", customer: "Khách hàng · tôi / anh·chị·quý khách" }
};

export function addressName(uiLanguage: TranslationLanguage, value: VietnameseAddress): string {
  return addressNames[uiLanguage][value];
}

export function browserLanguage(value: string): TranslationLanguage {
  const normalized = value.toLowerCase();
  if (normalized.startsWith("ko")) return "ko";
  if (normalized.startsWith("vi")) return "vi";
  return "en";
}
