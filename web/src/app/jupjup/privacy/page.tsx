import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '포인트줍줍 개인정보 수집·이용 동의',
};

export default function JupjupPrivacyPage() {
  return (
    <div style={{ padding: '20px 16px 120px', maxWidth: 640, margin: '0 auto', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>포인트줍줍 개인정보 수집·이용 동의</h1>

      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        시행일: 2026년 3월 11일
      </p>

      <p style={{ marginBottom: 20, fontSize: 14, color: '#333' }}>
        포인트줍줍(이하 &quot;서비스&quot;)은 이용자의 개인정보를 중요시하며,
        「개인정보 보호법」 등 관련 법령을 준수합니다.
        본 동의서를 통해 수집하는 개인정보의 항목, 이용 목적, 보유 기간 등을 안내합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <ul style={{ paddingLeft: 20 }}>
          <li>토스 로그인 시: 토스 사용자 식별 ID(userKey), 이름, 이메일, 성별</li>
          <li>서비스 이용 시: 위치 정보(GPS 좌표), 보물 탐색·획득 기록</li>
          <li>자동 수집: 접속 IP, 브라우저 정보, 방문 일시</li>
        </ul>
      </Section>

      <Section title="2. 개인정보의 이용 목적">
        <ul style={{ paddingLeft: 20 }}>
          <li>회원 식별 및 로그인 서비스 제공</li>
          <li>위치 기반 보물찾기 서비스 제공</li>
          <li>포인트 적립 및 관리</li>
          <li>서비스 개선 및 통계 분석 (비식별 처리)</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 보유 및 파기">
        <ul style={{ paddingLeft: 20 }}>
          <li>회원 탈퇴 또는 토스 로그인 연결 해제 시 즉시 파기</li>
          <li>관련 법령에 따라 보존이 필요한 경우 해당 기간 보관 후 파기</li>
          <li>접속 기록: 3개월 (통신비밀보호법)</li>
        </ul>
      </Section>

      <Section title="4. 개인정보 제3자 제공">
        <p>
          서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다.
          다만, 법령에 의한 요청이 있는 경우 예외로 합니다.
        </p>
      </Section>

      <Section title="5. 동의 거부 시 불이익">
        <p>
          이용자는 개인정보 수집·이용에 대한 동의를 거부할 수 있습니다.
          다만, 필수 항목에 대한 동의를 거부할 경우 서비스 이용이 제한될 수 있습니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리">
        <ul style={{ paddingLeft: 20 }}>
          <li>개인정보 열람, 수정, 삭제 요청 가능</li>
          <li>토스앱에서 로그인 연결 해제를 통한 개인정보 처리 정지 요청 가능</li>
          <li>아래 연락처로 요청 시 지체 없이 처리합니다</li>
        </ul>
      </Section>

      <Section title="7. 개인정보 보호책임자">
        <ul style={{ paddingLeft: 20, listStyle: 'none' }}>
          <li>서비스명: 포인트줍줍</li>
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
