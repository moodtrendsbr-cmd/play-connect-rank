interface BracketConnectorProps {
  matchesInRound: number;
  roundIndex: number;
  totalRounds: number;
  matchHeight: number;
}

const BracketConnector = ({ matchesInRound, roundIndex, totalRounds, matchHeight }: BracketConnectorProps) => {
  if (roundIndex >= totalRounds - 1) return null;

  const nextRoundMatches = Math.ceil(matchesInRound / 2);
  const connectors = [];

  for (let i = 0; i < nextRoundMatches; i++) {
    const topMatch = i * 2;
    const bottomMatch = i * 2 + 1;
    const spacing = matchHeight;
    const gap = roundIndex === 0 ? spacing : spacing * Math.pow(2, roundIndex);

    const y1 = topMatch * gap + gap / 2;
    const y2 = bottomMatch < matchesInRound ? bottomMatch * gap + gap / 2 : y1;
    const midY = (y1 + y2) / 2;

    connectors.push(
      <g key={i}>
        <line x1="0" y1={y1} x2="20" y2={y1} stroke="hsl(220 15% 25%)" strokeWidth="2" />
        <line x1="20" y1={y1} x2="20" y2={y2} stroke="hsl(220 15% 25%)" strokeWidth="2" />
        {bottomMatch < matchesInRound && (
          <line x1="0" y1={y2} x2="20" y2={y2} stroke="hsl(220 15% 25%)" strokeWidth="2" />
        )}
        <line x1="20" y1={midY} x2="40" y2={midY} stroke="hsl(220 15% 25%)" strokeWidth="2" />
      </g>
    );
  }

  const totalHeight = matchesInRound * matchHeight;

  return (
    <svg width="40" height={totalHeight} className="shrink-0">
      {connectors}
    </svg>
  );
};

export default BracketConnector;
