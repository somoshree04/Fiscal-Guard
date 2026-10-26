import { Link } from 'react-router-dom';
import HeroImg from '../assets/hero-image.svg'

const Landing = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* --- NAVBAR --- */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900">FiscalGuard</h1>
        <div className="space-x-4">
          <Link to="/Login" className="text-slate-600 hover:text-slate-900 font-medium">Log in</Link>
          <Link to="/Signup" className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium">Sign up</Link>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <main className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center pt-20">
        <div className="md:pl-12">
          <h2 className="text-6xl font-extrabold text-slate-900 leading-tight">
            Stop the bleed, <br/> 
            <span className="text-blue-600">before it's too late.</span> 
          </h2>
          <p className="text-slate-500 mt-6 text-lg max-w-md">
           FiscalGuard uses AI to watch your transactions 24/7. We'll alert you the moment your spending patterns look dangerous.
          </p>
          <Link to="/Signup">
             <button className="mt-10 bg-blue-600 text-white px-10 py-4 rounded-full text-lg font-bold shadow-lg hover:bg-blue-700 transition-all">
               SIGN UP NOW
             </button>
          </Link>
        </div>

        <div className="flex justify-center">
         <img src={HeroImg} alt="Hero" className="w-full h-auto max-h-[450px]" />
        </div>
      </main>
    </div>
  );
};

export default Landing;
