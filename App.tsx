
import React, { useState, useCallback, useRef } from 'react';
import { Scene } from './components/Scene';
import { AnalysisResult, CubieState } from './types';
import { analyzeCube } from './utils/phaseEngine';

// Icons
const ScrambleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l14.2-13h2.1"/><path d="M2 5h1.6c1.3 0 2.5.6 3.3 1.7l6.3 6"/><path d="M2 12h2"/><path d="M22 19h-2.4c-1.3 0-2.5-.6-3.3-1.7l-3.8-3.5"/><path d="M22 5h-2.4c-1.3 0-2.5.6-3.3 1.7l-1.6 1.5"/><path d="M22 12h-2"/></svg>
);
const ResetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);
const HelpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
);
const ScanIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="2"/></svg>
);

export default function App() {
  const [isScrambling, setIsScrambling] = useState(false);
  const [scrambleCount, setScrambleCount] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingNotation, setPendingNotation] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult>({ phase: 'Cross', baseColor: null, isSolved: false });
  
  // Use ref to store latest cube state to avoid re-renders, 
  // only accessing it when analysis is requested.
  const cubiesRef = useRef<CubieState[]>([]);
  
  // Track user moves to trigger auto-analysis
  const moveCountRef = useRef(0);

  // Reusable analysis function
  const performAnalysis = useCallback(() => {
    if (cubiesRef.current.length === 0) return;
    const result = analyzeCube(cubiesRef.current);
    setAnalysis(result);
  }, []);

  const handleScramble = () => {
    if (isScrambling || pendingNotation) return;
    setScrambleCount(20);
    setIsScrambling(true);
    // Reset move count when starting a scramble
    moveCountRef.current = 0;
  };

  const handleScrambleMoveComplete = () => {
    if (scrambleCount > 1) {
      setScrambleCount(c => c - 1);
    } else {
      setIsScrambling(false);
      setScrambleCount(0);
      moveCountRef.current = 0;
      // Force a re-analysis when scramble is fully done to update UI from "Cross"
      setTimeout(performAnalysis, 50); 
    }
  };

  const handleReset = () => {
    setResetTrigger(prev => prev + 1);
    setIsScrambling(false);
    setScrambleCount(0);
    setPendingNotation(null);
    setAnalysis({ phase: 'Cross', baseColor: null, isSolved: false });
    moveCountRef.current = 0;
  };

  const handleNotationClick = (note: string) => {
    if (isScrambling || pendingNotation) return;
    setPendingNotation(note);
  };

  const handleCubeChange = useCallback((cubies: CubieState[]) => {
    cubiesRef.current = cubies;
    
    // Auto-detect phase every moves during gameplay (not scrambling)
    if (!isScrambling) {
        moveCountRef.current += 1;
        if (moveCountRef.current % 1 === 0) {
            performAnalysis();
        }
    }
  }, [isScrambling, performAnalysis]);

  // Keeps the manual callable function available
  const handlePhaseDetection = performAnalysis;

  // UI for Phase Display
  const getPhaseColor = (phase: string) => {
    switch(phase) {
      case 'Solved': return 'text-green-400';
      case 'Cross': return 'text-yellow-400';
      case 'F2L': return 'text-orange-400';
      case 'OLL': return 'text-blue-400';
      case 'PLL': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-900 text-white overflow-hidden flex">
      <div className="flex-1 relative h-full">
        <Scene 
          isScrambling={isScrambling} 
          onScrambleComplete={handleScrambleMoveComplete}
          resetTrigger={resetTrigger}
          pendingNotation={pendingNotation}
          onNotationComplete={() => setPendingNotation(null)}
          onCubeChange={handleCubeChange}
        />

        {/* Overlay UI */}
        <div className="absolute top-6 left-6 z-10 pointer-events-none">
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            RUBIK'S
            </h1>
            <p className="text-gray-400 text-sm font-medium mt-1 opacity-80">Interactive 3D Cube</p>
        </div>

        {/* Phase & Stats Panel */}
        <div className="absolute top-24 left-6 z-10 flex flex-col gap-3">
            <div className="bg-gray-900/60 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-xl min-w-[180px]">
               <div className="flex items-center justify-between mb-2">
                 <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Phase</div>
                 <button 
                    onClick={handlePhaseDetection}
                    disabled={isScrambling}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 text-[10px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                 >
                   <ScanIcon /> Detect
                 </button>
               </div>
               
               <div className={`text-2xl font-black ${getPhaseColor(analysis.phase)}`}>
                  {analysis.phase.toUpperCase()}
               </div>

               {/* OLL Case Display */}
               {analysis.phase === 'OLL' && analysis.ollCase && (
                   <div className="mt-1 text-sm font-bold text-blue-300 bg-blue-500/10 rounded px-2 py-1 border border-blue-500/20">
                       Case: {analysis.ollCase}
                   </div>
               )}

               {/* PLL Case Display */}
               {analysis.phase === 'PLL' && analysis.pllCase && (
                   <div className="mt-1 text-sm font-bold text-purple-300 bg-purple-500/10 rounded px-2 py-1 border border-purple-500/20">
                       Case: {analysis.pllCase}
                   </div>
               )}
               
               {/* F2L Detailed State */}
               {analysis.phase === 'F2L' && (
                 <div className="flex flex-col mt-1">
                    {analysis.f2lTag && (
                      <div className="text-xs font-bold text-blue-300">
                        {analysis.f2lTag.toUpperCase()}
                      </div>
                    )}
                    {typeof analysis.missingCount === 'number' && (
                      <div className="text-[10px] font-medium text-gray-400 mt-0.5">
                        {analysis.missingCount} {
                          analysis.f2lTag === 'First Layer' ? 'CORNERS' : 
                          analysis.f2lTag === 'Second Layer' ? 'EDGES' : 
                          'PAIRS'
                        } LEFT
                      </div>
                    )}
                 </div>
               )}

               {analysis.baseColor && (
                   <div className="mt-3 flex items-center gap-2">
                       <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Base</div>
                       <div 
                         className="w-4 h-4 rounded-full border border-white/20 shadow-inner" 
                         style={{ backgroundColor: analysis.baseColor }}
                       />
                   </div>
               )}
            </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 z-20">
            <button 
            onClick={handleScramble}
            disabled={isScrambling || !!pendingNotation}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all duration-200 backdrop-blur-md 
                ${isScrambling || pendingNotation
                ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed' 
                : 'bg-white/10 hover:bg-white/20 text-white hover:scale-105 active:scale-95 shadow-lg hover:shadow-blue-500/20'
                }`}
            >
            <ScrambleIcon />
            {isScrambling ? 'Scrambling...' : 'Scramble'}
            </button>

            <button 
            onClick={handleReset}
            disabled={isScrambling}
            className="flex items-center gap-2 px-6 py-3 rounded-full font-bold bg-white/10 hover:bg-white/20 text-white transition-all duration-200 backdrop-blur-md hover:scale-105 active:scale-95 shadow-lg hover:shadow-red-500/20"
            >
            <ResetIcon />
            Reset
            </button>
        </div>

        <div className="absolute top-6 right-20 z-20">
            <button 
            onClick={() => setShowHelp(!showHelp)}
            className="p-3 rounded-full bg-white/5 hover:bg-white/15 text-white transition-all"
            >
            <HelpIcon />
            </button>
        </div>

        {/* Help Modal */}
        {showHelp && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <h3 className="text-2xl font-bold mb-4 text-white">How to Play</h3>
                <ul className="space-y-3 text-gray-300 text-sm">
                <li className="flex items-start gap-3">
                    <span className="bg-blue-500/20 text-blue-400 rounded px-2 py-1 text-xs font-bold">ROTATE</span>
                    <span>Drag outside the cube to rotate the camera view.</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="bg-green-500/20 text-green-400 rounded px-2 py-1 text-xs font-bold">MOVE</span>
                    <span>Drag any face to rotate. Or use the sidebar notation controls.</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="bg-yellow-500/20 text-yellow-400 rounded px-2 py-1 text-xs font-bold">PHASES</span>
                    <span>Use the <b>DETECT</b> button to check your CFOP phase progress.</span>
                </li>
                </ul>
                <button 
                onClick={() => setShowHelp(false)}
                className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors"
                >
                Got it
                </button>
            </div>
            </div>
        )}
      </div>

      {/* Sidebar Notation Controls */}
      <div className="w-28 bg-gray-900/90 border-l border-white/10 flex flex-col items-center py-6 z-30 backdrop-blur-md shadow-2xl overflow-y-auto scrollbar-hide">
        <div className="text-xs font-bold text-gray-500 mb-4 tracking-widest">BASIC</div>
        <div className="flex flex-col gap-2 w-full px-2 mb-6">
            {['U', 'D', 'F', 'B', 'L', 'R'].map((face) => (
                <div key={face} className="grid grid-cols-3 gap-1 w-full">
                    <button
                        onClick={() => handleNotationClick(face)}
                        disabled={isScrambling || !!pendingNotation}
                        className="aspect-square flex items-center justify-center rounded bg-white/5 hover:bg-blue-500/20 text-gray-300 hover:text-blue-400 font-bold text-xs transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {face}
                    </button>
                    <button
                        onClick={() => handleNotationClick(face + "'")}
                        disabled={isScrambling || !!pendingNotation}
                        className="aspect-square flex items-center justify-center rounded bg-white/5 hover:bg-blue-500/20 text-gray-300 hover:text-blue-400 font-bold text-xs transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {face}'
                    </button>
                    <button
                        onClick={() => handleNotationClick(face + "2")}
                        disabled={isScrambling || !!pendingNotation}
                        className="aspect-square flex items-center justify-center rounded bg-white/5 hover:bg-blue-500/20 text-gray-300 hover:text-blue-400 font-bold text-xs transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {face}2
                    </button>
                </div>
            ))}
        </div>

        <div className="text-xs font-bold text-gray-500 mb-4 tracking-widest">SLICES</div>
        <div className="flex flex-col gap-2 w-full px-2 mb-6">
             {['M', 'E', 'S'].map((face) => (
                <div key={face} className="grid grid-cols-3 gap-1 w-full">
                    <button
                        onClick={() => handleNotationClick(face)}
                        disabled={isScrambling || !!pendingNotation}
                        className="aspect-square flex items-center justify-center rounded bg-white/5 hover:bg-purple-500/20 text-gray-300 hover:text-purple-400 font-bold text-xs transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {face}
                    </button>
                    <button
                        onClick={() => handleNotationClick(face + "'")}
                        disabled={isScrambling || !!pendingNotation}
                        className="aspect-square flex items-center justify-center rounded bg-white/5 hover:bg-purple-500/20 text-gray-300 hover:text-purple-400 font-bold text-xs transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {face}'
                    </button>
                    <button
                        onClick={() => handleNotationClick(face + "2")}
                        disabled={isScrambling || !!pendingNotation}
                        className="aspect-square flex items-center justify-center rounded bg-white/5 hover:bg-purple-500/20 text-gray-300 hover:text-purple-400 font-bold text-xs transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {face}2
                    </button>
                </div>
            ))}
        </div>

        <div className="text-xs font-bold text-gray-500 mb-4 tracking-widest">WIDE</div>
        <div className="flex flex-col gap-2 w-full px-2 mb-6">
             {['u', 'd', 'f', 'b', 'l', 'r'].map((face) => (
                <div key={face} className="grid grid-cols-3 gap-1 w-full">
                    <button
                        onClick={() => handleNotationClick(face)}
                        disabled={isScrambling || !!pendingNotation}
                        className="aspect-square flex items-center justify-center rounded bg-white/5 hover:bg-yellow-500/20 text-gray-300 hover:text-yellow-400 font-bold text-xs transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {face}
                    </button>
                    <button
                        onClick={() => handleNotationClick(face + "'")}
                        disabled={isScrambling || !!pendingNotation}
                        className="aspect-square flex items-center justify-center rounded bg-white/5 hover:bg-yellow-500/20 text-gray-300 hover:text-yellow-400 font-bold text-xs transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {face}'
                    </button>
                    <button
                        onClick={() => handleNotationClick(face + "2")}
                        disabled={isScrambling || !!pendingNotation}
                        className="aspect-square flex items-center justify-center rounded bg-white/5 hover:bg-yellow-500/20 text-gray-300 hover:text-yellow-400 font-bold text-xs transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {face}2
                    </button>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}