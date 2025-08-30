import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tournament, TournamentType, MatchFormat, TournamentStatus, Player, SuperAdminAssets } from '../types';
import { tournamentService } from '../services/tournamentService';
import { Button, Input, Select, Textarea, Card, PasswordAuth, ConfirmationModal, ImageUploader } from '../components/ui';
import { PLATFORMS, Icons, DEFAULT_ASSETS } from '../constants';
import NotFoundPage from './NotFoundPage';

const CreateTournamentForm = ({ onCreated, assets }: { onCreated: (id: string, pass: string) => void, assets: SuperAdminAssets }) => {
    const { popularGames, backgrounds } = assets;

    const getInitialDateTime = () => {
        const oneHourLater = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        const year = oneHourLater.getFullYear();
        const month = String(oneHourLater.getMonth() + 1).padStart(2, '0');
        const day = String(oneHourLater.getDate()).padStart(2, '0');

        const hours = String(oneHourLater.getHours()).padStart(2, '0');
        const minutes = String(oneHourLater.getMinutes()).padStart(2, '0');

        return {
            date: `${year}-${month}-${day}`,
            time: `${hours}:${minutes}`,
        };
    };

    const [isLogoCustom, setIsLogoCustom] = useState(false);

    const [formData, setFormData] = useState(() => {
        const initialGameTitle = popularGames[0] || '';
        const initialLogoUrl = backgrounds[initialGameTitle] || '';
        return {
            name: '',
            gameTitle: initialGameTitle,
            platforms: [PLATFORMS[0]],
            tournamentType: TournamentType.SINGLE_ELIMINATION,
            matchFormat: MatchFormat.BEST_OF_3,
            date: getInitialDateTime().date,
            time: getInitialDateTime().time,
            description: '',
            discordLink: '',
            adminPassword: '',
            logoUrl: initialLogoUrl,
            status: TournamentStatus.REGISTRATION_OPEN,
            isCitiesTournament: false,
        };
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({...prev, [name]: checked}));
            return;
        }

        setFormData(prev => {
            const newFormData = { ...prev, [name]: value };
            if (name === 'gameTitle' && !isLogoCustom) {
                newFormData.logoUrl = backgrounds[value] || '';
            }
            return newFormData;
        });
    };


    const handlePlatformChange = (platform: string) => {
        setFormData(prev => ({
            ...prev,
            platforms: prev.platforms.includes(platform)
                ? prev.platforms.filter(p => p !== platform)
                : [...prev.platforms, platform]
        }));
    };
    
    const handleLogoUpload = (base64: string) => {
        setFormData(prev => ({ ...prev, logoUrl: base64 }));
        setIsLogoCustom(true);
    };

    const generatePassword = () => {
      const words = ['alpha', 'bravo', 'cyber', 'delta', 'echo', 'fusion', 'gamma', 'helix', 'ignite', 'joule'];
      const password = words[Math.floor(Math.random() * words.length)] + Math.floor(Math.random() * 100);
      setFormData(prev => ({ ...prev, adminPassword: password}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.gameTitle) {
            alert('Please select a game title.');
            return;
        }
        const { adminPassword, date, time, ...rest } = formData;
        const startDate = new Date(`${date}T${time}`).toISOString();
        const tournamentToCreate = { ...rest, startDate };
        const newTournament = tournamentService.createTournament({ ...tournamentToCreate, adminPassword });
        onCreated(newTournament.id, adminPassword);
    };

    return (
        <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
                <h1 className="text-3xl font-orbitron font-bold text-white">Create New Tournament</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Tournament Name" name="name" value={formData.name} onChange={handleChange} required />
                    <Select label="Game Title" name="gameTitle" value={formData.gameTitle} onChange={handleChange}>
                        {popularGames.length > 0 ? (
                            popularGames.map(g => <option key={g} value={g}>{g}</option>)
                        ) : (
                            <option value="" disabled>No games available</option>
                        )}
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Platforms</label>
                    <div className="flex flex-wrap gap-2">
                        {PLATFORMS.map(p => (
                            <button key={p} type="button" onClick={() => handlePlatformChange(p)} className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${formData.platforms.includes(p) ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select label="Tournament Type" name="tournamentType" value={formData.tournamentType} onChange={handleChange}>
                        {Object.values(TournamentType).map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                    <Select label="Match Format" name="matchFormat" value={formData.matchFormat} onChange={handleChange}>
                        {Object.values(MatchFormat).map(f => <option key={f} value={f}>{f}</option>)}
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        id="isCitiesTournament"
                        name="isCitiesTournament"
                        type="checkbox"
                        checked={formData.isCitiesTournament}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                    />
                     <label htmlFor="isCitiesTournament" className="text-sm font-medium text-slate-300">Cities Tournament</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <Input label="Start Date" name="date" type="date" value={formData.date} onChange={handleChange} required/>
                   <Input label="Start Time" name="time" type="time" value={formData.time} onChange={handleChange} required/>
                </div>
                <Textarea label="Short Description / Rules" name="description" value={formData.description} onChange={handleChange} />
                <Input label="Discord Link (Optional)" name="discordLink" value={formData.discordLink} onChange={handleChange} placeholder="https://discord.gg/yourserver" />
                <ImageUploader label="Tournament Logo (Optional)" onImageUploaded={handleLogoUpload} />
                {formData.logoUrl && (
                    <div className="mt-2">
                        <p className="text-sm font-medium text-slate-300">Logo Preview:</p>
                        <img src={formData.logoUrl} alt="logo preview" className="w-24 h-24 rounded-full mt-1 border-2 border-slate-600 object-cover"/>
                    </div>
                )}
                 <div className="relative">
                    <Input label="Admin Password" name="adminPassword" type="text" value={formData.adminPassword} onChange={handleChange} required />
                    <Button type="button" variant="secondary" onClick={generatePassword} size="sm" className="absolute right-1 bottom-1">Generate</Button>
                </div>
                <div className="flex justify-end">
                    <Button type="submit">Create Tournament</Button>
                </div>
            </form>
        </Card>
    );
};

const TournamentCreated = ({ tournamentId, adminPassword }: { tournamentId: string, adminPassword: string }) => {
    const tournamentUrl = `${window.location.href.split('#')[0]}#/tournaments/${tournamentId}`;

    return (
        <Card className="text-center">
            <h1 className="text-3xl font-orbitron font-bold text-green-400">Tournament Created!</h1>
            <p className="text-slate-300 mt-2">Your tournament is live. Here are your important details.</p>
            <div className="mt-6 bg-slate-900 p-4 rounded-lg space-y-4">
                <div className="text-left">
                    <label className="text-sm font-bold text-slate-400">Tournament URL</label>
                    <div className="flex gap-2 mt-1">
                        <input type="text" readOnly value={tournamentUrl} className="w-full bg-slate-800 p-2 rounded text-slate-200" />
                        <Button onClick={() => navigator.clipboard.writeText(tournamentUrl)}>Copy</Button>
                    </div>
                </div>
                 <div className="text-left">
                    <label className="text-sm font-bold text-red-400 uppercase">SAVE THIS PASSWORD!</label>
                     <p className="text-xs text-slate-400 mb-1">This is your admin password. It cannot be recovered.</p>
                    <div className="flex gap-2 mt-1">
                        <input type="text" readOnly value={adminPassword} className="w-full bg-slate-800 p-2 rounded font-mono text-lg text-yellow-300" />
                        <Button onClick={() => navigator.clipboard.writeText(adminPassword)}>Copy</Button>
                    </div>
                </div>
            </div>
            <div className="mt-8">
                <Link to={`/admin/dashboard/${tournamentId}`}>
                    <Button variant="primary">Go to Admin Dashboard</Button>
                </Link>
            </div>
        </Card>
    );
};

const AdminDashboard = ({ tournament, onUpdate }: { tournament: Tournament, onUpdate: (t: Tournament) => void }) => {
    const [activeTab, setActiveTab] = useState('participants');
    const [players, setPlayers] = useState(tournament.players);
    const [announcements, setAnnouncements] = useState(tournament.announcements);
    const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
    const [statusChangeInfo, setStatusChangeInfo] = useState<{ status: TournamentStatus; message: string; } | null>(null);

    useEffect(() => {
        setPlayers(tournament.players);
        setAnnouncements(tournament.announcements);
    }, [tournament]);

    const handleSeedChange = (playerId: string, seed: number) => {
        setPlayers(currentPlayers => currentPlayers.map(p => p.id === playerId ? {...p, seed: isNaN(seed) ? 0 : seed} : p));
    };

    const saveSeeds = () => {
        let updatedTournament = tournament;
        players.forEach(p => {
            updatedTournament = tournamentService.updatePlayer(tournament.id, p.id, { seed: p.seed });
        });
        onUpdate(updatedTournament);
        alert('Seeding saved!');
    };

    const randomizeSeeds = () => {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        setPlayers(shuffled.map((p, i) => ({...p, seed: i + 1})));
    };
    
    const saveAnnouncements = () => {
        const updatedTournament = tournamentService.updateTournament(tournament.id, { announcements });
        if(updatedTournament) onUpdate(updatedTournament);
        alert('Announcements saved!');
    }

    const initiateStatusChange = (newStatus: TournamentStatus) => {
        let message: string;
        if (newStatus === TournamentStatus.IN_PROGRESS) {
             message = 'This will close registration and generate the bracket. Are you sure you want to start the tournament?';
        } else if (newStatus === TournamentStatus.REGISTRATION_OPEN && tournament.status === TournamentStatus.IN_PROGRESS) {
            message = 'This will revert the tournament to "Open for Registration". All reported matches and bracket progress will be PERMANENTLY DELETED. Are you absolutely sure?';
        } else {
            message = `Are you sure you want to change the status to ${newStatus}?`;
        }
        setStatusChangeInfo({ status: newStatus, message });
        setConfirmModalOpen(true);
    };
    
    const confirmStatusChange = () => {
        if (!statusChangeInfo) return;
        
        const updated = tournamentService.updateTournament(tournament.id, { status: statusChangeInfo.status });
        if (updated) {
            onUpdate(updated);
            alert(`Tournament status updated to ${statusChangeInfo.status}.`);
        }
        setConfirmModalOpen(false);
        setStatusChangeInfo(null);
    };

    return (
        <div>
            <h1 className="text-3xl font-orbitron font-bold mb-2">{tournament.name} - Admin Panel</h1>
            <p className="text-slate-400 mb-6">Manage your tournament settings and participants.</p>
            <div className="flex border-b border-slate-700 mb-6">
                <button onClick={() => setActiveTab('participants')} className={`px-4 py-2 font-semibold ${activeTab === 'participants' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400'}`}>Participants</button>
                <button onClick={() => setActiveTab('seeding')} className={`px-4 py-2 font-semibold ${activeTab === 'seeding' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400'}`}>Seeding</button>
                <button onClick={() => setActiveTab('status')} className={`px-4 py-2 font-semibold ${activeTab === 'status' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400'}`}>Status & Bracket</button>
                <button onClick={() => setActiveTab('comms')} className={`px-4 py-2 font-semibold ${activeTab === 'comms' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400'}`}>Communication</button>
            </div>
            
            <div>
                {activeTab === 'participants' && (
                    <Card>
                        <h2 className="text-xl font-bold mb-4">Participant Management</h2>
                        <div className="space-y-2">
                           {players.length > 0 ? players.map(player => (
                               <div key={player.id} className="flex items-center justify-between bg-slate-700/50 p-2 rounded">
                                   <div className="flex items-center gap-3">
                                       <img src={player.icon} alt={player.gamertag} className="w-8 h-8 rounded-full" />
                                       <span className="font-semibold">{player.gamertag}</span>
                                   </div>
                                   <Button variant="danger" size="sm" onClick={() => {
                                       if(window.confirm(`Remove ${player.gamertag}?`)) {
                                           const updated = tournamentService.removePlayer(tournament.id, player.id);
                                           onUpdate(updated);
                                       }
                                   }}>Remove</Button>
                               </div>
                           )) : <p className="text-slate-400">No players have signed up yet.</p>}
                        </div>
                    </Card>
                )}
                {activeTab === 'seeding' && (
                    <Card>
                         <h2 className="text-xl font-bold mb-4">Seeding</h2>
                         <div className="flex gap-4 mb-4">
                             <Button onClick={randomizeSeeds}><Icons.Shuffle className="w-4 h-4"/>Randomize Seeds</Button>
                             <Button onClick={saveSeeds} variant="primary">Save Seeding</Button>
                         </div>
                         <div className="space-y-3">
                            {players.sort((a, b) => a.seed - b.seed).map(player => (
                                <div key={player.id} className="flex items-center gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700 hover:border-indigo-500/50 transition-colors">
                                    <div className="flex-none w-20 text-center">
                                         <label htmlFor={`seed-${player.id}`} className="text-xs font-bold uppercase text-slate-400">Seed</label>
                                        <Input
                                            id={`seed-${player.id}`}
                                            type="number"
                                            value={player.seed}
                                            onChange={e => handleSeedChange(player.id, parseInt(e.target.value))}
                                            className="w-full bg-slate-900/50 border border-slate-600 rounded-md text-indigo-300 font-orbitron text-2xl text-center p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            aria-label={`Seed for ${player.gamertag}`}
                                            min="1"
                                        />
                                    </div>
                                    <div className="flex-grow flex items-center gap-4">
                                        <img src={player.icon} alt={player.gamertag} className="w-12 h-12 rounded-full object-cover border-2 border-slate-600"/>
                                        <div>
                                            <span className="font-semibold text-lg text-slate-100">{player.gamertag}</span>
                                             {player.discordOrIGN && <p className="text-sm text-slate-400">{player.discordOrIGN}</p>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </Card>
                )}
                {activeTab === 'status' && (
                    <Card>
                        <h2 className="text-xl font-bold mb-4">Status & Bracket Control</h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-slate-400">Current Status:</p>
                                <p className="text-2xl font-bold text-indigo-400">{tournament.status}</p>
                            </div>
                            
                            {tournament.status === TournamentStatus.REGISTRATION_OPEN && (
                                <div>
                                    <p className="text-slate-300 mb-4">Registration is currently open. Once closed, the bracket will be generated. Current players: {tournament.players.length}.</p>
                                    <Button 
                                        variant="primary" 
                                        onClick={() => initiateStatusChange(TournamentStatus.IN_PROGRESS)}
                                        disabled={tournament.players.length < 2}
                                    >
                                        Close Registration & Start Tournament
                                    </Button>
                                    {tournament.players.length < 2 && <p className="text-xs text-yellow-400 mt-1">You need at least 2 players to start the tournament.</p>}
                                </div>
                            )}

                            {tournament.status === TournamentStatus.IN_PROGRESS && (
                                <div>
                                    <p className="text-slate-300 mb-4">The tournament is live and registration is closed.</p>
                                    <div className="flex flex-wrap gap-4">
                                        <Link to={`/tournaments/${tournament.id}/bracket`}>
                                            <Button variant="secondary">View Live Bracket</Button>
                                        </Link>
                                        <Button 
                                            variant="primary" 
                                            onClick={() => initiateStatusChange(TournamentStatus.COMPLETED)}
                                        >
                                            Mark Tournament as Completed
                                        </Button>
                                        <Button 
                                            variant="danger" 
                                            onClick={() => initiateStatusChange(TournamentStatus.REGISTRATION_OPEN)}
                                        >
                                            Revert to Registration
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {tournament.status === TournamentStatus.COMPLETED && (
                                <div>
                                    <p className="text-slate-300 mb-4">The tournament has finished.</p>
                                     <Button 
                                        variant="secondary" 
                                        onClick={() => initiateStatusChange(TournamentStatus.ARCHIVED)}
                                    >
                                        Archive Tournament
                                    </Button>
                                </div>
                            )}

                            {tournament.status === TournamentStatus.ARCHIVED && (
                                <div>
                                    <p className="text-slate-300">This tournament is archived.</p>
                                </div>
                            )}
                             {tournament.status === TournamentStatus.DRAFT && (
                                <div>
                                    <p className="text-slate-300 mb-4">This tournament is a draft.</p>
                                    <Button 
                                        variant="primary" 
                                        onClick={() => initiateStatusChange(TournamentStatus.REGISTRATION_OPEN)}
                                    >
                                        Open for Registration
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>
                )}
                 {activeTab === 'comms' && (
                    <Card>
                        <h2 className="text-xl font-bold mb-4">Announcements</h2>
                        <Textarea label="Post an announcement to the tournament page" value={announcements} onChange={e => setAnnouncements(e.target.value)} rows={6}/>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={saveAnnouncements} variant="primary">Post Announcement</Button>
                        </div>
                    </Card>
                )}
            </div>

            {statusChangeInfo && (
                <ConfirmationModal
                    isOpen={isConfirmModalOpen}
                    onClose={() => setConfirmModalOpen(false)}
                    onConfirm={confirmStatusChange}
                    title="Confirm Action"
                    message={statusChangeInfo.message}
                    confirmText="Yes, Proceed"
                    confirmVariant={statusChangeInfo.status === TournamentStatus.REGISTRATION_OPEN ? "danger" : "primary"}
                />
            )}
        </div>
    );
};


const TournamentAdminPage: React.FC = () => {
    const { action, tournamentId } = useParams<{ action: string, tournamentId?: string }>();
    const navigate = useNavigate();

    const [createdInfo, setCreatedInfo] = useState<{ id: string, pass: string } | null>(null);
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [assets, setAssets] = useState<SuperAdminAssets>(DEFAULT_ASSETS);
    const [authError, setAuthError] = useState<string | undefined>();

    useEffect(() => {
        setAssets(tournamentService.getAssets());
    }, []);

    const loadTournament = useCallback(() => {
        if (tournamentId) {
            const t = tournamentService.getTournamentById(tournamentId);
            if (t) {
                setTournament(t);
            } else {
                navigate('/notfound');
            }
        }
    }, [tournamentId, navigate]);
    
    useEffect(() => {
        if (action === 'dashboard' && tournamentId) {
            loadTournament();
        }
    }, [action, tournamentId, loadTournament]);

    const handleCreate = (id: string, pass: string) => {
        setCreatedInfo({ id, pass });
        navigate(`/admin/created/${id}`, { replace: true });
    };

    const handleAuthSuccess = (password: string) => {
        if (!password) {
            setAuthError('Password cannot be empty.');
            return;
        }

        if (tournamentId && tournamentService.verifyAdminPassword(tournamentId, password)) {
            setIsAuthenticated(true);
            setAuthError(undefined);
        } else {
            setAuthError('Incorrect password. Please try again. Passwords are not case-sensitive.');
        }
    };
    
    if (action === 'create') {
        return <CreateTournamentForm onCreated={handleCreate} assets={assets} />;
    }

    if (action === 'created' && tournamentId) {
         if(createdInfo && createdInfo.id === tournamentId) {
             return <TournamentCreated tournamentId={createdInfo.id} adminPassword={createdInfo.pass} />;
         }
         // if page is reloaded, show a message to go to dashboard
         return <Card className="text-center"><p>Tournament created. Please use your saved password to access the <Link to={`/admin/dashboard/${tournamentId}`} className="text-indigo-400 underline">admin dashboard</Link>.</p></Card>;
    }
    
    if (action === 'dashboard' && tournament) {
        if (!isAuthenticated) {
            return <PasswordAuth 
                onSuccess={handleAuthSuccess} 
                onCancel={() => navigate(`/tournaments/${tournamentId}`)}
                title="Admin Access"
                description={`Enter the admin password for "${tournament.name}".`}
                error={authError}
            />;
        }
        return <AdminDashboard tournament={tournament} onUpdate={setTournament} />;
    }

    return <NotFoundPage />;
};

export default TournamentAdminPage;