import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminAssets } from '../types';
import { tournamentService } from '../services/tournamentService';
import { SUPER_ADMIN_PASSWORD, Icons, DEFAULT_ASSETS } from '../constants';
import { PasswordAuth, Card, Input, Button, ImageUploader, ConfirmationModal } from '../components/ui';

const SuperAdminPage: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [assets, setAssets] = useState<SuperAdminAssets>(DEFAULT_ASSETS);

    // State for the new city form
    const [newCityName, setNewCityName] = useState('');
    const [newCityIcon, setNewCityIcon] = useState<string | null>(null);

    // New state for adding games
    const [newGameName, setNewGameName] = useState('');
    const [gameToDelete, setGameToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (isAuthenticated) {
            setAssets(tournamentService.getAssets());
        }
    }, [isAuthenticated]);

    const handleAuthSuccess = (password: string) => {
        if (password === SUPER_ADMIN_PASSWORD) {
            setIsAuthenticated(true);
        } else {
            alert('Incorrect super admin password.');
        }
    };

    const handleSave = () => {
        tournamentService.saveAssets(assets);
        alert('Assets saved!');
    };
    
    const handleBackgroundUpload = (gameTitle: string, base64: string) => {
        setAssets(prev => ({
            ...prev,
            backgrounds: {
                ...prev.backgrounds,
                [gameTitle]: base64,
            }
        }));
    };

    const removeBackground = (gameTitle: string) => {
        setAssets(prev => {
            const newBackgrounds = { ...prev.backgrounds };
            delete newBackgrounds[gameTitle];
            return { ...prev, backgrounds: newBackgrounds };
        });
    };

    const addIcon = useCallback((base64: string) => {
        setAssets(prev => ({ ...prev, icons: [...prev.icons, { name: 'New Icon', url: base64 }] }));
    }, []);

    const removeIcon = (url: string) => {
        setAssets(prev => ({ ...prev, icons: prev.icons.filter(i => i.url !== url) }));
    };

    const handleIconNameChange = (index: number, newName: string) => {
        setAssets(prev => {
            const newIcons = [...prev.icons];
            newIcons[index] = { ...newIcons[index], name: newName };
            return { ...prev, icons: newIcons };
        });
    };


    const addCity = () => {
        if (newCityName && newCityIcon) {
            setAssets(prev => ({ ...prev, cities: [...prev.cities, { id: Date.now().toString(), name: newCityName, icon: newCityIcon }] }));
            setNewCityName('');
            setNewCityIcon(null);
        }
    };

    const removeCity = (id: string) => {
        setAssets(prev => ({ ...prev, cities: prev.cities.filter(c => c.id !== id) }));
    };

    const handleAddGame = () => {
        if (newGameName && !assets.popularGames.includes(newGameName)) {
            setAssets(prev => ({
                ...prev,
                popularGames: [...prev.popularGames, newGameName].sort((a,b) => a.localeCompare(b))
            }));
            setNewGameName('');
        } else {
            alert('Game name cannot be empty or already exist.');
        }
    };

    const handleConfirmDeleteGame = () => {
        if (!gameToDelete) return;
        setAssets(prev => {
            const newBackgrounds = { ...prev.backgrounds };
            delete newBackgrounds[gameToDelete];
            const newPopularGames = prev.popularGames.filter(g => g !== gameToDelete);
            return {
                ...prev,
                backgrounds: newBackgrounds,
                popularGames: newPopularGames
            };
        });
        setGameToDelete(null);
    };


    if (!isAuthenticated) {
        return <PasswordAuth onSuccess={handleAuthSuccess} onCancel={() => window.history.back()} title="Super Admin Login" description="Enter the system-wide admin password." />;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-orbitron font-bold">Super Admin Dashboard</h1>

            <Card>
                <h2 className="text-2xl font-bold mb-4">Manage Cities & Logos</h2>
                 <div className="bg-slate-900/50 p-4 rounded-lg space-y-4">
                    <Input label="New City Name" id="newCityName" value={newCityName} onChange={e => setNewCityName(e.target.value)} placeholder="e.g. Metro City" />
                    <ImageUploader label="City Icon" onImageUploaded={setNewCityIcon} />
                    {newCityIcon && (
                        <div>
                            <p className="text-sm font-medium text-slate-300">Icon Preview:</p>
                            <img src={newCityIcon} alt="preview" className="w-16 h-16 rounded-full mt-2 border-2 border-slate-600"/>
                        </div>
                    )}
                    <Button onClick={addCity} disabled={!newCityName || !newCityIcon}>Add City</Button>
                </div>
                 <div className="space-y-2 mt-6">
                    {assets.cities.map(city => (
                        <div key={city.id} className="flex items-center justify-between bg-slate-700/50 p-2 rounded">
                           <div className="flex items-center gap-3">
                                <img src={city.icon} alt={city.name} className="w-8 h-8 rounded-full"/>
                                <span className="font-semibold">{city.name}</span>
                           </div>
                           <Button variant="danger" size="sm" onClick={() => removeCity(city.id)}><Icons.Trash className="w-4 h-4" /></Button>
                        </div>
                    ))}
                </div>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold mb-4">Manage Game Backgrounds & Popular Games</h2>
                <div className="bg-slate-900/50 p-4 rounded-lg mb-6">
                    <h3 className="text-lg font-orbitron font-bold">Add New Game</h3>
                    <div className="flex flex-col sm:flex-row gap-4 mt-2">
                        <Input 
                            label="Game Title" 
                            id="new-game-title"
                            value={newGameName}
                            onChange={(e) => setNewGameName(e.target.value)}
                            placeholder="e.g. Rocket League"
                            className="flex-grow"
                        />
                        <Button onClick={handleAddGame} className="self-end sm:self-center h-10 mt-auto">Add Game</Button>
                    </div>
                </div>

                <div className="space-y-4">
                    {assets.popularGames.map(game => (
                        <div key={game} className="bg-slate-900/50 p-4 rounded-lg flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-orbitron font-bold">{game}</h3>
                                <Button variant="danger" size="sm" onClick={() => setGameToDelete(game)}>
                                    <Icons.Trash className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                                {assets.backgrounds[game] ? (
                                    <div className="relative group">
                                        <img src={assets.backgrounds[game]} alt={`${game} background`} className="w-48 h-24 object-cover rounded" />
                                        <Button variant="danger" size="sm" onClick={() => removeBackground(game)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">Remove</Button>
                                    </div>
                                ) : (
                                    <div className="w-48 h-24 bg-slate-800 rounded flex items-center justify-center">
                                        <p className="text-slate-500 text-sm">No background set</p>
                                    </div>
                                )}
                                <ImageUploader 
                                    label={assets.backgrounds[game] ? 'Change Background' : 'Upload Background'} 
                                    onImageUploaded={(base64) => handleBackgroundUpload(game, base64)}
                                    className="flex-grow min-w-[200px]"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold mb-4">Manage Player/Team Icons</h2>
                 <div className="bg-slate-900/50 p-4 rounded-lg">
                    <ImageUploader label="Upload New Icon" onImageUploaded={addIcon} />
                </div>
                <div className="space-y-2 mt-6">
                    {assets.icons.map((icon, index) => (
                        <div key={icon.url.substring(20, 50) + index} className="flex items-center justify-between bg-slate-700/50 p-2 rounded gap-4">
                            <div className="flex items-center gap-3 flex-grow">
                                <img src={icon.url} alt={icon.name} className="w-10 h-10 object-cover rounded"/>
                                <Input 
                                    aria-label={`Icon name for ${icon.name}`}
                                    id={`icon-name-${index}`}
                                    value={icon.name}
                                    onChange={(e) => handleIconNameChange(index, e.target.value)}
                                />
                            </div>
                            <Button variant="danger" size="sm" onClick={() => removeIcon(icon.url)}>
                                <Icons.Trash className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </Card>
            
            <div className="flex justify-end">
                <Button variant="primary" size="lg" onClick={handleSave}>Save All Changes</Button>
            </div>
            
            <ConfirmationModal
                isOpen={!!gameToDelete}
                onClose={() => setGameToDelete(null)}
                onConfirm={handleConfirmDeleteGame}
                title="Confirm Game Deletion"
                message={
                    <>
                        <p>Are you sure you want to permanently delete the game "{gameToDelete}"?</p>
                        <p className="mt-2 text-yellow-300">This will remove its assigned background image and it will no longer be selectable when creating new tournaments. This action cannot be undone.</p>
                    </>
                }
                confirmText="Yes, Delete It"
                confirmVariant="danger"
            />
        </div>
    );
};

export default SuperAdminPage;