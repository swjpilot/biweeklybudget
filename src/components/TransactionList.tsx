import React, { useState } from 'react';
import { format } from 'date-fns';
import { CreditCard, Search, Filter, Download, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import { db, doc, updateDoc, handleFirestoreError, OperationType } from '../firebase';

interface Transaction {
  id: string;
  amount: number;
  date: string;
  category: string;
  name: string;
  familyId: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  family: any;
  plaidAccessToken?: string;
  onSync: () => Promise<void>;
}

export const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  family,
  plaidAccessToken,
  onSync 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const categories = family?.categories || [
    { id: '1', name: 'Groceries', type: 'expense' },
    { id: '2', name: 'Dining Out', type: 'expense' },
    { id: '3', name: 'Entertainment', type: 'expense' },
    { id: '4', name: 'Utilities', type: 'expense' },
    { id: '5', name: 'Rent/Mortgage', type: 'expense' },
    { id: '6', name: 'Transport', type: 'expense' },
    { id: '7', name: 'Shopping', type: 'expense' },
    { id: '8', name: 'Healthcare', type: 'expense' },
    { id: '9', name: 'Income', type: 'income' },
  ];

  const filteredTransactions = transactions
    .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 t.category.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSync = async () => {
    setIsSyncing(true);
    await onSync();
    setIsSyncing(false);
  };

  const handleCategoryChange = async (transactionId: string, newCategory: string) => {
    const transactionPath = `transactions/${transactionId}`;
    try {
      await updateDoc(doc(db, 'transactions', transactionId), {
        category: newCategory
      });
      setEditingTransactionId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, transactionPath);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Transactions</h1>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync} 
            disabled={!plaidAccessToken || isSyncing}
          >
            <Download className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Transactions
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search transactions..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none md:hidden" onClick={handleSync} disabled={!plaidAccessToken || isSyncing}>
              <Download className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 text-xs font-medium uppercase tracking-wider">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Transaction</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {format(new Date(t.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-zinc-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editingTransactionId === t.id ? (
                      <select 
                        autoFocus
                        className="text-xs p-1 rounded border border-indigo-500 bg-white outline-none"
                        value={t.category}
                        onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                        onBlur={() => setEditingTransactionId(null)}
                      >
                        {categories.map((c: any) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        <option value="Uncategorized">Uncategorized</option>
                      </select>
                    ) : (
                      <button 
                        onClick={() => setEditingTransactionId(t.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        {t.category}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-zinc-900">
                    -${t.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 text-sm">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-zinc-100">
          {filteredTransactions.map(t => (
            <div key={t.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-500">{format(new Date(t.date), 'MMM d')}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-300" />
                    {editingTransactionId === t.id ? (
                      <select 
                        autoFocus
                        className="text-[10px] p-0.5 rounded border border-indigo-500 bg-white outline-none"
                        value={t.category}
                        onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                        onBlur={() => setEditingTransactionId(null)}
                      >
                        {categories.map((c: any) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        <option value="Uncategorized">Uncategorized</option>
                      </select>
                    ) : (
                      <button 
                        onClick={() => setEditingTransactionId(t.id)}
                        className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider flex items-center gap-0.5"
                      >
                        {t.category}
                        <ChevronDown className="w-2 h-2" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm font-bold text-zinc-900">-${t.amount.toFixed(2)}</p>
            </div>
          ))}
          {filteredTransactions.length === 0 && (
            <div className="p-12 text-center text-zinc-400 text-sm">
              No transactions found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
