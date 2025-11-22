
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CubieState, Move, Vector3Arr } from '../types';
import { getInitialState } from '../utils/cubeLogic';

interface UseCubeAnimationProps {
  isScrambling: boolean;
  onScrambleComplete: () => void;
  resetTrigger: number;
  moveCmd: Move | null;
  onMoveComplete: () => void;
  onCubeChange?: (cubies: CubieState[]) => void;
}

export const useCubeAnimation = ({
  isScrambling,
  onScrambleComplete,
  resetTrigger,
  moveCmd,
  onMoveComplete,
  onCubeChange
}: UseCubeAnimationProps) => {
  const [cubies, setCubies] = useState<CubieState[]>(getInitialState());
  const [isAnimating, setIsAnimating] = useState(false);
  
  const groupRef = useRef<THREE.Group>(null);

  // Animation State
  const animRef = useRef({
    activeMove: null as Move | null,
    currentAngle: 0,
    targetAngle: Math.PI / 2,
    speed: 0.2,
    groupRotation: new THREE.Quaternion(),
  });

  // Reset Handler
  useEffect(() => {
    const initial = getInitialState();
    setCubies(initial);
    setIsAnimating(false);
    animRef.current.activeMove = null;
    if (onCubeChange) onCubeChange(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTrigger]);

  // Move Trigger
  const triggerMove = useCallback((move: Move, speedMultiplier: number = 1.0) => {
    if (animRef.current.activeMove) return;
    
    setIsAnimating(true);
    animRef.current.activeMove = move;
    animRef.current.currentAngle = 0;
    animRef.current.targetAngle = (Math.PI / 2) * move.direction;
    
    const isDouble = Math.abs(move.direction) === 2;
    // Adjust speed: Scrambling is fast, double moves are slightly faster
    animRef.current.speed = (isDouble ? 8.0 : 4.0) * speedMultiplier; 
    
    animRef.current.groupRotation.identity();
  }, []);

  // Handle External Commands (Notation)
  useEffect(() => {
    if (moveCmd && !isScrambling) {
        triggerMove(moveCmd);
    }
  }, [moveCmd, isScrambling, triggerMove]);

  // Scramble Loop Logic
  useEffect(() => {
    if (isScrambling && !animRef.current.activeMove) {
      const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
      // Include -1, 0, 1 for slice randomness
      const slices = [-1, 0, 1];
      const dirs: number[] = [1, -1, 2]; 
      
      const randomMove: Move = {
        axis: axes[Math.floor(Math.random() * axes.length)],
        slice: [slices[Math.floor(Math.random() * slices.length)]],
        direction: dirs[Math.floor(Math.random() * dirs.length)],
      };
      
      triggerMove(randomMove, 2.0); // 2x speed for scrambling
    }
  }, [isScrambling, isAnimating, triggerMove]); 

  // Animation Loop
  useFrame((_, delta) => {
    if (!isAnimating || !animRef.current.activeMove) return;
    
    const anim = animRef.current;
    const step = anim.speed * delta; 
    
    let finished = false;
    let newAngle = anim.currentAngle + (anim.targetAngle > 0 ? step : -step);

    // Clamp to target
    if ((anim.targetAngle > 0 && newAngle >= anim.targetAngle) || 
        (anim.targetAngle < 0 && newAngle <= anim.targetAngle)) {
      newAngle = anim.targetAngle;
      finished = true;
    }

    anim.currentAngle = newAngle;

    // Update Visual Group Rotation
    if (groupRef.current) {
      const { axis } = anim.activeMove!;
      groupRef.current.rotation.set(0, 0, 0);
      groupRef.current.rotation[axis] = newAngle;
      groupRef.current.updateMatrixWorld();
    }

    // Commit Move on Finish
    if (finished) {
      const move = anim.activeMove!;
      const angleRad = (Math.PI / 2) * move.direction;
      const axisVec = new THREE.Vector3(
          move.axis === 'x' ? 1 : 0, 
          move.axis === 'y' ? 1 : 0, 
          move.axis === 'z' ? 1 : 0
      );
      const rotQuat = new THREE.Quaternion().setFromAxisAngle(axisVec, angleRad);

      const newCubies = cubies.map(c => {
        const axisIndex = {x:0, y:1, z:2}[move.axis];
        
        // Support multi-slice moves (e.g., wide moves)
        if (!move.slice.includes(c.position[axisIndex])) return c;

        const pos = new THREE.Vector3(...c.position);
        pos.applyAxisAngle(axisVec, angleRad);
        const newPos: Vector3Arr = [Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)];

        const newQ = c.quaternion.clone().premultiply(rotQuat).normalize();

        return {
          ...c,
          position: newPos,
          quaternion: newQ
        };
      });

      setCubies(newCubies);
      setIsAnimating(false);
      anim.activeMove = null;
      
      if (onCubeChange) onCubeChange(newCubies);

      if (isScrambling) {
        onScrambleComplete();
      } else if (moveCmd) {
        onMoveComplete();
      }
    }
  });

  // Memoize groups to prevent re-renders of static pieces
  const { activeGroup, staticGroup } = useMemo(() => {
    const activeMove = animRef.current.activeMove;
    if (!activeMove) return { activeGroup: [], staticGroup: cubies };
    
    const active: CubieState[] = [];
    const stat: CubieState[] = [];
    const axisIndex = {x:0, y:1, z:2}[activeMove.axis];
    
    cubies.forEach(c => {
      if (activeMove.slice.includes(c.position[axisIndex])) {
        active.push(c);
      } else {
        stat.push(c);
      }
    });
    
    return { activeGroup: active, staticGroup: stat };
  }, [cubies, isAnimating]); // Depend on isAnimating to refresh groups when move starts/ends

  return {
    cubies,
    activeGroup,
    staticGroup,
    groupRef,
    triggerMove,
    isAnimating
  };
};
