import React, { useState, useEffect, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { TrackballControls, Environment, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { CubeModel } from './CubeModel';
import { Move, CubieState } from '../types';
import { getNotationMove } from '../utils/cubeLogic';

interface SceneProps {
  isScrambling: boolean;
  onScrambleComplete: () => void;
  resetTrigger: number;
  pendingNotation: string | null;
  onNotationComplete: () => void;
  onCubeChange: (cubies: CubieState[]) => void;
}

// Helper component to handle Scene logic (Camera, Controls, Notation calculation)
const NotationController = ({ 
  notation, 
  onMoveDetermined
}: { 
  notation: string | null, 
  onMoveDetermined: (m: Move) => void
}) => {
   const { camera } = useThree();
   
   useEffect(() => {
      if(!notation) return;
      
      // Calculate move based on current camera perspective
      const move = getNotationMove(notation, camera);
      onMoveDetermined(move);
      
   }, [notation, onMoveDetermined, camera]);
   
   return null;
};

export const Scene: React.FC<SceneProps> = (props) => {
  const [activeMove, setActiveMove] = useState<Move | null>(null);

  const handleMoveDetermined = useCallback((move: Move) => {
    setActiveMove(current => {
      // Prevent duplicate state updates
      if (current && current.axis === move.axis && current.slice === move.slice && current.direction === move.direction) {
        return current;
      }
      return move;
    });
  }, []);

  const handleMoveComplete = () => {
    setActiveMove(null);
    props.onNotationComplete();
  };

  return (
    <div className="w-full h-full bg-gray-900">
      <Canvas camera={{ position: [4, 4, 6], fov: 50 }} shadows dpr={[1, 2]}>
        <color attach="background" args={['#111827']} />
        
        <ambientLight intensity={0.6} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="city" />

        <NotationController 
          notation={props.pendingNotation}
          onMoveDetermined={handleMoveDetermined}
        />

        <CubeModel 
          {...props} 
          moveCmd={activeMove}
          onMoveComplete={handleMoveComplete}
        />
        
        <TrackballControls 
            makeDefault
            noPan={true}
            minDistance={4} 
            maxDistance={15} 
            rotateSpeed={3}
            dynamicDampingFactor={0.9}
        />
      </Canvas>
    </div>
  );
};