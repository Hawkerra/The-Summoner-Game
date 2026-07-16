import Actor, { getStatDescription, findBestNameMatch, Stat, getRole } from "./actors/Actor";
import { Emotion, EMOTION_MAPPING } from "./actors/Emotion";
import { getStatRating, MODULE_TEMPLATES, STATION_STAT_PROMPTS, StationStat } from "./Module";
import { Stage } from "./Stage";
import { v4 as generateUuid } from 'uuid';

export enum SkitType {
    BEGINNING = 'BEGINNING',
    INTRO_CHARACTER = 'INTRO CHARACTER',
    VISIT_CHARACTER = 'VISIT CHARACTER',
    ROLE_ASSIGNMENT = 'ROLE ASSIGNMENT',
    FACTION_INTRODUCTION = 'FACTION INTRODUCTION',
    FACTION_INTERACTION = 'FACTION INTERACTION',
    NEW_MODULE = 'NEW MODULE',
    RANDOM_ENCOUNTER = 'RANDOM ENCOUNTER',
    ENTER_CRYO = 'ENTER CRYO',
    EXIT_CRYO = 'EXIT CRYO',
    DIRECTOR_MODULE = 'DIRECTOR MODULE',
}

export interface Outcome {
    type: 'actorStat' | 'stationStat' | 'roleChange' | 'factionChange' | 'factionReputation' | 'newModule' | 'newOutfit' | 'movement' | 'newActor' | 'towerActivity';
    actorId?: string; // Required for actorStat, roleChange, factionChange, newOutfit, movement, and towerActivity
    stat?: Stat | StationStat; // Required for actorStat
    amount?: number; // Required for actorStat
    role?: string; // Required for roleChange (role name or '' for None)
    factionId?: string; // Required for factionChange ('' for PARC), factionReputation, and movement (destination faction ID)
    moduleId?: string; // Required for movement (destination module ID)
    module?: { id: string; moduleName: string; roleName: string; description: string }; // Required for new module
    outfit?: { id: string; actorId: string; outfitName: string; description: string }; // Required for new outfit
    actor?: { name: string; personality: string, locationId: string, factionId?: string }; // Required for newActor
    activityLine?: string; // Required for towerActivity: the single-sentence activity description
    activityStat?: StationStat; // Optional for towerActivity: a tower stat nudged by the activity
    activityAmount?: number; // Optional for towerActivity: +1 or -1 (clamped in code)
}

export interface ScriptEntry {
    speakerId?: string;
    speaker: string;
    message: string;
    speechUrl: string; // URL of TTS audio
    actorEmotions?: {[key: string]: Emotion}; // actor name -> emotion string
    endScene?: boolean; // Whether this entry marks a scene end
    movements?: {[actorId: string]: string}; // actor ID -> new module ID
    outfitChanges?: {[actorId: string]: string}; // actor ID -> new outfit ID
    moveToModuleId?: string; // Optional ID of a module that the scene moves to as of this entry.
    outcomes?: Outcome[]; // Optional array of outcomes of this script entry, which can include stat changes, role/faction changes, or new modules/appearances.
}

export interface SkitData {
    id?: string;
    type: SkitType;
    moduleId: string;
    actorId?: string;
    initialActorLocations?: {[actorId: string]: string}; // Initial actor locations at the start of the skit.
    initialActorOutfits?: {[actorId: string]: string}; // Initial actor outfits at the start of the skit.
    script: ScriptEntry[];
    generating?: boolean;
    currentIndex?: number;
    context: any;
    summary?: string;
    outcomes?: Outcome[]; // Outcomes on the skit are implied results if the skit is ended after the current chunk of script. If the skit is continued or ended before the current final entry, these outcomes are discarded.

}

function splitScriptEntriesByLineBreaks(scriptEntries: ScriptEntry[]): ScriptEntry[] {
    const splitEntries: ScriptEntry[] = [];

    for (const entry of scriptEntries) {
        const messageLines = (entry.message || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (messageLines.length <= 1) {
            splitEntries.push(entry);
            continue;
        }

        splitEntries.push({
            ...entry,
            message: messageLines[0]
        });

        for (let i = 1; i < messageLines.length; i++) {
            splitEntries.push({
                speaker: entry.speaker,
                speakerId: entry.speakerId,
                message: messageLines[i],
                speechUrl: ''
            });
        }
    }

    return splitEntries;
}

export function generateSkitTypePrompt(skit: SkitData, stage: Stage, continuing: boolean): string {
    const actor = stage.getSave().actors[skit.actorId || ''];
    const module = stage.getSave().layout.getModuleById(skit.moduleId || '');
    const faction = stage.getSave().factions[skit.context.factionId || ''];
    const notHereText = 'This audience is conducted through a scrying projection; no representative is physically present at the tower. ';
    switch (skit.type) {
        case SkitType.BEGINNING:
            return !continuing ?
                `This scene introduces the beginning of the story. The player, ${stage.getSave().player.name}, has just been pulled into the Spire's summoning sanctum by an enchanted tome ` +
                `that identified them as matching a set of traits its late owner spent years searching for - a search left quietly running for nearly two hundred years. The tower's spirit steward, ${stage.getSave().aide.name}, greets the bewildered new arrival, ` +
                `explains that the former Magus perished long ago at the claws of a dragon, and - as ${stage.getSave().player.name} is the first living soul to set foot in the Spire since - bestows upon them the late Magus's title, effects, and responsibilities. ` +
                `${stage.getSave().aide.name} suspects, based on what they knew of their late master, that the search parameters described a prospective spouse or concubine, though they were never told the reasons and would rather not speculate further. ` +
                `They may gleefully dub ${stage.getSave().player.name} the late Magus's "magic-order bride" or "magic-order groom" (whichever suits ${stage.getSave().player.name}'s description), a tease they fully intend to keep using. ` +
                `Crucially, ${stage.getSave().aide.name} must make clear that the same one-way magic that pulled ${stage.getSave().player.name} here binds them to the tower: the Magus cannot leave, and the surrounding jungle and ruins make it moot regardless. If ${stage.getSave().player.name} wants anything done around the Spire, they will have to summon other unfortunate souls to help. ` +
                `${stage.getSave().aide.name} should then point ${stage.getSave().player.name} toward the summoning sanctum and helpfully explain the summoning process, noting that a good many souls have likely been stuck waiting in the summoning queue for ages and really ought to be pulled through soon, before they risk crumbling into arcane dust. ` +
                `${stage.getSave().aide.name} has kept the tower stable but could not conduct summonings without a Magus, so they are relieved to have someone take on the role and eager to get back to the business of the Sanctum. This scene must end before bringing any additional residents into the tower; ` +
                `this process is handled via a separate game mechanic.` :
                `Continue this introductory scene, expanding on the initial situation and context as the tower's spirit steward, ${stage.getSave().aide.name}, ` +
                `welcomes the accidentally summoned ${stage.getSave().player.name} and names them the new Magus of the otherwise-empty Spire, possibly teasing them as their late master's magic-order bride or groom, as suits their description. ` +
                `${stage.getSave().aide.name} should explain the Spire's core premise: its apparatus summons living people one way down the leyline current from their home realities, it was never built to send anyone back, and an incomplete summoning is believed to leave nothing but arcane dust - so completing each one is a mercy, and the blame for the abductions rests with the strange system the late Magus built. ` +
                `The spirit was unable to conduct summonings without a Magus, so they are eager to get back to business, drawing in new residents and helping them find their place in this world (and, perhaps someday, a way home). ` +
                `Once the concept is established, use a "[SUMMARY]" tag to summarize the scene before moving on. This scene must end before bringing any additional residents into the tower; ` +
                `this process is handled via a separate game mechanic; use the "[SUMMARY]" tag to summarize the events of this intro and end the scene before that occurs.`;
        case SkitType.INTRO_CHARACTER:
            return !continuing ? 
                `This scene will introduce a new character, ${actor.name}, fresh from the summoning circle - drawn from their home reality without their consent, with no way back for now. ${actor.name} will have no knowledge of this world. Establish their personality, their reaction to their arrival, and possibly some motivations.` :
                `Continue the introduction of ${actor.name}, expanding on their personality or motivations.`;
        case SkitType.VISIT_CHARACTER:
            return !continuing ?
                `This scene depicts the player's visit with ${actor.name} in ${actor.name}'s chambers, which have been redecorated to match ${actor.name}'s style (${actor.style}). Bear in mind that ${actor.name} is from another world, and may be unaware of details of this one. ` +
                    `Potentially explore ${actor.name}'s thoughts, feelings, or troubles in this intimate setting.` :
                `Continue this scene with ${actor.name}, potentially exploring their thoughts, feelings, or troubles in this intimate setting.`;
        case SkitType.RANDOM_ENCOUNTER:
            // Create a random plot suggestion for the encounter; choose a random present character as central
            const presentCharacters = Object.values(stage.getSave().actors).filter(a => {a.locationId === skit.moduleId && !a.factionId});
            const centralCharacter = presentCharacters.length > 0 ? presentCharacters[Math.floor(Math.random() * presentCharacters.length)] : null;
            const offStationCharacters = Object.values(stage.getSave().actors).filter(a => a.isOffSite(stage.getSave()) && !a.factionId);
            const offStationCharacter = offStationCharacters.length > 0 ? offStationCharacters[Math.floor(Math.random() * offStationCharacters.length)] : null;
            const plotSuggestions = [
                // If off-station character has been gone a couple days, they could return (perhaps unexpectedly)
                (offStationCharacter ? `${offStationCharacter.name}, who has been away on assignment, might be scheduled to return now (or perhaps is returning unexpectedly early). This scene may feature discussion about their return or depict the actual moment of return.` : null),
                // If it's been a few days since 'birth' and this character has no role nd there are muliple open roles, this character may express an interestin in an unfilledd position:
                (centralCharacter && (stage.getSave().layout.getModulesWhere(module => module.ownerId === centralCharacter.id && module.type !== 'quarters').length === 0) && (stage.getSave().day - (stage.getSave().timeline?.find(event => event.skit?.actorId === centralCharacter.id && event.skit?.type === SkitType.INTRO_CHARACTER)?.day || stage.getSave().day) >= 3) ?
                    `Having been at the Spire for a few days now, ${centralCharacter.name} may express an interest in taking on one of the unoccupied roles around the tower; consider whether any of the current options make sense: ${stage.getSave().layout.getModulesWhere(module => module.type !== 'quarters' && !module.ownerId).map(module => `${module.getAttribute('role')} (${module.getAttribute('name')})`).join(', ')}. ` : null),
                // The character could express an interest in an unowned module (if there are some unowned modules)
                (centralCharacter && Object.keys(MODULE_TEMPLATES).some(moduleType => stage.getSave().layout.getModulesWhere(module => module.type === moduleType).length === 0) ?
                    `${centralCharacter.name} may express an interest in adding a room that the Spire is currently missing; consider whether any of these options make sense: ${Object.keys(MODULE_TEMPLATES).filter(moduleType => stage.getSave().layout.getModulesWhere(module => module.type === moduleType).length === 0).map(moduleType => `${MODULE_TEMPLATES[moduleType].name}`).join(', ')}. ` : null),
                // If some faction is active and friendly, maybe talk about them:
                (Object.values(stage.getSave().factions).some(faction => faction.active && faction.reputation >= 3) ?
                    `Discuss the Spire's current relationships with ${Object.values(stage.getSave().factions).find(faction => faction.active && faction.reputation >= 3)?.name || 'an active and friendly faction'}, and any potential offers or missions that might be available to residents of the tower.` : null),
                // If some station stat is high, maybe have an event that reflects that while pushing it downward:
                (Object.values(StationStat).some(stat => (stage.getSave().stationStats?.[stat] || 3) >= 7) ?
                    `An event occurs that reflects the Spire's high ${Object.values(StationStat).find(stat => (stage.getSave().stationStats?.[stat] || 3) >= 7) || 'Systems'} stat, but also threatens to lower it.` :  '') +
                // If some station stat is low, maybe have an event that reflects that while pushing it up:
                (Object.values(StationStat).some(stat => (stage.getSave().stationStats?.[stat] || 3) <= 3) ?
                    `An event occurs that reflects the Spire's low ${Object.values(StationStat).find(stat => (stage.getSave().stationStats?.[stat] || 3) <= 3) || 'Morale'} stat, but also offers an opportunity to raise it.` :  ''),
                // If there is another patient on the PARC maybe focus on centralCharacter's relationhip or thoughts on them:
                (centralCharacter && Object.values(stage.getSave().actors).filter(actor => actor.origin === 'patient').length > 1 ?
                    `Explore ${centralCharacter.name}'s thoughts or feelings about other residents of the Spire, such as ${Object.values(stage.getSave().actors).filter(actor => actor.origin === 'patient' && actor.id !== centralCharacter.id).map(actor => actor.name)[0]}.` : null), 
                // Generic suggestion:
                `Explore the setting and what might arise from this unexpected meeting.`
            ].filter(s => s !== null);
            const randomSuggestion = plotSuggestions.length > 0 ? plotSuggestions[Math.floor(Math.random() * plotSuggestions.length)] : 'Explore the setting and what might arise from this unexpected meeting.';

            return !continuing ?
                `This scene depicts a chance encounter in the ${module?.getAttribute('name') || 'unknown'}${module?.ownerId ? ` which has been redecorated to suit ${stage.getSave().actors[module.ownerId]?.name || 'its owner'}'s style (${stage.getSave().actors[module.ownerId]?.style})` : ''}. ` +
                `Bear in mind that residents are from other worlds, and may be unaware of details of this one. ` +
                    randomSuggestion :
                `Continue this chance encounter in the ${module?.getAttribute('name') || 'unknown'}. ${randomSuggestion}.`;
        case SkitType.ROLE_ASSIGNMENT:
            return !continuing ?
                `This scene depicts an exchange between the player and ${actor.name}, following the player's decision to newly assign ${actor.name} to the role of ${skit.context.role || 'something new'} in the ${module?.getAttribute('name') || 'unknown'}. ` +
                    `Bear in mind ${actor.name}'s personality, stats, and experience within this setting (or lack thereof) as you portray their reaction and to this new role. ` :
                `Continue this scene with ${actor.name}, potentially exploring their thoughts or feelings toward their new role.`;
        case SkitType.NEW_MODULE:
            return !continuing ?
                `This scene depicts an exchange between the player and some of the residents regarding the opening of a new room, the ${module?.getAttribute('name') || 'unknown'}. ` :
                `Continue this scene, exploring the residents' thoughts or feelings toward this latest addition to the Spire.`;
        case SkitType.FACTION_INTRODUCTION:
            return (!continuing ?
                `This scene introduces a new faction that would like to do business with the Magus and the Spire: ${faction?.name || 'a secret organization'}. ` +
                notHereText +
                `Describe this new faction's appearance, motivations, and initial interactions with the player Magus and other characters present at the Translocation Circle (if any). ` :
                `This is an introductory scene for ${faction?.name || 'a secret organization'}. ` +
                notHereText);
        case SkitType.FACTION_INTERACTION:
            return (!continuing ?
                `This scene depicts an interaction between the Magus and a faction that does business with the Spire: ${faction?.name || 'a secret organization'}. ` +
                notHereText :
                `Continue this scene between the Magus and a representative for ${faction?.name || 'a secret organization'}'s. ` + 
                notHereText);
        case SkitType.ENTER_CRYO:
            return `This scene depicts the Magus's decision to send ${actor.name} home through the Homeward Gate, back to their own reality under a recall bond that allows the Spire to call them back at will. ` +
                `Explore ${actor.name}'s thoughts and feelings about going home - and about the bond - as well as any final exchanges with the player or other characters present. ` +
                `The decision will not be reversed during this skit; it is a foregone conclusion.`;
        case SkitType.EXIT_CRYO:
            return `This scene depicts the Magus's decision to recall ${actor.name} through the Homeward Gate after ${skit.context.days} days back in their home reality. ` +
                `Explore ${actor.name}'s thoughts and feelings about the recall and their time away, as well as any initial exchanges with the player or other characters present. `;
        case SkitType.DIRECTOR_MODULE:
            return `This scene takes place in the Magus's personal chamber. This scene could encompass all manner of interactions, from introspective moments alone to exchanges with other characters. `;
        default:
            return '';
    }
}

function buildScriptLog(skit: SkitData, additionalEntries: ScriptEntry[] = [], stage?: Stage): string {
    const formatSignedAmount = (amount?: number): string => {
        const value = amount || 0;
        return `${value >= 0 ? '+' : ''}${value}`;
    };

    const resolveActorName = (actorId?: string): string => {
        if (!actorId) return 'Unknown Character';
        if (actorId === 'player') return stage?.getSave().player.name || 'Player';
        return stage?.getSave().actors[actorId]?.name || actorId;
    };

    const resolveFactionName = (factionId?: string): string => {
        if (!factionId) return 'Spire';
        return stage?.getSave().factions[factionId]?.name || factionId;
    };

    const formatOutcomeTag = (outcome: Outcome): string | null => {
        switch (outcome.type) {
            case 'actorStat': {
                if (!outcome.stat) return null;
                return `[${resolveActorName(outcome.actorId)}: ${String(outcome.stat)} ${formatSignedAmount(outcome.amount)}]`;
            }
            case 'stationStat': {
                if (!outcome.stat) return null;
                return `[STATION: ${String(outcome.stat)} ${formatSignedAmount(outcome.amount)}]`;
            }
            case 'factionReputation': {
                return `[FACTION: ${resolveFactionName(outcome.factionId)} ${formatSignedAmount(outcome.amount)}]`;
            }
            case 'factionChange': {
                return `[${resolveActorName(outcome.actorId)}: JOINED ${resolveFactionName(outcome.factionId)}]`;
            }
            case 'roleChange': {
                const roleName = outcome.role && outcome.role.trim().length > 0 ? outcome.role : 'None';
                return `[${resolveActorName(outcome.actorId)}: ROLE ${roleName}]`;
            }
            case 'newModule': {
                if (!outcome.module?.moduleName || !outcome.module?.roleName || !outcome.module?.description) return null;
                return `[NEW MODULE: ${outcome.module.moduleName} | ROLE ${outcome.module.roleName} | DESCRIPTION ${outcome.module.description}]`;
            }
            case 'newOutfit': {
                if (!outcome.outfit?.outfitName || !outcome.outfit?.description) return null;
                return `[NEW APPEARANCE: ${resolveActorName(outcome.actorId || outcome.outfit.actorId)} | NAME ${outcome.outfit.outfitName} | DESCRIPTION ${outcome.outfit.description}]`;
            }
            case 'newActor': {
                if (!outcome.actor?.name || !outcome.actor?.personality || !outcome.actor?.locationId) return null;
                const locationName = stage?.getSave().layout.getModuleById(outcome.actor.locationId)?.getAttribute('name')
                    || resolveFactionName(outcome.actor.locationId)
                    || outcome.actor.locationId;
                const factionName = outcome.actor.factionId ? resolveFactionName(outcome.actor.factionId) : 'No Faction';
                return `[NEW CHARACTER: ${outcome.actor.name} | LOCATION ${locationName} | FACTION ${factionName} | DESCRIPTION ${outcome.actor.personality}]`;
            }
            default:
                return null;
        }
    };

    return ((skit.script && skit.script.length > 0) || additionalEntries.length > 0) ?
        [...skit.script, ...additionalEntries].map(e => {
            // Find the best matching emotion key for this speaker
            const speakerName = (stage?.getSave().actors[e.speakerId || '']?.name || (e.speakerId == 'player' ? stage?.getSave().player.name : '') || e.speaker || 'Unknown Speaker');
            const emotionKeys = Object.keys(e.actorEmotions || {});
            const candidates = emotionKeys.map(key => ({ name: key }));
            const bestMatch = findBestNameMatch(speakerName, candidates);
            const matchingKey = bestMatch?.name;
            const emotionText = matchingKey ? ` [${matchingKey} expresses ${e.actorEmotions?.[matchingKey]}]` : '';
            const wearsText = Object.entries(e.outfitChanges || {}).map(([actorId, outfitId]) => {
                const actor = stage?.getSave().actors?.[actorId];
                const outfit = actor?.outfits.find(o => o.id === outfitId);
                return actor && outfit ? ` [${actor.name} wears ${outfit.name}]` : '';
            }).join('');

            const messageLine = `[${speakerName} turn]${emotionText}${wearsText} ${e.message}`.trim();
            const outcomeTags = (e.outcomes || [])
                .map(formatOutcomeTag)
                .filter((tag): tag is string => !!tag);

            return outcomeTags.length > 0 ? `${messageLine}\n${outcomeTags.join('\n')}` : messageLine;
        }).join('\n')
        : '(None so far)';
}

/**
 * Resolve the current scene module ID at a point in the script.
 * @param skit - The skit data
 * @param upToIndex - Process entries up to (but not including) this index. -1 means process all.
 */
function getCurrentSceneModuleId(skit: SkitData, upToIndex: number = -1): string {
    let currentSceneModuleId = skit.moduleId;
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);

    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.moveToModuleId) {
            currentSceneModuleId = entry.moveToModuleId;
        }
    }

    return currentSceneModuleId;
}

/**
 * Helper function to determine the current set of actors present in a module at a given script index.
 * Walks through the script from the beginning, applying movement changes.
 * @param skit - The skit data
 * @param moduleId - The module to check presence in (defaults to skit.moduleId)
 * @param upToIndex - Process script entries up to (but not including) this index. -1 means process all.
 * @returns Set of actor IDs currently present in the module
 */
function getCurrentActorsInScene(skit: SkitData, moduleId?: string, upToIndex: number = -1): Set<string> {
    const targetModuleId = moduleId || getCurrentSceneModuleId(skit, upToIndex);
    // Start with initial actor locations
    const currentLocations = {...(skit.initialActorLocations || {})};
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);
    
    // Apply movements from script entries
    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.movements) {
            Object.entries(entry.movements).forEach(([actorId, newLocationId]) => {
                currentLocations[actorId] = newLocationId;
            });
        }
    }
    
    // Return actors at the target module
    const presentActors = new Set<string>();
    Object.entries(currentLocations).forEach(([actorId, locationId]) => {
        if (locationId === targetModuleId) {
            presentActors.add(actorId);
        }
    });
    
    return presentActors;
}

/**
 * Build a map of actorId -> current location at a point in the script.
 */
function getCurrentActorLocations(skit: SkitData, upToIndex: number = -1): {[actorId: string]: string} {
    const currentLocations = {...(skit.initialActorLocations || {})};
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);

    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.movements) {
            Object.entries(entry.movements).forEach(([actorId, newLocationId]) => {
                currentLocations[actorId] = newLocationId;
            });
        }
    }

    return currentLocations;
}

/**
 * Build a map of actorId -> current outfit at a point in the script.
 */
function getCurrentActorOutfits(skit: SkitData, stage: Stage, upToIndex: number = -1): {[actorId: string]: string} {
    const currentOutfits = {
        ...Object.values(stage.getSave().actors).reduce((acc, actor) => {
            acc[actor.id] = actor.outfitId;
            return acc;
        }, {} as {[actorId: string]: string}),
        ...(skit.initialActorOutfits || {})
    };
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);

    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.outfitChanges) {
            Object.entries(entry.outfitChanges).forEach(([actorId, outfitId]) => {
                currentOutfits[actorId] = outfitId;
            });
        }
    }

    return currentOutfits;
}

/**
 * Build a map of actorName -> current emotion at a point in the script.
 */
function getCurrentActorEmotions(skit: SkitData, upToIndex: number = -1): {[actorName: string]: Emotion} {
    // All actors start neutral; map can be initialized empty.
    const currentEmotions = {} as {[actorName: string]: Emotion};
    const endIndex = Math.min(skit.script.length, upToIndex === -1 ? skit.script.length : upToIndex);
    for (let i = 0; i < endIndex; i++) {
        const entry = skit.script[i];
        if (entry?.actorEmotions) {
            Object.entries(entry.actorEmotions).forEach(([actorName, emotion]) => {
                currentEmotions[actorName] = emotion;
            });
        }
    }

    return currentEmotions;
}

function processSceneMovementTag(rawTag: string, stage: Stage): string | null {
    const sceneMovementRegex = /^SCENE\s+MOVES\s+to\s+(.+)$/i;
    const sceneMovementMatch = sceneMovementRegex.exec(rawTag);
    if (!sceneMovementMatch) return null;

    const destinationName = sceneMovementMatch[1].trim();
    const modules = stage.getLayout().getAllModulesWhere(m => !!m.getAttribute('name'));
    const modulesWithName = modules.map(m => ({
        name: `${m.getAttribute('name') || ''} ${m.type}`.trim(),
        module: m
    }));
    const targetModuleMatch = findBestNameMatch(destinationName, modulesWithName);

    if (!targetModuleMatch) {
        console.warn(`Could not find module matching scene move destination: ${destinationName}`);
        return null;
    }

    console.log(`Scene movement detected: scene moves to ${targetModuleMatch.module.getAttribute('name')} (${targetModuleMatch.module.id})`);
    return targetModuleMatch.module.id;
}

/**
 * Process an appearance tag and return actor/outfit IDs if valid.
 * Format: [Character Name wears Appearance Name]
 */
function processWearTag(rawTag: string, stage: Stage): { actorId: string; outfitId: string } | null {
    const wearRegex = /^([^[\]]+?)\s+wears\s+(.+)$/i;
    const wearMatch = wearRegex.exec(rawTag);
    if (!wearMatch) return null;

    const characterName = wearMatch[1].trim();
    const appearanceName = wearMatch[2].trim();
    const allActors: Actor[] = Object.values(stage.getSave().actors);
    const matchedActor = findBestNameMatch(characterName, allActors);

    if (!matchedActor) {
        console.warn(`Could not find actor matching wears tag character: ${characterName}`);
        return null;
    }

    const matchedOutfit = findBestNameMatch(
        appearanceName,
        matchedActor.outfits.map(outfit => ({ name: outfit.name, outfit }))
    );

    if (!matchedOutfit) {
        console.warn(`Could not find outfit matching wears tag appearance "${appearanceName}" for ${matchedActor.name}; discarding tag.`);
        return null;
    }

    return { actorId: matchedActor.id, outfitId: matchedOutfit.outfit.id };
}

/**
 * Process a movement tag and return the destination module/faction ID if valid.
 * @param rawTag - The raw tag content (without brackets)
 * @param stage - The Stage object for accessing save data and layout
 * @param skit - The current skit data
 * @returns An object with actorId and destinationId, or null if invalid
 */
function processMovementTag(rawTag: string, stage: Stage, skit: SkitData | undefined, currentSceneModuleId?: string): { actorId: string; destinationId: string } | null {
    // Look for movement tags: [Character Name moves to Module Name]
    const movementRegex = /^([^[\]]+?)\s+moves\s+to\s+(.+)$/i;
    const movementMatch = movementRegex.exec(rawTag);
    if (!movementMatch) return null;
    
    const characterName = movementMatch[1].trim();
    const destinationName = movementMatch[2].trim();
    
    // Find matching actor using findBestNameMatch
    const allActors: Actor[] = Object.values(stage.getSave().actors);
    const matched = findBestNameMatch(characterName, allActors);
    if (!matched) {
        console.warn(`Could not find actor matching: ${characterName}`);
        return null;
    }
    
    // Resolve destination module
    let destinationModuleId = '';
    
    // Check if it's a quarters reference (e.g., "Susan's quarters" or "quarters")
    const quartersMatch = /^(.+?)'s\s+(?:quarters|chambers)$/i.exec(destinationName);
    if (quartersMatch) {
        // Specific character's quarters
        const quartersOwnerName = quartersMatch[1].trim();
        const quartersOwner = findBestNameMatch(quartersOwnerName, allActors);
        if (quartersOwner) {
            // Find the quarters module owned by this actor
            const quartersModule = stage.getLayout().getAllModulesWhere(m => 
                m.type === 'quarters' && m.ownerId === quartersOwner.id
            )[0];
            if (quartersModule) {
                destinationModuleId = quartersModule.id;
            } else {
                console.warn(`${quartersOwner.name} has no quarters assigned`);
            }
        } else {
            console.warn(`Could not find quarters owner: ${quartersOwnerName}`);
        }
    } else if (destinationName.toLowerCase().endsWith('quarters') || destinationName.toLowerCase().endsWith('chambers') || ['home', 'their room', 'another module', 'another room', 'elsewhere'].includes(destinationName.toLowerCase())) {
        // Character's own quarters (if they have any)
        const ownQuarters = stage.getLayout().getAllModulesWhere(m => 
            m.type === 'quarters' && m.ownerId === matched.id
        )[0];
        if (ownQuarters) {
            destinationModuleId = ownQuarters.id;
        } else {
            console.warn(`${matched.name} has no quarters assigned`);
        }
    } else if (['parc', 'spire', 'tower'].includes(destinationName.toLowerCase())) {
        // Move to the translocation circle by default for vague "tower" references
        destinationModuleId = stage.getSave().layout.getAllModulesWhere(module => module.type === 'comms')[0]?.id || skit?.moduleId || '';
    } else if (skit && ['here', 'this module', 'this room', 'this location', 'this area', 'current module', 'current room'].includes(destinationName.toLowerCase())) {
        // Move to current skit module
        destinationModuleId = currentSceneModuleId || getCurrentSceneModuleId(skit, -1) || skit.moduleId || '';
    } else {
        // Try to find a module by type name
        // Use findBestNameMatch:
        const modules = stage.getLayout().getAllModulesWhere(m => !!m.getAttribute('name'));
        const modulesWithName = modules.map(m => ({ name: m.getAttribute('name') || '', module: m }));
        const targetModuleMatch = findBestNameMatch(destinationName, modulesWithName);
        if (targetModuleMatch) {
            const targetModule = targetModuleMatch.module;
            destinationModuleId = targetModule.id;
            console.log(`Movement detected: ${matched.name} moves to module ${targetModule.getAttribute('name')} (${targetModule.id})`);
        } else {
            // If no module found, check if it matches a faction name using best match logic
            console.log(`No module matched for destination: ${destinationName}, checking factions.`);
            const matchingFaction = findBestNameMatch(
                destinationName,
                Object.values(stage.getSave().factions)
            );
            if (matchingFaction) {
                destinationModuleId = matchingFaction.id;
                console.log(`Movement detected: ${matched.name} leaves to faction ${matchingFaction.name} (${matchingFaction.id})`);
            } else {
                console.warn(`Could not find module or faction matching: ${destinationName}`);
            }
        }
    }
    
    // Return movement data if valid destination found
    if (destinationModuleId) {
        if (!stage.getSave().factions[destinationModuleId]) {
            // Only log for modules, not factions (already logged above)
            console.log(`Movement detected: ${matched.name} moves to ${destinationName} (${destinationModuleId})`);
        }
        return { actorId: matched.id, destinationId: destinationModuleId };
    }
    
    return null;
}

// Weird place for this because I'm using it all over.
export function buildPromptSegment(title: string, content: string) {
    return content.trim() ? `${title}: [\n${content.trim()}\n]\n\n` : '';
}

export function buildEventHistory(stage: Stage, depth: number) {
    let pastEvents = stage.getSave().timeline || [];
    pastEvents = pastEvents.filter((v, index) => index > (pastEvents.length || 0) - depth);

    if (pastEvents.length === 0) {
        return '';
    }
    return pastEvents.map((v, index) =>  {
                if (v.skit) {
                    const module = stage.getSave().layout.getModuleById(v.skit.moduleId || '');
                    const moduleOwner = module?.ownerId ? stage.getSave().actors[module.ownerId] : null;
                    const moduleDescription = module ? (module.type === 'quarters' && moduleOwner ? `${moduleOwner.name}'s quarters` : `the ${module.getAttribute('name')}`) : 'an unknown location';
                    return ((!v.skit.summary || index == pastEvents.length - 1) ?
                        (`\n\nScript of Scene in ${moduleDescription} (${stage.getSave().day - v.day}) days ago:\n` +
                        `${buildScriptLog(v.skit, [], stage)}`) :
                        (`\n\nSummary of scene in ${moduleDescription} (${stage.getSave().day - v.day}) days ago:\n` + v.skit.summary)
                        )
                } else {
                    return `\n\nAction ${stage.getSave().day - v.day} days ago: ${v.description || ''}`;
                }
    }).join('');
}

export function buildSkitPrompt(skit: SkitData, stage: Stage, historyLength: number, instruction: string): string {
    const playerName = stage.getSave().player.name;
    const save = stage.getSave();

    // Initialize skit with all actor locations if this is the first generation
    if (skit.script.length === 0) {
        skit.initialActorLocations = {};
        skit.initialActorOutfits = {};
        Object.values(save.actors).forEach(a => {
            skit.initialActorLocations![a.id] = a.locationId;
            skit.initialActorOutfits![a.id] = a.outfitId;
        });
    }

    const currentActorOutfitIds = getCurrentActorOutfits(skit, stage, -1);

    // Determine present and absent actors for this moment in the skit (as of the last entry in skit.script):
    const currentSceneModuleId = getCurrentSceneModuleId(skit, -1);
    const presentActorIds = getCurrentActorsInScene(skit, currentSceneModuleId, -1);
    const presentPatients = Object.values(save.actors).filter(a => presentActorIds.has(a.id));
    const absentPatients = Object.values(save.actors).filter(a => !presentActorIds.has(a.id) && save.aide.actorId != a.id && !['cryo', 'dead'].includes(a.locationId) && !a.isOffSite(save));
    const cryoPatients = Object.values(save.actors).filter(a => a.locationId === 'cryo');
    const awayPatients = Object.values(save.actors).filter(a => !a.factionId && a.isOffSite(save));

    // Update participation counts if this is the start of the skit
    if (skit.script.length === 0) {
        // Increment participation count for present actors
        presentPatients.forEach(a => {
            a.participations = (a.participations || 0) + 1;
        });
    }

    const historyPrompt = buildEventHistory(stage, historyLength);
    const module = save.layout.getModuleById(currentSceneModuleId || '');
    const moduleOwner = module?.ownerId ? save.actors[module.ownerId] : null;
    const faction = skit.context.factionId ? save.factions[skit.context.factionId] : null;
    const factionRepresentative = faction ? save.actors[faction.representativeId || ''] : null;
    const stationAide = save.actors[save.aide.actorId || ''];

    let fullPrompt = `{{messages}}` +
        buildPromptSegment('Premise', `This is a fantasy visual novel game set in an isolated wizard's tower that summons living people from other realities: ` +
        `the Sanctum for Planar Intake, Restoration, and Enrichment - the Spire. ` +
        `The thrust of the game positions the player character, ${playerName}, as the Magus of the Spire, interacting with the tower's residents as they navigate this strange arcane world together. ` +
        `The Spire stands upon a great leyline nexus amid a snarl of hostile jungle and ancient ruins; its apparatus draws living people one way down the leyline current from their home realities, without their consent. It was never built to send anyone back, and an incomplete summoning is believed to leave nothing but arcane dust, so completing each one is a mercy - the blame lies with the strange system the late Magus built. The Spire is also the only place from which a way home might ever be researched, a long-term hope for many residents. It serves as both sanctuary and containment for its diverse inhabitants, who hail from various alternate realities. ` +
        `${playerName} is technically as much a ward of the tower as anyone, having been pulled here by an enchanted tome, and every means of leaving the tower offers appears to refuse the Magus alone; still, they hold the title and its authority (and may take residents on as staff). As a result, the Spire may feel a bit lonely or alienating at times. ` +
        `Much of the day-to-day upkeep of the tower is handled by its spirit steward, ${save.aide.name || 'the tower spirit'}, and various servitor charms and minor animations, enabling ${playerName} to focus on the residents' care and adjustment.`) +
        buildPromptSegment('Narrative Tone', save.tone || stage.TONE_MAP['Original']) +
        buildPromptSegment('Tower Stats', save.stationStats ? (
            Object.values(StationStat).map(stat => `  ${stat} (${save.stationStats?.[stat] || 3}): ${STATION_STAT_PROMPTS[stat][getStatRating(save.stationStats?.[stat] || 3)]}`).join('\n')
        ) : '') +
        (
            // If module is a quarters, present it as "Owner's quarters" or "vacant quarters": module type otherwise.
            buildPromptSegment('Rooms and Roles', save.layout.getAllModulesWhere(module => true).map(module => module.type == 'quarters' ? 
                (module.ownerId ? `  ${save.actors[module.ownerId]?.name || 'Unknown'}'s Chambers` : '  Vacant Chambers') : 
                `  ${module.getAttribute('name')} ${module.getAttribute('role') ? `(${module.getAttribute('role')} : ${module.ownerId ? `${save.actors[module.ownerId]?.name || 'Unknown'}` : 'None'})` : ''}`).join('\n'))
        ) +
        buildPromptSegment(`${playerName}'s profile`, save.player.description) +
        (stationAide ? buildPromptSegment('Tower Spirit profile', (presentActorIds.has(stationAide.id) ? `The tower's spirit steward, ${stationAide.name}, is active in the scene.` : `\n\nThe tower's spirit steward, ${stationAide.name}, remains absent from the scene unless called upon, though they can manifest nearly anywhere in the Spire.`) + `\n${stationAide.profile}`) : '') +
        // List non-present characters for reference; just need description and profile:
        buildPromptSegment('Absent Characters (Available to Add)', absentPatients.map(actor => {
            // Roll name and current location
            const roleModule = stage.getLayout().getAllModulesWhere((m: any) => 
                m && m.type !== 'quarters' && m.ownerId === actor.id
            )[0];
            const module = save.layout.getModuleById(actor.locationId);
            const locationString = module ? (module.type === 'quarters' ? (module.ownerId === actor.id ? ' Their Quarters' : (`${save.actors[module.ownerId || ''] || 'Someone'}'s Quarters`)) : module.getAttribute('name')) : 'Unknown';
            const currentOutfitId = currentActorOutfitIds[actor.id] || actor.outfitId;
            const currentOutfit = actor.getOutfitById(currentOutfitId);
            const otherOutfits = actor.outfits.filter(o => o.id !== currentOutfitId && o.emotionPack['neutral']);
            return `  ${actor.name}\n    Current Appearance (${currentOutfit.name}): ${actor.getDescription(currentOutfitId)}\n` +
                (otherOutfits.length > 0 ? `    Other Appearances: ${otherOutfits.map(o => o.name).join(', ')}\n` : '') +
                `    Profile: ${actor.profile}\n    Role: ${roleModule?.getAttribute('role') || 'Resident'}\n    Location: ${locationString}`;
        }).join('\n')) +
        // List away characters for reference; just need description and profile:
        buildPromptSegment('Away Characters (On Assignment Away from the Spire)', awayPatients.map(actor => {
            // Just role name and faction on loan to
            const roleModule = stage.getLayout().getAllModulesWhere((m: any) => 
                m && m.type !== 'quarters' && m.ownerId === actor.id
            )[0];
            const atFaction = save.factions[actor.locationId];
            const currentOutfitId = currentActorOutfitIds[actor.id] || actor.outfitId;
            const currentOutfit = actor.getOutfitById(currentOutfitId);
            return `  ${actor.name}\n    Current Appearance (${currentOutfit.name}): ${actor.getDescription(currentOutfitId)}\n` +
                // (otherOutfits.length > 0 ? `    Other Appearances: ${otherOutfits.map(o => o.name).join(', ')}\n` : '') + // Unnecessary for absent characters
                `    Profile: ${actor.profile}\n    Role: ${roleModule?.getAttribute('role') || 'Resident'}\n    On Assignment to: ${atFaction?.name || 'Unknown Faction'}`;
        }).join('\n')) +
        
        // List cryo characters for reference; just need description and profile:
        buildPromptSegment('Characters Away Home Through the Gate (Unavailable Unless Recalled)', cryoPatients.map(actor => {
            const entranceEvent = stage.getSave().timeline?.find(event => event.skit?.actorId === actor.id && event.skit?.type === SkitType.ENTER_CRYO);
            const entranceDate = entranceEvent ? entranceEvent.day : stage.getSave().day;
            const currentOutfitId = currentActorOutfitIds[actor.id] || actor.outfitId;
            const currentOutfit = actor.getOutfitById(currentOutfitId);
            return `  ${actor.name}\n    Current Appearance (${currentOutfit.name}): ${actor.getDescription(currentOutfitId)}\n` +
                // (otherOutfits.length > 0 ? `    Other Appearances: ${otherOutfits.map(o => o.name).join(', ')}\n` : '') + // Unnecessary for cryo characters
                `    Profile: ${actor.profile}\n    Days Home: ${save.day - entranceDate}`;
        }).join('\n')) +

        // List stat meanings, for reference:
        buildPromptSegment('Stat Explanations', Object.values(Stat).map(stat => `${stat.toUpperCase()}: ${getStatDescription(stat)}`).join('\n')) +
        
        buildPromptSegment('Scene Prompt', `${generateSkitTypePrompt(skit, stage, skit.script.length > 0)}\n`) +
        (faction ? buildPromptSegment(`${faction.name} Details`, `${faction.name} Details: ${faction.description}\n${faction.name} Aesthetic:\n  ${faction.visualStyle}` +
            (factionRepresentative ? `\n${faction?.name || 'The faction'}'s representative, ${factionRepresentative.name}, appears on-screen. Their description: ${factionRepresentative.getDescription(currentActorOutfitIds[factionRepresentative.id] || factionRepresentative.outfitId)}` :
                'They have no designated liaison for this communication; any characters introduced during this scene will be transient.')) : '') +
        (faction ? buildPromptSegment(`${faction.name} Relationship`, `This skit may explore the nature of this faction's relationship with an intentions for the Magus, the Spire, or its residents. ` +
            `Typically, this and other factions contact the Spire to express interest in making offers for resources, information, or residents. ` +
            `The faction could have a temporary job to offer a resident, or suggest an exchange of resources or favors. Or they could have a permanent role in mind for an ideal candidate resident. ` +
            `If a resident is already on-loan to this faction, use this opportunity to update the Magus on their status, depict the resident's return, or convert them to a permanent placement with the faction. ` +
            `Remember to use appropriate tags when moving characters into or out of the tower in the skit. `) : '') +

        buildPromptSegment(`Known Factions`, `${Object.values(stage.getSave().factions).filter(faction => faction.active && faction.reputation > 0).map(faction => `${faction.name}: ${faction.getReputationDescription()}`).join('\n  ')}`) +
        ((historyLength > 0 && historyPrompt) ? 
                // Include last few skit scripts for context and style reference; use summary except for most recent skit or if no summary.
                buildPromptSegment('Recent Events and Skits', historyPrompt) : '') +
        (module ? buildPromptSegment('Current Room', `The following scene is set in ` +
            `${module.type === 'quarters' ? `${moduleOwner ? `${moduleOwner.name}'s` : 'a vacant'} chambers` : 
            `the ${module.getAttribute('name') || 'Unknown'}`}. ${module.getAttribute('skitPrompt') || 'No description available.'}`) : '') +
        // List characters who are here, along with full stat details:
        buildPromptSegment('Present Characters (Currently in the Scene)', `${presentPatients.map(actor => {
            const roleModule = stage.getLayout().getAllModulesWhere((m: any) => 
                m && m.type !== 'quarters' && m.ownerId === actor.id
            )[0];
            const birthDay = save.timeline?.find(event => event.skit?.actorId === actor.id && event.skit?.type === SkitType.INTRO_CHARACTER)?.day || save.day;
            const currentOutfitId = currentActorOutfitIds[actor.id] || actor.outfitId;
            const currentOutfit = actor.getOutfitById(currentOutfitId);
            const otherOutfits = actor.outfits.filter(o => o.id !== currentOutfitId && o.emotionPack['neutral']);
            return `  ${actor.name}\n    Current Appearance (${currentOutfit.name}): ${actor.getDescription(currentOutfitId)}\n` +
                (otherOutfits.length > 0 ? `    Other Appearances: ${otherOutfits.map(o => o.name).join(', ')}\n` : '') +
                `    Profile: ${actor.profile}\n    Character Arc: ${actor.characterArc || 'Undetermined'}\n    Days at the Spire: ${save.day - birthDay}\n` +
                (roleModule ? `    Role: ${roleModule.getAttribute('role') || 'Resident'} (${actor.heldRoles[roleModule.getAttribute('role') || 'Resident'] || 0} days)\n` : '') +
                `    Role Description: ${roleModule?.getAttribute('roleDescription') || 'This character has no assigned role at the Spire. They are to focus upon their own needs.'}\n` +
                `    Stats:\n      ${Object.entries(actor.stats).map(([stat, value]) => `${stat}: ${value}`).join(', ')}`}).join('\n')}`) +
        `\n${instruction}`;
    return fullPrompt;
}

function buildOutcomeTagRules(exampleActor: string): string {return `\n#Character Stat Changes:#\n` +
                            `Identify any changes to character stats implied by this entry. For each change, output a line in the following format:\n` +
                            `[<characterName>: <stat> +<value>(, ...)]` +
                            `Where <stat> is the name of the stat to be changed, and <value> is the amount to increase or decrease the stat by (positive or negative). ` +
                            `Multiple stat changes can be included in a single tag, separated by commas. Similarly, multiple character tags can be provided in the output.` +
                            `Full Examples:\n` +
                            `[${exampleActor}: brawn +1, charm +2]\n` +
                            `[${exampleActor}: lust -1]\n` +

                            `\n#Tower Stat Changes:#\n` +
                            `Identify any changes to the Spire's tower stats implied or indicated by each entry. Ignore lines from the entry that simply illustrate the current stats, ` +
                            `and instead focus on changes or developments in the Spire's situation or operations. For each change, output a line in the following format:\n` +
                            `[STATION: <stat> +<value>(, ...)]` +
                            `Where <stat> is the name of the tower stat to be changed, and <value> is the amount to increase or decrease the stat by (positive or negative). ` +
                            `Multiple stat changes can be included in a single tag, separated by commas.` +
                            `Full Examples:\n` +
                            `[STATION: Arcanum +2, Comfort +1]\n` +
                            `[STATION: Security -1]\n` +

                            `\n#Tower Activity:#\n` +
                            `Separately, report on ONE resident of the Spire (or the tower's bound spirit) who did NOT appear in this scene, describing something they got up to elsewhere in the tower this turn. ` +
                            `The subject MUST be either a current resident of the tower itself or the tower's bound spirit - NEVER a visiting faction representative, a member of an outside faction, or anyone away from the Spire. ` +
                            `Choose a resident from the roster who was absent from the scene; favor someone with an assigned role, and let their personality and role shape what they did. ` +
                            `Output EXACTLY ONE line in this exact format:\n` +
                            `[ACTIVITY: <characterName> | <a single short sentence, no more than about 20 words> | <TAG>]\n` +
                            `The <TAG> field is REQUIRED and must be one of: a single tower stat (Arcanum, Comfort, Provision, Security, Harmony, or Wealth) nudged by exactly +1 or -1, OR the literal text "No stat change". ` +
                            `MOST activities should use "No stat change" - only OCCASIONALLY, when the activity clearly and notably helped or harmed the tower, use a stat change instead. It should feel like an occasional surprise, not routine. ` +
                            `Do NOT begin the sentence with a number or digit. Keep the sentence to a single line - never a paragraph. Only ONE [ACTIVITY] tag total.\n` +
                            `Full Examples:\n` +
                            `[ACTIVITY: Mara | Spent the afternoon reorganizing the apothecary shelves, muttering about everyone's poor labeling. | Comfort +1]\n` +
                            `[ACTIVITY: Silas | Was found asleep in the Great Hall again, having missed his own watch shift. | Security -1]\n` +
                            `[ACTIVITY: Wren | Practiced summoning-circle calligraphy for hours, purely for the joy of it. | No stat change]\n` +

                            `\n#Faction Reputation Changes:#\n` +
                            `Identify any changes to the Spire's reputation with factions implied by each entry. For each change, output a line in the following format:\n` +
                            `[FACTION: <factionName> +<value>]\n` +
                            `Where <factionName> is the name of the faction with whom the Spire's reputation is changing, and <value> is the amount to increase or decrease the reputation by (positive or negative). ` +
                            `Reputation is a value between 1 and 10, representing the faction's opinion of the Spire, and changes are incremental. If the faction is cutting ties with the Spire, provide a large negative value. ` +
                            `Multiple faction tags can be provided in the output if, for instance, improving in the esteem of one faction inherently reduces the opinion of a rival.` +
                            `Full Examples:\n` +
                            `[FACTION: Stellar Concord +1]\n` +
                            `[FACTION: Shadow Syndicate -2]\n` +

                            `\n#Character Faction Change:#\n` +
                            `If a character has changed faction affiliations in an entry, output a line in the following format:\n` +
                            `[CHARACTER NAME: JOINED <factionName or SPIRE>]\n` +
                            `Where <factionName or SPIRE> is the name of the faction the character has joined, or "SPIRE" if they have left a faction to join the tower itself. ` +
                            `Full Examples:\n` +
                            `[${exampleActor}: JOINED Stellar Concord]\n` +
                            `[${exampleActor}: JOINED SPIRE]` +
                            `\n\nThis tag indicates an official change in allegiance/affiliation/ownership/possession of the named character. ` +
                            `Consider this tag when the script depicts: ` +
                            `\n - A resident taking a permanent position with a faction.` +
                            `\n - A faction representative defecting to the Spire.` +
                            `\n - A character being formally recruited or dismissed.` +
                            `\n - A character being sold to or imprisoned by a faction.\n` +

                            `\n#Character Role Change:#\n` +
                            `If a character's role in the tower changes as a result of this entry (e.g., a resident has been assigned to a staff position), output a line in the following format:\n` +
                            `[CHARACTER NAME: ROLE <roleName>]\n` +
                            `Where <roleName> is the name of the new role assigned to the character. ` +
                            `Full Example:\n` +
                            `[${exampleActor}: ROLE Herald]\n` +
                            `[${exampleActor}: ROLE None]\n` +
                            `The role name must directly match an existing role defined by the tower's current rooms (or "None," if a character's role is being removed by this tag).\n` +

                            `\n#Character Movement/Departure:#\n` +
                            `If the content depicts or implies that a character has departed the Spire or moved to a different faction (or such departure appears imminent), include final movement tags here.` +
                            `[CHARACTER NAME moves to <room name|faction name>]\n` +
                            `Full Example:\n` +
                            `[${exampleActor} moves to Stellar Concord]\n` +
                            `[${exampleActor} moves to Translocation Circle]\n` +
                            `These tags ensure that the gamestate location data reflects the scene's events; it is especially important to include movement tags for any characters leaving on or returning from missions; ` +
                            `remember that moving "to" a faction is an abstract location representing a task on that faction's behalf, whether that task is at the faction location or elsewhere entirely.` +

                            `\n#New Module Definition:#\n` +
                            `If the content involves the conception or design of a new room for the tower ` +
                            `(e.g., a character requests a specific new space, or a new role is being established which requires a dedicated workspace, or a character discusses plans for a new module), ` +
                            `this tag is used to define the proposed room name and a new resident role to go with it; both the name and role must be distinct from existing rooms and roles.\n` +
                            `[NEW MODULE: <moduleName> | ROLE <roleName> | DESCRIPTION <briefDescription>]\n` +
                            `Full Example:\n` +
                            `[NEW MODULE: Alchemy Lab | ROLE Alchemist | DESCRIPTION A cluttered laboratory of bubbling alembics and reagent shelves for brewing potions and remedies.]\n` +
                            `[NEW MODULE: Music Room | ROLE Bard | DESCRIPTION A cozy chamber of instruments and comfortable seating for song and stories among the residents.]\n` +
                            `This tag allows the game engine to create new rooms dynamically based on entry events, expanding the tower's capabilities and accommodating new character roles as needed.\n` +

                            `\n#New Appearance Definition:#\n` +
                            `If the content establishes a new look for a character(s) (for example, a marked physical change) or suggests the need for an alternative appearance (such as a new uniform)—which is not represented in their current "Other Appearances" list—, utilize this tag for each new look:\n` +
                            `[NEW APPEARANCE: <characterName> | NAME <appearanceName> | DESCRIPTION <physicalDescription>]\n` +
                            `Full Example:\n` +
                            `[NEW APPEARANCE: ${exampleActor} | NAME Expedition Leathers | DESCRIPTION Reinforced leather armor over dark traveling clothes with a weathered cloak and sturdy gloves.]\n` +
                            `The DESCRIPTION should focus on concise physical details, including intrinsic character details: body type, skin tone, hair style, eye color, etc., in addition to clothing elements and accessories.\n` +

                            `\n#New Character Definition:#\n` +
                            `If the content introduces a new character to the story, include a tag in the following format:\n` +
                            `[NEW CHARACTER: <characterName> | LOCATION <moduleName or factionName> | FACTION <factionName> | DESCRIPTION <briefDescription>]\n` +
                            `Full Example:\n` +
                            `[NEW CHARACTER: Alex Mercer | LOCATION Some Faction Name | FACTION Some Faction Name | DESCRIPTION A resourceful artificer with a knack for improvisation, sporting a rugged look with short-cropped hair and a perpetual five o'clock shadow.]\n` +
                            `This tag allows the game engine to create new characters dynamically based on entry events, expanding the cast and introducing new dynamics to the story as needed. Location is often a faction or module where the character is initially present. Faction is an optional field to indicate if the character belongs to one of the established factions and not to the Spire; it may be provided as a faction name or faction ID. ` +

                            `\n\n` +
                            `Tags should be a fair representation of the content's direct or implied events. ` +
                            `Bear in mind the somewhat abstract nature of character and tower stats when determining reasonable changes. ` +
                            `All stats (tower and character) exist on a scale of 1-10, with 1 being the lowest and 10 being the highest possible value; ` +
                            `typically, changes should be minor (+/- 1 or 2) at a time, unless something dramatic occurs.`};

function shouldPreserveUnprocessedTag(rawTag: string): boolean {
    // Keep empty reset tags (`[]`) and single-word text style tags (e.g. `[shout]`).
    return rawTag.length === 0 || /^\w+$/.test(rawTag);
}

function stripNonStyleTags(text: string): string {
    return text.replace(/\[([^\]]*)\]/g, (fullTag, rawTag) =>
        shouldPreserveUnprocessedTag(rawTag.trim()) ? fullTag : ''
    );
}

function parseOutcomeTag(text: string, stage: Stage, skit: SkitData): Outcome[] | null {
    const allActors = Object.values(stage.getSave().actors);
    const allFactions = Object.values(stage.getSave().factions);
    const currentSceneModuleForAnalysis = getCurrentSceneModuleId(skit, -1);
    const availableActors: Actor[] = Object.values(stage.getSave().actors);

    if (!text) return null;

    // Tower Activity: [ACTIVITY: Name | sentence | STAT +1/-1  OR  "No stat change" (REQUIRED tag)]
    const activityRegex = /ACTIVITY:\s*([^|]+)\|\s*([^|]+?)\s*\|\s*([^\]|]+?)\s*$/i;
    const activityMatch = activityRegex.exec(text);
    if (activityMatch) {
        const characterNameRaw = activityMatch[1].trim();
        let line = (activityMatch[2] || '').trim();
        const tagRaw = (activityMatch[3] || '').trim();

        // Match against tower residents (and the bound tower spirit): no faction members, no one away/visiting.
        const inTowerResidents = allActors.filter(a =>
            !a.factionId &&
            !a.isOffSite(stage.getSave()) &&
            !['cryo', 'dead'].includes(a.locationId || '')
        );
        const matchedActor = findBestNameMatch(characterNameRaw, inTowerResidents);

        // Reject: no valid resident, empty line, or a line that begins with a digit (LLM number-anchoring tic).
        if (!matchedActor || !line || /^\s*\d/.test(line)) {
            console.warn('Activity discarded (invalid resident, empty, or number-prefixed):', text);
            return null;
        }

        // The tag is REQUIRED: either a valid stat change or the literal "No stat change".
        const noChange = /^no\s+stat\s+change$/i.test(tagRaw);
        const statMatch = /^([A-Za-z]+)\s*([+\-]\s*\d+)$/.exec(tagRaw);
        if (!noChange && !statMatch) {
            console.warn('Activity discarded (missing/malformed required tag):', text);
            return null;
        }

        line = line.replace(/\s*[\r\n]+\s*/g, ' ').trim();
        const words = line.split(/\s+/);
        if (words.length > 30) line = words.slice(0, 30).join(' ') + '...';

        const outcome: Outcome = { type: 'towerActivity', actorId: matchedActor.id, activityLine: line };

        if (statMatch) {
            const matchedStat = Object.values(StationStat).find(s => String(s).toLowerCase() === statMatch[1].trim().toLowerCase());
            const rawAmount = parseInt(statMatch[2].replace(/\s+/g, ''), 10) || 0;
            if (matchedStat && rawAmount !== 0) {
                outcome.activityStat = matchedStat as StationStat;
                outcome.activityAmount = rawAmount > 0 ? 1 : -1; // hard clamp
            } else if (!noChange) {
                // Tag looked like a stat change but named an invalid stat - discard rather than silently keep.
                console.warn('Activity discarded (tag names invalid stat):', text);
                return null;
            }
        }
        return [outcome];
    }

    const factionTagRegex = /FACTION:\s*([^+\-]+)\s*([+\-]\s*\d+)/i;
    const factionMatch = factionTagRegex.exec(text);
    if (factionMatch) {
        console.log(`Parsing faction reputation change from tag: ${text}`);
        const factionNameRaw = factionMatch[1].trim();
        const reputationChange = parseInt(factionMatch[2].replace(/\s+/g, ''), 10) || 0;
        const matchedFaction = findBestNameMatch(factionNameRaw, allFactions);
        console.log(`Matched faction: ${matchedFaction ? matchedFaction.name : 'None'}, Reputation change: ${reputationChange}`);
        if (matchedFaction && reputationChange !== 0) {
            return [{
                type: 'factionReputation',
                factionId: matchedFaction.id,
                amount: reputationChange
            }];
        }
    }

    const joinedRegex = /(.+?):\s*JOINED\s+(.+)/i;
    const joinedMatch = joinedRegex.exec(text);
    if (joinedMatch) {
        const characterNameRaw = joinedMatch[1].trim();
        const factionNameRaw = joinedMatch[2].trim();
        const matchedActor = findBestNameMatch(characterNameRaw, allActors);
        if (matchedActor) {
            let newFactionId = '';
            if (!['PARC', 'SPIRE'].includes(factionNameRaw.toUpperCase())) {
                const matchedFaction = findBestNameMatch(factionNameRaw, allFactions);
                if (matchedFaction) {
                    newFactionId = matchedFaction.id;
                }
            }
            return [{
                type: 'factionChange',
                actorId: matchedActor.id,
                factionId: newFactionId
            }];
        }
        return null;
    }

    const roleRegex = /(.+?):\s*ROLE\s+(.+)/i;
    const roleMatch = roleRegex.exec(text);
    if (roleMatch) {
        const characterNameRaw = roleMatch[1].trim();
        const roleNameRaw = roleMatch[2].trim();
        const matchedActor = findBestNameMatch(characterNameRaw, allActors);
        const currentRole = matchedActor ? getRole(matchedActor, stage.getSave()) : null;
        const matchedRole = findBestNameMatch(roleNameRaw, stage.getSave().layout.getAllModulesWhere(m => true).map(m => ({ name: m.getAttribute('role') || '' })));
        const newRole = ['NONE', 'PATIENT', 'RESIDENT', 'OCCUPANT'].includes(roleNameRaw.toUpperCase()) ? '' : matchedRole?.name || '';
        if (matchedActor && currentRole !== newRole) {
            return [{
                type: 'roleChange',
                actorId: matchedActor.id,
                role: newRole
            }];
        }
        return null;
    }

    const newModuleRegex = /NEW MODULE:\s*([^|]+)\|\s*ROLE\s+([^|]+)\|\s*DESCRIPTION\s+(.+)/i;
    const newModuleMatch = newModuleRegex.exec(text);
    if (newModuleMatch) {
        console.log('New Module tag detected:', text);
        const moduleName = newModuleMatch[1].trim();
        const roleName = newModuleMatch[2].trim();
        const description = newModuleMatch[3].trim();
        if (moduleName && roleName && description) {
            console.log(`Parsing new module definition from tag: ${text}: Module Name: ${moduleName}, Role Name: ${roleName}, Description: ${description}`);
            const existingModules = Object.values(MODULE_TEMPLATES).map(m => ({ name: m.name }));
            const similarModule = findBestNameMatch(moduleName, existingModules);
            // Currently, allow for duplicate roles. Only block non-roles.
            const similarRole = findBestNameMatch(roleName, [{ name: 'NONE' }, { name: 'NOT APPLICABLE' }, { name: 'N/A' }]); //, ...Object.values(MODULE_TEMPLATES).map(m => ({ name: m.role || 'NOT APPLICABLE' }))]);
            if (!similarModule && !similarRole) {
                return [{
                    type: 'newModule',
                    module: {
                        id: generateUuid(),
                        moduleName,
                        roleName,
                        description
                    }
                }];
            } else {
                console.log(`Something too similar: ${similarModule ? `Module: ${similarModule.name}` : ''} ${similarRole ? `Role: ${similarRole.name}` : ''}`);
            }
        }
    }

    const newAppearanceRegex = /NEW APPEARANCE:\s*([^|]+)\|\s*NAME\s+([^|]+)\|\s*DESCRIPTION\s+(.+)/i;
    const newAppearanceMatch = newAppearanceRegex.exec(text);
    if (newAppearanceMatch) {
        const characterName = newAppearanceMatch[1].trim();
        const appearanceName = newAppearanceMatch[2].trim();
        const appearanceDescription = newAppearanceMatch[3].trim();
        const matchedActor = findBestNameMatch(characterName, allActors);
        if (matchedActor) {
            const similarOutfit = findBestNameMatch(
                appearanceName,
                matchedActor.outfits.map(outfit => ({ name: outfit.name, outfit }))
            );
            if (!similarOutfit) {
                return [{
                    type: 'newOutfit',
                    actorId: matchedActor.id,
                    outfit: {
                        id: generateUuid(),
                        actorId: matchedActor.id,
                        outfitName: appearanceName,
                        description: appearanceDescription
                    }
                }];
            }
        }
    }

    const newCharacterRegex = /NEW CHARACTER:\s*([^|]+)\|\s*LOCATION\s+([^|]+)(?:\|\s*FACTION\s*([^|]*))?\|\s*DESCRIPTION\s+(.+)/i;
    const newCharacterMatch = newCharacterRegex.exec(text);
    if (newCharacterMatch) {
        const characterName = newCharacterMatch[1].trim();
        const locationName = newCharacterMatch[2].trim();
        const factionInput = (newCharacterMatch[3] || '').trim();
        const personality = newCharacterMatch[4].trim();
        console.log(`New Character tag detected: ${text}`);

        if (characterName && personality) {
            // Reject obvious duplicates by name against the current cast.
            console.log(`Parsing new character definition from tag: ${text}: Character Name: ${characterName}, Location Name: ${locationName}, Personality: ${personality}`);
            const similarActor = findBestNameMatch(characterName, [...allActors, {name: stage.getSave().player.name, id: 'player'}]);
            if (similarActor) {
                console.log(`Too similar character name found for new character tag: ${similarActor.name}`);
                return null;
            }

            let moduleId = '';

            const modules = stage.getLayout().getAllModulesWhere(m => !!m.getAttribute('name'));
            const modulesWithAliases = modules.flatMap(module => [
                { name: module.getAttribute('name') || '', module },
                { name: module.type || '', module },
                { name: `${module.getAttribute('name') || ''} ${module.type}`.trim(), module }
            ]).filter(candidate => candidate.name.trim().length > 0);

            const matchedModule = findBestNameMatch(locationName, modulesWithAliases);
            if (matchedModule) {
                moduleId = matchedModule.module.id;
            } else if (['HERE', 'THIS MODULE', 'CURRENT MODULE', 'THIS LOCATION'].includes(locationName.toUpperCase())) {
                moduleId = currentSceneModuleForAnalysis || skit.moduleId || '';
            } else {
                const matchedFaction = findBestNameMatch(locationName, allFactions);
                if (matchedFaction) {
                    // `moduleId` doubles as a location ID for this outcome; faction IDs are valid locations.
                    moduleId = matchedFaction.id;
                }
            }
            console.log(`Matched location for new character tag: ${moduleId ? (stage.getSave().layout.getModuleById(moduleId)?.getAttribute('name') || stage.getSave().factions[moduleId]?.name || 'Unknown Location') : 'No match found'}`);

            let factionId = '';
            if (!['PARC', 'SPIRE', 'NONE', 'NA', ''].includes(factionInput.toUpperCase())) {
                const directFaction = stage.getSave().factions[factionInput];
                const matchedFaction = directFaction || findBestNameMatch(factionInput, allFactions);
                factionId = matchedFaction?.id || '';

                // If FACTION is provided, it must resolve to a valid faction ID.
                if (!factionId) {
                    console.log(`Failed to resolve faction for new character tag: ${factionInput}`);
                    return null;
                }
            }

            if (moduleId) {
                return [{
                    type: 'newActor',
                    actor: {
                        name: characterName,
                        personality,
                        locationId: moduleId,
                        factionId
                    }
                }];
            }
        }
    }

    const statChangeRegex = /(.+?):\s*(.+)/i;
    const statMatch = statChangeRegex.exec(text);
    if (statMatch) {

        const target = statMatch[1].trim();
        const payload = statMatch[2].trim();
        const adjustments = payload.split(',').map(p => p.trim());

        if (['STATION', 'PARC', 'TOWER', 'SPIRE'].includes(target.toUpperCase())) {
            const outcomes: Outcome[] = [];
            for (const adj of adjustments) {
                const m = adj.match(/([A-Za-z\s]+)\s*([+-]\s*\d+)/i);
                if (!m) continue;
                const statNameRaw = m[1].trim();
                const num = parseInt(m[2].replace(/\s+/g, ''), 10) || 0;
                let statKey = statNameRaw.toLowerCase().trim();
                const enumMatch = Object.values(StationStat).find(s => s.toLowerCase() === statKey || s.toLowerCase().includes(statKey) || statKey.includes(s.toLowerCase()));
                if (!enumMatch) continue;
                statKey = enumMatch;
                outcomes.push({
                    type: 'stationStat',
                    stat: statKey as StationStat,
                    amount: num
                });
            }
            return outcomes.length > 0 ? outcomes : null;
        }

        const matchedActor = findBestNameMatch(target, availableActors);
        console.log(`Parsing character stat change from tag: ${text}: Target: ${target}, Matched Actor: ${matchedActor ? matchedActor.name : 'None'}`);
        if (!matchedActor) return null;
        const outcomes: Outcome[] = [];
        for (const adj of adjustments) {
            const m = adj.match(/([A-Za-z\s]+)\s*([+-]\s*\d+)/i);
            if (!m) continue;
            const statNameRaw = m[1].trim();
            const num = parseInt(m[2].replace(/\s+/g, ''), 10) || 0;
            let statKey = statNameRaw.toLowerCase().trim();
            const enumMatch = Object.values(Stat).find(s => s.toLowerCase() === statKey || s.toLowerCase().includes(statKey) || statKey.includes(s.toLowerCase()));
            if (!enumMatch) continue;
            statKey = enumMatch;
            outcomes.push({
                type: 'actorStat',
                actorId: matchedActor.id,
                stat: statKey as Stat,
                amount: num
            });
        }
        return outcomes.length > 0 ? outcomes : null;
    }

    // Parse a moves to tag.
    const props = processMovementTag(text, stage, skit);
    if (props) {
        // props.destination could be a faction or a module; need to put it into the Outcome the right way:

        return [{
            type: 'movement',
            actorId: props.actorId,
            factionId: stage.getSave().factions[props.destinationId] ? props.destinationId : undefined,
            moduleId: stage.getSave().layout.getModuleById(props.destinationId) ? props.destinationId : undefined
        }];
    }
    
    return null;
}

function parseOutcomeTagsFromText(text: string, stage: Stage, skit: SkitData): Outcome[] {
    const outcomes: Outcome[] = [];
    console.log('Parsing outcome tags from text:', text);
 
    for (const tag of text.match(/\[[^\]]+\]/g) || []) {
        const raw = tag.slice(1, -1).trim();
        console.log(`Found tag: ${tag}`);
        if (raw) {
            const parsed = parseOutcomeTag(raw, stage, skit);
            if (parsed) {
                console.log('Parsed outcome:', parsed);
                outcomes.push(...parsed);
            }
        }
    }

    return outcomes;
}

async function generateImpliedOutcomesForCurrentEnd(skit: SkitData, newEntries: ScriptEntry[], stage: Stage): Promise<Outcome[]> {
    const analysisSkit: SkitData = {
        ...skit,
        script: [...skit.script, ...newEntries]
    };

    let retries = 3

    while (retries > 0) {
        try {
            const impliedOutcomePrompt = buildSkitPrompt(analysisSkit, stage, 0,
                buildPromptSegment('Scene Script for Analysis', buildScriptLog(analysisSkit, [], stage)) +
                buildPromptSegment('Outcome Tag Rules',
                    buildOutcomeTagRules('Some Character')) +
                buildPromptSegment('Instruction',
                    `Analyze the scene depicted in the above script. ` +
                    `The System will apply the Outcome Tag Rules to output outcome tags that represent the direct or implied consequences of this scene if it were to end at this moment. ` +
                    `Bear in mind existing outcome tags within the skit, avoiding redundancy or overkill. ` +
                    `Tacitly consider the implications of these interactions, and infer outcomes involving character movements/departures/arrivals (particularly for missions or other faction arrangements), ` +
                    `impending trade or exchanges (affecting the tower's stats or resources), new rooms being discussed or designed, new looks or appearances for existing characters, ` +
                    `or other developments that may be reasonably suggested by the scene's context but not captured by current tags in the script above. ` +
                    `After all relevant tags have been output by System, include an [END] tag before including any explanations for the chosen tags. ` +
                    `If no outcomes seem relevant, output [NO OUTCOMES].`)
                );

            const impliedResponse = await stage.makeText({
                prompt: impliedOutcomePrompt,
                min_tokens: 1,
                max_tokens: 500,
                include_history: true,
                stop: ['[END]', 'OUTCOMES]'] // Just OUTCOMES] will allow some content, so the null check doesn't retry.
            });

            if (!impliedResponse) {
                retries--;
                console.log('No implied outcomes for skit.');
                continue;
            }
            const outcomes = parseOutcomeTagsFromText(impliedResponse, stage, analysisSkit);
            console.log('Parsed outcomes:', outcomes);
            return outcomes;
        } catch(error) {
            console.error('Error generating implied outcomes:', error);
            retries--;
        }
    }

    return [];
}

export async function generateSkitSummary(skit: SkitData, stage: Stage): Promise<string> {
    let retries = 3;
    while (retries > 0) {
        const summaryPrompt = buildSkitPrompt(skit, stage, 0,
                buildPromptSegment('Scene Script for Analysis', buildScriptLog(skit, skit.script, stage)) +
                buildPromptSegment('Instruction', `The System will analyze the preceding scene script output a "[SUMMARY: <textSummary>]" tag with a brief summary of the entire scene's key events or outcomes.`)) +
            buildPromptSegment('Example Response',
                `[SUMMARY: A faction envoy visits the Spire to make an offer to a resident, which they accept, leading to the resident's departure from the tower to join that faction permanently.]`);
        let endResponse = await stage.makeText({
            prompt: summaryPrompt,
            min_tokens: 1,
            max_tokens: 300,
            include_history: true,
            stop: ['#END']
        });
        if (endResponse) {
            const summaryMatch = /\[SUMMARY:\s*([^\]]+)\]/i.exec(endResponse);
            if (summaryMatch && summaryMatch[1].trim().length > 30) {
                skit.summary = summaryMatch[1].trim();
                console.log('New summary for skit:', skit.summary);
                return skit.summary;
            }
        }
        retries--;
    }
    return '';
}

export async function generateSkitScript(skit: SkitData, stage: Stage): Promise<ScriptEntry[]> {

    const generalAlternativePrompts = [
        'Write compelling, fresh content that emphasizes dialogue and character interactions with suitable wit and flavor without recycling past material.',
        'Craft engaging and dynamic beats that highlight character dynamics and emotions while dodging redundant content.',
        'Eschew reliance on past themes by creating vivid and distinct moments that showcase character personalities through their actions and dialogue.',
        'Take care to avoid repetition of past events, instead focusing on advancing the scene with new developments and novel interactions.'
    ];
    const alternativePrompt = generalAlternativePrompts[Math.floor(Math.random() * generalAlternativePrompts.length)];

    // Retry logic if response is null or response.result is empty
    let retries = 3;
    while (retries > 0) {
        try {
            const fullPrompt = buildSkitPrompt(skit, stage, 5 + retries * 5, // Start with lots of history, reducing each iteration.
                buildPromptSegment(`Demonstrative Script and Tag Formatting`, 
                    `[SOME CHARACTER turn] Some Character does some actions in prose; for example, they may be waving to you, the player. They say, "My dialogue is in quotation marks."\n` +
                    `[SOME CHARACTER turn][SOME CHARACTER expresses PRIDE] They add, "A character can have two consecutive entries, if they have more to say or do, and it makes sense to break up a lot of activity."\n` +
                    `[ANOTHER CHARACTER turn][ANOTHER CHARACTER moves to HERE][ANOTHER CHARACTER expresses JOY][SOME CHARACTER expresses SURPRISE] ` +
                        `Changing speakers requires a new [<NAME> turn] tag; this tag demarkates a new entry in the script. Another Character explains, "Some Character changed their expression in this entry to react to my presence, but only I can speak here."\n` +
                    `[SOME CHARACTER turn] They nod in agreement, "If there's any dialogue at all, the entry must be attributed to the character speaking."\n` +
                    `[NARRATOR turn][SOME CHARACTER expresses RELIEF] Descriptive content or other scene events occurring around you, the player, can be attributed to NARRATOR. Dialogue cannot be included in NARRATOR entries.\n` +
                    (stage.getSave().disableImpersonation ? '' : `[${stage.getSave().player.name.toUpperCase()} turn] "Hey, Some Character," I greet them warmly. I'm the player, and my entries use first-person narrative voice, while all other skit entries use second-person to refer to me.\n`) +
                    `[NARRATOR turn][SOME CHARACTER moves to OTHER ROOM NAME] Some Character ducks out with a smile. You hear their boots fade away down the stairs beyond.\n` +
                    `[ANOTHER CHARACTER turn][SCENE moves to OTHER ROOM NAME][SOME CHARACTER wears FORMAL WEAR] You and Another Character follow Some Character to the other room, where they have changed into more formal attire. "[shout]We'll miss you, Some Character![]" cries Another Character, utilizing a text style tag.\n` +
                    `[SOME CHARACTER turn][SOME CHARACTER moves to FACTION NAME] Some Character waves good-bye as they step into the translocation circle, leaving the Spire to join Faction Name. The runes flare bright, and then they are gone.` +
                    `A courier charm chimes as Faction Name's payment settles into the tower's coffers.[STATION: Wealth +1]\n`
                 ) +
                buildPromptSegment(`Ongoing Scene Log`, buildScriptLog(skit, [], stage)) +
                buildPromptSegment(`Primary Instruction`, 
                `${skit.script.length == 0 ? 'Produce the initial moments of a scene (perhaps joined in medias res)' : 'Extend or conclude the current scene script'} with three to five entries, ` +
                `based upon the Premise and the specified Scene Prompt. Primarily involve the Present Characters, although Absent Characters may be moved to this location using appropriate tags, if warranted. ` +
                `The script should tacitly consider characters' stats, relationships, past events, and the tower's stats—among other factors—to craft a compelling scene. ` +
                `\n\nFollow the structure of the strict Example Script formatting above: ` +
                `actions are depicted in prose and character dialogue in quotation marks. Characters present their own actions and dialogue, while other events within the scene are attributed to NARRATOR. ` +
                `Although a loose script format is employed, the actual content should be professionally edited narrative prose. ` +
                (stage.getSave().disableImpersonation ? 
                    `New entries refer to the player, ${stage.getSave().player.name}, in second-person; all other characters are referred to in third-person, even in their own entries.` :
                    `Entries from the player, ${stage.getSave().player.name}, are written in first-person, while other entries consistently refer to ${stage.getSave().player.name} in second-person; all other characters are referred to in third-person, even in their own entries.`)) +
                buildPromptSegment(`Scene Cue Tags`, 
                    `Embedded within this script, you may employ these special cue tags to trigger desired behaviors in the game engine. ` +
                    `\n\n#Turn Tag:#\n` +
                        `A character turn tag must be used to initiate a new script entry. Use NARRATOR for general narration entries, or the specific character who is speaking or performing actions in this entry. Consecutive turns are preferred over long turns.\n` +
                        `[<characterName> turn]who is speaking or performing an action.` +
                    `\n\n#Emotion Tag:#\n` +
                        `Emotion tags should be used to indicate visible emotional shifts in a character's appearance using a single-word emotion name.\n` +
                        `[<characterName> expresses <emotion>]` +
                    `\n\n#Wears Tag:#\n` +
                        `Wears tags should be used when a character changes outfit or appearance. ` +
                        `When establishing a character at the beginning of a scene or when moving to this location with a movement tag, ` +
                        `give special consideration to the inclusion of a 'wears' tag to explicitly call out an appropriate look. ` +
                        `<appearanceName> must be found under the specified character—either their current appearance or one of their listed alternatives.\n` +
                        `[<characterName> wears <appearanceName>]` +
                    `\n\n#Movement Tag:#\n` +
                        `A character movement tag must be used when an Absent Character enters the scene, a present character leaves or moves to a different room of the tower, ` +
                        `or when a character moves to another faction, abstractly representing any faction mission or time away. ` +
                        `If "Scene" is used as the character name, it indicates that the scene itself is moving to a different location, and all present characters are moving with it.\n` +
                        `[<characterName|"Scene"> moves to <locationName|factionName|"Here"|"Another room">]` +
                    `\n\n#Text Style Tags:#\n` +
                        `Special style keywords can be included in a tag to indicate that the surrounded text should be styled in a particular way, such as shouting or whispering.\n` +
                        `The game engine will style recognized tags appropriately. An empty tag can be used to reset the text style to default. All known styles:\n` +
                        `arcane - Adorned with mystical symbols and a shimmering effect, ideal for magical or mysterious dialogue.\n` +
                        `burn - Smoldering, flickering effect, conveying heat or destruction.\n` +
                        `flutter - A light, airy effect with gentle movement, perfect for whimsical or romantic moments.\n` +
                        `glitch - Distortion and static effects, ideal for corrupted or unstable magic.\n` +
                        `hologram - A glowing shimmer effect for spirits, projections, and magical communications.\n` +
                        `quake - Shaking text, indicating fear, danger, shock, or instability.\n` +
                        `shine - A radiant glow and sparkling effect, perfect for moments of awe, beauty, or revelation.\n` +
                        `shout - A bold, larger font and a bright color, conveying loudness or intensity.\n` +
                        `sigh - A soft, fading effect, ideal for sighs, tiredness, or resignation.\n` +
                        `spooky - Wavy, bouncy text, ideal for moments of suspense, eeriness, or simply awe.\n` +
                        `tears - A watery effect and soft colors, evoking sadness or emotional vulnerability.\n` +
                        `whisper - A smaller, italicized font with a muted color, suggesting secrecy or softness.\n` +
                        `zalgo - Accented with archaic symbols and corrupted effects, often used for horror or demonic themes.\n` +
                        `[styleName]Text to be styled[]` +
                    `\n\n#End Tag:#\n` +
                        `An end tag should be used if the new chunk of script hits a conclusory moment, where continuing makes little sense.\n` +
                        `[END]` +
                    `\n\n#Cue Notes:#\n` +
                    `For all Character movement tags, LOCATION should be the name of an existing room (e.g., 'Translocation Circle', 'Apothecary', 'Parlor'), a character's chambers (e.g., 'Susan's chambers' or just 'chambers' for their own), or simply "Here" to move to the scene's location or "Another room" to leave this area. ` +
                    `If a faction name is used for the LOCATION, it indicates that the character is departing from the Spire itself, typically to visit a faction or engage in a mission or job on that faction's behalf (use the faction name as the location, even when the job is not "at" the faction). ` +
                    `The game engine relies upon movement tags to update character locations and visually display character presence in scenes, so it is essential to use these tags when Absent Characters enter the scene, Present Characters leave, or the scene itself relocates. ` +
                    `These tags are not presented to users, so the narrative content of the script should also organically mention characters entering, exiting, or relocating. `
                ) +
                
                buildPromptSegment(`Outcome Tags`, 
                            `In addition to the cue tags above, you may embed outcome tags to indicate important or relevant rewards or penalties, reflecting the narrative content; ` +
                            `typically, these are included at the tail end of the turn that triggers them. Weigh other outcome tags in the scene's script to avoid redundancy or overkill. ` +
                            `For each entry, consider and output particularly suitable tags, avoiding redundant or unnecessary tags. ` + buildOutcomeTagRules('Some Character')
                ) +


                buildPromptSegment(`Current Instruction`, 
                `The System will now craft and output multiple narrative entries/turns, developing this scene for a visual novel, utilizing tags per example and historic formatting and obeying the rules above. ` +
                `This is a skit in a video game, so avoid major developments or concrete details which would fundamentally alter or subvert the mechanics of the game. ` +
                (skit.script.length == 0 ? 'As this is the initial, establishing moment of a new scene, evaluate the current appearance and alternative appearances of each character and use Appearance ("wears") tags to update the characters to the most appropriate outfit for the moment. ' : '') +
                `Generally, focus upon interpersonal dynamics, character growth, faction and resident relationships, and the Spire's state, capabilities, and inhabitants. ` +
                `Ensure that the nature and writing of the scene suit the current Narrative Tone suggested above. ` +
                `\n\n${alternativePrompt}` +
                ((stage.getSave().language || 'English').toLowerCase() !== 'english' ? `\n\nNote: The game is now being played in ${stage.getSave().language}. Regardless of historic language use, generate this skit content in ${stage.getSave().language} accordingly. Special emotion, appearance, and movement tags continue to use English (these are invisible to the user).` : '') +
                ``)
            );

            const response = await stage.makeText({
                template: fullPrompt,
                min_tokens: 10,
                max_tokens: 1200,
                include_history: true,
                stop: ["[END]"]
            });
            if (response && response.trim().length > 0) {
                // First, detect and parse any tags that may be embedded in the response.
                let text = response;

                // Remove everything up to the first [NAME turn] tag, if it exists, to allow for some flexibility in model output while still ensuring we start parsing from the first turn.
                const firstTurnIndex = text.search(/\[[^\]]+ turn\]/i);
                if (firstTurnIndex >= 0) {
                    text = text.slice(firstTurnIndex);
                } else {
                    console.warn('No turn tags found in response; unable to parse script entries. Response was:', response);
                    continue;
                }

                // Parse response based on turn tags, e.g. "[NAME turn] content".
                // Keep a backward-compatible fallback for legacy "NAME: content" lines.
                const lines = text.split('\n');
                const combinedEntries: { speaker: string; message: string }[] = [];
                const combinedTagData: {emotions: {[key: string]: Emotion}, movements: {[actorId: string]: string}, outfitChanges: {[actorId: string]: string}, moveToModuleId?: string, outcomes: Outcome[], endScene: boolean}[] = [];
                let currentSpeaker = 'NARRATOR';
                let currentMessage = '';
                let hasCurrentEntry = false;
                let currentEmotionTags: {[key: string]: Emotion} = {};
                let currentMovements: {[actorId: string]: string} = {};
                let currentOutfitChanges: {[actorId: string]: string} = {};
                let currentSceneMoveToModuleId: string | undefined;
                let currentOutcomes: Outcome[] = [];

                let parsedSceneModuleId = getCurrentSceneModuleId(skit, -1);
                const parsedCurrentLocations = getCurrentActorLocations(skit, -1);
                const parsedCurrentOutfits = getCurrentActorOutfits(skit, stage, -1);
                const parsedCurrentEmotions = getCurrentActorEmotions(skit, -1);
                for (const line of lines) {
                    // Skip empty lines
                    let trimmed = line.trim().replace(/[“”]/g, '"').replace(/[‘’]/g, '\'');

                    console.log(`Process line: ${trimmed}`);

                    // If a line doesn't end with ], ., !, ?, or ", then it's likely incomplete and we should drop it.
                    if (!trimmed || ![']', '*', '_', ')', '.', '!', '?', '"', '\''].some(end => trimmed.endsWith(end))) continue;

                    const newEmotionTags: {[key: string]: Emotion} = {};
                    const newMovements: {[actorId: string]: string} = {};
                    const newOutfitChanges: {[actorId: string]: string} = {};
                    const newOutcomes: Outcome[] = [];
                    let newSceneMoveToModuleId: string | undefined;

                    // Prepare list of all actors (not just present)
                    const allActors: Actor[] = Object.values(stage.getSave().actors);
                    
                    // Process tags in the line
                    for (const tag of trimmed.match(/\[[^\]]+\]/g) || []) {
                        const raw = tag.slice(1, -1).trim();
                        if (!raw) continue;

                        console.log(`Processing tag: ${raw}`);
                        
                        const sceneMoveModuleId = processSceneMovementTag(raw, stage);
                        if (sceneMoveModuleId) {
                            // Move every actor currently present in the active scene module.
                            Object.entries(parsedCurrentLocations).forEach(([actorId, locationId]) => {
                                if (locationId === parsedSceneModuleId) {
                                    newMovements[actorId] = sceneMoveModuleId;
                                }
                            });
                            newSceneMoveToModuleId = sceneMoveModuleId;
                            Object.keys(newMovements).forEach(actorId => {
                                parsedCurrentLocations[actorId] = sceneMoveModuleId;
                            });
                            parsedSceneModuleId = sceneMoveModuleId;
                            continue;
                        }

                        // Process movement tags using the shared function
                        const movementResult = processMovementTag(raw, stage, skit, parsedSceneModuleId);
                        if (movementResult && movementResult.destinationId !== parsedCurrentLocations[movementResult.actorId]) {
                            newMovements[movementResult.actorId] = movementResult.destinationId;
                            parsedCurrentLocations[movementResult.actorId] = movementResult.destinationId;
                            continue;
                        }

                        const wearResult = processWearTag(raw, stage);
                        if (wearResult && wearResult.outfitId !== parsedCurrentOutfits[wearResult.actorId]) {
                            newOutfitChanges[wearResult.actorId] = wearResult.outfitId;
                            parsedCurrentOutfits[wearResult.actorId] = wearResult.outfitId;
                            console.log(`Processed wear tag for ${wearResult.actorId}: ${wearResult.outfitId}`);
                            continue;
                        }
                        
                        // Look for expresses tags:
                        const emotionTagRegex = /([^[\]]+)\s+expresses\s+([^[\]]+)/gi;
                        let emotionMatch = emotionTagRegex.exec(raw);
                        if (emotionMatch) {
                            const characterName = emotionMatch[1].trim();
                            const emotionName = emotionMatch[2].trim().toLowerCase();
                            // Find matching actor using findBestNameMatch
                            const matched = findBestNameMatch(characterName, allActors);
                            if (!matched) continue;

                            // Try to map emotion using EMOTION_SYNONYMS if not a standard emotion
                            let finalEmotion: Emotion | undefined;
                            if (emotionName in Emotion) {
                                finalEmotion = emotionName as Emotion;
                                console.log(`Recognized standard emotion "${finalEmotion}" for ${matched.name}`);
                            } else {
                                const closestEmotion = findBestNameMatch(emotionName, Object.keys(EMOTION_MAPPING).map(e => ({ name: e })));
                                if (closestEmotion) {
                                    console.log(`Emotion "${emotionName}" for ${matched.name} mapped to emotion "${EMOTION_MAPPING[closestEmotion.name]}".`);
                                    finalEmotion = EMOTION_MAPPING[closestEmotion.name];
                                } else {
                                    console.warn(`Unrecognized emotion "${emotionName}" for ${matched.name} and no close match found; skipping tag.`);
                                }
                            }
                            
                            if (!finalEmotion || finalEmotion === parsedCurrentEmotions[matched.name]) continue;
                            newEmotionTags[matched.name] = finalEmotion;
                            parsedCurrentEmotions[matched.name] = finalEmotion;
                        }



                        // Outcome tags:
                        const maybeOutcomes = parseOutcomeTag(tag, stage, skit);
                        if (maybeOutcomes) {
                            newOutcomes.push(...maybeOutcomes);
                            continue;
                        }
                    }

                    const tagsInLine = trimmed.match(/\[[^\]]+\]/g) || [];
                    const turnTagRegex = /^(.+?)\s+turn$/i;
                    const turnTag = tagsInLine
                        .map(tag => tag.slice(1, -1).trim())
                        .find(raw => turnTagRegex.test(raw));
                    const turnMatch = turnTag ? turnTagRegex.exec(turnTag) : null;

                    // Strip parsed/non-style tags but preserve text style tags and reset tags.
                    trimmed = stripNonStyleTags(trimmed).trim();

                    const startsNewEntry = !!turnMatch;

                    if (startsNewEntry) {
                        if (hasCurrentEntry) {
                            combinedEntries.push({ speaker: currentSpeaker, message: currentMessage.trim() });
                            combinedTagData.push({
                                emotions: currentEmotionTags,
                                movements: currentMovements,
                                outfitChanges: currentOutfitChanges,
                                moveToModuleId: currentSceneMoveToModuleId,
                                outcomes: currentOutcomes,
                                endScene: false // Not currently used.
                            });
                        }

                        currentSpeaker = turnMatch ? turnMatch[1].trim() : 'NARRATOR';
                        currentMessage = turnMatch ? trimmed : '';
                        hasCurrentEntry = true;
                        currentEmotionTags = newEmotionTags;
                        currentMovements = newMovements;
                        currentOutfitChanges = newOutfitChanges;
                        currentSceneMoveToModuleId = newSceneMoveToModuleId;
                        currentOutcomes = newOutcomes;
                    } else if (hasCurrentEntry) {
                        // Continuation of previous entry
                        if (trimmed) {
                            currentMessage += (currentMessage ? '\n' : '') + trimmed;
                        }
                        currentEmotionTags = {...currentEmotionTags, ...newEmotionTags};
                        currentMovements = {...currentMovements, ...newMovements};
                        currentOutfitChanges = {...currentOutfitChanges, ...newOutfitChanges};
                        currentSceneMoveToModuleId = newSceneMoveToModuleId || currentSceneMoveToModuleId;
                        currentOutcomes = [...currentOutcomes, ...newOutcomes];
                    } else if (trimmed) {
                        // If content appears before any explicit turn tag, attribute it to NARRATOR.
                        currentSpeaker = 'NARRATOR';
                        currentMessage = trimmed;
                        hasCurrentEntry = true;
                        currentEmotionTags = newEmotionTags;
                        currentMovements = newMovements;
                        currentOutfitChanges = newOutfitChanges;
                        currentSceneMoveToModuleId = newSceneMoveToModuleId;
                        currentOutcomes = newOutcomes;
                    }
                }
                if (hasCurrentEntry) {
                    combinedEntries.push({ speaker: currentSpeaker, message: currentMessage.trim() });
                    combinedTagData.push({
                        emotions: currentEmotionTags,
                        movements: currentMovements,
                        outfitChanges: currentOutfitChanges,
                        moveToModuleId: currentSceneMoveToModuleId,
                        outcomes: currentOutcomes,
                        endScene: false // Not currently used.
                    });
                }

                // Convert parsed entries into ScriptEntry objects.
                const scriptEntries: ScriptEntry[] = combinedEntries.map((parsedEntry, index) => {
                    let speaker = parsedEntry.speaker || 'NARRATOR';
                    let message = parsedEntry.message || '';
                    
                    // Keep single-word style tags and empty reset tags in final text.
                    message = stripNonStyleTags(message).trim();
                    
                    const entry: ScriptEntry = { speaker, message, speechUrl: '' };
                    const tagData = combinedTagData[index];
                    
                    if (tagData.emotions && Object.keys(tagData.emotions).length > 0) {
                        entry.actorEmotions = tagData.emotions;
                    }
                    if (tagData.movements && Object.keys(tagData.movements).length > 0) {
                        entry.movements = tagData.movements;
                    }
                    if (tagData.outfitChanges && Object.keys(tagData.outfitChanges).length > 0) {
                        entry.outfitChanges = tagData.outfitChanges;
                    }
                    if (tagData.moveToModuleId) {
                        entry.moveToModuleId = tagData.moveToModuleId;
                    }
                    if (tagData.outcomes && tagData.outcomes.length > 0) {
                        entry.outcomes = tagData.outcomes;
                    }
                    if (tagData.endScene) {
                        entry.endScene = true;
                    }
                    return entry;
                });

                // Drop empty entries from scriptEntries and adjust speaker to any matching actor's name:
                for (const entry of scriptEntries) {
                    if (!entry.message || entry.message.trim().length === 0) {
                        const movements = entry.movements || {};
                        const emotions = entry.actorEmotions || {};
                        const outfitChanges = entry.outfitChanges || {};
                        const nextEntry = scriptEntries[scriptEntries.indexOf(entry) + 1];
                        if (nextEntry) {
                            nextEntry.movements = {...(nextEntry.movements || {}), ...movements};
                            nextEntry.actorEmotions = {...(nextEntry.actorEmotions || {}), ...emotions};
                            nextEntry.outfitChanges = {...(nextEntry.outfitChanges || {}), ...outfitChanges};
                            nextEntry.outcomes = [...(nextEntry.outcomes || []), ...(entry.outcomes || [])];
                            nextEntry.endScene = !!(nextEntry.endScene || entry.endScene);
                        }
                        scriptEntries.splice(scriptEntries.indexOf(entry), 1);
                        continue;
                    }
                    // Adjust speaker name to match actor name if possible
                    const matched = findBestNameMatch(entry.speaker, [...Object.values(stage.getSave().actors), {name: stage.getSave().player.name, id: 'player'}]); // Include player as a possible match
                    if (matched) {
                        entry.speakerId = matched.id;
                        entry.speaker = matched.name;
                    }
                }

                if (stage.getSave().disableImpersonation) {
                    // If impersonation is undesired, find any entry where the speaker matches the player's name and drop all messages beyond that point.
                    const playerEntryIndex = scriptEntries.findIndex(entry => entry.speaker.toLowerCase() === stage.getSave().player.name.toLowerCase());
                    if (playerEntryIndex !== -1) {
                        console.log(`Player entry found at index ${playerEntryIndex}. Removing all subsequent entries to disable impersonation.`);
                        scriptEntries.splice(playerEntryIndex);
                    }
                }

                const normalizedScriptEntries = splitScriptEntriesByLineBreaks(scriptEntries);


                // Run implied-outcome analysis in parallel with TTS generation.
                const impliedOutcomesPromise = generateImpliedOutcomesForCurrentEnd(skit, normalizedScriptEntries, stage);

                // TTS for each entry's dialogue
                const ttsPromises = normalizedScriptEntries.map(async (entry) => {
                    const actor = findBestNameMatch(entry.speaker, Object.values(stage.getSave().actors));
                    // Only TTS if entry.speaker matches an actor from stage().getSave().actors and entry.message includes dialogue in quotes.
                    if (!actor || !entry.message.includes('"') || stage.getSave().disableTextToSpeech) {
                        entry.speechUrl = '';
                        return;
                    }
                    let transcript = entry.message.split('"').filter((_, i) => i % 2 === 1).join('.........').trim();
                    // Strip asterisks or other markdown-like emphasis characters
                    transcript = transcript.replace(/[\*_~`]+/g, '');
                    // Strip tagged content like [shout], [whisper], etc.
                    transcript = transcript.replace(/\[[^\]]+\]/g, '').trim();
                    try {
                        const ttsResponse = await stage.generator.speak({
                            transcript: transcript,
                            voice_id: actor.voiceId ?? undefined
                        });
                        if (ttsResponse && ttsResponse.url) {
                            entry.speechUrl = ttsResponse.url;
                        } else {
                            entry.speechUrl = '';
                        }
                    } catch (err) {
                        console.error('Error generating TTS:', err);
                        entry.speechUrl = '';
                    }
                });

                // Wait for both TTS and implied outcomes.
                const [, impliedOutcomes] = await Promise.all([
                    Promise.all(ttsPromises),
                    impliedOutcomesPromise
                ]);

                skit.outcomes = impliedOutcomes;
                console.log(`Implied outcomes for current end of skit:`, skit.outcomes);

                stage.pushMessage(text);

                return normalizedScriptEntries;
            }
        } catch (error) {
            console.error('Error generating skit script:', error);
        }
        retries--;
    }

    stage.saveGame();
    skit.outcomes = [];
    return [];
}

export function accumulateOutcomes(scriptEntries: ScriptEntry[], stage: Stage): Outcome[] {
    const statTotals = new Map<string, { outcome: Outcome; total: number; order: number }>();
    const factionReputationTotals = new Map<string, { outcome: Outcome; total: number; order: number }>();
    const newRole = new Map<string, Outcome>();
    const factionHistories = new Map<string, { entries: { value: string; outcome: Outcome; order: number }[] }>();
    const movementOutcomesByActor = new Map<string, { outcome: Outcome; order: number }>();
    const acceptedActors: { outcome: Outcome; order: number}[] = [];
    const acceptedActorNames: { name: string; index: number }[] = [];
    const acceptedModules: { outcome: Outcome; order: number }[] = [];
    const acceptedModuleNames: { name: string; index: number }[] = [];
    const acceptedOutfitsByActor = new Map<string, { outcome: Outcome; order: number }[]>();
    const acceptedActivities: { outcome: Outcome; order: number }[] = [];
    
    let orderCounter = 0;

    const nextOrder = (): number => orderCounter++;

    const appendNettingHistory = (
        history: { value: string; outcome: Outcome; order: number }[],
        value: string,
        outcome: Outcome
    ): { value: string; outcome: Outcome; order: number }[] => {
        const existingIndex = history.findIndex(entry => entry.value === value);

        if (existingIndex === history.length - 1) {
            return history;
        }

        if (existingIndex !== -1) {
            if (existingIndex === 0) {
                return [];
            }
            return history.slice(0, existingIndex + 1);
        }

        return [...history, { value, outcome, order: nextOrder() }];
    };

    for (const entry of scriptEntries) {
        for (const outcome of entry.outcomes || []) {
            switch (outcome.type) {
                case 'actorStat':
                case 'stationStat': {
                    const statKey = `${outcome.type}:${outcome.type === 'actorStat' ? outcome.actorId || '' : ''}:${String(outcome.stat || '')}`;
                    const current = statTotals.get(statKey) || { outcome: { ...outcome }, total: 0, order: nextOrder() };
                    current.total += outcome.amount || 0;
                    current.outcome = { ...current.outcome, amount: current.total };
                    statTotals.set(statKey, current);
                    break;
                }
                case 'factionReputation': {
                    const factionKey = outcome.factionId || '';
                    const current = factionReputationTotals.get(factionKey) || { outcome: { ...outcome }, total: 0, order: nextOrder() };
                    current.total += outcome.amount || 0;
                    current.outcome = { ...current.outcome, amount: current.total };
                    factionReputationTotals.set(factionKey, current);
                    break;
                }
                case 'roleChange': {
                    const actorKey = outcome.actorId || '';
                    if (!actorKey) {
                        break;
                    }

                    newRole.set(actorKey, { ...outcome });
                    break;
                }
                case 'factionChange': {
                    const actorKey = outcome.actorId || '';
                    const currentHistory = factionHistories.get(actorKey)?.entries || [];
                    const updatedHistory = appendNettingHistory(currentHistory, outcome.factionId || '', outcome);
                    if (updatedHistory.length === 0) {
                        factionHistories.delete(actorKey);
                    } else {
                        factionHistories.set(actorKey, { entries: updatedHistory });
                    }
                    break;
                }
                case 'movement': {
                    const actorKey = outcome.actorId || '';
                    if (!actorKey) {
                        break;
                    }

                    if (!outcome.factionId && !outcome.moduleId) {
                        break;
                    }

                    movementOutcomesByActor.set(actorKey, {
                        outcome: { ...outcome },
                        order: nextOrder()
                    });
                    break;
                }
                case 'newModule': {
                    const moduleName = outcome.module?.moduleName?.trim() || '';
                    if (!moduleName) {
                        break;
                    }

                    const similarExistingModule = findBestNameMatch(moduleName, acceptedModuleNames.map(existing => ({ name: existing.name })));
                    if (similarExistingModule) {
                        break;
                    }

                    acceptedModuleNames.push({ name: moduleName, index: acceptedModules.length });
                    acceptedModules.push({ outcome: { ...outcome, module: outcome.module ? { ...outcome.module } : outcome.module }, order: nextOrder() });
                    break;
                }
                case 'newActor': {
                    const actorName = outcome.actor?.name?.trim() || '';
                    if (!actorName) {
                        break;
                    }

                    const similarExistingActor = findBestNameMatch(actorName, acceptedActorNames.map(existing => ({ name: existing.name })));
                    if (similarExistingActor) {
                        break;
                    }

                    acceptedActorNames.push({ name: actorName, index: acceptedActors.length });
                    acceptedActors.push({ outcome: { ...outcome, actor: outcome.actor ? { ...outcome.actor } : outcome.actor }, order: nextOrder() });
                    break;
                }
                case 'newOutfit': {
                    const actorId = outcome.outfit?.actorId || outcome.actorId || '';
                    const outfitName = outcome.outfit?.outfitName?.trim() || '';
                    if (!actorId || !outfitName) {
                        break;
                    }

                    const actorOutfits = acceptedOutfitsByActor.get(actorId) || [];
                    const similarExistingOutfit = findBestNameMatch(outfitName, actorOutfits.map(existing => ({ name: existing.outcome.outfit?.outfitName || '' })));
                    if (similarExistingOutfit) {
                        break;
                    }

                    actorOutfits.push({ outcome: { ...outcome, outfit: outcome.outfit ? { ...outcome.outfit } : outcome.outfit }, order: nextOrder() });
                    acceptedOutfitsByActor.set(actorId, actorOutfits);
                    break;
                }
                case 'towerActivity': {
                    // Only keep the first valid activity per analysis (there should be just one).
                    if (outcome.actorId && outcome.activityLine && acceptedActivities.length === 0) {
                        acceptedActivities.push({ outcome: { ...outcome }, order: nextOrder() });
                    }
                    break;
                }
            }
        }
    }

    const accumulated: { outcome: Outcome; order: number }[] = [];

    statTotals.forEach(({ outcome, total, order }) => {
        // If the effective result is no change, don't add it. Need to look at max/minimum value for the actual current target stat to make this determination.
        let effectiveTotal = total;
        if (outcome.actorId && outcome.stat && Object.values(Stat).includes(outcome.stat as Stat)) {
            const currentValue = stage.getSave().actors[outcome.actorId].stats[outcome.stat as Stat];
            effectiveTotal = Math.max(1, Math.min(10, currentValue + total)) - currentValue;
        } else if (outcome.stat && Object.values(StationStat).includes(outcome.stat as StationStat)) {
            const currentValue = stage.getSave().stationStats?.[outcome.stat as StationStat] ?? 1;
            effectiveTotal = Math.max(1, Math.min(10, currentValue + total)) - currentValue;
        }

        if (effectiveTotal !== 0) {
            accumulated.push({ outcome: { ...outcome, amount: effectiveTotal }, order });
        }
    });

    factionReputationTotals.forEach(({ outcome, total, order }) => {
        
        // Similar to stat totals, if the effective result is no change, don't add it. Look at current reputation with the faction to determine this.
        let effectiveTotal = total;
        if (outcome.factionId) {
            const currentReputation = stage.getSave().factions[outcome.factionId]?.reputation ?? 1;
            effectiveTotal = Math.max(1, Math.min(10, currentReputation + total)) - currentReputation;
        }

        if (effectiveTotal !== 0) {
            accumulated.push({ outcome: { ...outcome, amount: effectiveTotal }, order });
        }
    });

    newRole.forEach((outcome, actorId) => {
        if (outcome.role !== getRole(stage.getSave().actors[actorId], stage.getSave())) {
            accumulated.push({ outcome: { ...outcome }, order: 0 });
        }
    });

    factionHistories.forEach(({ entries }) => {
        entries.forEach(entry => accumulated.push({ outcome: { ...entry.outcome, factionId: entry.value }, order: entry.order }));
    });

    movementOutcomesByActor.forEach(({ outcome, order }) => {
        const actor = stage.getSave().actors[outcome.actorId || ''];
        if (actor && Object.keys(stage.getSave().factions).includes(actor.locationId) != !!outcome.factionId) {
            accumulated.push({ outcome: { ...outcome }, order });
        }
    });

    acceptedModules.forEach(entry => accumulated.push({ outcome: entry.outcome, order: entry.order }));
    acceptedOutfitsByActor.forEach(entries => {
        entries.forEach(entry => accumulated.push({ outcome: entry.outcome, order: entry.order }));
    });

    acceptedActors.forEach(entry => accumulated.push({ outcome: entry.outcome, order: entry.order }));

    acceptedActivities.forEach(entry => accumulated.push({ outcome: entry.outcome, order: entry.order }));

    return accumulated
        .sort((left, right) => left.order - right.order)
        .map(entry => entry.outcome);
}

export async function updateCharacterArc(stage: Stage, skit: SkitData, actor: Actor): Promise<void> {
    const analysisPrompt = buildSkitPrompt(skit, stage, 0,
        buildPromptSegment(`Scene Script for Analysis`, `${buildScriptLog(skit, [], stage)}`) +
        buildPromptSegment(`${actor.name}'s Current Character Arc`, `${actor.characterArc || 'No established character arc.'}`) +
        buildPromptSegment(`Instruction`, 
            `Analyze the preceding scene script and ${actor.name}'s character arc, then output a revised character arc paragraph that reflects any significant developments from the latest scene script. ` +
            `The character arc should be a concise summary of the character's growth, challenges, and changes experienced so far at the Spire. ` +
            `Focus on key emotional beats, relationships, and personal growth that have occurred up to this point. ` +
            `The System output should be a single paragraph, maintaining the same tone and style as the existing character arc.` +
            `If there are no significant developments, simply repeat the existing character arc without changes. `) +
        buildPromptSegment(`Full Examples`, 
            `Revised Character Arc: John Smith has yet to find their footing at the Spire; they can't seem to make friends with the other residents - beyond the tower spirit - and the Magus hasn't proven trustworthy.\n[END]\n\n` +
            `Revised Character Arc: Jane Doe has started to open up to others, forming tentative friendships. She feels a bit out of her depth in her role as Steward, but appreciates the trust the Magus has placed in her and hopes to prove that faith justified.\n[END]\n`)
        );
    
    const requestAnalysis = await stage.makeText({
        prompt: analysisPrompt,
        min_tokens: 50,
        max_tokens: 400,
        include_history: true,
        stop: ['[END]']
    });
    if (requestAnalysis) {
        let analysisText = requestAnalysis.trim();
        // Some prefix ending with "Arc:" may be present; remove it.
        const arcPrefixMatch = analysisText.match(/^(.*Arc:)/i);
        if (arcPrefixMatch) {
            analysisText = analysisText.substring(arcPrefixMatch[1].length).trim();
        }
        analysisText = analysisText.replace(/^"|"$/g, '').trim();
        // Update actor's character arc
        actor.characterArc = analysisText || actor.characterArc;
        console.log(`Updated character arc for ${actor.name}: ${actor.characterArc}`);
    }
}


export default {
    SkitType: SkitType
};

