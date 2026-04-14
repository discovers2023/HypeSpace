import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';

const Node = ({ position, label, color = "#7c3aed" }: { position: [number, number, number], label: string, color?: string }) => {
  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
      <group position={position}>
        <Sphere args={[0.2, 32, 32]}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.8} roughness={0.2} />
        </Sphere>
        <Text
          position={[0, 0.4, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/outfit/v11/Qdb74yL6Fcl_H_6X4Hw.woff"
        >
          {label}
        </Text>
      </group>
    </Float>
  );
};

const Connections = () => {
  const points = useMemo(() => [
    [0, 1.5, 0],   // Center/AI
    [-2, 0, 0],    // CRM 1
    [2, 0, 0],     // CRM 2
    [0, -1.5, 0],  // Campaigns
    [-1.5, 1, 0],  // Event 1
    [1.5, 1, 0],   // Event 2
  ], []);

  return (
    <group>
      <Node position={[0, 1.5, 0]} label="AI Engine" color="#ff00ff" />
      <Node position={[-2, 0, 0]} label="HubSpot" />
      <Node position={[2, 0, 0]} label="Salesforce" />
      <Node position={[0, -1.5, 0]} label="Campaigns" color="#3b82f6" />
      <Node position={[-1.5, 1, 0]} label="Virtual Meet" />
      <Node position={[1.5, 1, 0]} label="RSVP Tracker" />

      {/* Lines connecting everything to AI Engine */}
      {points.slice(1).map((p, i) => (
        <Line
          key={i}
          points={[[0, 1.5, 0], p as [number, number, number]]}
          color="#ffffff"
          lineWidth={0.5}
          transparent
          opacity={0.2}
        />
      ))}
    </group>
  );
};

export const ConnectiveNodes = () => {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas camera={{ position: [0, 0, 5], fov: 40 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Connections />
      </Canvas>
    </div>
  );
};
