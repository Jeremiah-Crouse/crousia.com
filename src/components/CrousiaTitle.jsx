// CrousiaTitle.jsx
import { Canvas } from '@react-three/fiber'
import { Environment, Text3D } from '@react-three/drei'
import { Suspense } from 'react'

export default function CrousiaTitle() {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 45 }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />

        <Text3D
          font="/fonts/Georgia_Regular.json"
          size={1.5}
          height={0.4}
          bevelEnabled
          bevelSize={0.05}
          bevelThickness={0.1}
        >
          CROUSIA
          <meshStandardMaterial
            metalness={1}
            roughness={0.2}
            color="#d4af37"
          />
        </Text3D>

        <Environment preset="sunset" />
      </Suspense>
    </Canvas>
  )
}
