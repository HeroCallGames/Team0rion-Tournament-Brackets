import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tournament, Match, Player, City } from '../types';
import { tournamentService } from '../services/tournamentService';
import { Button, Modal, Card, Input, ConfirmationModal } from '../components/ui';
import SingleEliminationBracket from '../components/SingleEliminationBracket';
import { Icons } from '../constants';
import NotFoundPage from './NotFoundPage';

const BracketPage: React.FC = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [cities, setCities] = useState<City[]>([]);
    const [isReportScoreOpen, setReportScoreOpen] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Player[]>([]);
    const bracketRef = useRef<{ focusOnPlayer: (playerId: string) => void }>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    const loadTournament = useCallback(() => {
        if (tournamentId) {
            const t = tournamentService.getTournamentById(tournamentId);
            const assets = tournamentService.getAssets();
            setCities(assets.cities || []);
            if (t) {
                setTournament(t);

                if (!t.bracket || t.bracket.winners.length === 0) {
                     alert("Bracket not generated for this tournament yet.");
                     navigate(`/tournaments/${tournamentId}`);
                }
            } else {
                navigate('/notfound');
            }
        }
    }, [tournamentId, navigate]);
    
    useEffect(() => {
        loadTournament();

        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        // After a short delay, clear any animation flags so they don't replay on refresh.
        const timer = setTimeout(() => {
            if(tournamentId) {
                const currentTournament = tournamentService.getTournamentById(tournamentId);
                if (currentTournament?.bracket?.winners.some(r => r.some(m => m.justCompleted))) {
                    tournamentService.clearJustCompletedFlags(tournamentId);
                }
            }
        }, 5000);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };

    }, [loadTournament, tournamentId]);
    
    const handleScoreReport = useCallback((match: Match) => {
        setSelectedMatch(match);
        setReportScoreOpen(true);
    }, []);

    const handleReportSuccess = useCallback(() => {
        if(tournamentId) {
            const t = tournamentService.getTournamentById(tournamentId);
            setTournament(t || null);
        }
    }, [tournamentId]);
    
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length > 1 && tournament) {
            const filtered = tournament.players.filter(p =>
                p.gamertag.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 10); // Limit suggestions
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    };

    const handleSelectPlayer = useCallback((player: Player) => {
        setSearchQuery('');
        setSuggestions([]);
        bracketRef.current?.focusOnPlayer(player.id);
    }, []);

    if (!tournament) {
        return <div className="text-center p-8">Loading tournament...</div>;
    }
    
    if (!tournament.bracket || tournament.bracket.winners.length === 0) {
        return <NotFoundPage/>
    }

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h1 className="text-4xl font-orbitron font-black text-white">{tournament.name}</h1>
                    <p className="text-xl text-slate-300 font-semibold">Live Bracket - {tournament.tournamentType}</p>
                </div>
                <Link to={`/tournaments/${tournament.id}`}>
                    <Button variant="secondary">
                        <Icons.Trophy className="w-5 h-5" />
                        Back to Tournament Details
                    </Button>
                </Link>
            </div>

            <div className="relative pt-12">
                 <div ref={searchContainerRef} className="absolute top-[-5px] left-0 z-10 w-72">
                    <div className="relative">
                         <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg className="w-5 h-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            id="player-search"
                            type="text"
                            placeholder="Find a player..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            autoComplete="off"
                            className="w-full bg-slate-800 border border-slate-600 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    {suggestions.length > 0 && (
                        <ul className="bg-slate-800 border border-slate-700 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                            {suggestions.map(player => (
                                <li
                                    key={player.id}
                                    onClick={() => handleSelectPlayer(player)}
                                    className="p-2 hover:bg-indigo-600 cursor-pointer flex items-center gap-3 text-slate-200"
                                >
                                    <img src={player.icon} alt={player.gamertag} className="w-6 h-6 rounded-full" />
                                    <span>{player.gamertag}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <SingleEliminationBracket ref={bracketRef} tournament={tournament} onReportScore={handleScoreReport} cities={cities} isModalOpen={isReportScoreOpen} />
            </div>

            {selectedMatch && <ReportScoreModal isOpen={isReportScoreOpen} onClose={() => setReportScoreOpen(false)} tournament={tournament} match={selectedMatch} onReportSuccess={handleReportSuccess} />}
        </div>
    );
};


// Report Score Modal Component
interface ReportScoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    match: Match;
    onReportSuccess: () => void;
}

const ReportScoreModal: React.FC<ReportScoreModalProps> = ({isOpen, onClose, tournament, match, onReportSuccess}) => {
    const getPlayer = (id: string | null) => id ? tournament.players.find(p => p.id === id) : null;
    const player1 = getPlayer(match.players[0]);
    const player2 = getPlayer(match.players[1]);
    
    const [score1, setScore1] = useState(0);
    const [score2, setScore2] = useState(0);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isConfirmReverseOpen, setConfirmReverseOpen] = useState(false);

    const isDecided = !!match.winnerId;
    const winsNeeded = Math.ceil(parseInt(tournament.matchFormat.split(' ')[2]) / 2);

    useEffect(() => {
        if (isOpen) {
            setScore1(match.scores[0] || 0);
            setScore2(match.scores[1] || 0);
            setPassword('');
            setError('');
            setConfirmReverseOpen(false);
        }
    }, [isOpen, match]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isDecided) return;
        setError('');

        const isAdmin = tournamentService.verifyAdminPassword(tournament.id, password);
        const isPlayer = tournamentService.verifyPlayerPassword(tournament, match, password);

        if (!isAdmin && !isPlayer) {
            setError('Invalid password. This can be your player password or the tournament admin password.');
            return;
        }

        let winnerId: string | undefined;

        if (score1 === -1 && score2 === -1) {
            setError("Cannot disqualify both players.");
            return;
        }
        
        if (score1 === -1) {
            winnerId = player2?.id;
        } else if (score2 === -1) {
            winnerId = player1?.id;
        } else {
            if ((score1 < winsNeeded && score2 < winsNeeded) || score1 === score2) {
                 setError(`A player must win ${winsNeeded} game(s) to win the match. Scores cannot be tied.`);
                 return;
            }
            winnerId = score1 > score2 ? player1?.id : player2?.id;
        }
        
        if (!winnerId) {
            setError("Could not determine a winner.");
            return;
        }
        
        try {
            tournamentService.updateMatchWinner(tournament.id, match.id, winnerId, [score1, score2]);
            onReportSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    const performReverse = () => {
        try {
            tournamentService.reverseMatchWinner(tournament.id, match.id);
            onReportSuccess();
            onClose(); // This closes the ReportScoreModal, which unmounts everything.
        } catch (err: any) {
            // This is an exceptional case (e.g., next match already played). An alert is acceptable here.
            alert(err.message);
            setConfirmReverseOpen(false);
        }
    };

    const handleReverseClick = () => {
        if (!isDecided) return;
        setError('');
        
        const isAdmin = tournamentService.verifyAdminPassword(tournament.id, password);
        if (!isAdmin) {
            setError('Invalid admin password. Only admins can reverse match decisions.');
            return;
        }

        // Admin password is correct, now open confirmation.
        setConfirmReverseOpen(true);
    };

    if (!player1 || !player2) return null;

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={isDecided ? "Match Result" : "Report Match Score"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md">{error}</p>}
                    <div className="flex items-center justify-around text-center">
                        <div>
                            <img src={player1.icon} alt={player1.gamertag} className="w-16 h-16 rounded-full mx-auto mb-2"/>
                            <p className="font-bold text-lg">{player1.gamertag}</p>
                            <Input label="Score" id="score1" type="number" min="-1" value={score1} onChange={e => setScore1(Number(e.target.value))} className="w-20 mx-auto text-center bg-slate-200 text-black" disabled={isDecided} />
                        </div>
                        <span className="text-2xl font-orbitron">VS</span>
                        <div>
                            <img src={player2.icon} alt={player2.gamertag} className="w-16 h-16 rounded-full mx-auto mb-2"/>
                            <p className="font-bold text-lg">{player2.gamertag}</p>
                            <Input label="Score" id="score2" type="number" min="-1" value={score2} onChange={e => setScore2(Number(e.target.value))} className="w-20 mx-auto text-center bg-slate-200 text-black" disabled={isDecided} />
                        </div>
                    </div>
                    <p className="text-center text-slate-400">First to {winsNeeded} wins.</p>
                    {!isDecided && <p className="text-center text-slate-400 text-xs -mt-3">Enter -1 to disqualify a player (e.g., no-show).</p>}
                    <Input label={isDecided ? "Admin Password for Reversal" : "Your Reporting Password (or Admin)"} id="reportingPassword" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                        {isDecided ? (
                            <Button type="button" variant="danger" onClick={handleReverseClick}>Reverse Match</Button>
                        ) : (
                            <Button type="submit" variant="primary">Submit Score</Button>
                        )}
                    </div>
                </form>
            </Modal>
            <ConfirmationModal
                isOpen={isConfirmReverseOpen}
                onClose={() => setConfirmReverseOpen(false)}
                onConfirm={performReverse}
                title="Confirm Match Reversal"
                message="Are you sure you want to reverse this match result? This will reset the score to 0-0 and retract the winner from the next round."
                confirmText="Yes, Reverse"
                confirmVariant="danger"
            />
        </>
    );
};


export default BracketPage;
