import React from 'react';
import { Users2, Trophy } from 'lucide-react';

const teams = [
  {
    id: 1,
    name: 'Team Alpha',
    players: 17,
    game: 'FC25',
    mode: '11 vs 11'
  },
  {
    id: 2,
    name: 'Gladiators',
    players: 25,
    game: 'FC25',
    mode: '11 vs 11'
  },
  {
    id: 3,
    name: 'Phoenix Squad',
    players: 21,
    game: 'FC25',
    mode: '11 vs 11'
  },
  {
    id: 4,
    name: 'Elite Warriors',
    players: 18,
    game: 'FC25',
    mode: '11 vs 11'
  },
];

const TeamList = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Lista Squadre</h1>
        <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
          <Users2 size={20} />
          <span>Crea Squadra</span>
        </button>
      </div>
      
      <div className="space-y-4">
        {teams.map((team) => (
          <div 
            key={team.id}
            className="bg-gray-800 rounded-lg p-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-gray-700 p-2 rounded-lg">
                <Trophy size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{team.name}</h3>
                <p className="text-gray-400 text-sm">
                  {team.players} Giocatori
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-300">{team.game}</p>
                <p className="text-sm text-gray-400">{team.mode}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TeamList;