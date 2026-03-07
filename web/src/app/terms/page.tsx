import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관',
};

export default function TermsPage() {
  return (
    <div style={{ padding: '20px 16px 120px', maxWidth: 640, margin: '0 auto', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>이용약관</h1>

      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        시행일: 2026년 3월 1일
      </p>

      <Section title="제1조 (목적)">
        <p>
          본 약관은 부동산 급매 레이더(이하 &quot;서비스&quot;)가 제공하는 모든 서비스의 이용 조건 및
          절차, 이용자와 서비스 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>
      </Section>

      <Section title="제2조 (정의)">
        <ul style={{ paddingLeft: 20 }}>
          <li>&quot;서비스&quot;란 부동산 급매 레이더가 제공하는 부동산 급매물 정보 조회, 시세 분석, 관심 매물 저장 등 관련 제반 서비스를 말합니다.</li>
          <li>&quot;이용자&quot;란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
          <li>&quot;회원&quot;이란 서비스에 가입하여 이메일 또는 토스 계정으로 로그인한 이용자를 말합니다.</li>
        </ul>
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)">
        <ul style={{ paddingLeft: 20 }}>
          <li>본 약관은 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력이 발생합니다.</li>
          <li>서비스는 관련 법령을 위배하지 않는 범위에서 약관을 개정할 수 있으며, 변경 시 서비스 내 공지합니다.</li>
          <li>변경된 약관에 동의하지 않는 이용자는 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="제4조 (서비스의 제공)">
        <p>서비스는 다음과 같은 기능을 제공합니다:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>전국 아파트 급매물 정보 조회</li>
          <li>단지별 시세 분석 및 가격 비교</li>
          <li>관심 단지 및 매물 저장</li>
          <li>급매물 알림 서비스</li>
          <li>기타 부동산 관련 정보 제공</li>
        </ul>
      </Section>

      <Section title="제5조 (서비스 이용)">
        <ul style={{ paddingLeft: 20 }}>
          <li>서비스는 연중무휴 24시간 제공을 원칙으로 하나, 시스템 점검 등의 사유로 일시 중단될 수 있습니다.</li>
          <li>서비스에서 제공하는 부동산 정보는 참고 목적이며, 실제 거래 시 반드시 직접 확인해야 합니다.</li>
          <li>서비스는 무료로 제공되며, 향후 유료 서비스 도입 시 별도 안내합니다.</li>
        </ul>
      </Section>

      <Section title="제6조 (이용자의 의무)">
        <p>이용자는 다음 행위를 해서는 안 됩니다:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위</li>
          <li>서비스의 정보를 무단으로 수집, 복제, 배포하는 행위</li>
          <li>서비스의 운영을 방해하거나 비정상적인 방법으로 접근하는 행위</li>
          <li>기타 관련 법령에 위반되는 행위</li>
        </ul>
      </Section>

      <Section title="제7조 (면책조항)">
        <ul style={{ paddingLeft: 20 }}>
          <li>서비스는 공공 데이터 및 외부 데이터를 기반으로 정보를 제공하며, 정보의 정확성·완전성을 보장하지 않습니다.</li>
          <li>이용자가 서비스 정보를 기반으로 내린 투자·거래 결정에 대해 서비스는 책임지지 않습니다.</li>
          <li>천재지변, 시스템 장애 등 불가항력으로 인한 서비스 중단에 대해 책임지지 않습니다.</li>
        </ul>
      </Section>

      <Section title="제8조 (저작권 및 지적재산권)">
        <ul style={{ paddingLeft: 20 }}>
          <li>서비스가 제작한 콘텐츠의 저작권은 서비스에 귀속됩니다.</li>
          <li>이용자는 서비스의 콘텐츠를 사전 동의 없이 상업적으로 이용할 수 없습니다.</li>
        </ul>
      </Section>

      <Section title="제9조 (분쟁 해결)">
        <ul style={{ paddingLeft: 20 }}>
          <li>서비스 이용과 관련한 분쟁은 대한민국 법령에 따릅니다.</li>
          <li>분쟁 발생 시 관할 법원은 서비스 운영자의 소재지를 관할하는 법원으로 합니다.</li>
        </ul>
      </Section>

      <Section title="제10조 (문의)">
        <ul style={{ paddingLeft: 20, listStyle: 'none' }}>
          <li>서비스명: 부동산 급매 레이더</li>
          <li>이메일: dbxbqm2067@gmail.com</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#111' }}>{title}</h2>
      <div style={{ fontSize: 14, color: '#444' }}>{children}</div>
    </section>
  );
}
