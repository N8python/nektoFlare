import * as THREE from 'three';
//import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Stats } from "./stats.js";
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { N8AOPass, N8AOPostPass } from './N8AO.js';
import { ShadowMesh } from 'three/addons/objects/ShadowMesh.js';
import { LensFlarePass, Flare } from './LensFlarePass.js';
import { BloomEffect, Effect, EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset } from "postprocessing";
async function main() {
    // Setup basic renderer, controls, and profiler
    let clientWidth = window.innerWidth;
    let clientHeight = window.innerHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, clientWidth / clientHeight, 0.1, 1000);
    camera.position.set(50, 75, 50);
    const renderer = new THREE.WebGLRenderer({
        stencil: true
    });
    renderer.setSize(clientWidth, clientHeight);
    document.body.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 25, 0);
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    // Setup scene
    // Skybox
    const environment = new THREE.CubeTextureLoader().load([
        "skybox/Box_Right.bmp",
        "skybox/Box_Left.bmp",
        "skybox/Box_Top.bmp",
        "skybox/Box_Bottom.bmp",
        "skybox/Box_Front.bmp",
        "skybox/Box_Back.bmp"
    ]);
    environment.colorSpace = THREE.SRGBColorSpace;
    scene.background = environment;
    const torusKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(5, 1.5, 200, 32), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, envMap: environment, metalness: 0.5, roughness: 0.5, color: new THREE.Color(0.0, 1.0, 0.0) }));
    torusKnot.position.y = 8.5;
    torusKnot.position.x = 0;
    torusKnot.position.z = 0;
    torusKnot.castShadow = true;
    torusKnot.receiveShadow = true;
    scene.add(torusKnot);
    const torusKnot2 = new THREE.Mesh(new THREE.TorusKnotGeometry(5, 1.5, 200, 32), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, envMap: environment, color: new THREE.Color(1.0, 0.0, 0.0), transparent: true, depthWrite: true }));
    torusKnot2.position.y = 8.5;
    torusKnot2.position.x = -20;
    torusKnot2.position.z = 0;
    torusKnot2.castShadow = true;
    torusKnot2.receiveShadow = true;
    scene.add(torusKnot2);
    const torusKnot3 = new THREE.Mesh(new THREE.TorusKnotGeometry(5, 1.5, 200, 32), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, envMap: environment, color: new THREE.Color(0.0, 0.0, 1.0), transparent: true, depthWrite: false }));
    torusKnot3.position.y = 8.5;
    torusKnot3.position.x = 20;
    torusKnot3.position.z = 0;
    torusKnot3.castShadow = true;
    torusKnot3.receiveShadow = true;
    scene.add(torusKnot3);
    const torusKnotShadow = new ShadowMesh(torusKnot);
    scene.add(torusKnotShadow);
    const torusKnotShadow2 = new ShadowMesh(torusKnot2);
    torusKnotShadow2.material.color = new THREE.Color(1.0, 0.4, 0.4);
    torusKnotShadow2.material.opacity = 1.0;
    torusKnotShadow2.material.blending = THREE.MultiplyBlending;
    scene.add(torusKnotShadow2);
    const torusKnotShadow3 = new ShadowMesh(torusKnot3);
    torusKnotShadow3.material.color = new THREE.Color(0.4, 0.4, 1.0);
    torusKnotShadow3.material.opacity = 1.0;
    torusKnotShadow3.material.blending = THREE.MultiplyBlending;
    scene.add(torusKnotShadow3);
    torusKnotShadow.userData.treatAsOpaque = true;
    torusKnotShadow2.userData.treatAsOpaque = false;
    torusKnotShadow3.userData.treatAsOpaque = false;
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
    const lightPos4d = new THREE.Vector4(50, 100, 50, 0);
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("./draco/");
    loader.setDRACOLoader(dracoLoader);
    const sponza = (await loader.loadAsync("sponza_cd.glb")).scene;
    sponza.traverse(object => {
        if (object.material) {
            object.material.envMap = environment;
            if (object.material.map) {
                object.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
            }
        }
    })
    sponza.scale.set(10, 10, 10)
    scene.add(sponza);
    const effectController = {
        aoSamples: 16.0,
        denoiseSamples: 8.0,
        denoiseRadius: 12.0,
        aoRadius: 5.0,
        distanceFalloff: 1.0,
        screenSpaceRadius: false,
        halfRes: false,
        depthAwareUpsampling: true,
        transparencyAware: true,
        intensity: 5.0,
        renderMode: "Combined",
        color: [0, 0, 0],
        colorMultiply: true,
        accumulate: false,
        flareAmount: 64,
        opacity: 0.8,
        starPoints: 5.0,
        glareSize: 0.55,
        flareSize: 0.004,
        flareSpeed: 0.4,
        flareShape: 1.2,
        anamorphic: false,
        secondaryGhosts: true,
        ghostScale: 0.3,
        additionalStreaks: true,
    };
    const gui = new GUI();
    gui.add(effectController, "flareAmount", 0, 512, 2).onChange((value) => {
        CURR_FLARES = value;
    });
    gui.add(effectController, "opacity", 0, 1, 0.01);
    gui.add(effectController, "starPoints", 0, 10, 1);
    gui.add(effectController, "glareSize", 0, 1, 0.01);
    gui.add(effectController, "flareSize", 0, 0.01, 0.0001);
    gui.add(effectController, "flareSpeed", 0, 1, 0.01);
    gui.add(effectController, "flareShape", 0, 2, 0.01);
    gui.add(effectController, "anamorphic");
    gui.add(effectController, "secondaryGhosts");
    gui.add(effectController, "ghostScale", 0, 1, 0.01);
    gui.add(effectController, "additionalStreaks");

    // Post Effects
    //  const composer = new EffectComposer(renderer);
    /* const n8aopass = new N8AOPass(
         scene,
         camera,
         clientWidth,
         clientHeight
     );
     const smaaPass = new SMAAPass(clientWidth, clientHeight);
     composer.addPass(n8aopass);
     composer.addPass(smaaPass);*/
    const composer = new EffectComposer(renderer, {
        stencilBuffer: true,
        depthBuffer: true,
        frameBufferType: THREE.HalfFloatType
    });
    const renderPass = new RenderPass(scene, camera);
    renderPass.clearPass.setClearFlags(true, true, true);
    composer.addPass(renderPass);
    const n8aopass = new N8AOPostPass(
        scene,
        camera,
        clientWidth,
        clientHeight
    );
    let flares = [];
    const MAX_FLARES = 512;
    let CURR_FLARES = 64;
    for (let i = 0; i < MAX_FLARES; i++) {
        const flare = new Flare({
            position: new THREE.Vector3(Math.random() * 100 - 50, Math.random() * 20, Math.random() * 20 - 10),
            colorGain: new THREE.Color(Math.random(), Math.random(), Math.random()),
            angle: Math.random() * Math.PI * 2,
            // position: new THREE.Vector3(0, 10, 0),
        });
        flares.push(flare);
    }
    const catmullromArc = new THREE.CatmullRomCurve3([
        new THREE.Vector3(80, 10, -30),
        new THREE.Vector3(80, 10, 30),
        new THREE.Vector3(-80, 10, 30),
        new THREE.Vector3(-80, 10, -30),
    ], true, 'centripetal', 0);

    const lensFlarePass = new LensFlarePass(scene, camera, flares, {
        coverageScale: 2.0
    });
    lensFlarePass.doTransparency = true;
    composer.addPass(n8aopass);
    n8aopass.renderToScreen = false;
    composer.addPass(lensFlarePass);
    composer.addPass(new EffectPass(camera, new SMAAEffect({
        preset: SMAAPreset.ULTRA
    })));

    window.addEventListener("resize", () => {
        clientWidth = window.innerWidth;
        clientHeight = window.innerHeight;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight);
        composer.setSize(clientWidth, clientHeight);
    });
    const timerDOM = document.getElementById("aoTime");
    const aoMeta = document.getElementById("aoMetadata");
    n8aopass.enableDebugMode();
    torusKnotShadow.userData.treatAsOpaque = true;
    const clock = new THREE.Clock();
    /* scene.add(new THREE.Mesh(
         new THREE.SphereGeometry(1, 32, 32).translate(0, 20, 0),
         new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false })
     ))*/

    function animate() {
        aoMeta.innerHTML = `${clientWidth}x${clientHeight}`
        const spin = 2 * clock.getDelta();
        if (!effectController.accumulate) {
            torusKnot.rotation.x += spin;
            torusKnot.rotation.y += spin;
            torusKnot2.rotation.x += spin;
            torusKnot2.rotation.y += spin;
            torusKnot3.rotation.x += spin;
            torusKnot3.rotation.y += spin;
        }
        torusKnot2.material.opacity = Math.sin(performance.now() * 0.001) * 0.5 + 0.5;
        torusKnot3.material.opacity = Math.cos(performance.now() * 0.001) * 0.5 + 0.5;
        torusKnotShadow2.material.color.g = 1 - 0.6 * torusKnot2.material.opacity;
        torusKnotShadow2.material.color.b = 1 - 0.6 * torusKnot2.material.opacity;
        torusKnotShadow3.material.color.r = 1 - 0.6 * torusKnot3.material.opacity;
        torusKnotShadow3.material.color.g = 1 - 0.6 * torusKnot3.material.opacity;
        torusKnotShadow.update(
            groundPlane,
            lightPos4d
        );
        torusKnotShadow2.update(
            groundPlane,
            lightPos4d
        );
        torusKnotShadow3.update(
            groundPlane,
            lightPos4d
        );
        for (let i = 0; i < CURR_FLARES / 2; i++) {
            flares[i].position.copy(catmullromArc.getPointAt((i / (CURR_FLARES / 2) + performance.now() / 50000.0) % 1));
        }
        for (let i = CURR_FLARES / 2; i < CURR_FLARES; i++) {
            flares[i].position.copy(catmullromArc.getPointAt(((i - CURR_FLARES / 2) / (CURR_FLARES / 2) + performance.now() / 50000.0) % 1));
            flares[i].position.y += 40;
        }
        for (let i = 0; i < MAX_FLARES; i++) {
            if (i < CURR_FLARES) {
                flares[i].visible = true;
            } else {
                flares[i].visible = false;
            }
            flares[i].opacity = effectController.opacity;
            flares[i].starPoints = effectController.starPoints;
            flares[i].glareSize = effectController.glareSize;
            flares[i].flareSize = effectController.flareSize;
            flares[i].flareSpeed = effectController.flareSpeed;
            flares[i].flareShape = effectController.flareShape;
            flares[i].anamorphic = effectController.anamorphic;
            flares[i].secondaryGhosts = effectController.secondaryGhosts;
            flares[i].ghostScale = effectController.ghostScale;
            flares[i].additionalStreaks = effectController.additionalStreaks;
        }



        n8aopass.configuration.aoRadius = effectController.aoRadius;
        n8aopass.configuration.distanceFalloff = effectController.distanceFalloff;
        n8aopass.configuration.intensity = effectController.intensity;
        n8aopass.configuration.aoSamples = effectController.aoSamples;
        n8aopass.configuration.denoiseRadius = effectController.denoiseRadius;
        n8aopass.configuration.denoiseSamples = effectController.denoiseSamples;
        n8aopass.configuration.renderMode = ["Combined", "AO", "No AO", "Split", "Split AO"].indexOf(effectController.renderMode);
        n8aopass.configuration.color = new THREE.Color(effectController.color[0], effectController.color[1], effectController.color[2]);
        n8aopass.configuration.screenSpaceRadius = effectController.screenSpaceRadius;
        n8aopass.configuration.halfRes = effectController.halfRes;
        n8aopass.configuration.depthAwareUpsampling = effectController.depthAwareUpsampling;
        n8aopass.configuration.colorMultiply = effectController.colorMultiply;
        n8aopass.configuration.accumulate = effectController.accumulate;
        composer.render();
        timerDOM.innerHTML = n8aopass.lastTime.toFixed(2);
        controls.update();
        stats.update();
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}
main();