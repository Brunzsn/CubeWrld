
import * as THREE from 'three';
import { CubieState, Vector3Arr, Move } from '../types';

// Helper to round position values to nearest integer (-1, 0, 1)
export const roundPos = (v: number) => Math.round(v);

export const getInitialState = (): CubieState[] => {
  const state: CubieState[] = [];
  let id = 0;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        state.push({
          id: id++,
          initialPosition: [x, y, z],
          position: [x, y, z],
          rotation: [0, 0, 0],
          quaternion: new THREE.Quaternion(),
        });
      }
    }
  }
  return state;
};

export const rotateVector = (vec: Vector3Arr, axis: 'x' | 'y' | 'z', direction: number): Vector3Arr => {
  const [x, y, z] = vec;
  
  // Handle 180 degree rotations
  if (Math.abs(direction) === 2) {
      if (axis === 'x') return [x, -y, -z].map(roundPos) as Vector3Arr;
      if (axis === 'y') return [-x, y, -z].map(roundPos) as Vector3Arr;
      if (axis === 'z') return [-x, -y, z].map(roundPos) as Vector3Arr;
  }

  // Handle 90 degree rotations
  const dir = direction as 1 | -1;
  if (axis === 'x') {
    return [x, dir * -z, dir * y].map(roundPos) as Vector3Arr;
  } else if (axis === 'y') {
    return [dir * z, y, dir * -x].map(roundPos) as Vector3Arr;
  } else {
    return [dir * -y, dir * x, z].map(roundPos) as Vector3Arr;
  }
};

export const getNotationMove = (notation: string, camera: THREE.Camera): Move => {
  const isPrime = notation.endsWith("'");
  const isDouble = notation.endsWith("2");
  const baseChar = notation[0];
  const baseUpper = baseChar.toUpperCase();
  
  let dirMult = 1;
  if (isPrime) dirMult = -1;
  else if (isDouble) dirMult = 2;

  // Determine mapping reference face
  // M follows L, E follows D, S follows F
  let targetFace = baseUpper;
  if (baseChar === 'M') targetFace = 'L';
  if (baseChar === 'E') targetFace = 'D';
  if (baseChar === 'S') targetFace = 'F';

  // Extract camera orientation basis vectors
  // Camera looks down its local -Z axis.
  // Local X = Right, Local Y = Up, Local Z = Back (towards viewer)
  const matrix = new THREE.Matrix4().copy(camera.matrixWorld);
  const right = new THREE.Vector3(matrix.elements[0], matrix.elements[1], matrix.elements[2]).normalize();
  const up = new THREE.Vector3(matrix.elements[4], matrix.elements[5], matrix.elements[6]).normalize();
  const back = new THREE.Vector3(matrix.elements[8], matrix.elements[9], matrix.elements[10]).normalize();

  let target: THREE.Vector3;
  // Map notation to visual direction vector
  switch(targetFace) {
      case 'F': target = back; break; // Front face points towards viewer
      case 'B': target = back.clone().negate(); break;
      case 'R': target = right; break;
      case 'L': target = right.clone().negate(); break;
      case 'U': target = up; break;
      case 'D': target = up.clone().negate(); break;
      default: target = back;
  }

  // Find best aligned global axis
  const globalAxes = [
      { axis: 'x', slice: 1, vec: new THREE.Vector3(1, 0, 0) },
      { axis: 'x', slice: -1, vec: new THREE.Vector3(-1, 0, 0) },
      { axis: 'y', slice: 1, vec: new THREE.Vector3(0, 1, 0) },
      { axis: 'y', slice: -1, vec: new THREE.Vector3(0, -1, 0) },
      { axis: 'z', slice: 1, vec: new THREE.Vector3(0, 0, 1) },
      { axis: 'z', slice: -1, vec: new THREE.Vector3(0, 0, -1) },
  ];

  let bestMatch = globalAxes[0];
  let maxDot = -Infinity;

  globalAxes.forEach(g => {
      const dot = g.vec.dot(target);
      if (dot > maxDot) {
          maxDot = dot;
          bestMatch = g;
      }
  });

  const { axis, slice } = bestMatch;

  // Resolve rotation direction
  // In a right-handed system (Three.js):
  // Looking at Positive Face (Slice 1) -> CW rotation is NEGATIVE angle (-1)
  // Looking at Negative Face (Slice -1) -> CW rotation is POSITIVE angle (1)
  // Therefore baseDir should always be negation of slice.
  const baseDir = -(slice as number);

  // Calculate final slices
  let finalSlices: number[] = [slice];
  
  if (['M', 'E', 'S'].includes(baseChar)) {
      finalSlices = [0];
  } else if (baseChar !== baseUpper) {
      // Lowercase -> Wide move (include center slice)
      finalSlices = [slice, 0];
  }

  const finalMove: Move = {
    axis: axis as 'x'|'y'|'z',
    slice: finalSlices,
    direction: (baseDir * dirMult)
  };

  return finalMove;
};
