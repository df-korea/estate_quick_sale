interface Props {
  keyword?: string | null;
}

export default function BargainBadge({ keyword }: Props) {
  if (!keyword) return null;
  return <span className="badge badge--red">{keyword}</span>;
}
