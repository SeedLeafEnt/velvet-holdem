/* Loads three.js (from vendor/three, see the importmap in index.html) and hands it to the classic scripts in js/. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
window.THREE = THREE;
window.RoomEnvironment = RoomEnvironment;
