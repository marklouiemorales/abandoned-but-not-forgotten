import * as THREE from 'three';

export function setupMoonRaycaster(moon, onHardwareSelected) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const container = moon.renderer.domElement;

  container.addEventListener('click', (event) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, moon.camera);
    const intersects = raycaster.intersectObjects(moon.moonPivot.children, true);

    if (intersects.length > 0) {
      moon.state.autoRotate = false;
      onHardwareSelected(intersects[0].object);
    }
  });
}