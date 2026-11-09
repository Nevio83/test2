// Postprocessing (threejs-cgi-techniken): Bloom auf Glanzlichtern, dann Tonemapping/Farbraum per OutputPass.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, H } from './core.js';
export function makePost(r, scene, cam, { strength = 0.35, radius = 0.55, threshold = 0.82 } = {}) {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 0 });
  const comp = new EffectComposer(r, rt);
  comp.setPixelRatio(1); comp.setSize(W, H);
  comp.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), strength, radius, threshold);
  comp.addPass(bloom);
  comp.addPass(new OutputPass());
  return { render: () => comp.render(), bloom };
}
