---
title: Zalo Language Bridge
---

# Zalo Language Bridge

Zalo Web에서 한국어·영어·베트남어 메시지를 자연스럽게 작성하고 받은 메시지를 내
언어로 확인할 수 있는 Chromium 확장프로그램입니다.

- [개인정보처리방침](privacy/)
- [GitHub 저장소](https://github.com/anchor-work/zalo-auto-translator)
- [문의 및 오류 신고](https://github.com/anchor-work/zalo-auto-translator/issues)

<h2 id="pro">Pro</h2>

Pro 요금제는 더 높은 월간 번역 한도와 받은 메시지 자동 번역을 제공합니다.
확장프로그램 설정 화면에서 **Pro 알아보기**를 눌러 월 $4.99에 구독할 수 있습니다.

<section id="billing-success" style="display:none;margin:2rem 0;padding:1.25rem;border:1px solid #86efac;border-radius:12px;background:#f0fdf4">
  <h2 style="margin-top:0">결제가 완료되었습니다</h2>
  <p>확장프로그램을 다시 열면 Pro 요금제가 자동으로 반영됩니다. 반영까지 수 초가 걸릴 수 있습니다.</p>
  <p style="margin-bottom:0">계속 무료로 표시되면 잠시 후 확장프로그램 설정 화면을 다시 열어 주세요.</p>
</section>

<script>
  (() => {
    const renderBillingResult = () => {
      const success = document.getElementById("billing-success");
      if (!success) return;
      const completed = window.location.hash === "#billing-success";
      success.style.display = completed ? "block" : "none";
      if (completed) success.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("hashchange", renderBillingResult);
    renderBillingResult();
  })();
</script>

