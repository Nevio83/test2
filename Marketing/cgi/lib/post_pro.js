// Postprocessing "Pro" (realistischer Look): MSAA-Rendertarget, Ambient Occlusion (GTAO), Schaerfentiefe (Bokeh),
// Bloom auf Lichtern, dann Farbgrading (leichte S-Kurve, warme Lichter/kuehle Schatten), Vignette, feine chromatische Aberration.
// Nutzung: const P = makePostPro(r, scene, cam, {...}); pro Bild P.focus(dist, aperture) setzen, dann P.render().
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, H } from './core.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uCA: { value: 0.0012 }, uWarm: { value: 0.04 }, uContrast: { value: 0.08 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uCA, uWarm, uContrast; varying vec2 vUv;
void main(){
  vec2 d = vUv - 0.5;
  vec3 c;
  c.r = texture2D(tDiffuse, vUv + d * uCA).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv - d * uCA).b;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += (c - l) * 0.06;                                              // etwas mehr Saettigung
  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);                  // weiche S-Kurve
  c += vec3(uWarm, uWarm * 0.4, -uWarm * 0.5) * smoothstep(0.35, 1.0, l);   // warme Lichter
  c += vec3(-0.01, 0.0, 0.015) * (1.0 - smoothstep(0.0, 0.35, l));          // kuehle Schatten
  float v = smoothstep(0.85, 0.25, length(d * vec2(0.85, 1.0)));
  c *= mix(1.0 - uVig, 1.0, v);
  gl_FragColor = vec4(c, 1.0);
}`,
};

export function makePostPro(r, scene, cam, { bloom = [0.22, 0.6, 0.9], ao = true, dof = true, aoRadius = 0.6, grade = {} } = {}) {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const comp = new EffectComposer(r, rt);
  comp.setPixelRatio(1); comp.setSize(W, H);
  comp.addPass(new RenderPass(scene, cam));
  let gtao = null;
  if (ao) { gtao = new GTAOPass(scene, cam, W, H); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 1.0;
    gtao.updateGtaoMaterial({ radius: aoRadius, distanceExponent: 1.5, thickness: 1.0, scale: 1.0, samples: 8 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 }); comp.addPass(gtao); }
  const bl = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), bloom[0], bloom[1], bloom[2]); comp.addPass(bl);
  let bokeh = null;
  if (dof) { bokeh = new BokehPass(scene, cam, { focus: 10, aperture: 0.0008, maxblur: 0.006 }); comp.addPass(bokeh); }
  comp.addPass(new OutputPass());
  const gp = new ShaderPass(GradeShader); Object.entries(grade).forEach(([k, v]) => (gp.uniforms[k].value = v)); comp.addPass(gp);
  return {
    render: () => comp.render(), bloom: bl, gtao, bokeh, grade: gp,
    focus(dist, aperture = 0.0008, maxblur = 0.006) { if (!bokeh) return; bokeh.uniforms.focus.value = dist; bokeh.uniforms.aperture.value = aperture; bokeh.uniforms.maxblur.value = maxblur; bokeh.enabled = aperture > 0; },
  };
}
