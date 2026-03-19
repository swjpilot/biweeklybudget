import React, { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, User } from './firebase';
import { BudgetDashboard } from './components/BudgetDashboard';
import { Button } from './components/Button';
import ErrorBoundary from './components/ErrorBoundary';
import { Wallet, LogIn, ShieldCheck, Zap, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50 selection:bg-indigo-100 selection:text-indigo-900">
        <AnimatePresence mode="wait">
        {user ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <BudgetDashboard />
          </motion.div>
        ) : (
          <motion.div 
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen flex flex-col items-center justify-center p-6"
          >
            <div className="max-w-md w-full space-y-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-200">
                  <Wallet className="w-8 h-8" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Bi-Weekly Budget Planner</h1>
                <p className="text-zinc-500 text-lg">
                  Smart bi-weekly budgeting for your family.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 text-left">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Plaid Integration</h3>
                    <p className="text-xs text-zinc-500">Sync transactions automatically from your bank.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Family Sharing</h3>
                    <p className="text-xs text-zinc-500">Share budgets and transactions between two logins.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Bi-Weekly Cycles</h3>
                    <p className="text-xs text-zinc-500">Optimized for bi-weekly pay periods.</p>
                  </div>
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full py-4 text-lg font-bold"
                onClick={handleLogin}
              >
                <LogIn className="w-5 h-5 mr-2" />
                Sign in with Google
              </Button>

              <p className="text-xs text-zinc-400">
                Securely powered by Firebase & Plaid
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
