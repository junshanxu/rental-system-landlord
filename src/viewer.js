import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { createNavigation } from './viewer-navigation.js';
import { viewerMarkup, bindViewerControls } from './viewer-controls.js';

export async function mountViewer(element, url, { upAxis = 'Z', initialView, onStatus = () => {}, signal } = {}) {
  let renderer, controls, splat, spark, observer, interaction, disposed = false;
  const abort = new AbortController();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, .01, 1000);
  function dispose() {
    if (disposed) return;
    disposed = true; abort.abort(); signal?.removeEventListener('abort', dispose); observer?.disconnect(); interaction?.dispose();
    renderer?.setAnimationLoop(null); controls?.dispose(); splat?.dispose(); spark?.dispose();
    renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
  }
  signal?.addEventListener('abort', dispose, { once: true });
  try {
    if (signal?.aborted) throw new DOMException('预览已取消', 'AbortError');
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor('#edf0f4');
    element.classList.add('viewer-enhanced');
    element.innerHTML = viewerMarkup({ hasInitialView: Boolean(initialView) });
    const viewport = element.querySelector('.viewer-viewport');
    viewport.prepend(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '三维空间预览，模型加载中');
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = true;
    controls.rotateSpeed = .45; controls.dampingFactor = .22;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    const resize = () => {
      const { width, height } = viewport.getBoundingClientRect();
      if (!width || !height || disposed) return;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    observer = new ResizeObserver(resize); observer.observe(viewport); resize();
    spark = new SparkRenderer({ renderer }); scene.add(spark);
    onStatus('正在读取三维模型…');
    const response = await fetch(url, { signal: abort.signal, credentials: url.startsWith('/') ? 'same-origin' : 'omit' });
    if (!response.ok) throw new Error(`模型读取失败（${response.status}）。`);
    const bytes = await response.arrayBuffer();
    if (disposed) throw new DOMException('预览已取消', 'AbortError');
    splat = new SplatMesh({ fileBytes: bytes, fileName: url.includes('.ply') ? 'room.ply' : 'room.spz' });
    await splat.initialized;
    if (disposed) { splat.dispose(); throw new DOMException('预览已取消', 'AbortError'); }
    if (upAxis === 'Z') splat.rotation.x = -Math.PI / 2;
    scene.add(splat); splat.updateMatrixWorld(true);
    const box = splat.getBoundingBox(true).applyMatrix4(splat.matrixWorld);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    if (!Number.isFinite(size) || size <= 0) throw new Error('模型没有可用于预览的空间范围。');
    const distance = Math.max(.8, Math.min(25, size * .62));
    const view = initialView ? {
      position: new THREE.Vector3(...initialView.position).applyMatrix4(splat.matrixWorld),
      target: new THREE.Vector3(...initialView.target).applyMatrix4(splat.matrixWorld),
    } : undefined;
    const navigation = createNavigation(camera, controls, { center, distance, initialView: view });
    interaction = bindViewerControls(element, renderer.domElement, navigation, controls, { onStatus });
    viewport.querySelector('.viewer-loading').remove();
    let previousTime;
    renderer.setAnimationLoop(time => {
      const seconds = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, .08);
      previousTime = time; interaction.tick(seconds); controls.update(); renderer.render(scene, camera);
    });
    onStatus('模型已加载 · 可使用移动键、鼠标或触屏查看');
    return { dispose, reset: interaction.reset };
  } catch (error) { dispose(); throw error; }
}
