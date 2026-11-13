import * as THREE from 'three';

export type ViewMode = 'first' | 'third';

export interface RigLimits {
  minPitch: number;
  maxPitch: number;
  /** Maximum yaw away from the base direction (undefined = free 360° orbit). */
  yawLimit?: number;
  distance: number;
  /** Height of the third-person pivot above the head. */
  lift: number;
}

/**
 * First / third person camera around a character. `yaw` and `pitch` are the player's look
 * offsets (drag, look pad, right mouse button); the rig turns them into a camera pose.
 */
export class CameraRig {
  yaw = 0;
  pitch = -0.2;
  mode: ViewMode = 'third';
  private current = new THREE.Vector3();
  private started = false;

  look(dx: number, dy: number, limits: RigLimits): void {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, limits.minPitch, limits.maxPitch);
    if (limits.yawLimit !== undefined)
      this.yaw = THREE.MathUtils.clamp(this.yaw, -limits.yawLimit, limits.yawLimit);
    else this.yaw = ((this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  }

  /** Unit vector the camera looks along, for a base yaw (0 = towards -z). */
  forward(baseYaw: number, out = new THREE.Vector3()): THREE.Vector3 {
    const yaw = baseYaw + this.yaw;
    const c = Math.cos(this.pitch);
    return out.set(-Math.sin(yaw) * c, Math.sin(this.pitch), -Math.cos(yaw) * c);
  }

  /** Places the camera. `head` is the character's eye position in world space. */
  apply(camera: THREE.Camera, head: THREE.Vector3, baseYaw: number, limits: RigLimits, dt: number): void {
    const f = this.forward(baseYaw);
    if (this.mode === 'first') {
      camera.position.copy(head);
      camera.lookAt(head.x + f.x, head.y + f.y, head.z + f.z);
      this.started = false;
      return;
    }
    const pivot = new THREE.Vector3(head.x, head.y + limits.lift, head.z);
    const target = pivot.clone().addScaledVector(f, -limits.distance);
    target.y = Math.max(target.y, 0.6);
    if (!this.started) {
      this.current.copy(target);
      this.started = true;
    } else {
      this.current.lerp(target, Math.min(1, dt * 10));
    }
    camera.position.copy(this.current);
    camera.lookAt(pivot);
  }
}
