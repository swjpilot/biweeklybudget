export const createLinkToken = async (userId: string) => {
  try {
    const response = await fetch('/api/create_link_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    
    return response.json();
  } catch (error: any) {
    console.error('createLinkToken fetch error:', error);
    throw error;
  }
};

export const setAccessToken = async (public_token: string) => {
  try {
    const response = await fetch('/api/set_access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_token }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    
    return response.json();
  } catch (error: any) {
    console.error('setAccessToken fetch error:', error);
    throw error;
  }
};

export const getTransactions = async (access_token: string, start_date: string, end_date: string) => {
  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token, start_date, end_date }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    
    return response.json();
  } catch (error: any) {
    console.error('getTransactions fetch error:', error);
    throw error;
  }
};
