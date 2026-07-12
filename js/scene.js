'use strict';
// PUBG Recreation — renderer, camera, sky dome, sun + fill lights

// ---------------- renderer / scene ----------------
const SKY_HORIZON = 0xd4dfe8, SKY_TOP = 0x6f9fd8;
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'game';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(SKY_HORIZON, 90, 500);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.08, 2200);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- sky dome (gradient shader + sun glow) ----------------
const sunDirection = new THREE.Vector3(0.45, 0.62, 0.28).normalize();
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1000, 24, 14),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite:false, fog:false,
    uniforms: {
      topColor:    { value: new THREE.Color(SKY_TOP) },
      horizonColor:{ value: new THREE.Color(SKY_HORIZON) },
      sunDir:      { value: sunDirection.clone() },
      sunColor:    { value: new THREE.Color(0xfff2cf) }
    },
    vertexShader: [
      'varying vec3 vDir;',
      'void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunDir; uniform vec3 sunColor;',
      'varying vec3 vDir;',
      'void main(){',
      '  float h = clamp(vDir.y, 0.0, 1.0);',
      '  vec3 col = mix(horizonColor, topColor, pow(h, 0.62));',
      '  col = mix(horizonColor * vec3(1.02, 0.99, 0.94), col, clamp(vDir.y*8.0+0.5, 0.0, 1.0));',
      '  float s = pow(max(dot(normalize(vDir), sunDir), 0.0), 40.0);',
      '  float halo = pow(max(dot(normalize(vDir), sunDir), 0.0), 5.0);',
      '  col += sunColor * (s*0.9 + halo*0.16);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  })
);
scene.add(sky);

// ---------------- lights ----------------
const sun = new THREE.DirectionalLight(0xffeed4, 1.0);
sun.position.copy(sunDirection).multiplyScalar(160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -85; sun.shadow.camera.right = 85;
sun.shadow.camera.top = 85;   sun.shadow.camera.bottom = -85;
sun.shadow.camera.near = 10;  sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.035;
scene.add(sun); scene.add(sun.target);

scene.add(new THREE.AmbientLight(0xfff1de, 0.24));
scene.add(new THREE.HemisphereLight(0xbfd6ea, 0x8c7a58, 0.45));
