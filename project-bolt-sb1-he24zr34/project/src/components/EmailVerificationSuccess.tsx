import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export default function EmailVerificationSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        // Get the hash fragment from the URL
        const hashFragment = window.location.hash;
        if (!hashFragment) {
          console.error('No hash fragment found in URL');
          return;
        }

        // Extract the access token from the hash
        const params = new URLSearchParams(hashFragment.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (!accessToken || !refreshToken) {
          console.error('Missing tokens in URL');
          return;
        }

        // Set the session using the access token
        const { data: { session }, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Error setting session:', error);
          throw error;
        }

        if (session) {
          console.log('Session successfully set');
          toast.success('Email verificata con successo! Benvenuto!');
          
          // Redirect after successful verification
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 2000);
        }
      } catch (error) {
        console.error('Error handling email verification:', error);
        toast.error('Si è verificato un errore durante la verifica dell\'email');
        
        // Redirect even on error after a delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      }
    };

    handleEmailVerification();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle size={64} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">
          Email Verificata con Successo!
        </h1>
        <p className="text-gray-300 mb-6">
          Il tuo indirizzo email è stato verificato. Ora puoi accedere a tutte le funzionalità del sito.
        </p>
        <div className="animate-pulse text-sm text-gray-400">
          Verrai reindirizzato automaticamente tra qualche secondo...
        </div>
      </div>
    </div>
  );
}