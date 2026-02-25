interface Props {
  keyword?: string | null;
  bargainType?: 'keyword' | 'price' | 'both' | null;
}

export default function BargainBadge({ keyword, bargainType }: Props) {
  const badges: React.ReactElement[] = [];

  if (keyword) {
    badges.push(<span key="kw" className="badge badge--red">{keyword}</span>);
  }

  if (bargainType === 'price' || bargainType === 'both') {
    badges.push(
      <span key="price" className="badge badge--orange" style={{ background: 'var(--orange-100, #fff3e0)', color: 'var(--orange-600, #e65100)' }}>
        가격↓
      </span>
    );
  }

  return badges.length > 0 ? <>{badges}</> : null;
}
