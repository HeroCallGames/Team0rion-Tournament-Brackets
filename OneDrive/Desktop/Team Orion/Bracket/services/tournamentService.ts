import { Tournament, Player, Match, Bracket, TournamentType, SuperAdminAssets, TournamentStatus, MatchFormat, City } from '../types';
import { DEFAULT_ASSETS, SUPER_ADMIN_PASSWORD } from '../constants';

const FALLBACK_ICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="%234A5568"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40" fill="%23E2E8F0">?</text></svg>';

// --- Helper Functions ---
const simpleHash = (s: string) => btoa(s.toLowerCase());
const compareHash = (plain: string, hashed: string) => simpleHash(plain) === hashed;
const generateId = () => Math.random().toString(36).substring(2, 10);

// --- LocalStorage Interaction ---
const getFromStorage = <T,>(key: string, defaultValue: T): T => {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error reading from localStorage key “${key}”:`, error);
        return defaultValue;
    }
};

const setToStorage = <T,>(key: string, value: T): void => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
             console.error(`Error setting localStorage key “${key}”: Quota exceeded. The data is too large to be stored.`);
        } else {
             console.error(`Error setting localStorage key “${key}”:`, error);
        }
    }
};

// --- Asset Reference Resolver ---
export const resolveAssetRef = (ref: string): string => {
    if (!ref || !ref.startsWith('asset:')) {
        return ref;
    }
    const assets = getFromStorage<SuperAdminAssets>('superAdminAssets', DEFAULT_ASSETS);
    const parts = ref.split(':');
    if (parts.length < 3) return FALLBACK_ICON;

    const type = parts[1];
    const identifier = parts[2];

    try {
        if (type === 'icon') {
            const index = parseInt(identifier, 10);
            return assets.icons?.[index]?.url || FALLBACK_ICON;
        }
        if (type === 'city') {
            const city = (assets.cities || []).find(c => c.id === identifier);
            return city?.icon || FALLBACK_ICON;
        }
    } catch (e) {
        console.error(`Failed to resolve asset reference "${ref}"`, e);
        return FALLBACK_ICON;
    }

    return FALLBACK_ICON;
};

const resolveAssetsInTournament = (tournament: Tournament): Tournament => {
    if (!tournament) return tournament;
    const resolvedTournament = JSON.parse(JSON.stringify(tournament));
    const assets = getFromStorage<SuperAdminAssets>('superAdminAssets', DEFAULT_ASSETS);

    // Resolve Game Banner
    const gameBackground = assets.backgrounds[resolvedTournament.gameTitle];
    if (gameBackground) {
        resolvedTournament.bannerUrl = gameBackground;
    } else if (resolvedTournament.bannerUrl) {
        // Fallback for other asset types if ever used for banners
        resolvedTournament.bannerUrl = resolveAssetRef(resolvedTournament.bannerUrl);
    }
    
    // `backgroundUrl` is deprecated, so it's not resolved anymore.

    if (resolvedTournament.players) {
        resolvedTournament.players = resolvedTournament.players.map((player: Player) => {
            if (player.icon) {
                player.icon = resolveAssetRef(player.icon);
            }
            return player;
        });
    }

    if (resolvedTournament.logoUrl) resolvedTournament.logoUrl = resolveAssetRef(resolvedTournament.logoUrl);

    return resolvedTournament;
};


// --- Bracket Generation Logic ---
const generateBracket = (players: Player[]): Bracket => {
    const numPlayers = players.length;
    if (numPlayers < 2) return { winners: [] };

    // 1. Determine bracket size and order players by seed
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
    const sortedPlayers = [...players].sort((a, b) => a.seed - b.seed);

    // 2. Pad the player list with nulls (byes) to fill the bracket
    const playerIds: (string | null)[] = sortedPlayers.map(p => p.id);
    while (playerIds.length < bracketSize) {
        playerIds.push(null);
    }

    // --- WINNERS BRACKET ---
    const winnersBracket: Match[][] = [];
    const firstRound: Match[] = [];

    // Helper to generate the standard seeding order for a bracket of a given size.
    // e.g., for 8, it returns [1, 8, 4, 5, 2, 7, 3, 6]
    const getStandardSeedingOrder = (size: number): number[] => {
        if (size < 2) return size === 1 ? [1] : [];
        const rounds: number[][] = [[1, 2]];
        while (rounds[rounds.length - 1].length < size) {
            const lastRound = rounds[rounds.length - 1];
            const nextRound: number[] = [];
            const sum = lastRound.length * 2 + 1;
            for (const seed of lastRound) {
                nextRound.push(seed, sum - seed);
            }
            rounds.push(nextRound);
        }
        return rounds[rounds.length - 1];
    };

    const seedOrder = getStandardSeedingOrder(bracketSize);
    // playerIds is sorted by seed (1-based), so playerIds[i] is player with seed i+1.
    // To get player with seed S, we use playerIds[S-1].
    const finalPlayerOrder = seedOrder.map(seed => playerIds[seed - 1]);

    for (let i = 0; i < bracketSize / 2; i++) {
        const p1 = finalPlayerOrder[i * 2];
        const p2 = finalPlayerOrder[i * 2 + 1];

        const isBye = (p1 !== null && p2 === null) || (p1 === null && p2 !== null);

        const match: Match = {
            id: `1W${i + 1}`,
            roundIndex: 0,
            matchIndex: i,
            players: [p1, p2],
            scores: [0, 0],
            isBye: isBye,
        };
        
        if (isBye) {
            // The player who is not null is the winner
            match.winnerId = p1 !== null ? p1 : p2;
        }
        firstRound.push(match);
    }
    
    winnersBracket.push(firstRound);

    let roundIndex = 1;
    while (winnersBracket[winnersBracket.length-1].length > 1) {
        const previousRound = winnersBracket[winnersBracket.length-1];
        const newRound: Match[] = [];
        for (let i = 0; i < previousRound.length; i += 2) {
            const matchIndex = i / 2;
            const match: Match = {
                id: `${roundIndex + 1}W${matchIndex + 1}`,
                roundIndex: roundIndex,
                matchIndex: matchIndex,
                players: [null, null],
                scores: [0, 0]
            };
             // Auto-advance winner of a bye match in the previous round
             if (previousRound[i].isBye) {
                 match.players[0] = previousRound[i].winnerId;
             }
             if (previousRound[i+1] && previousRound[i+1].isBye) {
                 match.players[1] = previousRound[i+1].winnerId;
             }
            newRound.push(match);
        }
        winnersBracket.push(newRound);
        roundIndex++;
    }

    for (let r = 0; r < winnersBracket.length - 1; r++) {
        for (let m = 0; m < winnersBracket[r].length; m++) {
            winnersBracket[r][m].nextMatchId = `${r + 2}W${Math.floor(m / 2) + 1}`;
        }
    }

    const finalMatch = winnersBracket[winnersBracket.length - 1][0];
    if(finalMatch) finalMatch.isGrandFinals = true;
    return { winners: winnersBracket };
};


// --- Image Preloading ---
const preloadedImageUrls = new Set<string>();

/**
 * Preloads player icon images for a given tournament to improve bracket load times.
 * This function is idempotent and will not re-fetch images that have already been requested for preloading in the current session.
 * @param tournament - The tournament object, with assets already resolved.
 */
const preloadTournamentImages = (tournament: Tournament): void => {
    if (!tournament || !tournament.players) {
        return;
    }

    const uniqueIconUrls = new Set<string>();
    tournament.players.forEach(player => {
        // Assumes player.icon is the final, resolved URL from getTournamentById.
        if (player.icon && !preloadedImageUrls.has(player.icon)) {
            uniqueIconUrls.add(player.icon);
        }
    });

    uniqueIconUrls.forEach(url => {
        const img = new Image();
        img.src = url;
        preloadedImageUrls.add(url); // Add to set immediately to prevent re-triggering for the same URL.
    });
};


// --- Main Service Object ---
export const tournamentService = {
    // --- Tournament Management ---
    getTournaments: (): Tournament[] => {
        let tournaments = getFromStorage<Tournament[]>('tournaments', []);
        
        if (tournaments.length === 0) {
            const assets = tournamentService.getAssets(); 
            
            const players: Player[] = [];
            const adjectives = ['Shadow', 'Cyber', 'Neon', 'Quantum', 'Phantom', 'Galactic', 'Toxic', 'Cosmic', 'Savage', 'Zero', 'Iron', 'Crimson', 'Azure', 'Golden', 'Venom'];
            const nouns = ['Striker', 'Reaper', 'Specter', 'Viper', 'Knight', 'Dragon', 'Hunter', 'Ninja', 'Wolf', 'Glitch', 'Sorcerer', 'Phoenix', 'Warden', 'Jester', 'King'];
            
            for (let i = 1; i <= 64; i++) {
                let gamertag = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 100)}`;
                if (gamertag.length > 15) {
                    gamertag = gamertag.substring(0, 15);
                }
                players.push({
                    id: `player-test-${i}`,
                    gamertag,
                    icon: `asset:icon:${(i - 1) % assets.icons.length}`,
                    seed: i,
                    selfReportingPasswordHash: simpleHash('test'),
                    discordOrIGN: i % 3 === 0 ? `${gamertag.toLowerCase()}#${Math.floor(Math.random()*9000)+1000}` : '',
                });
            }

            const singleElimBracket = generateBracket(players);
            
            const testTournaments: Tournament[] = [
                {
                    id: 'single-elim-test', name: 'Test Tournament (Single Elim)',
                    gameTitle: 'Valorant', platforms: ['PC'],
                    tournamentType: TournamentType.SINGLE_ELIMINATION, matchFormat: MatchFormat.BEST_OF_3,
                    startDate: new Date().toISOString(),
                    description: 'A pre-generated single elimination tournament with 64 players.',
                    adminPasswordHash: simpleHash('test'),
                    bannerUrl: `https://picsum.photos/seed/valorant-banner/1200/300`,
                    status: TournamentStatus.IN_PROGRESS,
                    players: players, bracket: singleElimBracket, announcements: 'Welcome! This is a single elimination test.',
                    isCitiesTournament: false,
                    backgroundUrl: '', // Deprecated, kept for type safety
                },
            ];

            tournaments = testTournaments;
            setToStorage('tournaments', tournaments);
        }

        return tournaments.map(resolveAssetsInTournament);
    },
    getTournamentById: (id: string): Tournament | undefined => {
        const tournaments = getFromStorage<Tournament[]>('tournaments', []);
        const tournament = tournaments.find(t => t.id === id);
        return tournament ? resolveAssetsInTournament(tournament) : undefined;
    },
    createTournament: (data: Omit<Tournament, 'id' | 'adminPasswordHash' | 'players' | 'announcements' | 'bracket' | 'backgroundUrl'> & { adminPassword: string }): Tournament => {
        const tournaments = getFromStorage<Tournament[]>('tournaments', []);
        const { adminPassword, ...tournamentData } = data;
        
        const assets = getFromStorage<SuperAdminAssets>('superAdminAssets', DEFAULT_ASSETS);
        const gameBackground = assets.backgrounds[tournamentData.gameTitle];

        const newTournament: Tournament = {
            ...tournamentData,
            bannerUrl: gameBackground,
            id: generateId(),
            adminPasswordHash: simpleHash(adminPassword),
            players: [],
            announcements: '',
            bracket: undefined,
            backgroundUrl: '', // Deprecated
        };
        setToStorage('tournaments', [...tournaments, newTournament]);
        return resolveAssetsInTournament(newTournament);
    },
    updateTournament: (id: string, updates: Partial<Tournament>): Tournament | undefined => {
        let tournaments = getFromStorage<Tournament[]>('tournaments', []);
        let updatedTournament: Tournament | undefined;

        const newTournaments = tournaments.map(t => {
            if (t.id === id) {
                const originalStatus = t.status;
                let pendingUpdate = { ...t, ...updates };

                const isStartingTournament = originalStatus === TournamentStatus.REGISTRATION_OPEN && pendingUpdate.status === TournamentStatus.IN_PROGRESS;
                const isRevertingTournament = originalStatus === TournamentStatus.IN_PROGRESS && pendingUpdate.status === TournamentStatus.REGISTRATION_OPEN;

                if (isStartingTournament) {
                     if (pendingUpdate.players.length >= 2) {
                        const sortedPlayers = [...pendingUpdate.players].sort((a,b) => a.seed - b.seed);
                        const newBracket = generateBracket(sortedPlayers);
                        pendingUpdate.bracket = newBracket;
                    } else {
                        alert("Cannot start a tournament with fewer than 2 players.");
                        pendingUpdate.status = originalStatus;
                    }
                } else if (isRevertingTournament) {
                    // When reverting, wipe the bracket to reset all match progress.
                    // A new bracket will be generated when the tournament is started again.
                    pendingUpdate.bracket = undefined;
                }

                updatedTournament = pendingUpdate;
                return updatedTournament;
            }
            return t;
        });

        setToStorage('tournaments', newTournaments);
        return updatedTournament ? resolveAssetsInTournament(updatedTournament) : undefined;
    },

    // --- Player Management ---
    addPlayer: (tournamentId: string, playerData: Omit<Player, 'id' | 'seed' | 'selfReportingPasswordHash'> & { selfReportingPassword: string }): Tournament => {
        const tournaments = getFromStorage<Tournament[]>('tournaments', []);
        const tournament = tournaments.find(t => t.id === tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
            throw new Error('Registration is not open for this tournament.');
        }
        
        const newPlayer: Player = {
            ...playerData, // playerData.icon is now expected to be a reference string.
            id: generateId(),
            seed: tournament.players.length + 1,
            selfReportingPasswordHash: simpleHash(playerData.selfReportingPassword),
        };
        
        const updatedPlayers = [...tournament.players, newPlayer];
        return tournamentService.updateTournament(tournamentId, { players: updatedPlayers }) as Tournament;
    },
    updatePlayer: (tournamentId: string, playerId: string, updates: Partial<Player>): Tournament => {
        const tournaments = getFromStorage<Tournament[]>('tournaments', []);
        const tournament = tournaments.find(t => t.id === tournamentId);
        if (!tournament) throw new Error('Tournament not found');
        
        const updatedPlayers = tournament.players.map(p => p.id === playerId ? {...p, ...updates} : p);
        return tournamentService.updateTournament(tournamentId, { players: updatedPlayers }) as Tournament;
    },
    removePlayer: (tournamentId: string, playerId: string): Tournament => {
        const tournaments = getFromStorage<Tournament[]>('tournaments', []);
        const tournament = tournaments.find(t => t.id === tournamentId);
        if (!tournament) throw new Error('Tournament not found');

        const updatedPlayers = tournament.players.filter(p => p.id !== playerId);
        const reseededPlayers = updatedPlayers.map((p, index) => ({...p, seed: index + 1}));

        return tournamentService.updateTournament(tournamentId, { players: reseededPlayers }) as Tournament;
    },

    // --- Match Management ---
    updateMatchWinner: (tournamentId: string, matchId: string, winnerId: string, scores: number[]): Tournament => {
        const tourney = getFromStorage<Tournament[]>('tournaments', []).find(t => t.id === tournamentId);
        if (!tourney || !tourney.bracket) return resolveAssetsInTournament(tourney!)!;
    
        const newBracket = JSON.parse(JSON.stringify(tourney.bracket)) as Bracket;
        let updatedMatch: Match | undefined;

        const findAndAdvance = (bracketPart: Match[][]) => {
             for (const round of bracketPart) {
                const match = round.find(m => m.id === matchId);
                if (match) {
                    updatedMatch = match;

                    match.winnerId = winnerId;
                    match.scores = scores;
                    match.justCompleted = true;

                    // Advance Winner
                    if (match.nextMatchId) {
                        const nextBracketParts = [newBracket.winners];
                        for (const part of nextBracketParts) {
                             for (const nextRound of part) {
                                const nextMatch = nextRound.find(m => m.id === match.nextMatchId);
                                if (nextMatch) {
                                    // Determine if the current match is the top or bottom feeder for the next match.
                                    const playerIndexInNextMatch = match.matchIndex % 2 === 0 ? 0 : 1;
                                    
                                    // The previous logic failed to advance a winner if their designated slot
                                    // was already occupied (e.g., by a bye), which is a bug. The winner must
                                    // always be advanced to their correct slot based on the match index.
                                    nextMatch.players[playerIndexInNextMatch] = winnerId;
                                    break;
                                }
                            }
                        }
                    }
                    return;
                }
            }
        };

        findAndAdvance(newBracket.winners);

        return tournamentService.updateTournament(tournamentId, { bracket: newBracket })!;
    },
    
    reverseMatchWinner: (tournamentId: string, matchId: string): Tournament => {
        const tourney = getFromStorage<Tournament[]>('tournaments', []).find(t => t.id === tournamentId);
        if (!tourney || !tourney.bracket) throw new Error("Tournament not found.");

        const newBracket = JSON.parse(JSON.stringify(tourney.bracket)) as Bracket;
        let matchToReverse: Match | undefined;
        
        // Find the match
        for (const round of newBracket.winners) {
            const match = round.find(m => m.id === matchId);
            if(match) { matchToReverse = match; break; }
        }
        
        if (!matchToReverse || !matchToReverse.winnerId) {
            throw new Error("Match not found or it has no winner to reverse.");
        }
        
        const originalWinnerId = matchToReverse.winnerId;

        const checkNextMatch = (nextMatchId: string | null | undefined) => {
            if (!nextMatchId) return;
            const allRounds = [...newBracket.winners];
             for (const round of allRounds) {
                const match = round.find(m => m.id === nextMatchId);
                if (match) {
                    if (match.winnerId) {
                         throw new Error("Cannot reverse this match because a subsequent match has already been played. Please reverse the later match first.");
                    }
                    const p_idx = match.players.indexOf(originalWinnerId);
                    if(p_idx !== -1) match.players[p_idx] = null;
                }
            }
        };

        checkNextMatch(matchToReverse.nextMatchId);
        
        matchToReverse.winnerId = null;
        matchToReverse.scores = [0, 0];
        matchToReverse.justCompleted = false;

        return tournamentService.updateTournament(tournamentId, { bracket: newBracket })!;
    },

    clearJustCompletedFlags: (tournamentId: string): Tournament => {
        const tourney = getFromStorage<Tournament[]>('tournaments', []).find(t => t.id === tournamentId);
        if (!tourney || !tourney.bracket) return resolveAssetsInTournament(tourney!)!;

        const newBracket = JSON.parse(JSON.stringify(tourney.bracket)) as Bracket;
        newBracket.winners.forEach(round => round.forEach(match => match.justCompleted = false));
        
        return tournamentService.updateTournament(tournamentId, { bracket: newBracket })!;
    },

    // --- Authentication ---
    verifyAdminPassword: (tournamentId: string, password: string): boolean => {
        if (password === SUPER_ADMIN_PASSWORD) {
            return true;
        }
        const tournament = getFromStorage<Tournament[]>('tournaments', []).find(t => t.id === tournamentId);
        return !!tournament && compareHash(password, tournament.adminPasswordHash);
    },
    verifyPlayerPassword: (tournament: Tournament, match: Match, password: string): boolean => {
       if (password === SUPER_ADMIN_PASSWORD) {
           return true;
       }
       const playerIds = match.players;
       for (const playerId of playerIds) {
           if (!playerId) continue;
           const player = tournament.players.find(p => p.id === playerId);
           if (player && compareHash(password, player.selfReportingPasswordHash)) {
               return true;
           }
       }
       return false;
    },

    // --- Super Admin ---
    getAssets: (): SuperAdminAssets => {
        const storedAssets = getFromStorage<Partial<SuperAdminAssets>>('superAdminAssets', DEFAULT_ASSETS);
        // Ensure all keys from default assets are present for backward compatibility
        const finalAssets = {
            ...DEFAULT_ASSETS,
            ...storedAssets,
        };

        // Migration logic for icons: if they are still strings, convert them to {name, url} objects.
        if (finalAssets.icons && finalAssets.icons.length > 0 && typeof (finalAssets.icons as any)[0] === 'string') {
            (finalAssets.icons as any) = (finalAssets.icons as any as string[]).map((url, index) => ({
                name: `Icon ${index + 1}`,
                url,
            }));
        }

        return finalAssets as SuperAdminAssets;
    },
    saveAssets: (assets: SuperAdminAssets) => setToStorage('superAdminAssets', assets),
    preloadTournamentImages,
};