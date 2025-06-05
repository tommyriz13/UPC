import React from 'react';
import { Trophy } from 'lucide-react';

interface Team {
  id: string;
  name: string;
}

interface BracketMatch {
  id: string;
  home_team: Team;
  away_team: Team;
  home_score: number | null;
  away_score: number | null;
  scheduled_for: string;
  round: number;
  leg: number;
  bracket_position?: { match_number: number; round: number } | null;
  approved: boolean;
}

interface Props {
  matches: BracketMatch[];
}

export default function KnockoutBracket({ matches }: Props) {
  const bracketMatches = matches.filter(m => m.bracket_position);
  const maxRound = bracketMatches.length > 0 ? Math.max(...bracketMatches.map(m => m.round)) : 0;

  const grouped: Record<number, Record<number, BracketMatch[]>> = {};
  bracketMatches.forEach(m => {
    const r = m.round;
    const n = m.bracket_position!.match_number;
    if (!grouped[r]) grouped[r] = {};
    if (!grouped[r][n]) grouped[r][n] = [];
    grouped[r][n].push(m);
  });

  const rounds = Array.from({ length: maxRound }, (_, i) => grouped[i + 1] || {});
  const labels = ['Fase 1', 'Fase 2', 'Quarti', 'Semifinali', 'Finale'];

  const finalRoundGroups = rounds[maxRound - 1];
  let championName: string | null = null;
  if (finalRoundGroups) {
    const firstKey = Object.keys(finalRoundGroups)[0];
    if (firstKey) {
      const finalLegs = finalRoundGroups[parseInt(firstKey, 10)];
      if (finalLegs.every(l => l.approved && l.home_score !== null && l.away_score !== null)) {
        const leg1 = finalLegs.find(l => l.leg === 1)!;
        const leg2 = finalLegs.find(l => l.leg === 2);
        const t1 = (leg1.home_score || 0) + (leg2 ? leg2.away_score || 0 : 0);
        const t2 = (leg1.away_score || 0) + (leg2 ? leg2.home_score || 0 : 0);
        championName = t1 > t2 ? leg1.home_team.name : leg1.away_team.name;
      }
    }
  }

  return (
    <div className="space-y-8">
      {rounds.map((roundGroups, idx) => {
        const numbers = Object.keys(roundGroups).map(n => parseInt(n, 10)).sort((a, b) => a - b);
        if (numbers.length === 0) return null;
        return (
          <div key={idx}>
            <h4 className="font-semibold mb-2">{labels[idx] || `Fase ${idx + 1}`}</h4>
            <div className="space-y-3">
              {numbers.map(num => {
                const legs = roundGroups[num];
                const leg1 = legs.find(l => l.leg === 1)!;
                const leg2 = legs.find(l => l.leg === 2);
                const allApproved = legs.every(l => l.approved && l.home_score !== null && l.away_score !== null);
                const agg1 = (leg1.home_score || 0) + (leg2 ? leg2.away_score || 0 : 0);
                const agg2 = (leg1.away_score || 0) + (leg2 ? leg2.home_score || 0 : 0);
                const winnerId =
                  allApproved && (agg1 !== agg2 || leg2 || idx + 1 === rounds.length)
                    ? agg1 > agg2
                      ? leg1.home_team.id
                      : agg2 > agg1
                        ? leg1.away_team.id
                        : null
                    : null;

                const homeHighlight = allApproved && winnerId === leg1.home_team.id ? 'border-2 border-yellow-500' : '';
                const awayHighlight = allApproved && winnerId === leg1.away_team.id ? 'border-2 border-yellow-500' : '';

                return (
                  <div key={num} className="space-y-1">
                    <div className={`bg-gray-700 rounded-lg p-2 ${homeHighlight}`}>{leg1.home_team.name}</div>
                    <div className="text-center text-sm">
                      {leg1.home_score !== null && leg1.away_score !== null ? `Andata: ${leg1.home_score} - ${leg1.away_score}` : 'Andata: vs'}
                    </div>
                    {leg2 && (
                      <div className="text-center text-sm">
                        {leg2.home_score !== null && leg2.away_score !== null ? `Ritorno: ${leg2.home_score} - ${leg2.away_score}` : 'Ritorno: vs'}
                      </div>
                    )}
                    <div className={`bg-gray-700 rounded-lg p-2 ${awayHighlight}`}>{leg1.away_team.name}</div>
                    {leg1.home_score !== null && leg1.away_score !== null && leg2 && leg2.home_score !== null && leg2.away_score !== null && (
                      <div className="text-center text-xs text-gray-300">Totale: {agg1} - {agg2}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {championName && (
        <div className="flex flex-col items-center space-y-2">
          <h4 className="font-semibold">Vincitore</h4>
          <div className="bg-gray-700 rounded-lg p-3">{championName}</div>
          <Trophy size={24} className="text-yellow-500" />
        </div>
      )}
    </div>
  );
}
