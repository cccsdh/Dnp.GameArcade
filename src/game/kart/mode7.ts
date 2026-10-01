import Phaser from 'phaser';

/**
 * The Mode-7 floor: a full-screen fragment shader that, for every pixel below
 * the horizon, projects back onto the flat track plane and samples the track
 * texture - the classic SNES racer trick. Output is snapped to chunky pixels
 * (uPix) and fogged toward the horizon.
 *
 * Projection (shared with sprite placement in KartRaceScene.project):
 *   forward = uHeight * uFocal / (screenY - uHorizon)
 *   right   = (screenX - width/2) * forward / uFocal
 *   world   = uCam + dir * forward + (-dir.y, dir.x) * right
 */
const FRAG = `
precision highp float;

uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform vec2 uCam;
uniform vec2 uDir;
uniform float uHorizon;
uniform float uFocal;
uniform float uHeight;
uniform float uPix;
uniform float uTrackSize;
uniform float uFogDist;
uniform vec3 uFog;
uniform vec3 uOut;

varying vec2 fragCoord;

void main() {
  vec2 px = floor(vec2(fragCoord.x, resolution.y - fragCoord.y) / uPix) * uPix + uPix * 0.5;
  float dy = px.y - uHorizon;
  if (dy < 0.5) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float fwd = uHeight * uFocal / dy;
  float rgt = (px.x - resolution.x * 0.5) * fwd / uFocal;
  vec2 right = vec2(-uDir.y, uDir.x);
  vec2 w = uCam + uDir * fwd + right * rgt;
  vec2 uv = w / uTrackSize;
  vec3 col;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    float chk = mod(floor(w.x / 64.0) + floor(w.y / 64.0), 2.0);
    col = uOut * (0.92 + 0.08 * chk);
  } else {
    col = texture2D(iChannel0, uv).rgb;
  }
  float f = clamp(fwd / uFogDist, 0.0, 1.0);
  col = mix(col, uFog, f * f * 0.9);
  gl_FragColor = vec4(col, 1.0);
}
`;

function rgb(hex: number): { x: number; y: number; z: number } {
  return { x: ((hex >> 16) & 255) / 255, y: ((hex >> 8) & 255) / 255, z: (hex & 255) / 255 };
}

export function createMode7Shader(fog: number, out: number): Phaser.Display.BaseShader {
  return new Phaser.Display.BaseShader('kartMode7', FRAG, undefined, {
    uCam: { type: '2f', value: { x: 0, y: 0 } },
    uDir: { type: '2f', value: { x: 1, y: 0 } },
    uHorizon: { type: '1f', value: 200 },
    uFocal: { type: '1f', value: 600 },
    uHeight: { type: '1f', value: 30 },
    uPix: { type: '1f', value: 3 },
    uTrackSize: { type: '1f', value: 2048 },
    uFogDist: { type: '1f', value: 2200 },
    uFog: { type: '3f', value: rgb(fog) },
    uOut: { type: '3f', value: rgb(out) },
  });
}
