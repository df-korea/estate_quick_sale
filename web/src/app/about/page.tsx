import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '서비스 소개 - 부동산 급매 레이더',
  description: '전국 아파트 급매물을 한눈에! 시세 대비 저렴한 매물을 빠르게 찾아보세요.',
};

export default function AboutPage() {
  return (
    <div style={{ padding: '20px 16px 120px', maxWidth: 640, margin: '0 auto', lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>부동산 급매 레이더</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 32 }}>
        시세보다 저렴한 급매물, 놓치지 마세요.
      </p>

      <Section title="서비스 소개">
        <p>
          부동산 급매 레이더는 전국 아파트 매물 중 시세 대비 저렴하게 나온 급매물을
          자동으로 탐지하여 알려주는 서비스입니다.
        </p>
        <p style={{ marginTop: 8 }}>
          국토교통부 실거래가 등 공공·민간 데이터를 종합 분석하여
          시세 대비 할인율이 높은 매물을 선별하고, 이용자가 빠르게 투자 기회를
          포착할 수 있도록 돕습니다.
        </p>
      </Section>

      <Section title="주요 기능">
        <Feature
          emoji="&#x1F4C9;"
          title="급매물 탐지"
          desc="시세 대비 저렴한 매물을 자동으로 찾아 순위별로 보여드립니다."
        />
        <Feature
          emoji="&#x1F4CA;"
          title="시세 분석"
          desc="단지별 실거래가 추이, 호가 비교, 시세 차트를 한눈에 확인할 수 있습니다."
        />
        <Feature
          emoji="&#x1F5FA;&#xFE0F;"
          title="지도 탐색"
          desc="지도에서 지역별 급매물 분포를 직관적으로 확인하고 탐색할 수 있습니다."
        />
        <Feature
          emoji="&#x2B50;"
          title="관심 단지"
          desc="관심 있는 단지를 저장하고, 새로운 급매물이 등록되면 알림을 받을 수 있습니다."
        />
        <Feature
          emoji="&#x1F514;"
          title="급매 알림"
          desc="설정한 조건에 맞는 급매물이 나오면 즉시 알림으로 알려드립니다."
        />
      </Section>

      <Section title="문의">
        <ul style={{ paddingLeft: 20, listStyle: 'none', fontSize: 14, color: '#444' }}>
          <li>서비스명: 부동산 급매 레이더</li>
          <li>이메일: dbxbqm2067@gmail.com</li>
          <li>웹사이트: estate-rader.com</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: '#111' }}>{title}</h2>
      <div style={{ fontSize: 14, color: '#444' }}>{children}</div>
    </section>
  );
}

function Feature({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>{emoji}</span>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ color: '#666', fontSize: 13 }}>{desc}</div>
      </div>
    </div>
  );
}
