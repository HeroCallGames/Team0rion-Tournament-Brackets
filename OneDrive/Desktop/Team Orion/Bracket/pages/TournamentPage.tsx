import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tournament, City, Player, TournamentStatus, IconAsset } from '../types';
import { tournamentService } from '../services/tournamentService';
import { Button, Modal, Card, Input, Select } from '../components/ui';
import { Icons } from '../constants';
import CountdownTimer from '../components/CountdownTimer';

// Reusable Tooltip Component
const Tooltip: React.FC<{ content: string | undefined | null, children: React.ReactNode }> = ({ content, children }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const timerRef = useRef<number | null>(null);

    const handleMouseEnter = () => {
        if (!content || content.trim() === '') return;
        timerRef.current = window.setTimeout(() => {
            setShowTooltip(true);
        }, 500); // 500ms delay
    };

    const handleMouseLeave = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setShowTooltip(false);
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    return (
        <div
            className="relative flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {showTooltip && content && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-slate-900 border border-slate-600 text-white text-sm rounded-md shadow-lg z-10">
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-600"></div>
                </div>
            )}
        </div>
    );
};


// PlayerWithTooltip Component
const PlayerWithTooltip = ({ player, tournament, cities }: { player: Player; tournament: Tournament; cities: City[] }) => {
    let cityName: string | null = null;
    if (tournament.isCitiesTournament && player.icon.startsWith('asset:city:')) {
        const cityId = player.icon.split(':')[2];
        const city = cities.find(c => c.id === cityId);
        if (city) {
            cityName = city.name;
        }
    }

    return (
        <li
            key={player.id}
            className="flex items-center gap-3 bg-slate-700/50 p-2 rounded"
        >
            <Tooltip content={cityName}>
                <img src={player.icon} alt={player.gamertag} className="w-8 h-8 rounded-full" />
            </Tooltip>
            <Tooltip content={player.discordOrIGN}>
                 <span className="font-semibold text-slate-200">{player.gamertag}</span>
            </Tooltip>
        </li>
    );
};


const TournamentPage: React.FC = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [assets, setAssets] = useState<{ icons: IconAsset[], cities: City[] }>({ icons: [], cities: [] });
    const [isSignupOpen, setSignupOpen] = useState(false);

    const loadTournament = useCallback(() => {
        if (tournamentId) {
            const t = tournamentService.getTournamentById(tournamentId);
            if (t) {
                setTournament(t);
                // Preload bracket images if a bracket exists to make bracket page load faster
                if (t.bracket && t.bracket.winners.length > 0) {
                    tournamentService.preloadTournamentImages(t);
                }
            } else {
                navigate('/notfound');
            }
        }
    }, [tournamentId, navigate]);
    
    useEffect(() => {
        loadTournament();
        const superAdminAssets = tournamentService.getAssets();
        setAssets({ icons: superAdminAssets.icons, cities: superAdminAssets.cities || [] });
    }, [loadTournament]);

    const handleOpenSignup = () => {
        // Re-fetch assets from localStorage to ensure they are up-to-date before opening the modal
        const superAdminAssets = tournamentService.getAssets();
        setAssets({ icons: superAdminAssets.icons, cities: superAdminAssets.cities || [] });
        setSignupOpen(true);
    };
    
    if (!tournament) {
        return <div className="text-center p-8">Loading tournament...</div>;
    }

    const { name, description, gameTitle, startDate, status, discordLink, players, announcements } = tournament;

    return (
        <div>
            <Card className="mb-8 relative" style={{ backgroundImage: `url(${tournament.bannerUrl || `https://picsum.photos/seed/${tournament.id}/1200/300`})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="absolute inset-0 bg-black/70 rounded-lg"></div>
                <div className="relative z-10 p-4">
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        <img src={tournament.logoUrl || `https://picsum.photos/seed/${tournament.id}/150`} alt="Tournament Logo" className="w-32 h-32 rounded-full border-4 border-slate-600 object-cover" />
                        <div>
                            <span className="bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full">{status}</span>
                            <h1 className="text-4xl lg:text-5xl font-orbitron font-black text-white mt-2">{name}</h1>
                            <p className="text-xl text-slate-300 font-semibold">{gameTitle}</p>
                            <p className="text-slate-400 mt-1">Starts: {new Date(startDate).toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-4">
                        {status === 'Open for Registration' && (
                            <Button variant="primary" onClick={handleOpenSignup}>
                                <Icons.UserPlus className="w-5 h-5"/>
                                Sign Up Now
                            </Button>
                        )}
                        {discordLink && <a href={discordLink} target="_blank" rel="noopener noreferrer"><Button variant="secondary">Join Discord</Button></a>}
                        <Button variant="secondary" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => alert('Link copied!'))}>
                            <Icons.Share2 className="w-5 h-5" />
                            Share
                        </Button>
                        <Link to={`/admin/dashboard/${tournament.id}`}>
                            <Button variant="secondary">
                                <Icons.Settings className="w-5 h-5" />
                                Admin Panel
                            </Button>
                        </Link>
                    </div>
                </div>
            </Card>

            {tournament.status === TournamentStatus.REGISTRATION_OPEN && new Date(tournament.startDate) > new Date() && (
                <CountdownTimer targetDate={tournament.startDate} />
            )}

            {announcements && (
                <Card className="mb-8 border-l-4 border-yellow-400">
                    <h3 className="font-orbitron text-lg font-bold text-yellow-300">Announcements</h3>
                    <p className="text-slate-200 whitespace-pre-wrap">{announcements}</p>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <Card>
                        <h3 className="font-orbitron text-xl font-bold mb-4">Details</h3>
                        <div className="space-y-3 text-sm">
                            <p><strong>Type:</strong> {tournament.tournamentType}</p>
                            <p><strong>Format:</strong> {tournament.matchFormat}</p>
                            <p><strong>Platforms:</strong> {tournament.platforms.join(', ')}</p>
                            <p><strong>Description:</strong> {description}</p>
                            {tournament.prizePool && <p><strong>Prize Pool:</strong> {tournament.prizePool}</p>}
                        </div>
                    </Card>
                    <Card className="flex-grow">
                        <h3 className="font-orbitron text-xl font-bold mb-4">Participants ({players.length})</h3>
                        <ul className="space-y-2 max-h-96 overflow-y-auto">
                            {players.map(p => <PlayerWithTooltip key={p.id} player={p} tournament={tournament} cities={assets.cities} />)}
                        </ul>
                    </Card>
                </div>
                <div className="lg:col-span-3">
                    {tournament.bracket && tournament.bracket.winners.length > 0 ? (
                        <Link to={`/tournaments/${tournament.id}/bracket`} className="h-full">
                            <Card className="flex flex-col items-center justify-center text-center h-full bg-slate-800/80 hover:border-indigo-500 transition-all duration-300 cursor-pointer">
                                <Icons.Swords className="w-24 h-24 text-slate-500 mb-4" />
                                <h3 className="font-orbitron text-2xl font-bold text-white">Bracket is Live!</h3>
                                <p className="text-slate-400 mb-6">The battle has begun. Follow the action live.</p>
                                <Button variant="primary" size="lg">
                                    View Full Bracket
                                </Button>
                            </Card>
                         </Link>
                    ) : (
                        <Card className="flex flex-col items-center justify-center text-center h-full">
                            <Icons.Trophy className="w-24 h-24 text-slate-600 mb-4"/>
                            <h3 className="text-xl font-semibold text-slate-300">Bracket has not been generated yet.</h3>
                            <p className="text-slate-400 mt-2">The tournament organizer needs to generate the bracket from the admin panel.</p>
                        </Card>
                    )}
                </div>
            </div>

            <SignupModal isOpen={isSignupOpen} onClose={() => setSignupOpen(false)} tournamentId={tournamentId!} tournament={tournament} availableIcons={assets.icons} availableCities={assets.cities} onSignupSuccess={loadTournament} />
        </div>
    );
};

// Signup Modal Component
interface SignupModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
    tournament: Tournament;
    availableIcons: IconAsset[];
    availableCities: City[];
    onSignupSuccess: () => void;
}
const SignupModal: React.FC<SignupModalProps> = ({ isOpen, onClose, tournamentId, tournament, availableIcons, availableCities, onSignupSuccess }) => {
    const [gamertag, setGamertag] = useState('');
    const [discordOrIGN, setDiscordOrIGN] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('');
    const [selectedCityId, setSelectedCityId] = useState('');
    const [error, setError] = useState('');

    // Reset form state when modal opens to ensure fresh data and selections are used
    useEffect(() => {
        if (isOpen) {
            setGamertag('');
            setDiscordOrIGN('');
            setPassword('');
            setConfirmPassword('');
            setError('');
            setSelectedIcon(availableIcons.length > 0 ? `asset:icon:0` : '');
            setSelectedCityId(availableCities[0]?.id || '');
        }
    }, [isOpen, availableIcons, availableCities]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (!gamertag || !password) {
            setError('Please fill all required fields.');
            return;
        }
        if (gamertag.length > 15) {
            setError('Gamertag cannot exceed 15 characters.');
            return;
        }

        let playerIcon = '';
        const playerDiscordOrIGN = discordOrIGN;

        if (tournament.isCitiesTournament) {
            if (!selectedCityId) {
                setError('Please select a city.');
                return;
            }
            const selectedCity = availableCities.find(c => c.id === selectedCityId);
            if (!selectedCity) {
                 setError('Please select a valid city.');
                return;
            }
            playerIcon = `asset:city:${selectedCityId}`;
        } else {
             if (!selectedIcon || !selectedIcon.startsWith('asset:icon:')) {
                setError('Please select an icon.');
                return;
            }
            playerIcon = selectedIcon;
        }

        try {
            tournamentService.addPlayer(tournamentId, {
                gamertag,
                discordOrIGN: playerDiscordOrIGN,
                icon: playerIcon,
                selfReportingPassword: password
            });
            onSignupSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Sign Up for Tournament">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md">{error}</p>}
                <Input label="Gamertag *" id="gamertag" value={gamertag} onChange={e => setGamertag(e.target.value)} required maxLength={15} />
                
                {tournament.isCitiesTournament ? (
                     <>
                        <Select label="City *" id="playerCity" value={selectedCityId} onChange={e => setSelectedCityId(e.target.value)} required>
                            <option value="" disabled>Select a city</option>
                            {availableCities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
                        </Select>
                        <Input label="Discord tag or In Game Name (Optional)" id="discordOrIGN" value={discordOrIGN} onChange={e => setDiscordOrIGN(e.target.value)} />
                    </>
                ) : (
                    <>
                        <Input label="Discord tag or In Game Name (Optional)" id="discordOrIGN" value={discordOrIGN} onChange={e => setDiscordOrIGN(e.target.value)} />
                        <Select label="Player Icon *" id="playerIcon" value={selectedIcon} onChange={e => setSelectedIcon(e.target.value)} required>
                            {availableIcons.map((icon, index) => <option key={icon.url.substring(20,50) + index} value={`asset:icon:${index}`}>{icon.name}</option>)}
                        </Select>
                    </>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Input label="Self-Reporting Password *" id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <Input label="Confirm Password *" id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                </div>
                <div className="flex justify-end gap-3">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="primary">Sign Up</Button>
                </div>
            </form>
        </Modal>
    );
};

export default TournamentPage;