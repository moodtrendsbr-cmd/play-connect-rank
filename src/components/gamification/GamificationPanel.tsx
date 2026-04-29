import XpLevelBar from "./XpLevelBar";
import StreakCounter from "./StreakCounter";
import BadgesGrid from "./BadgesGrid";
import RankPosition from "./RankPosition";

interface Props {
  athleteId: string;
  showBadges?: boolean;
}

const GamificationPanel = ({ athleteId, showBadges = true }: Props) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <XpLevelBar athleteId={athleteId} />
        <StreakCounter athleteId={athleteId} />
      </div>
      <RankPosition athleteId={athleteId} />
      {showBadges && (
        <div>
          <h3 className="text-sm font-display text-foreground/80 mb-2">Conquistas</h3>
          <BadgesGrid athleteId={athleteId} />
        </div>
      )}
    </div>
  );
};

export default GamificationPanel;
