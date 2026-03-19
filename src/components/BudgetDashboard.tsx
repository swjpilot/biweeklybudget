import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  db, 
  auth, 
  doc, 
  setDoc, 
  getDoc,
  Timestamp,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { getCurrentCycle, BudgetCycle } from '../services/budgetService';
import { format, startOfDay } from 'date-fns';
import { PlaidLink } from './PlaidLink';
import { TransactionList } from './TransactionList';
import { FamilySettings } from './FamilySettings';
import { CategorySettings } from './CategorySettings';
import { getTransactions } from '../services/plaidService';
import { Button } from './Button';
import { 
  LayoutDashboard, 
  CreditCard, 
  Users, 
  Settings, 
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Wallet,
  Menu,
  X as CloseIcon,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserData {
  uid: string;
  email: string;
  familyId?: string;
  plaidAccessToken?: string;
  plaidItemId?: string;
  budgetSettings?: {
    cycleStart: string;
  };
}

interface Budget {
  id: string;
  category: string;
  amount: number;
  familyId: string;
  cycleId: string;
  type: 'expense' | 'income';
}

interface Transaction {
  id: string;
  amount: number;
  date: string;
  category: string;
  name: string;
  familyId: string;
}

export const BudgetDashboard: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [family, setFamily] = useState<any>(null);

  useEffect(() => {
    console.log('BudgetDashboard: Component mounted');
    return () => console.log('BudgetDashboard: Component unmounted');
  }, []);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'family' | 'settings'>('overview');
  const [currentCycle, setCurrentCycle] = useState<BudgetCycle | null>(null);
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [plaidOpen, setPlaidOpen] = useState(false);
  const [newBudget, setNewBudget] = useState<{ category: string; amount: number; type: 'expense' | 'income' }>({ 
    category: '', 
    amount: 0, 
    type: 'expense' 
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (u) {
        // Use onSnapshot to listen for real-time updates to the user document
        const unsubUser = onSnapshot(doc(db, 'users', u.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserData;
            setUser(data);
            
            if (data.budgetSettings?.cycleStart) {
              setCurrentCycle(getCurrentCycle(new Date(data.budgetSettings.cycleStart)));
            } else {
              const today = startOfDay(new Date());
              setCurrentCycle(getCurrentCycle(today));
            }
          } else {
            // Create user doc if it doesn't exist
            const newData: UserData = { uid: u.uid, email: u.email || '' };
            await setDoc(doc(db, 'users', u.uid), newData);
            // The onSnapshot will trigger again with the new data
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        });
        
        return () => unsubUser();
      } else {
        setUser(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    console.log('BudgetDashboard: User state updated:', user?.email, 'FamilyId:', user?.familyId);
    if (user?.familyId) {
      const unsubFamily = onSnapshot(doc(db, 'families', user.familyId), (doc) => {
        setFamily(doc.data());
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `families/${user.familyId}`);
      });
      
      const unsubBudgets = onSnapshot(
        query(collection(db, 'budgets'), where('familyId', '==', user.familyId)),
        (snapshot) => {
          setBudgets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Budget)));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'budgets');
        }
      );

      const unsubTransactions = onSnapshot(
        query(collection(db, 'transactions'), where('familyId', '==', user.familyId)),
        (snapshot) => {
          setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'transactions');
        }
      );

      return () => {
        unsubFamily();
        unsubBudgets();
        unsubTransactions();
      };
    }
  }, [user?.familyId]);

  const handlePlaidSuccess = useCallback(async (accessToken: string, itemId: string) => {
    if (user) {
      await setDoc(doc(db, 'users', user.uid), {
        ...user,
        plaidAccessToken: accessToken,
        plaidItemId: itemId
      });
    }
  }, [user]);

  const handleOpenReset = useCallback(() => setPlaidOpen(false), []);

  const handleAddBudget = async () => {
    if (user?.familyId && currentCycle) {
      const id = Math.random().toString(36).substr(2, 9);
      const budgetPath = `budgets/${id}`;
      try {
        await setDoc(doc(db, 'budgets', id), {
          id,
          userId: user.uid,
          familyId: user.familyId,
          category: newBudget.category,
          amount: newBudget.amount,
          cycleId: currentCycle.id,
          type: newBudget.type
        });
        setIsAddingBudget(false);
        setNewBudget({ category: '', amount: 0, type: 'expense' });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, budgetPath);
      }
    }
  };

  const handleSyncTransactions = async () => {
    if (!user?.plaidAccessToken || !user?.familyId || !currentCycle) return;
    
    try {
      const startDate = format(currentCycle.startDate, 'yyyy-MM-dd');
      const endDate = format(currentCycle.endDate, 'yyyy-MM-dd');
      
      const data = await getTransactions(user.plaidAccessToken, startDate, endDate);
      
      if (data.transactions) {
        for (const t of data.transactions) {
          const transactionId = t.transaction_id;
          const transactionPath = `transactions/${transactionId}`;
          try {
            await setDoc(doc(db, 'transactions', transactionId), {
              id: transactionId,
              familyId: user.familyId,
              userId: user.uid,
              amount: t.amount,
              date: t.date,
              category: t.category?.[0] || 'Uncategorized',
              name: t.name,
              pending: t.pending,
              accountId: t.account_id
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, transactionPath);
          }
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const cycleTransactions = transactions.filter(t => {
    if (!currentCycle) return false;
    const date = new Date(t.date);
    return date >= currentCycle.startDate && date <= currentCycle.endDate;
  });

  const categorySpending = cycleTransactions.reduce((acc, t) => {
    // Only count positive amounts as spending
    if (t.amount > 0) {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const categoryIncome = cycleTransactions.reduce((acc, t) => {
    // Only count negative amounts as income (Plaid credits are negative)
    if (t.amount < 0) {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  const totalBudget = budgets.filter(b => b.type === 'expense').reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = cycleTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  
  const expectedIncome = budgets.filter(b => b.type === 'income').reduce((sum, b) => sum + b.amount, 0);
  const actualIncome = cycleTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (!user) return null;

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'family', label: 'Family', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-zinc-200 sticky top-0 z-40">
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
          <Wallet className="w-5 h-5" />
          <span>Bi-Weekly Budget Planner</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-50 md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-zinc-100">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
                  <Wallet className="w-6 h-6" />
                  <span>Bi-Weekly Budget Planner</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-lg"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              
              <nav className="flex-1 px-4 py-6 space-y-1">
                {navItems.map(item => (
                  <button 
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-500 hover:bg-zinc-50'}`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="p-4 border-t border-zinc-100">
                <div className="flex items-center gap-3 px-4 py-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                    {user.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{user.email}</p>
                    <button 
                      onClick={() => auth.signOut()}
                      className="text-xs text-zinc-500 hover:text-zinc-700"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-zinc-200 bg-white flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <Wallet className="w-6 h-6" />
            <span>Bi-Weekly Budget Planner</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-500 hover:bg-zinc-50'}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">{user.email}</p>
              <button 
                onClick={() => auth.signOut()}
                className="text-xs text-zinc-500 hover:text-zinc-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Hidden Plaid Link instance to avoid duplicate embeddings */}
        <div className="hidden">
          <PlaidLink 
            userId={user.uid} 
            onSuccess={handlePlaidSuccess} 
            triggerOpen={plaidOpen}
            onOpenReset={handleOpenReset}
          />
        </div>
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 md:space-y-8"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-zinc-900">Budget Overview</h1>
                    <p className="text-zinc-500 text-xs md:text-sm">
                      {currentCycle ? `${format(currentCycle.startDate, 'MMM d')} - ${format(currentCycle.endDate, 'MMM d, yyyy')}` : 'Loading cycle...'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button variant="outline" size="sm">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {!user.plaidAccessToken && (
                    <div className="bg-indigo-600 p-5 md:p-6 rounded-2xl border border-indigo-500 shadow-lg text-white sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">Connect your bank account</h3>
                          <p className="text-indigo-100 text-sm">Sync your transactions automatically to track your budget in real-time.</p>
                        </div>
                      </div>
                      <Button onClick={() => setPlaidOpen(true)} className="bg-white text-indigo-600 hover:bg-indigo-50 border-none">
                        Connect Bank Account
                      </Button>
                    </div>
                  )}
                  <div className="bg-white p-5 md:p-6 rounded-2xl border border-zinc-200 shadow-sm">
                    <p className="text-zinc-500 text-[10px] md:text-xs font-medium uppercase tracking-wider mb-1">Expected Income</p>
                    <p className="text-xl md:text-2xl font-bold text-zinc-900">${expectedIncome.toFixed(2)}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <TrendingUp className="w-3 h-3" />
                      <span>Actual: ${actualIncome.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="bg-white p-5 md:p-6 rounded-2xl border border-zinc-200 shadow-sm">
                    <p className="text-zinc-500 text-[10px] md:text-xs font-medium uppercase tracking-wider mb-1">Total Budget</p>
                    <p className="text-xl md:text-2xl font-bold text-zinc-900">${totalBudget.toFixed(2)}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs text-indigo-600 font-medium">
                      <Wallet className="w-3 h-3" />
                      <span>Expenses</span>
                    </div>
                  </div>
                  <div className="bg-white p-5 md:p-6 rounded-2xl border border-zinc-200 shadow-sm">
                    <p className="text-zinc-500 text-[10px] md:text-xs font-medium uppercase tracking-wider mb-1">Total Spent</p>
                    <p className="text-xl md:text-2xl font-bold text-zinc-900">${totalSpent.toFixed(2)}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs text-rose-600 font-medium">
                      <TrendingDown className="w-3 h-3" />
                      <span>{((totalSpent / totalBudget) * 100 || 0).toFixed(1)}% of budget</span>
                    </div>
                  </div>
                  <div className="bg-white p-5 md:p-6 rounded-2xl border border-zinc-200 shadow-sm">
                    <p className="text-zinc-500 text-[10px] md:text-xs font-medium uppercase tracking-wider mb-1">Remaining</p>
                    <p className="text-xl md:text-2xl font-bold text-zinc-900">${(totalBudget - totalSpent).toFixed(2)}</p>
                    <div className="mt-4 w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-500" 
                        style={{ width: `${Math.min((totalSpent / totalBudget) * 100 || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Income vs Expenses Summary */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <h2 className="font-bold text-zinc-900 mb-4">Cash Flow Summary</h2>
                  <div className="flex flex-col sm:flex-row gap-8">
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Income Progress</span>
                        <span className="font-medium">${actualIncome.toFixed(2)} / ${expectedIncome.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-500" 
                          style={{ width: `${Math.min((actualIncome / expectedIncome) * 100 || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Net Cash Flow</span>
                        <span className={`font-bold ${actualIncome - totalSpent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ${(actualIncome - totalSpent).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">Actual Income minus Actual Expenses</p>
                    </div>
                  </div>
                </div>

                {/* Categories & Budgeting */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                      <h2 className="font-bold text-zinc-900">Budget Categories</h2>
                      <Button variant="ghost" size="sm" onClick={() => setIsAddingBudget(true)}>
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="p-6 space-y-6">
                      {budgets.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-zinc-400 text-sm">No budgets set yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {/* Income Section */}
                          {budgets.filter(b => b.type === 'income').length > 0 && (
                            <div className="space-y-4">
                              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Expected Income</h3>
                              {budgets.filter(b => b.type === 'income').map(budget => {
                                const actual = categoryIncome[budget.category] || 0;
                                const percent = (actual / budget.amount) * 100;
                                return (
                                  <div key={budget.id} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span className="font-medium text-zinc-700">{budget.category}</span>
                                      <span className="text-zinc-500">${actual.toFixed(2)} / ${budget.amount.toFixed(2)}</span>
                                    </div>
                                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${Math.min(percent, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Expense Section */}
                          <div className="space-y-4">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Expense Budgets</h3>
                            {budgets.filter(b => b.type === 'expense').map(budget => {
                              const spent = categorySpending[budget.category] || 0;
                              const percent = (spent / budget.amount) * 100;
                              return (
                                <div key={budget.id} className="space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="font-medium text-zinc-700">{budget.category}</span>
                                    <span className="text-zinc-500">${spent.toFixed(2)} / ${budget.amount.toFixed(2)}</span>
                                  </div>
                                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-500 ${percent > 100 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                      style={{ width: `${Math.min(percent, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-zinc-100">
                      <h2 className="font-bold text-zinc-900">Recent Transactions</h2>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {cycleTransactions.slice(0, 5).map(t => (
                        <div key={t.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500">
                              <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                              <p className="text-xs text-zinc-500">{format(new Date(t.date), 'MMM d')}</p>
                            </div>
                          </div>
                          <p className={`text-sm font-bold ${t.amount < 0 ? 'text-emerald-600' : 'text-zinc-900'}`}>
                            {t.amount < 0 ? `+$${Math.abs(t.amount).toFixed(2)}` : `-$${t.amount.toFixed(2)}`}
                          </p>
                        </div>
                      ))}
                      {cycleTransactions.length === 0 && (
                        <div className="p-8 text-center">
                          <p className="text-zinc-400 text-sm">No transactions this cycle.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'transactions' && (
              <motion.div 
                key="transactions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <TransactionList 
                  transactions={transactions} 
                  family={family}
                  plaidAccessToken={user.plaidAccessToken}
                  onSync={handleSyncTransactions}
                />
              </motion.div>
            )}

            {activeTab === 'family' && (
              <motion.div 
                key="family"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <FamilySettings user={user} family={family} />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm max-w-2xl"
              >
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-6">Settings</h2>
              
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                <label className="block text-sm font-medium text-zinc-700 mb-4">Plaid Integration</label>
                {user.plaidAccessToken ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 text-sm">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      Bank account connected
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPlaidOpen(true)}>
                      Update Connection
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => setPlaidOpen(true)}>
                    Connect Bank Account
                  </Button>
                )}
              </div>
              
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Cycle Start Date</label>
                <input 
                  type="date" 
                  className="w-full p-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={user.budgetSettings?.cycleStart || ''}
                  onChange={async (e) => {
                    const newSettings = { ...user.budgetSettings, cycleStart: e.target.value };
                    const userPath = `users/${user.uid}`;
                    try {
                      await setDoc(doc(db, 'users', user.uid), { ...user, budgetSettings: newSettings });
                      setUser({ ...user, budgetSettings: newSettings });
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, userPath);
                    }
                  }}
                />
                <p className="mt-2 text-xs text-zinc-500">Your bi-weekly budget cycle will be calculated from this date.</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                <CategorySettings family={family} />
              </div>
            </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Add Budget Modal */}
      {isAddingBudget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 space-y-6"
          >
            <h3 className="text-xl font-bold">Add Budget Category</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Budget Type</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setNewBudget({ ...newBudget, type: 'expense' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium border transition-all ${newBudget.type === 'expense' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                  >
                    Expense
                  </button>
                  <button 
                    onClick={() => setNewBudget({ ...newBudget, type: 'income' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium border transition-all ${newBudget.type === 'income' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                  >
                    Income
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
                <select 
                  className="w-full p-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  value={newBudget.category}
                  onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
                >
                  <option value="">Select a category</option>
                  {(family?.categories || [
                    { id: '1', name: 'Groceries', type: 'expense' },
                    { id: '2', name: 'Dining Out', type: 'expense' },
                    { id: '3', name: 'Entertainment', type: 'expense' },
                    { id: '4', name: 'Utilities', type: 'expense' },
                    { id: '5', name: 'Rent/Mortgage', type: 'expense' },
                    { id: '6', name: 'Transport', type: 'expense' },
                    { id: '7', name: 'Shopping', type: 'expense' },
                    { id: '8', name: 'Healthcare', type: 'expense' },
                    { id: '9', name: 'Income', type: 'income' },
                  ]).filter((c: any) => c.type === newBudget.type).map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="Uncategorized">Uncategorized</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Monthly Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full pl-8 p-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newBudget.amount || ''}
                    onChange={(e) => setNewBudget({ ...newBudget, amount: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setIsAddingBudget(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddBudget}>Save Budget</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
