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

  const rounds = Array.from({ length: maxRound }, (_, i) =>
    bracketMatches
      .filter(m => m.round === i + 1)
      .sort((a, b) => a.bracket_position!.match_number - b.bracket_position!.match_number)
  );

  const finalMatch = rounds[maxRound - 1]?.[0];
  const championName = finalMatch && finalMatch.approved && finalMatch.home_score !== null && finalMatch.away_score !== null
    ? (finalMatch.home_score > finalMatch.away_score ? finalMatch.home_team.name : finalMatch.away_team.name)
    : null;

  const labels = ['Fase 1', 'Fase 2', 'Quarti', 'Semifinali', 'Finale'];

  return (
    <div className="space-y-8">
      {rounds.map((roundMatches, idx) => (
        <div key={idx}>
          <h4 className="font-semibold mb-2">{labels[idx] || `Fase ${idx + 1}`}</h4>
          <div className="space-y-3">
            {roundMatches.map(match => (
              <div key={match.id} className="bg-gray-700 rounded-lg p-3 text-center space-y-1">
                <div>{match.home_team.name}</div>
                <div className="text-sm">
                  {match.home_score !== null && match.away_score !== null ? `${match.home_score} - ${match.away_score}` : 'vs'}
                </div>
                <div>{match.away_team.name}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
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
