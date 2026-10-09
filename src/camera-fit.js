import * as THREE from 'three';

// Fit the real projected route envelope, rather than shrinking the board by a
// fixed percentage of the entire screen. Scenery is deliberately allowed to crop.
export function frameBoard(camera, width, height, outerRadius) {
  camera.aspect = width / height;
  const landscape = width / height > 1.05;
  const top = landscape ? 98 : 140;
  const bottom = landscape ? 80 : 154;
  const bounds = {
    left: -0.965, right: 0.965,
    top: 1 - 2 * Math.min(top, height * .20) / height,
    bottom: -1 + 2 * Math.min(bottom, height * .23) / height,
  };
  const direction = new THREE.Vector3(0, 1, .43).normalize();
  const samples = [];
  for (let i = 0; i < 128; i++) {
    const angle = i / 128 * Math.PI * 2;
    for (const y of [-.63, .55, 1.38]) {
      samples.push(new THREE.Vector3(Math.cos(angle) * (outerRadius + .04), y, Math.sin(angle) * (outerRadius + .04)));
    }
  }
  function position(distance) {
    camera.position.copy(direction).multiplyScalar(distance);
    camera.lookAt(0, .22, 0);
    camera.near = .1;
    camera.far = distance + 120;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }
  function envelope(distance) {
    position(distance);
    const result = {left: 1, right: -1, bottom: 1, top: -1};
    for (const point of samples) {
      const p = point.clone().project(camera);
      result.left = Math.min(result.left, p.x);
      result.right = Math.max(result.right, p.x);
      result.bottom = Math.min(result.bottom, p.y);
      result.top = Math.max(result.top, p.y);
    }
    return result;
  }
  function fits(distance) {
    const result = envelope(distance);
    return result.right - result.left <= bounds.right - bounds.left && result.top - result.bottom <= bounds.top - bounds.bottom;
  }
  let low = outerRadius * 1.15, high = outerRadius * 20;
  for (let i = 0; i < 34; i++) {
    const middle = (low + high) / 2;
    if (fits(middle)) high = middle;
    else low = middle;
  }
  const result = envelope(high);
  // Center the route inside the free space between the HUD and touch controls.
  const offset = ((bounds.top + bounds.bottom) - (result.top + result.bottom)) * height / 4;
  camera.setViewOffset(width, height, 0, offset, width, height);
  camera.updateProjectionMatrix();
  return { distance: high, bounds };
}
