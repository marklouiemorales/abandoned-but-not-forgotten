import * as THREE from 'three';

export function setupPlanetRaycaster(planet, onHardwareSelected) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const container = planet.renderer.domElement;

  function onClick(event) {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, planet.camera);
    const intersects = raycaster.intersectObjects(planet.pivot.children, true);

    if (intersects.length > 0) {
      planet.state.autoRotate = false;
      onHardwareSelected(intersects[0].object);
    }
  }

  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}