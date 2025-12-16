/**
 * EU Tyre Grade Test - Tyre Dispatch NZ
 * Now powered by UltimateBrakingPhysics v3.4.3 (GPT-4 Reviewed & Approved)
 *
 * Shows how tyre grades AND other factors affect real-world stopping distances
 */

// =====================================================
// PHYSICS ENGINE INSTANCE
// =====================================================
let physicsEngine = null;

// =====================================================
// GAME CONFIGURATION
// =====================================================

const GAME_CONFIG = {
    // Default tyre/vehicle parameters
    defaults: {
        euGrade: 'C',
        treadDepthMm: 8,
        tyreAgeYears: 0,
        tyreWidthMm: 205,
        tyreType: 'summer',
        actualPsi: 32,
        recommendedPsi: 32,
        ambientTempC: 20,
        surfaceType: 'ASPHALT_STD',
        weatherPreset: 'RAIN',  // Wet grip test = rain
        hasABS: true,
        reactionTimeSeconds: 0,  // We measure this separately in game
        slopeDegrees: 0
    },

    // EU Grade display info
    grades: {
        'A': { label: 'Best', color: '#22c55e' },
        'B': { label: 'Great', color: '#84cc16' },
        'C': { label: 'Good', color: '#facc15' },
        'D': { label: 'Fair', color: '#f97316' },
        'E': { label: 'Poor', color: '#ef4444' }
    },

    // Tread depth presets
    treadPresets: {
        'new': { value: 8, label: 'New (8mm)', status: 'excellent' },
        'good': { value: 5, label: 'Good (5mm)', status: 'good' },
        'worn': { value: 3, label: 'Worn (3mm)', status: 'warning' },
        'legal': { value: 1.6, label: 'Legal Min (1.6mm)', status: 'danger' }
    },

    // Weather presets for the game
    weatherPresets: {
        'DRY': { label: 'Dry', icon: '☀️', waterMm: 0 },
        'DAMP': { label: 'Damp', icon: '🌫️', waterMm: 0.1 },
        'LIGHT_RAIN': { label: 'Light Rain', icon: '🌦️', waterMm: 0.3 },
        'RAIN': { label: 'Rain', icon: '🌧️', waterMm: 0.7 },
        'HEAVY_RAIN': { label: 'Heavy Rain', icon: '⛈️', waterMm: 1.5 }
    },

    // Tyre type presets
    tyreTypes: {
        'summer': { label: 'Summer', icon: '☀️', wetGripBonus: 1.00 },
        'allseason': { label: 'All-Season', icon: '🍂', wetGripBonus: 1.04 },
        'winter': { label: 'Winter', icon: '❄️', wetGripBonus: 1.10 }
    },

    // Pressure settings
    pressure: {
        optimal: 32,
        minSafe: 28,
        maxSafe: 36
    },

    // Tyre width presets
    tyreWidths: {
        165: { label: '165mm', desc: 'Narrow', hydroRisk: 0.85 },
        205: { label: '205mm', desc: 'Standard', hydroRisk: 1.00 },
        245: { label: '245mm', desc: 'Wide', hydroRisk: 1.15 },
        295: { label: '295mm', desc: 'Performance', hydroRisk: 1.30 }
    },

    // Surface types with friction coefficients
    // Coefficients based on real-world data from automotive research
    surfaces: {
        'ASPHALT_STD': { label: 'Asphalt', icon: '🛣️', baseMu: 0.80, wetMu: 0.55 },
        'CONCRETE': { label: 'Concrete', icon: '🏗️', baseMu: 0.75, wetMu: 0.50 },
        'GRAVEL': { label: 'Gravel', icon: '🪨', baseMu: 0.40, wetMu: 0.35 },
        'DIRT': { label: 'Dirt', icon: '🌍', baseMu: 0.35, wetMu: 0.25 },
        'MUD': { label: 'Mud', icon: '🟤', baseMu: 0.20, wetMu: 0.15 },
        'GRASS': { label: 'Grass', icon: '🌿', baseMu: 0.35, wetMu: 0.20 },
        'SAND': { label: 'Sand', icon: '🏖️', baseMu: 0.30, wetMu: 0.25 },
        'SNOW': { label: 'Snow', icon: '🌨️', baseMu: 0.25, wetMu: 0.20 },
        'ICE': { label: 'Ice', icon: '🧊', baseMu: 0.10, wetMu: 0.08 }
    },

    // Vehicle types with weight factors
    vehicles: {
        'hatchback': { label: 'Hatchback', weight: 1200, factor: 0.95 },
        'sedan': { label: 'Sedan', weight: 1500, factor: 1.00 },
        'suv': { label: 'SUV', weight: 2000, factor: 1.08 },
        'truck': { label: 'Truck', weight: 2500, factor: 1.15 }
    },

    // Temperature settings
    temperature: {
        optimal: 20,
        coldThreshold: 7,
        hotThreshold: 35
    },

    // Wind settings - effect on aerodynamic drag
    wind: {
        // Wind direction effects (multiplier on stopping distance)
        // Headwind helps braking (adds drag), tailwind extends it
        directions: {
            'headwind': { label: 'Headwind', effect: -1 },    // Reduces stopping distance
            'crosswind': { label: 'Crosswind', effect: 0 },   // Stability risk, minimal distance effect
            'tailwind': { label: 'Tailwind', effect: 1 }      // Increases stopping distance
        }
    },

    // Trailer settings
    trailer: {
        types: {
            'none': { label: 'No Trailer', brakingFactor: 1.00 },
            'unbraked': { label: 'Unbraked', brakingFactor: 0.70 },  // All braking from tow vehicle
            'braked': { label: 'Braked', brakingFactor: 0.90 }       // Trailer has own brakes
        },
        maxUnbrakedKg: 750  // NZ legal max for unbraked trailer
    }
};

const GRAVITY = 9.81;

// =====================================================
// TERRAIN RENDERER - Same style as PSI game
// =====================================================

class GradeTestRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.width = 800;
        this.height = 450; // Taller canvas for better view
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.viewDistance = 60; // Zoomed in more
        this.pixelsPerMeter = this.width / this.viewDistance;

        this.horizonY = this.height * 0.35; // Lower horizon for more sky
        this.roadY = this.height * 0.72;
        this.roadHeight = 70; // Wider road
        this.groundY = this.roadY + this.roadHeight / 2;

        this.vehicleScreenX = this.width * 0.18; // Car slightly more centered

        this.frameCount = 0;
        this.wheelRotation = 0;

        this.clouds = this.generateClouds(8);
        this.mountains = this.generateMountains(6);
        this.trees = this.generateTrees(12);

        // Terrain configurations for different surfaces
        this.terrainConfigs = {
            'ASPHALT_STD': {
                skyColors: { clear: ['#4A90D9', '#87CEEB', '#C9E4F6'], wet: ['#5A6A7A', '#7A8A9A', '#9AA5B0'] },
                groundColor: { dry: '#4A7A4A', wet: '#3A6A3A' },
                roadColor: { dry: '#3A3A3A', wet: '#2A2A2A' },
                mountainColor: '#A8C5A8',
                hillColor: '#7CAA7C',
                showSun: true
            },
            'CONCRETE': {
                skyColors: { clear: ['#4A90D9', '#87CEEB', '#C9E4F6'], wet: ['#5A6A7A', '#7A8A9A', '#9AA5B0'] },
                groundColor: { dry: '#6B6B6B', wet: '#5A5A5A' },
                roadColor: { dry: '#8A8A8A', wet: '#7A7A7A' },
                mountainColor: '#A8C5A8',
                hillColor: '#7CAA7C',
                showSun: true
            },
            'GRAVEL': {
                skyColors: { clear: ['#6A9AD9', '#97CEEB', '#D9E4F6'], wet: ['#6A7A8A', '#8A9AAA', '#AAABB0'] },
                groundColor: { dry: '#8B7355', wet: '#7A6345' },
                roadColor: { dry: '#A08060', wet: '#907050' },
                mountainColor: '#A8B5A8',
                hillColor: '#8C9A7C',
                showSun: true,
                hasStones: true
            },
            'DIRT': {
                skyColors: { clear: ['#7AA0D9', '#A7CEEB', '#D9E4E6'], wet: ['#7A8A9A', '#9AAAAA', '#BABBB0'] },
                groundColor: { dry: '#6B4423', wet: '#5A3313' },
                roadColor: { dry: '#8B5A3B', wet: '#7A4A2B' },
                mountainColor: '#B8C5A8',
                hillColor: '#9CAA7C',
                showSun: true
            },
            'MUD': {
                skyColors: { clear: ['#8A9AAA', '#9AAAAA', '#AAABB0'], wet: ['#5A6A7A', '#6A7A8A', '#7A8A9A'] },
                groundColor: { dry: '#4E342E', wet: '#3E241E' },
                roadColor: { dry: '#5D4037', wet: '#4E302A' },
                mountainColor: '#8AA588',
                hillColor: '#6A8A68',
                showSun: false,
                hasPuddles: true
            },
            'GRASS': {
                skyColors: { clear: ['#4A90D9', '#87CEEB', '#C9E4F6'], wet: ['#5A6A7A', '#7A8A9A', '#9AA5B0'] },
                groundColor: { dry: '#4A8A4A', wet: '#3A7A3A' },
                roadColor: { dry: '#5A9A5A', wet: '#4A8A4A' },
                mountainColor: '#A8C5A8',
                hillColor: '#7CAA7C',
                showSun: true,
                hasGrassTexture: true
            },
            'SAND': {
                skyColors: { clear: ['#5AA0E9', '#97DEFF', '#E9F4FF'], wet: ['#7A9AAA', '#9ABABB', '#BACBB0'] },
                groundColor: { dry: '#E8D4A8', wet: '#D8C498' },
                roadColor: { dry: '#F0E0B8', wet: '#E0D0A8' },
                mountainColor: '#D8C5A8',
                hillColor: '#C8B598',
                showSun: true,
                hasSandDunes: true
            },
            'SNOW': {
                skyColors: { clear: ['#B3D9FF', '#D0E8FF', '#E8F4FF'], wet: ['#9ABACC', '#B0CADC', '#C8DAEC'] },
                groundColor: { dry: '#F0F4F8', wet: '#E0E8F0' },
                roadColor: { dry: '#E8ECF0', wet: '#D8E0E8' },
                mountainColor: '#E8F0F8',
                hillColor: '#D8E8F0',
                showSun: true,
                hasSnowEffect: true,
                hasIcePatches: true
            },
            'ICE': {
                skyColors: { clear: ['#A3C9EF', '#C0D8EF', '#D8E8F8'], wet: ['#8AAABC', '#A0BACC', '#B8CADC'] },
                groundColor: { dry: '#D8E8F8', wet: '#C8D8E8' },
                roadColor: { dry: '#C0D8F0', wet: '#B0C8E0' },
                mountainColor: '#D8E8F8',
                hillColor: '#C8D8E8',
                showSun: true,
                hasIceSheen: true,
                hasSnowEffect: true
            }
        };

        this.currentTerrain = 'ASPHALT_STD';

        window.addEventListener('resize', () => this.resize());
    }

    setTerrain(surfaceType) {
        this.currentTerrain = this.terrainConfigs[surfaceType] ? surfaceType : 'ASPHALT_STD';
    }

    generateClouds(count) {
        const clouds = [];
        for (let i = 0; i < count; i++) {
            clouds.push({
                x: (i / count) * 2000,
                y: 15 + Math.random() * 50,
                width: 50 + Math.random() * 70,
                height: 20 + Math.random() * 15,
                speed: 0.3 + Math.random() * 0.2
            });
        }
        return clouds;
    }

    generateMountains(count) {
        const mountains = [];
        for (let i = 0; i < count; i++) {
            mountains.push({
                x: (i / count) * 1500,
                height: 50 + Math.random() * 60,
                width: 120 + Math.random() * 80,
                peaks: 2 + Math.floor(Math.random() * 2) // Multiple peaks per mountain
            });
        }
        return mountains;
    }

    generateTrees(count) {
        const trees = [];
        for (let i = 0; i < count; i++) {
            trees.push({
                x: (i / count) * 1200 + Math.random() * 100,
                height: 25 + Math.random() * 35,
                width: 15 + Math.random() * 15,
                type: Math.random() > 0.5 ? 'pine' : 'round'
            });
        }
        return trees;
    }

    resize() {
        const container = this.canvas.parentElement;
        if (!container) return;

        const containerWidth = container.clientWidth || 800;
        const containerHeight = container.clientHeight || 450;
        let width = Math.max(containerWidth, 400);
        let height = Math.max(Math.min(containerHeight, 500), 350); // Responsive height

        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;

        // Recalculate proportions based on new size
        this.horizonY = this.height * 0.35;
        this.roadY = this.height * 0.72;
        this.roadHeight = Math.max(60, this.height * 0.15);
        this.groundY = this.roadY + this.roadHeight / 2;

        this.pixelsPerMeter = this.width / this.viewDistance;
        this.vehicleScreenX = this.width * 0.18;
    }

    worldToScreen(worldDistance, playerDistance) {
        const relativeDistance = worldDistance - playerDistance;
        return this.vehicleScreenX + (relativeDistance * this.pixelsPerMeter);
    }

    render(gameState) {
        const { position, speed, isBraking, markers, brakePosition, weatherPreset, surfaceType } = gameState;

        // Update terrain based on surface type
        if (surfaceType && surfaceType !== this.currentTerrain) {
            this.setTerrain(surfaceType);
        }

        this.frameCount++;
        this.wheelRotation += speed * 0.1;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        const isWet = weatherPreset !== 'DRY';
        const terrain = this.terrainConfigs[this.currentTerrain] || this.terrainConfigs['ASPHALT_STD'];

        this.drawSky(isWet, terrain);
        this.drawClouds(position, terrain);
        this.drawMountains(position, terrain);
        this.drawGround(isWet, terrain);
        this.drawRoad(position, isWet, terrain);
        this.drawRoadMarkings(position, terrain);

        // Draw terrain-specific effects
        if (terrain.hasSnowEffect) {
            this.drawSnowEffect(position);
        }
        if (terrain.hasIcePatches) {
            this.drawIcePatches(position);
        }

        // Grade markers removed - they didn't align correctly with stopping positions
        // The marker data is still calculated for the comparison panel

        this.drawDistanceMarkers(position, brakePosition, isBraking);
        this.drawVehicle(speed, isBraking);

        if (isWet) {
            this.drawRainEffect(position, weatherPreset);
        }

        this.drawSpeedEffects(speed, position);
    }

    drawSky(isWet, terrain) {
        const ctx = this.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, this.horizonY + 20);

        const colors = isWet ? terrain.skyColors.wet : terrain.skyColors.clear;
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(0.6, colors[1]);
        gradient.addColorStop(1, colors[2]);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.horizonY + 20);

        if (!isWet && terrain.showSun) {
            ctx.beginPath();
            const sunGradient = ctx.createRadialGradient(this.width - 80, 45, 0, this.width - 80, 45, 35);
            sunGradient.addColorStop(0, '#FFFDE7');
            sunGradient.addColorStop(0.5, '#FFF59D');
            sunGradient.addColorStop(1, 'rgba(255, 245, 157, 0)');
            ctx.fillStyle = sunGradient;
            ctx.arc(this.width - 80, 45, 35, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawClouds(distance, terrain) {
        const ctx = this.ctx;
        // For snow/ice terrain, use slightly gray-tinted clouds
        const isSnowy = terrain.hasSnowEffect || terrain.hasIceSheen;
        ctx.fillStyle = isSnowy ? 'rgba(220, 230, 240, 0.85)' : 'rgba(255, 255, 255, 0.9)';

        const scrollOffset = distance * 0.02;

        this.clouds.forEach(cloud => {
            let x = ((cloud.x - scrollOffset * cloud.speed) % 2000 + 2000) % 2000 - 200;

            ctx.beginPath();
            ctx.ellipse(x, cloud.y, cloud.width * 0.4, cloud.height * 0.5, 0, 0, Math.PI * 2);
            ctx.ellipse(x + cloud.width * 0.3, cloud.y - 5, cloud.width * 0.35, cloud.height * 0.6, 0, 0, Math.PI * 2);
            ctx.ellipse(x + cloud.width * 0.6, cloud.y, cloud.width * 0.3, cloud.height * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawMountains(distance, terrain) {
        const ctx = this.ctx;
        const scrollOffset = distance * 0.03;

        // Draw distant mountain range with smooth curves
        const mountainBaseColor = terrain.mountainColor || '#8BA88B';
        const mountainTopColor = this.lightenColor(mountainBaseColor, 20);

        // Far mountains (blue-ish, distant)
        ctx.fillStyle = '#9AACBA';
        this.mountains.forEach((mt, i) => {
            let x = ((mt.x - scrollOffset * 0.3) % 1800 + 1800) % 1800 - 200;
            const baseY = this.horizonY + 5;

            ctx.beginPath();
            ctx.moveTo(x - mt.width * 1.2, baseY);

            // Create smooth mountain shape with bezier curves
            ctx.bezierCurveTo(
                x - mt.width * 0.6, baseY - mt.height * 0.3,
                x - mt.width * 0.3, baseY - mt.height * 0.9,
                x, baseY - mt.height
            );
            ctx.bezierCurveTo(
                x + mt.width * 0.3, baseY - mt.height * 0.9,
                x + mt.width * 0.6, baseY - mt.height * 0.3,
                x + mt.width * 1.2, baseY
            );
            ctx.closePath();
            ctx.fill();
        });

        // Mid-ground mountains (green)
        ctx.fillStyle = mountainBaseColor;
        this.mountains.forEach((mt, i) => {
            let x = ((mt.x + 300 - scrollOffset * 0.5) % 1500 + 1500) % 1500 - 150;
            const baseY = this.horizonY + 15;
            const h = mt.height * 0.7;

            ctx.beginPath();
            ctx.moveTo(x - mt.width * 0.8, baseY);
            ctx.bezierCurveTo(
                x - mt.width * 0.4, baseY - h * 0.4,
                x - mt.width * 0.2, baseY - h * 0.85,
                x, baseY - h
            );
            ctx.bezierCurveTo(
                x + mt.width * 0.2, baseY - h * 0.85,
                x + mt.width * 0.4, baseY - h * 0.4,
                x + mt.width * 0.8, baseY
            );
            ctx.closePath();
            ctx.fill();
        });

        // Draw trees on hills
        if (!terrain.hasSnowEffect && !terrain.hasIceSheen && !terrain.hasSandDunes) {
            this.drawTrees(distance, terrain);
        }

        // Rolling hills in front
        ctx.fillStyle = terrain.hillColor || '#6A9A6A';
        for (let i = 0; i < 8; i++) {
            let x = ((i * 160 - scrollOffset * 0.8) % 1300 + 1300) % 1300 - 150;
            let h = 20 + Math.sin(i * 1.7) * 12;
            ctx.beginPath();
            ctx.moveTo(x - 90, this.horizonY + 25);
            ctx.quadraticCurveTo(x, this.horizonY + 25 - h, x + 90, this.horizonY + 25);
            ctx.fill();
        }
    }

    drawTrees(distance, terrain) {
        const ctx = this.ctx;
        const scrollOffset = distance * 0.6;
        const treeColor = terrain.hillColor || '#5A8A5A';
        const trunkColor = '#5D4037';

        this.trees.forEach(tree => {
            let x = ((tree.x - scrollOffset) % 1400 + 1400) % 1400 - 100;
            const baseY = this.horizonY + 30;

            if (tree.type === 'pine') {
                // Pine tree (triangle shape)
                ctx.fillStyle = treeColor;
                ctx.beginPath();
                ctx.moveTo(x, baseY - tree.height);
                ctx.lineTo(x - tree.width, baseY);
                ctx.lineTo(x + tree.width, baseY);
                ctx.closePath();
                ctx.fill();

                // Second layer
                ctx.beginPath();
                ctx.moveTo(x, baseY - tree.height * 0.7);
                ctx.lineTo(x - tree.width * 1.2, baseY - tree.height * 0.15);
                ctx.lineTo(x + tree.width * 1.2, baseY - tree.height * 0.15);
                ctx.closePath();
                ctx.fill();
            } else {
                // Round tree
                ctx.fillStyle = treeColor;
                ctx.beginPath();
                ctx.ellipse(x, baseY - tree.height * 0.6, tree.width * 1.2, tree.height * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();

                // Trunk
                ctx.fillStyle = trunkColor;
                ctx.fillRect(x - 3, baseY - tree.height * 0.2, 6, tree.height * 0.25);
            }
        });
    }

    lightenColor(color, percent) {
        // Simple color lightening
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    drawGround(isWet, terrain) {
        const ctx = this.ctx;
        // Use terrain-specific ground color
        const groundColor = isWet ? terrain.groundColor.wet : terrain.groundColor.dry;
        ctx.fillStyle = groundColor || (isWet ? '#3A6A3A' : '#4A7A4A');
        ctx.fillRect(0, this.horizonY + 15, this.width, this.height - this.horizonY - 15);
    }

    drawRoad(distance, isWet, terrain) {
        const ctx = this.ctx;
        const roadTop = this.roadY - this.roadHeight / 2;

        // Road shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, roadTop + this.roadHeight, this.width, 5);

        // Use terrain-specific road color
        const roadColor = isWet ? terrain.roadColor.wet : terrain.roadColor.dry;
        ctx.fillStyle = roadColor || (isWet ? '#2A2A2A' : '#3A3A3A');
        ctx.fillRect(0, roadTop, this.width, this.roadHeight);

        // Road edges (darker on asphalt, blend on other surfaces)
        const isLooseGround = terrain.hasStones || terrain.hasSandDunes || terrain.hasGrassTexture;
        if (!isLooseGround) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, roadTop, this.width, 3);
            ctx.fillRect(0, roadTop + this.roadHeight - 3, this.width, 3);
        }

        // Wet overlay for rain
        if (isWet && !terrain.hasSnowEffect && !terrain.hasIceSheen) {
            ctx.fillStyle = 'rgba(100, 150, 200, 0.1)';
            ctx.fillRect(0, roadTop, this.width, this.roadHeight);
        }

        // Ice sheen effect
        if (terrain.hasIceSheen) {
            ctx.fillStyle = 'rgba(180, 220, 255, 0.25)';
            ctx.fillRect(0, roadTop, this.width, this.roadHeight);
            // Add subtle ice reflections
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            for (let i = 0; i < 8; i++) {
                const x = ((distance * 3 + i * 97) % this.width);
                ctx.fillRect(x, roadTop + 10, 40, 2);
            }
        }
    }

    drawRoadMarkings(playerDistance, terrain) {
        const ctx = this.ctx;
        const roadTop = this.roadY - this.roadHeight / 2;
        const centerY = roadTop + this.roadHeight / 2;

        // Skip road markings for off-road surfaces
        const isOffRoad = terrain.hasStones || terrain.hasSandDunes || terrain.hasGrassTexture ||
                          terrain.hasSnowEffect || terrain.hasIceSheen || terrain.hasPuddles;

        if (isOffRoad) {
            // Draw subtle track marks or tire ruts instead for some surfaces
            if (terrain.hasSnowEffect) {
                ctx.fillStyle = 'rgba(200, 210, 220, 0.3)';
                // Tire tracks in snow
                ctx.fillRect(0, centerY - 20, this.width, 4);
                ctx.fillRect(0, centerY + 16, this.width, 4);
            }
            return;
        }

        // Normal road markings
        ctx.fillStyle = '#FFFFFF';
        const dashLength = 25;
        const gapLength = 20;
        const totalLength = dashLength + gapLength;

        const offsetInMeters = playerDistance % (totalLength / this.pixelsPerMeter);
        const startX = this.vehicleScreenX - offsetInMeters * this.pixelsPerMeter;

        for (let x = startX - totalLength; x < this.width + totalLength; x += totalLength) {
            ctx.fillRect(x, centerY - 2, dashLength, 4);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(0, roadTop + 5, this.width, 2);
        ctx.fillRect(0, roadTop + this.roadHeight - 7, this.width, 2);
    }

    drawDistanceMarkers(playerDistance, brakePosition, isBraking) {
        const ctx = this.ctx;
        const roadBottom = this.roadY + this.roadHeight / 2;

        const markerInterval = 10;
        const startMeter = Math.floor((playerDistance - 20) / markerInterval) * markerInterval;
        const endMeter = playerDistance + this.viewDistance + 20;

        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';

        for (let meter = startMeter; meter <= endMeter; meter += markerInterval) {
            if (meter < 0) continue;

            const screenX = this.worldToScreen(meter, playerDistance);
            if (screenX < -50 || screenX > this.width + 50) continue;

            const isLargeMark = meter % 50 === 0;
            ctx.fillStyle = isLargeMark ? '#ffffff' : '#888888';
            ctx.fillRect(screenX - 1, roadBottom - (isLargeMark ? 15 : 8), 2, isLargeMark ? 15 : 8);

            if (isLargeMark) {
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`${meter}m`, screenX, roadBottom + 14);
            }
        }

        if (isBraking && brakePosition !== undefined) {
            const brakeX = this.worldToScreen(brakePosition, playerDistance);
            if (brakeX > 0 && brakeX < this.width) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(brakeX, this.roadY - this.roadHeight / 2 - 20);
                ctx.lineTo(brakeX, this.roadY + this.roadHeight / 2 + 20);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 12px Inter';
                ctx.fillText('BRAKE', brakeX, this.roadY - this.roadHeight / 2 - 25);
            }
        }
    }

    drawGradeMarkers(markers, playerDistance, brakePosition) {
        const ctx = this.ctx;
        const roadTop = this.roadY - this.roadHeight / 2;
        const roadBottom = this.roadY + this.roadHeight / 2;

        markers.forEach(marker => {
            const markerWorldPos = brakePosition + marker.distance;
            const screenX = this.worldToScreen(markerWorldPos, playerDistance);

            if (screenX < -50 || screenX > this.width + 50) return;

            ctx.strokeStyle = marker.color;
            ctx.lineWidth = marker.isCurrent ? 5 : 3;
            ctx.globalAlpha = marker.isCurrent ? 1 : 0.8;

            ctx.beginPath();
            ctx.moveTo(screenX, roadTop - 40);
            ctx.lineTo(screenX, roadBottom + 40);
            ctx.stroke();

            ctx.fillStyle = marker.color;
            ctx.beginPath();
            ctx.moveTo(screenX, roadTop - 60);
            ctx.lineTo(screenX + 25, roadTop - 50);
            ctx.lineTo(screenX, roadTop - 40);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = marker.isCurrent ? '#000000' : '#ffffff';
            ctx.font = marker.isCurrent ? 'bold 14px Orbitron' : 'bold 12px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(marker.grade, screenX + 10, roadTop - 47);

            ctx.fillStyle = marker.color;
            ctx.font = '11px Inter';
            ctx.fillText(`${marker.distance.toFixed(1)}m`, screenX, roadBottom + 55);

            ctx.globalAlpha = 1;
        });
    }

    drawVehicle(speed, isBraking) {
        const ctx = this.ctx;
        const x = this.vehicleScreenX;
        const baseY = this.roadY + 8;

        // Larger vehicle dimensions
        const vWidth = 120;
        const vHeight = 55;
        const drawY = baseY - vHeight;

        // Shadow under car
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(x + vWidth / 2, baseY, vWidth * 0.45, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Car body - main
        const bodyGradient = ctx.createLinearGradient(x, drawY, x, drawY + vHeight);
        bodyGradient.addColorStop(0, '#4A90D9');
        bodyGradient.addColorStop(0.5, '#3B82F6');
        bodyGradient.addColorStop(1, '#2563EB');
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.roundRect(x, drawY + 18, vWidth, vHeight - 18, 10);
        ctx.fill();

        // Car roof/cabin
        ctx.fillStyle = '#2563EB';
        ctx.beginPath();
        ctx.moveTo(x + 25, drawY + 18);
        ctx.lineTo(x + 35, drawY);
        ctx.lineTo(x + vWidth - 25, drawY);
        ctx.lineTo(x + vWidth - 15, drawY + 18);
        ctx.closePath();
        ctx.fill();

        // Windows
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath();
        ctx.moveTo(x + 32, drawY + 16);
        ctx.lineTo(x + 40, drawY + 4);
        ctx.lineTo(x + 55, drawY + 4);
        ctx.lineTo(x + 55, drawY + 16);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x + 60, drawY + 4);
        ctx.lineTo(x + vWidth - 30, drawY + 4);
        ctx.lineTo(x + vWidth - 20, drawY + 16);
        ctx.lineTo(x + 60, drawY + 16);
        ctx.closePath();
        ctx.fill();

        // Side detail line
        ctx.strokeStyle = '#1E40AF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 8, drawY + 35);
        ctx.lineTo(x + vWidth - 8, drawY + 35);
        ctx.stroke();

        // Wheels
        const wheelY = baseY - 2;
        const wheelRadius = 16;

        // Wheel wells (darker arcs)
        ctx.fillStyle = '#1E3A5F';
        ctx.beginPath();
        ctx.arc(x + 28, wheelY, wheelRadius + 4, Math.PI, 0, false);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + vWidth - 28, wheelY, wheelRadius + 4, Math.PI, 0, false);
        ctx.fill();

        // Tires
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(x + 28, wheelY, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + vWidth - 28, wheelY, wheelRadius, 0, Math.PI * 2);
        ctx.fill();

        // Wheel rims
        ctx.fillStyle = '#9CA3AF';
        ctx.beginPath();
        ctx.arc(x + 28, wheelY, wheelRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + vWidth - 28, wheelY, wheelRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Rim spokes
        ctx.strokeStyle = '#6B7280';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const angle = this.wheelRotation + (i * Math.PI * 2 / 5);
            const spokeLen = wheelRadius * 0.45;

            ctx.beginPath();
            ctx.moveTo(x + 28, wheelY);
            ctx.lineTo(x + 28 + Math.cos(angle) * spokeLen, wheelY + Math.sin(angle) * spokeLen);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x + vWidth - 28, wheelY);
            ctx.lineTo(x + vWidth - 28 + Math.cos(angle) * spokeLen, wheelY + Math.sin(angle) * spokeLen);
            ctx.stroke();
        }

        // Brake lights (when braking)
        if (isBraking) {
            ctx.fillStyle = '#EF4444';
            ctx.shadowColor = '#EF4444';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.roundRect(x + 2, drawY + 25, 6, 15, 2);
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(x + 2, drawY + 45, 6, 10, 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Headlights
        ctx.fillStyle = '#FEF3C7';
        ctx.shadowColor = '#FEF3C7';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(x + vWidth - 8, drawY + 24, 8, 12, 3);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(x + vWidth - 8, drawY + 42, 8, 10, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    drawRainEffect(distance, weatherPreset) {
        const ctx = this.ctx;

        // Rain intensity based on weather or custom water depth
        let intensity = 150;
        let alpha = 0.4;

        if (weatherPreset === 'CUSTOM' && GameState.customWaterDepthMm !== null) {
            // Map water depth (0-5mm) to rain intensity
            const depth = GameState.customWaterDepthMm;
            if (depth <= 0) { intensity = 0; alpha = 0; }
            else if (depth < 0.3) { intensity = 30; alpha = 0.2; }
            else if (depth < 0.7) { intensity = 60; alpha = 0.3; }
            else if (depth < 1.5) { intensity = 100; alpha = 0.4; }
            else if (depth < 2.5) { intensity = 200; alpha = 0.5; }
            else { intensity = 300; alpha = 0.6; }
        } else if (weatherPreset === 'DAMP') { intensity = 30; alpha = 0.2; }
        else if (weatherPreset === 'LIGHT_RAIN') { intensity = 60; alpha = 0.3; }
        else if (weatherPreset === 'RAIN') { intensity = 100; alpha = 0.4; }
        else if (weatherPreset === 'HEAVY_RAIN') { intensity = 200; alpha = 0.5; }

        ctx.strokeStyle = `rgba(150, 200, 255, ${alpha})`;
        ctx.lineWidth = 1;

        const offset = (distance * 2) % 100;

        for (let i = 0; i < intensity; i++) {
            const x = ((i * 17 + offset) % this.width);
            const y = (i * 23 + offset * 3) % (this.height * 0.65);
            const length = 12 + (i % 10);

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 3, y + length);
            ctx.stroke();
        }
    }

    drawSpeedEffects(speed, distance) {
        if (speed < 30) return;

        const ctx = this.ctx;
        const roadTop = this.roadY - this.roadHeight / 2;

        const intensity = Math.min(1, (speed - 30) / 120);
        const lineCount = Math.floor(intensity * 15);

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * intensity})`;
        ctx.lineWidth = 2;

        for (let i = 0; i < lineCount; i++) {
            const y = roadTop + 10 + (i / lineCount) * (this.roadHeight - 20);
            const startX = (distance * 5 + i * 73) % this.width;
            const lineLen = 30 + speed * 0.5;

            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(startX - lineLen, y);
            ctx.stroke();
        }
    }

    drawSnowEffect(distance) {
        const ctx = this.ctx;
        const snowflakeCount = 40;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

        for (let i = 0; i < snowflakeCount; i++) {
            // Create pseudo-random but consistent snowflake positions
            const seed = i * 127 + this.frameCount * 0.5;
            const x = ((seed * 7.3) % this.width);
            const y = ((seed * 3.7 + this.frameCount * (1 + (i % 3) * 0.3)) % (this.height * 0.9));
            const size = 2 + (i % 3);

            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Add some larger, slower snowflakes in foreground
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        for (let i = 0; i < 10; i++) {
            const seed = i * 211 + this.frameCount * 0.2;
            const x = ((seed * 11.7) % this.width);
            const y = ((seed * 5.3 + this.frameCount * 0.5) % this.height);
            const size = 4 + (i % 2);

            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawIcePatches(distance) {
        const ctx = this.ctx;
        const roadTop = this.roadY - this.roadHeight / 2;

        // Draw semi-transparent ice patches on the road
        ctx.fillStyle = 'rgba(180, 220, 255, 0.15)';

        // Create 5 ice patches that scroll with the road
        for (let i = 0; i < 5; i++) {
            const patchX = ((distance * this.pixelsPerMeter * 0.3 + i * 180) % (this.width + 100)) - 50;
            const patchY = roadTop + 8 + (i % 3) * 15;
            const patchWidth = 60 + (i % 2) * 30;
            const patchHeight = 20 + (i % 2) * 10;

            // Rounded ice patch
            ctx.beginPath();
            ctx.ellipse(patchX + patchWidth / 2, patchY + patchHeight / 2,
                        patchWidth / 2, patchHeight / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Add highlight on ice
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.ellipse(patchX + patchWidth / 2 - 5, patchY + patchHeight / 2 - 3,
                        patchWidth / 3, patchHeight / 4, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(180, 220, 255, 0.15)';
        }
    }
}

// =====================================================
// GAME STATE
// =====================================================

const GameState = {
    currentScreen: 'menu',

    // Player selections - DEFAULTS ARE OPTIMAL SETTINGS
    selectedGrade: 'A',           // Best wet grip
    selectedFuelGrade: 'A',       // Best fuel economy (lowest rolling resistance)
    selectedTread: 'new',         // 8mm - maximum tread
    selectedWeather: 'DRY',       // Sunny/dry conditions
    selectedAge: 0,               // Brand new tyres
    selectedTyreType: 'summer',   // Summer tyres (best for dry)
    selectedPressure: 32,         // Optimal pressure
    selectedWidth: 205,           // Standard width
    selectedSurface: 'ASPHALT_STD', // Standard asphalt
    selectedVehicle: 'sedan',     // Standard sedan
    selectedTemp: 20,             // Optimal temperature
    hasABS: true,                 // ABS enabled

    // New: Wind conditions
    windSpeed: 0,           // km/h (0-100)
    windDirection: 'crosswind',  // headwind, crosswind, tailwind

    // New: Vehicle weight (manual input)
    vehicleWeight: 1500,    // kg

    // New: Trailer settings
    trailerType: 'none',    // none, unbraked, braked
    trailerWeight: 500,     // kg

    // New: Width display unit
    widthUnit: 'metric',    // metric or imperial

    // New: Advanced physics factors (from UltimateBrakingPhysics)
    slopeDegrees: 0,        // Road gradient: positive = uphill, negative = downhill
    brakeFadeLevel: 0,      // 0-10: brake fade from repeated braking
    tyreCompound: 'touring', // economy, touring, performance, uhp, track

    // Custom water depth (when weather is set to CUSTOM)
    customWaterDepthMm: null, // null = use preset, otherwise 0-5mm

    // Physics
    speed: 0,
    maxSpeed: 300,
    acceleration: 35,
    position: 0,

    isAccelerating: false,
    isBraking: false,
    brakeReady: false,           // When true, brake button is visible
    hasReleasedAccelerator: false,
    brakeSpeed: 0,
    brakePosition: 0,
    stoppedDistance: 0,
    testComplete: false,

    canvas: null,
    renderer: null,
    animationId: null,
    lastTime: 0,

    markers: [],

    // Physics calculation result (from UltimateBrakingPhysics)
    physicsResult: null,

    // Stats tracking
    stats: {
        startTime: 0,
        accelerationStartTime: 0,
        brakeStartTime: 0,
        endTime: 0,
        peakSpeed: 0,
        avgAcceleration: 0,
        timeToTopSpeed: 0,
        distanceToTopSpeed: 0,
        brakingTime: 0,
        avgDeceleration: 0,
        totalTime: 0,
        totalDistance: 0,
        speedHistory: [],
        reactionDistance: 0
    }
};

// =====================================================
// PHYSICS CALCULATIONS - FULL ENGINE INTEGRATION
// Now uses UltimateBrakingPhysics v3.4.3 with ALL 15 factors
// =====================================================

/**
 * Calculate braking distance using the FULL physics engine
 * This replaces the simplified version to use all 15 physics factors:
 *
 * 1. Surface friction (25 surface types with peak/slide)
 * 2. Weather/water depth (8 levels)
 * 3. EU Wet Grip Grade (A-E with wet/dry blending)
 * 4. Tyre Age (accelerating degradation)
 * 5. Tread Depth (4mm cliff effect)
 * 6. Tyre Pressure (NASA hydroplaning formula)
 * 7. Tyre Width (opposite wet/dry effects)
 * 8. Temperature/Compound (7°C threshold)
 * 9. Speed-dependent friction decay
 * 10. Vehicle Load sensitivity
 * 11. Road Slope/Gradient
 * 12. Brake Fade
 * 13. Tyre Compound subtype
 * 14. Road Camber
 * 15. Aerodynamic Downforce
 */
function calculateBrakingDistance(speedKmh, grade, treadMm, weatherPreset, ageYears, tyreType = 'summer', pressure = 32, width = 205, surface = 'ASPHALT_STD', vehicle = 'sedan', temp = 20, hasABS = true, windSpeed = 0, windDirection = 'crosswind', trailerType = 'none', trailerWeight = 0, vehicleWeight = null, slopeDegrees = 0, brakeFadeLevel = 0, tyreCompound = 'touring', fuelGrade = 'C') {

    // Use the full physics engine if available
    if (physicsEngine) {
        // Get vehicle weight
        const vehicleData = GAME_CONFIG.vehicles[vehicle] || GAME_CONFIG.vehicles['sedan'];
        const effectiveVehicleWeight = vehicleWeight || vehicleData.weight;

        // Calculate total weight including trailer
        let totalMass = effectiveVehicleWeight;
        if (trailerType !== 'none' && trailerWeight > 0) {
            totalMass += trailerWeight;
        }

        // Map simplified surface names to full physics engine surface types
        const surfaceMap = {
            'ASPHALT_STD': 'ASPHALT_STD',
            'CONCRETE': 'CONCRETE_STD',
            'GRAVEL': 'GRAVEL_LOOSE',
            'DIRT': 'DIRT_LOOSE',
            'MUD': 'MUD',
            'GRASS': 'GRASS_DRY',
            'SAND': 'SAND',
            'SNOW': 'SNOW_PACKED',
            'ICE': 'ICE_SMOOTH'
        };
        const mappedSurface = surfaceMap[surface] || 'ASPHALT_STD';

        // Build physics params
        const physicsParams = {
            speedKmh: speedKmh,
            surfaceType: mappedSurface,
            euGrade: grade,
            tyreAgeYears: ageYears,
            treadDepthMm: treadMm,
            tyreWidthMm: width,
            tyreType: tyreType,
            actualPsi: pressure,
            recommendedPsi: 32,
            ambientTempC: temp,
            vehicleMassKg: effectiveVehicleWeight,
            loadedMassKg: totalMass,
            hasABS: hasABS,
            slopeDegrees: slopeDegrees,
            brakeFadeLevel: brakeFadeLevel,
            tyreCompound: tyreCompound,
            fuelGrade: fuelGrade,
            reactionTimeSeconds: 0  // We track reaction separately in the game
        };

        // Use custom water depth if set, otherwise use weather preset
        if (weatherPreset === 'CUSTOM' && GameState.customWaterDepthMm !== null) {
            physicsParams.waterDepthMm = GameState.customWaterDepthMm;
        } else {
            physicsParams.weatherPreset = weatherPreset;
        }

        // Call the full physics engine
        const result = physicsEngine.calculate(physicsParams);

        let brakingDistance = result.brakingDistanceM;

        // Apply wind effect (not in physics engine)
        if (windSpeed > 0) {
            const windEffects = { 'headwind': -1, 'crosswind': 0, 'tailwind': 1 };
            const windEffect = windEffects[windDirection] || 0;
            const windFactor = (windSpeed / 100) * 0.05 * windEffect;
            const speedFactor = Math.min(1.0, speedKmh / 100);
            brakingDistance *= (1 + windFactor * speedFactor);
        }

        // Apply trailer braking penalty (partially handled by loadedMassKg, but braking factor needs adjustment)
        if (trailerType !== 'none' && trailerWeight > 0) {
            const trailerData = GAME_CONFIG.trailer.types[trailerType] || GAME_CONFIG.trailer.types['unbraked'];
            // Additional penalty for unbraked trailers (physics engine handles mass, not braking contribution)
            const brakingDeficit = 1 - trailerData.brakingFactor;
            const trailerMassRatio = trailerWeight / effectiveVehicleWeight;
            const extraPenalty = trailerMassRatio * brakingDeficit * 0.5;
            brakingDistance *= (1 + extraPenalty);
        }

        return brakingDistance;
    }

    // Fallback to simplified calculation if physics engine not loaded
    // (This should not happen in normal operation)
    console.warn('Physics engine not loaded - using fallback calculation');
    const speedMs = speedKmh / 3.6;
    const mu = 0.7;  // Conservative estimate
    return (speedMs * speedMs) / (2 * mu * 9.81);
}

function getFullPhysicsResult(speedKmh, grade, treadMm, weatherPreset, ageYears, options = {}) {
    if (!physicsEngine) return null;

    // Get vehicle weight
    const vehicleData = GAME_CONFIG.vehicles[options.vehicle || GameState.selectedVehicle] || GAME_CONFIG.vehicles['sedan'];
    const effectiveWeight = options.vehicleWeight || GameState.vehicleWeight || vehicleData.weight;

    // Calculate total mass including trailer
    let totalMass = effectiveWeight;
    const trailerType = options.trailerType || GameState.trailerType || 'none';
    const trailerWeight = options.trailerWeight || GameState.trailerWeight || 0;
    if (trailerType !== 'none' && trailerWeight > 0) {
        totalMass += trailerWeight;
    }

    // Map surface to physics engine format
    const surface = options.surface || GameState.selectedSurface || 'ASPHALT_STD';
    const surfaceMap = {
        'ASPHALT_STD': 'ASPHALT_STD',
        'CONCRETE': 'CONCRETE_STD',
        'GRAVEL': 'GRAVEL_LOOSE',
        'DIRT': 'DIRT_LOOSE',
        'MUD': 'MUD',
        'GRASS': 'GRASS_DRY',
        'SAND': 'SAND',
        'SNOW': 'SNOW_PACKED',
        'ICE': 'ICE_SMOOTH'
    };

    // Handle custom water depth
    const physicsParams = {
        speedKmh,
        euGrade: grade,
        treadDepthMm: treadMm,
        tyreAgeYears: ageYears,
        surfaceType: surfaceMap[surface] || 'ASPHALT_STD',
        tyreWidthMm: options.width || GameState.selectedWidth || 205,
        tyreType: options.tyreType || GameState.selectedTyreType || 'summer',
        actualPsi: options.pressure || GameState.selectedPressure || 32,
        recommendedPsi: 32,
        ambientTempC: options.temp || GameState.selectedTemp || 20,
        vehicleMassKg: effectiveWeight,
        loadedMassKg: totalMass,
        hasABS: options.hasABS !== undefined ? options.hasABS : GameState.hasABS,
        reactionTimeSeconds: 1.5,  // Include for comparison stats
        slopeDegrees: options.slopeDegrees || GameState.slopeDegrees || 0,
        brakeFadeLevel: options.brakeFadeLevel || GameState.brakeFadeLevel || 0,
        tyreCompound: options.tyreCompound || GameState.tyreCompound || 'touring'
    };

    // Use custom water depth if set, otherwise use weather preset
    if (weatherPreset === 'CUSTOM' && GameState.customWaterDepthMm !== null) {
        physicsParams.waterDepthMm = GameState.customWaterDepthMm;
    } else {
        physicsParams.weatherPreset = weatherPreset;
    }

    return physicsEngine.calculate(physicsParams);
}

// =====================================================
// INITIALIZATION
// =====================================================

function init() {
    // Initialize physics engine
    if (typeof UltimateBrakingPhysics !== 'undefined') {
        physicsEngine = new UltimateBrakingPhysics();
    } else {
        console.warn('UltimateBrakingPhysics not found - using fallback calculations');
    }

    GameState.canvas = document.getElementById('game-canvas');
    if (GameState.canvas) {
        GameState.renderer = new GradeTestRenderer(GameState.canvas);
    }

    setupEventListeners();
    setupTutorial();
    setupTooltips();
    setupWhyDrawer();
    updateAllInfo();
}

// =====================================================
// TUTORIAL SYSTEM
// =====================================================

function setupTutorial() {
    const tutorialOverlay = document.getElementById('tutorial-overlay');
    const tutorialBtn = document.getElementById('tutorial-start-btn');
    const dontShowCheckbox = document.getElementById('dont-show-tutorial');

    // Check if user has dismissed tutorial before
    const hideTutorial = localStorage.getItem('euGradeTest_hideTutorial') === 'true';

    if (!hideTutorial && tutorialOverlay) {
        tutorialOverlay.classList.remove('hidden');
    }

    if (tutorialBtn) {
        tutorialBtn.addEventListener('click', () => {
            if (dontShowCheckbox && dontShowCheckbox.checked) {
                localStorage.setItem('euGradeTest_hideTutorial', 'true');
            }
            tutorialOverlay.classList.add('hidden');
        });
    }
}

// =====================================================
// TOOLTIP SYSTEM
// =====================================================

function setupTooltips() {
    // Info buttons
    document.querySelectorAll('.info-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooltipId = btn.dataset.tooltip;
            openTooltip(tooltipId);
        });
    });

    // Close buttons inside tooltips
    document.querySelectorAll('.tooltip-close').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllTooltips();
        });
    });

    // Close on backdrop click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tooltip-popup') ||
            !e.target.closest('.tooltip-popup') && !e.target.closest('.info-btn')) {
            closeAllTooltips();
        }
    });
}

function openTooltip(tooltipId) {
    closeAllTooltips();
    const tooltip = document.getElementById(`tooltip-${tooltipId}`);
    if (tooltip) {
        tooltip.classList.add('active');
    }
}

function closeAllTooltips() {
    document.querySelectorAll('.tooltip-popup').forEach(popup => {
        popup.classList.remove('active');
    });
}

// =====================================================
// WHY THIS RESULT? DRAWER
// =====================================================

function setupWhyDrawer() {
    const toggle = document.getElementById('why-toggle');
    const content = document.getElementById('why-content');

    if (toggle && content) {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('open');
            content.classList.toggle('hidden');
        });
    }
}

function updateWhyDrawer(speedKmh, grade, treadMm, weather, ageYears, distance) {
    const container = document.getElementById('why-breakdown');
    if (!container) return;

    // Calculate all factors for display
    const waterDepths = {
        'DRY': 0, 'DAMP': 0.1, 'LIGHT_RAIN': 0.3, 'RAIN': 0.7, 'HEAVY_RAIN': 1.5
    };
    const waterMm = waterDepths[weather] || 0.7;

    // 3-state wetness
    const isDamp = waterMm > 0 && waterMm <= 0.5;
    const isWet = waterMm > 0.5;
    const dampBlend = isDamp ? (waterMm / 0.5) : (isWet ? 1.0 : 0.0);

    // Base μ
    const baseMu = 0.80;

    // Weather factor
    let weatherFactor;
    if (waterMm <= 0) weatherFactor = 1.00;
    else if (waterMm <= 0.2) weatherFactor = 1.00 - (waterMm * 0.50);
    else if (waterMm <= 0.5) weatherFactor = 0.90 - ((waterMm - 0.2) * 0.50);
    else if (waterMm <= 1.0) weatherFactor = 0.75 - ((waterMm - 0.5) * 0.30);
    else if (waterMm <= 2.0) weatherFactor = 0.60 - ((waterMm - 1.0) * 0.15);
    else weatherFactor = 0.45 - ((waterMm - 2.0) * 0.12);
    weatherFactor = Math.max(0.05, weatherFactor);

    // Grade factor
    const gradeWetFactors = { A: 1.15, B: 1.06, C: 1.00, D: 0.89, E: 0.80 };
    const wetFactor = gradeWetFactors[grade] || 1.00;
    const dryAdjust = 0.40;
    const dryFactor = 1.0 + (wetFactor - 1.0) * dryAdjust;
    const gradeFactor = dryFactor + (wetFactor - dryFactor) * dampBlend;

    // Tread factor
    let treadWetFactor, treadDryFactor;
    if (treadMm >= 8) treadWetFactor = 1.00;
    else if (treadMm >= 4) treadWetFactor = 0.64 + (0.045 * treadMm);
    else if (treadMm >= 1.6) treadWetFactor = 0.304 + (0.129 * treadMm);
    else treadWetFactor = 0.304 + (0.129 * treadMm);
    treadWetFactor = Math.max(0.20, Math.min(1.00, treadWetFactor));
    treadDryFactor = 0.88 + (0.015 * Math.min(8, treadMm));
    const treadFactor = treadDryFactor + (treadWetFactor - treadDryFactor) * dampBlend;

    // Age factor
    let ageFactor;
    if (ageYears <= 0) ageFactor = 1.00;
    else if (ageYears <= 2) ageFactor = 1.00 - (0.01 * ageYears);
    else if (ageYears <= 4) ageFactor = 0.98 - (0.025 * (ageYears - 2));
    else if (ageYears <= 6) ageFactor = 0.93 - (0.040 * (ageYears - 4));
    else if (ageYears <= 8) ageFactor = 0.85 - (0.060 * (ageYears - 6));
    else if (ageYears <= 10) ageFactor = 0.73 - (0.070 * (ageYears - 8));
    else ageFactor = 0.59 - (0.050 * (ageYears - 10));
    ageFactor = Math.max(0.35, ageFactor);

    // Final μ
    const effectiveMu = baseMu * weatherFactor * gradeFactor * treadFactor * ageFactor;
    const speedMs = speedKmh / 3.6;

    // Helper for factor class
    function getFactorClass(factor) {
        if (factor >= 1.0) return 'factor-good';
        if (factor >= 0.85) return 'factor-neutral';
        return 'factor-bad';
    }

    // Helper for effect text
    function getEffectText(factor) {
        if (factor >= 1.0) return `+${((factor - 1) * 100).toFixed(0)}%`;
        return `${((factor - 1) * 100).toFixed(0)}%`;
    }

    const weatherLabel = GAME_CONFIG.weatherPresets[weather]?.label || weather;

    container.innerHTML = `
        <h4 class="why-section-title">Friction Coefficient Breakdown</h4>
        <table class="why-factor-table">
            <tr>
                <th>Factor</th>
                <th>Value</th>
                <th>Effect</th>
            </tr>
            <tr>
                <td>Base Surface (Asphalt + ABS)</td>
                <td>μ = 0.80</td>
                <td class="factor-neutral">Baseline</td>
            </tr>
            <tr>
                <td>Weather (${weatherLabel})</td>
                <td>× ${weatherFactor.toFixed(2)}</td>
                <td class="${getFactorClass(weatherFactor)}">${getEffectText(weatherFactor)}</td>
            </tr>
            <tr>
                <td>EU Wet Grip Grade ${grade}</td>
                <td>× ${gradeFactor.toFixed(2)}</td>
                <td class="${getFactorClass(gradeFactor)}">${getEffectText(gradeFactor)}</td>
            </tr>
            <tr>
                <td>Tread Depth (${treadMm}mm)</td>
                <td>× ${treadFactor.toFixed(2)}</td>
                <td class="${getFactorClass(treadFactor)}">${getEffectText(treadFactor)}</td>
            </tr>
            <tr>
                <td>Tyre Age (${ageYears === 0 ? 'New' : ageYears + ' years'})</td>
                <td>× ${ageFactor.toFixed(2)}</td>
                <td class="${getFactorClass(ageFactor)}">${getEffectText(ageFactor)}</td>
            </tr>
        </table>

        <div class="why-mu-result">
            <span>Effective Friction (μ)</span>
            <strong>${effectiveMu.toFixed(3)}</strong>
        </div>

        <h4 class="why-section-title">Physics Calculation</h4>
        <div class="why-formula-box">
            <code>Braking Distance = v² / (2 × g × μ)</code>
            <code>= ${speedMs.toFixed(2)}² / (2 × 9.81 × ${effectiveMu.toFixed(3)})</code>
            <code>= ${(speedMs * speedMs).toFixed(2)} / ${(2 * 9.81 * effectiveMu).toFixed(3)}</code>
            <code class="formula-result">= ${distance.toFixed(1)} metres</code>
        </div>

        <p style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-muted);">
            Based on UltimateBrakingPhysics v3.4.3 — validated against EU Regulation 2020/740 test data.
        </p>
    `;
}

// =====================================================
// SIMPLE COLLAPSIBLE SECTIONS
// =====================================================
function setupCollapsibleSections() {
    // Make each selection-section collapsible by clicking its h2 header
    document.querySelectorAll('.selection-section').forEach(section => {
        const h2 = section.querySelector('h2');
        if (!h2) return;

        // Don't collapse sections that are already in accordion format
        if (section.closest('.accordion-section')) return;

        // Add collapsible styling
        section.classList.add('collapsible-section');

        // Get initial default value to show in header
        const defaultValue = getDefaultValueForSection(section);

        // Add value badge to h2 (shows current selection)
        const valueBadge = document.createElement('span');
        valueBadge.className = 'section-value-badge';
        valueBadge.textContent = defaultValue;
        section.dataset.valueBadge = 'true';

        // Add arrow indicator to h2
        const arrow = document.createElement('span');
        arrow.className = 'collapse-arrow';
        arrow.textContent = '▼';

        // Find the info button if present - insert badge and arrow before it
        const infoBtn = h2.querySelector('.info-btn');
        if (infoBtn) {
            h2.insertBefore(valueBadge, infoBtn);
            h2.insertBefore(arrow, infoBtn);
        } else {
            h2.appendChild(valueBadge);
            h2.appendChild(arrow);
        }

        // Collapse all except grade selector by default
        const isGradeSection = section.querySelector('.grade-selector');
        if (!isGradeSection) {
            section.classList.add('collapsed');
        }

        // Add click to toggle
        h2.style.cursor = 'pointer';
        h2.addEventListener('click', (e) => {
            if (e.target.closest('.info-btn')) return;
            section.classList.toggle('collapsed');
        });
    });
}

// Get the default/currently selected value for a section
function getDefaultValueForSection(section) {
    // Check for active button in various selectors
    const gradeBtn = section.querySelector('.grade-btn.active');
    if (gradeBtn) return `Grade ${gradeBtn.dataset.grade}`;

    const fuelGradeBtn = section.querySelector('.fuel-grade-btn.active');
    if (fuelGradeBtn) return `Grade ${fuelGradeBtn.dataset.fuelgrade}`;

    const treadBtn = section.querySelector('.tread-btn.active');
    if (treadBtn) return treadBtn.querySelector('.tread-label')?.textContent || 'New';

    const weatherBtn = section.querySelector('.weather-btn.active');
    if (weatherBtn) return weatherBtn.querySelector('.weather-label')?.textContent || 'Rain';

    const tyretypeBtn = section.querySelector('.tyretype-btn.active');
    if (tyretypeBtn) return tyretypeBtn.querySelector('.tyretype-label')?.textContent || 'Summer';

    const vehicleBtn = section.querySelector('.vehicle-btn.active');
    if (vehicleBtn) return vehicleBtn.querySelector('.vehicle-label')?.textContent || 'Sedan';

    const surfaceBtn = section.querySelector('.surface-btn.active');
    if (surfaceBtn) return surfaceBtn.querySelector('.surface-label')?.textContent || 'Asphalt';

    // Sliders
    const ageSlider = section.querySelector('#age-slider');
    if (ageSlider) return 'New';

    const pressureSlider = section.querySelector('#pressure-slider');
    if (pressureSlider) return 'Optimal';

    const tyreSizeInput = section.querySelector('#tyre-size-input');
    if (tyreSizeInput) return tyreSizeInput.value || '205/55R16';

    const widthSlider = section.querySelector('#width-slider');
    if (widthSlider) return '205mm';

    const tempSlider = section.querySelector('#temp-slider');
    if (tempSlider) return '20°C';

    const slopeSlider = section.querySelector('#slope-slider');
    if (slopeSlider) return 'Flat';

    // Toggles
    const absToggle = section.querySelector('.abs-toggle-container');
    if (absToggle) return 'On';

    const trailerToggle = section.querySelector('.trailer-toggle');
    if (trailerToggle) return 'None';

    const windControls = section.querySelector('.wind-controls');
    if (windControls) return 'None';

    const brakeFade = section.querySelector('.brake-fade-container');
    if (brakeFade) return 'Normal';

    const compound = section.querySelector('.compound-selector');
    if (compound) return 'Standard';

    return 'Default';
}

// Update value badge when selection changes
function updateSectionValueBadge(section, newValue) {
    const badge = section.querySelector('.section-value-badge');
    if (badge) {
        badge.textContent = newValue;
    }
}

// Parse tyre size and extract width + max tread depth
function parseTyreSize(sizeStr) {
    const errorEl = document.getElementById('tyre-size-error');
    const parsedEl = document.getElementById('tyre-size-parsed');
    const widthEl = document.getElementById('parsed-width');
    const maxTreadEl = document.getElementById('parsed-max-tread');

    // Clean input
    sizeStr = sizeStr.trim().toUpperCase();

    // Metric format: 205/55R16, 265/60R18, etc.
    const metricMatch = sizeStr.match(/^(\d{3})\/(\d{2,3})R(\d{2})$/i);

    // Imperial format: 31x10.5R15, 33x12.5R17, etc.
    const imperialMatch = sizeStr.match(/^(\d{2,3})X([\d.]+)R(\d{2})$/i);

    let widthMm = 0;
    let maxTreadMm = 8;

    if (metricMatch) {
        widthMm = parseInt(metricMatch[1]);
    } else if (imperialMatch) {
        // Convert inches to mm
        const widthInches = parseFloat(imperialMatch[2]);
        widthMm = Math.round(widthInches * 25.4);
    } else {
        // Show error
        if (errorEl) errorEl.classList.remove('hidden');
        if (parsedEl) parsedEl.style.opacity = '0.5';
        return false;
    }

    // Hide error, show results
    if (errorEl) errorEl.classList.add('hidden');
    if (parsedEl) parsedEl.style.opacity = '1';

    // Calculate max tread depth based on width
    // Larger tyres have deeper tread grooves
    if (widthMm < 165) {
        maxTreadMm = 7;  // Small/trailer tyres
    } else if (widthMm < 195) {
        maxTreadMm = 8;  // Standard passenger
    } else if (widthMm < 225) {
        maxTreadMm = 9;  // Larger passenger
    } else if (widthMm < 255) {
        maxTreadMm = 10; // Performance/SUV
    } else if (widthMm < 285) {
        maxTreadMm = 12; // Large SUV/4WD
    } else {
        maxTreadMm = 16; // Truck/off-road tyres
    }

    // Update display
    if (widthEl) widthEl.textContent = `${widthMm}mm`;
    if (maxTreadEl) maxTreadEl.textContent = `${maxTreadMm}mm`;

    // Update game state
    GameState.selectedWidth = widthMm;
    GameState.maxTreadDepth = maxTreadMm;
    GameState.tyreSize = sizeStr;

    // Update tread depth presets based on max
    updateTreadPresetsForTyreSize(maxTreadMm);

    // Update section value badge
    const section = document.getElementById('tyre-size-input')?.closest('.selection-section');
    if (section) {
        updateSectionValueBadge(section, sizeStr);
    }

    updateAllInfo();
    return true;
}

// Update tread depth button values based on tyre size
function updateTreadPresetsForTyreSize(maxTreadMm) {
    // Update the tread preset values
    GAME_CONFIG.treadPresets = {
        'new': { value: maxTreadMm, label: `New (${maxTreadMm}mm)`, status: 'excellent' },
        'good': { value: Math.round(maxTreadMm * 0.6), label: `Good (${Math.round(maxTreadMm * 0.6)}mm)`, status: 'good' },
        'worn': { value: Math.round(maxTreadMm * 0.35), label: `Worn (${Math.round(maxTreadMm * 0.35)}mm)`, status: 'warning' },
        'legal': { value: 1.6, label: 'Legal Min (1.6mm)', status: 'danger' }
    };

    // Update the buttons to show new values
    document.querySelectorAll('.tread-btn').forEach(btn => {
        const tread = btn.dataset.tread;
        const preset = GAME_CONFIG.treadPresets[tread];
        if (preset) {
            const valueEl = btn.querySelector('.tread-value');
            if (valueEl) valueEl.textContent = tread === 'legal' ? '1.6mm' : `${preset.value}mm`;
        }
    });

    // Update GameState tread depth if currently on "new"
    if (GameState.selectedTread === 'new') {
        GameState.actualTreadDepth = maxTreadMm;
    }
}

function setupEventListeners() {
    // Setup collapsible sections
    setupCollapsibleSections();

    // Grade selection (Wet Grip)
    document.querySelectorAll('.grade-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.selectedGrade = btn.dataset.grade;
            updateSectionValueBadge(btn.closest('.selection-section'), `Grade ${btn.dataset.grade}`);
            updateAllInfo();
        });
    });

    // Fuel Economy Grade selection (Rolling Resistance)
    document.querySelectorAll('.fuel-grade-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fuel-grade-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.selectedFuelGrade = btn.dataset.fuelgrade;
            updateSectionValueBadge(btn.closest('.selection-section'), `Grade ${btn.dataset.fuelgrade}`);
            updateAllInfo();
        });
    });

    // Tread selection
    document.querySelectorAll('.tread-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tread-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.selectedTread = btn.dataset.tread;
            const label = btn.querySelector('.tread-label')?.textContent || btn.dataset.tread;
            updateSectionValueBadge(btn.closest('.selection-section'), label);
            updateAllInfo();
        });
    });

    // Weather selection
    document.querySelectorAll('.weather-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const weather = btn.dataset.weather;
            const customSection = document.getElementById('custom-water-section');
            const label = btn.querySelector('.weather-label')?.textContent || weather;
            updateSectionValueBadge(btn.closest('.selection-section'), label);

            if (weather === 'CUSTOM') {
                // Show custom water depth slider
                if (customSection) customSection.style.display = 'block';
                // Use the current slider value
                const slider = document.getElementById('water-depth-slider');
                if (slider) {
                    GameState.customWaterDepthMm = parseFloat(slider.value) / 10;
                }
                GameState.selectedWeather = 'CUSTOM';
            } else {
                // Hide custom section for preset weather
                if (customSection) customSection.style.display = 'none';
                GameState.selectedWeather = weather;
                GameState.customWaterDepthMm = null;
            }
            updateAllInfo();
        });
    });

    // Custom water depth slider
    const waterDepthSlider = document.getElementById('water-depth-slider');
    if (waterDepthSlider) {
        waterDepthSlider.addEventListener('input', (e) => {
            const depthMm = parseFloat(e.target.value) / 10; // Convert 0-50 to 0-5mm
            GameState.customWaterDepthMm = depthMm;

            // Update display
            const valueDisplay = document.getElementById('water-depth-value');
            if (valueDisplay) {
                valueDisplay.textContent = depthMm.toFixed(1) + 'mm';

                // Color code based on danger level
                if (depthMm === 0) {
                    valueDisplay.style.color = '#f59e0b'; // Dry - amber
                } else if (depthMm < 1) {
                    valueDisplay.style.color = '#3b82f6'; // Light wet - blue
                } else if (depthMm < 2.5) {
                    valueDisplay.style.color = '#6366f1'; // Moderate - indigo
                } else {
                    valueDisplay.style.color = '#ef4444'; // Dangerous - red
                }
            }
            updateAllInfo();
        });
    }

    // Age slider
    const ageSlider = document.getElementById('age-slider');
    if (ageSlider) {
        ageSlider.addEventListener('input', (e) => {
            GameState.selectedAge = parseInt(e.target.value);
            const ageLabel = GameState.selectedAge === 0 ? 'New' : `${GameState.selectedAge} years`;
            document.getElementById('age-value').textContent = ageLabel;
            updateSectionValueBadge(ageSlider.closest('.selection-section'), ageLabel);
            updateAllInfo();
        });
    }

    // Tyre type selection
    document.querySelectorAll('.tyretype-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tyretype-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.selectedTyreType = btn.dataset.tyretype;
            const label = btn.querySelector('.tyretype-label')?.textContent || btn.dataset.tyretype;
            updateSectionValueBadge(btn.closest('.selection-section'), label);
            updateAllInfo();
        });
    });

    // Pressure slider
    const pressureSlider = document.getElementById('pressure-slider');
    if (pressureSlider) {
        pressureSlider.addEventListener('input', (e) => {
            GameState.selectedPressure = parseInt(e.target.value);
            updatePressureDisplay();
            updateSectionValueBadge(pressureSlider.closest('.selection-section'), `${GameState.selectedPressure} PSI`);
            updateAllInfo();
        });
    }

    // Tyre Size Input
    const tyreSizeInput = document.getElementById('tyre-size-input');
    const parseTyreSizeBtn = document.getElementById('parse-tyre-size-btn');

    if (tyreSizeInput && parseTyreSizeBtn) {
        // Parse on button click
        parseTyreSizeBtn.addEventListener('click', () => {
            parseTyreSize(tyreSizeInput.value);
        });

        // Parse on Enter key
        tyreSizeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                parseTyreSize(tyreSizeInput.value);
            }
        });

        // Quick size buttons
        document.querySelectorAll('.quick-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                tyreSizeInput.value = size;
                parseTyreSize(size);
            });
        });

        // Parse default on load
        parseTyreSize(tyreSizeInput.value);
    }

    // Legacy width slider (if still exists in some versions)
    const widthSlider = document.getElementById('width-slider');
    if (widthSlider) {
        widthSlider.addEventListener('input', (e) => {
            GameState.selectedWidth = parseInt(e.target.value);
            updateWidthDisplay();
            updateSectionValueBadge(widthSlider.closest('.selection-section'), `${GameState.selectedWidth}mm`);
            updateAllInfo();
        });
    }

    // Surface selection
    document.querySelectorAll('.surface-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.surface-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.selectedSurface = btn.dataset.surface;
            const label = btn.querySelector('.surface-label')?.textContent || btn.dataset.surface;
            updateSectionValueBadge(btn.closest('.selection-section'), label);
            updateAllInfo();
        });
    });

    // Vehicle selection
    document.querySelectorAll('.vehicle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.vehicle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.selectedVehicle = btn.dataset.vehicle;
            const label = btn.querySelector('.vehicle-label')?.textContent || btn.dataset.vehicle;
            updateSectionValueBadge(btn.closest('.selection-section'), label);
            // Update weight input to match vehicle preset
            const vehicleData = GAME_CONFIG.vehicles[btn.dataset.vehicle];
            if (vehicleData) {
                GameState.vehicleWeight = vehicleData.weight;
                const weightInput = document.getElementById('vehicle-weight-input');
                if (weightInput) weightInput.value = vehicleData.weight;
            }
            updateAllInfo();
        });
    });

    // Manual vehicle weight input
    const vehicleWeightInput = document.getElementById('vehicle-weight-input');
    if (vehicleWeightInput) {
        vehicleWeightInput.addEventListener('input', (e) => {
            GameState.vehicleWeight = parseInt(e.target.value) || 1500;
            updateAllInfo();
        });
    }

    // Trailer type selection
    document.querySelectorAll('.trailer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.trailer-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.trailerType = btn.dataset.trailer;
            updateTrailerDisplay();
            updateAllInfo();
        });
    });

    // Trailer weight input
    const trailerWeightInput = document.getElementById('trailer-weight-input');
    if (trailerWeightInput) {
        trailerWeightInput.addEventListener('input', (e) => {
            GameState.trailerWeight = parseInt(e.target.value) || 500;
            updateAllInfo();
        });
    }

    // Wind speed slider
    const windSpeedSlider = document.getElementById('wind-speed-slider');
    if (windSpeedSlider) {
        windSpeedSlider.addEventListener('input', (e) => {
            GameState.windSpeed = parseInt(e.target.value);
            updateWindDisplay();
            updateAllInfo();
        });
    }

    // Wind direction selection
    document.querySelectorAll('.wind-dir-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.wind-dir-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.windDirection = btn.dataset.direction;
            updateAllInfo();
        });
    });

    // Temperature slider
    const tempSlider = document.getElementById('temp-slider');
    if (tempSlider) {
        tempSlider.addEventListener('input', (e) => {
            GameState.selectedTemp = parseInt(e.target.value);
            updateTempDisplay();
            updateSectionValueBadge(tempSlider.closest('.selection-section'), `${GameState.selectedTemp}°C`);
            updateAllInfo();
        });
    }

    // ABS toggle
    document.querySelectorAll('.abs-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.abs-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.hasABS = btn.dataset.abs === 'true';
            updateSectionValueBadge(btn.closest('.selection-section'), GameState.hasABS ? 'On' : 'Off');
            updateAllInfo();
        });
    });

    // Slope slider
    const slopeSlider = document.getElementById('slope-slider');
    if (slopeSlider) {
        slopeSlider.addEventListener('input', (e) => {
            GameState.slopeDegrees = parseInt(e.target.value);
            updateSlopeDisplay();
            const slopeLabel = GameState.slopeDegrees === 0 ? 'Flat' : `${GameState.slopeDegrees}°`;
            updateSectionValueBadge(slopeSlider.closest('.selection-section'), slopeLabel);
            updateAllInfo();
        });
    }

    // Slope preset buttons
    document.querySelectorAll('.slope-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.slope-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const slope = parseInt(btn.dataset.slope);
            GameState.slopeDegrees = slope;
            const slider = document.getElementById('slope-slider');
            if (slider) slider.value = slope;
            updateSlopeDisplay();
            updateAllInfo();
        });
    });

    // Brake fade slider
    const brakeFadeSlider = document.getElementById('brake-fade-slider');
    if (brakeFadeSlider) {
        brakeFadeSlider.addEventListener('input', (e) => {
            GameState.brakeFadeLevel = parseInt(e.target.value);
            updateBrakeFadeDisplay();
            updateAllInfo();
        });
    }

    // Brake fade preset buttons
    document.querySelectorAll('.fade-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fade-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const fade = parseInt(btn.dataset.fade);
            GameState.brakeFadeLevel = fade;
            const slider = document.getElementById('brake-fade-slider');
            if (slider) slider.value = fade;
            updateBrakeFadeDisplay();
            updateAllInfo();
        });
    });

    // Tyre compound selector
    document.querySelectorAll('.compound-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.compound-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            GameState.tyreCompound = btn.dataset.compound;
            updateAllInfo();
        });
    });

    // Start button
    document.getElementById('start-btn').addEventListener('click', startTest);

    // Retry and menu buttons
    document.getElementById('retry-btn').addEventListener('click', retryTest);
    document.getElementById('menu-btn').addEventListener('click', returnToMenu);

    // HUD back button (during gameplay)
    const hudBackBtn = document.getElementById('hud-back-btn');
    if (hudBackBtn) {
        hudBackBtn.addEventListener('click', returnToMenu);
    }

    // Accelerate button handlers
    const accelBtn = document.getElementById('accel-btn');
    if (accelBtn) {
        // Mouse
        accelBtn.addEventListener('mousedown', startAccelerating);
        accelBtn.addEventListener('mouseup', stopAccelerating);
        accelBtn.addEventListener('mouseleave', stopAccelerating);
        // Touch
        accelBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startAccelerating();
        });
        accelBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopAccelerating();
        });
    }

    // Brake button click handler
    const brakeBtn = document.getElementById('brake-btn');
    if (brakeBtn) {
        brakeBtn.addEventListener('click', triggerBrake);
        brakeBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerBrake();
        });
    }

    // Keyboard controls (space = accelerate)
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function startAccelerating() {
    if (GameState.currentScreen !== 'game' || GameState.testComplete || GameState.isBraking) return;
    GameState.isAccelerating = true;
    const accelBtn = document.getElementById('accel-btn');
    if (accelBtn) accelBtn.classList.add('active');
}

function stopAccelerating() {
    GameState.isAccelerating = false;
    const accelBtn = document.getElementById('accel-btn');
    if (accelBtn) accelBtn.classList.remove('active');
}

function updateWidthDisplay() {
    const width = GameState.selectedWidth;
    const widthValueEl = document.getElementById('width-value');
    const widthCategoryEl = document.getElementById('width-category');

    if (!widthValueEl) return;

    // Display in current unit
    if (GameState.widthUnit === 'imperial') {
        const inches = (width / 25.4).toFixed(1);
        widthValueEl.textContent = `${inches}"`;
    } else {
        widthValueEl.textContent = `${width}mm`;
    }

    // Update category description
    if (widthCategoryEl) {
        let category = 'Standard Passenger';
        if (width <= 155) category = 'Narrow - Small cars, trailers';
        else if (width <= 195) category = 'Standard - Passenger cars';
        else if (width <= 245) category = 'Wide - SUVs, performance';
        else if (width <= 295) category = 'Very Wide - Sports cars';
        else category = 'Ultra Wide - Supercars, trucks';
        widthCategoryEl.textContent = category;
    }
}

function updateTrailerDisplay() {
    const trailerConfig = document.getElementById('trailer-config');
    if (!trailerConfig) return;

    if (GameState.trailerType === 'none') {
        trailerConfig.classList.add('hidden');
    } else {
        trailerConfig.classList.remove('hidden');
    }
}

function updateWindDisplay() {
    const windSpeed = GameState.windSpeed;
    const windValueEl = document.getElementById('wind-speed-value');

    if (!windValueEl) return;

    let label = 'Calm';
    if (windSpeed === 0) label = 'Calm';
    else if (windSpeed <= 15) label = `${windSpeed} km/h (Light)`;
    else if (windSpeed <= 40) label = `${windSpeed} km/h (Moderate)`;
    else if (windSpeed <= 70) label = `${windSpeed} km/h (Strong)`;
    else label = `${windSpeed} km/h (Severe)`;

    windValueEl.textContent = label;
}

function updateSlopeDisplay() {
    const slope = GameState.slopeDegrees;
    const slopeValueEl = document.getElementById('slope-value');
    const slopeIndicator = document.getElementById('slope-indicator');

    if (slopeValueEl) {
        let label;
        if (slope === 0) label = '0° Flat';
        else if (slope > 0) label = `+${slope}° Uphill`;
        else label = `${slope}° Downhill`;
        slopeValueEl.textContent = label;

        // Color based on danger
        if (slope < -8) {
            slopeValueEl.style.color = '#ef4444';
        } else if (slope < -5) {
            slopeValueEl.style.color = '#f97316';
        } else if (slope > 8) {
            slopeValueEl.style.color = '#22c55e';
        } else if (slope > 5) {
            slopeValueEl.style.color = '#84cc16';
        } else {
            slopeValueEl.style.color = '';
        }
    }

    // Rotate the visual indicator
    if (slopeIndicator) {
        slopeIndicator.style.transform = `rotate(${-slope}deg)`;
    }

    // Update preset button active states
    document.querySelectorAll('.slope-preset-btn').forEach(btn => {
        const presetSlope = parseInt(btn.dataset.slope);
        if (presetSlope === slope) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updateBrakeFadeDisplay() {
    const fade = GameState.brakeFadeLevel;
    const fadeValueEl = document.getElementById('brake-fade-value');
    const fadeBar = document.querySelector('.fade-bar');

    if (fadeValueEl) {
        let label;
        if (fade <= 2) label = `${fade} - Normal`;
        else if (fade <= 4) label = `${fade} - Warm`;
        else if (fade <= 6) label = `${fade} - Hot`;
        else if (fade <= 8) label = `${fade} - Very Hot`;
        else label = `${fade} - SEVERE FADE!`;

        fadeValueEl.textContent = label;

        // Add warning classes
        fadeValueEl.classList.remove('hot', 'danger');
        if (fade >= 7) {
            fadeValueEl.classList.add('danger');
        } else if (fade >= 5) {
            fadeValueEl.classList.add('hot');
        }
    }

    // Update the visual bar
    if (fadeBar) {
        const healthPercent = 100 - (fade * 10);
        const colors = {
            0: '#22c55e',
            2: '#84cc16',
            4: '#facc15',
            6: '#f97316',
            8: '#ef4444',
            10: '#dc2626'
        };

        // Find closest color
        let color = '#22c55e';
        for (let threshold in colors) {
            if (fade >= parseInt(threshold)) {
                color = colors[threshold];
            }
        }

        fadeBar.style.background = `linear-gradient(90deg, ${color} ${healthPercent}%, #333 ${healthPercent}%)`;
    }

    // Update preset button active states
    document.querySelectorAll('.fade-preset-btn').forEach(btn => {
        const presetFade = parseInt(btn.dataset.fade);
        // Match exactly or closest
        btn.classList.remove('active');
    });

    // Find closest preset
    const presets = [0, 3, 5, 8];
    let closest = 0;
    let minDiff = 999;
    presets.forEach(p => {
        if (Math.abs(p - fade) < minDiff) {
            minDiff = Math.abs(p - fade);
            closest = p;
        }
    });

    document.querySelectorAll('.fade-preset-btn').forEach(btn => {
        if (parseInt(btn.dataset.fade) === closest) {
            btn.classList.add('active');
        }
    });
}

function updatePressureDisplay() {
    const pressure = GameState.selectedPressure;
    const pressureValueEl = document.getElementById('pressure-value');
    const pressureWarningEl = document.getElementById('pressure-warning');
    const pressureWarningTextEl = document.getElementById('pressure-warning-text');

    if (!pressureValueEl) return;

    const optimal = GAME_CONFIG.pressure.optimal;
    const deviation = Math.abs(pressure - optimal);

    // Update the display text
    if (pressure === optimal) {
        pressureValueEl.textContent = `${pressure} PSI (Optimal)`;
        pressureValueEl.className = 'pressure-optimal';
    } else if (deviation <= 4) {
        pressureValueEl.textContent = `${pressure} PSI`;
        pressureValueEl.className = 'pressure-warning';
    } else {
        pressureValueEl.textContent = `${pressure} PSI`;
        pressureValueEl.className = 'pressure-danger';
    }

    // Show/hide warning
    if (pressureWarningEl && pressureWarningTextEl) {
        if (deviation > 4) {
            pressureWarningEl.classList.remove('hidden');
            if (pressure < optimal) {
                pressureWarningTextEl.textContent = `Under-inflated by ${deviation} PSI - reduced grip & increased wear`;
            } else {
                pressureWarningTextEl.textContent = `Over-inflated by ${deviation} PSI - smaller contact patch`;
            }
        } else {
            pressureWarningEl.classList.add('hidden');
        }
    }
}

function updateTempDisplay() {
    const temp = GameState.selectedTemp;
    const tempValueEl = document.getElementById('temp-value');
    const tempWarningEl = document.getElementById('temp-warning');
    const tempWarningTextEl = document.getElementById('temp-warning-text');

    if (!tempValueEl) return;

    const coldThreshold = 7;
    const hotThreshold = 35;

    // Update the display text
    if (temp < coldThreshold) {
        tempValueEl.textContent = `${temp}°C`;
        tempValueEl.className = 'temp-cold';
    } else if (temp > hotThreshold) {
        tempValueEl.textContent = `${temp}°C`;
        tempValueEl.className = 'temp-hot';
    } else {
        tempValueEl.textContent = `${temp}°C`;
        tempValueEl.className = 'temp-optimal';
    }

    // Show/hide warning
    if (tempWarningEl && tempWarningTextEl) {
        if (temp < coldThreshold) {
            tempWarningEl.classList.remove('hidden');
            tempWarningEl.classList.remove('hot');
            if (GameState.selectedTyreType === 'summer') {
                tempWarningTextEl.textContent = `Summer tyres lose significant grip below 7°C - consider winter/all-season tyres`;
            } else if (GameState.selectedTyreType === 'winter') {
                tempWarningTextEl.textContent = `Winter tyres perform best in cold conditions`;
            } else {
                tempWarningTextEl.textContent = `All-season tyres provide moderate cold performance`;
            }
        } else if (temp > hotThreshold) {
            tempWarningEl.classList.remove('hidden');
            tempWarningEl.classList.add('hot');
            tempWarningTextEl.textContent = `High temperatures can soften road surfaces and increase tyre wear`;
        } else {
            tempWarningEl.classList.add('hidden');
        }
    }
}

function updateAllInfo() {
    const grade = GameState.selectedGrade;
    const treadMm = GAME_CONFIG.treadPresets[GameState.selectedTread].value;
    const weather = GameState.selectedWeather;
    const age = GameState.selectedAge;
    const tyreType = GameState.selectedTyreType;
    const pressure = GameState.selectedPressure;
    const width = GameState.selectedWidth;
    const surface = GameState.selectedSurface;
    const vehicle = GameState.selectedVehicle;
    const temp = GameState.selectedTemp;
    const hasABS = GameState.hasABS;
    const windSpeed = GameState.windSpeed;
    const windDirection = GameState.windDirection;
    const trailerType = GameState.trailerType;
    const trailerWeight = GameState.trailerWeight;
    const vehicleWeight = GameState.vehicleWeight;

    // Calculate braking distance at 80 km/h for preview
    const previewSpeed = 80;
    const fuelGrade = GameState.selectedFuelGrade;
    const yourDist = calculateBrakingDistance(previewSpeed, grade, treadMm, weather, age, tyreType, pressure, width, surface, vehicle, temp, hasABS, windSpeed, windDirection, trailerType, trailerWeight, vehicleWeight, 0, 0, 'touring', fuelGrade);
    const bestDist = calculateBrakingDistance(previewSpeed, 'A', 8, weather, 0, 'winter', 32, 205, surface, 'hatchback', 20, true, 0, 'headwind', 'none', 0, 1200, 0, 0, 'touring', 'A');
    const worstDist = calculateBrakingDistance(previewSpeed, 'E', 1.6, weather, 10, 'summer', 20, 295, surface, 'truck', -5, false, 100, 'tailwind', 'unbraked', 750, 2500, 0, 0, 'touring', 'E');

    const diff = yourDist - bestDist;

    const infoPanel = document.getElementById('config-info');
    if (infoPanel) {
        const weatherLabel = GAME_CONFIG.weatherPresets[weather]?.label || 'Rain';
        const treadLabel = GAME_CONFIG.treadPresets[GameState.selectedTread]?.label || '8mm';
        const tyreTypeLabel = GAME_CONFIG.tyreTypes[tyreType]?.label || 'Summer';
        const surfaceLabel = GAME_CONFIG.surfaces[surface]?.label || 'Asphalt';
        const vehicleLabel = GAME_CONFIG.vehicles[vehicle]?.label || 'Sedan';
        const gradeColor = GAME_CONFIG.grades[grade]?.color || '#fff';
        const trailerLabel = GAME_CONFIG.trailer.types[trailerType]?.label || 'None';
        const windLabel = windSpeed > 0 ? `${windSpeed} km/h ${windDirection}` : 'Calm';

        infoPanel.innerHTML = `
            <h3 style="color: ${gradeColor}">Your Configuration</h3>
            <div class="config-summary">
                <div class="config-item">
                    <span class="config-label">EU Grade</span>
                    <span class="config-value" style="color: ${gradeColor}">${grade}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Tread</span>
                    <span class="config-value">${treadLabel}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Weather</span>
                    <span class="config-value">${weatherLabel}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Surface</span>
                    <span class="config-value">${surfaceLabel}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Weight</span>
                    <span class="config-value">${vehicleWeight}kg</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Trailer</span>
                    <span class="config-value">${trailerType === 'none' ? 'None' : `${trailerLabel} (${trailerWeight}kg)`}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Width</span>
                    <span class="config-value">${width}mm</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Tyre Type</span>
                    <span class="config-value">${tyreTypeLabel}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Pressure</span>
                    <span class="config-value">${pressure} PSI</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Wind</span>
                    <span class="config-value">${windLabel}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Temp</span>
                    <span class="config-value">${temp}°C</span>
                </div>
                <div class="config-item">
                    <span class="config-label">ABS</span>
                    <span class="config-value">${hasABS ? 'ON' : 'OFF'}</span>
                </div>
            </div>
            <div class="preview-distance">
                <p>At <strong>80 km/h</strong>, estimated braking distance:</p>
                <div class="preview-value">${yourDist.toFixed(1)}m</div>
                ${diff > 0 ? `<p class="preview-diff">+${diff.toFixed(1)}m vs best possible</p>` : '<p class="preview-diff best">Best possible configuration!</p>'}
            </div>
        `;
    }
}

// =====================================================
// GAME FLOW
// =====================================================

function startTest() {
    document.getElementById('main-menu').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    document.getElementById('hud-grade').textContent = GameState.selectedGrade;
    document.getElementById('hud-test-type').textContent =
        GAME_CONFIG.weatherPresets[GameState.selectedWeather]?.label.toUpperCase() || 'WET';

    resetGameState();

    setTimeout(() => {
        if (GameState.renderer) {
            GameState.renderer.resize();
        }
        GameState.currentScreen = 'game';
        GameState.lastTime = performance.now();
        GameState.animationId = requestAnimationFrame(gameLoop);
    }, 50);
}

function resetGameState() {
    GameState.speed = 0;
    GameState.position = 0;
    GameState.isAccelerating = false;
    GameState.isBraking = false;
    GameState.brakeReady = false;
    GameState.hasReleasedAccelerator = false;
    GameState.brakeSpeed = 0;
    GameState.brakePosition = 0;
    GameState.stoppedDistance = 0;
    GameState.testComplete = false;
    GameState.markers = [];
    GameState.physicsResult = null;
    GameState.cannotStop = false;
    GameState.cannotStopWarned = false;

    GameState.stats = {
        startTime: performance.now(),
        accelerationStartTime: 0,
        brakeStartTime: 0,
        endTime: 0,
        peakSpeed: 0,
        avgAcceleration: 0,
        timeToTopSpeed: 0,
        distanceToTopSpeed: 0,
        brakingTime: 0,
        avgDeceleration: 0,
        totalTime: 0,
        totalDistance: 0,
        speedHistory: [],
        reactionDistance: 0,
        accelerationDistance: 0,
        firstAccelTime: 0,
        wasAccelerating: false
    };

    document.getElementById('results-panel').classList.add('hidden');

    // Show the game controls
    const gameControls = document.querySelector('.game-controls');
    if (gameControls) gameControls.style.display = 'flex';

    // Reset accelerate button state
    const accelBtn = document.getElementById('accel-btn');
    if (accelBtn) accelBtn.classList.remove('active');
}

function retryTest() {
    resetGameState();
    GameState.lastTime = performance.now();
    GameState.animationId = requestAnimationFrame(gameLoop);
}

function returnToMenu() {
    if (GameState.animationId) {
        cancelAnimationFrame(GameState.animationId);
    }

    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('main-menu').classList.add('active');

    GameState.currentScreen = 'menu';
    updateAllInfo();
}

// =====================================================
// INPUT HANDLING
// =====================================================

function handleKeyDown(e) {
    if (GameState.currentScreen !== 'game' || GameState.testComplete) return;

    if (e.code === 'Space') {
        e.preventDefault();
        startAccelerating();
    }
}

function handleKeyUp(e) {
    if (e.code === 'Space') {
        stopAccelerating();
    }
}

function triggerBrake() {
    // Can brake at any speed > 0
    if (GameState.isBraking || GameState.speed <= 0) return;

    // Hide game controls
    const gameControls = document.querySelector('.game-controls');
    if (gameControls) gameControls.style.display = 'none';

    // Stop accelerating
    GameState.isAccelerating = false;
    stopAccelerating();

    startBraking();
}

function startBraking() {
    GameState.isBraking = true;
    GameState.hasReleasedAccelerator = true;
    GameState.brakeSpeed = GameState.speed;
    GameState.brakePosition = GameState.position;

    const stats = GameState.stats;
    stats.brakeStartTime = performance.now();
    stats.accelerationDistance = GameState.position;

    // Get full physics result for this braking scenario
    const treadMm = GAME_CONFIG.treadPresets[GameState.selectedTread].value;
    GameState.physicsResult = getFullPhysicsResult(
        GameState.brakeSpeed,
        GameState.selectedGrade,
        treadMm,
        GameState.selectedWeather,
        GameState.selectedAge
    );

    calculateComparisonMarkers();
}

function calculateComparisonMarkers() {
    const grades = ['A', 'B', 'C', 'D', 'E'];
    const treadMm = GAME_CONFIG.treadPresets[GameState.selectedTread].value;

    GameState.markers = [];

    grades.forEach(grade => {
        const stopDistance = calculateBrakingDistance(
            GameState.brakeSpeed,
            grade,
            treadMm,
            GameState.selectedWeather,
            GameState.selectedAge,
            GameState.selectedTyreType,
            GameState.selectedPressure,
            GameState.selectedWidth,
            GameState.selectedSurface,
            GameState.selectedVehicle,
            GameState.selectedTemp,
            GameState.hasABS,
            GameState.windSpeed,
            GameState.windDirection,
            GameState.trailerType,
            GameState.trailerWeight,
            GameState.vehicleWeight,
            GameState.slopeDegrees || 0,        // Include slope
            GameState.brakeFadeLevel || 0,      // Include brake fade
            GameState.selectedCompound || 'touring',  // Include compound
            GameState.selectedFuelGrade || 'C'  // Include fuel economy grade
        );

        GameState.markers.push({
            grade: grade,
            distance: stopDistance,
            color: GAME_CONFIG.grades[grade].color,
            isCurrent: grade === GameState.selectedGrade,
            cannotStop: !isFinite(stopDistance)  // Track if cannot stop
        });
    });
}

// =====================================================
// GAME LOOP
// =====================================================

function gameLoop(currentTime = performance.now()) {
    if (GameState.currentScreen !== 'game') return;

    try {
        const deltaTime = (currentTime - GameState.lastTime) / 1000;
        GameState.lastTime = currentTime;

        update(deltaTime);
        render();

        if (!GameState.testComplete) {
            GameState.animationId = requestAnimationFrame(gameLoop);
        }
    } catch (error) {
        console.error('Game loop error:', error);
        cancelAnimationFrame(GameState.animationId);
        showGameError('Something went wrong. Please refresh the page to try again.');
    }
}

function showGameError(message) {
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen) {
        const errorOverlay = document.createElement('div');
        errorOverlay.className = 'game-error-overlay';
        errorOverlay.innerHTML = `
            <div class="game-error-content">
                <span class="game-error-icon">⚠️</span>
                <p class="game-error-message">${message}</p>
                <button class="game-error-btn" onclick="location.reload()">Refresh Page</button>
            </div>
        `;
        errorOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;';
        errorOverlay.querySelector('.game-error-content').style.cssText = 'text-align:center;color:white;padding:40px;';
        errorOverlay.querySelector('.game-error-icon').style.cssText = 'font-size:48px;display:block;margin-bottom:20px;';
        errorOverlay.querySelector('.game-error-message').style.cssText = 'font-size:18px;margin-bottom:20px;';
        errorOverlay.querySelector('.game-error-btn').style.cssText = 'padding:12px 24px;font-size:16px;background:#ff6b00;color:white;border:none;border-radius:8px;cursor:pointer;';
        gameScreen.appendChild(errorOverlay);
    }
}

function update(dt) {
    if (GameState.testComplete) return;

    const stats = GameState.stats;
    const now = performance.now();

    if (stats.speedHistory.length === 0 || now - stats.speedHistory[stats.speedHistory.length - 1].time > 100) {
        stats.speedHistory.push({
            time: now,
            speed: GameState.speed,
            position: GameState.position
        });
    }

    // Acceleration - user can keep accelerating even after brake button appears
    if (GameState.isAccelerating && !GameState.isBraking) {
        if (!stats.wasAccelerating) {
            stats.wasAccelerating = true;
            if (stats.firstAccelTime === 0) {
                stats.firstAccelTime = now;
                stats.accelerationStartTime = now;
            }
        }

        GameState.speed += GameState.acceleration * dt;
        if (GameState.speed > GameState.maxSpeed) {
            GameState.speed = GameState.maxSpeed;
        }

        if (GameState.speed > stats.peakSpeed) {
            stats.peakSpeed = GameState.speed;
            stats.timeToTopSpeed = (now - stats.firstAccelTime) / 1000;
            stats.distanceToTopSpeed = GameState.position;
        }
    }

    // Brake is always ready once moving (any speed works)
    if (GameState.speed > 0 && !GameState.brakeReady && !GameState.isBraking) {
        GameState.brakeReady = true;
    }

    // Braking physics - calculate deceleration based on friction (v3.4.3)
    if (GameState.isBraking && GameState.speed > 0) {
        // Get water depth from weather preset
        const waterDepths = {
            'DRY': 0, 'DAMP': 0.1, 'LIGHT_RAIN': 0.3, 'RAIN': 0.7, 'HEAVY_RAIN': 1.5
        };
        const waterMm = waterDepths[GameState.selectedWeather] || 0.7;

        // 3-state wetness system with blending
        const isDry = waterMm <= 0;
        const isDamp = waterMm > 0 && waterMm <= 0.5;
        const isWet = waterMm > 0.5;
        const dampBlend = isDamp ? (waterMm / 0.5) : (isWet ? 1.0 : 0.0);

        // Base surface friction based on surface type
        const surfaceData = GAME_CONFIG.surfaces[GameState.selectedSurface] || GAME_CONFIG.surfaces['ASPHALT_STD'];
        let baseMu = isDry ? surfaceData.baseMu : surfaceData.wetMu;

        // ABS factor
        const absFactor = GameState.hasABS ? 1.00 : 0.85;
        let mu = baseMu * absFactor;

        // Weather factor (water depth effect per v3.4.3)
        let weatherFactor;
        if (waterMm <= 0) weatherFactor = 1.00;
        else if (waterMm <= 0.2) weatherFactor = 1.00 - (waterMm * 0.50);
        else if (waterMm <= 0.5) weatherFactor = 0.90 - ((waterMm - 0.2) * 0.50);
        else if (waterMm <= 1.0) weatherFactor = 0.75 - ((waterMm - 0.5) * 0.30);
        else if (waterMm <= 2.0) weatherFactor = 0.60 - ((waterMm - 1.0) * 0.15);
        else weatherFactor = 0.45 - ((waterMm - 2.0) * 0.12);
        weatherFactor = Math.max(0.05, weatherFactor);
        mu *= weatherFactor;

        // EU Grade factor (v3.4.3 values) - blended for damp conditions
        const gradeWetFactors = { A: 1.15, B: 1.06, C: 1.00, D: 0.89, E: 0.80 };
        const wetFactor = gradeWetFactors[GameState.selectedGrade] || 1.00;
        const dryAdjust = 0.40;
        const dryFactor = 1.0 + (wetFactor - 1.0) * dryAdjust;
        const gradeFactor = dryFactor + (wetFactor - dryFactor) * dampBlend;
        mu *= gradeFactor;

        // Tread depth factor (piecewise with collapse below 4mm) - blended
        const treadMm = GAME_CONFIG.treadPresets[GameState.selectedTread].value;
        let treadWetFactor, treadDryFactor;

        // Wet tread factor (piecewise per v3.4.3)
        if (treadMm >= 8) treadWetFactor = 1.00;
        else if (treadMm >= 4) treadWetFactor = 0.64 + (0.045 * treadMm);
        else if (treadMm >= 1.6) treadWetFactor = 0.304 + (0.129 * treadMm);
        else treadWetFactor = 0.304 + (0.129 * treadMm);
        treadWetFactor = Math.max(0.20, Math.min(1.00, treadWetFactor));

        // Dry tread factor (gentle decline)
        treadDryFactor = 0.88 + (0.015 * Math.min(8, treadMm));

        // Blend based on wetness
        const treadFactor = treadDryFactor + (treadWetFactor - treadDryFactor) * dampBlend;
        mu *= treadFactor;

        // Age factor (accelerating degradation per v3.4.3)
        const ageYears = GameState.selectedAge;
        let ageFactor;
        if (ageYears <= 0) ageFactor = 1.00;
        else if (ageYears <= 2) ageFactor = 1.00 - (0.01 * ageYears);
        else if (ageYears <= 4) ageFactor = 0.98 - (0.025 * (ageYears - 2));
        else if (ageYears <= 6) ageFactor = 0.93 - (0.040 * (ageYears - 4));
        else if (ageYears <= 8) ageFactor = 0.85 - (0.060 * (ageYears - 6));
        else if (ageYears <= 10) ageFactor = 0.73 - (0.070 * (ageYears - 8));
        else ageFactor = 0.59 - (0.050 * (ageYears - 10));
        ageFactor = Math.max(0.35, ageFactor);
        mu *= ageFactor;

        // Tyre type factor (winter/all-season better in wet)
        const tyreTypeFactors = { 'summer': 1.00, 'allseason': 1.04, 'winter': 1.10 };
        const tyreTypeFactor = isDry ? 1.00 : (tyreTypeFactors[GameState.selectedTyreType] || 1.00);
        mu *= tyreTypeFactor;

        // Pressure factor (deviation from optimal 32 PSI)
        const optimalPsi = 32;
        const deviation = Math.abs(GameState.selectedPressure - optimalPsi);
        let pressureFactor = 1.00;
        if (deviation > 0) {
            pressureFactor = Math.max(0.70, 1.00 - (deviation * 0.015));
        }
        mu *= pressureFactor;

        // Width factor - wider tyres hydroplane easier in wet, but more grip in dry
        const widthData = GAME_CONFIG.tyreWidths[GameState.selectedWidth] || GAME_CONFIG.tyreWidths[205];
        let widthFactor = 1.00;
        if (!isDry) {
            widthFactor = 1.00 / widthData.hydroRisk;
        } else {
            widthFactor = 1.00 + ((GameState.selectedWidth - 205) / 205) * 0.05;
        }
        widthFactor = Math.max(0.70, Math.min(1.15, widthFactor));
        mu *= widthFactor;

        // Vehicle weight factor
        const vehicleData = GAME_CONFIG.vehicles[GameState.selectedVehicle] || GAME_CONFIG.vehicles['sedan'];
        const vehicleFactor = 1.00 / vehicleData.factor;
        mu *= vehicleFactor;

        // Temperature factor
        let tempFactor = 1.00;
        const coldThreshold = 7;
        const hotThreshold = 35;
        const temp = GameState.selectedTemp;

        if (temp < coldThreshold) {
            if (GameState.selectedTyreType === 'summer') {
                tempFactor = 0.80 + (temp / coldThreshold) * 0.20;
            } else if (GameState.selectedTyreType === 'allseason') {
                tempFactor = 0.90 + (temp / coldThreshold) * 0.10;
            } else {
                tempFactor = 1.05;
            }
        } else if (temp > hotThreshold) {
            const heatPenalty = (temp - hotThreshold) * 0.01;
            tempFactor = Math.max(0.85, 1.00 - heatPenalty);
        }
        tempFactor = Math.max(0.60, Math.min(1.10, tempFactor));
        mu *= tempFactor;

        // Brake fade factor (v3.4.3 - was missing from simulation)
        let brakeFadeFactor = 1.00;
        const fadeLevel = GameState.brakeFadeLevel || 0;
        if (fadeLevel > 0) {
            // Fade reduces braking effectiveness progressively
            // 0-3: mild (0-15% loss), 4-6: moderate (15-35%), 7-10: severe (35-65%)
            if (fadeLevel <= 3) {
                brakeFadeFactor = 1.00 - (fadeLevel * 0.05);
            } else if (fadeLevel <= 6) {
                brakeFadeFactor = 0.85 - ((fadeLevel - 3) * 0.067);
            } else {
                brakeFadeFactor = 0.65 - ((fadeLevel - 6) * 0.075);
            }
            brakeFadeFactor = Math.max(0.35, brakeFadeFactor);
        }
        mu *= brakeFadeFactor;

        // Tyre compound factor (v3.4.3 - was missing from simulation)
        let compoundFactor = 1.00;
        const compound = GameState.selectedCompound || 'touring';
        const compoundFactors = {
            'economy': 0.88,      // Budget: -12% grip
            'touring': 1.00,      // Standard: baseline
            'performance': 1.06,  // Sport: +6% grip
            'uhp': 1.12,          // Ultra High Performance: +12% grip
            'track': isDry ? 1.25 : 0.85  // Track: +25% dry, -15% wet
        };
        compoundFactor = compoundFactors[compound] || 1.00;
        mu *= compoundFactor;

        // Calculate deceleration with slope (v3.4.3 - was missing from simulation)
        const slopeDeg = GameState.slopeDegrees || 0;
        const slopeRad = (slopeDeg * Math.PI) / 180;

        // Deceleration: a = g * (μ * cos(θ) + sin(θ))
        // Positive slope (uphill) helps braking, negative (downhill) hurts
        const decelerationMs2 = GRAVITY * (mu * Math.cos(slopeRad) + Math.sin(slopeRad));

        // Convert to km/h per second: multiply by 3.6
        const decelerationKmhPerSec = decelerationMs2 * 3.6;

        // Handle case where vehicle cannot stop (gravity > friction on steep downhill)
        if (decelerationMs2 <= 0) {
            // Vehicle is accelerating or not slowing - CANNOT STOP
            // Mark as "cannot stop" scenario
            if (!GameState.cannotStopWarned) {
                GameState.cannotStopWarned = true;
                console.warn('CANNOT STOP: Friction insufficient for slope. Deceleration:', decelerationMs2.toFixed(3));
            }
            // Continue accelerating (negative deceleration = acceleration)
            GameState.speed -= decelerationKmhPerSec * dt; // This adds speed since decel is negative
        } else {
            // Apply deceleration normally
            GameState.speed -= decelerationKmhPerSec * dt;
        }

        // Cap maximum distance to prevent infinite scenarios (10km safety limit)
        const currentBrakingDist = GameState.position - GameState.brakePosition;
        if (currentBrakingDist > 10000) {
            // Force stop at 10km - this is an extreme scenario
            GameState.speed = 0;
            GameState.cannotStop = true;
            completeTest();
            return;
        }

        // Use a small threshold to avoid floating point issues
        if (GameState.speed <= 0.5) {
            GameState.speed = 0;
            completeTest();
            return; // Stop further updates
        }
    }

    // Update position
    if (GameState.speed > 0) {
        const speedMs = GameState.speed / 3.6;
        GameState.position += speedMs * dt;
    }

    // Update HUD
    document.getElementById('speed-display').textContent = Math.round(GameState.speed);
    document.getElementById('hud-distance').textContent = `${Math.round(GameState.position)} m`;

    // Update braking distance in HUD
    const hudBraking = document.getElementById('hud-braking');
    if (hudBraking) {
        if (GameState.isBraking) {
            const brakingDist = GameState.position - GameState.brakePosition;
            hudBraking.textContent = `${brakingDist.toFixed(1)} m`;
        } else {
            hudBraking.textContent = '0 m';
        }
    }
}

function render() {
    if (!GameState.renderer) return;

    GameState.renderer.render({
        position: GameState.position,
        speed: GameState.speed,
        isBraking: GameState.isBraking,
        markers: GameState.markers,
        brakePosition: GameState.brakePosition,
        weatherPreset: GameState.selectedWeather,
        surfaceType: GameState.selectedSurface
    });
}

function completeTest() {
    GameState.testComplete = true;
    GameState.stoppedDistance = GameState.position - GameState.brakePosition;

    const stats = GameState.stats;
    stats.endTime = performance.now();
    stats.totalTime = (stats.endTime - stats.startTime) / 1000;
    stats.totalDistance = GameState.position;
    stats.brakingTime = (stats.endTime - stats.brakeStartTime) / 1000;
    stats.brakingDistance = GameState.stoppedDistance;

    if (stats.timeToTopSpeed > 0) {
        stats.avgAcceleration = stats.peakSpeed / stats.timeToTopSpeed;
    }

    if (stats.brakingTime > 0) {
        stats.avgDeceleration = GameState.brakeSpeed / stats.brakingTime;
    }

    setTimeout(showResults, 500);
}

// =====================================================
// RESULTS
// =====================================================

function buildConfigSummary() {
    const container = document.getElementById('config-summary');
    if (!container) return;

    const treadMm = GAME_CONFIG.treadPresets[GameState.selectedTread]?.value || 8;
    const surfaceData = GAME_CONFIG.surfaces[GameState.selectedSurface] || {};
    const weatherData = GAME_CONFIG.weatherPresets[GameState.selectedWeather] || {};
    const vehicleData = GAME_CONFIG.vehicles[GameState.selectedVehicle] || {};

    // Build configuration items
    const configs = [
        { icon: surfaceData.icon || '🛣️', label: 'Surface', value: surfaceData.label || 'Asphalt' },
        { icon: weatherData.icon || '🌧️', label: 'Weather', value: weatherData.label || 'Rain' },
        { icon: '🏷️', label: 'EU Grade', value: `Grade ${GameState.selectedGrade}`, highlight: GameState.selectedGrade === 'E' ? 'danger' : GameState.selectedGrade === 'A' ? 'good' : '' },
        { icon: '📏', label: 'Tread', value: `${treadMm}mm`, highlight: treadMm <= 1.6 ? 'danger' : treadMm <= 3 ? 'warning' : '' },
        { icon: '📅', label: 'Tyre Age', value: GameState.selectedAge === 0 ? 'New' : `${GameState.selectedAge} years`, highlight: GameState.selectedAge >= 8 ? 'danger' : GameState.selectedAge >= 5 ? 'warning' : '' },
        { icon: '🌡️', label: 'Temperature', value: `${GameState.selectedTemp}°C`, highlight: GameState.selectedTemp < 7 && GameState.selectedTyreType === 'summer' ? 'warning' : '' },
        { icon: vehicleData.icon || '🚗', label: 'Vehicle', value: vehicleData.label || 'Sedan' },
        { icon: GameState.hasABS ? '✓' : '✗', label: 'ABS', value: GameState.hasABS ? 'Enabled' : 'Disabled', highlight: !GameState.hasABS ? 'warning' : '' }
    ];

    // Add tyre type
    const tyreTypeLabels = { 'summer': '☀️ Summer', 'allseason': '🍂 All-Season', 'winter': '❄️ Winter' };
    configs.push({ icon: '', label: 'Tyre Type', value: tyreTypeLabels[GameState.selectedTyreType] || 'Summer' });

    // Add compound if not default
    if (GameState.selectedCompound && GameState.selectedCompound !== 'touring') {
        const compoundLabels = { 'economy': 'Economy', 'touring': 'Touring', 'performance': 'Performance', 'uhp': 'UHP', 'track': 'Track' };
        configs.push({
            icon: '🏁',
            label: 'Compound',
            value: compoundLabels[GameState.selectedCompound] || 'Touring',
            highlight: GameState.selectedCompound === 'track' ? 'warning' : ''
        });
    }

    // Add slope if not flat
    if (GameState.slopeDegrees && GameState.slopeDegrees !== 0) {
        const slopeLabel = GameState.slopeDegrees > 0 ? `+${GameState.slopeDegrees}° Uphill` : `${GameState.slopeDegrees}° Downhill`;
        configs.push({
            icon: GameState.slopeDegrees > 0 ? '⬆️' : '⬇️',
            label: 'Slope',
            value: slopeLabel,
            highlight: GameState.slopeDegrees < -8 ? 'danger' : GameState.slopeDegrees < -5 ? 'warning' : ''
        });
    }

    // Add brake fade if present
    if (GameState.brakeFadeLevel && GameState.brakeFadeLevel > 0) {
        const fadeLabels = ['Cold', 'Cool', 'Warm', 'Warm', 'Hot', 'Hot', 'Very Hot', 'Fading', 'Fading', 'Severe', 'Severe'];
        configs.push({
            icon: '🔥',
            label: 'Brake Fade',
            value: `${fadeLabels[GameState.brakeFadeLevel]} (${GameState.brakeFadeLevel}/10)`,
            highlight: GameState.brakeFadeLevel >= 7 ? 'danger' : GameState.brakeFadeLevel >= 4 ? 'warning' : ''
        });
    }

    // Add trailer if present
    if (GameState.trailerType && GameState.trailerType !== 'none') {
        configs.push({
            icon: '🚚',
            label: 'Trailer',
            value: `${GameState.trailerType === 'braked' ? 'Braked' : 'Unbraked'} (${GameState.trailerWeight}kg)`,
            highlight: GameState.trailerType === 'unbraked' ? 'warning' : ''
        });
    }

    // Build HTML
    let html = '';
    configs.forEach(config => {
        const highlightClass = config.highlight ? `config-${config.highlight}` : '';
        html += `
            <div class="config-item ${highlightClass}">
                <span class="config-icon">${config.icon}</span>
                <span class="config-label">${config.label}</span>
                <span class="config-value">${config.value}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

function showResults() {
    const panel = document.getElementById('results-panel');
    panel.classList.remove('hidden');

    document.getElementById('result-grade').textContent = GameState.selectedGrade;

    // Handle extreme scenarios where vehicle couldn't stop normally
    const distanceEl = document.getElementById('result-distance');
    if (GameState.cannotStop) {
        distanceEl.textContent = `${GameState.stoppedDistance.toFixed(0)} m+ (COULD NOT STOP!)`;
        distanceEl.style.color = '#ef4444';  // Red warning
    } else if (GameState.stoppedDistance > 1000) {
        // Extreme but stoppable distance
        distanceEl.textContent = `${GameState.stoppedDistance.toFixed(0)} m (EXTREME!)`;
        distanceEl.style.color = '#f59e0b';  // Orange warning
    } else {
        distanceEl.textContent = `${GameState.stoppedDistance.toFixed(1)} m`;
        distanceEl.style.color = '';  // Reset to default
    }
    document.getElementById('result-speed').textContent = `${Math.round(GameState.brakeSpeed)} km/h`;

    buildConfigSummary();  // Show selected variables
    buildDetailedStats();
    buildFactorBreakdown();
    buildComparison();
    generateInsight();
    drawSpeedGraph();
    updateRangeDisplay();

    // Populate the "Why this result?" drawer
    const treadMm = GAME_CONFIG.treadPresets[GameState.selectedTread].value;
    updateWhyDrawer(
        GameState.brakeSpeed,
        GameState.selectedGrade,
        treadMm,
        GameState.selectedWeather,
        GameState.selectedAge,
        GameState.stoppedDistance
    );
}

function updateRangeDisplay() {
    const treadMm = GAME_CONFIG.treadPresets[GameState.selectedTread].value;
    const speed = GameState.brakeSpeed;
    const weather = GameState.selectedWeather;
    const surface = GameState.selectedSurface;

    // Calculate best and worst possible distances at this speed (keeping surface constant for fair comparison)
    const bestDist = calculateBrakingDistance(speed, 'A', 8, weather, 0, 'winter', 32, 205, surface, 'hatchback', 20, true, 0, 'headwind', 'none', 0, 1200, 0, 0, 'touring', 'A');
    const worstDist = calculateBrakingDistance(speed, 'E', 1.6, weather, 10, 'summer', 20, 295, surface, 'truck', -5, false, 100, 'tailwind', 'unbraked', 750, 2500, 0, 0, 'touring', 'E');
    const yourDist = GameState.stoppedDistance;

    // Update display values
    const bestValueEl = document.getElementById('range-best-value');
    const worstValueEl = document.getElementById('range-worst-value');
    const youPositionEl = document.getElementById('range-you-position');
    const rangeSummaryEl = document.getElementById('range-summary');

    if (bestValueEl) bestValueEl.textContent = `${bestDist.toFixed(1)}m`;
    if (worstValueEl) worstValueEl.textContent = `${worstDist.toFixed(1)}m`;

    // Calculate position percentage (0% = best, 100% = worst)
    const range = worstDist - bestDist;
    let percentage = ((yourDist - bestDist) / range) * 100;
    percentage = Math.max(0, Math.min(100, percentage));

    if (youPositionEl) {
        youPositionEl.style.left = `${percentage}%`;
    }

    // Generate summary text
    if (rangeSummaryEl) {
        const diffFromBest = yourDist - bestDist;
        const diffFromWorst = worstDist - yourDist;

        if (percentage < 10) {
            rangeSummaryEl.innerHTML = `<strong>Excellent!</strong> Your tyres are performing near the best possible.`;
        } else if (percentage < 30) {
            rangeSummaryEl.innerHTML = `<strong>Good performance.</strong> You're ${diffFromBest.toFixed(1)}m behind optimal.`;
        } else if (percentage < 60) {
            rangeSummaryEl.innerHTML = `<strong>Average performance.</strong> Upgrading tyres could save ${diffFromBest.toFixed(1)}m.`;
        } else if (percentage < 80) {
            rangeSummaryEl.innerHTML = `<strong>Below average.</strong> Consider checking tyre condition - ${diffFromBest.toFixed(1)}m extra stopping needed.`;
        } else {
            rangeSummaryEl.innerHTML = `<strong>Poor performance.</strong> Your tyres need attention - you needed ${diffFromBest.toFixed(1)}m more than optimal!`;
        }
    }
}

function buildDetailedStats() {
    const stats = GameState.stats;
    const detailsContainer = document.getElementById('detailed-stats');
    if (!detailsContainer) return;

    const weatherLabel = GAME_CONFIG.weatherPresets[GameState.selectedWeather]?.label || 'wet';

    detailsContainer.innerHTML = `
        <div class="stats-narrative">
            <p class="narrative-text">
                You accelerated from <strong>0</strong> to <strong>${Math.round(stats.peakSpeed)} km/h</strong>
                at an average rate of <strong>${stats.avgAcceleration.toFixed(1)} km/h/s</strong>,
                reaching top speed after <strong>${stats.distanceToTopSpeed.toFixed(1)}m</strong>
                in <strong>${stats.timeToTopSpeed.toFixed(2)}s</strong>.
            </p>
            <p class="narrative-text">
                You then braked on the <strong>${weatherLabel}</strong> road and stopped after
                <strong>${GameState.stoppedDistance.toFixed(1)}m</strong>
                in <strong>${stats.brakingTime.toFixed(2)}s</strong>, decelerating at
                <strong>${stats.avgDeceleration.toFixed(1)} km/h/s</strong>.
            </p>
        </div>

        <div class="stats-grid">
            <div class="stat-card acceleration">
                <div class="stat-icon">🚀</div>
                <div class="stat-content">
                    <span class="stat-title">Acceleration Phase</span>
                    <div class="stat-details">
                        <div class="stat-row">
                            <span>Peak Speed</span>
                            <strong>${Math.round(stats.peakSpeed)} km/h</strong>
                        </div>
                        <div class="stat-row">
                            <span>Time to Peak</span>
                            <strong>${stats.timeToTopSpeed.toFixed(2)}s</strong>
                        </div>
                        <div class="stat-row">
                            <span>Distance</span>
                            <strong>${stats.accelerationDistance.toFixed(1)}m</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div class="stat-card braking">
                <div class="stat-icon">🛑</div>
                <div class="stat-content">
                    <span class="stat-title">Braking Phase</span>
                    <div class="stat-details">
                        <div class="stat-row">
                            <span>Speed at Brake</span>
                            <strong>${Math.round(GameState.brakeSpeed)} km/h</strong>
                        </div>
                        <div class="stat-row">
                            <span>Stop Distance</span>
                            <strong>${GameState.stoppedDistance.toFixed(1)}m</strong>
                        </div>
                        <div class="stat-row">
                            <span>Time to Stop</span>
                            <strong>${stats.brakingTime.toFixed(2)}s</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div class="stat-card total">
                <div class="stat-icon">📊</div>
                <div class="stat-content">
                    <span class="stat-title">Your Configuration</span>
                    <div class="stat-details">
                        <div class="stat-row">
                            <span>EU Grade</span>
                            <strong>${GameState.selectedGrade}</strong>
                        </div>
                        <div class="stat-row">
                            <span>Tread Depth</span>
                            <strong>${GAME_CONFIG.treadPresets[GameState.selectedTread].value}mm</strong>
                        </div>
                        <div class="stat-row">
                            <span>Tyre Age</span>
                            <strong>${GameState.selectedAge === 0 ? 'New' : GameState.selectedAge + ' yrs'}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function buildFactorBreakdown() {
    const container = document.getElementById('factor-breakdown');
    if (!container || !GameState.physicsResult) return;

    const factors = GameState.physicsResult.factors;
    const importantFactors = ['grade', 'tread', 'weather', 'age'];

    let html = '<h3>Physics Factors</h3><div class="factors-grid">';

    importantFactors.forEach(key => {
        const factor = factors[key];
        if (!factor) return;

        const impact = factor.value < 0.8 ? 'severe' : factor.value < 0.95 ? 'moderate' : 'good';
        const impactColor = impact === 'severe' ? '#ef4444' : impact === 'moderate' ? '#f59e0b' : '#22c55e';

        html += `
            <div class="factor-card">
                <div class="factor-header">
                    <span class="factor-name">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
                    <span class="factor-value" style="color: ${impactColor}">${(factor.value * 100).toFixed(0)}%</span>
                </div>
                <div class="factor-bar">
                    <div class="factor-fill" style="width: ${factor.value * 100}%; background: ${impactColor}"></div>
                </div>
            </div>
        `;
    });

    html += '</div>';

    // Add effective friction
    html += `
        <div class="mu-display">
            <span>Effective Friction (μ):</span>
            <strong>${GameState.physicsResult.μ_effective}</strong>
        </div>
    `;

    container.innerHTML = html;
}

function drawSpeedGraph() {
    const canvas = document.getElementById('speed-graph');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const stats = GameState.stats;
    const history = stats.speedHistory;

    if (history.length < 2) return;

    canvas.width = canvas.parentElement.clientWidth || 300;
    canvas.height = 100;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 10;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    const startTime = history[0].time;
    const endTime = history[history.length - 1].time;
    const timeRange = endTime - startTime;
    const maxSpeed = stats.peakSpeed || 100;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (i / 4) * (height - 2 * padding);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    if (stats.brakeStartTime > startTime) {
        const brakeX = padding + ((stats.brakeStartTime - startTime) / timeRange) * (width - 2 * padding);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(brakeX, padding);
        ctx.lineTo(brakeX, height - padding);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ef4444';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('BRAKE', brakeX, height - 2);
    }

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;

    history.forEach((point, i) => {
        const x = padding + ((point.time - startTime) / timeRange) * (width - 2 * padding);
        const y = height - padding - (point.speed / maxSpeed) * (height - 2 * padding);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(maxSpeed)} km/h`, padding + 2, padding + 10);
}

function buildComparison() {
    const container = document.getElementById('grade-comparison');
    const grades = ['A', 'B', 'C', 'D', 'E'];

    // Filter out Infinity values for max/min calculation
    const finiteDistances = GameState.markers.filter(m => isFinite(m.distance)).map(m => m.distance);
    const maxDistance = finiteDistances.length > 0 ? Math.max(...finiteDistances) : 1000;
    const minDistance = finiteDistances.length > 0 ? Math.min(...finiteDistances) : 0;

    let html = '';

    grades.forEach(grade => {
        const marker = GameState.markers.find(m => m.grade === grade);
        if (!marker) return;

        const isCurrent = grade === GameState.selectedGrade;
        const cannotStop = !isFinite(marker.distance);

        // Handle cannot-stop scenarios
        if (cannotStop) {
            html += `
                <div class="comparison-row ${isCurrent ? 'current' : ''} cannot-stop">
                    <div class="comparison-grade grade-${grade}">${grade}</div>
                    <div class="comparison-bar-container">
                        <div class="comparison-bar cannot-stop-bar" style="width: 100%; background: #ef4444;"></div>
                    </div>
                    <div class="comparison-distance" style="color: #ef4444;">CANNOT STOP</div>
                    <div class="comparison-diff" style="color: #ef4444;">∞</div>
                </div>
            `;
        } else {
            const percentage = (marker.distance / maxDistance) * 100;
            const diff = marker.distance - minDistance;

            // Show extreme warning for very long distances
            const isExtreme = marker.distance > 500;
            const distanceClass = isExtreme ? 'extreme-distance' : '';
            const distanceText = marker.distance > 1000
                ? `${(marker.distance / 1000).toFixed(1)}km`
                : `${marker.distance.toFixed(1)}m`;

            html += `
                <div class="comparison-row ${isCurrent ? 'current' : ''} ${distanceClass}">
                    <div class="comparison-grade grade-${grade}">${grade}</div>
                    <div class="comparison-bar-container">
                        <div class="comparison-bar" style="width: ${percentage}%; background: ${marker.color};"></div>
                    </div>
                    <div class="comparison-distance">${distanceText}</div>
                    <div class="comparison-diff">${diff > 0 ? `+${diff.toFixed(1)}m` : '—'}</div>
                </div>
            `;
        }
    });

    container.innerHTML = html;
}

function generateInsight() {
    const box = document.getElementById('insight-box');
    const grade = GameState.selectedGrade;
    const speed = Math.round(GameState.brakeSpeed);
    const yourDist = GameState.stoppedDistance;
    const treadMm = GAME_CONFIG.treadPresets[GameState.selectedTread].value;
    const surfaceLabel = GAME_CONFIG.surfaces[GameState.selectedSurface]?.label || 'road';
    const weatherLabel = GAME_CONFIG.weatherPresets[GameState.selectedWeather]?.label || 'wet';

    let insight = '';

    // Check for extreme/cannot-stop scenarios FIRST
    if (GameState.cannotStop || yourDist > 5000) {
        // EXTREME DANGER scenario
        insight = `
            <div class="extreme-warning">
                <h4 style="color: #ef4444; margin: 0 0 10px 0;">⚠️ EXTREME DANGER - VEHICLE COULD NOT STOP SAFELY</h4>
                <p style="color: #ef4444;">At <strong>${speed} km/h</strong> on <strong>${surfaceLabel}</strong> with your configuration,
                the vehicle ${GameState.cannotStop ? 'CANNOT STOP' : `needs over ${(yourDist/1000).toFixed(1)}km`} to come to rest.</p>
            </div>
        `;

        // Explain why
        let extremeFactors = [];
        if (GameState.selectedSurface === 'SNOW' || GameState.selectedSurface === 'ICE') {
            extremeFactors.push(`<strong>${surfaceLabel}</strong> has extremely low friction`);
        }
        if ((GameState.slopeDegrees || 0) < -5) {
            extremeFactors.push(`<strong>${Math.abs(GameState.slopeDegrees)}° downhill</strong> - gravity exceeds braking force`);
        }
        if ((GameState.brakeFadeLevel || 0) > 5) {
            extremeFactors.push(`<strong>Severe brake fade</strong> - brakes overheated and ineffective`);
        }
        if (GameState.selectedCompound === 'track') {
            extremeFactors.push(`<strong>Track tyres</strong> are designed for dry circuits, not ${surfaceLabel}`);
        }
        if (GameState.selectedAge >= 8) {
            extremeFactors.push(`<strong>${GameState.selectedAge}-year-old rubber</strong> has lost most grip`);
        }
        if (treadMm <= 1.6) {
            extremeFactors.push(`<strong>${treadMm}mm tread</strong> - no water evacuation capability`);
        }
        if (GameState.selectedTemp < 0 && GameState.selectedTyreType === 'summer') {
            extremeFactors.push(`<strong>Summer tyres at ${GameState.selectedTemp}°C</strong> - rubber is rock hard`);
        }

        if (extremeFactors.length > 0) {
            insight += `<p><strong>Critical factors:</strong></p><ul style="color: #f59e0b;">`;
            extremeFactors.forEach(f => {
                insight += `<li>${f}</li>`;
            });
            insight += `</ul>`;
        }

        insight += `<p class="warning" style="margin-top: 15px;">This combination of factors creates a
            <strong>life-threatening scenario</strong>. In real life, this would result in loss of control
            and a collision.</p>`;

    } else if (yourDist > 500) {
        // Very long but stoppable
        const gradeADist = GameState.markers.find(m => m.grade === 'A')?.distance || yourDist;
        const diff = yourDist - gradeADist;

        insight = `
            <div class="extreme-warning" style="border-color: #f59e0b; background: rgba(245, 158, 11, 0.1);">
                <h4 style="color: #f59e0b; margin: 0 0 10px 0;">⚠️ EXTREME STOPPING DISTANCE</h4>
                <p>At <strong>${speed} km/h</strong> on <strong>${surfaceLabel}</strong>, your configuration needed
                <strong>${yourDist > 1000 ? (yourDist/1000).toFixed(1) + 'km' : yourDist.toFixed(0) + 'm'}</strong> to stop.</p>
            </div>
        `;

        let dangerFactors = [];
        if (GameState.selectedSurface === 'SNOW' || GameState.selectedSurface === 'ICE') {
            dangerFactors.push(`${surfaceLabel} surface`);
        }
        if ((GameState.slopeDegrees || 0) < -3) {
            dangerFactors.push(`${Math.abs(GameState.slopeDegrees)}° downhill slope`);
        }
        if ((GameState.brakeFadeLevel || 0) > 3) {
            dangerFactors.push(`brake fade level ${GameState.brakeFadeLevel}`);
        }
        if (GameState.selectedAge >= 6) {
            dangerFactors.push(`${GameState.selectedAge}-year-old tyres`);
        }
        if (treadMm < 3) {
            dangerFactors.push(`${treadMm}mm tread depth`);
        }

        if (dangerFactors.length > 0) {
            insight += `<p>Contributing factors: ${dangerFactors.join(', ')}.</p>`;
        }

        if (isFinite(gradeADist) && diff > 0) {
            insight += `<p>With optimal Grade A tyres in perfect condition, you would stop in
                <strong>${gradeADist.toFixed(0)}m</strong> - saving <strong>${diff.toFixed(0)}m</strong>.</p>`;
        }

    } else {
        // Normal scenario
        const gradeADist = GameState.markers.find(m => m.grade === 'A')?.distance || 0;
        const gradeEDist = GameState.markers.find(m => m.grade === 'E')?.distance || 0;
        const diff = yourDist - gradeADist;
        const totalDiff = gradeEDist - gradeADist;

        if (grade === 'A' && treadMm >= 7 && GameState.selectedAge <= 1) {
            insight = `<p>Excellent! You stopped in the <strong>shortest possible distance</strong> for ${speed} km/h on a ${weatherLabel} ${surfaceLabel}.
                Your tyres are in optimal condition. The difference between best and worst tyres at this speed is
                <strong>${totalDiff.toFixed(1)} meters</strong> - about ${Math.round(totalDiff / 4.5)} car lengths!</p>`;
        } else {
            let factors = [];
            if (grade !== 'A') factors.push(`Grade ${grade} (not A)`);
            if (treadMm < 4) factors.push(`worn tread (${treadMm}mm)`);
            if (GameState.selectedAge > 3) factors.push(`${GameState.selectedAge}-year-old tyres`);

            insight = `<p>At ${speed} km/h on a ${weatherLabel} ${surfaceLabel}, your configuration needed
                <strong>${diff.toFixed(1)} meters more</strong> to stop compared to optimal tyres.
                That's about <strong>${Math.round(diff / 4.5)} car lengths</strong> extra -
                the difference between stopping safely and a collision.</p>`;

            if (factors.length > 0) {
                insight += `<p>Contributing factors: ${factors.join(', ')}.</p>`;
            }

            if (treadMm < 3) {
                insight += `<p class="warning">Your tread depth (${treadMm}mm) is critically low!
                    Water evacuation is severely compromised.</p>`;
            }
        }
    }

    // Add physics insight if available
    if (GameState.physicsResult) {
        const warnings = GameState.physicsResult.safety?.warnings || [];
        if (warnings.length > 0) {
            insight += '<div class="physics-warnings">';
            warnings.forEach(w => {
                insight += `<p class="warning">${w.icon} ${w.message}</p>`;
            });
            insight += '</div>';
        }
    }

    box.innerHTML = insight;
}

// =====================================================
// SHARE FUNCTIONALITY
// =====================================================

function initShareFeature() {
    const shareBtn = document.getElementById('share-btn');
    const shareModal = document.getElementById('share-modal');
    const shareClose = document.getElementById('share-close');
    const copyBtn = document.getElementById('copy-link-btn');
    const twitterBtn = document.getElementById('share-twitter');
    const facebookBtn = document.getElementById('share-facebook');
    const linkedinBtn = document.getElementById('share-linkedin');

    if (shareBtn) {
        shareBtn.addEventListener('click', openShareModal);
    }

    if (shareClose) {
        shareClose.addEventListener('click', closeShareModal);
    }

    if (shareModal) {
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) {
                closeShareModal();
            }
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', copyShareLink);
    }

    if (twitterBtn) {
        twitterBtn.addEventListener('click', shareToTwitter);
    }

    if (facebookBtn) {
        facebookBtn.addEventListener('click', shareToFacebook);
    }

    if (linkedinBtn) {
        linkedinBtn.addEventListener('click', shareToLinkedIn);
    }
}

function generateShareData() {
    const grade = GameState.selectedGrade;
    const speed = Math.round(GameState.brakeSpeed);
    const distance = GameState.stoppedDistance.toFixed(1);
    const treadMm = GAME_CONFIG.treadPresets[GameState.selectedTread].value;
    const weather = GAME_CONFIG.weatherPresets[GameState.selectedWeather]?.label || 'wet';
    const surface = GAME_CONFIG.surfaces[GameState.selectedSurface]?.label || 'asphalt';

    // Create a summary message
    const summary = `I stopped in ${distance}m from ${speed} km/h with Grade ${grade} tyres on ${weather} ${surface}!`;

    // Create a shareable text
    const shareText = `Ultimate Tyre Simulator: ${summary} Test your tyre knowledge at`;

    // Generate URL parameters for sharing (base64 encoded config)
    const config = {
        g: grade,
        s: speed,
        d: distance,
        t: treadMm,
        w: GameState.selectedWeather,
        a: GameState.selectedAge,
        sf: GameState.selectedSurface
    };

    const configParam = btoa(JSON.stringify(config));

    return {
        summary,
        shareText,
        configParam,
        distance,
        speed,
        grade
    };
}

function openShareModal() {
    const shareModal = document.getElementById('share-modal');
    const shareSummary = document.getElementById('share-summary');
    const shareLink = document.getElementById('share-link');
    const copiedMsg = document.getElementById('share-copied');

    const data = generateShareData();

    // Set summary text
    if (shareSummary) {
        shareSummary.innerHTML = `
            <strong>Your Result:</strong><br>
            Grade ${data.grade} tyres at ${data.speed} km/h<br>
            Braking distance: <strong>${data.distance}m</strong>
        `;
    }

    // Generate the share link (just the current page URL for now since this is local)
    const baseUrl = window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?r=${data.configParam}`;

    if (shareLink) {
        shareLink.value = shareUrl;
    }

    // Hide copied message
    if (copiedMsg) {
        copiedMsg.classList.add('hidden');
    }

    // Show modal
    if (shareModal) {
        shareModal.classList.remove('hidden');
    }
}

function closeShareModal() {
    const shareModal = document.getElementById('share-modal');
    if (shareModal) {
        shareModal.classList.add('hidden');
    }
}

function copyShareLink() {
    const shareLink = document.getElementById('share-link');
    const copyBtn = document.getElementById('copy-link-btn');
    const copiedMsg = document.getElementById('share-copied');

    if (shareLink) {
        shareLink.select();
        shareLink.setSelectionRange(0, 99999); // For mobile

        try {
            navigator.clipboard.writeText(shareLink.value).then(() => {
                // Show success feedback
                if (copyBtn) {
                    copyBtn.textContent = 'Copied!';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                }

                if (copiedMsg) {
                    copiedMsg.classList.remove('hidden');
                    setTimeout(() => {
                        copiedMsg.classList.add('hidden');
                    }, 3000);
                }
            });
        } catch (err) {
            // Fallback for older browsers
            document.execCommand('copy');
            if (copyBtn) {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
            }
        }
    }
}

function shareToTwitter() {
    const data = generateShareData();
    const shareLink = document.getElementById('share-link');
    const url = shareLink ? shareLink.value : window.location.href;

    const tweetText = encodeURIComponent(`${data.shareText}`);
    const tweetUrl = encodeURIComponent(url);

    window.open(
        `https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}`,
        '_blank',
        'width=550,height=420'
    );
}

function shareToFacebook() {
    const shareLink = document.getElementById('share-link');
    const url = shareLink ? shareLink.value : window.location.href;
    const fbUrl = encodeURIComponent(url);

    window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${fbUrl}`,
        '_blank',
        'width=550,height=420'
    );
}

function shareToLinkedIn() {
    const data = generateShareData();
    const shareLink = document.getElementById('share-link');
    const url = shareLink ? shareLink.value : window.location.href;

    const linkedInUrl = encodeURIComponent(url);
    const title = encodeURIComponent('Ultimate Tyre Simulator Results');
    const summary = encodeURIComponent(data.summary);

    window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${linkedInUrl}`,
        '_blank',
        'width=550,height=420'
    );
}

// =====================================================
// INIT ON LOAD
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    init();
    initShareFeature();

    // Set dynamic copyright year
    const copyrightEl = document.getElementById('footer-copyright');
    if (copyrightEl) {
        copyrightEl.innerHTML = `© ${new Date().getFullYear()} Tyre Dispatch NZ. All rights reserved.`;
    }
});
