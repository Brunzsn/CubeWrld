
import * as THREE from 'three';

export type Vector3Arr = [number, number, number];

export interface CubieState {
  id: number;
  initialPosition: Vector3Arr; // Used to determine piece type and sticker colors
  position: Vector3Arr; // Logical position (x, y, z) where each is -1, 0, or 1
  rotation: Vector3Arr; // Euler angles
  quaternion: THREE.Quaternion; // Track accumulated rotation
}

export interface Move {
  axis: 'x' | 'y' | 'z';
  slice: number[]; // Changed to array to support wide/multi-slice moves
  direction: number; // 1 (90), -1 (-90), 2 (180), -2 (-180)
}

export const COLORS = {
  U: '#ffffff', // Up - White
  D: '#ffd500', // Down - Yellow
  L: '#ff5800', // Left - Orange
  R: '#b71234', // Right - Red
  F: '#009b48', // Front - Green
  B: '#0046ad', // Back - Blue
  CORE: '#101010', // Dark Plastic
};

export type Phase = 'Scrambled' | 'Cross' | 'F2L' | 'OLL' | 'PLL' | 'Solved';

export interface AnalysisResult {
  phase: Phase;
  baseColor: string | null; // Hex color of the base face being solved
  isSolved: boolean;
  f2lTag?: 'First Layer' | 'Second Layer';
  missingCount?: number;
  ollCase?: string;
  pllCase?: string;
}
