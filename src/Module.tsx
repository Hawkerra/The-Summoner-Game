import { AspectRatio } from '@chub-ai/stages-ts';
import { buildPromptSegment, SkitType } from './Skit';
import { SaveType, Stage } from "./Stage";
import Actor from './actors/Actor';
import Faction from './factions/Faction';
import { ScreenType } from './screens/BaseScreen';
import { Build, Hotel, Restaurant, Security, AttachMoney, Favorite } from '@mui/icons-material';

export type ModuleType = 'echo chamber' | 'comms' | 'generator' | 'quarters' | 'commons' | 'infirmary' | 'gym' | 'lounge' | 'armory' 
    | 'cryo bank' | 'aperture' | 'director module'
    
    | string; // Allow string for modded modules

export enum StationStat {
    SYSTEMS = 'Arcanum',
    COMFORT = 'Comfort',
    PROVISION = 'Provision',
    SECURITY = 'Security',
    HARMONY = 'Harmony',
    WEALTH = 'Wealth'
}

// Icon mapping for station stats
export const STATION_STAT_ICONS: Record<StationStat, any> = {
    [StationStat.SYSTEMS]: Build,
    [StationStat.COMFORT]: Hotel,
    [StationStat.PROVISION]: Restaurant,
    [StationStat.SECURITY]: Security,
    [StationStat.HARMONY]: Favorite,
    [StationStat.WEALTH]: AttachMoney,
};

export const STATION_STAT_DESCRIPTIONS: Record<StationStat, string> = {
    'Arcanum': 'Structural soundness and enchantment upkeep of the tower',
    'Comfort': 'Overall comfort and livability for residents',
    'Provision': 'Availability of food, water, and essential supplies',
    'Security': 'Safety and defense against external and internal threats',
    'Harmony': 'Social cohesion and morale among inhabitants',
    'Wealth': 'Financial resources of the tower and its Magus'
};

export function getStatRating(score: number): StatRating {
    if (score <= 2) {
        return StatRating.POOR;
    } else if (score <= 4) {
        return StatRating.BELOW_AVERAGE;
    } else if (score <= 6) {
        return StatRating.AVERAGE;
    } else if (score <= 8) {
        return StatRating.GOOD;
    } else {
        return StatRating.EXCELLENT;
    }
}

// Mapping of StationStat to a set of prompt additions based on the 1-10 rating of the stat
// 5 ratings: 1-2 (poor), 3-4 (below average), 5-6 (average), 7-8 (good), 9-10 (excellent)
export enum StatRating {
    POOR = 'poor',
    BELOW_AVERAGE = 'below average',
    AVERAGE = 'average',
    GOOD = 'good',
    EXCELLENT = 'excellent'
}
export const STATION_STAT_PROMPTS: Record<StationStat, Record<StatRating, string>> = {
    'Arcanum': {
        [StatRating.POOR]: 'The tower is plagued by faltering enchantments, groaning masonry, and misbehaving animated fixtures, leaving it barely functional.',
        [StatRating.BELOW_AVERAGE]: 'The tower suffers occasional flickering enchantments and minor structural concerns that need attention.',
        [StatRating.AVERAGE]: 'The tower is generally functional, with routine upkeep keeping its enchantments working, if finicky.',
        [StatRating.GOOD]: 'The tower runs smoothly, its enchantments well-tended and its stonework sound.',
        [StatRating.EXCELLENT]: 'The tower hums with masterwork enchantments and impeccable structural integrity, operating flawlessly.'
    },
    'Comfort': {
        [StatRating.POOR]: 'Living conditions are harsh, filthy, and downright unhealthy, leading to widespread dissatisfaction among inhabitants.',
        [StatRating.BELOW_AVERAGE]: 'Living conditions are subpar, messy, and unpleasant, with many inhabitants feeling uneasy in their environment.',
        [StatRating.AVERAGE]: 'Living conditions and cleanliness are acceptable, providing a basic level of comfort for inhabitants.',
        [StatRating.GOOD]: 'The tower offers a comfortable, clean, and pleasant living environment for its residents.',
        [StatRating.EXCELLENT]: 'Inhabitants enjoy luxurious, impeccable, and healthful living conditions, enhancing their overall well-being.'
    },
    'Provision': {
        [StatRating.POOR]: 'Essential supplies are scarce, leading to frequent shortages and hardships for inhabitants.',
        [StatRating.BELOW_AVERAGE]: 'Provision levels are inconsistent, with occasional shortages of food, water, and supplies.',
        [StatRating.AVERAGE]: 'The tower maintains a steady supply of essentials, meeting the basic needs of residents.',
        [StatRating.GOOD]: 'Provision levels are reliable, ensuring inhabitants have access to necessary supplies without issue.',
        [StatRating.EXCELLENT]: 'The tower is abundantly stocked with essentials, providing more than enough for all residents.'
    },
    'Security': {
        [StatRating.POOR]: 'The tower is vulnerable to threats, its wards thin and neglected, with frequent security concerns.',
        [StatRating.BELOW_AVERAGE]: 'Security measures are weak, leading to occasional malfeasance and safety concerns among inhabitants.',
        [StatRating.AVERAGE]: 'The tower keeps standard wards and watch routines in place; residents may occasionally act out but are generally kept in check.',
        [StatRating.GOOD]: 'Security is robust, the wards and watch effectively protecting the tower and its residents from threats.',
        [StatRating.EXCELLENT]: 'The tower is layered in masterwork wards and vigilant sentinels, ensuring unparalleled safety and protection for all.'
    },
    'Harmony': {
        [StatRating.POOR]: 'Social tensions run high and morale is non-existent, leading to frequent conflicts and a toxic atmosphere among inhabitants.',
        [StatRating.BELOW_AVERAGE]: 'Harmony is lacking and morale is low, with noticeable divisions and occasional disputes among inhabitants.',
        [StatRating.AVERAGE]: 'The social environment is stable, with decent morale and generally peaceful coexistence.',
        [StatRating.GOOD]: 'A strong sense of community and high morale prevails, fostering good vibes and positive relationships among inhabitants.',
        [StatRating.EXCELLENT]: 'Inhabitants enjoy a harmonious and supportive social environment, thriving together in unity.'
    },
    'Wealth': { // Wealther is financial resources of the station and its Director and does not necessarily reflect the personal wealth of inhabitants nor the station's overall provision levels
        [StatRating.POOR]: 'Financial resources are critically low, potentially leading to severe budget cuts and creditor threats.',
        [StatRating.BELOW_AVERAGE]: 'Wealth levels are low, leading to budget constraints and creditor complaints.',
        [StatRating.AVERAGE]: 'The Magus maintains a stable financial footing, covering operational costs and bills.',
        [StatRating.GOOD]: 'The Magus is financially healthy, with ample resources in reserve.',
        [StatRating.EXCELLENT]: 'The Magus enjoys significant wealth, capable of lavish spending.'
    }
};

export interface ModuleIntrinsic {
    name: string;
    skitPrompt?: string; // Additional prompt text to influence the script in skit generation
    imagePrompt?: string; // Additional prompt text to describe the module in decor image generation
    role?: string;
    roleDescription?: string;
    baseImageUrl: string; // Base image that is used for theming through image2image calls
    defaultImageUrl: string; // Default themed version of the module
    cost: {[key in StationStat]?: number}; // Cost to build the module (StationStat name to amount)
    [key: string]: any; // Additional properties, if needed
    // Action method; each module has an action that will need to take the Module and Stage as contextual parameters:
    action?: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => void;
    available?: (stage: Stage) => boolean;
}

const randomAction = (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
    // Maybe move the module's owner (if any) here (make sure they aren't located at a faction):
    const owner = module.ownerId ? stage.getSave().actors[module.ownerId] : undefined;
    if (owner && !owner.isOffSite(stage.getSave()) && Math.random() < 0.5) {
        owner.locationId = module.id;
    }

    stage.setSkit({
        type: SkitType.RANDOM_ENCOUNTER,
        moduleId: module.id,
        script: [],
        generating: true,
        context: {},
    });
    setScreenType(ScreenType.SKIT);
};

export const MODULE_TEMPLATES: Record<ModuleType, ModuleIntrinsic> = {
    'echo chamber': {
        name: 'Summoning Sanctum',
        skitPrompt: 'The summoning sanctum is where the Magus completes summonings, drawing people out of the leyline current and bodily into this world. Scenes in this room typically involve newly summoned residents as they get their bearings.',
        imagePrompt: 'A circular ritual chamber with a glowing summoning circle inlaid in the stone floor, arcane sigils on the walls, candles, and shelves of ritual implements.',
        role: 'Apprentice',
        roleDescription: `Manage tower operations, monitoring the residents and supplementing their needs as the Magus's right hand.`,
        baseImageUrl: 'https://media.charhub.io/2f92a39f-02be-41fd-b61d-56de04a9ecc4/62d30715-01e1-4581-beb4-61cf31134955.png',
        defaultImageUrl: 'https://media.charhub.io/026ae01a-7dc8-472d-bfea-61548b87e6ef/84990780-8260-4833-ac0b-79c1a15ddb9e.png',
        cost: {}, // Free; starter module
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // Open the station management screen
            console.log("Opening echo screen from command module.");
            // Use Stage API so any mounted UI can react to the change
            setScreenType(ScreenType.ECHO);
        },
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'echo chamber').length === 0;
        }
    },
    comms: {
        name: 'Translocation Circle',
        skitPrompt: `The translocation circle is the tower's only practical link to the outside world; the surrounding jungle and ruins make overland travel treacherous at the best of times. ` +
            `This room is critical for dealing with external factions, whose approved envoys can be brought to the Spire or sent away again, and with whom the Spire finds work for residents or conducts trade in exchange for desired resources. ` +
            `Scenes here often involve arrivals and departures, messages carried by envoys, or coordinating comings and goings among the residents.`,
        imagePrompt: 'A grand stone chamber dominated by a raised teleportation circle etched with glowing runes, ringed by braziers, with a modest waiting area to one side.',
        role: 'Herald',
        roleDescription: `Oversee the translocation circle and its comings and goings, receiving envoys and managing the tower's dealings with the outside world.`,
        baseImageUrl: 'https://media.charhub.io/e13c7784-9f5f-4ec2-a179-5bab52973b3a/f5e69e63-88bf-4f7d-919b-41c8a2adcc6c.png',
        defaultImageUrl: 'https://media.charhub.io/9293912a-ebf4-4a0f-bac6-b9bfc82115f1/2ce9899c-a8cb-4186-9abb-fb8192ced8bd.png',
        cost: {}, // Free; starter module
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // If there is a rep from a faction here, open a faction interaction skit
            if (stage.getSave().commsVisitors?.length ?? 0 > 0) {
                const faction = Object.values(stage.getSave().factions).find(a => a.representativeId && stage.getSave().commsVisitors?.includes(a.representativeId));
                if (faction) {
                    // Move the module's owner (if any) here:
                    const owner = module.ownerId ? stage.getSave().actors[module.ownerId] : undefined;
                    if (owner && !owner.isOffSite(stage.getSave())) {
                        owner.locationId = module.id;
                    }
                    // Introduce a new faction:
                    if (!faction.active && faction?.reputation > 0) {
                        // Activate a new faction:
                        faction.active = true;
                        stage.setSkit({
                            type: SkitType.FACTION_INTRODUCTION,
                            moduleId: module.id,
                            script: [],
                            generating: true,
                            context: {factionId: faction.id,}
                        });
                    } else {
                        stage.setSkit({
                            type: SkitType.FACTION_INTERACTION,
                            moduleId: module.id,
                            script: [],
                            generating: true,
                            context: {factionId: faction.id}
                        });
                    }
                    setScreenType(ScreenType.SKIT);
                }
            } else if (Object.values(stage.getSave().actors).some(a => a.locationId === module.id)) {
                console.log("Opening skit.");
                stage.setSkit({
                    type: SkitType.RANDOM_ENCOUNTER,
                    moduleId: module.id,
                    script: [],
                    generating: true,
                    context: {}
                });
                setScreenType(ScreenType.SKIT);
            }
        },
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'comms').length === 0;
        }
    },
    generator: {
        name: 'Leyline Font',
        skitPrompt: 'The leyline font is where the tower taps the great leyline nexus beneath it, and serves as a hub for tending the enchantments that keep the Spire running. Scenes here often involve the tower\'s overall stability and upkeep.',
        imagePrompt: 'A vaulted stone chamber built around a column of radiant leyline energy rising through the floor, ringed by runic conduits, crystal regulators, and arcane control lecterns.',
        role: 'Artificer',
        roleDescription: `Tend the tower's enchantments and leyline flows, ensuring every chamber receives adequate magic and maintenance to function properly.`,
        baseImageUrl: 'https://media.charhub.io/e53eeeb3-81a9-4020-a336-070c65edbb8a/4141ed00-9ab7-47f5-a4ce-21983b013e46.png',
        defaultImageUrl: 'https://media.charhub.io/36c3c8b5-1abd-4766-8042-fa7a2af0ce42/6106d6ec-7746-4130-8e13-860c89a325c7.png',
        cost: {}, // Free; starter module
        action: randomAction,
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'generator').length === 0;
        }
    },
    quarters: {
        name: 'Chambers',
        skitPrompt: 'Private chambers are personal living spaces for the tower\'s residents. Scenes here often involve personal interactions:  revelations, troubles, interests, or relaxation.',
        imagePrompt: 'A cozy tower bedchamber with a bed, personal storage, and warm lantern light, reflecting the occupant\'s personality.',
        baseImageUrl: 'https://media.charhub.io/5e39db53-9d66-459d-8926-281b3b089b36/8ff20bdb-b719-4cf7-bf53-3326d6f9fcaa.png', 
        defaultImageUrl: 'https://media.charhub.io/99ffcdf5-a01b-43cf-81e5-e7098d8058f5/d1ec2e67-9124-4b8b-82d9-9685cfb973d2.png',
        cost: {Provision: 1},
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // Open the skit screen to speak to occupants
            const owner = module.ownerId ? stage.getSave().actors[module.ownerId] : undefined;
            if (owner && !owner.isOffSite(stage.getSave())) {
                console.log("Opening skit.");
                owner.locationId = module.id; // Ensure actor is in the module
                stage.setSkit({
                    type: SkitType.VISIT_CHARACTER,
                    actorId: module.ownerId,
                    moduleId: module.id,
                    script: [],
                    generating: true,
                    context: {}
                });
                setScreenType(ScreenType.SKIT);
            }
        },
        available: (stage: Stage) => {
            // Can have multiple quarters; no restriction
            return true;
        }
    },
    commons: {
        name: 'Great Hall',
        skitPrompt: 'The great hall is a place for residents to gather, relax, eat, and interact. Scenes here often involve camaraderie, conflicts, and leisure activities among the residents.',
        imagePrompt: 'A warm great hall with a long table and benches, a large hearth, and pantry shelves and cooking facilities along the far wall.',
        role: 'Steward',
        roleDescription: `Maintain the tower's communal spaces, ensuring they remain inviting and well-stocked for residents' meals and gatherings.`,
        baseImageUrl: 'https://media.charhub.io/0cee625e-73e7-43b3-86b3-a06c082e73a9/7f958523-48b9-40a4-ae67-59b0cea199d3.png', 
        defaultImageUrl: 'https://media.charhub.io/041617bd-1cb3-424d-8e66-788e60edc80d/3a21ddd2-bd66-40b0-84ca-68b11d8218b2.png',
        cost: {Provision: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'commons').length === 0;
        }
    },
    infirmary: {
        name: 'Apothecary',
        skitPrompt: 'The apothecary is the tower\'s healing hall, where residents receive treatment and care. Scenes here often involve injuries, ailments, or ways to improve the residents\' health and well-being.',
        imagePrompt: 'A candlelit healing room with cots, herb-drying racks, shelves of potions and poultices, and a healer\'s workbench.',
        role: 'Healer',
        roleDescription: `Provide healing and remedies for the residents, ensuring their health and well-being.`,
        baseImageUrl: 'https://media.charhub.io/b62f09a0-7a42-47e7-b0be-f54dfac00f33/fe73db8c-2cb6-4744-9464-6d26ecf776c0.png',
        defaultImageUrl: 'https://media.charhub.io/5e9c6119-51b4-4a2c-a06c-bb8f1c20aea1/c471f9ba-ea5f-495b-8e44-e02723a04938.png',
        cost: {Provision: 1, Comfort: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'infirmary').length === 0;
        }
    },
    gym: {
        name: 'Sparring Hall',
        skitPrompt: 'The sparring hall is where residents train and maintain their physical health. Scenes here often involve training sessions, contests, or ways to boost morale through physical activity.',
        imagePrompt: 'A stone training hall with weapon racks, practice dummies, sparring mats, and tall windows.',
        role: 'Drillmaster',
        roleDescription: `Oversee the physical training of the residents, ensuring they remain in fighting form for whatever their duties demand.`,
        baseImageUrl: 'https://media.charhub.io/349ca504-7b7e-4afd-8a52-43dd7b166bc7/d91d37e1-eb9d-4211-a28f-16b8d4d341d1.png',
        defaultImageUrl: 'https://media.charhub.io/7f6bd636-804e-493c-8442-e691856a6703/589a3768-f0da-43c0-ab70-8b7d403f5a62.png',
        cost: {Comfort: 1, Wealth: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'gym').length === 0;
        }
    },
    lounge: {
        name: 'Parlor',
        skitPrompt: 'The parlor is a recreational room where residents can unwind with a drink and socialize. Scenes here often involve leisure, gossip, games, and ways to boost morale through relaxation and entertainment.',
        imagePrompt: 'A cozy tower parlor with plush seating, a hearth, a small bar of cordials and wines, and tables for cards and games.',
        role: 'Host',
        roleDescription: `Oversee the tower's leisure spaces, ensuring residents have a comfortable and enjoyable place to relax and socialize.`,
        baseImageUrl: 'https://media.charhub.io/323b12cf-8687-4475-851b-7c1bdeff447a/0b71cb51-c160-47c9-848e-fab183eb9314.png',
        defaultImageUrl: 'https://media.charhub.io/2e8bf9fc-67a8-499d-85ec-8198efafeb14/1da73912-d19e-4f4e-aeda-19688e16e474.png',
        cost: {Comfort: 2, Wealth: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Require at least three patients on board to build a lounge:
            const patientCount = Object.values(stage.getSave().actors).filter(a => a.origin === 'patient').length;
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'lounge').length === 0 && patientCount >= 3;
        }
    },
    armory: {
        name: 'Armory',
        skitPrompt: 'The armory is the tower\'s defense hub, where weapons, armor, and the Spire\'s protective wards are managed. Scenes here often involve security matters, incident reports, or ways to strengthen the tower\'s defenses.',
        imagePrompt: 'A stone armory with racks of weapons, armor stands, shields on the walls, and a workbench for maintenance.',
        role: 'Warden',
        roleDescription: `Manage the tower's defenses and ensure the safety of the residents against external and internal threats.`,
        baseImageUrl: 'https://media.charhub.io/7ccddb81-bed6-4395-80c6-912fe2932e53/c58a4f32-270d-4b62-b2b4-bcc1a3dedc94.png',
        defaultImageUrl: 'https://media.charhub.io/090e6a42-62f9-46da-9a29-09de8b469f05/eedf310f-af7a-40b4-ac56-686f4daa5c07.png',
        cost: {Arcanum: 1, Wealth: 1},
        action: randomAction,
        available: (stage: Stage) => {
            // Require to have met at least three factions:
            const metFactionsCount = Object.values(stage.getSave().factions).filter(f => f.active).length;
            // Can have only one in stage.getSave().layout:
            return stage.getLayout().getModulesWhere(m => m.type === 'armory').length === 0 && metFactionsCount >= 3;
        }
    },
    'cryo bank': {
        name: 'Homeward Gate',
        skitPrompt: 'The homeward gate is a two-way portal that returns residents to their home realities under a recall bond, allowing the Magus to call them back to the Spire at will - far more cheaply than a fresh summoning. The gate refuses to work for the Magus alone. Scenes in this room often involve farewells, returns, homesickness, or the ethics of the recall bond.',
        imagePrompt: 'A solemn stone chamber housing a freestanding archway carved with concentric rings of runes, its interior filled with a calm curtain of silver light.',
        role: 'Gatekeeper',
        roleDescription: `Tend the homeward gate and its recall bonds, overseeing departures home and returns to the Spire.`,
        baseImageUrl: 'https://media.charhub.io/439bcef8-3c12-4c07-b1fb-5659c0111edb/16e89185-6266-4ccf-a010-cf80090fcb08.png',
        defaultImageUrl: 'https://media.charhub.io/6dbe1503-e10a-48e4-875d-cc7a5038bc43/be0aa5dc-70b6-4573-ae48-c37d8e90022f.png',
        cost: {Harmony: 2, Arcanum: 2},
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // Open the cryo management screen
            console.log("Opening cryo screen from cryo bank.");
            setScreenType(ScreenType.CRYO);
        },
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout, and only once there are at least five patients:
            const patientCount = Object.values(stage.getSave().actors).filter(a => a.origin === 'patient').length;
            return stage.getLayout().getModulesWhere(m => m.type === 'cryo bank').length === 0 && patientCount >= 5;
        }
    },
    'aperture': {
        name: 'Arcane Focus',
        skitPrompt: 'The arcane focus is a specialized apparatus for attuning or shaping summonings drawn from the leyline current. Scenes here often involve scholarly discussions about the ill-understood mechanics of summoning or unexpected phenomena.',
        imagePrompt: 'A wizard\'s observatory-laboratory centered on a great brass and crystal lens array, surrounded by charts and instruments, with motes of light streaming along a glowing leyline through the chamber.',
        role: 'Attuner',
        roleDescription: `Conduct research on the leyline and its currents, managing the tower's experimental summoning projects.`,
        baseImageUrl: 'https://chub.ai/imagine/project/8ca887ea-ea20-4c53-9536-a4354e565246',
        defaultImageUrl: 'https://media.charhub.io/551ea94a-c64c-4328-a54a-08a8a356f261/ec7e47be-b157-4f71-a14d-4e45110e84f7.png',
        cost: {Arcanum: 2, Wealth: 2},
        action: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
            // Open the attenuation screen
            console.log("Opening aperture screen from aperture module.");
            setScreenType(ScreenType.APERTURE);
        },
        available: (stage: Stage) => {
            // Can have only one in stage.getSave().layout, and only once the station's Systems stat is at least 5:
            const systemsStat = stage.getSave().stationStats?.[StationStat.SYSTEMS] || 0;
            return stage.getLayout().getModulesWhere(m => m.type === 'aperture').length === 0 && systemsStat >= 5;
        }
    }
};

/**
 * Register a custom faction module template at runtime
 */
export function registerFactionModule(faction: Faction,
    type: string,
    intrinsic: ModuleIntrinsic
): void {
    registerModule(type, intrinsic, randomAction, (stage: Stage) => {
        // Custom modules can only be built once and require minimum reputation with the faction
        const factionRep = stage.getSave().factions[faction.id]?.reputation || 0;
        const existingCount = stage.getLayout().getModulesWhere(m => m.type === type).length;
        return existingCount === 0 && factionRep >= 6;
    });
}

export function registerModule(type: string, intrinsic: ModuleIntrinsic, action?: (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => void, available?: (stage: Stage) => boolean): void {
    MODULE_TEMPLATES[type] = {...intrinsic,
        action: action || intrinsic.action || randomAction,
        available: available || ((stage: Stage) => {return stage.getLayout().getModulesWhere(m => m.type === type).length === 0})
    };
}

/**
 * Check if a module type is registered (either built-in or custom)
 */
export function isModuleTypeRegistered(type: string): boolean {
    return type in MODULE_TEMPLATES;
}

/**
 * Get the template for a module type
 */
export function getModuleTemplate(type: string): ModuleIntrinsic | undefined {
    return MODULE_TEMPLATES[type];
}

export class Module<T extends ModuleType = ModuleType> {
    public id: string;
    public type: T;
    public ownerId?: string; // For quarters, this is the occupant, for other modules, it is the character assigned to the associated role
    public attributes?: Partial<ModuleIntrinsic> & { [key: string]: any };

    /**
     * Rehydrate a Module from saved data
     */
    static fromSave(savedModule: any): Module {
        let type = savedModule.type === 'medbay' ? 'infirmary' : savedModule.type; // Backwards compatibility
        type = type === 'communications' ? 'comms' : type; // Backwards compatibility
        return createModule(type as ModuleType, {
            id: savedModule.id,
            attributes: savedModule.attributes,
            ownerId: savedModule.ownerId
        });
    }

    constructor(type: T, opts?: { id?: string; attributes?: Partial<ModuleIntrinsic> & { [key: string]: any }; ownerId?: string }) {
        this.id = opts?.id ?? `${type}-${Date.now()}`;
        this.type = type;
        this.ownerId = opts?.ownerId;
        this.attributes = opts?.attributes || {};
    }

    /**
     * Get all attributes with intrinsic defaults applied
     */
    getAttributes(): ModuleIntrinsic & { [key: string]: any } {
        const defaults = MODULE_TEMPLATES[this.type] || {};
        return { ...defaults, ...(this.attributes || {}) };
    }

    /**
     * Get a specific attribute with intrinsic default fallback
     */
    getAttribute<K extends keyof ModuleIntrinsic>(key: K): ModuleIntrinsic[K];
    getAttribute(key: string): any;
    getAttribute(key: string): any {
        const instanceValue = this.attributes?.[key];
        if (instanceValue !== undefined) {
            return instanceValue;
        }
        return MODULE_TEMPLATES[this.type]?.[key];
    }

    /**
     * Get the action method for this module type
     */
    getAction(): ((module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => void) {
        return MODULE_TEMPLATES[this.type]?.action || randomAction;
    }
}

export function createModule(type: ModuleType, opts?: { id?: string; attributes?: Partial<ModuleIntrinsic> & { [key: string]: any }; ownerId?: string }): Module {
    return new Module(type, opts);
}

export const DEFAULT_GRID_SIZE = 6; // Deprecated - use DEFAULT_GRID_WIDTH and DEFAULT_GRID_HEIGHT
export const DEFAULT_GRID_WIDTH = 8;
export const DEFAULT_GRID_HEIGHT = 5;

export type LayoutChangeHandler = (grid: Module[]) => void;

// The buildable footprint of each floor: a circle-like shape within the 8x5 grid,
// a 3x3 center (cols 3-5, rows 1-3) plus three cells extending in each cardinal direction.
export const FLOOR_FOOTPRINT: ReadonlyArray<{ x: number; y: number }> = [
    // center 3x3
    {x:3,y:1},{x:4,y:1},{x:5,y:1},
    {x:3,y:2},{x:4,y:2},{x:5,y:2},
    {x:3,y:3},{x:4,y:3},{x:5,y:3},
    // top arm
    {x:3,y:0},{x:4,y:0},{x:5,y:0},
    // bottom arm
    {x:3,y:4},{x:4,y:4},{x:5,y:4},
    // left arm
    {x:2,y:1},{x:2,y:2},{x:2,y:3},
    // right arm
    {x:6,y:1},{x:6,y:2},{x:6,y:3},
];

export function isFootprintCell(x: number, y: number): boolean {
    return FLOOR_FOOTPRINT.some(c => c.x === x && c.y === y);
}

// UI cells for floor navigation (NOT modules - characters cannot route to these).
export const BUILD_UP_CELL = { x: 2, y: 0 };   // upper-left: "build next floor" / "go up" once built
export const GO_DOWN_CELL = { x: 2, y: 4 };    // lower-left: "go down" appears on floors above the first

export const MAX_FLOORS = 5;

// Escalating cost to build each floor, indexed by the floor being built (floor 2 = index 2).
// Floor 1 exists for free at game start. Values are tower-stat point costs.
export const FLOOR_BUILD_COSTS: Record<number, Partial<Record<StationStat, number>>> = {
    2: { [StationStat.COMFORT]: 1, [StationStat.HARMONY]: 1 },
    3: { [StationStat.HARMONY]: 1, [StationStat.SYSTEMS]: 1, [StationStat.WEALTH]: 1 },
    4: { [StationStat.HARMONY]: 2, [StationStat.SYSTEMS]: 1, [StationStat.SECURITY]: 1 },
    5: { [StationStat.HARMONY]: 2, [StationStat.SYSTEMS]: 2, [StationStat.SECURITY]: 1, [StationStat.WEALTH]: 1 },
};


export class Layout {
    // Multi-floor storage. floors[f] is a 2D grid (grid[y][x]) for floor f (0-indexed).
    // Floor 0 is the ground floor. currentFloor is the floor currently displayed/edited.
    public floors: (Module | null)[][][];
    public currentFloor: number;
    public gridWidth: number;
    public gridHeight: number;

    // Deprecated: gridSize kept for backward compatibility
    public get gridSize(): number {
        return Math.max(this.gridWidth, this.gridHeight);
    }

    // The active floor's grid. Existing code that reads `layout.grid` keeps working,
    // operating on whichever floor is currently displayed.
    public get grid(): (Module | null)[][] {
        return this.floors[this.currentFloor];
    }
    public set grid(g: (Module | null)[][]) {
        this.floors[this.currentFloor] = g;
    }

    private static emptyGrid(width: number, height: number): (Module | null)[][] {
        return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
    }

    constructor(width: number = DEFAULT_GRID_WIDTH, height: number = DEFAULT_GRID_HEIGHT, initial?: (Module | null)[][]) {
        this.gridWidth = width;
        this.gridHeight = height;
        this.floors = [initial || Layout.emptyGrid(width, height)];
        this.currentFloor = 0;
    }

    /** Number of floors that have been built. */
    get floorCount(): number {
        return this.floors.length;
    }

    /** Adds a new empty floor on top and returns its index. Caller enforces MAX_FLOORS and cost. */
    addFloor(): number {
        if (this.floors.length >= MAX_FLOORS) return this.floors.length - 1;
        this.floors.push(Layout.emptyGrid(this.gridWidth, this.gridHeight));
        return this.floors.length - 1;
    }

    setCurrentFloor(index: number): void {
        if (index >= 0 && index < this.floors.length) {
            this.currentFloor = index;
        }
    }

    /** True when every buildable footprint cell on the given floor holds a module. */
    isFloorFull(floorIndex: number): boolean {
        const grid = this.floors[floorIndex];
        if (!grid) return false;
        return FLOOR_FOOTPRINT.every(cell => grid[cell.y]?.[cell.x]);
    }

    /**
     * Rehydrate a Layout from saved data. Supports:
     *  - new multi-floor saves (savedLayout.floors)
     *  - old single-grid saves (savedLayout.grid) -> becomes floor 0
     */
    static fromSave(savedLayout: any): Layout {
        const layout: Layout = Object.create(Layout.prototype);

        if (savedLayout.gridWidth !== undefined && savedLayout.gridHeight !== undefined) {
            layout.gridWidth = savedLayout.gridWidth;
            layout.gridHeight = savedLayout.gridHeight;
        } else {
            layout.gridWidth = DEFAULT_GRID_WIDTH;
            layout.gridHeight = DEFAULT_GRID_HEIGHT;
        }

        const rehydrateGrid = (rawGrid: any[]): (Module | null)[][] => {
            const source = rawGrid?.map((row: any[]) =>
                row?.map((savedModule: any) => savedModule ? Module.fromSave(savedModule) : null)
            ) || [];
            const grid = Layout.emptyGrid(layout.gridWidth, layout.gridHeight);
            const relocate: Module[] = [];
            for (let y = 0; y < source.length; y++) {
                for (let x = 0; x < (source[y]?.length || 0); x++) {
                    const module = source[y][x];
                    if (!module) continue;
                    if (y < layout.gridHeight && x < layout.gridWidth) {
                        grid[y][x] = module;
                    } else {
                        relocate.push(module);
                    }
                }
            }
            for (const module of relocate) {
                let placed = false;
                for (let y = 0; y < layout.gridHeight && !placed; y++) {
                    for (let x = 0; x < layout.gridWidth && !placed; x++) {
                        if (!grid[y][x]) { grid[y][x] = module; placed = true; }
                    }
                }
            }
            return grid;
        };

        if (Array.isArray(savedLayout.floors)) {
            layout.floors = savedLayout.floors.map((floorGrid: any[]) => rehydrateGrid(floorGrid));
            if (layout.floors.length === 0) {
                layout.floors = [Layout.emptyGrid(layout.gridWidth, layout.gridHeight)];
            }
        } else {
            // Legacy single-floor save
            layout.floors = [rehydrateGrid(savedLayout.grid)];
        }
        layout.currentFloor = (typeof savedLayout.currentFloor === 'number' &&
            savedLayout.currentFloor >= 0 && savedLayout.currentFloor < layout.floors.length)
            ? savedLayout.currentFloor : 0;

        return layout;
    }

    getLayout(): (Module | null)[][] {
        return this.grid;
    }

    setLayout(layout: (Module | null)[][]) {
        this.grid = layout;
    }

    getActorsAtModule(module: Module, save: SaveType): Actor[] {
        return Object.values(save.actors).filter(actor => actor.locationId === module.id);
    }

    /** Scans the CURRENT floor only. */
    getModulesWhere(predicate: (module: Module) => boolean): Module[] {
        const modules: Module[] = [];
        const grid = this.grid;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const module = grid[y][x];
                if (module && predicate(module)) modules.push(module);
            }
        }
        return modules;
    }

    /** Scans ALL floors. Used for movement/lookup so characters can reach rooms on any floor. */
    getAllModulesWhere(predicate: (module: Module) => boolean): Module[] {
        const modules: Module[] = [];
        for (const grid of this.floors) {
            for (let y = 0; y < this.gridHeight; y++) {
                for (let x = 0; x < this.gridWidth; x++) {
                    const module = grid[y][x];
                    if (module && predicate(module)) modules.push(module);
                }
            }
        }
        return modules;
    }

    /** Searches every floor by id. */
    getModuleById(id: string): Module | null {
        for (const grid of this.floors) {
            for (let y = 0; y < this.gridHeight; y++) {
                for (let x = 0; x < this.gridWidth; x++) {
                    const module = grid[y][x];
                    if (module && module.id === id) return module;
                }
            }
        }
        return null;
    }

    /** Returns the floor index a module lives on, or -1. */
    getModuleFloor(id: string): number {
        for (let f = 0; f < this.floors.length; f++) {
            const grid = this.floors[f];
            for (let y = 0; y < this.gridHeight; y++) {
                for (let x = 0; x < this.gridWidth; x++) {
                    if (grid[y][x]?.id === id) return f;
                }
            }
        }
        return -1;
    }

    getModuleAt(x: number, y: number): Module | null {
        return this.grid[y]?.[x] ?? null;
    }

    /** Coordinates on the CURRENT floor. */
    getModuleCoordinates(module: Module | null): { x: number; y: number } {
        const grid = this.grid;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (module && grid[y][x]?.id === module?.id) return { x, y };
            }
        }
        return {x: -1000, y: -1000};
    }

    setModuleAt(x: number, y: number, module: Module) {
        if (!this.grid[y]) return;
        this.grid[y][x] = module;
    }

    /** Removes a module by identity, searching every floor. */
    removeModule(module: Module | null): boolean {
        if (!module) return false;
        for (const grid of this.floors) {
            for (let y = 0; y < this.gridHeight; y++) {
                for (let x = 0; x < this.gridWidth; x++) {
                    if (grid[y][x]?.id === module.id) { grid[y][x] = null; return true; }
                }
            }
        }
        return false;
    }

    removeModuleAt(x: number, y: number): Module | null {
        const module = this.grid[y]?.[x] || null;
        if (module && this.grid[y]) this.grid[y][x] = null;
        return module;
    }
}

export async function generateModule(name: string, stage: Stage, additionalInformation?: string, role?: string): Promise<ModuleIntrinsic|null> {
    // Generate a module from a module name, some arbitrary details, and a role title
    const generatedResponse = await stage.makeText({
        prompt: `{{messages}}This is preparatory request for structured and formatted game content. ` +
            `The goal is to define a module/room for a wizard tower management game, based primarily upon the name, and potentially some other information, ` +
            `while generally avoiding duplicating existing content below. ` +
            buildPromptSegment(`Existing Modules`, Object.entries(MODULE_TEMPLATES).map(([type, mod]) => `- ${type}: Role - ${mod.role || 'N/A'}`).join('\n')) +
            buildPromptSegment(`New Module Details`, `Name: ${name}\nNew Role: ${role || 'N/A'}\nAdditional Information: ${additionalInformation || 'N/A'}`) +
            buildPromptSegment(`Background`, `This game is a fantasy multiverse setting that pulls characters from across eras, worlds, and settings. ` +
                `The player of this game, ${stage.getSave().player.name}, presides as Magus over an isolated wizard's tower called the Sanctum for Planar Intake, Restoration, and Enrichment, or the Spire, which summons people from other realities and helps them adapt to a new life, ` +
                `with the goal of placing these characters into a new role in this world. ` +
                `Modules are rooms and facilities that make up the Spire; each module has a function varying between utility and entertainment or anything inbetween, and serve as a backdrop for various interactions and events. ` +
                `Every module offers a resident-assignable role with an associated responsibility or purpose, which can again vary wildly between practical and whimsical.`) +
            buildPromptSegment(`Instructions`, `After carefully considering the provided details, the System will generate a formatted definition for a distinct and inspired tower module that suits the prompt, outputting it in the following strict format:\n` +
                `MODULE NAME: The module's simple name (1-2 words)\n` +
                `PURPOSE: A brief summary of the module's function and role in the tower, as well as how that role might affect the tower's residents or inform skits at this location.\n` +
                `DESCRIPTION: A vivid visual description of the module's appearance, to be fed into image generation.\n` +
                `ROLE NAME: The simple title of the role associated with this module (1-2 words).\n` +
                `ROLE DESCRIPTION: A brief summary of the responsibilities and duties associated with this role.\n` +
                `COST: The resource cost to build this module, specified as 1-3 points of one or two tower stats. Available stats are: Arcanum, Comfort, Provision, Security, Harmony, Wealth. Format as "StatName X, StatName Y" (e.g., "Wealth 2, Systems 1" or "Provision 2").\n` +
                `#END#`) +
            buildPromptSegment(`Example Response`,
                `MODULE NAME: Homeward Gate\n` +
                `PURPOSE: The homeward gate is a two-way portal that returns residents to their home realities under a recall bond, letting the Magus call them back at will. Scenes in this room often involve farewells, returns, homesickness, or the ethics of the recall bond.\n` +
                `DESCRIPTION: A solemn stone chamber housing a freestanding archway carved with concentric rings of runes, its interior filled with a calm curtain of silver light.\n` +
                `ROLE NAME: Gatekeeper\n` +
                `ROLE DESCRIPTION: Responsible for tending the homeward gate and its recall bonds, overseeing departures home and returns to the Spire.\n` +
                `COST: Harmony 2, Arcanum 2\n` +
                `#END#`) +
            buildPromptSegment(`Example Response`,
                `MODULE NAME: Sparring Hall\n` +
                `PURPOSE: The sparring hall is where residents train and maintain their physical health. Scenes here often involve training sessions, contests, or ways to boost morale through physical activity.\n` +
                `DESCRIPTION: A stone training hall with weapon racks, practice dummies, sparring mats, and tall windows.\n` +
                `ROLE NAME: Drillmaster\n` +
                `ROLE DESCRIPTION: Oversees the physical training of the residents, ensuring they remain in fighting form for whatever their duties demand.\n` +
                `COST: Comfort 1, Wealth 1\n` +
                `#END#`),
        stop: ['#END'],
        include_history: true,
        max_tokens: 400,
    });

    console.log('Generated module distillation:');
    console.log(generatedResponse);

    if (!generatedResponse) {
        console.error('Failed to generate module');
        return null;
    }

    // Parse the generated response
    const lines = generatedResponse.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    
    let moduleName = '';
    let purpose = '';
    let description = '';
    let roleName = '';
    let roleDescription = '';
    let costString = '';

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
        } else if (line.startsWith('COST:')) {
            costString = line.substring('COST:'.length).trim();
        }
    }

    moduleName = moduleName || name || '';
    roleName = roleName || role || '';

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

    // Parse cost with default fallback
    const parsedCost: {[key in StationStat]?: number} = {};
    
    if (costString) {
        // Parse cost string like "Wealth 2, Arcanum 1" or "Provision 2"
        const costParts = costString.split(',').map(s => s.trim());
        
        for (const part of costParts) {
            // Match pattern: "StatName Number"
            const match = part.match(/^([a-zA-Z]+)\s+(\d+)$/);
            if (match) {
                const statName = match[1];
                const amount = parseInt(match[2]);
                
                // Find matching StationStat (case-insensitive)
                for (const stat of Object.values(StationStat)) {
                    if (stat.toLowerCase() === statName.toLowerCase()) {
                        // Clamp to 1-3 as specified
                        parsedCost[stat] = Math.max(1, Math.min(3, amount));
                        break;
                    }
                }
            }
        }
    }
    
    // Apply default cost if parsing failed or resulted in no costs
    const finalCost = Object.keys(parsedCost).length > 0 
        ? parsedCost 
        : { [StationStat.WEALTH]: 2, [StationStat.SYSTEMS]: 1 }; // Default: 2 Wealth, 1 Systems

    const module: ModuleIntrinsic = {
        name: moduleName,
        skitPrompt: purpose,
        imagePrompt: description,
        role: roleName,
        roleDescription: roleDescription,
        baseImageUrl: '',
        defaultImageUrl: '',
        cost: finalCost,
    };

    await generateModuleImage(module, stage);

    if (!module.baseImageUrl || !module.defaultImageUrl) {
        console.error('Failed to generate images for module');
        return null;
    }

    return module;
}

export async function generateModuleImage(module: ModuleIntrinsic, stage: Stage): Promise<void> {
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
}
