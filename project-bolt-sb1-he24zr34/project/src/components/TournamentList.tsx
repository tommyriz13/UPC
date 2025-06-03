import React from 'react';
import { Trophy, FileText } from 'lucide-react';

const tournaments = [
  {
    id: 1,
    name: 'UPC Pro League Season II',
    series: 'A',
    creator: 'Admin',
    status: 'In Corso',
  },
  {
    id: 2,
    name: 'UPC Championship Cup',
    series: 'B',
    creator: 'Admin',
    status: 'In Corso',
  },
  {
    id: 3,
    name: 'Divisione Regionale',
    series: 'C',
    creator: 'Admin',
    status: 'In Corso',
  },
  {
    id: 4,
    name: 'Lega Amatoriale',
    series: 'D',
    creator: 'Franz',
    status: 'In Corso',
  },
];

const TournamentList = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Lista Tornei</h1>
      
      <div className="space-y-4">
        {tournaments.map((tournament) => (
          <div 
            key={tournament.id}
            className="bg-gray-800 rounded-lg p-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-gray-700 p-2 rounded-lg">
                <Trophy size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {tournament.name}
                </h3>
                <p className="text-gray-400 text-sm">
                  Creato da {tournament.creator}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-sm">
                {tournament.status}
              </span>
              <button className="text-gray-400 hover:text-white">
                <FileText size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TournamentList;