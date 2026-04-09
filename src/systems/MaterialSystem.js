/**
 * MaterialSystem defines properties for different materials
 * and manages their behavior in water
 */
export class MaterialSystem {
    constructor() {
        this.materials = {
            book: {
                name: 'Book',
                dissolves: false,
                particleSize: 0.2,
                particleCount: 1,
                color: 0x3366cc,    // Blue cover
                opacity: 1.0,
                volumeDisplacement: 5, // Larger displacement
                settlingTime: 500,
                cloudiness: 0.0,
                waterColorChange: 0xeeeeee,
            },
            wooden_stick: {
                name: 'Wooden Stick',
                dissolves: false,
                particleSize: 0.1,
                particleCount: 1,
                color: 0x8B4513,    // SaddleBrown
                opacity: 1.0,
                volumeDisplacement: 3,
                settlingTime: 500,
                cloudiness: 0.0,
                waterColorChange: 0xeeeeee,
            },
            pen: {
                name: 'Pen',
                dissolves: false,
                particleSize: 0.05,
                particleCount: 1,
                color: 0x0000FF,    // Blue
                opacity: 1.0,
                volumeDisplacement: 2,
                settlingTime: 500,
                cloudiness: 0.0,
                waterColorChange: 0xeeeeee,
            },
            needle: {
                name: 'Needle',
                dissolves: false,
                particleSize: 0.05,
                particleCount: 1,
                color: 0xC0C0C0,    // Silver
                opacity: 1.0,
                volumeDisplacement: 1,
                settlingTime: 500,
                cloudiness: 0.0,
                waterColorChange: 0xeeeeee,
            },
        };
    }

    /**
     * Get material properties
     */
    getMaterial(type) {
        return this.materials[type] || null;
    }

    /**
     * Check if material dissolves
     */
    doesDissolve(type) {
        const material = this.getMaterial(type);
        return material ? material.dissolves : false;
    }

    /**
     * Get volume displacement for material
     */
    getVolumeDisplacement(type) {
        const material = this.getMaterial(type);
        return material ? material.volumeDisplacement : 0;
    }

    /**
     * Get all available materials
     */
    getAllMaterials() {
        return Object.keys(this.materials);
    }
}
