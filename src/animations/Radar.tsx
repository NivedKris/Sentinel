import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

interface RadarProps {
  speed?: number;
  scale?: number;
  ringCount?: number;
  spokeCount?: number;
  ringThickness?: number;
  spokeThickness?: number;
  sweepSpeed?: number;
  sweepWidth?: number;
  sweepLobes?: number;
  color?: string;
  backgroundColor?: string;
  falloff?: number;
  brightness?: number;
  enableMouseInteraction?: boolean;
  mouseInfluence?: number;
  style?: React.CSSProperties;
  className?: string;
}

function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uRingCount;
uniform float uSpokeCount;
uniform float uRingThickness;
uniform float uSpokeThickness;
uniform float uSweepSpeed;
uniform float uSweepWidth;
uniform float uSweepLobes;
uniform vec3 uColor;
uniform vec3 uBgColor;
uniform float uFalloff;
uniform float uBrightness;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;

#define TAU 6.28318530718
#define PI 3.14159265359

void main() {
  vec2 st = gl_FragCoord.xy / uResolution.xy;
  st = st * 2.0 - 1.0;
  st.x *= uResolution.x / uResolution.y;

  if (uEnableMouse) {
    vec2 mShift = (uMouse * 2.0 - 1.0);
    mShift.x *= uResolution.x / uResolution.y;
    st -= mShift * uMouseInfluence;
  }

  st *= uScale;

  float dist = length(st);
  float theta = atan(st.y, st.x);
  float t = uTime * uSpeed;

  // 1. Concentric Star Wars targeting reticles
  float rings = 0.0;
  for(int i = 1; i <= 6; i++) {
    float r = float(i) * 0.15;
    float ringGlow = 1.0 - smoothstep(0.0, uRingThickness * 0.6, abs(dist - r));
    
    // Varying dash styles for different rings
    if(i == 2 || i == 5) {
      // Dotted ring
      float dots = step(0.4, fract(theta * 16.0 / TAU));
      ringGlow *= dots;
    } else if(i == 4) {
      // Four quadrants ring
      float quads = step(0.1, abs(sin(theta * 2.0)));
      ringGlow *= quads;
    }
    rings += ringGlow;
  }

  // 2. Central crosshairs with a target center gap
  float crossX = abs(st.x);
  float crossY = abs(st.y);
  float crosshair = 0.0;
  if (dist > 0.06 && dist < 0.9) {
    // Horizontal & vertical fine grid lines
    crosshair += (1.0 - smoothstep(0.0, uSpokeThickness * 0.7, crossX));
    crosshair += (1.0 - smoothstep(0.0, uSpokeThickness * 0.7, crossY));
    
    // Target ticks at intervals
    float ticksX = step(0.92, sin(st.x * 20.0)) * (1.0 - smoothstep(0.0, 0.015, crossY)) * step(abs(st.x), 0.7);
    float ticksY = step(0.92, sin(st.y * 20.0)) * (1.0 - smoothstep(0.0, 0.015, crossX)) * step(abs(st.y), 0.7);
    crosshair += (ticksX + ticksY) * 0.5;
  }

  // 3. Coordinate telemetry grid
  float gridSpacing = 4.0;
  float gridX = abs(fract(st.x * gridSpacing - 0.5) - 0.5) / gridSpacing;
  float gridY = abs(fract(st.y * gridSpacing - 0.5) - 0.5) / gridSpacing;
  float grid = (1.0 - smoothstep(0.0, uSpokeThickness * 0.5, gridX)) + (1.0 - smoothstep(0.0, uSpokeThickness * 0.5, gridY));
  grid *= 0.12 * smoothstep(1.0, 0.2, dist); // fade grid out towards edges

  // 4. Rotating target lock-on diamond
  float rotAngle = t * 0.25;
  float cosR = cos(rotAngle);
  float sinR = sin(rotAngle);
  mat2 rotMat = mat2(cosR, -sinR, sinR, cosR);
  vec2 rst = rotMat * st;
  
  float diamond = abs(rst.x) + abs(rst.y);
  float targetDiamond = (1.0 - smoothstep(0.0, uRingThickness * 0.5, abs(diamond - 0.35)));
  // mask to show corners only
  float cornerMask = step(0.18, abs(rst.x)) * step(0.18, abs(rst.y));
  targetDiamond *= cornerMask;

  // 5. Rotating vector scanning sweep line with trailing wedge glow
  float sweepAngle = theta - t * uSweepSpeed * 0.5;
  float sweepLine = 1.0 - smoothstep(0.0, uSpokeThickness * 1.5, abs(sin(sweepAngle)));
  sweepLine *= step(0.0, cos(sweepAngle)); // restrict to single sweeping hand
  sweepLine *= smoothstep(0.9, 0.0, dist);
  
  // Fading scan trail
  float trail = fract(sweepAngle / TAU);
  float sweepTrail = trail * 0.3 * smoothstep(0.9, 0.0, dist);

  // 6. Dynamic locked indicators (flashing telemetry details)
  float flash = step(0.5, sin(t * 4.0));
  float lockRing = 1.0 - smoothstep(0.0, uRingThickness * 0.5, abs(dist - (0.55 + 0.01 * sin(t * 10.0))));
  float lockSegments = step(0.8, fract(theta * 3.0 / TAU + t * 0.05));
  float lockTelemetry = lockRing * lockSegments * (flash * 0.4 + 0.6);

  // Combine vector graphics
  float intensity = rings + crosshair + grid + targetDiamond + sweepLine + sweepTrail + lockTelemetry;

  // Outer border fade
  float fade = smoothstep(1.05, 0.8, dist) * pow(max(1.0 - dist, 0.0), uFalloff);
  intensity *= fade * uBrightness;

  // 7. Retro hologram scanline effect
  float scanline = sin(gl_FragCoord.y * 1.5 + uTime * 4.0) * 0.06 + 0.94;
  intensity *= scanline;

  vec3 col = uColor * intensity;
  
  // Use alpha blending to composite smoothly over background stars
  float alpha = clamp(intensity * 1.6, 0.0, 0.92);
  gl_FragColor = vec4(col + uBgColor, alpha);
}
`;

export default function Radar({
  speed = 0.6,
  scale = 0.55,
  ringCount = 8.0,
  spokeCount = 8.0,
  ringThickness = 0.04,
  spokeThickness = 0.008,
  sweepSpeed = 0.8,
  sweepWidth = 3.0,
  sweepLobes = 1.0,
  color = '#e8622c',
  backgroundColor = '#020409',
  falloff = 2.5,
  brightness = 0.8,
  enableMouseInteraction = false,
  mouseInfluence = 0.05,
  style,
  className,
}: RadarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    let program: Program;
    let currentMouse = [0.5, 0.5];
    let targetMouse = [0.5, 0.5];

    function handleMouseMove(e: MouseEvent) {
      const rect = gl.canvas.getBoundingClientRect();
      targetMouse = [
        (e.clientX - rect.left) / rect.width,
        1.0 - (e.clientY - rect.top) / rect.height,
      ];
    }

    function resize() {
      renderer.setSize(container.offsetWidth, container.offsetHeight);
      if (program) {
        program.uniforms.uResolution.value = [
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        ];
      }
    }
    window.addEventListener('resize', resize);
    resize();

    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height] },
        uSpeed: { value: speed },
        uScale: { value: scale },
        uRingCount: { value: ringCount },
        uSpokeCount: { value: spokeCount },
        uRingThickness: { value: ringThickness },
        uSpokeThickness: { value: spokeThickness },
        uSweepSpeed: { value: sweepSpeed },
        uSweepWidth: { value: sweepWidth },
        uSweepLobes: { value: sweepLobes },
        uColor: { value: hexToVec3(color) },
        uBgColor: { value: hexToVec3(backgroundColor) },
        uFalloff: { value: falloff },
        uBrightness: { value: brightness },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseInfluence: { value: mouseInfluence },
        uEnableMouse: { value: enableMouseInteraction },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    container.appendChild(gl.canvas);

    if (enableMouseInteraction) {
      gl.canvas.addEventListener('mousemove', handleMouseMove);
    }

    let animationFrameId: number;
    function update(time: number) {
      animationFrameId = requestAnimationFrame(update);
      program.uniforms.uTime.value = time * 0.001;
      if (enableMouseInteraction) {
        currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
        program.uniforms.uMouse.value[0] = currentMouse[0];
        program.uniforms.uMouse.value[1] = currentMouse[1];
      }
      renderer.render({ scene: mesh });
    }
    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      if (enableMouseInteraction) {
        gl.canvas.removeEventListener('mousemove', handleMouseMove);
      }
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [speed, scale, ringCount, spokeCount, ringThickness, spokeThickness,
    sweepSpeed, sweepWidth, sweepLobes, color, backgroundColor,
    falloff, brightness, enableMouseInteraction, mouseInfluence]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}
