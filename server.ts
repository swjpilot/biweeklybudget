import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as keyof typeof PlaidEnvironments;

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.error('CRITICAL: PLAID_CLIENT_ID or PLAID_SECRET is missing from environment variables.');
  console.error('Please add them to the Secrets panel in AI Studio (Settings -> Secrets).');
}

if (!PlaidEnvironments[PLAID_ENV]) {
  console.error(`CRITICAL: Invalid PLAID_ENV value: ${PLAID_ENV}. Expected 'sandbox', 'development', or 'production'.`);
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(configuration);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    plaidConfigured: !!(PLAID_CLIENT_ID && PLAID_SECRET),
    resendConfigured: !!process.env.RESEND_API_KEY,
    env: PLAID_ENV,
    validEnv: !!PlaidEnvironments[PLAID_ENV]
  });
});

// Plaid Endpoints
app.post('/api/create_link_token', async (req, res) => {
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    return res.status(500).json({ 
      error: 'Plaid API keys are missing. Please add PLAID_CLIENT_ID and PLAID_SECRET to the Secrets panel in AI Studio.' 
    });
  }
  try {
    const { userId } = req.body;
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Bi-Weekly Budget Planner',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json(response.data);
  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('Error creating link token:', plaidError);
    res.status(500).json({ 
      error: typeof plaidError === 'object' ? plaidError.error_message || plaidError.display_message || JSON.stringify(plaidError) : plaidError 
    });
  }
});

app.post('/api/set_access_token', async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await client.itemPublicTokenExchange({
      public_token,
    });
    res.json(response.data);
  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('Error exchanging public token:', plaidError);
    res.status(500).json({ 
      error: typeof plaidError === 'object' ? plaidError.error_message || plaidError.display_message || JSON.stringify(plaidError) : plaidError 
    });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { access_token, start_date, end_date } = req.body;
    const response = await client.transactionsGet({
      access_token,
      start_date,
      end_date,
    });
    res.json(response.data);
  } catch (error: any) {
    const plaidError = error.response?.data || error.message;
    console.error('Error fetching transactions:', plaidError);
    res.status(500).json({ 
      error: typeof plaidError === 'object' ? plaidError.error_message || plaidError.display_message || JSON.stringify(plaidError) : plaidError 
    });
  }
});

// Email Invitation Endpoint
app.post('/api/send-invite', async (req, res) => {
  const { email, fromEmail, familyName, appUrl } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  if (!resend) {
    console.warn('RESEND_API_KEY is missing. Email not sent, but request acknowledged.');
    return res.json({ success: true, message: 'Email service not configured, but invite recorded.' });
  }

  try {
    console.log(`Attempting to send invite email to: ${email}`);
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [email], // Use array for 'to'
      subject: `Invitation to join ${familyName} on Budget Planner`,
      text: `Hi! ${fromEmail} has invited you to join their family group "${familyName}" on the Bi-Weekly Budget Planner. Accept here: ${appUrl}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #4f46e5;">You've been invited!</h2>
          <p>Hi there,</p>
          <p><strong>${fromEmail}</strong> has invited you to join their family group <strong>"${familyName}"</strong> on the Bi-Weekly Budget Planner.</p>
          <p>Collaborate on budgets, track shared expenses, and manage your family's finances together.</p>
          <div style="margin-top: 30px;">
            <a href="${appUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">If you didn't expect this invitation, you can safely ignore this email.</p>
          <p style="margin-top: 10px; font-size: 10px; color: #9ca3af;">Note: If you are the developer, remember that Resend's free tier only allows sending to your own verified email until you add a custom domain.</p>
        </div>
      `,
    });

    if (result.error) {
      console.error('Resend API Error Details:', JSON.stringify(result.error, null, 2));
      
      let userMessage = result.error.message;
      if (result.error.name === 'validation_error' && result.error.message.toLowerCase().includes('restriction')) {
        userMessage = "Resend Restriction: You can only send emails to your own verified email address (the one you signed up with) until you verify a custom domain in the Resend dashboard.";
      }

      return res.status(400).json({ 
        error: userMessage, 
        name: result.error.name,
        code: (result.error as any).code
      });
    }

    res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Unexpected Error sending email:', error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });
}

startServer();
