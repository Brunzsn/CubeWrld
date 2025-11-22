
import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { CubieState, COLORS, Vector3Arr, Move } from '../types';
import { useCubeSwipe } from '../hooks/useCubeSwipe';
import { useCubeAnimation } from '../hooks/useCubeAnimation';

// --- Visual Helpers ---

// Center Sticker Shape (Squircle)
const createCenterShape = (size: number, radius: number) => {
    const s = size / 2;
    const shape = new THREE.Shape();
    const r = radius;
    
    shape.moveTo(-s + r, s);
    shape.lineTo(s - r, s);
    shape.quadraticCurveTo(s, s, s, s - r);
    shape.lineTo(s, -s + r);
    shape.quadraticCurveTo(s, -s, s - r, -s);
    shape.lineTo(-s + r, -s);
    shape.quadraticCurveTo(-s, -s, -s, -s + r);
    shape.lineTo(-s, s - r);
    shape.quadraticCurveTo(-s, s, -s + r, s);
    
    return shape;
};

// Edge Sticker Shape (Rounded at bottom corners)
const createEdgeShape = (size: number, radius: number) => {
  const s = size / 2;
  const shape = new THREE.Shape();
  // Start top-left (sharp)
  shape.moveTo(-s, s);
  // Top-right (sharp)
  shape.lineTo(s, s);
  // Bottom-right (rounded)
  shape.lineTo(s, -s + radius);
  shape.quadraticCurveTo(s, -s, s - radius, -s);
  // Bottom-left (rounded)
  shape.lineTo(-s + radius, -s);
  shape.quadraticCurveTo(-s, -s, -s, -s + radius);
  // Close
  shape.lineTo(-s, s);
  return shape;
};

// --- Visual Components ---

const Sticker: React.FC<{ 
  color: string; 
  pos: Vector3Arr; 
  rot: Vector3Arr; 
  type: 'center' | 'edge' | 'corner';
  edgeRotation?: number; 
}> = React.memo(({ color, pos, rot, type, edgeRotation = 0 }) => {
  
  const mat = useMemo(() => <meshStandardMaterial color={color} roughness={0.2} metalness={0.0} />, [color]);
  const thickness = 0.02;
  const size = 0.86;

  if (type === 'center') {
     const shape = useMemo(() => createCenterShape(size, 0.3), []); 
     const extrudeSettings = useMemo(() => ({ depth: thickness, bevelEnabled: false }), []);

     return (
        <group position={new THREE.Vector3(...pos)} rotation={new THREE.Euler(...rot)}>
             <mesh position={[0, 0, -thickness/2]}>
                <extrudeGeometry args={[shape, extrudeSettings]} />
                {mat}
             </mesh>
        </group>
     );
  } 
  
  if (type === 'edge') {
     const shape = useMemo(() => createEdgeShape(size, 0.2), []);
     const extrudeSettings = useMemo(() => ({ depth: thickness, bevelEnabled: false }), []);

     return (
        <group position={new THREE.Vector3(...pos)} rotation={new THREE.Euler(...rot)}>
             <mesh rotation={[0, 0, edgeRotation]} position={[0, 0, -thickness/2]}>
                <extrudeGeometry args={[shape, extrudeSettings]} />
                {mat}
             </mesh>
        </group>
     );
  }

  // Corner stickers (standard square)
  return (
    <mesh position={new THREE.Vector3(...pos)} rotation={new THREE.Euler(...rot)}>
      <boxGeometry args={[0.88, 0.88, thickness]} />
      {mat}
    </mesh>
  );
});

const Cubie: React.FC<CubieState> = React.memo(({ position, quaternion, initialPosition }) => {
  const absSum = Math.abs(initialPosition[0]) + Math.abs(initialPosition[1]) + Math.abs(initialPosition[2]);
  
  let type: 'center' | 'edge' | 'corner' = 'corner';
  if (absSum === 1) type = 'center';
  if (absSum === 2) type = 'edge';

  const getEdgeZRot = (faceAxis: 'x' | 'y' | 'z', faceDir: 1 | -1) => {
      if (type !== 'edge') return 0;
      
      const [cx, cy, cz] = initialPosition;
      
      let u = 0, v = 0;

      if (faceAxis === 'x' && faceDir === 1) { u = -cz; v = cy; }
      else if (faceAxis === 'x' && faceDir === -1) { u = cz; v = cy; }
      else if (faceAxis === 'y' && faceDir === 1) { u = cx; v = -cz; }
      else if (faceAxis === 'y' && faceDir === -1) { u = cx; v = cz; }
      else if (faceAxis === 'z' && faceDir === 1) { u = cx; v = cy; }
      else if (faceAxis === 'z' && faceDir === -1) { u = -cx; v = cy; }

      const targetAngle = Math.atan2(-v, -u);
      return targetAngle - (-Math.PI / 2);
  };

  const stickers = useMemo(() => {
      const s = [];
      const [x, y, z] = initialPosition;
      if (x === 1) s.push({ color: COLORS.R, pos: [0.49, 0, 0], rot: [0, Math.PI/2, 0], edgeRot: getEdgeZRot('x', 1) });
      if (x === -1) s.push({ color: COLORS.L, pos: [-0.49, 0, 0], rot: [0, -Math.PI/2, 0], edgeRot: getEdgeZRot('x', -1) });
      if (y === 1) s.push({ color: COLORS.U, pos: [0, 0.49, 0], rot: [-Math.PI/2, 0, 0], edgeRot: getEdgeZRot('y', 1) });
      if (y === -1) s.push({ color: COLORS.D, pos: [0, -0.49, 0], rot: [Math.PI/2, 0, 0], edgeRot: getEdgeZRot('y', -1) });
      if (z === 1) s.push({ color: COLORS.F, pos: [0, 0, 0.49], rot: [0, 0, 0], edgeRot: getEdgeZRot('z', 1) });
      if (z === -1) s.push({ color: COLORS.B, pos: [0, 0, -0.49], rot: [0, Math.PI, 0], edgeRot: getEdgeZRot('z', -1) });
      return s;
  }, [initialPosition, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const matProps = { color: COLORS.CORE, metalness: 0.3, roughness: 0.4 };

  let BaseMesh;
  if (type === 'center') {
    BaseMesh = (
      <RoundedBox args={[0.96, 0.96, 0.96]} radius={0.3} smoothness={4}>
        <meshStandardMaterial {...matProps} />
      </RoundedBox>
    );
  } else if (type === 'edge') {
    BaseMesh = (
      <RoundedBox args={[0.96, 0.96, 0.96]} radius={0.1} smoothness={4}>
        <meshStandardMaterial {...matProps} />
      </RoundedBox>
    );
  } else {
    BaseMesh = (
      <mesh>
        <boxGeometry args={[0.96, 0.96, 0.96]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
    );
  }

  return (
    <group position={new THREE.Vector3(...position)} quaternion={quaternion}>
      {BaseMesh}
      {stickers.map((s, i) => (
        <Sticker 
            key={i} 
            color={s.color} 
            pos={s.pos as Vector3Arr} 
            rot={s.rot as Vector3Arr} 
            type={type} 
            edgeRotation={s.edgeRot} 
        />
      ))}
    </group>
  );
});

// --- Main Composition ---

interface CubeModelProps {
  isScrambling: boolean;
  onScrambleComplete: () => void;
  resetTrigger: number;
  moveCmd: Move | null;
  onMoveComplete: () => void;
  onCubeChange?: (cubies: CubieState[]) => void;
}

export const CubeModel: React.FC<CubeModelProps> = (props) => {
  const { controls } = useThree();
  
  // Separate Animation Logic
  const { 
    staticGroup, 
    activeGroup, 
    groupRef, 
    triggerMove, 
    isAnimating 
  } = useCubeAnimation(props);

  // Separate Interaction Logic
  const swipeHandlers = useCubeSwipe(
    !isAnimating && !props.isScrambling, 
    triggerMove, 
    controls
  );

  return (
    <group {...swipeHandlers}>
      <group>
        {staticGroup.map((c) => (
            <Cubie key={c.id} {...c} />
        ))}
      </group>
      <group ref={groupRef}>
        {activeGroup.map((c) => (
            <Cubie key={c.id} {...c} />
        ))}
      </group>
    </group>
  );
};
