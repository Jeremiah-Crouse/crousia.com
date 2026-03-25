import { Canvas, useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useRef, useLayoutEffect, useState, forwardRef, useMemo } from 'react'

function estimateTextAspect(text) {
  let totalWidth = 0
  let maxHeight = 0.7
  for (const char of text) {
    let w = 0.42
    if ("ilI1.,:;!'|".includes(char)) w = 0.2
    else if ("mwMW".includes(char)) w = 0.58
    else if (char === " ") w = 0.25
    else if (char === "🐍") w = 0.7
    else if (/[A-Z]/.test(char)) w = 0.5
    totalWidth += w
  }
  return totalWidth / maxHeight
}

function remToPx(rem) {
  return parseFloat(rem) * 16
}

export default function CrousianText({ text = "CROU🐍IA", size = 1, logo = false, nav = false, style = {}, ...props }) {
  const groupRef = useRef()
  const containerRef = useRef()

  const estimatedAspect = useMemo(() => estimateTextAspect(text), [text])

  const [ready, setReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [containerWidth, setContainerWidth] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [aspect, setAspect] = useState(estimatedAspect)

  // ✅ Reset ready state when text changes
  useLayoutEffect(() => {
    setReady(false)
  }, [text])

  // ✅ Watch container size (responsive)
  useLayoutEffect(() => {
    if (!containerRef.current) return

    const update = () => {
      setContainerWidth(containerRef.current.offsetWidth)
      setContainerHeight(containerRef.current.offsetHeight)
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  // ✅ Fit 3D text into container
  useLayoutEffect(() => {
    if (!groupRef.current || !ready) return

    const box = new THREE.Box3().setFromObject(groupRef.current)
    const sizeVec = new THREE.Vector3()
    box.getSize(sizeVec)
    
    if (scale !== 0) {
      sizeVec.divideScalar(scale)
    }

    if (sizeVec.x === 0 || sizeVec.y === 0) return

    const textAspect = sizeVec.x / sizeVec.y
    if (Math.abs(aspect - textAspect) > 0.01) {
      setAspect(textAspect)
    }

    const zoom = 120

    const fitW = containerWidth > 0 ? containerWidth / (sizeVec.x * zoom) : Infinity
    const fitH = containerHeight > 0 ? containerHeight / (sizeVec.y * zoom) : Infinity

    let newScale
    if (fitW !== Infinity && fitH !== Infinity) {
      newScale = Math.min(fitW, fitH)
    } else if (fitW !== Infinity) {
      newScale = fitW
    } else if (fitH !== Infinity) {
      newScale = fitH
    } else {
      newScale = 1
    }

    const minScale = 0.7
    if (newScale < minScale && !nav && !logo) {
      newScale = minScale
    }

    newScale *= size

    if (Math.abs(scale - newScale) > 0.001) {
      setScale(newScale)
    }
  }, [ready, containerWidth, containerHeight, text, size, aspect])

  const isNavSizing = nav && style.height && (style.width === undefined || style.width === 'auto')
  const heightPx = isNavSizing ? remToPx(style.height) : 0
  const calculatedWidth = isNavSizing ? `${heightPx * estimatedAspect}px` : (style.width || "100%")

  const containerStyle = {
    ...style,

    display: style.display || (nav ? "inline-block" : "block"),
    width: calculatedWidth,
  };

  return (
    <span
      ref={containerRef}
      style={containerStyle}
      {...props}
    >


      <Canvas
        orthographic
        camera={{ zoom: 120, position: [0, 0, 10] }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <MoltenGoldText
          ref={groupRef}
          text={text}
          scale={scale}
          onReady={() => setReady(true)}
        />
      </Canvas>
    </span>
  )
}


const MoltenGoldText = forwardRef(function MoltenGoldText({ text, scale, onReady }, ref) {
  const materialRefs = useRef([])

  useFrame((_, delta) => {
    materialRefs.current.forEach((mat) => {
      if (mat) mat.uniforms.uTime.value += delta
    })
  })

  const chars = [...text]
  let totalWidth = 0
  const positions = chars.map((char) => {
    let w = 0.42
    if ("ilI1.,:;!'|".includes(char)) w = 0.2
    else if ("mwMW".includes(char)) w = 0.58
    else if (char === " ") w = 0.25
    else if (char === "🐍") w = 0.7
    else if (/[A-Z]/.test(char)) w = 0.5
    
    const pos = totalWidth + w / 2
    totalWidth += w
    return pos
  })

  return (
    <group ref={ref} scale={[scale, scale, 1]}>
      {chars.map((char, i) => {
        const isSnake = char === "🐍"
        const xOffset = positions[i] - totalWidth / 2

        return (
          <Text
            key={i}
            outlineWidth={0.001}
            outlineColor="#000"
            position={[xOffset, 0, 0]}
            scale={isSnake ? [-1, 1, 1] : [1, 1, 1]}
            font="/fonts/CormorantGaramond-600.ttf"
            fontSize={isSnake ? 0.55 : 0.7}
            letterSpacing={0}
            anchorX="center"
            anchorY="middle"
            onSync={i === chars.length - 1 ? onReady : undefined}
          >
            {char}
            <shaderMaterial
              ref={(el) => (materialRefs.current[i] = el)}
              vertexShader={vertexShader}
              fragmentShader={isSnake ? emeraldFragmentShader : goldFragmentShader}
              transparent
              uniforms={{
                uTime: { value: 0 },
                uColor1: { value: new THREE.Color(isSnake ? "#001a0d" : "#2a1f05") },
                uColor2: { value: new THREE.Color(isSnake ? "#0f8f3d" : "#c9a227") },
                uColor3: { value: new THREE.Color(isSnake ? "#a8ffcb" : "#fff1b8") }
              }}
            />
          </Text>
        )
      })}
    </group>
  )
})

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const goldFragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;

    float flow = sin(uv.y * 12.0 + uTime * 1.5) * 0.5 + 0.5;
    float n = noise(uv * 6.0 + vec2(uTime * 0.3, uTime * 0.2));
    float molten = mix(flow, n, 0.4);

    vec3 gold = mix(uColor1, uColor2, molten);
    gold = mix(gold, uColor3, pow(molten, 3.0));

    float light = pow(1.0 - abs(uv.x - 0.5), 8.0);
    gold += vec3(1.0, 0.9, 0.6) * light * 0.6;

    float fresnel = pow(1.0 - abs(uv.y - 0.5), 3.0);
    gold += vec3(1.0, 0.85, 0.4) * fresnel * 0.25;

    float sparkle = step(0.97, noise(uv * 40.0 + uTime));
    gold += sparkle * 0.25;

    gold = pow(gold, vec3(0.85));

    gl_FragColor = vec4(gold, 1.0);
  }
`

const emeraldFragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;

    uv.x = 1.0 - uv.x;

    float n = noise(uv * 6.0 + uTime * 0.3);

    float gradient = smoothstep(0.0, 1.0, uv.y);
    float mixVal = mix(gradient, n, 0.25);

    vec3 emerald = mix(uColor1, uColor2, mixVal);
    emerald = mix(emerald, uColor3, pow(mixVal, 4.0));

    float spec = pow(1.0 - abs(uv.x - 0.5), 12.0);
    emerald += vec3(0.6, 1.0, 0.7) * spec * 0.6;

    float fresnel = pow(1.0 - abs(uv.y - 0.5), 4.0);
    emerald += vec3(0.3, 0.9, 0.5) * fresnel * 0.3;

    emerald = pow(emerald, vec3(0.8));

    gl_FragColor = vec4(emerald, 1.0);
  }
`