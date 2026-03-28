import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '포인트줍줍 서비스 이용약관',
};

export default function JupjupTermsPage() {
  return (
    <div style={{ padding: '20px 16px 120px', maxWidth: 640, margin: '0 auto', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>포인트줍줍 서비스 이용약관</h1>

      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        시행일: 2026년 3월 11일
      </p>

      <Section title="제1조 (목적)">
        <p>
          본 약관은 포인트줍줍(이하 &quot;서비스&quot;)이 제공하는 위치 기반 보물찾기 게임 및
          관련 서비스의 이용 조건과 절차, 이용자와 서비스 간의 권리·의무 및 책임사항을
          규정함을 목적으로 합니다.
        </p>
      </Section>

      <Section title="제2조 (정의)">
        <ul style={{ paddingLeft: 20 }}>
          <li>&quot;서비스&quot;란 포인트줍줍이 제공하는 위치 기반 보물찾기, 퀴즈, 포인트 적립 등 관련 제반 서비스를 말합니다.</li>
          <li>&quot;이용자&quot;란 본 약관에 따라 서비스를 이용하는 회원을 말합니다.</li>
          <li>&quot;회원&quot;이란 토스 계정으로 로그인하여 서비스에 가입한 이용자를 말합니다.</li>
          <li>&quot;보물&quot;이란 서비스 내 특정 위치에 배치된 디지털 콘텐츠(퀴즈, 포인트 등)를 말합니다.</li>
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
          <li>위치 기반 보물 탐색 및 발견</li>
          <li>퀴즈 풀기를 통한 보물 획득</li>
          <li>보물 숨기기(하이더) 기능</li>
          <li>포인트 적립 및 관리</li>
          <li>기타 위치 기반 게임 관련 서비스</li>
        </ul>
      </Section>

      <Section title="제5조 (서비스 이용)">
        <ul style={{ paddingLeft: 20 }}>
          <li>서비스는 연중무휴 24시간 제공을 원칙으로 하나, 시스템 점검 등의 사유로 일시 중단될 수 있습니다.</li>
          <li>서비스 이용을 위해 위치 정보 접근 권한이 필요하며, 이용자 동의 하에 위치 정보를 수집합니다.</li>
          <li>서비스는 무료로 제공되며, 향후 유료 서비스 도입 시 별도 안내합니다.</li>
        </ul>
      </Section>

      <Section title="제6조 (이용자의 의무)">
        <p>이용자는 다음 행위를 해서는 안 됩니다:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위</li>
          <li>GPS 위조 등 비정상적인 방법으로 보물을 획득하는 행위</li>
          <li>서비스의 운영을 방해하거나 비정상적인 방법으로 접근하는 행위</li>
          <li>자동화 프로그램을 이용하여 서비스를 이용하는 행위</li>
          <li>기타 관련 법령에 위반되는 행위</li>
        </ul>
      </Section>

      <Section title="제7조 (면책조항)">
        <ul style={{ paddingLeft: 20 }}>
          <li>서비스는 위치 정보의 정확성을 보장하지 않으며, GPS 오차로 인한 불이익에 대해 책임지지 않습니다.</li>
          <li>이용자가 서비스 이용 중 발생한 안전사고에 대해 서비스는 책임지지 않습니다.</li>
          <li>천재지변, 시스템 장애 등 불가항력으로 인한 서비스 중단에 대해 책임지지 않습니다.</li>
        </ul>
      </Section>

      <Section title="제8조 (분쟁 해결)">
        <ul style={{ paddingLeft: 20 }}>
          <li>서비스 이용과 관련한 분쟁은 대한민국 법령에 따릅니다.</li>
          <li>분쟁 발생 시 관할 법원은 서비스 운영자의 소재지를 관할하는 법원으로 합니다.</li>
        </ul>
      </Section>

      <Section title="제9조 (문의)">
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
