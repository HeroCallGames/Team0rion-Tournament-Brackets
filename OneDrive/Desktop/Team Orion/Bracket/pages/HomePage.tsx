import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tournament, TournamentStatus } from '../types';
import { tournamentService } from '../services/tournamentService';
import { Card } from '../components/ui';
import { Icons } from '../constants';

const TournamentCard = ({ tournament }: { tournament: Tournament }) => (
    <Link to={`/tournaments/${tournament.id}`}>
      <Card className="hover:border-indigo-500 hover:scale-105 transition-all duration-300 ease-in-out cursor-pointer group flex flex-col h-full">
          <div className="relative">
              <img src={tournament.bannerUrl || `https://picsum.photos/seed/${tournament.id}/400/200`} alt={`${tournament.name} banner`} className="w-full h-40 object-cover rounded-t-lg mb-4" />
              <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-xs font-bold px-2 py-1 rounded">{tournament.status}</div>
          </div>
          <div className="flex-grow">
            <h3 className="text-xl font-orbitron font-bold text-white truncate group-hover:text-indigo-400 transition-colors">{tournament.name}</h3>
            <p className="text-slate-400 font-semibold mb-2">{tournament.gameTitle}</p>
            <div className="flex items-center gap-2 text-slate-300 text-sm mb-4">
                <Icons.Users className="w-4 h-4" />
                <span>{tournament.players.length} Players</span>
            </div>
            <p className="text-slate-400 text-sm line-clamp-2">{tournament.description}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center text-sm text-slate-400">
            <span>{tournament.tournamentType}</span>
            <span>{new Date(tournament.startDate).toLocaleDateString()}</span>
          </div>
      </Card>
    </Link>
);

const HomePage: React.FC = () => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [popularGames, setPopularGames] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGame, setFilterGame] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        setTournaments(tournamentService.getTournaments());
        setPopularGames(tournamentService.getAssets().popularGames);
    }, []);

    const filteredTournaments = useMemo(() => {
        return tournaments
            .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(t => filterGame ? t.gameTitle === filterGame : true)
            .filter(t => {
                if (filterStatus) {
                    return t.status === filterStatus; // If a filter is set, just use it
                }
                return t.status !== TournamentStatus.ARCHIVED; // Otherwise, hide archived
            })
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [tournaments, searchTerm, filterGame, filterStatus]);

    return (
        <div>
            <div className="text-center mb-12">
                <h1 className="text-5xl md:text-6xl font-orbitron font-black text-white uppercase tracking-wider">Find Your Arena</h1>
                <p className="mt-4 text-lg text-slate-300 max-w-2xl mx-auto">Discover, join, and compete in community-run gaming tournaments.</p>
            </div>

            <Card className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                        type="text"
                        placeholder="Search by tournament name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                        value={filterGame}
                        onChange={(e) => setFilterGame(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All Games</option>
                        {popularGames.map(game => <option key={game} value={game}>{game}</option>)}
                    </select>
                     <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All Statuses</option>
                        {Object.values(TournamentStatus).map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                </div>
            </Card>

            {filteredTournaments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTournaments.map(t => <TournamentCard key={t.id} tournament={t} />)}
                </div>
            ) : (
                <div className="text-center py-16">
                    <h2 className="text-2xl font-bold text-slate-300">No Tournaments Found</h2>
                    <p className="text-slate-400 mt-2">Try adjusting your search filters or create a new tournament!</p>
                </div>
            )}
        </div>
    );
};

export default HomePage;
