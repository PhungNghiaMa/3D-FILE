import "./style/index.css"

import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import FirstPersonPlayer from './control';
import AnnotationDiv from "./annotationDiv";
import { displayUploadModal, getMeshSizeInPixels, initUploadModal, toastMessage } from "./utils";
import { getMuseumList } from "./services";
import { Museum } from "./constants";
import { Capsule } from "three/examples/jsm/Addons.js";
import { metalness, roughness } from "three/tsl";



const clock = new THREE.Clock();
const scene = new THREE.Scene();

let model = null;
let menuOpen = false;

let currentMuseumId = Museum.ART_GALLERY;

const STEPS_PER_FRAME = 5;
let fpView;
let annotationMesh = {};

let isDoorOpen = false;
let doorOpenAction = null;
let animation = null;
let mixer = null;
let hasLoadPlayer = false;
const ModelPaths = {
    [Museum.ART_GALLERY]: "art_gallery/RoomTest.gltf",
    [Museum.LOUVRE]: "art_hallway/MuseumTemplate.gltf", // Ensure this path is correct
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let doorBoundingBox = null; // Store the bounding box of the door
let hasEnteredNewScene = false; // Prevent multiple scene transitions

initUploadModal();

scene.background = new THREE.Color("#f0f0f0");
// scene.fog = new THREE.Fog(0x88ccee, 0, 50);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';
camera.position.set(0, 0, 0)


const container = document.getElementById('model-container');
container.tabIndex = 0;
container.focus()

const cssRenderer = new CSS2DRenderer();
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.top = '0';
// cssRenderer.domElement.style.zIndex = 1000;
cssRenderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(cssRenderer.domElement);

const css3dRenderer = new CSS3DRenderer();
css3dRenderer.domElement.style.position = 'absolute';
css3dRenderer.domElement.style.top = '0';
css3dRenderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(css3dRenderer.domElement);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);


window.addEventListener('resize', onWindowResize);

function onWindowResize() {

    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(container.clientWidth, container.clientHeight);
    cssRenderer.setSize(container.clientWidth, container.clientHeight);
    css3dRenderer.setSize(container.clientWidth, container.clientHeight);

}

container.addEventListener("keydown", (e) => {

    if (e.key === "Shift") {
        hideAnnotations()
    }

})



container.addEventListener("keyup", (e) => {

    if (e.key === "Shift") {
        showAnnotations()
    }

})

container.addEventListener('click', (event) => {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    pointer.x = (event.clientX / container.clientWidth) * 2 - 1;
    pointer.y = -(event.clientY / container.clientHeight) * 2 + 1;
    const clipToPlay = ["DoorAction.002", "HandleAction.002", "Latch.001Action.002"];
    if (mixer !== null){
        console.info('Mixer already existed !')
    }else{
        console.warn("Mixer is no initialized !")
    }

    // Update the raycaster with the camera and pointer position
    raycaster.setFromCamera(pointer, camera);

    // Check for intersections with objects in the scene
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;
        console.log('Clicked object:', clickedObject.parent.name);
        let clipToPlay = ["DoorAction", "HandleAction", "Latch.001Action"];
        // Check if the clicked object is part of the door
        if (clickedObject.isMesh && clickedObject.parent.name === "Door001") {
            console.log('Found Door object! Trying to play animation...');
            if (animation && animation.length > 0) {
                console.log("Found animation in gltf file!");
                animation.forEach((clip) => {
                    if (clipToPlay.includes(clip.name)) {
                        // Ensure doorOpenAction is initialized

                        if (!isDoorOpen) {
                            doorOpenAction = mixer.clipAction(clip);
                            doorOpenAction.clampWhenFinished = true;
                            doorOpenAction.loop = THREE.LoopOnce;
                            doorOpenAction.timeScale = 1; // Play forward
                            doorOpenAction.reset().play();
                            isDoorOpen = true;
                        } else {
                            doorOpenAction = mixer.clipAction(clip);
                            doorOpenAction.clampWhenFinished = true;
                            doorOpenAction.loop = THREE.LoopOnce;
                            doorOpenAction.reset();
                            doorOpenAction.timeScale = -1; // Play backward
                            doorOpenAction.time = doorOpenAction.getClip().duration; // Start from the end
                            doorOpenAction.play();
                            isDoorOpen = false;
                        }
                    }
                });
            } else {
                console.log("Animation not found in gltf file");
            }
        }
    } else {
        console.warn("No intersects found!");
    }
});



// Update onContainerClick function

function initMenu(){

    const menuContainer = document.getElementById("menu-container")

    document.getElementById("menu-close").addEventListener("click", closeMenu)

    const menuList = document.getElementById("menu-selection-list")

    const listItem1 = document.createElement("div")
    listItem1.textContent = "Art Gallery";
    listItem1.classList.add("menu-item");
    listItem1.addEventListener("click", () => setMuseumModel(Museum.ART_GALLERY))

    const listItem2 = document.createElement("div")
    listItem2.textContent = "Louvre Art Museum";
    listItem2.classList.add("menu-item");
    listItem2.addEventListener("click", () => setMuseumModel(Museum.LOUVRE));

    menuList.appendChild(listItem1);
    menuList.appendChild(listItem2);
    
    menuOpen = true;

    document.addEventListener("keydown", (e) => {
        // console.log("key: ", e.key)
        if (e.key === "Escape"){
    
            if (menuOpen) closeMenu();
            else openMenu();
        }
    })

    document.addEventListener("click", (e) => {

        if (!menuContainer.contains(e.target)){
            closeMenu()
        }
    })

}

initMenu();

function openMenu(){
    menuOpen = true;
    document.getElementById("menu-container").style.display = "flex";
}

function closeMenu(){
    menuOpen = false;
    document.getElementById("menu-container").style.display = "none";
}


function setMuseumModel(modelId){
    currentMuseumId = modelId
    loadModel()
}

/**
 * 
 * @param {THREE.Mesh} mesh 
 * @param {string} imgUrl 
 */
function setImageToMesh(mesh, imgUrl) {
    console.log("Setting image to mesh:", mesh.name, imgUrl);
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imgUrl, 
        // Success callback
        (loadedTexture) => {
            console.log("Texture loaded successfully");
            
            // Configure texture - always set flipY to false for consistency
            loadedTexture.flipY = true; // Changed from true to false
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            loadedTexture.minFilter = THREE.LinearFilter;
            loadedTexture.magFilter = THREE.LinearFilter;
            loadedTexture.generateMipmaps = false;
            loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
            loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
            loadedTexture.needsUpdate = true;

            // Create and configure material
            const material = new THREE.MeshBasicMaterial({
                map: loadedTexture,
                side: THREE.DoubleSide,
                transparent: false,
                opacity: 1.0,
                toneMapped: false,
                depthTest: true,
                depthWrite: true
            });

            // Apply material
            mesh.material = material;
            mesh.material.needsUpdate = true;

            // Update geometry if needed
            if (mesh.geometry && mesh.geometry.attributes.uv) {
                // Get UV coordinates
                const uvs = mesh.geometry.attributes.uv.array;
                
                // Keep UV coordinates as is, don't modify them
                mesh.geometry.attributes.uv.needsUpdate = true;
            }

            // Force scene update
            renderer.render(scene, camera);
        },
        // Progress callback
        undefined,
        // Error callback
        (error) => {
            console.error('Error loading texture:', error);
            mesh.material = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                side: THREE.DoubleSide
            });
        }
    );
}


document.body.addEventListener("uploadevent", (event) => {

    console.log("event: ", event)

    const { img_id, title, description, img_url, price, name } = event.detail

    if (!(img_id in annotationMesh)) {
        return
    }

    annotationMesh[img_id].annotationDiv.setAnnotationDetails(title, description, name)

    setImageToMesh(annotationMesh[img_id].mesh, img_url)

})


const loader = new GLTFLoader().setPath('/assets/');

function clearSceneObjects(obj) {
    while (obj.children.length > 0) {
        clearSceneObjects(obj.children[0]);
        obj.remove(obj.children[0]);
    }
    if (obj.geometry) obj.geometry.dispose();

    if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(material => {
            if (material) {
                Object.keys(material).forEach(prop => {
                    if (material[prop] && material[prop].isTexture) {
                        material[prop].dispose();
                    }
                });
                material.dispose();
            }
        });
    }
    isDoorOpen = false;
}




/**
 * Function to check if the player is near the door and trigger the scene transition.
 */
function checkPlayerPosition() {
    if (doorBoundingBox && !hasEnteredNewScene && hasLoadPlayer) {
        const playerPosition = fpView.getPlayerPosition(); // Get the player's position
        const distanceToDoor = doorBoundingBox.distanceToPoint(playerPosition); // Calculate distance to the door
        // console.log("Distance to door:", distanceToDoor);

        // Trigger scene transition if the player is within a certain distance from the door
        if (distanceToDoor < 3 && isDoorOpen) { // Adjust the distance threshold as needed
            console.log("Player is near the door! Transitioning to the next scene...");
            hasEnteredNewScene = true;
            if(currentMuseumId === Museum.ART_GALLERY) {
                setMuseumModel(Museum.LOUVRE); // Change to the desired museum ID
            }else if(currentMuseumId === Museum.LOUVRE) {
                setMuseumModel(Museum.ART_GALLERY);
            }
        }
    }
}

function loadModel() {
    document.getElementById('loading-container').style.display = 'flex';
        // Dispose of the old FirstPersonPlayer and its Octree if they exist
        if (fpView) {
            hasLoadPlayer = false;
            fpView.dispose(); // Assuming you add a dispose method to FirstPersonPlayer
            fpView = null;
        }
    
        // Reset annotationMesh
        annotationMesh = {};

    clearSceneObjects(scene);
    const light = new THREE.AmbientLight("#FFFFFF", 4);
    scene.add(light);
    const directionalLight = new THREE.DirectionalLight( "#EEB05A",2);
    directionalLight.position.set( 40, 40, 10 );
    scene.add( directionalLight );
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024; // default

    loader.load(
        ModelPaths[currentMuseumId],
        (gltf) => {
            model = gltf;
            scene.add(gltf.scene);
            gltf.scene.updateMatrixWorld(true);
            let count = 0;

            // Find the largest floor mesh by bounding box area
            let floorMesh = null;
            let maxArea = 0;
            let fallbackY = Infinity;
            let fallbackX = 0, fallbackZ = 0;
            let floorBoxMaxY = null;
            animation = gltf.animations;
            mixer = new THREE.AnimationMixer(gltf.scene);

            gltf.scene.traverse((child) => {
                if(child.material){
                    console.log(`${child.name} has material: ${child.material.type}`);
                }
                if (child.isMesh) {
                    console.log(`CHILD: ${child.name} - IS MESH: ${child.isMesh}`);

                    const pos = new THREE.Vector3();
                    child.getWorldPosition(pos);
                    // Fallback for lowest mesh
                    if (pos.y < fallbackY) {
                        fallbackY = pos.y;
                        fallbackX = pos.x;
                        fallbackZ = pos.z;
                    }
                    // Floor mesh detection
                    if (child.name.toLowerCase().includes("floor")) {
                        const box = new THREE.Box3().setFromObject(child);
                        const size = new THREE.Vector3();
                        box.getSize(size);
                        const area = size.x * size.z;
                        if (area > maxArea) {
                            maxArea = area;
                            floorMesh = { box, center: box.getCenter(new THREE.Vector3()) };
                            floorBoxMaxY = box.max.y;
                        }
                    }

                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(material => {
                            if (material) {
                                Object.keys(material).forEach(prop => {
                                    if (material[prop] && material[prop].isTexture) {
                                        console.log(material.name)
                                    }
                                });
                            }
                        });
                    }

                    // Update the door bounding box and Octree
                    if (child.parent.name === "Door001") {
                        doorBoundingBox = new THREE.Box3().setFromObject(child);
                    }

                    if(child.name === "Handle"){
                        console.log("Found handle object:", child.name);
                        child.material = new THREE.MeshPhongMaterial({
                            color: 0xF4EBC7,
                            side: THREE.DoubleSide,
                            transparent: false,
                            opacity: 1.0,
                            toneMapped: false,
                            depthTest: true,
                            depthWrite: true,
                            metalness: 1,
                            roughness: 0.2,
                        });
                    }
                        
                }

                // 


                // Match Picture Frame meshes directly
                if (child.isMesh && /^ImageMesh\d+$/.test(child.name)) {
                    console.log("Processing Image Mesh:", child.name);

                    // The image plane is the mesh itself
                    const imagePlane = child;
                    console.log("Found image plane:", imagePlane.name);

                    // Create new material for the image plane
                    const material = new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        side: THREE.DoubleSide,
                        transparent: false,
                        map: null, // Set to null initially
                        opacity: 1.0,
                        toneMapped: false,
                        depthTest: true,
                        depthWrite: true
                    });

                    // Apply material and ensure proper rendering
                    imagePlane.material = material;
                    imagePlane.material.needsUpdate = true;

                    // Log UV coordinates for debugging
                    if (imagePlane.geometry && imagePlane.geometry.attributes.uv) {
                        console.log("UV coordinates for", imagePlane.name, ":", imagePlane.geometry.attributes.uv.array);
                        imagePlane.geometry.attributes.uv.needsUpdate = true;
                    }

                    // Create annotation
                    const box = new THREE.Box3().setFromObject(imagePlane);
                    const center = new THREE.Vector3();
                    box.getCenter(center);

                    const annotationDiv = new AnnotationDiv(count, imagePlane);
                    const label = new CSS2DObject(annotationDiv.getElement());
                    label.position.set(center.x, center.y, center.z);

                    // Store mesh reference
                    annotationMesh[child.name] = { label, annotationDiv, mesh: imagePlane };

                    annotationDiv.onAnnotationClick = ({ event, id }) => {
                        const { width, height } = getMeshSizeInPixels(imagePlane, camera, renderer);
                        const aspectRatio = width / height;
                        console.log("Frame dimensions:", { width, height, aspectRatio });
                        displayUploadModal(aspectRatio, { img_id: child.name, museum: currentMuseumId });
                    };
                    scene.add(label);
                }
            });

            let playerStart = { x: 0, y: 1, z: 0 };
            if (floorMesh) {
                playerStart.x = floorMesh.center.x;
                playerStart.y = floorBoxMaxY !== null ? floorBoxMaxY + 1 : floorMesh.center.y + 1; // Ensure player starts slightly above the floor
                playerStart.z = floorMesh.center.z;
                console.log(`Using floor mesh at (${playerStart.x}, ${playerStart.y}, ${playerStart.z})`);
            } else {
                playerStart.x = fallbackX;
                playerStart.y = fallbackY === Infinity ? 1 : fallbackY + 0.1; // Fallback to lowest mesh
                playerStart.z = fallbackZ;
                console.warn("No floor mesh found, using lowest mesh position as fallback.");
            }

            onWindowResize();
            const playerHeight = 1;
            const playerRadius = 0.35;

            // Place player just above the floor
            const playerStartY = playerStart.y + playerRadius + 0.01;
            const playerCollider = new Capsule(
                new THREE.Vector3(playerStart.x, playerStartY, playerStart.z),
                new THREE.Vector3(playerStart.x, playerStartY + playerHeight - playerRadius, playerStart.z),
                playerRadius
            );

            if (currentMuseumId === Museum.ART_GALLERY) {
                fpView = new FirstPersonPlayer(camera, scene, container, playerCollider);
                fpView.updatePlayer(0.01, 0, 1.8, 0);
            } else {
                const playerCollider = new Capsule(
                    new THREE.Vector3(0, 0.35, 0),
                    new THREE.Vector3(0, 1, 0), 0.35
                );
                camera.position.set(0, 0, 0);
                fpView = new FirstPersonPlayer(camera, scene, container, playerCollider);
                fpView.updatePlayer(0.01, 0, 1.6, 0);
            }
            hasLoadPlayer = true;

            console.log("Loading Octree from scene:", gltf.scene);
            fpView.loadOctaTree(gltf.scene); // Ensure the octree includes the floor mesh

            document.getElementById('loading-container').style.display = 'none';

            getMuseumList(currentMuseumId).then(data => {
                console.log("museum data: ", data);
                data.data.forEach(data => {
                    const { img_id, title, description, img_cid, price, name } = data;

                    if (!(img_id in annotationMesh)) {
                        return;
                    }

                    annotationMesh[img_id].annotationDiv.setAnnotationDetails(title, description, name);

                    setImageToMesh(annotationMesh[img_id].mesh, `https://gateway.pinata.cloud/ipfs/${img_cid}`);
                });
            });

            // Reset the scene transition flag
            hasEnteredNewScene = false;
        },
        (xhr) => {
            const progress = xhr.total > 0 ? (xhr.loaded / xhr.total) * 100 : (xhr.loaded / 60000);
            document.getElementById('progress').style.width = progress + '%';
        },
        (error) => {
            console.error('An error occurred while loading the model:', error);
            toastMessage("An error occurred loading the model. Please check the console for details.");
            document.getElementById('loading-container').style.display = 'none';
        }
    );
}

loadModel()

function hideAnnotations() {
    Object.values(annotationMesh).forEach(({ label, annotationDiv }) => {
        label.element.style.opacity = "0"
    })
}

function showAnnotations() {
    Object.values(annotationMesh).forEach(({ label, annotationDiv }) => {
        label.element.style.opacity = "100"
    })
}

function animate() {

    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        fpView?.update(deltaTime)
    }
    if (mixer){
        if (isDoorOpen){
            mixer.update(deltaTime*4)
        }else{
             mixer.update(deltaTime*4);
        }
        
    }

    checkPlayerPosition(); // Check if the player is near the door

    cssRenderer.render(scene, camera);
    css3dRenderer.render(scene, camera);
    renderer.render(scene, camera);


    requestAnimationFrame(animate)
}

animate()