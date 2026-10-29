import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { api, clearToken } from '../api';

const CATEGORIES = [
  'Eating_Out',
  'Groceries',
  'Rent',
  'Transport',
  'Entertainment',
  'Healthcare',
  'Utilities',
  'Insurance',
  'Loan_Repayment',
  'Education',
  'Miscellaneous',
];

const PAGE_SIZE = 10;

const COLORS = [
  '#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#f87171',
  '#a78bfa', '#f43f5e', '#10b981', '#f59e0b', '#64748b',
];

export const Dashboard = () => {
  const navigate = useNavigate();

  // --- LIST / PAGINATION STATE ---
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);

  // --- SUMMARY STATE (computed by the server) ---
  const [todaySummary, setTodaySummary] = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);

  // --- ADD FORM STATE ---
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Eating_Out');
  const [description, setDescription] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);

  // --- EDIT STATE ---
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    category: 'Eating_Out',
    description: '',
  });

  const [error, setError] = useState('');

  // --- DATA LOADING ---
  const loadHistory = async () => {
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      if (filterCategory) params.set('category', filterCategory);
      const data = await api(`/me/expenses/?${params}`);
      setExpenses(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaries = async () => {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const d = now.getDate();
      const range = (s, e) =>
        `/me/summary?start=${encodeURIComponent(s.toISOString())}&end=${encodeURIComponent(e.toISOString())}`;

      const [today, month] = await Promise.all([
        api(range(new Date(y, m, d), new Date(y, m, d + 1))),
        api(range(new Date(y, m, 1), new Date(y, m + 1, 1))),
      ]);
      setTodaySummary(today);
      setMonthSummary(month);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    Promise.resolve().then(loadHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterCategory]);

  useEffect(() => {
    Promise.resolve().then(loadSummaries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = () => {
    loadHistory();
    loadSummaries();
  };

  // --- ADD ---
  const handleAddExpense = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await api('/me/expenses/', {
        method: 'POST',
        body: {
          amount: parseFloat(amount),
          category,
          description: description.trim() || 'Manual entry',
        },
      });
      setAnalysisResult(result);
      setAmount('');
      setDescription('');
      if (page !== 0) {
        setPage(0); // the page effect reloads the history
        loadSummaries();
      } else {
        refreshAll();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // --- EDIT ---
  const startEdit = (exp) => {
    setEditingId(exp.id);
    setEditForm({
      amount: String(exp.amount),
      category: exp.category,
      description: exp.description || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/me/expenses/${editingId}`, {
        method: 'PATCH',
        body: {
          amount: parseFloat(editForm.amount),
          category: editForm.category,
          description: editForm.description,
        },
      });
      setEditingId(null);
      refreshAll();
    } catch (err) {
      setError(err.message);
    }
  };

  // --- DELETE ---
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    setError('');
    try {
      await api(`/me/expenses/${id}`, { method: 'DELETE' });
      if (editingId === id) setEditingId(null);
      if (expenses.length === 1 && page > 0) {
        setPage(page - 1); // the page effect reloads the history
        loadSummaries();
      } else {
        refreshAll();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // --- LOGOUT ---
  const handleLogout = () => {
    clearToken();
    navigate('/');
  };

  // --- DERIVED VALUES ---
  const dailyTotal = todaySummary?.total ?? 0;
  const monthlyTotal = monthSummary?.total ?? 0;

  const chartData = (monthSummary?.by_category ?? []).map((c) => ({
    name: c.category.replace('_', ' '),
    value: c.total,
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold text-cyan-400">FiscalGuard Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-colors"
        >
          Logout
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 border-l-4 border-l-cyan-500">
          <p className="text-slate-400 text-xs uppercase font-bold">Today's Total</p>
          <h3 className="text-3xl font-bold mt-1">₹{dailyTotal.toLocaleString()}</h3>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 border-l-4 border-l-purple-500">
          <p className="text-slate-400 text-xs uppercase font-bold">This Month</p>
          <h3 className="text-3xl font-bold mt-1">₹{monthlyTotal.toLocaleString()}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT: FORM + AI RESULT */}
        <div className="space-y-8">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h2 className="text-xl mb-4 font-semibold">Log New Expense</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="amount"
                  className="text-xs text-slate-400 uppercase font-bold ml-1"
                >
                  Amount
                </label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="₹ 0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-white transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="category"
                  className="text-xs text-slate-400 uppercase font-bold ml-1"
                >
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="description"
                  className="text-xs text-slate-400 uppercase font-bold ml-1"
                >
                  Description (optional)
                </label>
                <input
                  id="description"
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Lunch with team"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-white transition-all"
                />
              </div>

              <button className="w-full bg-cyan-600 py-3 rounded-xl font-bold hover:bg-cyan-500 shadow-lg shadow-cyan-900/20 transition-all transform active:scale-95">
                Analyze with AI
              </button>
            </form>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h2 className="text-xl mb-4 font-semibold text-cyan-400">AI Guard Result</h2>
            {!analysisResult ? (
              <p className="text-slate-500 italic text-sm text-center py-4">
                Waiting for next transaction...
              </p>
            ) : (
              <div
                className={`p-4 rounded-xl border ${
                  analysisResult.is_anomaly
                    ? 'bg-red-900/20 border-red-500'
                    : 'bg-emerald-900/20 border-emerald-500'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-lg">₹{analysisResult.amount}</span>
                  <span
                    className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                      analysisResult.is_anomaly ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                  >
                    {analysisResult.is_anomaly ? 'Anomaly' : 'Normal'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {analysisResult.is_anomaly
                    ? '🚨 This looks unusually high for this category.'
                    : '✅ This looks consistent with typical spending.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: CHART + HISTORY */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg md:col-span-2 flex flex-col">
          <div className="mb-4">
            <h2 className="text-xl mb-4 font-semibold text-cyan-400 text-center">
              Category Breakdown (This Month)
            </h2>
            {chartData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-slate-500 italic">
                No spending this month
              </div>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#fff',
                      }}
                      formatter={(value) => `₹${value.toLocaleString()}`}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Transaction History
              </h3>
              <select
                aria-label="Filter by category"
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setPage(0);
                  setEditingId(null);
                }}
                className="bg-slate-800 border border-slate-700 p-2 rounded-lg text-sm text-white"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 max-h-72 min-h-30">
              {loading ? (
                <p className="text-xs text-slate-500 italic text-center py-6">Loading…</p>
              ) : expenses.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">
                  {filterCategory
                    ? 'No expenses in this category'
                    : 'No expenses yet. Log your first one.'}
                </p>
              ) : (
                expenses.map((exp) =>
                  editingId === exp.id ? (
                    <form
                      key={exp.id}
                      onSubmit={handleSaveEdit}
                      className="bg-slate-800/80 p-3 rounded-xl border border-cyan-500/40 space-y-2"
                    >
                      <div className="flex gap-2">
                        <input
                          aria-label="Amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={editForm.amount}
                          onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                          className="w-1/3 bg-slate-900 border border-slate-700 p-2 rounded-lg text-sm text-white"
                        />
                        <select
                          aria-label="Category"
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="flex-1 bg-slate-900 border border-slate-700 p-2 rounded-lg text-sm text-white"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        aria-label="Description"
                        type="text"
                        maxLength={200}
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm({ ...editForm, description: e.target.value })
                        }
                        className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-sm text-white"
                      />
                      <div className="flex justify-end gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="text-cyan-400 hover:text-cyan-300 font-bold"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      key={exp.id}
                      className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700"
                    >
                      <div>
                        <p className="font-medium">{exp.description || 'No description'}</p>
                        <p className="text-xs text-slate-500">
                          {exp.category.replace('_', ' ')}
                          {exp.timestamp &&
                            ` · ${new Date(exp.timestamp).toLocaleDateString()}`}
                          {exp.is_anomaly && (
                            <span className="ml-2 text-red-400 font-bold">ML FLAGGED</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold">₹{exp.amount.toLocaleString()}</p>
                        <button
                          type="button"
                          onClick={() => startEdit(exp)}
                          className="text-xs text-cyan-400 hover:text-cyan-300"
                          aria-label={`Edit ${exp.description || 'expense'}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(exp.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                          aria-label={`Delete ${exp.description || 'expense'}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded-lg border border-slate-700 disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Page {page + 1} of {totalPages} · {total} total
              </span>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded-lg border border-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;