import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <div style={{ padding: '20px 16px 120px', maxWidth: 640, margin: '0 auto', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>개인정보처리방침</h1>

      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        시행일: 2026년 3월 1일
      </p>

      <p style={{ marginBottom: 20, fontSize: 14, color: '#333' }}>
        부동산 급매 레이더(이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요시하며,
        「개인정보 보호법」 등 관련 법령을 준수합니다.
        본 방침을 통해 수집하는 개인정보의 항목, 이용 목적, 보유 기간 등을 안내합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <ul style={{ paddingLeft: 20 }}>
          <li>회원가입 시: 이메일, 비밀번호(암호화 저장)</li>
          <li>토스 로그인 시: 토스 사용자 식별 ID</li>
          <li>서비스 이용 시 자동 수집: 접속 IP, 브라우저 정보, 방문 일시, 쿠키</li>
        </ul>
      </Section>

      <Section title="2. 개인정보의 이용 목적">
        <ul style={{ paddingLeft: 20 }}>
          <li>회원 식별 및 서비스 제공</li>
          <li>관심 매물 저장, 알림 등 맞춤형 서비스 제공</li>
          <li>서비스 개선 및 통계 분석 (비식별 처리)</li>
          <li>광고 게재 및 성과 측정 (Google AdSense 등 제3자 광고 포함)</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 보유 및 파기">
        <ul style={{ paddingLeft: 20 }}>
          <li>회원 탈퇴 시 즉시 파기</li>
          <li>관련 법령에 따라 보존이 필요한 경우 해당 기간 보관 후 파기</li>
          <li>접속 기록: 3개월 (통신비밀보호법)</li>
        </ul>
      </Section>

      <Section title="4. 제3자 제공 및 광고">
        <p>
          본 서비스는 Google AdSense를 통해 광고를 게재할 수 있습니다.
          Google은 쿠키를 사용하여 이용자의 관심사에 기반한 광고를 표시할 수 있으며,
          이용자는 <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer"
            style={{ color: '#3182f6', textDecoration: 'underline' }}>
            Google 광고 설정
          </a>에서 맞춤 광고를 비활성화할 수 있습니다.
        </p>
        <p style={{ marginTop: 8 }}>
          그 외 이용자의 개인정보를 제3자에게 제공하지 않습니다.
          다만, 법령에 의한 요청이 있는 경우 예외로 합니다.
        </p>
      </Section>

      <Section title="5. 쿠키(Cookie) 사용">
        <p>
          서비스는 로그인 유지, 이용자 설정 저장 등을 위해 쿠키를 사용합니다.
          이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나,
          이 경우 일부 서비스 이용이 제한될 수 있습니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리">
        <ul style={{ paddingLeft: 20 }}>
          <li>개인정보 열람, 수정, 삭제 요청 가능</li>
          <li>회원 탈퇴를 통한 개인정보 처리 정지 요청 가능</li>
          <li>아래 연락처로 요청 시 지체 없이 처리합니다</li>
        </ul>
      </Section>

      <Section title="7. 개인정보 보호책임자">
        <ul style={{ paddingLeft: 20, listStyle: 'none' }}>
          <li>서비스명: 부동산 급매 레이더</li>
          <li>이메일: dbxbqm2067@gmail.com</li>
        </ul>
      </Section>

      <Section title="8. 방침 변경">
        <p>
          본 방침은 법령 변경 또는 서비스 변경에 따라 수정될 수 있으며,
          변경 시 서비스 내 공지를 통해 안내합니다.
        </p>
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
