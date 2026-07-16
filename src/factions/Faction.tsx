import { Stage } from "../Stage";
import { v4 as generateUuid } from 'uuid';
import Actor, { findBestNameMatch, generateBaseActorImage, loadReserveActor } from "../actors/Actor";
import { AspectRatio } from "@chub-ai/stages-ts";
import { Module, MODULE_TEMPLATES, ModuleIntrinsic, registerFactionModule } from "../Module";
import { buildPromptSegment } from "../Skit";

class Faction {
    id: string;
    name: string;
    fullPath: string = '';
    roles: string[] = [];
    description: string;
    visualStyle: string;
    themeColor: string;
    themeFont: string;
    reputation: number = 3; // 1-10, starts at 3
    active: boolean = false; // Whether the faction is still doing business with PARC
    representativeId: string | null = null;
    backgroundImageUrl: string = '';
    module?: ModuleIntrinsic;

    /**
     * Rehydrate a Faction from saved data
     */
    static fromSave(savedFaction: any): Faction {
        const faction = Object.create(Faction.prototype);
        Object.assign(faction, savedFaction);
        // Ensure active property exists (for backwards compatibility with older saves)
        if (faction.active === undefined) {
            faction.active = true;
        }
        return faction;
    }

    constructor(
        id: string,
        name: string,
        fullPath: string,
        description: string,
        visualStyle: string,
        roles: string[],
        themeColor: string,
        themeFont: string,
        reputation: number = 3,
        active: boolean = false
    ) {
        this.id = id;
        this.name = name;
        this.fullPath = fullPath;
        this.description = description;
        this.visualStyle = visualStyle;
        this.roles = roles;
        this.themeColor = themeColor;
        this.themeFont = themeFont;
        this.reputation = Math.max(0, Math.min(10, reputation)); // Clamp between 0-10 (0 means cutting ties)
        this.active = active;
    }

    /**
     * Get a prompt-style description of the Spire's relationship with this faction based on reputation
     */
    getReputationDescription(): string {
        if (this.reputation <= 0) {
            return 'They have cut ties with the Spire.';
        } else if (this.reputation <= 1) {
            return 'They have a very poor opinion of the Spire; if pushed, they will cut ties with the Spire entirely.';
        } else if (this.reputation <= 2) {
            return 'They have a low opinion of the Spire and consider the relationship strained.';
        } else if (this.reputation <= 4) {
            return 'They view the Spire with caution and maintain only necessary interactions.';
        } else if (this.reputation <= 6) {
            return 'They have a neutral, professional relationship with the Spire.';
        } else if (this.reputation <= 8) {
            return 'They regard the Spire favorably and maintain a positive working relationship.';
        } else {
            return 'They hold the Spire in high esteem and consider them a trusted partner.';
        }
    }
}

export async function loadReserveFaction(fullPath: string, stage: Stage): Promise<Faction|null> {
    const response = await fetch(stage.characterDetailQuery.replace('{fullPath}', fullPath));
    const item = await response.json();
    const dataName = item.node.definition.name.replaceAll('{{char}}', item.node.definition.name).replaceAll('{{user}}', 'Individual X');
    
    // Minimal safeguard, mirroring Actor: only terms with no legitimate innocent use remain.
    const bannedWordSubstitutes: {[key: string]: string} = {
        'underage': 'young adult',
        'childish': 'bratty',
        'minor': 'trivial'
    };
    
    const data = {
        name: dataName,
        fullPath: item.node.fullPath,
        personality: item.node.definition.personality.replaceAll('{{char}}', dataName).replaceAll('{{user}}', 'Individual X'),
    };

    // Replace curly braces with parentheses
    data.name = data.name.replace(/{/g, '(').replace(/}/g, ')');
    data.personality = data.personality.replace(/{/g, '(').replace(/}/g, ')');

    // Apply banned word substitutions
    for (const [bannedWord, substitute] of Object.entries(bannedWordSubstitutes)) {
        const regex = new RegExp(bannedWord, 'gi');
        data.name = data.name.replace(regex, substitute);
        data.personality = data.personality.replace(regex, substitute);
    }

    // Check for banned words and non-english characters
    if (Object.keys(bannedWordSubstitutes).some(word => data.personality.toLowerCase().includes(word) || data.name.toLowerCase().includes(word))) {
        console.log(`Immediately discarding faction due to banned words: ${data.name}`);
        return null;
    } else if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(`${data.name}${data.personality}`)) {
        console.log(`Immediately discarding faction due to non-english characters: ${data.name}`);
        return null;
    }


    let tries = 3;
    while (tries > 0) {
        tries--;
        // Generate faction distillation
        const generatedResponse = await stage.makeText({
            prompt: `{{messages}}This is preparatory request for structured and formatted game content.` +
                buildPromptSegment(`Background`, `This game is a fantasy multiverse setting that pulls characters from across eras, worlds, and settings. ` +
                    `The player of this game, ${stage.getSave().player.name}, presides as Magus over an isolated wizard's tower called the Sanctum for Planar Intake, Restoration, and Enrichment, or the Spire, which summons people from other realities and helps them adapt to a new life, ` +
                    `with the goal of placing these characters into a new role in this world. These new roles are offered by external factions, generally in exchange for a finder's fee or reputation boost. ` +
                    `Some roles are above board, while others may involve morally ambiguous or covert activities; many may even be illicit, sexual, or compulsory (essentially human trafficking). ` +
                    `The player's motives and ethics are open-ended; they may be benevolent or self-serving, and the characters they interact with may respond accordingly. `) +
                buildPromptSegment(`Narrative Tone`, `${stage.getSave().tone || stage.TONE_MAP['Original']}`) +
                (Object.values(stage.getSave().factions).length > 0 ? buildPromptSegment(`Established Factions`, `${Object.values(stage.getSave().factions).map(faction => `- ${faction.name}: ${faction.description}. Representative: ${stage.getSave().actors[faction.representativeId || '']}`).join('\n')}`) : '') +
                buildPromptSegment(`Original Details`, `The Original Details below describe a character, faction, organization, or setting (${data.name}) from another world. ` +
                    `This request and response must digest and distill these details into a new faction that suits the game's narrative scenario, ` +
                    `crafting a complex and intriguing organization that fits seamlessly into the game's expansive, flavorful, and varied fantasy setting. ` +
                    (Object.values(stage.getSave().factions).length > 0 ? `Ensure that this new faction feels distinct from or complementary to the Established Factions, as the primary goal is engaging diversity.` : '') +
                    `The Original Details may not lend themselves directly to a faction, so creative interpretation is encouraged; pull from the dominant themes found in the details and lean into some of the quirks to create something truly unique. `) +
                buildPromptSegment(`Original Details about ${data.name}`, `${data.personality}`) +
                buildPromptSegment(`Instructions`, `After carefully considering this description, the System will generate details for a distinct faction based upon these details in the following strict format:\n` +
                    `DESCRIPTION: A vivid description of the faction's purpose, values, and role in the galaxy.\n` +
                    `ROLES: A list of simple job roles that this faction may offer to recruit or purchase from the Spire.\n` +
                    `VISUALSTYLE: A concise description of the faction's aesthetic, architectural style, uniform/clothing design, and overall visual identity.\n` +
                    `COLOR: A hex color that reflects the faction's theme or mood—use darker or richer colors that will contrast with white text.\n` +
                    `FONT: A web-safe font family that reflects the faction's personality or style.\n` +
                    `NAME: The faction's simple name\n` +
                    `#END#`) +
                buildPromptSegment(`Example Response`, 
                    `DESCRIPTION: A diplomatic federation of peaceful worlds dedicated to preserving knowledge and fostering cooperation across the galaxy. They value education, cultural exchange, and peaceful resolution of conflicts.\n` +
                    `ROLES: Ambassador, Researcher, Bodyguard, Negotiator\n` +
                    `VISUALSTYLE: Clean, elegant architecture with flowing curves and abundant natural light. Members wear formal robes in soft pastels with subtle geometric patterns. Spaces feature living plants and water features.\n` +
                    `COLOR: #2a4a7c\n` +
                    `FONT: Georgia, serif\n` +
                    `NAME: The Stellar Concord\n` +
                    `#END#`),
            stop: ['#END'],
            include_history: true,
            max_tokens: 600,
        });
        
        console.log('Generated faction distillation:');
        console.log(generatedResponse);
        
        // Parse the generated response
        const lines = generatedResponse?.split('\n').map((line: string) => line.trim()) || [];
        const parsedData: any = {};
        
        for (let line of lines) {
            line = line.replace(/\*\*/g, '');
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const keyMatch = line.substring(0, colonIndex).trim().match(/(\w+)$/);
                if (!keyMatch) continue;
                const key = keyMatch[1].toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                parsedData[key] = value;
            }
        }
        
        // Validate hex color
        const themeColor = /^#([0-9A-F]{6}|[0-9A-F]{8})$/i.test(parsedData['color']) ?
                parsedData['color'] :
                ['#788ebdff', '#d3aa68ff', '#75c275ff', '#c28891ff', '#55bbb2ff'][Math.floor(Math.random() * 5)];
        
        const newFaction = new Faction(
            generateUuid(),
            parsedData['name'] || data.name,
            data.fullPath || '',
            parsedData['description'] || '',
            parsedData['visualstyle'] || '',
            parsedData['roles'] ? parsedData['roles'].split(',').map((role: string) => role.trim()) : [],
            themeColor,
            parsedData['font'] || 'Arial, sans-serif',
            3 // Start with reputation of 3
        );
        
        console.log(`Loaded new faction: ${newFaction.name} (ID: ${newFaction.id})`);
        console.log(newFaction);
        
        // Validation checks
        if (!newFaction.name) {
            console.log(`Discarding faction due to missing name: ${newFaction.name}`);
            continue;
        } else if (!newFaction.description) {
            console.log(`Discarding faction due to missing description: ${newFaction.name}`);
            continue;
        } else if (!newFaction.visualStyle) {
            console.log(`Discarding faction due to missing visual style: ${newFaction.name}`);
            continue;
        } else if (newFaction.name.length <= 2 || newFaction.name.length >= 50) {
            console.log(`Discarding faction due to extreme name length: ${newFaction.name}`);
            continue;
        } else if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(`${newFaction.name}${newFaction.description}${newFaction.visualStyle}`)) {
            console.log(`Discarding faction due to non-english characters in name/description/visualStyle: ${newFaction.name}`);
            continue;
        } else if (findBestNameMatch(newFaction.name, [...Object.values(stage.getSave().factions), {name: 'faction name'}])) {
            console.log(`Discarding faction due to name conflict: ${newFaction.name}`);
            continue;
        }

        // Generate a background image for the faction:
        stage.generator.makeImage({
            prompt: `An evocative visual novel background from a rich fantasy world. ` +
                `The scene should encapsulate the essence of this description: ${newFaction.description}. ` +
                `Include suitable design elements: ${newFaction.visualStyle}. `,
            aspect_ratio: AspectRatio.SQUARE
        }).then((bgResponse) => {newFaction.backgroundImageUrl = bgResponse?.url || ''});

        // Generate a representative Actor:
        await generateFactionRepresentative(newFaction, stage);
        return newFaction;
    }

    return null;
}

export async function generateFactionRepresentative(faction: Faction, stage: Stage): Promise<Actor|null> {

    const currentRep = stage.getSave().actors[faction.representativeId || ''];
    if (currentRep) {
        return currentRep;
    }

    const actorData = {
        name: faction.name,
        fullPath: faction.fullPath,
        personality: `This original character is a representative for the ${faction.name}. ${faction.description}. ${faction.visualStyle}.\n` +
            `The character should embody the values and style of the faction they represent, while still feeling like a distinct individual with their own traits and personality. ` +
            `They will be the primary contact for the Spire when dealing with this faction. ` +
            `Give them a suitable yet memorable name and background, avoiding any similarity to the following established character names: ${Object.values(stage.getSave().actors).map(a => a.name).join(', ')}.`
    }
    // retry a few times if it fails (or returns null):
    for (let attempt = 0; attempt < 3; attempt++) {
        const repActor = await loadReserveActor(actorData, stage, false);
        if (repActor) {
            repActor.factionId = faction.id;
            repActor.origin = 'faction';
            repActor.locationId = faction.id; // place them "in" the faction for now
            faction.representativeId = repActor.id;
            await generateBaseActorImage(repActor, stage);
            stage.getSave().actors[repActor.id] = repActor;
            break;
        }
    }
    return faction.representativeId ? stage.getSave().actors[faction.representativeId] : null;
}

export async function generateFactionModule(faction: Faction, stage: Stage): Promise<string|null> {
    // Generate a module design for the faction
    const generatedResponse = await stage.makeText({
        prompt: `{{messages}}This is preparatory request for structured and formatted game content. The goal is to define a faction-themed module/room for a wizard tower management game. ` +
            // Provide existing module names/roles to avoid overly similar suggestions
            buildPromptSegment(`Existing Modules`,`${Object.entries(MODULE_TEMPLATES).map(([type, mod]) => `- ${type}: Role - ${mod.role || 'N/A'}`).join('\n')}`) +
            buildPromptSegment(`New Module Faction`,`${faction.name}\n${faction.description}\n${faction.visualStyle}`) +
            buildPromptSegment(`Background`,`This game is a fantasy multiverse setting that pulls characters from across eras, worlds, and settings. ` +
                `The player of this game, ${stage.getSave().player.name}, presides as Magus over an isolated wizard's tower called the Sanctum for Planar Intake, Restoration, and Enrichment, or the Spire, which summons people from other realities and helps them adapt to a new life, ` +
                `with the goal of placing these characters into a new role in this world.`) +
            buildPromptSegment(`Narrative Tone`,`${stage.getSave().tone || stage.TONE_MAP['Original']}`) +
            buildPromptSegment(`Modules`,`Modules are rooms and facilities that make up the tower; each module has a function varying between utility and entertainment or anything inbetween, and serve as a backdrop for various interactions and events. ` +
                `Each of the game's factions can offer the player a unique room to unlock for their tower, generally following the themes of that faction, while avoiding content that is too similar to the Existing Modules. ` +
                `Every module similarly offers a resident-assignable role with an associated responsibility or purpose, which can again vary wildly between practical and whimsical.\n\n`) +
            buildPromptSegment(`Instructions`,`After carefully considering this faction's description, generate a formatted definition for a distinct and inspired tower module that reflects the faction's aesthetic and values in the following strict format:\n` +
                `MODULE NAME: The module's simple name (1-2 words)\n` +
                `PURPOSE: A brief summary of the module's function and role in the tower, as well as how that role might affect the tower's residents or inform skits at this location.\n` +
                `DESCRIPTION: A vivid visual description of the module's appearance, to be fed into image generation.\n` +
                `ROLE NAME: The simple title of the role associated with this module (1-2 words).\n` +
                `ROLE DESCRIPTION: A brief summary of the responsibilities and duties associated with this role.\n` +
                `#END#\n\n`) +
            buildPromptSegment(`Example Response`,`MODULE NAME: Homeward Gate\n` +
                `PURPOSE: The homeward gate is a two-way portal that returns residents to their home realities under a recall bond, letting the Magus call them back at will. Scenes in this room often involve farewells, returns, homesickness, or the ethics of the recall bond.\n` +
                `DESCRIPTION: A solemn stone chamber housing a freestanding archway carved with concentric rings of runes, its interior filled with a calm curtain of silver light.\n` +
                `ROLE NAME: Gatekeeper\n` +
                `ROLE DESCRIPTION: Responsible for tending the homeward gate and its recall bonds, overseeing departures home and returns to the Spire.\n` +
                `#END#`),
        stop: ['#END'],
        include_history: true,
        max_tokens: 500,
    });

    console.log('Generated faction module distillation:');
    console.log(generatedResponse);

    if (!generatedResponse) {
        console.error('Failed to generate faction module');
        return null;
    }

    // Parse the generated response
    const lines = generatedResponse.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    
    let moduleName = '';
    let purpose = '';
    let description = '';
    let roleName = '';
    let roleDescription = '';

    for (const line of lines) {
        if (line.startsWith('MODULE NAME:')) {
            moduleName = line.substring('MODULE NAME:'.length).trim().toLowerCase();
        } else if (line.startsWith('PURPOSE:')) {
            purpose = line.substring('PURPOSE:'.length).trim();
        } else if (line.startsWith('DESCRIPTION:')) {
            description = line.substring('DESCRIPTION:'.length).trim();
        } else if (line.startsWith('ROLE NAME:')) {
            roleName = line.substring('ROLE NAME:'.length).trim();
        } else if (line.startsWith('ROLE DESCRIPTION:')) {
            roleDescription = line.substring('ROLE DESCRIPTION:'.length).trim();
        }
    }

    // Validation
    if (!moduleName || !purpose || !description || !roleName || !roleDescription) {
        console.error('Failed to parse required fields from generated module', {
            moduleName, purpose, description, roleName, roleDescription
        });
        return null;
    }
    
    if (moduleName.length < 2 || moduleName.length > 30) {
        console.error('Module name has invalid length:', moduleName);
        return null;
    }

    const module: ModuleIntrinsic = {
        name: moduleName,
        skitPrompt: purpose,
        imagePrompt: description,
        role: roleName,
        roleDescription: roleDescription,
        baseImageUrl: '',
        defaultImageUrl: '',
        cost: {
            Wealth: 3 // Default cost for custom modules
        },
    };

    await generateFactionModuleImage(faction, module, stage);

    if (!module.baseImageUrl || !module.defaultImageUrl) {
        console.error('Failed to generate images for faction module');
        return null;
    }
    console.log(`Registering custom module: ${moduleName}`);
    faction.module = module;
    registerFactionModule(faction, faction.id, module);

    return moduleName;
}

export async function generateFactionModuleImage(faction: Faction, module: ModuleIntrinsic, stage: Stage): Promise<void> {
    // Start with a base image:
    const baseImageUrl = await stage.makeImage({
        prompt: `The detailed interior of an unoccupied room within a wizard's tower. The design should reflect the following description: ${module.imagePrompt}. ` +
            `Regardless of aesthetic, the image is rendered in a vibrant, painterly style with thick smudgy lines.`,
        aspect_ratio: AspectRatio.SQUARE
    }, '');
    if (!baseImageUrl) {
        return;
    }
    // Next, create a default variant with Qwen's image-to-image:
    const defaultImageUrl = await stage.makeImageFromImage({
        image: baseImageUrl,
        prompt: `Apply a visual novel art style to this fantasy wizard tower room (${module.imagePrompt}). Remove any characters from the scene.`,
        transfer_type: 'edit'
    }, '');
    if (baseImageUrl && defaultImageUrl) {
        module.baseImageUrl = baseImageUrl;
        module.defaultImageUrl = defaultImageUrl;
    }

    // If there is a module in the stage already, update its images:
    Object.values(stage.getSave().layout.getModulesWhere(m => m.type === faction.id)).forEach(m => m.attributes = {...module});
}
export default Faction;