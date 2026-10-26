import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { api, clearToken } from '../api'; // Centralized network client abstraction layer

const Dashboard = () => {
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
    fetchHistory();
  }, []);

  // --- ADD EXPENSE HANDLER ---
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

  // --- MATH & GRAPH LOGIC ---
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  const dailyTotal = expenses
    .filter(item => item.timestamp && item.timestamp.startsWith(today))
    .reduce((sum, item) => sum + item.amount, 0);

  const monthlyTotal = expenses
    .filter(item => item.timestamp && item.timestamp.startsWith(currentMonth))
    .reduce((sum, item) => sum + item.amount, 0);

  const chartData = Object.values(
    expenses.reduce((acc, item) => {
      let unifiedCategory = item.category;
      if (item.category === "Food" || item.category === "FOOD") {
        unifiedCategory = "Eating_Out";
      }

      if (!acc[unifiedCategory]) {
        acc[unifiedCategory] = { name: unifiedCategory, value: 0 };
      }
      acc[unifiedCategory].value += item.amount;
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

      {/* DYNAMIC BACKEND/SCHEMA ERROR NOTIFICATION PROMPT */}
      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
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
        <div className="space-y-8">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h2 className="text-xl mb-4 font-semibold">Log New Expense</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 uppercase font-bold ml-1">Amount</label>
                {/* UPGRADED: Forced step bounds validation constraints to guard data decimals */}
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
                  {/* FULL CONTEXT MAP MATRIX LINKED TO BACKEND SPECIFICATIONS */}
                  <option value="Eating_Out">Eating Out</option>
                  <option value="Education">Education</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Loan_Repayment">Loan Repayment</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                  <option value="Rent">Rent</option>
                  <option value="Transport">Transport</option>
                  <option value="Utilities">Utilities</option>
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

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg min-h-[400px] md:col-span-2 flex flex-col">
          <h2 className="text-xl mb-4 font-semibold text-cyan-400 text-center">Category Breakdown</h2>
          {expenses.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 italic">No data to chart</div>
          ) : (
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={48} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
