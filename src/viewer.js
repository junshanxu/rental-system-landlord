import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

export async function mountViewer(element, url, { upAxis = 'Z', onStatus = () => {} } = {}) {
  let renderer, controls, splat, spark, observer, disposed = false;
  const abort = new AbortController();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, .01, 1000);
  function dispose() {
    if (disposed) return;
    disposed = true; abort.abort(); observer?.disconnect();
    renderer?.setAnimationLoop(null); controls?.dispose(); splat?.dispose(); spark?.dispose();
    renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
  }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor('#edf0f4');
    element.replaceChildren(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '三维空间预览，可拖动旋转、滚轮缩放');
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false;
    spark = new SparkRenderer({ renderer }); scene.add(spark);
    onStatus('正在读取三维模型…');
    const response = await fetch(url, { signal: abort.signal, credentials: url.startsWith('/') ? 'same-origin' : 'omit' });
    if (!response.ok) throw new Error(`模型读取失败（${response.status}）。`);
    const bytes = await response.arrayBuffer();
    splat = new SplatMesh({ fileBytes: bytes, fileName: url.includes('.ply') ? 'room.ply' : 'room.spz' });
    await splat.initialized;
    if (upAxis === 'Z') splat.rotation.x = -Math.PI / 2;
    scene.add(splat); splat.updateMatrixWorld(true);
    const box = splat.getBoundingBox(true).applyMatrix4(splat.matrixWorld);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const distance = Math.max(.8, Math.min(25, size * .62));
    const reset = () => { camera.position.copy(center).add(new THREE.Vector3(distance * .65, distance * .38, distance * .9)); controls.target.copy(center); controls.update(); };
    controls.minDistance = Math.max(.15, distance * .1); controls.maxDistance = distance * 2.5;
    reset();
    const resize = () => { const { width, height } = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    observer = new ResizeObserver(resize); observer.observe(element); resize();
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    onStatus('模型已加载 · 拖动旋转 / 双指缩放');
    return { dispose, reset };
  } catch (error) { dispose(); throw error; }
}
