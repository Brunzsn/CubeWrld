
import { useRef } from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Move } from '../types';

export const useCubeSwipe = (
  enabled: boolean, 
  triggerMove: (m: Move) => void, 
  controls: any
) => {
    const { camera, gl, size } = useThree();
    
    // Refs to track swipe state
    const ref = useRef<{ 
        start: THREE.Vector2; 
        faceNormal: THREE.Vector3 | null; 
        intersectPoint: THREE.Vector3 | null 
    }>({
        start: new THREE.Vector2(),
        faceNormal: null,
        intersectPoint: null,
    });

    const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
        if (!enabled) return;
        e.stopPropagation();
        
        // Disable camera controls while interacting with the cube
        if (controls?.current) controls.current.enabled = false;
        if ((controls as any)?.enabled !== undefined) (controls as any).enabled = false;

        // Capture pointer for dragging outside canvas bounds
        if (gl.domElement) {
            gl.domElement.setPointerCapture(e.pointerId);
        }

        if (!e.face?.normal) return;
        
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(e.object.matrixWorld);
        const worldNormal = e.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        
        // Snap normal to nearest axis to determine which face was clicked
        const axes = [
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
        ];
        
        let bestAxis = axes[0];
        let maxDot = -2;
        axes.forEach(axis => {
            const dot = axis.dot(worldNormal);
            if (dot > maxDot) { maxDot = dot; bestAxis = axis; }
        });

        ref.current.start.set(e.clientX, e.clientY);
        ref.current.faceNormal = bestAxis;
        ref.current.intersectPoint = e.point.clone();
    };

    const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
        // Re-enable camera controls
        if (controls?.current) controls.current.enabled = true;
        if ((controls as any)?.enabled !== undefined) (controls as any).enabled = true;
        
        if (gl.domElement) {
            gl.domElement.releasePointerCapture(e.pointerId);
        }

        if (!enabled || !ref.current.faceNormal || !ref.current.intersectPoint) return;

        const delta = new THREE.Vector2(e.clientX, e.clientY).sub(ref.current.start);
        if (delta.length() < 10) return; // Ignore small clicks/jitters

        const normal = ref.current.faceNormal!;
        const point = ref.current.intersectPoint!;

        // 1. Determine valid move axes (must be perpendicular to face normal)
        const cardinals = [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1)];
        const validAxes = cardinals.filter(c => Math.abs(c.dot(normal)) < 0.1);

        // 2. Project start point to screen space
        const startScreen = point.clone().project(camera);
        startScreen.x = (startScreen.x * 0.5 + 0.5) * size.width;
        startScreen.y = (1 - (startScreen.y * 0.5 + 0.5)) * size.height;

        let bestMoveVector: THREE.Vector3 | null = null;
        let maxAlignment = -1;
        let dragSign = 0;

        const dragDir = delta.clone().normalize();

        // 3. Compare drag direction with projected axes
        validAxes.forEach(axis => {
            const endWorld = point.clone().add(axis);
            const endScreen = endWorld.project(camera);
            endScreen.x = (endScreen.x * 0.5 + 0.5) * size.width;
            endScreen.y = (1 - (endScreen.y * 0.5 + 0.5)) * size.height;

            const screenVector = new THREE.Vector2(endScreen.x - startScreen.x, endScreen.y - startScreen.y).normalize();
            const dot = dragDir.dot(screenVector);

            if (Math.abs(dot) > maxAlignment) {
                maxAlignment = Math.abs(dot);
                bestMoveVector = axis;
                dragSign = Math.sign(dot);
            }
        });

        if (!bestMoveVector || maxAlignment < 0.5) return;

        const worldDragDir = bestMoveVector.clone().multiplyScalar(dragSign);
        
        // 4. Calculate Rotation Axis (Cross Product)
        const rotationAxisVec = new THREE.Vector3().crossVectors(normal, worldDragDir);

        let moveAxis: 'x' | 'y' | 'z' = 'x';
        let moveDirection = 1;

        if (Math.abs(rotationAxisVec.x) > 0.5) {
            moveAxis = 'x';
            moveDirection = Math.sign(rotationAxisVec.x);
        } else if (Math.abs(rotationAxisVec.y) > 0.5) {
            moveAxis = 'y';
            moveDirection = Math.sign(rotationAxisVec.y);
        } else {
            moveAxis = 'z';
            moveDirection = Math.sign(rotationAxisVec.z);
        }

        // 5. Determine Slice
        const sliceCoord = point[{x:'x', y:'y', z:'z'}[moveAxis] as 'x'|'y'|'z'];
        const slice = Math.round(sliceCoord);
        const clampedSlice = Math.max(-1, Math.min(1, slice));

        triggerMove({
            axis: moveAxis,
            slice: [clampedSlice],
            direction: moveDirection
        });

        ref.current.faceNormal = null;
        ref.current.intersectPoint = null;
    };

    return { onPointerDown, onPointerUp };
};
