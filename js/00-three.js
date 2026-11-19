/* Loads three.js (from vendor/three, see the importmap in index.html) and hands it to the classic scripts in js/. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
window.THREE = THREE;
window.RoomEnvironment = RoomEnvironment;
window.THREE_FX = { EffectComposer, RenderPass, UnrealBloomPass, OutputPass }; // glow for the city screen (18b-city.js)
