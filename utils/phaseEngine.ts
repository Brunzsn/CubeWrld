import * as THREE from 'three';
import { CubieState, AnalysisResult, Phase, COLORS } from '../types';
import { identify2LookOLL } from './ollPatterns';
import { identifyPLL } from './pllPatterns';

const POS_EPSILON = 0.5; 
const ROT_EPSILON = 0.5; 

// --- Helper Functions for Piece Identification ---

export const isCenter = (c: CubieState) => Math.abs(c.initialPosition[0]) + Math.abs(c.initialPosition[1]) + Math.abs(c.initialPosition[2]) === 1;
export const isEdge = (c: CubieState) => Math.abs(c.initialPosition[0]) + Math.abs(c.initialPosition[1]) + Math.abs(c.initialPosition[2]) === 2;
export const isCorner = (c: CubieState) => Math.abs(c.initialPosition[0]) + Math.abs(c.initialPosition[1]) + Math.abs(c.initialPosition[2]) === 3;

// --- Core Analysis Logic ---

// Check if a piece is in the correct position AND orientation relative to a reference center.
export const isCorrectlyPlaced = (piece: CubieState, center: CubieState) => {
  const vInit = new THREE.Vector3().subVectors(
      new THREE.Vector3(...center.initialPosition),
      new THREE.Vector3(...piece.initialPosition)
  );

  const vCurr = new THREE.Vector3().subVectors(
      new THREE.Vector3(...center.position),
      new THREE.Vector3(...piece.position)
  );

  const invPieceQ = piece.quaternion.clone().invert();
  const vCurrLocal = vCurr.applyQuaternion(invPieceQ);

  const dist = vCurrLocal.distanceTo(vInit);
  
  return dist < 0.2;
};

// Check OLL Orientation: Is the piece's "Top" sticker pointing in the same direction as the Center's "Top" sticker?
export const isOrientedForOLL = (piece: CubieState, topCenter: CubieState) => {
  const localUp = new THREE.Vector3(...topCenter.initialPosition).normalize();
  
  const centerQ = topCenter.quaternion.clone().normalize();
  const centerUpWorld = localUp.clone().applyQuaternion(centerQ);

  const pieceQ = piece.quaternion.clone().normalize();
  const pieceUpWorld = localUp.clone().applyQuaternion(pieceQ);

  return centerUpWorld.angleTo(pieceUpWorld) < ROT_EPSILON;
};

export const analyzeCube = (cubies: CubieState[]): AnalysisResult => {
  const centers = cubies.filter(isCenter);
  const edges = cubies.filter(isEdge);
  const corners = cubies.filter(isCorner);

  let bestPhase: Phase = 'Scrambled';
  let bestBase: CubieState | null = null;
  let bestF2LTag: 'First Layer' | 'Second Layer' | undefined;
  let bestMissingCount: number | undefined;
  let bestOLLCase: string | undefined;
  let bestPLLCase: string | undefined;

  // Iterate through all centers to see which one is the potential "Base" being solved
  for (const center of centers) {
    // 1. Check CROSS
    const crossEdges = edges.filter(e => {
       const cVec = new THREE.Vector3(...center.initialPosition);
       const eVec = new THREE.Vector3(...e.initialPosition);
       return cVec.distanceTo(eVec) < 1.1; 
    });

    const isCrossSolved = crossEdges.every(e => isCorrectlyPlaced(e, center));

    if (!isCrossSolved) continue;

    let currentPhase: Phase = 'F2L';
    let f2lTag: 'First Layer' | 'Second Layer' | undefined;
    let missingCount: number | undefined;
    let ollCaseResult: string | undefined;
    let pllCaseResult: string | undefined;

    // 2. Check F2L Status
    const baseAxisIndex = center.initialPosition.findIndex(v => v !== 0);
    const baseCorners = corners.filter(c => {
        return Math.abs(c.initialPosition[baseAxisIndex] - center.initialPosition[baseAxisIndex]) < 0.1;
    });

    let solvedPairs = 0;
    let solvedCorners = 0;
    let solvedEdges = 0;

    for (const corner of baseCorners) {
        const isCornerSolved = isCorrectlyPlaced(corner, center);
        if (isCornerSolved) solvedCorners++;

        const edgeInitPos = [...corner.initialPosition];
        edgeInitPos[baseAxisIndex] = 0; 
        
        const edge = edges.find(e => 
            Math.abs(e.initialPosition[0] - edgeInitPos[0]) < 0.1 &&
            Math.abs(e.initialPosition[1] - edgeInitPos[1]) < 0.1 &&
            Math.abs(e.initialPosition[2] - edgeInitPos[2]) < 0.1
        );

        if (edge) {
            const isEdgeSolved = isCorrectlyPlaced(edge, center);
            if (isEdgeSolved) solvedEdges++;
            if (isCornerSolved && isEdgeSolved) solvedPairs++;
        }
    }

    if (solvedPairs === 4) {
        currentPhase = 'OLL';
        
        // 3. Check OLL
        const topCenter = centers.find(c => {
            const baseVec = new THREE.Vector3(...center.initialPosition);
            const cVec = new THREE.Vector3(...c.initialPosition);
            return baseVec.dot(cVec) < -0.9;
        });

        if (topCenter) {
            const topPieces = [...edges, ...corners].filter(p => {
                 const tVec = new THREE.Vector3(...topCenter.initialPosition);
                 const pVec = new THREE.Vector3(...p.initialPosition);
                 const axis = tVec.x !== 0 ? 0 : tVec.y !== 0 ? 1 : 2;
                 return Math.abs(pVec.getComponent(axis) - tVec.getComponent(axis)) < 0.1;
            });

            const isOLLSolved = topPieces.every(p => isOrientedForOLL(p, topCenter));
            
            if (isOLLSolved) {
                currentPhase = 'PLL';
                ollCaseResult = undefined; 

                // 4. Identify PLL Case
                pllCaseResult = identifyPLL(topPieces, topCenter);
                
                if (pllCaseResult === 'Solved') {
                    currentPhase = 'Solved';
                    pllCaseResult = undefined;
                }
            } else {
                ollCaseResult = identify2LookOLL(topPieces, topCenter);
            }
        }
    } else {
        if (solvedPairs >= 2) {
            f2lTag = undefined;
            missingCount = 4 - solvedPairs;
        } else if (solvedCorners === 4) {
            f2lTag = 'Second Layer';
            missingCount = 4 - solvedEdges;
        } else {
            f2lTag = 'First Layer';
            missingCount = 4 - solvedCorners;
        }
    }

    const phaseValue = { 'Scrambled': 0, 'Cross': 1, 'F2L': 2, 'OLL': 3, 'PLL': 4, 'Solved': 5 };
    
    let phaseRank = phaseValue[currentPhase] || 0;
    
    if (phaseRank > (phaseValue[bestPhase] || 0)) {
        bestPhase = currentPhase;
        bestBase = center;
        bestF2LTag = f2lTag;
        bestMissingCount = missingCount;
        bestOLLCase = ollCaseResult;
        bestPLLCase = pllCaseResult;
    } else if (phaseRank === (phaseValue[bestPhase] || 0) && currentPhase === 'F2L') {
         if ((missingCount || 0) < (bestMissingCount || 0)) {
            bestBase = center;
            bestF2LTag = f2lTag;
            bestMissingCount = missingCount;
         }
    }
  }

  let colorHex = null;
  if (bestBase) {
      const ip = bestBase.initialPosition;
      if (ip[1] === 1) colorHex = COLORS.U;
      else if (ip[1] === -1) colorHex = COLORS.D;
      else if (ip[0] === 1) colorHex = COLORS.R;
      else if (ip[0] === -1) colorHex = COLORS.L;
      else if (ip[2] === 1) colorHex = COLORS.F;
      else if (ip[2] === -1) colorHex = COLORS.B;
  }
  
  if (bestPhase === 'Scrambled') {
      return { phase: 'Cross', baseColor: null, isSolved: false };
  }

  return {
      phase: bestPhase,
      baseColor: colorHex,
      isSolved: bestPhase === 'Solved',
      f2lTag: bestF2LTag,
      missingCount: bestMissingCount,
      ollCase: bestOLLCase,
      pllCase: bestPLLCase
  };
};