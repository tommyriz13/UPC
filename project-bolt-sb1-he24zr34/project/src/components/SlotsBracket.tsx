import React from 'react';

interface Team {
  id: string;
  name: string;
  logo_url?: string | null;
}

interface Match {
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
}

interface Props {
  slots: Record<string, Team | undefined>;
  matches?: Match[];
}

const TeamBox = ({ team, result }:{ team?: Team; result?: { home: number | null; away: number | null } }) => (
  <div className="bg-gray-700 rounded-lg p-2 flex items-center justify-between">
    <div className="flex items-center space-x-2">
      {team?.logo_url && (
        <img src={team.logo_url} alt={team.name} className="w-6 h-6 rounded" />
      )}
      <span>{team ? team.name : '—'}</span>
    </div>
    {result && result.home !== null && result.away !== null && (
      <span className="flex space-x-1 text-sm">
        <span className="bg-gray-800 px-2 py-0.5 rounded">{result.home}</span>
        <span>-</span>
        <span className="bg-gray-800 px-2 py-0.5 rounded">{result.away}</span>
      </span>
    )}
  </div>
);

export default function SlotsBracket({ slots, matches = [] }: Props) {
  const slotCount = Object.keys(slots).length;
  const pairs = [] as { teamA?: Team; teamB?: Team; result?: Match }[];

  for (let i = 0; i < slotCount; i += 2) {
    const teamA = slots[`slot_${i + 1}`];
    const teamB = slots[`slot_${i + 2}`];
    const match = matches.find(
      m =>
        (m.home_team_id === teamA?.id && m.away_team_id === teamB?.id) ||
        (m.home_team_id === teamB?.id && m.away_team_id === teamA?.id)
    );
    pairs.push({ teamA, teamB, result: match });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex flex-col space-y-2">
          <TeamBox
            team={pair.teamA}
            result={pair.result && {
              home:
                pair.result.home_team_id === pair.teamA?.id
                  ? pair.result.home_score
                  : pair.result.away_score,
              away:
                pair.result.home_team_id === pair.teamA?.id
                  ? pair.result.away_score
                  : pair.result.home_score,
            }}
          />
          <TeamBox
            team={pair.teamB}
            result={pair.result && {
              home:
                pair.result.home_team_id === pair.teamB?.id
                  ? pair.result.home_score
                  : pair.result.away_score,
              away:
                pair.result.home_team_id === pair.teamB?.id
                  ? pair.result.away_score
                  : pair.result.home_score,
            }}
          />
        </div>
      ))}
    </div>
  );
}
