import { T } from '@/lib/edullentTokens';

interface ComparisonCardProps {
  type: 'topper' | 'user';
  rank: number;
  name: string;
  score: number;
}

export function ComparisonCard({ type, rank, name, score }: ComparisonCardProps) {
  const isUser = type === 'user';
  return (
    <div
      style={{
        textAlign: 'center',
        padding: 14,
        borderRadius: 14,
        background: isUser
          ? 'linear-gradient(135deg, rgba(10,132,255,0.10) 0%, rgba(17,102,255,0.05) 100%)'
          : 'linear-gradient(135deg, rgba(255,204,0,0.08) 0%, rgba(255,149,0,0.04) 100%)',
        border: isUser ? `1.5px solid ${T.B1}` : '0.5px solid rgba(255,204,0,0.18)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 10,
          background: isUser
            ? 'linear-gradient(135deg, #0A84FF 0%, #3395FF 100%)'
            : 'linear-gradient(135deg, #FFCC00 0%, #FFCC00 100%)',
          color: '#FFFFFF',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: '-0.4px',
          marginBottom: 6,
        }}
      >
        {rank}
      </div>
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: T.T1,
          margin: '0 0 4px',
          letterSpacing: '-0.2px',
        }}
      >
        {name}
      </p>
      <p
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: isUser ? T.B1 : T.T1,
          margin: 0,
          letterSpacing: '-0.6px',
        }}
      >
        {score}
      </p>
    </div>
  );
}
