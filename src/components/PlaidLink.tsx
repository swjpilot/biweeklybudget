import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { createLinkToken, setAccessToken } from '../services/plaidService';
import { Button } from './Button';

interface PlaidLinkProps {
  userId: string;
  onSuccess: (accessToken: string, itemId: string) => void;
  triggerOpen?: boolean;
  onOpenReset?: () => void;
}

export const PlaidLink: React.FC<PlaidLinkProps> = React.memo(({ userId, onSuccess, triggerOpen, onOpenReset }) => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('PlaidLink: Component mounted');
    return () => console.log('PlaidLink: Component unmounted');
  }, []);

  const handleSuccess = useCallback(
    async (public_token: string) => {
      try {
        const { access_token, item_id } = await setAccessToken(public_token);
        onSuccess(access_token, item_id);
      } catch (err: any) {
        setError(err.message || 'Failed to exchange public token');
      }
    },
    [onSuccess]
  );

  const handleExit = useCallback((error: any, metadata: any) => {
    if (error) {
      console.error('Plaid Link Exit Error:', error, metadata);
    } else {
      console.log('Plaid Link Exit Metadata:', metadata);
    }
  }, []);

  const config = useMemo(() => ({
    token,
    onSuccess: handleSuccess,
    onExit: handleExit,
  }), [token, handleSuccess, handleExit]);

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (triggerOpen) {
      console.log('PlaidLink: External trigger detected. ready:', ready, 'open function exists:', !!open);
      if (ready && open) {
        console.log('PlaidLink: Calling open()...');
        open();
        onOpenReset?.();
      } else if (!ready) {
        console.warn('PlaidLink: External trigger received but Plaid is not ready yet. Waiting for ready...');
      }
    }
  }, [triggerOpen, ready, open, onOpenReset]);

  useEffect(() => {
    const init = async () => {
      if (!userId) {
        console.error('PlaidLink: No userId provided');
        return;
      }
      
      console.log('PlaidLink: Checking server health...');
      try {
        const healthRes = await fetch('/api/health');
        if (!healthRes.ok) {
          throw new Error(`Server health check failed: ${healthRes.status}`);
        }
        const healthData = await healthRes.json();
        console.log('PlaidLink: Server health response:', healthData);
        
        if (!healthData.plaidConfigured) {
          setError('Plaid API keys are missing. Please add PLAID_CLIENT_ID and PLAID_SECRET to the Secrets panel in AI Studio (Settings -> Secrets).');
          return;
        }

        if (!healthData.validEnv) {
          console.warn(`PlaidLink: Server reports invalid PLAID_ENV: ${healthData.env}. Defaulting to sandbox.`);
        }
      } catch (err: any) {
        console.error('PlaidLink: Health check failed:', err);
        setError(`Cannot connect to server: ${err.message}. Please check if the dev server is running.`);
        return;
      }

      console.log('PlaidLink: Requesting link token for user:', userId);
      try {
        const data = await createLinkToken(userId);
        console.log('PlaidLink: createLinkToken response:', data);
        
        if (data.error) {
          console.error('PlaidLink: API returned error:', data.error);
          setError(data.error);
        } else if (data.link_token) {
          console.log('PlaidLink: Link token received successfully');
          setToken(data.link_token);
          setError(null);
        } else {
          console.error('PlaidLink: Unexpected response format:', data);
          setError('Received unexpected response from server when creating link token.');
        }
      } catch (err: any) {
        console.error('PlaidLink: createLinkToken exception:', err);
        setError(err.message || 'Failed to initialize Plaid Link');
      }
    };
    init();
  }, [userId]);

  useEffect(() => {
    if (token) {
      console.log('PlaidLink ready state:', ready);
    }
  }, [ready, token]);

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
        <p className="text-sm text-rose-700 mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <Button 
      onClick={() => {
        console.log('PlaidLink: Button clicked, ready:', ready, 'token:', token ? 'YES' : 'NO');
        open();
      }} 
      disabled={!ready}
    >
      {!ready && !error ? 'Initializing...' : 'Connect Bank Account'}
    </Button>
  );
});
