import React, { useState } from 'react';
import { 
  db, 
  doc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { Button } from './Button';
import { Plus, Trash2, Edit2, Check, X, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
}

interface CategorySettingsProps {
  family: any;
}

export const CategorySettings: React.FC<CategorySettingsProps> = ({ family }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<{ name: string; type: 'expense' | 'income' }>({
    name: '',
    type: 'expense'
  });
  const [editName, setEditName] = useState('');

  const categories: Category[] = family?.categories || [
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

  const handleAdd = async () => {
    if (!newCategory.name || !family?.id) return;

    const id = Math.random().toString(36).substr(2, 9);
    const updatedCategories = [...categories, { id, ...newCategory }];
    
    try {
      await updateDoc(doc(db, 'families', family.id), {
        categories: updatedCategories
      });
      setNewCategory({ name: '', type: 'expense' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `families/${family.id}`);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName || !family?.id) return;

    const updatedCategories = categories.map(c => 
      c.id === id ? { ...c, name: editName } : c
    );

    try {
      await updateDoc(doc(db, 'families', family.id), {
        categories: updatedCategories
      });
      setEditingId(null);
      setEditName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `families/${family.id}`);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!family?.id || !window.confirm(`Are you sure you want to delete "${category.name}"? All associated transactions will be moved to "Uncategorized".`)) return;

    const updatedCategories = categories.filter(c => c.id !== category.id);

    try {
      // 1. Update family categories
      await updateDoc(doc(db, 'families', family.id), {
        categories: updatedCategories
      });

      // 2. Cleanup transactions
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('familyId', '==', family.id), where('category', '==', category.name));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
          batch.update(d.ref, { category: 'Uncategorized' });
        });
        await batch.commit();
      }

      // 3. Cleanup budgets
      const budgetsRef = collection(db, 'budgets');
      const bq = query(budgetsRef, where('familyId', '==', family.id), where('category', '==', category.name));
      const bSnapshot = await getDocs(bq);

      if (!bSnapshot.empty) {
        const batch = writeBatch(db);
        bSnapshot.docs.forEach(d => {
          batch.update(d.ref, { category: 'Uncategorized' });
        });
        await batch.commit();
      }

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `families/${family.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-zinc-900 flex items-center gap-2">
          <Tag className="w-5 h-5 text-indigo-600" />
          Budget Categories
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 space-y-3"
            >
              <input 
                autoFocus
                type="text" 
                placeholder="Category name..."
                className="w-full p-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => setNewCategory({ ...newCategory, type: 'expense' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${newCategory.type === 'expense' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-zinc-200 text-zinc-500'}`}
                >
                  Expense
                </button>
                <button 
                  onClick={() => setNewCategory({ ...newCategory, type: 'income' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${newCategory.type === 'income' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-zinc-200 text-zinc-500'}`}
                >
                  Income
                </button>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 h-8 text-xs" onClick={handleAdd}>Save</Button>
                <Button variant="ghost" className="flex-1 h-8 text-xs" onClick={() => setIsAdding(false)}>Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {categories.map(category => (
          <div key={category.id} className="p-4 rounded-2xl border border-zinc-200 bg-white flex items-center justify-between group hover:border-indigo-200 transition-colors">
            <div className="flex-1 mr-4">
              {editingId === category.id ? (
                <div className="flex items-center gap-2">
                  <input 
                    autoFocus
                    type="text" 
                    className="flex-1 p-1.5 rounded-lg border border-indigo-500 text-sm outline-none"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(category.id)}
                  />
                  <button onClick={() => handleUpdate(category.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700">{category.name}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${category.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-500'}`}>
                    {category.type}
                  </span>
                </div>
              )}
            </div>
            
            {!editingId && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setEditingId(category.id);
                    setEditName(category.name);
                  }}
                  className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(category)}
                  className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
