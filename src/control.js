import { nil } from 'ajv';
import * as THREE from 'three';
import { Timer } from 'three/examples/jsm/Addons.js';

import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { Octree } from "three/examples/jsm/math/Octree.js";
const GRAVITY = 30;


export default class FirstPersonPlayer{

    constructor(camera, scene, container=document , playerCollider = null){

        this.camera = camera
        this.scene = scene
        this.container = container || document
        this.playerCollider = playerCollider === null ? new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1.5-0.35, 0), 0.35) : playerCollider;
        this.worldOctree = new Octree();

        this.playerVelocity = new THREE.Vector3();
        this.playerDirection = new THREE.Vector3();

        this.playerOnFloor = false;
        this.mousePress = false;

        this.keyStates = {};
        this.lastCameraPitch = 0; // for clamping pitch
        this.activeObjects = [];
        this.FinishLoadOctree = false;

        this.container.addEventListener('keydown', (event) => {

            this.keyStates[event.code] = true;
        
        });
        
        this.container.addEventListener('keyup', (event) => {
        
            this.keyStates[event.code] = false;
        })

        this.container.addEventListener('mousedown', () => {

            this.mousePress = true
        
        });

        this.container.addEventListener("mouseup", () => {
            this.mousePress = false;
        })

        this.container.addEventListener('mousemove', (event) => {

            if (document.pointerLockElement === this.container) {
        
            }

            if (this.mousePress){
                this.camera.rotation.y -= event.movementX / 500;
                this.camera.rotation.x -= event.movementY / 500;

                // Clamp camera pitch (x) between -PI/2 and PI/2
                const maxPitch = Math.PI / 2 - 0.01;
                const minPitch = -Math.PI / 2 + 0.01;
                this.camera.rotation.x = Math.max(minPitch, Math.min(maxPitch, this.camera.rotation.x));
            }
        });

        this.playerCollisions = this.playerCollisions.bind(this)
        
        this.update = this.update.bind(this)
        this.updatePlayer = this.updatePlayer.bind(this)

        this.loadOctaTree = this.loadOctaTree.bind(this)

    }

    loadOctaTree(scene){
        if (!scene) {
            console.warn("No scene passed to loadOctaTree!");
            return;
        }
        let found = 0;
        scene.traverse((child) =>{
            if (child.isMesh && child.geometry) {
                this.worldOctree.fromGraphNode(child);
                found++;
                this.activeObjects.push(child);
            }
        });
        if (found === 0) {
            console.warn("No collidable meshes found in scene for Octree!");
        } else {
            console.log(`Octree built with ${found} meshes.`);
        }
        this.FinishLoadOctree = true;
        return this.FinishLoadOctree;
    }

    playerCollisions() {

        const result = this.worldOctree.capsuleIntersect(this.playerCollider);
    
        this.playerOnFloor = false;
    
        if (result) {
    
            this.playerOnFloor = result.normal.y > 0;

            if (!this.playerOnFloor) {
    
                this.playerVelocity.addScaledVector(result.normal, - result.normal.dot(this.playerVelocity));
    
            }

            if (result.depth >= 1e-10) {
                this.playerCollider.translate(result.normal.multiplyScalar(result.depth));
    
            }
    
        }
    
    }


    updatePlayer(deltaTime , initialCameraHeight) {

        let damping = Math.exp(- 4 * deltaTime) - 1;
    
        if (!this.playerOnFloor) {
    
            this.playerVelocity.y -= GRAVITY * deltaTime;
    
            // small air resistance
            damping *= 0.1;
        }
    
        this.playerVelocity.addScaledVector(this.playerVelocity, damping);
    
        const deltaPosition = this.playerVelocity.clone().multiplyScalar(deltaTime);
        this.playerCollider.translate(deltaPosition);
    
        this.playerCollisions();
        const cameraOffset = new THREE.Vector3(0, 1.9, 0); // Set Z to 0 
        // You can modify the 1.9 to set higher viewpoint of player 
        this.camera.position.copy(this.playerCollider.end).add(cameraOffset);
    
    }
    

    update(deltaTime){
        this.updatePlayer(deltaTime)
        this.updateControls(deltaTime)
        this.teleportPlayerIfOob()
    }


    getForwardVector() {

        this.camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
    
        return this.playerDirection;
    
    }
    
    getSideVector() {
    
        this.camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        this.playerDirection.cross(this.camera.up);
    
        return this.playerDirection;
    
    }
    
    updateControls(deltaTime) {
    
        // gives a bit of air control
        const speedDelta = deltaTime * (this.playerOnFloor ? 25 : 8);
    
    
        if (this.keyStates['KeyW']) {
    
            this.playerVelocity.add(this.getForwardVector().multiplyScalar(speedDelta));
    
        }
    
        if (this.keyStates['KeyS']) {
    
            this.playerVelocity.add(this.getForwardVector().multiplyScalar(- speedDelta));
    
        }
    
        if (this.keyStates['KeyA']) {
    
            this.playerVelocity.add(this.getSideVector().multiplyScalar(- speedDelta));
    
        }
    
        if (this.keyStates['KeyD']) {
    
            this.playerVelocity.add(this.getSideVector().multiplyScalar(speedDelta));
    
        }
    
        if (this.playerOnFloor) {
    
            if (this.keyStates['Space']) {
    
                this.playerVelocity.y = 20 ;
    
            }
     
        }
    
    }

    teleportPlayerIfOob() {

        if (this.camera.position.y <= - 25) {
    
            this.playerCollider.start.set(0, 0.35, 0);
            this.playerCollider.end.set(0, 1, 0);
            this.playerCollider.radius = 0.35;
            this.camera.position.copy(this.playerCollider.end);
            this.camera.rotation.set(0, 0, 0);
    
        }
    
    }

    getPlayerPosition() {
        return this.playerCollider.end.clone(); // Return the player's current position
    }


    removeObjectFromOctaTree(doorObj) {
        if (doorObj && doorObj.isMesh) {
            this.activeObjects = this.activeObjects.filter((object) => object !== doorObj);
            this.worldOctree.clear();
            this.activeObjects.forEach((object) => {
                if (object.isMesh && object.geometry) {
                    this.worldOctree.fromGraphNode(object);
                }
            });
            console.log("Door removed from Octree");
        } else {
            console.warn("Invalid door object passed to removeOctaTree!");
        }
    }

    dispose() {
        // Dispose of all resources used by the player
        this.worldOctree = null;
        this.activeObjects = [];
        this.playerCollider = null;
        this.playerVelocity = null;
        this.playerDirection = null;
        console.log("FirstPersonPlayer resources disposed.");
    }

     getOctree() {
        return this.worldOctree;
    }

    dipose(){
        this.worldOctree = null;
        this.activeObjects = [];
        this.playerCollider = null;
        this.playerVelocity = null;
        this.playerDirection = null;
        console.log("FirstPersonPlayer resources disposed.");
    }
}