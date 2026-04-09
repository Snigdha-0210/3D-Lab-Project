import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

/**
 * ParticleSystem creates and animates particles for materials
 * - Dissolving particles (salt, sugar)
 * - Settling particles (sand)
 */
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.activeParticleSystems = [];
        this.textureLoader = new THREE.TextureLoader();

        // Pre-load sand textures to avoid flickering/reloads
        this.sandTextures = {
            baseColor: this.textureLoader.load('/sand texture/Material.001_baseColor.png'),
            normal: this.textureLoader.load('/sand texture/Material.001_normal.png'),
            roughness: this.textureLoader.load('/sand texture/Material.001_metallicRoughness.png')
        };

        // Configure wrapping
        Object.values(this.sandTextures).forEach(texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
        });

        // Pre-load Book GLB if needed, or just rely on fallback for particles since we verify the main object elsewhere
        this.bookGeometry = null;
        const gltfLoader = new GLTFLoader();
        // Optional: Pre-load for particle system if we want book-shaped particles
        /*
        gltfLoader.load('/book.glb', (gltf) => {
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    this.bookGeometry = child.geometry.clone();
                }
            });
        });
        */
    }

    /**
     * Create dissolving particle effect
     */
    createDissolvingParticles(material, beakerObject, waterLevel) {
        const particleCount = material.particleCount;

        // Use material-specific geometry shapes
        let geometry;
        if (material.name === 'Salt') {
            // Salt crystals are cubic
            geometry = new THREE.BoxGeometry(material.particleSize, material.particleSize, material.particleSize);
        } else if (material.name === 'Sugar') {
            // Sugar crystals are elongated prisms
            geometry = new THREE.BoxGeometry(material.particleSize * 0.6, material.particleSize * 1.5, material.particleSize * 0.6);
        } else {
            // Default sphere for other materials
            geometry = new THREE.SphereGeometry(material.particleSize, 8, 8);
        }

        const particleMaterial = new THREE.MeshStandardMaterial({
            color: material.color,
            transparent: true,
            opacity: material.opacity,
            metalness: 0.3,
            roughness: 0.4,
        });

        const instancedMesh = new THREE.InstancedMesh(geometry, particleMaterial, particleCount);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        // Initialize particle positions and velocities
        const particles = [];
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);

        const waterHeight = (waterLevel / 100) * 3.0; // Convert mL to height

        for (let i = 0; i < particleCount; i++) {
            // Start at top, slightly randomized (relative to beaker)
            const x = (Math.random() - 0.5) * 0.5;
            const y = waterHeight + Math.random() * 0.3;
            const z = (Math.random() - 0.5) * 0.5;

            position.set(x, y, z);

            // Random rotation for natural crystal appearance
            rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            quaternion.setFromEuler(rotation);
            matrix.compose(position, quaternion, scale);
            instancedMesh.setMatrixAt(i, matrix);

            particles.push({
                position: position.clone(),
                rotation: rotation.clone(),
                rotationSpeed: new THREE.Euler(
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1
                ),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.01,
                    -0.02 - Math.random() * 0.01,
                    (Math.random() - 0.5) * 0.01
                ),
                swirl: Math.random() * Math.PI * 2,
                swirlSpeed: (Math.random() - 0.5) * 0.05,
            });
        }

        instancedMesh.instanceMatrix.needsUpdate = true;

        // Make particles children of beaker so they move together
        if (beakerObject && beakerObject.isObject3D) {
            beakerObject.add(instancedMesh);
        } else {
            this.scene.add(instancedMesh);
        }

        // Animation state
        const particleSystem = {
            mesh: instancedMesh,
            particles,
            material: particleMaterial,
            startTime: Date.now(),
            duration: material.dissolutionTime,
            beakerObject,
            waterHeight,
            type: 'dissolving',
            complete: false,
        };

        this.activeParticleSystems.push(particleSystem);
        return particleSystem;
    }

    /**
     * Create settling particle effect (for sand)
     */
    createSettlingParticles(material, beakerObject, waterLevel) {
        const particleCount = material.particleCount;
        let geometry;
        if (material.name === 'Book') {
            geometry = new THREE.BoxGeometry(material.particleSize * 3, material.particleSize * 0.5, material.particleSize * 4);
        } else if (material.name === 'Wooden Stick') {
            geometry = new THREE.CylinderGeometry(material.particleSize * 0.2, material.particleSize * 0.2, material.particleSize * 6, 8);
            geometry.rotateX(Math.PI / 2);
        } else if (material.name === 'Pen') {
            geometry = new THREE.CylinderGeometry(material.particleSize * 0.1, material.particleSize * 0.1, material.particleSize * 3, 12);
            geometry.rotateX(Math.PI / 2);
        } else if (material.name === 'Needle') {
            geometry = new THREE.CylinderGeometry(material.particleSize * 0.1, material.particleSize * 0.1, material.particleSize * 5, 8);
            geometry.rotateX(Math.PI / 2);
        } else {
            // Fallback or original sand behavior
            geometry = new THREE.IcosahedronGeometry(material.particleSize, 0);
        }

        const particleMaterial = new THREE.MeshStandardMaterial({
            vertexColors: false, // Use material color for single items
            color: material.color,
            color: material.color,
            metalness: 0.1,
            roughness: 0.8,
        });

        const instancedMesh = new THREE.InstancedMesh(geometry, particleMaterial, particleCount);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        // Create colors for each instance (only needed if we want variation, but for single items we stick to main color)
        // We'll keep the logic generic if multiple particles are ever requested
        const colors = new Float32Array(particleCount * 3);
        const color = new THREE.Color();
        const baseColor = new THREE.Color(material.color);

        for (let i = 0; i < particleCount; i++) {
            color.copy(baseColor);
            // Only add variation if it's a multi-particle substance
            if (particleCount > 10) {
                const h = (Math.random() - 0.5) * 0.05;
                const s = (Math.random() - 0.5) * 0.1;
                const v = (Math.random() - 0.5) * 0.2;
                const hsl = {};
                color.getHSL(hsl);
                color.setHSL(
                    THREE.MathUtils.clamp(hsl.h + h, 0, 1),
                    THREE.MathUtils.clamp(hsl.s + s, 0, 1),
                    THREE.MathUtils.clamp(hsl.l + v, 0, 1)
                );
            }
            instancedMesh.setColorAt(i, color);
        }
        instancedMesh.instanceColor.needsUpdate = true;

        const particles = [];
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);

        const waterHeight = (waterLevel / 100) * 7.0; // Match water height calculation

        // Spawn in small area above beaker opening
        let spawnRadius = 1.0;
        if (particleCount === 1) spawnRadius = 0.1; // Center single items

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * spawnRadius;
            const x = Math.cos(angle) * dist;
            // Start from just above the water level, staggered
            const y = waterHeight + 1.0 + (i * 0.02);
            const z = Math.sin(angle) * dist;

            position.set(x, y, z);

            // Random rotation for natural grain appearance
            rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            quaternion.setFromEuler(rotation);
            matrix.compose(position, quaternion, scale);
            instancedMesh.setMatrixAt(i, matrix);

            particles.push({
                position: position.clone(),
                rotation: rotation.clone(),
                rotationSpeed: new THREE.Euler(
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1
                ),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    -0.04 - Math.random() * 0.02, // Starting downward velocity
                    (Math.random() - 0.5) * 0.02
                ),
                settled: false,
            });
        }

        instancedMesh.instanceMatrix.needsUpdate = true;

        // Make particles children of beaker so they move together
        if (beakerObject && beakerObject.isObject3D) {
            beakerObject.add(instancedMesh);
        } else {
            this.scene.add(instancedMesh);
        }

        const particleSystem = {
            mesh: instancedMesh,
            particles,
            material: particleMaterial,
            startTime: Date.now(),
            duration: material.settlingTime,
            beakerObject,
            waterHeight,
            type: 'settling',
            complete: false,
        };

        this.activeParticleSystems.push(particleSystem);
        return particleSystem;
    }

    /**
     * Update all active particle systems
     */
    update() {
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);

        this.activeParticleSystems.forEach((system, index) => {
            const elapsed = Date.now() - system.startTime;
            const progress = Math.min(elapsed / system.duration, 1);

            if (system.type === 'dissolving') {
                // Update dissolving particles
                system.particles.forEach((particle, i) => {
                    // Update rotation (tumbling)
                    particle.rotation.x += particle.rotationSpeed.x;
                    particle.rotation.y += particle.rotationSpeed.y;
                    particle.rotation.z += particle.rotationSpeed.z;

                    // Brownian motion + swirl + downward drift
                    particle.swirl += particle.swirlSpeed;
                    particle.velocity.x = Math.cos(particle.swirl) * 0.008;
                    particle.velocity.z = Math.sin(particle.swirl) * 0.008;

                    particle.position.add(particle.velocity);

                    // Keep within beaker bounds (relative coordinates)
                    const beakerRadius = 0.7;
                    const distFromCenter = Math.sqrt(
                        Math.pow(particle.position.x, 2) +
                        Math.pow(particle.position.z, 2)
                    );

                    if (distFromCenter > beakerRadius) {
                        const angle = Math.atan2(particle.position.z, particle.position.x);
                        particle.position.x = Math.cos(angle) * beakerRadius;
                        particle.position.z = Math.sin(angle) * beakerRadius;
                    }

                    // Constrain to water volume (relative coordinates)
                    const minY = 0.1;
                    const maxY = system.waterHeight;
                    particle.position.y = THREE.MathUtils.clamp(particle.position.y, minY, maxY);

                    quaternion.setFromEuler(particle.rotation);
                    matrix.compose(particle.position, quaternion, scale);
                    system.mesh.setMatrixAt(i, matrix);
                });

                // Fade out as dissolution progresses
                system.material.opacity = (1 - progress) * 0.9;

                system.mesh.instanceMatrix.needsUpdate = true;

                // Mark complete and remove
                if (progress >= 1) {
                    system.complete = true;
                }
            } else if (system.type === 'settling') {
                // Update settling particles - simple gravity-based falling
                system.particles.forEach((particle, i) => {
                    if (!particle.settled) {
                        // Update rotation (tumbling)
                        particle.rotation.x += particle.rotationSpeed.x;
                        particle.rotation.y += particle.rotationSpeed.y;
                        particle.rotation.z += particle.rotationSpeed.z;

                        // Simple gravity
                        particle.velocity.y += -0.005;
                        particle.position.add(particle.velocity);

                        // Check if settled at bottom
                        const bottomY = 0.8;
                        if (particle.position.y <= bottomY) {
                            // Settled - spread out at bottom more naturally
                            particle.position.y = bottomY + Math.random() * 0.2;
                            // Add slight horizontal spread on impact
                            particle.position.x += (Math.random() - 0.5) * 0.1;
                            particle.position.z += (Math.random() - 0.5) * 0.1;

                            particle.velocity.set(0, 0, 0);
                            particle.settled = true;
                        }
                    }

                    quaternion.setFromEuler(particle.rotation);
                    matrix.compose(particle.position, quaternion, scale);
                    system.mesh.setMatrixAt(i, matrix);
                });

                system.mesh.instanceMatrix.needsUpdate = true;

                // Check if all settled
                const allSettled = system.particles.every((p) => p.settled);
                if (allSettled || progress >= 1) {
                    system.complete = true;
                }
            }
        });

        // Remove completed dissolving systems (keep settling systems visible)
        this.activeParticleSystems = this.activeParticleSystems.filter((system) => {
            if (system.complete && system.type === 'dissolving') {
                this.scene.remove(system.mesh);
                system.mesh.geometry.dispose();
                system.material.dispose();
                return false;
            }
            return true;
        });
    }

    /**
     * Remove all particles
     */
    clear() {
        this.activeParticleSystems.forEach((system) => {
            this.scene.remove(system.mesh);
            system.mesh.geometry.dispose();
            system.material.dispose();
        });
        this.activeParticleSystems = [];
    }

    /**
     * Dispose resources
     */
    dispose() {
        this.clear();
    }
}
