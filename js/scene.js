'use strict';
// PUBG Recreation — renderer, camera, sky dome, two-tier sun shadows, shared atmosphere shader

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
scene.fog = new THREE.Fog(SKY_HORIZON, 140, 1180);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.08, 7200);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const sunDirection = new THREE.Vector3(0.45, 0.62, 0.28).normalize();

// aerial perspective, shared by the big world materials: with distance the scene
// desaturates and the haze warms toward the sun — the strongest "this is far away" cue
function injectAerialFog(shader){
  shader.uniforms.uSunW = { value: sunDirection.clone() };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vAWPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vAWPos;\nuniform vec3 uSunW;')
    .replace('#include <fog_fragment>', [
      '#ifdef USE_FOG',
      '  float aFog = smoothstep(fogNear, fogFar, fogDepth);',
      '  vec3 aDir = normalize(vAWPos - cameraPosition);',
      '  float aSun = pow(max(dot(aDir, uSunW), 0.0), 5.0);',
      '  vec3 aCol = fogColor * mix(vec3(1.0), vec3(1.10, 1.015, 0.88), aSun);',
      '  float aGrey = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));',
      '  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(aGrey), aFog*0.30);',
      '  gl_FragColor.rgb = mix(gl_FragColor.rgb, aCol, aFog);',
      '#endif'].join('\n'));
}

// ---------------- sky dome (gradient shader + horizon haze + sun glow) ----------------
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
      '  float haze = exp(-max(vDir.y, 0.0) * 6.5);',                      // thick band of haze
      '  col = mix(col, horizonColor * vec3(1.035, 1.005, 0.955), haze * 0.55);',
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

// ---------------- lights: near sun (crisp shadows) + far sun (shadows to the fog line) ----------------
const sun = new THREE.DirectionalLight(0xffeed4, 0.62);
sun.position.copy(sunDirection).multiplyScalar(160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;   sun.shadow.camera.bottom = -42;
sun.shadow.camera.near = 10;  sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

const sunFar = new THREE.DirectionalLight(0xffeed4, 0.48);
sunFar.castShadow = true;
sunFar.shadow.mapSize.set(1536, 1536);
sunFar.shadow.camera.left = -250; sunFar.shadow.camera.right = 250;
sunFar.shadow.camera.top = 250;   sunFar.shadow.camera.bottom = -250;
sunFar.shadow.camera.near = 10;   sunFar.shadow.camera.far = 900;
sunFar.shadow.bias = -0.0012;
sunFar.shadow.normalBias = 0.10;
scene.add(sunFar); scene.add(sunFar.target);

scene.add(new THREE.AmbientLight(0xfff1de, 0.23));
scene.add(new THREE.HemisphereLight(0xbfd6ea, 0x8c7a58, 0.47));
