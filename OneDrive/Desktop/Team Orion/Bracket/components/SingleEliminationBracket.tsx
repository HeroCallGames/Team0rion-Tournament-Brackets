import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import p5 from 'p5';
import { Tournament, Player, Match as MatchType, City } from '../types';
import { resolveAssetRef } from '../services/tournamentService';

interface SingleEliminationBracketProps {
  tournament: Tournament;
  onReportScore: (match: MatchType) => void;
  cities: City[];
  isModalOpen: boolean;
}

interface BracketHandles {
    focusOnPlayer: (playerId: string) => void;
}

const SingleEliminationBracket = forwardRef<BracketHandles, SingleEliminationBracketProps>(({ tournament, onReportScore, cities, isModalOpen }, ref) => {
  const sketchRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 & { 
    focusOnPlayer?: (id: string) => void;
    updateData?: (newTournament: Tournament, newCities: City[], newIsModalOpen: boolean) => void; 
  } | null>(null);

  useImperativeHandle(ref, () => ({
    focusOnPlayer: (playerId: string) => {
      p5InstanceRef.current?.focusOnPlayer?.(playerId);
    }
  }));

  // Effect to handle data updates on the existing p5 instance
  useEffect(() => {
    if (p5InstanceRef.current?.updateData) {
      p5InstanceRef.current.updateData(tournament, cities, isModalOpen);
    }
  }, [tournament, cities, isModalOpen]);

  // Effect to initialize the p5 sketch
  useEffect(() => {
    if (!sketchRef.current) return;

    let p5Instance: p5 & { 
      focusOnPlayer?: (id: string) => void;
      updateData?: (newTournament: Tournament, newCities: City[], newIsModalOpen: boolean) => void;
    };
    const parentDiv = sketchRef.current;
    let isRemoved = false;

    const sketch = (p: p5) => {
      let sketchTournament = tournament;
      let sketchCities = cities;
      let isModalOpenForSketch = isModalOpen;
      const NODE_WIDTH = 190;
      const NODE_HEIGHT = 50;

      class VisualNode {
        round: number;
        index: number;
        pos: p5.Vector;
        parent: VisualNode | null = null;
        children: VisualNode[] = [];
        winner: VisualNode | null = null;
        state: 'unplayed' | 'decided' = 'unplayed';
        color: p5.Color;
        name: string = '';
        iconImage?: p5.Image;
        sourceMatch: MatchType | null = null;
        playerId: string | null = null;
        width: number;
        height: number;
        hasCrown = false;
        crownState: 'off' | 'animating' | 'on' = 'off';
        crownAnimationStart = 0;
        flickerCountdown = 0;
        isFlickering = false;
        flickerDuration = 0;

        constructor(round: number, index: number) {
          this.round = round;
          this.index = index;
          this.pos = p.createVector(0, 0);
          this.color = p.color(0, 0, 60);
          this.width = NODE_WIDTH;
          this.height = NODE_HEIGHT;
        }
      }

      class LightPulse {
        path: p5.Vector[];
        color: p5.Color;
        progress = 0;
        segmentLengths: number[] = [];
        totalLength = 0;
        speed: number;
        delay: number;

        constructor(path: p5.Vector[], color: p5.Color, delay: number = 0) {
          this.path = path;
          this.color = color;
          this.delay = delay;

          for (let i = 0; i < this.path.length - 1; i++) {
            const segmentLength = p5.Vector.dist(this.path[i], this.path[i + 1]);
            this.segmentLengths.push(segmentLength);
            this.totalLength += segmentLength;
          }
          this.speed = (this.totalLength > 0) ? 12 / this.totalLength : 0.5;
        }

        update() {
          if (this.delay > 0) {
            this.delay -= 1;
            return;
          }
          this.progress = Math.min(1, this.progress + this.speed);
        }

        isFinished() {
          return this.progress >= 1;
        }

        display() {
            if (this.delay > 0 || this.path.length < 2) return;
    
            const p_drawingContext = p.drawingContext as CanvasRenderingContext2D;
            const pulseLength = 60;
    
            const headDistance = this.totalLength * this.progress;
            const tailDistance = headDistance - pulseLength;
    
            p.noFill();
            
            let distanceTravelled = 0;
            for (let i = 0; i < this.path.length - 1; i++) {
                const p1 = this.path[i];
                const p2 = this.path[i + 1];
                const segmentLen = this.segmentLengths[i];
        
                const startOnSeg = Math.max(0, tailDistance - distanceTravelled);
                const endOnSeg = Math.min(segmentLen, headDistance - distanceTravelled);
        
                if (endOnSeg > startOnSeg) {
                    const startPoint = p5.Vector.lerp(p1, p2, startOnSeg / segmentLen);
                    const endPoint = p5.Vector.lerp(p1, p2, endOnSeg / segmentLen);
                    
                    p_drawingContext.shadowBlur = 18;
                    p_drawingContext.shadowColor = this.color.toString();
                    p.stroke(this.color);
                    p.strokeWeight(5);
                    p.line(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
                    
                    p_drawingContext.shadowBlur = 6;
                    p_drawingContext.shadowColor = p.color(360, 0, 100, 0.7).toString();
                    p.stroke(p.color(360, 0, 100, 0.8));
                    p.strokeWeight(1.5);
                    p.line(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
                }
        
                distanceTravelled += segmentLen;
            }
            p_drawingContext.shadowBlur = 0;
        }
      }

      let p5Rounds: VisualNode[][] = [];
      let pulses: LightPulse[] = [];
      let numMatchRounds = 0;
      let colorPalette: p5.Color[] = [];
      let neutralColor: p5.Color;
      let playerMap = new Map<string, Player>();
      
      const resolvedPlayerIcons = new Map<string, string>();
      const loadedIcons = new Map<string, p5.Image>();
      let placeholderIcon: p5.Image;
      
      let pulseWaveDelay = 0;
      const PULSE_WAVE_COOLDOWN = 180;

      let viewOffset: p5.Vector;
      let isDragging = false;
      let previousMouse: p5.Vector;
      let viewScale = 1.0;
      const MIN_SCALE = 0.25;
      const MAX_SCALE = 4.0;
      
      let bracketLeftX = 0, bracketRightX = 0, bracketTopY = 0, bracketBottomY = 0;

      let animation = {
        isAnimating: false,
        startTime: 0,
        phase: 'zoom-out' as 'zoom-out' | 'zoom-in',
        duration: 1000, // 1 second per phase
        startScale: 1.0,
        endScale: 1.0,
        startOffset: p.createVector(0, 0),
        endOffset: p.createVector(0, 0),
        targetNode: null as VisualNode | null,
      };

      let initialPinchDistance = 0;
      let touchStartPos: p5.Vector | null = null;
      
      let isPageScrolling = false;
      let touchMoveDecided = false;
      const SCROLL_LOCK_THRESHOLD = 10; // pixels
      
      let hoveredNode: VisualNode | null = null;
      let hoverStartTime = 0;
      const HOVER_DELAY = 500; // ms

      const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      // Helper function for view culling
      const isRectInView = (x: number, y: number, w: number, h: number, view: {x: number, y: number, w: number, h: number}, margin: number = 50): boolean => {
        return x < view.x + view.w + margin && x + w > view.x - margin && y < view.y + view.h + margin && y + h > view.y - margin;
      };
        
      // --- DELETED ---
      // The p.preload() function has been removed because it is obsolete in p5.js v2.0+
        
      // --- MODIFIED ---
      // p.setup is now an async function to correctly handle modern asset loading.
      p.setup = async () => {
        p.createCanvas(parentDiv.offsetWidth, parentDiv.offsetHeight);
        p.colorMode(p.HSB, 360, 100, 100, 1);
        p.noFill();
        p.textFont('Orbitron');
        p.cursor('grab');

        // --- ADDED: ASYNC ASSET LOADING LOGIC ---
        
        // Helper to load an image using a Promise, which works with async/await
        const loadImageAsync = (url: string): Promise<p5.Image> => {
          return new Promise((resolve, reject) => {
            p.loadImage(url, 
              img => resolve(img), 
              () => reject(new Error(`Failed to load image at URL: ${url}`))
            );
          });
        };
        
        // Load the placeholder icon first and wait for it to be ready.
        const FALLBACK_ICON_B64 = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64"><rect width="64" height="64" fill="#4A5568"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40" fill="#E2E8F0">?</text></svg>');
        try {
            placeholderIcon = await loadImageAsync(FALLBACK_ICON_B64);
        } catch (e) {
            console.error("CRITICAL: Could not load the fallback placeholder icon.", e);
            placeholderIcon = p.createImage(1, 1); // Create a dummy image to prevent crashes
        }

        // Resolve all player icon URLs from the tournament data
        sketchTournament.players.forEach(player => {
            if (player.icon) {
                const resolvedUrl = resolveAssetRef(player.icon);
                resolvedPlayerIcons.set(player.id, resolvedUrl);
            }
        });
        
        // Create a list of promises to load all unique icons in parallel for performance.
        const uniqueIconUrls = Array.from(new Set(resolvedPlayerIcons.values()));
        const iconLoadPromises = uniqueIconUrls.map(async (url) => {
            if (url && !loadedIcons.has(url)) {
                try {
                    const img = await loadImageAsync(url);
                    loadedIcons.set(url, img);
                } catch {
                    console.error("Failed to load image asset, using placeholder:", url);
                    loadedIcons.set(url, placeholderIcon); // Use placeholder on failure
                }
            }
        });

        // Wait for all image loading promises to complete before continuing.
        await Promise.all(iconLoadPromises);

        // --- END OF NEW ASSET LOADING LOGIC ---

        // This is the original setup logic. It now runs safely *after* all images are loaded.
        colorPalette = [
            p.color(355, 95, 100), p.color(200, 95, 100),
            p.color(130, 95, 100), p.color(55, 95, 100),
        ];
        neutralColor = p.color(0, 0, 60);
        
        playerMap = new Map<string, Player>(sketchTournament.players.map(pl => [pl.id, pl]));
        createBracketStructure();
        calculatePositions();
        calculateBracketBounds();

        viewOffset = p.createVector(0,0);
        previousMouse = p.createVector(0,0);
        viewScale = 1.0;
      };

      const calculateBracketBounds = () => {
        if (p5Rounds.length === 0) return;
    
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
        for (const round of p5Rounds) {
            for (const node of round) {
                minX = Math.min(minX, node.pos.x - node.width / 2);
                maxX = Math.max(maxX, node.pos.x + node.width / 2);
                minY = Math.min(minY, node.pos.y - node.height / 2);
                maxY = Math.max(maxY, node.pos.y + node.height / 2);
            }
        }
        
        bracketLeftX = minX - 50;
        bracketRightX = maxX + 80; 
        bracketTopY = minY - 50;
        bracketBottomY = maxY + 50;
      };
      
      const createBracketStructure = () => {
        p5Rounds = [];
        pulses = [];
        if (!sketchTournament.bracket || sketchTournament.bracket.winners.length === 0) return;
        
        numMatchRounds = sketchTournament.bracket.winners.length;
        const numP5Rounds = numMatchRounds + 1;
        for (let i = 0; i < numP5Rounds; i++) p5Rounds.push([]);

        const firstRoundMatches = sketchTournament.bracket.winners[0] || [];
        const playerNodeIdsInOrder = firstRoundMatches.flatMap(m => m.players);
        
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(playerNodeIdsInOrder.length)));
        while(playerNodeIdsInOrder.length < bracketSize) playerNodeIdsInOrder.push(null);

        playerNodeIdsInOrder.forEach((playerId, i) => {
            const pNode = new VisualNode(0, i);
            pNode.playerId = playerId;
            if(playerId) {
                const player = playerMap.get(playerId);
                pNode.color = colorPalette[i % colorPalette.length];
                if(player) {
                    pNode.name = player.gamertag;
                    const iconUrl = resolvedPlayerIcons.get(player.id);
                    if (iconUrl) pNode.iconImage = loadedIcons.get(iconUrl);
                }
            } else {
                pNode.name = "BYE";
                pNode.color = neutralColor;
            }
            pNode.state = 'decided';
            p5Rounds[0].push(pNode);
        });

        for(let r=0; r < numMatchRounds; r++) {
            const roundData = sketchTournament.bracket.winners[r];
            roundData.forEach((matchData) => {
                const mNode = new VisualNode(r + 1, matchData.matchIndex);
                mNode.sourceMatch = matchData;
                
                if (r === 0) {
                    const child1 = p5Rounds[0][matchData.matchIndex * 2];
                    const child2 = p5Rounds[0][matchData.matchIndex * 2 + 1];
                    if(child1) { mNode.children.push(child1); child1.parent = mNode; }
                    if(child2) { mNode.children.push(child2); child2.parent = mNode; }
                } else {
                    const prevRoundNodes = p5Rounds[r];
                    const childSourceNodes = prevRoundNodes.filter(node => node.sourceMatch?.nextMatchId === matchData.id);
                    childSourceNodes.forEach(csm => {
                        mNode.children.push(csm);
                        csm.parent = mNode;
                    });
                }
                
                if(matchData.winnerId) {
                    mNode.state = 'decided';
                    mNode.playerId = matchData.winnerId;
                    const winner = playerMap.get(matchData.winnerId);
                    if(winner) {
                        mNode.name = winner.gamertag;
                        const iconUrl = resolvedPlayerIcons.get(winner.id);
                        if (iconUrl) mNode.iconImage = loadedIcons.get(iconUrl);
                    }
                    
                    const winnerChildNode = mNode.children.find(c => (c.round === 0) ? (c.playerId === matchData.winnerId) : (c.sourceMatch?.winnerId === matchData.winnerId));
                    const loserChildNode = mNode.children.find(c => c && c !== winnerChildNode);
                    if (loserChildNode) loserChildNode.color = neutralColor;
                    
                    if (winnerChildNode) {
                       mNode.winner = winnerChildNode;
                       mNode.color = winnerChildNode.color;
                    }
                }
                p5Rounds[r + 1].push(mNode);
            });
            p5Rounds[r + 1].sort((a,b) => a.index - b.index);
        }

        const finalNode = p5Rounds[p5Rounds.length - 1]?.[0];
        if (finalNode) {
            finalNode.hasCrown = true;
            if (finalNode.sourceMatch?.winnerId) {
                // The `justCompleted` flag from the tournament data triggers the animation.
                if (finalNode.sourceMatch.justCompleted) {
                    finalNode.crownState = 'animating';
                    finalNode.crownAnimationStart = p.millis();
                } else {
                    finalNode.crownState = 'on';
                    finalNode.flickerCountdown = p.random(60, 180); // Start with a random flicker time
                }
            } else {
                finalNode.crownState = 'off';
            }
        }
      };

      const calculatePositions = () => {
          const horizontalPadding = 50;
          const verticalPadding = 50;
          const horizontalGap = 120;
          const verticalNodeGap = NODE_HEIGHT + 40;
          
          if (p5Rounds.length === 0) return;
          let currentX = horizontalPadding + NODE_WIDTH / 2;

          if (p5Rounds[0]) {
              const roundNodes = p5Rounds[0];
              for (let i = 0; i < roundNodes.length; i++) {
                  const node = roundNodes[i];
                  node.pos.x = currentX;
                  node.pos.y = verticalPadding + (i * verticalNodeGap);
              }
          }

          for (let r = 1; r < p5Rounds.length; r++) {
              const roundNodes = p5Rounds[r];
              currentX += NODE_WIDTH + horizontalGap;
              for (const node of roundNodes) {
                  if (node.children && node.children.length > 0) {
                      let totalY = node.children.reduce((sum, child) => sum + child.pos.y, 0);
                      node.pos.y = totalY / node.children.length;
                  }
                  node.pos.x = currentX;
              }
          }
      }
      
      const tracePlayerPath = (startNode: VisualNode): [p5.Vector[], p5.Vector[]] => {
        const topPath: p5.Vector[] = [];
        const bottomPath: p5.Vector[] = [];
        let currentNode = startNode;
    
        while (true) {
            const w = currentNode.width / 2;
            const h = currentNode.height / 2;
            const cx = currentNode.pos.x;
            const cy = currentNode.pos.y;
    
            const leftCenter = p.createVector(cx - w, cy);
            const rightCenter = p.createVector(cx + w, cy);

            if (topPath.length === 0) {
                topPath.push(leftCenter);
                bottomPath.push(leftCenter);
            }
    
            topPath.push(p.createVector(cx - w, cy - h), p.createVector(cx + w, cy - h), rightCenter);
            bottomPath.push(p.createVector(cx - w, cy + h), p.createVector(cx + w, cy + h), rightCenter);
    
            const parent = currentNode.parent;
            
            if (!parent || parent.state !== 'decided' || parent.winner !== currentNode) {
                if (parent && parent.state !== 'decided') {
                    const fromPos = rightCenter;
                    const toPos = p.createVector(parent.pos.x - parent.width / 2, parent.pos.y);
                    const midX = (fromPos.x + toPos.x) / 2;
                    topPath.push(p.createVector(midX, fromPos.y));
                    bottomPath.push(p.createVector(midX, fromPos.y));
                }
                break;
            }
            
            const fromPos = rightCenter;
            const toPos = p.createVector(parent.pos.x - parent.width/2, parent.pos.y);
            const midX = (fromPos.x + toPos.x) / 2;
            
            const connectorPoints = [ p.createVector(midX, fromPos.y), p.createVector(midX, toPos.y), toPos ];
            topPath.push(...connectorPoints);
            bottomPath.push(...connectorPoints);
            
            currentNode = parent;
        }
        return [topPath, bottomPath];
    };

      const isPlayerEliminated = (playerNode: VisualNode): boolean => {
          let currentNode: VisualNode = playerNode;
          while (currentNode.parent) {
              const parentNode = currentNode.parent;
              if (parentNode.state !== 'decided') return false;
              if (parentNode.winner !== currentNode) return true;
              currentNode = parentNode;
          }
          return false;
      };

      const generatePulseWave = () => {
        pulses = [];
        const playerNodes = p5Rounds[0] || [];
        playerNodes.forEach(playerNode => {
            if (playerNode.playerId && !isPlayerEliminated(playerNode)) {
                const [topPath, bottomPath] = tracePlayerPath(playerNode);
                if (topPath.length > 1) pulses.push(new LightPulse(topPath, playerNode.color));
                if (bottomPath.length > 1) pulses.push(new LightPulse(bottomPath, playerNode.color));
            }
        });
      };

      const drawSeparatorLineWithText = (y: number, text: string, textCenterX?: number) => {
        const p_drawingContext = p.drawingContext as CanvasRenderingContext2D;
        const whiteColor = p.color(0, 0, 100);
        
        p_drawingContext.shadowBlur = 10;
        p_drawingContext.shadowColor = whiteColor.toString();
        p.stroke(whiteColor);
        p.strokeWeight(2);
        p.line(bracketLeftX, y, bracketRightX, y);
        p_drawingContext.shadowBlur = 0;
        
        if (text) {
            p.push();
            p.textFont('Orbitron');
            p.textSize(18);
            const textW = p.textWidth(text);
            const boxW = textW + 32;
            const boxH = 30;
            const boxCenterX = textCenterX !== undefined ? textCenterX : (bracketLeftX + bracketRightX) / 2;
    
            const boxX = boxCenterX - boxW / 2;
            
            p.noStroke();
            p.fill(13, 15, 26); 
            p.rect(boxX - 2, y - boxH / 2, boxW + 4, boxH);
    
            p_drawingContext.shadowBlur = 8;
            p_drawingContext.shadowColor = whiteColor.toString();
            p.strokeWeight(1.5);
            p.stroke(whiteColor);
            p.fill(13, 15, 26, 0.85); 
            p.rect(boxX, y - boxH / 2, boxW, boxH, 4);
            p_drawingContext.shadowBlur = 0;
            
            p.noStroke();
            p.fill(whiteColor);
            p.textAlign(p.CENTER, p.CENTER);
            p.text(text, boxCenterX, y);
            p.pop();
        }
      };

      const handleClickOrTap = (x: number, y: number) => {
        const adjustedMouseX = (x - viewOffset.x) / viewScale;
        const adjustedMouseY = (y - viewOffset.y) / viewScale;
        
        for (let r = p5Rounds.length - 1; r >= 0; r--) {
            const round = p5Rounds[r];
            for (let i = round.length - 1; i >= 0; i--) {
                const node = round[i];
                const isInside = adjustedMouseX > node.pos.x - node.width / 2 &&
                               adjustedMouseX < node.pos.x + node.width / 2 &&
                               adjustedMouseY > node.pos.y - node.height / 2 &&
                               adjustedMouseY < node.pos.y + node.height / 2;

                if (isInside) {
                    if (node.round > 0 && !node.playerId) return;
                    
                    let targetMatch: MatchType | null = null;
                    if (node.parent && node.parent.sourceMatch) {
                         targetMatch = node.parent.sourceMatch;
                    } else if (node.round > 0) {
                        targetMatch = node.sourceMatch;
                    }

                    if (targetMatch && targetMatch.players.every(pl => pl !== null)) {
                        onReportScore(targetMatch);
                        return;
                    }
                }
            }
        }
      };

      const truncateText = (text: string, maxWidth: number): string => {
        p.textSize(14);
        if (p.textWidth(text) <= maxWidth) return text;
        const ellipsis = '...';
        const ellipsisWidth = p.textWidth(ellipsis);
        let truncatedText = text;
        while (p.textWidth(truncatedText) + ellipsisWidth > maxWidth && truncatedText.length > 0) {
            truncatedText = truncatedText.slice(0, -1);
        }
        return truncatedText.trim() + ellipsis;
      };

      p.draw = () => {
        p.background(13, 15, 26);
        
        if (animation.isAnimating) {
            const now = p.millis();
            const t = p.constrain((now - animation.startTime) / animation.duration, 0, 1);
            const easedT = easeInOutCubic(t);

            viewScale = p.lerp(animation.startScale, animation.endScale, easedT);
            viewOffset = p5.Vector.lerp(animation.startOffset, animation.endOffset, easedT);
            
            if (t >= 1) { 
                if (animation.phase === 'zoom-out' && animation.targetNode) {
                    animation.phase = 'zoom-in';
                    animation.startTime = now;
                    animation.startScale = viewScale;
                    animation.endScale = 1.5;
                    animation.startOffset = viewOffset.copy();
                    
                    animation.endOffset = p.createVector(
                        p.width / 2 - animation.targetNode.pos.x * animation.endScale,
                        p.height / 2 - animation.targetNode.pos.y * animation.endScale
                    );

                } else {
                    animation.isAnimating = false;
                    animation.targetNode = null;
                }
            }
        }
        
        p.push();
        p.translate(viewOffset.x, viewOffset.y);
        p.scale(viewScale);

        const viewRect = {
            x: -viewOffset.x / viewScale,
            y: -viewOffset.y / viewScale,
            w: p.width / viewScale,
            h: p.height / viewScale,
        };

        if (p5Rounds.length > 0) {
            let headerRoundIndex = 0;
            for (let r = p5Rounds.length - 1; r >= 0; r--) {
                if (p5Rounds[r] && p5Rounds[r].some(node => node.playerId !== null)) {
                    headerRoundIndex = r;
                    break;
                }
            }

            if (p5Rounds[headerRoundIndex] && p5Rounds[headerRoundIndex].length > 0) {
                let text = '';
                const numberWords = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
                const displayRoundNumber = headerRoundIndex + 1;

                const numNodesInHeaderRound = p5Rounds[headerRoundIndex]?.length || 0;

                if (headerRoundIndex > 0 && numNodesInHeaderRound === 1) {
                    text = 'Champion';
                } else if (headerRoundIndex > 0 && numNodesInHeaderRound === 2) {
                    text = 'Grand Finals';
                } else if (headerRoundIndex > 0 && numNodesInHeaderRound === 4) {
                    text = 'Top 4';
                } else if (headerRoundIndex > 0 && numNodesInHeaderRound === 8) {
                    text = 'Top 8';
                } else {
                    text = `Round ${numberWords[displayRoundNumber] || displayRoundNumber}`;
                }

                const xPos = p5Rounds[headerRoundIndex][0].pos.x;
                const yPos = bracketTopY - 20;
                drawSeparatorLineWithText(yPos, text, xPos);
            } else {
                drawSeparatorLineWithText(bracketTopY - 20, "");
            }
        }
        
        if (pulseWaveDelay > 0) {
            pulseWaveDelay--;
        } else if (pulses.length === 0 && !animation.isAnimating) {
            generatePulseWave();
            pulseWaveDelay = PULSE_WAVE_COOLDOWN;
        }

        for (let i = pulses.length - 1; i >= 0; i--) {
            const pulse = pulses[i];
            pulse.update();
            if (pulse.path.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                pulse.path.forEach(pt => {
                    minX = Math.min(minX, pt.x);
                    minY = Math.min(minY, pt.y);
                    maxX = Math.max(maxX, pt.x);
                    maxY = Math.max(maxY, pt.y);
                });
                if (isRectInView(minX, minY, maxX - minX, maxY - minY, viewRect)) {
                    pulse.display();
                }
            }
            if (pulse.isFinished()) pulses.splice(i, 1);
        }

        drawBrackets(viewRect);
        drawNodes(viewRect);
        
        for (const round of p5Rounds) {
            for (const node of round) {
                 const x = node.pos.x - node.width / 2;
                 const y = node.pos.y - node.height / 2;
                 if (isRectInView(x, y, node.width, node.height, viewRect)) {
                    drawCrown(node);
                }
            }
        }
        
        if (p5Rounds.length > 0) {
            drawSeparatorLineWithText(bracketBottomY + 20, "");
        }

        p.pop();
        
        const now = p.millis();
        let currentlyHoveredNode: VisualNode | null = null;
        if (!viewOffset) return;
        const adjustedMouseX = (p.mouseX - viewOffset.x) / viewScale;
        const adjustedMouseY = (p.mouseY - viewOffset.y) / viewScale;
        
        for (const round of p5Rounds) {
            for (const node of round) {
                if (node.playerId &&
                    adjustedMouseX > node.pos.x - node.width / 2 &&
                    adjustedMouseX < node.pos.x + node.width / 2 &&
                    adjustedMouseY > node.pos.y - node.height / 2 &&
                    adjustedMouseY < node.pos.y + node.height / 2
                ) {
                    currentlyHoveredNode = node;
                    break;
                }
            }
            if (currentlyHoveredNode) break;
        }
    
        if (currentlyHoveredNode) {
            if (hoveredNode !== currentlyHoveredNode) {
                hoveredNode = currentlyHoveredNode;
                hoverStartTime = now;
            }
        } else {
            hoveredNode = null;
        }
    
        if (hoveredNode && (now - hoverStartTime > HOVER_DELAY)) {
            const player = playerMap.get(hoveredNode.playerId!);
            let tooltipText = '';

            if (player) {
                if (sketchTournament.isCitiesTournament) {
                    const iconSize = 24;
                    const textPadding = 8;
                    const boxInternalPadding = 16;
                    const maxTextWidth = hoveredNode.width - iconSize - textPadding - boxInternalPadding;
                    const truncatedName = truncateText(player.gamertag, maxTextWidth);
                    const textW = p.textWidth(truncatedName);
                    const totalContentWidth = iconSize + textPadding + textW;
                    const contentStartX = hoveredNode.pos.x - totalContentWidth / 2;
                    
                    const iconX = contentStartX;
                    const iconY = hoveredNode.pos.y - iconSize / 2;

                    const isOverIcon = adjustedMouseX >= iconX && adjustedMouseX <= iconX + iconSize &&
                                     adjustedMouseY >= iconY && adjustedMouseY <= iconY + iconSize;

                    if (isOverIcon) {
                        if (player.icon.startsWith('asset:city:')) {
                            const cityId = player.icon.split(':')[2];
                            const city = sketchCities.find(c => c.id === cityId);
                            if (city) {
                                tooltipText = city.name;
                            }
                        }
                    } else {
                        if (player.discordOrIGN) {
                            tooltipText = player.discordOrIGN;
                        }
                    }
                } else {
                    if (player.discordOrIGN) {
                        tooltipText = player.discordOrIGN;
                    }
                }
            }
            
            if (tooltipText) {
                const tooltipX = p.mouseX + 15;
                const tooltipY = p.mouseY;
                
                p.push();
                p.textFont('Roboto');
                p.textSize(12);
                p.noStroke();
                const textW = p.textWidth(tooltipText);
                
                p.fill(0, 0, 10, 0.85);
                p.rect(tooltipX, tooltipY, textW + 12, 22, 4);
                
                p.fill(0, 0, 95);
                p.textAlign(p.LEFT, p.CENTER);
                p.text(tooltipText, tooltipX + 6, tooltipY + 11);
                p.pop();
            }
        }
      };
      
      const drawNeonLine = (p1: p5.Vector, p2: p5.Vector, col: p5.Color, weight: number) => {
        const p_drawingContext = p.drawingContext as CanvasRenderingContext2D;
        p_drawingContext.shadowBlur = 15;
        p_drawingContext.shadowColor = col.toString();
        p.stroke(col);
        p.strokeWeight(weight);
        p.line(p1.x, p1.y, p2.x, p2.y);

        p_drawingContext.shadowBlur = 0;
        p.strokeWeight(weight * 0.4);
        p.stroke(360, 0, 100, 0.8);
        p.line(p1.x, p1.y, p2.x, p2.y);
      };

      const drawBrackets = (view: {x: number, y: number, w: number, h: number}) => {
        for (let r = 1; r < p5Rounds.length; r++) {
          for (const node of p5Rounds[r]) {
            if (node.children.length < 2 || !node.children[0] || !node.children[1]) continue;
            const child1 = node.children[0];
            const child2 = node.children[1];
            if (child1.name === "BYE" && child2.name === "BYE") continue;

            const connectorMinX = child1.pos.x + child1.width / 2;
            const connectorMaxX = node.pos.x - node.width / 2;
            const connectorMinY = Math.min(child1.pos.y, child2.pos.y);
            const connectorMaxY = Math.max(child1.pos.y, child2.pos.y);
            if (!isRectInView(connectorMinX, connectorMinY, connectorMaxX - connectorMinX, connectorMaxY - connectorMinY, view, 10)) {
                continue;
            }

            const child1Right = child1.pos.x + child1.width / 2;
            const child2Right = child2.pos.x + child2.width / 2;
            const nodeLeft = node.pos.x - node.width / 2;
            const midX = (child1Right + nodeLeft) / 2;
            
            const connectorColor = node.state === 'decided' ? node.color : neutralColor;
            
            drawNeonLine(p.createVector(child1Right, child1.pos.y), p.createVector(midX, child1.pos.y), child1.color, 4);
            drawNeonLine(p.createVector(child2Right, child2.pos.y), p.createVector(midX, child2.pos.y), child2.color, 4);
            
            if (node.state === 'decided' && node.winner) {
                const winnerIsChild1 = node.winner === child1;
                const winnerChild = winnerIsChild1 ? child1 : child2;
                const loserChild = winnerIsChild1 ? child2 : child1;

                drawNeonLine(
                    p.createVector(midX, winnerChild.pos.y),
                    p.createVector(midX, node.pos.y),
                    winnerChild.color,
                    4
                );
                drawNeonLine(
                    p.createVector(midX, loserChild.pos.y),
                    p.createVector(midX, node.pos.y),
                    loserChild.color,
                    4
                );
            } else {
                drawNeonLine(
                    p.createVector(midX, child1.pos.y),
                    p.createVector(midX, child2.pos.y),
                    neutralColor,
                    4
                );
            }

            drawNeonLine(p.createVector(midX, node.pos.y), p.createVector(nodeLeft, node.pos.y), connectorColor, 4);
          }
        }
      };

      const drawNodes = (view: {x: number, y: number, w: number, h: number}) => {
        const p_drawingContext = p.drawingContext as CanvasRenderingContext2D;
        const iconSize = 24;
        const textPadding = 8;
        const boxInternalPadding = 16;
    
        for (const round of p5Rounds) {
            for (const node of round) {
                const x = node.pos.x - node.width / 2;
                const y = node.pos.y - node.height / 2;
                
                if (!isRectInView(x, y, node.width, node.height, view)) {
                    continue;
                }

                const col = (node.round > 0 && node.state !== 'decided') ? neutralColor : node.color;
                
                p.noStroke();
    
                p_drawingContext.shadowBlur = 15;
                p_drawingContext.shadowColor = col.toString();
                p.fill(col); 
                p.rect(x, y, node.width, node.height, 8);
                p_drawingContext.shadowBlur = 0;
    
                p.fill(360, 0, 100, 0.9);
                p.rect(x + 1, y + 1, node.width - 2, node.height - 2, 7);
    
                p.fill(15, 85, 5, 0.95);
                p.rect(x + 2.5, y + 2.5, node.width - 5, node.height - 5, 6);
    
                if (node.name) {
                    p.textSize(14);
                    p.noStroke();
                    
                    const hasIcon = node.iconImage && node.iconImage.width > 1;
                    const textColor = node.color;
                    let textContent: string;

                    if (hasIcon) {
                        const maxTextWidth = node.width - iconSize - textPadding - boxInternalPadding;
                        textContent = truncateText(node.name, maxTextWidth);
                        const textW = p.textWidth(textContent);
                        const totalContentWidth = iconSize + textPadding + textW;
                        const contentStartX = node.pos.x - totalContentWidth / 2;
                        
                        p.image(node.iconImage!, contentStartX, node.pos.y - iconSize / 2, iconSize, iconSize);
                        p.fill(textColor);
                        p.textAlign(p.LEFT, p.CENTER);
                        p.text(textContent, contentStartX + iconSize + textPadding, node.pos.y);
                    } else {
                        const maxTextWidth = node.width - boxInternalPadding;
                        textContent = truncateText(node.name, maxTextWidth);
                        p.fill(textColor);
                        p.textAlign(p.CENTER, p.CENTER);
                        p.text(textContent, node.pos.x, node.pos.y);
                    }
                }
            }
        }
      };
      
      const drawCrown = (node: VisualNode) => {
        if (!node.hasCrown) return;
    
        p.push();
        const crownHeight = 25;
        const crownWidth = 35;
        const crownBaseY = node.pos.y - node.height / 2 - 15;
        p.translate(node.pos.x, crownBaseY);
    
        let col: p5.Color;
        let weight: number;
        let glow: number;
    
        const p_drawingContext = p.drawingContext as CanvasRenderingContext2D;
        const goldColor = p.color(45, 80, 100);
        const dimGoldColor = p.color(45, 50, 60);

        if (node.crownState === 'off') {
            col = p.color(0, 0, 30);
            weight = 1.5;
            glow = 0;
        } else if (node.crownState === 'animating') {
            const progress = p.constrain((p.millis() - node.crownAnimationStart) / 3000, 0, 1);
            if (progress >= 1) {
                node.crownState = 'on';
                node.flickerCountdown = p.random(120, 240);
            }
            
            const flickerChance = p.pow(progress, 0.5);
            if (p.random() < flickerChance) {
                col = goldColor;
                weight = 2;
                glow = 15;
            } else {
                col = dimGoldColor;
                weight = 1.5;
                glow = 5;
            }
        } else { // 'on' state
            if (node.isFlickering) {
                node.flickerDuration--;
                if (node.flickerDuration <= 0) {
                    node.isFlickering = false;
                    node.flickerCountdown = p.random(120, 300);
                }
                col = dimGoldColor;
                weight = 1.5;
                glow = 8;
            } else {
                node.flickerCountdown--;
                if (node.flickerCountdown <= 0) {
                    node.isFlickering = true;
                    node.flickerDuration = p.random(2, 5);
                }
                col = goldColor;
                weight = 2;
                glow = 15;
            }
        }
    
        p_drawingContext.shadowBlur = glow;
        p_drawingContext.shadowColor = col.toString();
        p.stroke(col);
        p.fill(col);
        p.strokeWeight(1);
        p.strokeJoin(p.ROUND);
        
        const w = crownWidth;
        const h = crownHeight;
        const circleR = 2.5;
        
        p.beginShape();
        p.vertex(-w/2, 0);
        p.vertex(w/2, 0);
        p.vertex(w/2, -h * 0.5);
        p.vertex(w*0.375, -h * 0.4);
        p.vertex(w*0.25, -h * 0.75);
        p.vertex(w*0.125, -h * 0.6);
        p.vertex(0, -h);
        p.vertex(-w*0.125, -h * 0.6);
        p.vertex(-w*0.25, -h * 0.75);
        p.vertex(-w*0.375, -h * 0.4);
        p.vertex(-w/2, -h * 0.5);
        p.endShape(p.CLOSE);
        
        p.ellipse(0, -h - circleR, circleR * 2, circleR * 2);
        p.ellipse(w*0.25, -h * 0.75 - circleR, circleR * 2, circleR * 2);
        p.ellipse(-w*0.25, -h * 0.75 - circleR, circleR * 2, circleR * 2);
        p.ellipse(w/2, -h * 0.5 - circleR, circleR * 2, circleR * 2);
        p.ellipse(-w/2, -h * 0.5 - circleR, circleR * 2, circleR * 2);
        
        if (glow > 0) {
            p_drawingContext.shadowBlur = 0;
            p.noFill();
            p.strokeWeight(weight * 0.5);
            p.stroke(360, 0, 100, 0.8);

            p.beginShape();
            p.vertex(-w/2, 0);
            p.vertex(w/2, 0);
            p.vertex(w/2, -h * 0.5);
            p.vertex(w*0.375, -h * 0.4);
            p.vertex(w*0.25, -h * 0.75);
            p.vertex(w*0.125, -h * 0.6);
            p.vertex(0, -h);
            p.vertex(-w*0.125, -h * 0.6);
            p.vertex(-w*0.25, -h * 0.75);
            p.vertex(-w*0.375, -h * 0.4);
            p.vertex(-w/2, -h * 0.5);
            p.endShape(p.CLOSE);

            p.ellipse(0, -h - circleR, circleR * 2, circleR * 2);
            p.ellipse(w*0.25, -h * 0.75 - circleR, circleR * 2, circleR * 2);
            p.ellipse(-w*0.25, -h * 0.75 - circleR, circleR * 2, circleR * 2);
            p.ellipse(w/2, -h * 0.5 - circleR, circleR * 2, circleR * 2);
            p.ellipse(-w/2, -h * 0.5 - circleR, circleR * 2, circleR * 2);
        }
        
        p.pop();
      };

      p.mouseClicked = () => {
        if (isModalOpenForSketch) return;
        if (!p._renderer || isRemoved || animation.isAnimating) return;
        if (!previousMouse || p.createVector(p.mouseX, p.mouseY).dist(previousMouse) > 5) return;
        handleClickOrTap(p.mouseX, p.mouseY);
      };

      p.mousePressed = () => {
        if (isModalOpenForSketch) return;
        if (!p._renderer || isRemoved || animation.isAnimating) return;
        if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
          isDragging = true;
          previousMouse.set(p.mouseX, p.mouseY);
          p.cursor('grabbing');
        }
      };

      p.mouseDragged = () => {
        if (isModalOpenForSketch) return;
        if (!p._renderer || isRemoved || animation.isAnimating) return;
        if(isDragging && previousMouse && viewOffset) {
          const currentMouse = p.createVector(p.mouseX, p.mouseY);
          const delta = p5.Vector.sub(currentMouse, previousMouse);
          viewOffset.add(delta);
          previousMouse.set(currentMouse.x, currentMouse.y);
        }
      };

      p.mouseReleased = () => {
        if (isModalOpenForSketch) return;
        if (!p._renderer || isRemoved || animation.isAnimating) return;
        isDragging = false;
        p.cursor('grab');
      };
      
      p.mouseWheel = (event: WheelEvent) => {
        if (isModalOpenForSketch) return;
        if (!p._renderer || isRemoved || animation.isAnimating) return;
        if (!viewOffset || p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;
        event.preventDefault();

        const scrollDelta = -event.deltaY;
        const zoomFactor = 1.05;
        const oldScale = viewScale;

        viewScale = p.constrain(scrollDelta > 0 ? viewScale * zoomFactor : viewScale / zoomFactor, MIN_SCALE, MAX_SCALE);
        
        const mouseWorldBefore = p.createVector((p.mouseX - viewOffset.x) / oldScale, (p.mouseY - viewOffset.y) / oldScale);
        viewOffset.x = p.mouseX - mouseWorldBefore.x * viewScale;
        viewOffset.y = p.mouseY - mouseWorldBefore.y * viewScale;
        
        return false;
      };

      p.touchStarted = () => {
        if (isModalOpenForSketch) return true;
        if (!p._renderer || isRemoved || animation.isAnimating) return false;
        
        const touches = p.touches as any[];
        
        isPageScrolling = false;
        touchMoveDecided = false;

        if (touches.length === 2) {
            isDragging = false;
            initialPinchDistance = p.dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y);
        } else if (touches.length === 1) {
            isDragging = true;
            previousMouse.set(touches[0].x, touches[0].y);
            touchStartPos = p.createVector(touches[0].x, touches[0].y);
        }
      };

      p.touchMoved = () => {
        if (isModalOpenForSketch) return true;
        if (!p._renderer || isRemoved || animation.isAnimating) return false;

        const touches = p.touches as any[];

        if (touches.length === 2) {
            touchMoveDecided = true;
            isPageScrolling = false;
            isDragging = false;
            const currentPinchDistance = p.dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y);
            
            if (initialPinchDistance > 0) {
              const zoomAmount = currentPinchDistance / initialPinchDistance;
              const oldScale = viewScale;
              viewScale = p.constrain(viewScale * zoomAmount, MIN_SCALE, MAX_SCALE);

              const pinchCenterScreen = p.createVector((touches[0].x + touches[1].x) / 2, (touches[0].y + touches[1].y) / 2);
              const mouseWorldBefore = p.createVector(
                  (pinchCenterScreen.x - viewOffset.x) / oldScale,
                  (pinchCenterScreen.y - viewOffset.y) / oldScale
              );

              viewOffset.x = pinchCenterScreen.x - mouseWorldBefore.x * viewScale;
              viewOffset.y = pinchCenterScreen.y - mouseWorldBefore.y * viewScale;
            }
            initialPinchDistance = currentPinchDistance;
            return false;
        }

        if (touches.length === 1 && isDragging) {
            const currentPos = p.createVector(touches[0].x, touches[0].y);

            if (!touchMoveDecided && touchStartPos) {
                const distMoved = p5.Vector.dist(touchStartPos, currentPos);

                if (distMoved > SCROLL_LOCK_THRESHOLD) {
                    touchMoveDecided = true;
                    const delta = p5.Vector.sub(currentPos, touchStartPos);
                    if (Math.abs(delta.y) > Math.abs(delta.x)) {
                        isPageScrolling = true;
                    } else {
                        isPageScrolling = false;
                    }
                }
            }
            
            if (touchMoveDecided) {
                if (isPageScrolling) {
                    return true; 
                } else {
                    const delta = p5.Vector.sub(currentPos, previousMouse);
                    viewOffset.add(delta);
                    previousMouse.set(currentPos.x, currentPos.y);
                    return false;
                }
            }
            
            return false;
        }
        
        return false;
      };

      p.touchEnded = () => {
        if (isModalOpenForSketch) return true;
        if (!p._renderer || isRemoved || animation.isAnimating) return false;

        const touches = p.touches as any[];
        
        if (touchStartPos && touches.length === 0) {
            const touchEndPos = previousMouse;
            if (touchStartPos.dist(touchEndPos) < 10 && !isPageScrolling) {
                handleClickOrTap(touchStartPos.x, touchStartPos.y);
            }
        }
        
        touchStartPos = null;
        isDragging = false;
        isPageScrolling = false;
        touchMoveDecided = false;
        initialPinchDistance = 0;

        if (touches.length > 0) {
            if (touches.length === 1) {
                isDragging = true;
                previousMouse.set(touches[0].x, touches[0].y);
                touchStartPos = p.createVector(touches[0].x, touches[0].y);
            }
        }
        return false;
      };

      p.windowResized = () => {
        if (!p._renderer || isRemoved) return;
        p.resizeCanvas(parentDiv.offsetWidth, parentDiv.offsetHeight);
        calculatePositions();
      };
      
      (p as any).updateData = (newTournament: Tournament, newCities: City[], newIsModalOpen: boolean) => {
        if (isRemoved) return;
        sketchTournament = newTournament;
        sketchCities = newCities;
        isModalOpenForSketch = newIsModalOpen;
        playerMap = new Map<string, Player>(sketchTournament.players.map(pl => [pl.id, pl]));
        createBracketStructure();
        calculatePositions();
        calculateBracketBounds();
        generatePulseWave();
      };

      (p as any).focusOnPlayer = (playerId: string) => {
        if (animation.isAnimating) return;
        const playerNode = p5Rounds[0]?.find(node => node.playerId === playerId);
        if (!playerNode) return;

        animation.isAnimating = true;
        animation.phase = 'zoom-out';
        animation.startTime = p.millis();
        animation.startScale = viewScale;
        animation.startOffset = viewOffset.copy();
        animation.targetNode = playerNode;

        const bracketWidth = bracketRightX - bracketLeftX;
        const bracketHeight = bracketBottomY - bracketTopY;
        const scaleX = p.width / bracketWidth;
        const scaleY = p.height / bracketHeight;
        animation.endScale = p.constrain(Math.min(scaleX, scaleY) * 0.9, MIN_SCALE, MAX_SCALE);

        const bracketCenterX = bracketLeftX + bracketWidth / 2;
        const bracketCenterY = bracketTopY + bracketHeight / 2;
        animation.endOffset = p.createVector(
            p.width / 2 - bracketCenterX * animation.endScale,
            p.height / 2 - bracketCenterY * animation.endScale
        );
      };
    };

    p5Instance = new p5(sketch, parentDiv) as any;
    p5InstanceRef.current = p5Instance;

    return () => {
      isRemoved = true;
      if (p5Instance) {
          p5Instance.remove();
      }
      p5InstanceRef.current = null;
    };
  }, [onReportScore]); 

  return <div ref={sketchRef} className={`w-full h-[80vh] rounded-lg border border-slate-700 overflow-hidden ${isModalOpen ? 'pointer-events-none' : ''}`} />;
});

export default SingleEliminationBracket;