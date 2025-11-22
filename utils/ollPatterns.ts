
import * as THREE from 'three';
import { CubieState } from '../types';
import { isEdge, isCorner } from './phaseEngine';

// --- PRESERVED ALGORITHMS FOR BOTS/FUTURE USE ---
// DO NOT DELETE: These dictionaries are required for automated solving logic.
export const OLL_ALGORITHMS: Record<string, string> = {
  // Edge Orientation
  "Dot": "F R U R' U' F' f R U R' U' f'",
  "L-Shape": "F R U R' U' F'",
  "Line": "f R U R' U' f'",
  
  // Corner Orientation
  "Sune": "R U R' U R U2 R'",
  "Anti-Sune": "R U2 R' U' R U' R'",
  "H": "R U R' U R U' R' U R U2 R'",
  "Pi": "R U2 R2 U' R2 U' R2 U2 R",
  "U": "R2 D R' U2 R D' R' U2 R'",
  "T": "r U R' U' r' F R F'",
  "L": "F R' F' r U R U' r'" 
};
// ------------------------------------------------

// Robust Semantic OLL Identification
// This approach analyzes the geometric relationship of pieces rather than matching rigid grid patterns.

export const identify2LookOLL = (
  topPieces: CubieState[], 
  topCenter: CubieState
): string | undefined => {
  
  const up = new THREE.Vector3(...topCenter.initialPosition).normalize().applyQuaternion(topCenter.quaternion);
  
  const edges = topPieces.filter(isEdge);
  const corners = topPieces.filter(isCorner);
  
  // --- Step 1: Analyze Edge Orientation ---
  // Check if edges are oriented (yellow up)
  const orientedEdges = edges.filter(e => {
      const localUp = new THREE.Vector3(...topCenter.initialPosition).normalize();
      const currentUp = localUp.applyQuaternion(e.quaternion);
      return currentUp.dot(up) > 0.9; // Parallel to center up
  });

  const edgeCount = orientedEdges.length;

  if (edgeCount < 4) {
      if (edgeCount === 0) return "Dot";
      if (edgeCount === 2) {
          // Check adjacency of the 2 oriented edges
          // If adjacent, distance between them is ~1.5 (diagonal on the 3x3 grid perimeter? No)
          // Center (0,0). Edges at (1,0), (0,1), (-1,0), (0,-1).
          // Adjacent dist = sqrt(1+1) = 1.414. Opposite dist = 2.
          const p1 = new THREE.Vector3(...orientedEdges[0].position);
          const p2 = new THREE.Vector3(...orientedEdges[1].position);
          const dist = p1.distanceTo(p2);
          
          return dist < 1.8 ? "L-Shape" : "Line";
      }
      // Odd number of edges oriented is impossible on valid cube, but might happen mid-turn
      return "Unknown";
  }

  // --- Step 2: Analyze Corner Orientation (OCLL) ---
  // All edges are oriented (Cross Solved). Now identifying the 7 Corner Cases.

  const orientedCorners = corners.filter(c => {
      const localUp = new THREE.Vector3(...topCenter.initialPosition).normalize();
      const currentUp = localUp.applyQuaternion(c.quaternion);
      return currentUp.dot(up) > 0.9;
  });

  const orientedCount = orientedCorners.length;
  const centerPos = new THREE.Vector3(...topCenter.position);

  // Helper: Get sticker normal for a corner
  const getStickerNormal = (c: CubieState) => {
      const localUp = new THREE.Vector3(...topCenter.initialPosition).normalize();
      return localUp.applyQuaternion(c.quaternion.clone());
  };

  // CASE: 0 Corners Oriented
  if (orientedCount === 0) {
      // Candidates: H (Headlights Front/Back), Pi (Headlights One Side, Outward Other)
      // Count "Headlight Pairs"
      // A Headlight Pair is two adjacent corners with sticker normals facing the same direction.
      
      let headlightPairs = 0;
      
      // Check all adjacent pairs
      for (let i = 0; i < corners.length; i++) {
          for (let j = i + 1; j < corners.length; j++) {
              const c1 = corners[i];
              const c2 = corners[j];
              
              // Check adjacency (dist approx 2, diagonal is 2.8)
              if (new THREE.Vector3(...c1.position).distanceTo(new THREE.Vector3(...c2.position)) > 2.2) continue;

              const n1 = getStickerNormal(c1);
              const n2 = getStickerNormal(c2);
              
              // Parallel normals? (Headlights)
              if (n1.dot(n2) > 0.9) {
                  headlightPairs++;
              }
          }
      }

      // Note: In 'H' case, we have 2 pairs (Front/Back).
      // In 'Pi' case, we have 1 pair.
      if (headlightPairs >= 2) return "H"; // Often returns 2
      if (headlightPairs === 1) return "Pi";
      
      return "Unknown"; // Should not happen for valid OCLL
  }

  // CASE: 1 Corner Oriented
  if (orientedCount === 1) {
      // Candidates: Sune, Anti-Sune
      // Distinction: Look at the CW neighbor of the oriented corner.
      // If neighbor is twisted CW -> Sune.
      // If neighbor is twisted CCW -> Anti-Sune.

      const orientedC = orientedCorners[0];
      const oPosRel = new THREE.Vector3(...orientedC.position).sub(centerPos);
      
      // Find CW Neighbor
      // Tangent = Up x oPosRel
      const tangentCW = new THREE.Vector3().crossVectors(up, oPosRel).normalize();
      
      // Neighbor is the corner that aligns best with TangentCW
      let neighbor: CubieState | null = null;
      let maxDot = -Infinity;
      
      corners.forEach(c => {
          if (c.id === orientedC.id) return;
          const cPosRel = new THREE.Vector3(...c.position).sub(centerPos).normalize();
          const dot = cPosRel.dot(tangentCW);
          if (dot > maxDot) {
              maxDot = dot;
              neighbor = c;
          }
      });

      if (neighbor) {
          // Determine twist of neighbor
          const nPosRel = new THREE.Vector3(...neighbor.position).sub(centerPos);
          const nSticker = getStickerNormal(neighbor);
          
          // Twist calculation: (Pos x Sticker) . Up
          // If > 0: CW. If < 0: CCW.
          const cross = new THREE.Vector3().crossVectors(nPosRel, nSticker);
          const twistVal = cross.dot(up);
          
          return twistVal > 0 ? "Sune" : "Anti-Sune";
      }
  }

  // CASE: 2 Corners Oriented
  if (orientedCount === 2) {
      // Candidates: U (Headlights), T (Chameleon), L (Diagonal)
      
      // Check Adjacency of Oriented Corners
      const p1 = new THREE.Vector3(...orientedCorners[0].position);
      const p2 = new THREE.Vector3(...orientedCorners[1].position);
      const dist = p1.distanceTo(p2);
      
      // If distance > 2.2, they are diagonal -> L Case
      if (dist > 2.2) return "L";

      // Adjacent. Now check the UNORIENTED corners.
      const unoriented = corners.filter(c => !orientedCorners.includes(c));
      if (unoriented.length !== 2) return "Unknown";

      const n1 = getStickerNormal(unoriented[0]);
      const n2 = getStickerNormal(unoriented[1]);
      
      // Dot product of normals
      // Parallel (> 0.9) -> Headlights -> U Case
      // Opposite/Outward ( < -0.5? Or just not parallel?) -> T Case
      // Note: T case stickers face opposite directions (left/right). Dot product approx -1 if aligned 180, or just different.
      // Actually in T case, they point away from each other.
      
      if (n1.dot(n2) > 0.8) return "U";
      return "T";
  }

  return "Unknown";
};
