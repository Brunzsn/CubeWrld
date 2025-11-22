
import * as THREE from 'three';
import { CubieState } from '../types';

export const PLL_ALGORITHMS: Record<string, string> = {
  "Diagonal": "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  "Headlights": "R U R' U' R' F R2 U' R' U' R U R' F'",
  "PLL (H)": "M2 U M2 U2 M2 U M2",
  "PLL (Ua)": "R U' R U R U R U' R' U' R2",
  "PLL (Ub)": "R2 U R U R' U' R' U' R' U R'",
  "PLL (Z)": "M' U M2 U M2 U M' U2 M2"
};

const isOppositeColor = (c1: string, c2: string) => {
   const pairs = [['U','D'], ['L','R'], ['F','B']];
   for (const p of pairs) {
       if ((c1 === p[0] && c2 === p[1]) || (c1 === p[1] && c2 === p[0])) return true;
   }
   return false;
};

// Helper to get the color of the sticker facing a specific world direction
const getStickerColor = (cubie: CubieState, direction: THREE.Vector3): string | null => {
    const localNormals = [
        { vec: new THREE.Vector3(1,0,0), color: 'R' },
        { vec: new THREE.Vector3(-1,0,0), color: 'L' },
        { vec: new THREE.Vector3(0,1,0), color: 'U' },
        { vec: new THREE.Vector3(0,-1,0), color: 'D' },
        { vec: new THREE.Vector3(0,0,1), color: 'F' },
        { vec: new THREE.Vector3(0,0,-1), color: 'B' },
    ];

    // 1. Filter to stickers that physically exist on this piece based on initial position
    const validNormals = localNormals.filter(n => {
        const p = cubie.initialPosition;
        // A sticker exists if the initial position matches the normal axis
        if (n.vec.x !== 0 && Math.round(p[0]) !== n.vec.x) return false;
        if (n.vec.y !== 0 && Math.round(p[1]) !== n.vec.y) return false;
        if (n.vec.z !== 0 && Math.round(p[2]) !== n.vec.z) return false;
        return true;
    });

    // 2. Find the sticker that is currently facing the requested direction
    let bestColor = null;
    let maxDot = 0.8; // Threshold for alignment

    for (const n of validNormals) {
        // Rotate normal by the piece's current rotation
        const worldNormal = n.vec.clone().applyQuaternion(cubie.quaternion);
        const dot = worldNormal.dot(direction);
        
        if (dot > maxDot) {
            maxDot = dot;
            bestColor = n.color;
        }
    }
    return bestColor;
};

// Local helpers to avoid circular deps
const isCorner = (c: CubieState) => Math.abs(c.initialPosition[0]) + Math.abs(c.initialPosition[1]) + Math.abs(c.initialPosition[2]) === 3;
const isEdge = (c: CubieState) => Math.abs(c.initialPosition[0]) + Math.abs(c.initialPosition[1]) + Math.abs(c.initialPosition[2]) === 2;

export const identifyPLL = (topPieces: CubieState[], topCenter: CubieState): string | undefined => {
    const up = new THREE.Vector3(...topCenter.initialPosition).normalize().applyQuaternion(topCenter.quaternion);
    
    // Find the 4 side directions (perpendicular to Up)
    const candidates = [
        new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
        new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0),
        new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)
    ];
    
    const sideDirs = candidates.filter(v => Math.abs(v.dot(up)) < 0.1);
    const corners = topPieces.filter(isCorner);
    const edges = topPieces.filter(isEdge);
    
    // Analyze each face to build a pattern signature
    const faces = sideDirs.map(dir => {
        const centerPos = new THREE.Vector3(...topCenter.position);
        
        // Find pieces on this face (position in direction 'dir' relative to center)
        const faceCorners = corners.filter(c => new THREE.Vector3(...c.position).sub(centerPos).dot(dir) > 0.5);
        const faceEdge = edges.find(e => new THREE.Vector3(...e.position).sub(centerPos).dot(dir) > 0.5);
        
        let c1: string | null = null;
        let c2: string | null = null;
        let e: string | null = null;

        // Get sticker colors facing this direction
        if (faceCorners.length === 2) {
            c1 = getStickerColor(faceCorners[0], dir);
            c2 = getStickerColor(faceCorners[1], dir);
        }
        if (faceEdge) {
            e = getStickerColor(faceEdge, dir);
        }

        return {
            dir,
            c1,
            c2,
            e,
            isHeadlights: (c1 && c2 && c1 === c2),
            isBar: (c1 && c2 && e && c1 === c2 && c1 === e)
        };
    });

    const headlightsCount = faces.filter(f => f.isHeadlights).length;
    const solvedBarsCount = faces.filter(f => f.isBar).length;

    // --- Detection Logic ---

    if (headlightsCount === 0) return "Diagonal";
    if (headlightsCount === 1) return "Headlights"; // Standard T, J, A, etc.
    
    // If 4 Headlights, we are in EPLL (H, Z, U) or Solved state.
    if (headlightsCount === 4) {
        
        // STRICT Solved Check: All faces must have matching Corner-Edge-Corner bars.
        if (solvedBarsCount === 4) return "Solved";

        // H vs Z Perm (Usually 0 bars, sometimes chance alignments if logic is loose, but strictly 0 bars for H/Z)
        if (solvedBarsCount === 0) {
            // Look at any face to distinguish H (Opposite Swap) from Z (Adjacent Swap)
            const face = faces.find(f => f.c1 && f.e);
            if (face && face.c1 && face.e) {
                return isOppositeColor(face.c1, face.e) ? "PLL (H)" : "PLL (Z)";
            }
            return "PLL (Z)"; // Fallback
        }

        // Ua vs Ub Perm (1 Bar Solved)
        if (solvedBarsCount === 1) {
            // Find the solved face (Back)
            const backFace = faces.find(f => f.isBar);
            
            if (backFace) {
                const backDir = backFace.dir;
                const frontDir = backDir.clone().negate();
                
                // Find Front Face (Opposite to Bar)
                const frontFace = faces.find(f => f.dir.dot(frontDir) > 0.9);
                
                // Find Right Face (relative to Front)
                // Right = Cross(Up, Front) assuming standard basis
                const rightDir = new THREE.Vector3().crossVectors(up, frontDir);
                const rightFace = faces.find(f => f.dir.dot(rightDir) > 0.9);

                if (frontFace && rightFace && frontFace.e && rightFace.c1) {
                    // Ua: Edge cycles Front -> Left -> Back -> Right -> Front?
                    // Standard Ua (Clockwise edges): Right Edge -> Front. Front Edge -> Left. Left Edge -> Right.
                    // Wait, standard Ua: R->F, F->L, L->R.
                    // So the piece AT Front comes FROM Right.
                    // So Front Edge Color == Right Face Color.
                    
                    // Note: rightFace.c1 is the corner color on the Right Face, which determines the Face Color.
                    return frontFace.e === rightFace.c1 ? "PLL (Ua)" : "PLL (Ub)";
                }
            }
            return "PLL (Ua)"; // Fallback
        }
        
        // Edge case: If we have 4 headlights but weird bar count (shouldn't happen in standard PLL), default to H/Z logic or Unknown
        return "PLL (Z)"; 
    }

    return "Unknown";
};
