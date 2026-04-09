import * as THREE from 'three';

/**
 * MolecularViewSystem handles the camera zoom to molecular level
 * and creates molecular visualizations
 */
export class MolecularViewSystem {
    constructor(scene, camera, controls) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.molecularGroup = null;
        this.isInMolecularView = false;
        this.normalCameraState = null;
        this.currentMaterialType = null; // 'salt', 'sugar', or 'sand'
    }

    /**
     * Transition to molecular view
     */
    enterMolecularView(materialType, beakerPosition, waterLevel) {
        if (this.isInMolecularView) return;

        // Save current camera state
        this.normalCameraState = {
            position: this.camera.position.clone(),
            target: this.controls.target.clone(),
        };

        this.currentMaterialType = materialType;
        this.isInMolecularView = true;

        // Create molecular visualization
        this.createMolecularScene(materialType, beakerPosition, waterLevel);

        // Calculate zoom position (very close to water surface)
        const waterHeight = (waterLevel / 100) * 3.0;
        const targetPosition = new THREE.Vector3(
            beakerPosition.x,
            beakerPosition.y + waterHeight * 0.7,
            beakerPosition.z
        );
        const cameraPosition = new THREE.Vector3(
            beakerPosition.x + 0.3,
            beakerPosition.y + waterHeight * 0.7,
            beakerPosition.z + 0.3
        );

        // Animate camera transition
        this.animateCameraTransition(cameraPosition, targetPosition, 2000);
    }

    /**
     * Exit molecular view and return to normal view
     */
    exitMolecularView() {
        if (!this.isInMolecularView || !this.normalCameraState) return;

        this.isInMolecularView = false;

        // Animate back to normal view
        this.animateCameraTransition(
            this.normalCameraState.position,
            this.normalCameraState.target,
            2000,
            () => {
                // Remove molecular scene after transition
                this.clearMolecularScene();
            }
        );
    }

    /**
     * Create molecular visualization based on material type
     */
    createMolecularScene(materialType, beakerPosition, waterLevel) {
        this.clearMolecularScene();

        this.molecularGroup = new THREE.Group();
        const waterHeight = (waterLevel / 100) * 3.0;

        // Create water molecules (H2O) - always present
        this.createWaterMolecules(beakerPosition, waterHeight);

        // Create material-specific molecules
        if (materialType === 'salt' || materialType === 'sugar') {
            this.createDissolvedIons(materialType, beakerPosition, waterHeight);
        } else if (materialType === 'sand') {
            this.createSandParticles(beakerPosition, waterHeight);
        }

        this.scene.add(this.molecularGroup);
    }

    /**
     * Create water molecules (simplified H2O representation)
     */
    createWaterMolecules(beakerPosition, waterHeight) {
        const moleculeCount = 800;
        const spacing = 0.08;

        // Oxygen atom (red)
        const oxygenGeometry = new THREE.SphereGeometry(0.025, 16, 16);
        const oxygenMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3333,
            metalness: 0.3,
            roughness: 0.5,
        });

        // Hydrogen atom (white)
        const hydrogenGeometry = new THREE.SphereGeometry(0.015, 12, 12);
        const hydrogenMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.3,
            roughness: 0.5,
        });

        for (let i = 0; i < moleculeCount; i++) {
            const molecule = new THREE.Group();

            // Oxygen
            const oxygen = new THREE.Mesh(oxygenGeometry, oxygenMaterial);
            molecule.add(oxygen);

            // Two hydrogen atoms
            const h1 = new THREE.Mesh(hydrogenGeometry, hydrogenMaterial);
            h1.position.set(0.03, 0.02, 0);
            molecule.add(h1);

            const h2 = new THREE.Mesh(hydrogenGeometry, hydrogenMaterial);
            h2.position.set(-0.03, 0.02, 0);
            molecule.add(h2);

            // Random position in water volume
            const x = beakerPosition.x + (Math.random() - 0.5) * 0.6;
            const y = beakerPosition.y + Math.random() * waterHeight;
            const z = beakerPosition.z + (Math.random() - 0.5) * 0.6;

            molecule.position.set(x, y, z);
            molecule.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            this.molecularGroup.add(molecule);
        }
    }

    /**
     * Create dissolved ions (for salt/sugar)
     */
    createDissolvedIons(materialType, beakerPosition, waterHeight) {
        const ionCount = 200;

        let ionGeometry, ionMaterial, ionColor, ionSize;

        if (materialType === 'salt') {
            // Sodium (Na+) and Chloride (Cl-) ions
            ionGeometry = new THREE.SphereGeometry(0.012, 12, 12);
            ionColor = 0x88ff88; // Green for ions
            ionSize = 0.012;
        } else {
            // Sugar molecules (simplified)
            ionGeometry = new THREE.SphereGeometry(0.018, 12, 12);
            ionColor = 0xffffaa; // Yellowish
            ionSize = 0.018;
        }

        ionMaterial = new THREE.MeshStandardMaterial({
            color: ionColor,
            metalness: 0.4,
            roughness: 0.4,
            transparent: true,
            opacity: 0.7,
        });

        for (let i = 0; i < ionCount; i++) {
            const ion = new THREE.Mesh(ionGeometry, ionMaterial);

            // Position between water molecules (in the gaps)
            const x = beakerPosition.x + (Math.random() - 0.5) * 0.6;
            const y = beakerPosition.y + Math.random() * waterHeight;
            const z = beakerPosition.z + (Math.random() - 0.5) * 0.6;

            ion.position.set(x, y, z);
            this.molecularGroup.add(ion);
        }
    }

    /**
     * Create sand particles at molecular level
     */
    createSandParticles(beakerPosition, waterHeight) {
        const particleCount = 50;

        // Sand particles are MUCH larger than water molecules
        const particleGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const particleMaterial = new THREE.MeshStandardMaterial({
            color: 0xc2b280,
            metalness: 0.1,
            roughness: 0.9,
        });

        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            // Mostly near bottom
            const x = beakerPosition.x + (Math.random() - 0.5) * 0.6;
            const y = beakerPosition.y + Math.random() * (waterHeight * 0.3);
            const z = beakerPosition.z + (Math.random() - 0.5) * 0.6;

            particle.position.set(x, y, z);
            this.molecularGroup.add(particle);
        }
    }

    /**
     * Animate camera transition
     */
    animateCameraTransition(targetPosition, targetLookAt, duration, onComplete = null) {
        const startPosition = this.camera.position.clone();
        const startLookAt = this.controls.target.clone();
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease in-out cubic
            const easeProgress = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // Interpolate position
            this.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
            this.controls.target.lerpVectors(startLookAt, targetLookAt, easeProgress);
            this.controls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (onComplete) onComplete();
            }
        };

        animate();
    }

    /**
     * Clear molecular scene
     */
    clearMolecularScene() {
        if (this.molecularGroup) {
            this.molecularGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.scene.remove(this.molecularGroup);
            this.molecularGroup = null;
        }
    }

    /**
     * Check if currently in molecular view
     */
    isInMolecular() {
        return this.isInMolecularView;
    }

    /**
     * Dispose resources
     */
    dispose() {
        this.clearMolecularScene();
    }
}
