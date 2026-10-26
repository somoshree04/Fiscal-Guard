import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { api, clearToken } from '../api'; // Centralized network client abstraction layer

// FULL CONTEXT MAP MATRIX LINKED TO BACKEND SPECIFICATIONS
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
  'Miscellaneous'
];

export const Dashboard = () => {
  const navigate = useNavigate();

  // --- COMPONENT STATES ---
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Eating_Out'); 
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(''); // Handles field and interceptor state errors

  // --- FETCH API HISTORY ---
  const fetchHistory = async () => {
    try {
      setExpenses(await api('/me/expenses/'));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadHistory = async () => {
      try {
        const history = await api('/me/expenses/');
        if (!ignore) setExpenses(history);
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    };

    loadHistory();
    return () => {
      ignore = true;
    };
  }, []);

  // --- ADD EXPENSE HANDLER (Analyzes via the left button form) ---
  const handleAddExpense = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await api('/me/expenses/', {
        method: 'POST',
        body: { amount: parseFloat(amount), category, description: 'Manual entry' },
      });
      setAnalysisResult(result);
      setAmount('');
      fetchHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  // --- LOGOUT ROUTINE ---
  const handleLogout = () => {
    clearToken();
    navigate('/');
  };

  // --- DELETE TRANSACTION HANDLER ---
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api(`/me/expenses/${id}`, { method: 'DELETE' });
      fetchHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  // Timezone normalization utils (en-CA formats as YYYY-MM-DD in the user's LOCAL timezone)
  const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA');
  const todayKey = new Date().toLocaleDateString('en-CA');
  const monthKey = todayKey.slice(0, 7);

  const todaysExpenses = expenses.filter(e => e.timestamp && localDay(e.timestamp) === todayKey);
  const monthExpenses  = expenses.filter(e => e.timestamp && localDay(e.timestamp).startsWith(monthKey));

  const dailyTotal   = todaysExpenses.reduce((s, e) => s + e.amount, 0);
  const monthlyTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const chartData = Object.values(
    monthExpenses.reduce((acc, item) => {
      acc[item.category] ??= { name: item.category.replace('_', ' '), value: 0 };
      acc[item.category].value += item.amount;
      return acc;
    }, {})
  );

  const COLORS = ['#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#f87171', '#a78bfa', '#f43f5e', '#10b981', '#f59e0b', '#64748b'];

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

      {/* DYNAMIC ERROR NOTIFICATION BOX */}
      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* METRIC CARD STATS HEADERS */}
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
        {/* LEFT COLUMN PANEL: FORM CONTROL & AI MODULE STATUS */}
        <div className="space-y-8">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h2 className="text-xl mb-4 font-semibold">Log New Expense</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 uppercase font-bold ml-1">Amount</label>
                <input 
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
                <label className="text-xs text-slate-400 uppercase font-bold ml-1">Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <button className="w-full bg-cyan-600 py-3 rounded-xl font-bold hover:bg-cyan-500 shadow-lg shadow-cyan-900/20 transition-all transform active:scale-95">
                Analyze with AI
              </button>
            </form>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h2 className="text-xl mb-4 font-semibold text-cyan-400">AI Guard Result</h2>
            {!analysisResult ? (
              <p className="text-slate-500 italic text-sm text-center py-4">Waiting for next transaction...</p>
            ) : (
              <div className={`p-4 rounded-xl border ${analysisResult.is_anomaly ? 'bg-red-900/20 border-red-500' : 'bg-emerald-900/20 border-emerald-500'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-lg">₹{analysisResult.amount}</span>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${analysisResult.is_anomaly ? 'bg-red-500' : 'bg-emerald-500'}`}>
                    {analysisResult.is_anomaly ? 'Anomaly' : 'Normal'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {analysisResult.is_anomaly 
                    ? "🚨 This looks unusually high for this category."
                    : "✅ This looks consistent with typical spending."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN PANEL: ANALYTICS VISUALIZATION & TRANSACTION LOG TABLE */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg md:col-span-2 flex flex-col justify-between min-h-130">
          <div className="mb-4">
            <h2 className="text-xl mb-4 font-semibold text-cyan-400 text-center">Category Breakdown (This Month)</h2>
            {chartData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-slate-500 italic">No spending this month</div>
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
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                      formatter={(value) => `₹${value.toLocaleString()}`}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* DYNAMIC SCROLLABLE LIST SHOWING INDIVIDUAL DELETIONS */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex-1 flex flex-col">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Transaction History</h3>
            <div className="overflow-y-auto space-y-2 pr-1 max-h-42.5 min-h-30">
              {expenses.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">No historical records available</p>
              ) : (
                expenses.map((exp) => (
                  <div key={exp.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                    <div>
                      <p className="font-medium">{exp.description}</p>
                      <p className="text-xs text-slate-500">{exp.category}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold">₹{exp.amount.toLocaleString()}</p>
                      <button
                        type="button"
                        onClick={() => handleDelete(exp.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                        aria-label={`Delete ${exp.description}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
