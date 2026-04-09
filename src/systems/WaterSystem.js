import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

/**
 * WaterSystem manages water in the beaker
 * - Handles filling and draining
 * - Tracks water level and marks
 * - Renders realistic water with shaders
 */
export class WaterSystem {
    constructor(scene, beakerObject = null) {
        this.scene = scene;
        this.beakerObject = beakerObject;
        this.waterMesh = null;
        this.currentLevel = 0; // in mL
        this.markedLevel = null; // the initial level to mark
        this.maxLevel = 150; // 150 mL beaker (updated from 100)
        this.waterLevelMarker = null;
        this.beakerRadius = 3.0; // Updated to match actual beaker inner radius
        this.beakerHeight = 7.0; // approximate height

        this.createWaterMesh();
    }

    setBeakerObject(beakerObject) {
        this.beakerObject = beakerObject;
        // Update water position if it exists
        if (this.waterMesh && beakerObject) {
            this.updateWaterVisual();
        }
    }

    createWaterMesh() {
        // Load custom water mesh from Blender
        const loader = new GLTFLoader();

        loader.load('/Water.glb', (gltf) => {
            this.waterMesh = gltf.scene;

            // Apply water material to all meshes in the model
            this.waterMesh.traverse((child) => {
                if (child.isMesh) {
                    // Custom water shader for realistic look
                    const waterMaterial = new THREE.MeshPhysicalMaterial({
                        color: 0x2299ff,
                        transparent: true,
                        opacity: 0.6,
                        metalness: 0.1,
                        roughness: 0.1,
                        transmission: 0.9,
                        thickness: 0.5,
                        envMapIntensity: 1.5,
                        clearcoat: 0.3,
                        clearcoatRoughness: 0.2,
                        side: THREE.DoubleSide,
                    });

                    child.material = waterMaterial;
                    child.receiveShadow = true;
                    child.castShadow = true;
                }
            });

            this.waterMesh.visible = false; // Hidden until water is added

            // Store original scale for reference
            this.originalScale = this.waterMesh.scale.clone();

            this.scene.add(this.waterMesh);
        }, undefined, (error) => {
            console.error('Error loading Water.glb:', error);
            // Fallback: create simple cylinder if model fails to load
            this.createFallbackWater();
        });
    }

    createFallbackWater() {
        // Fallback cylinder if Water.glb fails to load
        const geometry = new THREE.CylinderGeometry(
            this.beakerRadius,
            this.beakerRadius - 0.2,
            0.1,
            64,
            1,
            false
        );


        // Custom water shader for realistic look
        const waterMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x2299ff,
            transparent: true,
            opacity: 0.6,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.9,
            thickness: 0.5,
            envMapIntensity: 1.5,
            clearcoat: 0.3,
            clearcoatRoughness: 0.2,
            side: THREE.DoubleSide,
        });

        this.waterMesh = new THREE.Mesh(geometry, waterMaterial);
        this.waterMesh.visible = false; // Hidden until water is added
        this.waterMesh.receiveShadow = true;
        this.waterMesh.castShadow = true;

        // Position at bottom of beaker
        this.waterMesh.position.y = 0.05;

        this.scene.add(this.waterMesh);
    }

    /**
     * Fill water to a specific level (in mL)
     */
    fillWater(targetLevel, duration = 2000) {
        if (targetLevel > this.maxLevel) targetLevel = this.maxLevel;

        const startLevel = this.currentLevel;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            this.currentLevel = startLevel + (targetLevel - startLevel) * easeProgress;
            this.updateWaterVisual();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();

        // Mark the level if this is the first fill
        if (this.markedLevel === null && targetLevel > 0) {
            this.markedLevel = targetLevel;
            this.createLevelMarker(targetLevel);
        }
    }

    /**
   * Update water visual based on current level
   */
    updateWaterVisual() {
        if (!this.waterMesh) return; // Wait for model to load

        if (this.currentLevel <= 0) {
            this.waterMesh.visible = false;
            return;
        }

        this.waterMesh.visible = true;

        // Calculate height based on volume (simplified cylindrical approximation)
        const targetHeight = (this.currentLevel / this.maxLevel) * this.beakerHeight;

        // Scale the water model vertically to match water level
        // Keep X and Z scale at 1.0 to match beaker size
        if (this.originalScale) {
            this.waterMesh.scale.set(
                this.originalScale.x,
                (targetHeight / this.beakerHeight), // Scale Y based on fill level
                this.originalScale.z
            );
        }

        // Position relative to beaker
        if (this.beakerObject) {
            // If water is not a child of beaker yet, make it one
            if (this.waterMesh.parent !== this.beakerObject) {
                this.scene.remove(this.waterMesh);
                this.beakerObject.add(this.waterMesh);
            }
            // Use local coordinates (relative to beaker)
            // Position at bottom of beaker, water will scale upward
            this.waterMesh.position.set(0, 0, 0);
        } else {
            // Fallback to world coordinates
            if (this.waterMesh.parent !== this.scene) {
                this.beakerObject?.remove(this.waterMesh);
                this.scene.add(this.waterMesh);
            }
            this.waterMesh.position.y = 0;
        }
    }

    /**
     * Create visual marker at the initial water level
     */
    createLevelMarker(level) {
        if (this.waterLevelMarker) {
            this.scene.remove(this.waterLevelMarker);
        }

        const height = (level / this.maxLevel) * this.beakerHeight;

        // Create a thin torus (ring) around the beaker at the marked level
        const markerGeometry = new THREE.TorusGeometry(this.beakerRadius + 0.08, 0.025, 8, 32);
        const markerMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3333,
            emissive: 0xff3333,
            emissiveIntensity: 0.8,
            metalness: 0.3,
            roughness: 0.4,
        });

        this.waterLevelMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.waterLevelMarker.rotation.x = Math.PI / 2;

        // Position relative to beaker if available
        if (this.beakerObject) {
            // Make marker a child of beaker so it moves together
            this.beakerObject.add(this.waterLevelMarker);
            // Use local coordinates (relative to beaker)
            this.waterLevelMarker.position.set(0, height, 0);
        } else {
            // Fallback to world coordinates
            this.scene.add(this.waterLevelMarker);
            this.waterLevelMarker.position.y = height;
        }
    }

    /**
     * Adjust water level (e.g., when sand is added)
     */
    adjustLevel(deltaML, duration = 1000) {
        const newLevel = Math.min(this.currentLevel + deltaML, this.maxLevel);
        this.fillWater(newLevel, duration);
    }

    /**
     * Change water color (e.g., when materials dissolve)
     */
    setWaterColor(color, opacity = null) {
        if (this.waterMesh && this.waterMesh.material) {
            this.waterMesh.material.color.set(color);
            if (opacity !== null) {
                this.waterMesh.material.opacity = opacity;
            }
        }
    }

    /**
     * Add cloudiness effect when materials dissolve
     */
    addCloudiness(amount = 0.1) {
        if (this.waterMesh && this.waterMesh.material) {
            const currentOpacity = this.waterMesh.material.opacity;
            this.waterMesh.material.opacity = Math.min(currentOpacity + amount, 0.8);
            this.waterMesh.material.transmission = Math.max(this.waterMesh.material.transmission - amount, 0.5);
        }
    }

    /**
     * Reset water system
     */
    reset() {
        this.currentLevel = 0;
        this.markedLevel = null;
        this.updateWaterVisual();

        if (this.waterLevelMarker) {
            this.scene.remove(this.waterLevelMarker);
            this.waterLevelMarker = null;
        }

        // Reset water appearance
        if (this.waterMesh && this.waterMesh.material) {
            this.waterMesh.material.color.set(0x2299ff);
            this.waterMesh.material.opacity = 0.6;
            this.waterMesh.material.transmission = 0.9;
        }
    }

    /**
     * Get current water level in mL
     */
    getCurrentLevel() {
        return this.currentLevel;
    }

    /**
     * Get marked level in mL
     */
    getMarkedLevel() {
        return this.markedLevel;
    }

    /**
     * Dispose resources
     */
    dispose() {
        if (this.waterMesh) {
            this.scene.remove(this.waterMesh);
            this.waterMesh.geometry.dispose();
            this.waterMesh.material.dispose();
        }

        if (this.waterLevelMarker) {
            this.scene.remove(this.waterLevelMarker);
            this.waterLevelMarker.geometry.dispose();
            this.waterLevelMarker.material.dispose();
        }
    }
}
