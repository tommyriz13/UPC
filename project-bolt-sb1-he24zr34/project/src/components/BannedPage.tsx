import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <ShieldAlert size={64} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">
          Utente Sospeso
        </h1>
        <p className="text-gray-300">
          Il tuo account è stato sospeso. Contattare l'amministrazione per maggiori informazioni.
        </p>
      </div>
    </div>
  );
}