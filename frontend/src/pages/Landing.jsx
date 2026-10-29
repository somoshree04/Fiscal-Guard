import { Link, Navigate } from 'react-router-dom';
import HeroImg from '../assets/hero-image.svg';
import { getToken } from '../api';

// Update this if you rename the repository
const GITHUB_URL = 'https://github.com/somoshree04/Krypton-Core';

const STEPS = [
  {
    title: 'Log an expense',
    text: 'Enter the amount, a category and an optional note.',
  },
  {
    title: 'Get an instant check',
    text: 'Each expense is compared with your own spending history, or with typical spending while you are new.',
  },
  {
    title: 'See where it goes',
    text: 'Daily and monthly totals and a category breakdown update as you add entries.',
  },
];

const Landing = () => {
  if (getToken()) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-white">
      {/* --- NAVBAR --- */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">FiscalGuard</h1>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-slate-600 hover:text-slate-900 font-medium">
            Log in
          </Link>
          <Link
            to="/signup"
            className="bg-blue-600 text-white px-5 sm:px-6 py-2 rounded-full font-medium hover:bg-blue-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Sign up
          </Link>
        </div>
      </nav>

      {/* --- HERO --- */}
      <main className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center pt-10 md:pt-20">
        <div className="md:pl-12">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight">
            Stop the bleed, <br />
            <span className="text-blue-600">before it's too late.</span>
          </h2>
          <p className="text-slate-500 mt-6 text-lg max-w-md">
            FiscalGuard tracks your expenses and uses machine learning to flag
            spending that looks unusually high, the moment you log it.
          </p>
          <Link
            to="/signup"
            className="inline-block mt-10 bg-blue-600 text-white px-10 py-4 rounded-full text-lg font-bold shadow-lg hover:bg-blue-700 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Get started
          </Link>
        </div>

        <div className="flex justify-center">
          <img src={HeroImg} alt="" className="w-full h-auto max-h-[450px]" />
        </div>
      </main>

      {/* --- HOW IT WORKS --- */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">How it works</h3>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-slate-200 p-6">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                {i + 1}
              </span>
              <h4 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h4>
              <p className="mt-2 text-slate-500">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --- FOOTER --- */}
      <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-slate-200 flex flex-col sm:flex-row gap-2 justify-between text-sm text-slate-500">
        <span>© {new Date().getFullYear()} FiscalGuard</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-slate-900">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
};

export default Landing;