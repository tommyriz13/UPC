import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import ChatButton from './ChatButton';

interface BracketMatch {
  id: string;
  home_team: { id: string; name: string };
  away_team: { id: string; name: string };
  home_score: number | null;
  away_score: number | null;
  scheduled_for: string;
  round: number;
  leg: number;
  bracket_position: {
    match_number: number;
    round: number;
  };
  approved: boolean;
}

interface BracketProps {
  matches: BracketMatch[];
  userTeamId?: string | null;
  onSubmitResult?: (match: BracketMatch) => void;
}

export default function CompetitionBracket({ matches, userTeamId, onSubmitResult }: BracketProps) {
  const navigate = useNavigate();
  const maxRound = Math.max(...matches.map(m => m.round));

  const canSubmitResult = (match: BracketMatch) => {
    if (!userTeamId || !onSubmitResult) return false;
    if (match.approved) return false;
    
    const isPastMatch = new Date(match.scheduled_for) <= new Date();
    const isTeamInvolved = match.home_team.id === userTeamId || match.away_team.id === userTeamId;
    
    return isPastMatch && isTeamInvolved;
  };

  const renderMatch = (match: BracketMatch) => (
    <div key={match.id} className="bg-gray-800 rounded-lg p-4 w-64">
      <div className="space-y-2">
        <button
          onClick={() => navigate(`/team/${match.home_team.id}`)}
          className="w-full flex items-center justify-between hover:text-red-500 transition-colors"
        >
          <span>{match.home_team.name}</span>
          <span className="bg-gray-700 px-2 py-1 rounded min-w-[24px] text-center">
            {match.home_score !== null ? match.home_score : '-'}
          </span>
        </button>
        <button
          onClick={() => navigate(`/team/${match.away_team.id}`)}
          className="w-full flex items-center justify-between hover:text-red-500 transition-colors"
        >
          <span>{match.away_team.name}</span>
          <span className="bg-gray-700 px-2 py-1 rounded min-w-[24px] text-center">
            {match.away_score !== null ? match.away_score : '-'}
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm">
        <ChatButton
          matchId={match.id}
          homeTeamId={match.home_team.id}
          awayTeamId={match.away_team.id}
          homeTeamName={match.home_team.name}
          awayTeamName={match.away_team.name}
          scheduledFor={match.scheduled_for}
          approved={match.approved}
        />
        {canSubmitResult(match) && (
          <button
            onClick={() => onSubmitResult(match)}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg"
          >
            Submit Result
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex justify-center min-w-[1200px]">
        <div className="relative">
          {/* Trophy in the center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <Trophy size={64} className="text-yellow-500" />
          </div>

          {/* Bracket structure */}
          <div className="flex justify-center space-x-16">
            {/* Left side of bracket */}
            <div className="space-y-8">
              {Array.from({ length: maxRound }).map((_, roundIndex) => {
                const round = roundIndex + 1;
                const roundMatches = matches.filter(m => 
                  m.round === round && 
                  m.bracket_position.match_number <= Math.pow(2, maxRound - round)
                );

                return (
                  <div 
                    key={`left-${round}`}
                    className="flex flex-col space-y-16"
                    style={{ 
                      marginTop: `${Math.pow(2, roundIndex) * 2}rem`,
                      marginBottom: `${Math.pow(2, roundIndex) * 2}rem`
                    }}
                  >
                    {roundMatches.map(match => renderMatch(match))}
                  </div>
                );
              })}
            </div>

            {/* Right side of bracket */}
            <div className="space-y-8">
              {Array.from({ length: maxRound }).map((_, roundIndex) => {
                const round = roundIndex + 1;
                const roundMatches = matches.filter(m => 
                  m.round === round && 
                  m.bracket_position.match_number > Math.pow(2, maxRound - round)
                );

                return (
                  <div 
                    key={`right-${round}`}
                    className="flex flex-col space-y-16"
                    style={{ 
                      marginTop: `${Math.pow(2, roundIndex) * 2}rem`,
                      marginBottom: `${Math.pow(2, roundIndex) * 2}rem`
                    }}
                  >
                    {roundMatches.map(match => renderMatch(match))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connecting lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          >
            {matches.map(match => {
              if (match.round === maxRound) return null;

              const x1 = match.bracket_position.match_number <= Math.pow(2, maxRound - match.round) ? '100%' : '0';
              const x2 = match.bracket_position.match_number <= Math.pow(2, maxRound - match.round) ? '0' : '100%';
              const y1 = `${(match.bracket_position.match_number - 1) * 100 / Math.pow(2, match.round - 1)}%`;
              const y2 = `${match.bracket_position.match_number * 100 / Math.pow(2, match.round)}%`;

              return (
                <line
                  key={`line-${match.id}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#4B5563"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}