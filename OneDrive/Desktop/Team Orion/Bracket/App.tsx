import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TournamentPage from './pages/TournamentPage';
import BracketPage from './pages/BracketPage';
import TournamentAdminPage from './pages/TournamentAdminPage';
import SuperAdminPage from './pages/SuperAdminPage';
import NotFoundPage from './pages/NotFoundPage';
import { Icons } from './constants';

const Header = () => (
  <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
    <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center">
          <Link to="/" className="text-white flex items-center gap-2">
            <Icons.Trophy className="h-8 w-8 text-indigo-400"/>
            <span className="font-orbitron text-2xl font-bold tracking-wider">Team0rion</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
            <Link to="/admin/create" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 flex items-center gap-2">
              <Icons.PlusCircle className="h-5 w-5"/>
              <span>Create Tournament</span>
            </Link>
            <Link to="/superadmin" className="text-slate-300 hover:text-white transition-colors">
              <Icons.Settings className="h-6 w-6" />
            </Link>
        </div>
      </div>
    </nav>
  </header>
);

const Footer = () => (
  <footer className="bg-slate-900 border-t border-slate-800 mt-12">
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-slate-400">
      <p>&copy; {new Date().getFullYear()} Team0rion Tournaments. All rights reserved. Hosted by HeroCallGames</p>
      <p className="text-sm mt-2">The ultimate platform for competitive gaming.</p>
    </div>
  </footer>
);


const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <Header />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
};


function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentPage />} />
          <Route path="/tournaments/:tournamentId/bracket" element={<BracketPage />} />
          <Route path="/admin/:action/:tournamentId?" element={<TournamentAdminPage />} />
          <Route path="/superadmin" element={<SuperAdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;