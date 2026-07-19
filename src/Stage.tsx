import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message, UpdateBuilder, AspectRatio} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
import Actor, { loadReserveActor, commitActorToEcho, Stat, CAPABILITY_STATS, RANK_MAX, generateAdditionalActorImages, loadReserveActorFromFullPath, ArtStyle, generateActorDecor, namesMatch, findBestNameMatch, generateBaseActorImage, getRole } from "./actors/Actor";
import { GameLocation, createHomeLocation, createLocation, HOME_LOCATION_ID, ARCHIVE_AFTER_TURNS, DISCOVERABLE_PLACES } from "./Location";
import { EquipmentItem, EquipSlot, EQUIP_SLOTS, SYSTEM_MAX_DURABILITY, createTemporaryItem, archiveEquipmentItem, findArchiveMatch } from "./Equipment";
import { assignTraitsToActor } from "./Traits";
import Faction, { generateFactionModule, generateFactionRepresentative, loadReserveFaction } from "./factions/Faction";
import { DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT, Layout, MODULE_TEMPLATES, StationStat, createModule, registerFactionModule, ModuleIntrinsic, generateModule, generateModuleImage, Module, registerModule, FLOOR_BUILD_COSTS, MAX_FLOORS } from './Module';
import { BaseScreen, ScreenType } from "./screens/BaseScreen";
import { accumulateOutcomes, generateSkitScript, generateSkitSummary, regenerateOutcomesForEnd, Outcome, ScriptEntry, SkitData, SkitType, updateCharacterArc } from "./Skit";
import { smartRehydrate } from "./SaveRehydration";
import { Emotion, EmotionPromptMap, getDefaultEmotionPromptMap } from "./actors/Emotion";
import { assignActorToRole } from "./utils";
import { v4 as generateUuid } from 'uuid';

type MessageStateType = any;
type ConfigType = any;
type InitStateType = any;
type ChatStateType = {
    saves: (SaveType | undefined)[]
    lastSaveSlot: number;
}

type TimelineEvent = {
    day: number;
    turn: number;
    description: string;
    skit?: SkitData;
}

type Timeline = TimelineEvent[];

export type SaveType = {
    player: {name: string, description: string};
    aide: {name: string, description: string, actorId?: string};
    solidSpirit?: boolean; // When true, the tower spirit renders without the ghostly effect (manifesting physically)
    directorModule: {name: string, roleName: string, module?: ModuleIntrinsic};
    echoes: (Actor | null)[]; // actors currently in echo slots (can be null for empty slots)
    actors: {[key: string]: Actor};
    factions: {[key: string]: Faction};
    bannedTags?: string[];
    layout: Layout;
    customModules?: {[key: string]: ModuleIntrinsic};
    day: number;
    turn: number;
    timeline?: Timeline;
    currentSkit?: SkitData;
    stationStats?: {[key in StationStat]: number};
    timestamp?: number; // Time of last save
    disableTextToSpeech?: boolean;
    disableEmotionImages?: boolean;
    disableDecorImages?: boolean;
    characterArtStyle?: ArtStyle;
    characterArtist?: string;
    attenuation?: string;
    typeOutSpeed?: number;
    reserveActors?: Actor[];
    activeActorId?: string; // Legacy single-active field; migrated into activeActorIds on load.
    activeActorIds?: string[]; // Summons currently active in the world, up to activeSummonCap. Others sit in the void.
    activeSummonCap?: number; // How many summons may be active at once (default 1; Multi-Summon Tokens raise it, max 3).
    sp?: number; // Summoner Points - earned 1 per skit section on skit end (and later from events).
    aestheticTokens?: number; // Shop: change one physical thing about a summon's appearance, chosen upon use.
    newSummonTokens?: number; // Shop: required to accept each summon beyond the first.
    gmPurchases?: { request: string; price: number; remark: string }[]; // Narrative-only Game Master grants (type 'other').
    equipmentArchive?: EquipmentItem[]; // Unequipped/lost item storage - the dedup layer AND the player's item pool for equipping.
    repairTokens?: number; // Shop: instantly restore a System item's durability.
    consumables?: { id: string; name: string; effect: string; remark: string }[]; // Usable items from the Game Master (effect tags: BOND:stat:+n, STAT:stat:+n, HEAL:n, NONE).
    locations?: {[id: string]: GameLocation}; // The location graph (Home is root); replaces the tower grid.
    currentLocationId?: string; // Where the player currently is.
    cityName?: string; // Optional player-set name for the city/setting the game takes place in.
    worldDetails?: string; // Optional player-set world/setting details that flavor how the world is handled.
    language?: string;
    tone?: string;
    disableImpersonation?: boolean;
    commsVisitors?: string[]; // List of actor IDs currently visiting the comms module (for faction representatives)
    activityLog?: ActivityEntry[]; // Tower Activity Log: what residents got up to while the player wasn't directly involved.
}

// A single Tower Activity Log entry - one line about what a resident did off-screen.
export type ActivityEntry = {
    id: string; // Unique id so a specific entry can be reverted.
    day: number;
    turn: number;
    actorId: string;
    actorName: string;
    line: string; // The single-sentence activity description shown in the log.
    stat?: string; // Optional tower stat affected by this activity.
    amount?: number; // Optional +1 / -1 nudge to that stat.
}

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    private currentSave: SaveType;
    private saves: (SaveType | undefined)[];
    private saveSlot: number = 0;
    public betaMode: boolean = false;
    // Flag/promise to avoid redundant concurrent requests for reserve actors
    public reserveActorsLoadPromise?: Promise<void>;
    private reserveFactionsLoadPromise?: Promise<void>;
    private generateAidePromise?: Promise<void>;
    public imageGenerationPromises: {[key: string]: Promise<string>} = {};
    private freshSave: SaveType;
    readonly SAVE_SLOTS = 10;
    readonly RESERVE_ACTORS = 30; // Deep pre-load so the summon app rarely shows 'waiting for signal'.
    readonly PREGEN_FACTION_COUNT = 3;
    readonly MAX_FACTIONS = 5;
    readonly FETCH_AT_TIME = 10;
    readonly MAX_PAGES = 200;
    readonly DEFAULT_TYPE_OUT_SPEED = 20;
    readonly bannedTagsDefault = [
        'FUZZ',
        'child',
        'teenager',
        'narrator',
        'underage',
        'multi-character',
        'multiple characters',
        'nonenglish',
        'non-english',
        'famous people',
        'celebrity',
        'real person',
        'feral',
        'sci-fi',
        'science fiction',
        'scifi',
        'cyberpunk',
        'space',
        'futuristic',
        'spaceship',
        'robot',
        'android',
        'cyborg',
        'mecha',
        'post-apocalyptic',
        'dystopian'
    ];
    // At least one of these is required for a character search; some sort of gender helps indicate that the card represents a singular person.
    readonly actorTags = ['male', 'female', 'woman', 'man', 'masculine', 'feminine', 'non-binary', 'trans', 'genderqueer', 'genderfluid', 'agender', 'androgyne', 'intersex', 'futa', 'futanari', 'hermaphrodite'];
    // At least one of these is required for a faction search; helps indicate that the card has a focus on setting or tone.
    readonly factionTags = ['fantasy', 'magic', 'medieval', 'kingdom', 'mythology', 'fairy tale', 'adventure', 'guild', 'setting', 'world', 'narrator', 'scenario'];
    readonly characterSearchQuery = `https://inference.chub.ai/search?first=${this.FETCH_AT_TIME}&exclude_tags={{EXCLUSIONS}}&page={{PAGE_NUMBER}}&tags={{SEARCH_TAGS}}&sort=random&asc=false&include_forks=false&nsfw=true&nsfl=false` +
        `&nsfw_only=false&require_images=false&require_example_dialogues=false&require_alternate_greetings=false&require_custom_prompt=false&exclude_mine=false&min_tokens=200&max_tokens=5000` +
        `&require_expressions=false&require_lore=false&mine_first=false&require_lore_embedded=false&require_lore_linked=false&my_favorites=false&inclusive_or=true&recommended_verified=false&count=false&min_tags=3`;
    readonly characterDetailQuery = 'https://inference.chub.ai/api/characters/{fullPath}?full=true';

    readonly TONE_MAP: {[key: string]: string} = {
        'Original': 'The modern world looks ordinary, but a hidden game runs beneath it, and the people the app summons are real. ' +
            'Stories here can vary widely in tone - from warm, low-stakes slice-of-life between the summoner and their summons to tense, dangerous events - but generally emphasize grounded, character-driven drama: unlikely bonds forming between a summoner and the people bound to them against their will, against a backdrop of quiet modern life and creeping unease.',
        'Gritty': 'The universe is a harsh and unforgiving landscape where survival is a constant struggle. ' +
            'Stories set in this universe tend to be dark and intense, with high stakes and morally complex characters. Themes of sacrifice, resilience, and the human spirit prevailing against all odds are common.',
        'Humorous': 'The universe is a whimsical and absurd place, where the bizarre and unexpected are commonplace. ' +
            'Stories set in this universe are lighthearted and comedic, often featuring eccentric characters and ridiculous situations. The tone is irreverent and playful, with a focus on humor and satire.',
        'Romantic': 'The universe is a lush and passionate realm, where love and desire are powerful forces that shape the lives of its inhabitants. ' +
            'Stories set in this universe are emotionally charged and erotic, often exploring complex relationships and intense emotions. The tone is sensual and evocative, with a focus on romance and interpersonal connections.',
    };

    private actorPageNumber = Math.floor(Math.random() * this.MAX_PAGES);
    private factionPageNumber = Math.floor(Math.random() * this.MAX_PAGES);

    private userId: string;
    private characterId: string;
    


    // Expose a simple grid size (can be tuned)
    public gridWidth = DEFAULT_GRID_WIDTH;
    public gridHeight = DEFAULT_GRID_HEIGHT;
    // Deprecated: use gridWidth and gridHeight instead
    public get gridSize() {
        return Math.max(this.gridWidth, this.gridHeight);
    }

    screenProps: any = {};

    initialized: boolean = false;

    // Callback to show priority messages in the tooltip bar
    private priorityMessageCallback?: (message: string, icon?: any, durationMs?: number) => void;

    /**
     * Register a callback to show priority messages in the tooltip bar.
     * This is typically set by the App component that has access to the TooltipContext.
     */
    setPriorityMessageCallback(callback: (message: string, icon?: any, durationMs?: number) => void) {
        this.priorityMessageCallback = callback;
    }

    /**
     * Show a priority message in the tooltip bar that temporarily overrides normal tooltips.
     * @param message The message to display
     * @param icon Optional icon to show with the message
     * @param durationMs How long to show the message (default: 5000ms)
     */
    showPriorityMessage(message: string, icon?: any, durationMs: number = 5000) {
        if (this.priorityMessageCallback) {
            this.priorityMessageCallback(message, icon, durationMs);
        } else {
            console.warn('Priority message callback not set:', message);
        }
    }

    private async generateModuleFromOutcome(outcome: Outcome, queuedModuleKeys?: Set<string>) {
        if (outcome.type !== 'newModule' || !outcome.module) {
            return;
        }

        const moduleData = outcome.module;
        const moduleName = moduleData.moduleName?.trim() || '';
        if (!moduleName) {
            return;
        }

        const moduleKey = moduleData.id || moduleName.toLowerCase();
        if (queuedModuleKeys?.has(moduleKey)) {
            return;
        }

        const save = this.getSave();
        const moduleAlreadyExistsById = !!(moduleData.id && save.customModules?.[moduleData.id]);
        const moduleAlreadyExistsByName = [...Object.values(save.customModules || {}), ...Object.values(MODULE_TEMPLATES)]
            .some(existingModule => !!existingModule.name && namesMatch(moduleName, existingModule.name));

        if (moduleAlreadyExistsById || moduleAlreadyExistsByName) {
            return;
        }

        queuedModuleKeys?.add(moduleKey);

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const module = await generateModule(moduleData.moduleName, this, moduleData.description, moduleData.roleName);
                if (module) {
                    const generatedModuleId = moduleData.id || generateUuid();
                    const currentSave = this.getSave();
                    currentSave.customModules = { ...(currentSave.customModules || {}), [generatedModuleId]: module };
                    registerModule(generatedModuleId, module);
                    this.saveGame();
                    this.showPriorityMessage(`New module "${moduleData.moduleName}" now available!`);
                    return;
                }
            } catch (err) {
                console.error(`Error generating module ${moduleData.moduleName} (attempt ${attempt + 1}/3):`, err);
            }
        }
    }

    private async generateActorFromOutcome(outcome: Outcome, queuedActorNames?: Set<string>) {
        console.log('generateActorFromOutcome');
        if (outcome.type !== 'newActor' || !outcome.actor) {
            return;
        }

        const actorData = outcome.actor;
        const actorName = actorData.name?.trim() || '';
        if (!actorName) {
            return;
        }

        const actorKey = actorName.toLowerCase();
        if (queuedActorNames?.has(actorKey)) {
            return;
        }

        const save = this.getSave();
        console.log('Nearly approved');
        const actorAlreadyExists = findBestNameMatch(actorName, Object.values(save.actors));
        if (actorAlreadyExists) {
            console.log(`Actor "${actorName}" already exists as "${actorAlreadyExists.name}". Skipping generation.`);
            return;
        }
        console.log('Approved for generation');

        queuedActorNames?.add(actorKey);

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                console.log('Generating actor from outcome:', actorName);
                const newActor = await loadReserveActor(actorData, this, true);
                if (newActor) {
                    const currentSave = this.getSave();
                    newActor.locationId = actorData.locationId || '';
                    newActor.origin = 'emergent';
                    currentSave.actors[newActor.id] = newActor;
                    newActor.factionId = actorData.factionId || '';
                    void generateBaseActorImage(newActor, this);
                    this.saveGame();
                    return;
                }
            } catch (err) {
                console.error(`Error generating actor ${actorName} (attempt ${attempt + 1}/3):`, err);
            }
        }
    }

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {

        super(data);
        const {
            characters,
            users,
            config,
            messageState,
            environment,
            initState,
            chatState
        } = data;

        console.log(chatState);
        this.saves = chatState?.saves || [];
        this.saveSlot = chatState?.lastSaveSlot || 0;

        this.betaMode = config?.beta_mode === "True";
        this.characterId = Object.keys(characters)[0];

        const layout = new Layout();
        // Center the starting modules in the 8x5 grid
        // For 8 wide: center is between columns 3 and 4, so use 3 and 4
        // For 5 tall: center is row 2, so use 1, 2, and 3
        const centerX = Math.floor(DEFAULT_GRID_WIDTH / 2);
        const centerY = Math.floor(DEFAULT_GRID_HEIGHT / 2);
        layout.setModuleAt(centerX, centerY + 1, createModule('director module', { id: `director-${centerX}-${centerY + 1}`, attributes: {} }));
        layout.setModuleAt(centerX - 1, centerY + 1, createModule('quarters', { id: `quarters-${centerX - 1}-${centerY + 1}`, attributes: {} }));
        layout.setModuleAt(centerX, centerY, createModule('echo chamber', { id: `echo-${centerX}-${centerY}`, attributes: {} }));
        layout.setModuleAt(centerX - 1, centerY, createModule('quarters', { id: `quarters-${centerX - 1}-${centerY}`, attributes: {} }));
        layout.setModuleAt(centerX, centerY - 1, createModule('generator', { id: `generator-${centerX}-${centerY - 1}`, attributes: {} }));
        layout.setModuleAt(centerX - 1, centerY - 1, createModule('comms', { id: `comms-${centerX - 1}-${centerY - 1}`, attributes: {} }));
        this.userId = Object.values(users)[0].anonymizedId;
        this.freshSave = { player: {name: Object.values(users)[0].name, description: Object.values(users)[0].chatProfile || ''}, 
            directorModule: {name: 'Magus\'s Study', roleName: 'Maid'},
            aide: { name: '', description: '' }, // No tower spirit in the Summoner Game; field retained inert for save-shape compatibility.
            echoes: [], actors: {}, factions: {}, layout: layout, day: 1, turn: 0, currentSkit: undefined, typeOutSpeed: this.DEFAULT_TYPE_OUT_SPEED, reserveActors: [],
            locations: { [HOME_LOCATION_ID]: createHomeLocation(0) }, currentLocationId: HOME_LOCATION_ID, disableTextToSpeech: true };

        // ensure at least one save exists and has a layout
        if (!this.saves.length) {
            this.saves.push(this.getFreshSave());
        } else {
            // Rehydrate saves with proper class instances
            this.saves = this.saves.map(save => this.rehydrateSave(save));
        }
        if (this.saves.length < this.SAVE_SLOTS) {
            // Fill out to SAVE_SLOTS with fresh saves
            for (let i = this.saves.length; i < this.SAVE_SLOTS; i++) {
                this.saves.push(undefined);
            }
        }
        this.currentSave = this.saves[this.saveSlot] || this.getFreshSave();

        /*if (this.betaMode) {

            console.log('Registering tools.');
            this.mcp.registerTool('modify-station-stat',
                {
                    title: 'Modify Tower Stat',
                    description: 'If events result in a change to a tower stat, use this tool to register a tower stat change.',
                    inputSchema: {
                        stat: z.enum(Object.values(StationStat) as [string, ...string[]]).describe('Tower stat to modify'),
                        change: z.number().min(-10).max(10).describe('Amount to change the stat by'),
                    }
                },
                async ({ stat, change }): Promise<CallToolResult> => {
                    // Eventually, we will attach this to some sort of resolution content for the current skit, to be displayed in SkitScreen before the "Close" button becomes available, and executed when the skit ends.
                    // this.getSave().currentSkit ...
                    // For now, we're just testing that it works.
                    console.log(`Tool called: modifyStationStat(${stat}, ${change})`);
                    return { content: [{type: 'text', text: `Tower stat ${stat} changed by ${change}.` }] };
                }
            );

            this.mcp.registerTool('modify-actor-stat', 
                {
                    title: 'Modify Actor Stat',
                    description: 'If events result in a change to an actor stat, use this tool to register an actor stat change.',
                    inputSchema: {
                        actor: z.string().min(1).describe('Name of the Actor whose stat is to be modified'),
                        stat: z.enum(Object.values(Stat) as [string, ...string[]]).describe('Actor stat to modify'),
                        change: z.number().min(-10).max(10).describe('Amount to change the stat by'),
                    }
                },
                async ({ actor, stat, change }): Promise<CallToolResult> => {
                    // Eventually, we will attach this to some sort of resolution content for the current skit, to be displayed in SkitScreen before the "Close" button becomes available, and executed when the skit ends.
                    // this.getSave().currentSkit ...
                    // For now, we're just testing that it works.
                    console.log(`Tool called: modifyActorStat(${actor}, ${stat}, ${change})`);
                    return { content: [{type: 'text', text: `Actor ${actor}'s stat ${stat} changed by ${change}.` }] };
                }
            );
        }*/
        
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {

        // Remove saves that have no actors or layout (they didn't even initialize an aide); set those indices to undefined
        this.saves = this.saves.map(save => (save && save.actors && Object.keys(save.actors).length > 0 && save.layout) ? save : undefined);

        this.currentSave = this.saves[this.saveSlot] || this.getFreshSave();

        return {
            success: true,
            error: null,
            initState: null,
            chatState: this.buildSaves(),
        };
    }

    pushMessage(message: string) {
        // (Formerly gated behind an anti-theft `isAuthenticated` check inherited from PARC, which
        // suppressed Chub message stats on unauthorized copies. Removed with the original author's
        // blessing so stats populate normally.)
        this.messenger.impersonate({
            speaker_id: this.characterId,
            is_main: false,
            parent_id: null,
            message: message
        });
    }

    /**
     * Advances a single turn without running a full skit, and generates one Tower Activity Log
     * entry describing what a random resident got up to. Fire-and-forget for the LLM call so the
     * UI stays responsive; the turn advances immediately.
     */
    /**
     * Validates a generated activity line. Returns a cleaned line, or null if the activity should be
     * discarded (gibberish, empty, too short, pathologically long, or pure punctuation).
     */
    validateActivityLine(raw: string): string | null {
        if (!raw) return null;
        let line = raw.replace(/\s*[\r\n]+\s*/g, ' ').replace(/^["']|["']$/g, '').trim();
        // Must contain actual letters (reject pure punctuation/symbol/number strings).
        if (!/[A-Za-z]/.test(line)) return null;
        // Reject lines that begin with a digit (the LLM's number-anchoring habit).
        if (/^\s*\d/.test(line)) return null;
        const words = line.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
        // Reject too-short (likely a fragment/error) or pathologically long output.
        if (words.length < 3) return null;
        if (words.length > 40) return null;
        // Reject lines that are mostly non-letter noise (gibberish guard).
        const letters = (line.match(/[A-Za-z]/g) || []).length;
        if (letters < line.length * 0.4) return null;
        // Soft cap for tidiness.
        if (words.length > 30) line = words.slice(0, 30).join(' ') + '...';
        return line;
    }

    async passTime(setScreenType: (type: ScreenType) => void): Promise<void> {
        // Advance time first so day/turn are current for the activity entry.
        this.incTurn(1, setScreenType);
        const save = this.getSave();

        // Pick a resident of the tower (or the bound tower spirit) - not away with a faction, not in stasis/dead.
        const candidates = Object.values(save.actors).filter(a =>
            !a.factionId &&
            !['cryo', 'dead'].includes(a.locationId || '')
        );
        if (candidates.length === 0) { this.saveGame(); return; }
        const actor = candidates[Math.floor(Math.random() * candidates.length)];
        const isSpirit = actor.id === save.aide.actorId;
        const role = getRole(actor, save) || 'resident';
        const proficiency = actor.getRoleProficiency(role);
        const statNames = Object.values(StationStat).join(', ');

        const subjectContext = isSpirit
            ? `${actor.name} is the tower's bound spirit and steward - a capricious, theatrical presence who has haunted these stones for two centuries. Describe something they got up to as the spirit of the tower (drifting through walls, tormenting the furniture, tending the wards, observing the residents), fitting their personality.`
            : `${actor.name} is the tower's ${role}` +
              (proficiency >= 7 ? ` and is notably skilled at it` : proficiency <= 3 ? ` but struggles with the work` : ``) + `.`;

        const prompt = `The following is a fantasy tower-management game set in the Spire, an isolated wizard's tower. ` +
            `Time has quietly passed. Describe, in ONE short sentence (no more than 20 words, never a paragraph), something that ${actor.name} got up to around the tower during this quiet stretch. ` +
            `Let their personality shape it. ${subjectContext} ` +
            `Personality/profile: ${actor.profile}\n\n` +
            `MOST of the time this should be a purely flavorful moment with no mechanical effect. Only OCCASIONALLY - when the activity clearly and notably helped or harmed the tower - include a single tower-stat change of exactly +1 or -1. ` +
            `Do not force one; a change should feel like an occasional pleasant surprise or minor setback, not a routine occurrence.\n` +
            `Format your reply as ONE line, and ALWAYS end with a required tag:\n` +
            `<the single sentence> ||STAT <one of: ${statNames}> <+1 or -1>\n` +
            `OR, for the common flavor-only case:\n` +
            `<the single sentence> ||NONE\n` +
            `The tag (either "||STAT ..." or "||NONE") is REQUIRED. Do not begin the sentence with a number. No name prefix, no quotation marks, no extra commentary.`;

        try {
            const rawResponse = await this.makeText({ prompt, max_tokens: 90, min_tokens: 5, include_history: false });
            if (!rawResponse) { this.saveGame(); return; }

            // A tag is required: either ||STAT ... or ||NONE. If neither is present, discard.
            const hasNone = /\|\|\s*NONE\b/i.test(rawResponse);
            const statSplit = rawResponse.split(/\|\|\s*STAT\s+/i);
            let statPart: string | null = statSplit.length > 1 ? statSplit[1] : null;
            let linePart = statSplit.length > 1 ? statSplit[0] : rawResponse.replace(/\|\|\s*NONE\b.*$/i, '');
            if (!statPart && !hasNone) {
                console.warn('passTime: activity discarded (missing required tag):', rawResponse);
                this.saveGame();
                return;
            }

            const line = this.validateActivityLine(linePart);
            if (!line) { console.warn('passTime: activity discarded by validation:', rawResponse); this.saveGame(); return; }

            const entry: ActivityEntry = { id: generateUuid(), day: save.day, turn: save.turn, actorId: actor.id, actorName: actor.name, line };

            // Parse and validate the optional stat directive.
            if (statPart) {
                const m = /([A-Za-z]+)\s*([+\-]\s*\d+)/.exec(statPart);
                if (m) {
                    const matchedStat = Object.values(StationStat).find(s => String(s).toLowerCase() === m[1].trim().toLowerCase());
                    const rawAmount = parseInt(m[2].replace(/\s+/g, ''), 10) || 0;
                    if (matchedStat && rawAmount !== 0 && save.stationStats && matchedStat in save.stationStats) {
                        const delta = rawAmount > 0 ? 1 : -1;
                        save.stationStats[matchedStat as StationStat] = Math.max(1, Math.min(10, save.stationStats[matchedStat as StationStat] + delta));
                        entry.stat = String(matchedStat);
                        entry.amount = delta;
                        if (!isSpirit) actor.adjustRoleProficiency(role, delta);
                    }
                }
            }

            if (!save.activityLog) save.activityLog = [];
            save.activityLog.push(entry);
            if (save.activityLog.length > 100) save.activityLog = save.activityLog.slice(-100);
            this.saveGame();
        } catch (err) {
            console.error('passTime activity generation failed', err);
            this.saveGame();
        }
    }

    /**
     * Reverts a logged activity by id: removes it from the log and reverses its tower-stat change
     * (clamped). Hidden proficiency is intentionally left as-is.
     */
    revertActivity(entryId: string): void {
        const save = this.getSave();
        if (!save.activityLog) return;
        const idx = save.activityLog.findIndex(e => e.id === entryId);
        if (idx === -1) return;
        const entry = save.activityLog[idx];
        if (entry.stat && entry.amount && save.stationStats && entry.stat in save.stationStats) {
            // Reverse the applied change, clamped to 1-10.
            save.stationStats[entry.stat as StationStat] = Math.max(1, Math.min(10, save.stationStats[entry.stat as StationStat] - entry.amount));
        }
        save.activityLog.splice(idx, 1);
        this.saveGame();
    }

    incTurn(numberOfTurns: number = 1, setScreenType: (type: ScreenType) => void) {
        const save = this.getSave();
        save.turn += numberOfTurns;
        
        if (save.turn >= 4) {
            save.turn = 0;
            save.day += 1;
            // New day logic.
            // Increment actor role count
            for (let actor of Object.values(save.actors).filter(a => !a.factionId)) {
                // Find non-quarters module assigned to this actor and increment held role count
                const targetModule = save.layout.getModulesWhere(m => m.ownerId === actor.id && m.type !== 'quarters')[0];
                const roleName: string = targetModule?.getAttribute('role') || '';
                if (roleName && Object.keys(actor.heldRoles).indexOf(roleName) !== -1) {
                    actor.heldRoles[roleName] += 1;
                }
            }
        }

        // When incrementing turn, maybe move some actors around in the layout.
        for (const actorId in save.actors) {
            const actor = save.actors[actorId];
            try {
                if (['cryo', 'dead'].includes(actor.locationId)) {
                    // Cryo or dead patients don't move.
                    continue;
                }
                if (actor.id == save.aide.actorId) {
                    // Aide goes nowhere by default.
                    actor.locationId = '';
                } else if (!actor.locationId || save.layout.getModulesWhere(m => actor.locationId === m.id).length > 0) {
                    // If actor has no location or a location on the PARC (not away to a faction at the moment)
                    // Check if actor didn't move anywhere in the last skit, then put them in a random non-quarters module:
                    const previousSkit = (save.timeline && save.timeline.length > 0) ? save.timeline[save.timeline.length - 1].skit : undefined;
                    if ((!previousSkit || previousSkit.script.every(entry => !entry.movements || !Object.keys(entry.movements).some(moverId => moverId === actor.id)))) {
                        // Eligible modules are any non-quarters module with fewer than four people at that location, or their own quarters:
                        const eligibleModules = save.layout.getModulesWhere(m => (m.type !== 'quarters' && save.layout.getActorsAtModule(m, save).length < 4) || (m.type === 'quarters' && m.ownerId == actorId));
                        if (eligibleModules.length > 0) {
                            actor.locationId = eligibleModules.sort(() => Math.random() - 0.5)[0]?.id || '';
                        }
                    }
                }
                console.log(`Moved actor ${actor.name} to location ${actor.locationId}`);
                // If no patients exist, put the aide in the echo chamber:
                if (actor.id === save.aide.actorId && Object.values(save.actors).filter(a => !a.factionId && a.id !== save.aide.actorId).length === 0) {
                    const echoModule = save.layout.getModulesWhere(m => m.type === 'echo chamber')[0];
                    if (echoModule) {
                        actor.locationId = echoModule.id;
                    }
                }
            } catch (e) {
                console.error(`Error updating actor ${actor.name}:`, e);
            }
        }

        // Move a random faction rep to comms room, if any factions exist:
        const commsModule = save.layout.getModulesWhere(m => m.type === 'comms')[0];
        const eligibleFactions = Object.values(save.factions).filter(faction => faction.reputation > 0 && faction.representativeId && save.actors[faction.representativeId]);
        // If there are eligible factions and a comms module, and there is at least one non-remote actor other than the aide:
        save.commsVisitors = []; // Clear visitors.
        if (eligibleFactions.length > 0 && commsModule && Object.values(save.actors).filter(a => !a.factionId && a.id !== save.aide.actorId).length > 0) {
            const randomFaction = eligibleFactions.sort(() => Math.random() - 0.5)[0];
            
            // Add the faction rep to the comms array
            const factionRep = save.actors[randomFaction.representativeId || ''];
            if (factionRep) {
                save.commsVisitors.push(factionRep.id);
            }
        }

        this.currentSave = {...save}; // Update the current save slot with the modified save, ensuring a new object reference.
        this.saveGame();

        if (save.currentSkit) {
            console.log('In a skit');
            // If there's still a current skit, then it hasn't even started. Change screens back to SkitScreen:
            setScreenType(ScreenType.SKIT);
        } else {
            setScreenType(ScreenType.STATION);
        }
    }

    /**
     * Rehydrate a save object by restoring proper class instances
     */
    private rehydrateSave(save: any): SaveType {
        console.log('Rehydrating save:', save);
        
        // Restore turn from old phase variable.
        if (save && save['turn'] === undefined) {
            save['turn'] = save['phase'] || 0;
        }
        // Use smart rehydration to automatically detect and restore all nested objects
        const hydrated = smartRehydrate(save) as SaveType;

        return hydrated;
    }


    buildSaves(): ChatStateType {
        return {
            saves: this.saves,
            lastSaveSlot: this.saveSlot
        }
    }

    newGame() {
        // find first undefined save slot:
        this.saveSlot = this.saves.findIndex(save => !save);
        if (this.saveSlot === -1) {
            // Yikes, overwrite the last one. Should avoid this in the UI.
            this.saveSlot = Math.min(this.SAVE_SLOTS - 1, this.saves.length - 1);
        }
        this.currentSave = this.getFreshSave();
        this.newGameNeedsRoomArt = true; // Defer starting-room art until the game is actually running (see startGame).
        this.saveGame();
    }

    // Regenerates images for all currently-placed modules using their imagePrompt, one at a time
    // to avoid overloading the image service. Runs in the background; failures are non-fatal and
    // simply leave the placeholder image in place.
    async refreshStartingModuleImages(): Promise<void> {
        try {
            const modules = this.getSave().layout.getModulesWhere(() => true);
            let anyUpdated = false;
            let savedSinceLast = 0;
            for (const module of modules) {
                try {
                    // generateModuleImage expects a ModuleIntrinsic; build one from the live module,
                    // then write the freshly generated URLs back into the module's instance attributes
                    // so the display layer (which reads getAttribute('defaultImageUrl')) picks them up.
                    const intrinsic = { ...module.getAttributes(), cost: module.getAttribute('cost') || {} };
                    await generateModuleImage(intrinsic, this);
                    if (intrinsic.baseImageUrl && intrinsic.defaultImageUrl) {
                        module.attributes = {
                            ...(module.attributes || {}),
                            baseImageUrl: intrinsic.baseImageUrl,
                            defaultImageUrl: intrinsic.defaultImageUrl,
                        };
                        anyUpdated = true;
                        savedSinceLast++;
                        // Save every few images so progress persists without a network write per image.
                        if (savedSinceLast >= 3) { this.saveGame(); savedSinceLast = 0; }
                    }
                } catch (err) {
                    console.error(`Failed to auto-generate image for module ${module.type}`, err);
                }
            }
            if (anyUpdated) this.saveGame();
        } catch (err) {
            console.error('Error during starting module image refresh', err);
        }
    }

    saveGame() {
        if (this.currentSave.currentSkit && !this.betaMode) {
            return; // Don't save during an active skit (except in beta mode; just trying this out first).
        }
        // Update timestamp on current save
        this.currentSave.timestamp = Date.now();
        this.saves[this.saveSlot] = this.currentSave;
        const builtSaves = this.buildSaves();
        if (builtSaves.saves.some(save => save)) {
            void this.messenger.updateChatState(builtSaves);
        } else {
            console.warn('No saves to update in chat state; skipping messenger update.');
        }
    }

    saveAllGames() {
        void this.messenger.updateChatState(this.buildSaves());
    }

    deleteSave(slotIndex: number) {
        this.saves[slotIndex] = undefined;
        this.saveAllGames();
    }

    getSave(): SaveType {
        return this.currentSave;
    }

    getAllSaves(): (SaveType | undefined)[] {
        return this.saves;
    }

    getCurrentSlot(): number {
        return this.saveSlot;
    }

    getFreshSave(): SaveType {
        return this.rehydrateSave(JSON.parse(JSON.stringify(this.freshSave)));
    }

    loadSave(slotIndex: number) {
        this.saveSlot = slotIndex;
        this.currentSave = this.saves[this.saveSlot] || this.getFreshSave();
        this.initialized = false;
        this.startGame();
    }

    saveToSlot(slotIndex: number) {
        // Copy current save to target slot
        this.saves[slotIndex] = JSON.parse(JSON.stringify(this.currentSave));
        this.saveSlot = slotIndex;
        this.saveGame();
    }

    newGameNeedsRoomArt = false;

    startGame() {
        if (this.initialized) return;
        this.initialized = true;
        // Called when a game is loaded or a new game is started
        console.log('Starting game...');

        if (!this.getSave().actors[this.getSave().aide.actorId || '']) {
            this.getSave().aide.actorId = undefined;
        } else {
            this.getSave().actors[this.getSave().aide.actorId || ''].origin = 'aide';
        }

        // Director module handling:
        // Create default director module if missing.
        if (!this.getSave().directorModule) {
            this.getSave().directorModule = { ...this.freshSave.directorModule };
        }

        // Currently, if a new module doesn't complete generation before the game is closed, it will never be generated; this could catch ungenerated ones.
        // this.generateUncreatedModules();
        
        const placeholderModule = {
            name: this.getSave().directorModule.name,
            skitPrompt: 'Private chambers are personal living spaces for the tower\'s residents. Scenes here often involve personal interactions:  revelations, troubles, interests, or relaxation.',
            imagePrompt: 'A cozy tower bedchamber with a bed, personal storage, and warm lantern light, reflecting the occupant\'s personality.',
            baseImageUrl: 'https://media.charhub.io/5e39db53-9d66-459d-8926-281b3b089b36/8ff20bdb-b719-4cf7-bf53-3326d6f9fcaa.png', 
            defaultImageUrl: 'https://media.charhub.io/99ffcdf5-a01b-43cf-81e5-e7098d8058f5/d1ec2e67-9124-4b8b-82d9-9685cfb973d2.png',
            role: this.getSave().directorModule.roleName,
            roleDescription: '',
            cost: {
                Wealth: 3,
            },
            action: 
                (module: Module, stage: Stage, setScreenType: (type: ScreenType) => void) => {
                    stage.setSkit({
                        type: SkitType.DIRECTOR_MODULE,
                        moduleId: module.id,
                        script: [],
                        generating: true,
                        context: {},
                    });
                    setScreenType(ScreenType.SKIT);
                }
        };

        // No generated module; generate it now.
        if (!this.getSave().directorModule.module) {
            // Register placeholder:
            registerModule('director module',
                placeholderModule
            );

            // Kick off director module generation
            generateModule(this.getSave().directorModule.name, this, 
                `This is a room designed specifically around the Magus, ${this.getSave().player.name}, and their needs or tastes.\n` +
                `About the Magus, ${this.getSave().player.name}:\n${this.getSave().player.description}`,
                this.getSave().directorModule.roleName).then(module => {
                    if (module) {
                        this.getSave().directorModule.module = module;
                        registerModule('director module', module, placeholderModule.action);
                        this.saveGame();
                    }
            });
        } else {
            // Register existing director module
            registerModule('director module', this.getSave().directorModule.module || placeholderModule, placeholderModule.action);
        }

        if (!this.getSave().characterArtStyle) {
            this.getSave().characterArtStyle = 'original';
        }

        if (this.getSave().typeOutSpeed === undefined) {
            this.getSave().typeOutSpeed = this.DEFAULT_TYPE_OUT_SPEED;
        }

        // Initialize reserveActors if missing
        if (!this.getSave().reserveActors) {
            this.getSave().reserveActors = [];
        }

        this.generateAide();
        if (!this.generateAidePromise) {
            // Load these if only a fresh aide is not being generated (trying to reduce concurrent generation requests)
            this.loadReserveActors();
            this.loadReserveFactions();
        }

        const save = this.getSave();
        // Initialize stationStats if missing
        if (!save.stationStats || Object.keys(save.stationStats).length < 6) {
            save.stationStats = {
                'Arcanum': 3,
                'Comfort': 3,
                'Provision': 3,
                'Security': 3,
                'Harmony': 3,
                'Wealth': 3
            };
        }
        if (!save.factions) {
            save.factions = {};
        }

        // Clean out remote actors that aren't supported by current factions
        const idsToRemove: string[] = [];
        Object.values(save.actors).filter(actor => actor.factionId && (!save.factions || !Object.values(save.factions).some(faction => faction.id === actor.factionId))).forEach(actor => {
            idsToRemove.push(actor.id);
        });
        idsToRemove.forEach(id => {
            delete save.actors[id];
        });

        // Register custom modules:
        if (save.customModules) {
            Object.entries(save.customModules).forEach(([key, moduleIntrinsic]) => {
                registerModule(key, moduleIntrinsic);
            });
        }

        // Register faction modules and repair faction reps that don't have a factionId set:
        Object.values(save.factions).forEach(faction => {
            if (faction.module) {
                console.log(`Registering module ${faction.module.name} for faction ${faction.name}`);
                registerFactionModule(faction, faction.id, faction.module);
            } else if (faction.reputation >= 5) {
                // Kick off module generation for this faction:
                console.log('Generating module for faction:', faction.name);
                generateFactionModule(faction, this).then(moduleName => {
                    if (moduleName) {
                        this.showPriorityMessage(`New module "${moduleName}" now available!`);
                    }
                });
            }
            if (faction.representativeId && save.actors[faction.representativeId]) {
                const repActor = save.actors[faction.representativeId];
                repActor.origin = 'faction';
                if (repActor.factionId !== faction.id) {
                    console.log(`Repairing factionId for representative ${repActor.name} of faction ${faction.name}`);
                    repActor.factionId = faction.id;
                }
            }
        });

        // Rebuild outcome characters and modules that never successfully generated. Go through skits and find newActor and newModule outcomes and search the existing customModules and actors to verify they exist.
        const queuedActorNames = new Set<string>();
        const queuedModuleKeys = new Set<string>();
        for (const timelineEntry of save.timeline || []) {
            if (!timelineEntry.skit) {
                continue;
            }

            const timelineSkit = timelineEntry.skit;
            const endedOnCurrentFinalEntry = (timelineSkit.currentIndex ?? (timelineSkit.script.length - 1)) >= (timelineSkit.script.length - 1);
            const outcomeEntries: ScriptEntry[] = [...timelineSkit.script];
            if (endedOnCurrentFinalEntry && (timelineSkit.outcomes?.length || 0) > 0) {
                outcomeEntries.push({
                    speaker: 'NARRATOR',
                    message: '',
                    speechUrl: '',
                    outcomes: timelineSkit.outcomes
                });
            }

            const outcomes = accumulateOutcomes(outcomeEntries, this) || [];
            for (const outcome of outcomes) {
                if (outcome.type === 'newModule' && outcome.module) {
                    void this.generateModuleFromOutcome(outcome, queuedModuleKeys);
                } else if (outcome.type === 'newActor' && outcome.actor) {
                    void this.generateActorFromOutcome(outcome, queuedActorNames);
                }
            }
        }

        save.layout.getModulesWhere(m => true).forEach(module => {
            if (!Object.keys(MODULE_TEMPLATES).includes(module.type)) {
                console.log(`Removing unknown module type ${module.getAttribute('name')} from layout.`);
                save.layout.removeModule(module);
            }
        });

        // Summoner Game: sprites are NOT generated automatically. Summons show the bot's own base
        // image (avatarImageUrl) until the player deliberately generates a game sprite from the
        // character detail view. This keeps the image service from grinding through portraits for
        // candidates and summons the player may never care about. (The manual "regenerate base
        // image" control lives in ActorDetailScreen.)
        //
        // Previously this block auto-generated a base/emotion image for every echo actor and every
        // saved actor with a missing image, one at a time - re-enable per-actor via the detail view.

        // Now that the game is fully initialized and running, kick off starting-room art in the
        // background (only for a brand-new game). Fire-and-forget so it never blocks startup.
        if (this.newGameNeedsRoomArt) {
            this.newGameNeedsRoomArt = false;
            void this.refreshStartingModuleImages();
        }

        this.summaryCheck();
    }

    getGenerateAidePromise(): Promise<void> | undefined {
        return this.generateAidePromise;
    }

    /**
     * On a new game, generate the introductory scene from the player's profile, using the same
     * loading-screen slot the tower-spirit ("aide") generation used to occupy. No aide/tower spirit
     * is created any more. The intro establishes WHO THE PLAYER IS and their discovery of the app;
     * the BEGINNING skit prompt (see Skit.ts) reads the player profile, defaulting to the player's
     * own home as a neutral starting point when the profile gives no clearer setting.
     *
     * Kept the name generateAide / generateAidePromise so MenuScreen and LoadingScreen route through
     * it unchanged - it now yields an intro skit rather than a steward actor.
     */
    async generateAide() {
        if (this.generateAidePromise) return this.generateAidePromise;

        const save = this.getSave();
        // Only generate an intro for a genuinely fresh game (no scenes have happened yet).
        const alreadyStarted = (save.timeline && save.timeline.length > 0) || save.currentSkit;
        if (alreadyStarted) return undefined;

        this.generateAidePromise = (async () => {
            const introSkit: SkitData = {
                type: SkitType.BEGINNING,
                moduleId: HOME_LOCATION_ID,
                script: [],
                generating: true,
                context: {},
            };
            this.setSkit(introSkit);
            try {
                // Generate the opening script here, during loading, so it's ready when we reach the scene.
                const entries = await generateSkitScript(introSkit, this);
                introSkit.script = entries;
            } catch (e) {
                console.warn('Intro generation failed; entering the intro scene un-generated.', e);
            } finally {
                introSkit.generating = false;
                this.getSave().currentSkit = introSkit;
                this.saveGame();
            }
            // Seed three starting locations to travel to right away (backstory-driven, generic fallback).
            await this.seedStartingLocations();
            this.generateAidePromise = undefined;
            this.loadReserveActors();
        })();
        return this.generateAidePromise;    }

    async loadReserveActorFromFullPath(fullPath: string) {
        console.log('Loading reserve actor from fullPath:', fullPath);
        if (this.reserveActorsLoadPromise) return this.reserveActorsLoadPromise;

        this.reserveActorsLoadPromise = (async () => {
            try {
                console.log('Loading targeted reserve actor...');
                const newActor = await loadReserveActorFromFullPath(fullPath, this);
                if (newActor !== null) {
                    this.getSave().reserveActors = [...(this.getSave().reserveActors || []), newActor];
                    this.saveGame();
                } else {
                    this.showPriorityMessage(`Failed to load character ${fullPath}.`);
                }
            } catch (err) {
                console.error('Error loading reserve actors', err);
            }
        })();

        this.reserveActorsLoadPromise?.then(() => {
            void this.ensureReserveTraits();
            this.reserveActorsLoadPromise = undefined;
        });

        return this.reserveActorsLoadPromise;
    }

    private searchCooldownUntil: number = 0; // Backoff after a failed/rate-limited character search - the UI re-triggers fills aggressively when the pool is empty, so without this a 429 becomes a hammering loop.
    private ensureTraitsPromise?: Promise<void>;

    /**
     * Second-pass trait assignment over the reserve: walks candidates one at a time (sequential,
     * deduped) and assigns 3-7 traits to any who lack them. Runs after fills and can be kicked any
     * time; cheap no-op when everyone is traited.
     */
    async ensureReserveTraits(): Promise<void> {
        if (this.ensureTraitsPromise) return this.ensureTraitsPromise;
        this.ensureTraitsPromise = (async () => {
            const pending = (this.getSave().reserveActors || []).filter(a => a && !a.traitsAssigned);
            if (pending.length > 0) console.log(`[traits] reserve pass starting: ${pending.length} candidate(s) pending`);
            for (const actor of pending) {
                // Per-actor isolation: one bad candidate must not abort the rest of the walk
                // (an early throw here would otherwise livelock the pass at that actor forever).
                try {
                    await assignTraitsToActor(actor, this);
                } catch (e) {
                    console.warn(`[traits] skipping ${actor?.name || 'unknown'} after error`, e);
                    if (actor) actor.traitsAssigned = true; // don't retry a poisoned candidate every pass
                }
                this.saveGame();
            }
            this.ensureTraitsPromise = undefined;
        })();
        return this.ensureTraitsPromise;
    }

    async loadReserveActors() {
        // If a load is already in-flight, return the existing promise to dedupe concurrent calls
        if (this.reserveActorsLoadPromise) return this.reserveActorsLoadPromise;
        // Respect the cooldown: return quietly instead of hammering a rate-limited endpoint.
        if (Date.now() < this.searchCooldownUntil) return;

        this.reserveActorsLoadPromise = (async () => {
            try {
                console.log('Loading reserve actors...');
                let reserveActors = this.getSave().reserveActors || [];
                while (reserveActors.length < this.RESERVE_ACTORS) {
                    // Populate reserveActors; this is loaded with data from a service, calling the characterServiceQuery URL:
                    const exclusions = (this.getSave().bannedTags || []).concat(this.bannedTagsDefault).map(tag => encodeURIComponent(tag)).join('%2C');
                    const response = await fetch(this.characterSearchQuery
                        .replace('{{PAGE_NUMBER}}', this.actorPageNumber.toString())
                        .replace('{{EXCLUSIONS}}', exclusions ? exclusions + '%2C' : '')
                        .replace('{{SEARCH_TAGS}}', this.actorTags.concat(this.actorTags).join('%2C')));
                    if (!response.ok) {
                        // Rate-limited (429) or otherwise failing: back off for 30s rather than
                        // parsing an HTML error page as JSON and churning the loop.
                        console.warn(`Character search returned ${response.status}; backing off for 30s.`);
                        this.searchCooldownUntil = Date.now() + 30_000;
                        break;
                    }
                    const searchResults = await response.json();
                    console.log(searchResults);
                    // Need to do a secondary lookup for each character in searchResults, to get the details we actually care about:
                    const basicCharacterData = searchResults.data?.nodes.filter((item: string, index: number) => index < this.RESERVE_ACTORS - reserveActors.length).map((item: any) => item.fullPath) || [];
                    if (searchResults.data?.nodes.length === 0) {
                        console.warn('No more characters found from search results; resetting page number to 1 to retry with the same parameters.');
                        this.actorPageNumber = 1;
                    } else {
                        this.actorPageNumber = (this.actorPageNumber % this.MAX_PAGES) + 1;
                    }
                    console.log(basicCharacterData);

                    const newActors: Actor[] = await Promise.all(basicCharacterData.map(async (fullPath: string) => {
                        return loadReserveActorFromFullPath(fullPath, this);
                    }));

                    this.getSave().reserveActors = [...this.getSave().reserveActors || [], ...newActors.filter(a => a !== null)];
                    reserveActors = this.getSave().reserveActors || [];
                }
                this.saveGame();
            } catch (err) {
                console.error('Error loading reserve actors', err);
            }
        })();

        this.reserveActorsLoadPromise?.then(() => {
            this.reserveActorsLoadPromise = undefined;
        });

        return this.reserveActorsLoadPromise;
    }

    /**
     * Bind a candidate summon into the roster. Tower-independent (no rooms/quarters): the summon is
     * added to save.actors, removed from the reserve pool, made the active summon if none is active,
     * and greeted with an intro skit. Works WITHOUT a ready portrait - the image backfills after.
     * Returns the actorId so the caller can route into the intro skit.
     */
    /** Whether a new summon can be accepted right now, and why not if it can't. */
    canAcceptSummon(): { allowed: boolean; reason?: string } {
        const save = this.getSave();
        const rosterCount = this.getRosterSummons().length;
        if (rosterCount >= 1 && (save.newSummonTokens || 0) < 1) {
            return { allowed: false, reason: 'Requires a New Summon Token (50 SP in the Shop).' };
        }
        return { allowed: true };
    }

    acceptSummon(actor: Actor): string {
        const save = this.getSave();
        const gate = this.canAcceptSummon();
        if (!gate.allowed) return '';
        // Each summon beyond the first consumes a New Summon Token.
        if (this.getRosterSummons().length >= 1) {
            save.newSummonTokens = (save.newSummonTokens || 0) - 1;
        }
        save.actors[actor.id] = actor;
        save.reserveActors = (save.reserveActors || []).filter(a => a.id !== actor.id);
        // Backfill: a fast swipe can accept a candidate before the reserve trait pass reached them.
        if (!actor.traitsAssigned) {
            void assignTraitsToActor(actor, this).then(() => this.saveGame());
        }
        // Join the actives if there's room under the cap.
        const activeIds = this.getActiveIds();
        if (activeIds.length < this.getActiveSummonCap()) {
            activeIds.push(actor.id);
        }
        // Land the new summon wherever the player currently is.
        actor.locationId = this.getCurrentLocationId();
        this.setSkit({
            type: SkitType.INTRO_CHARACTER,
            actorId: actor.id,
            moduleId: actor.locationId,
            script: [],
            generating: true,
            context: {}
        });
        this.saveGame();
        // Keep a candidate ready for the next pull.
        this.loadReserveActors();
        return actor.id;
    }

    /** Discard a candidate the player swiped away and top the pool back up so a next card is ready. */
    rejectSummon(actor: Actor): void {
        const save = this.getSave();
        save.reserveActors = (save.reserveActors || []).filter(a => a.id !== actor.id);
        this.saveGame();
        this.loadReserveActors();
    }

    // ---- Location graph -------------------------------------------------------------------------

    /** All locations, self-healing: guarantees Home exists (older saves / rehydration). */
    getLocations(): {[id: string]: GameLocation} {
        const save = this.getSave();
        if (!save.locations) save.locations = {};
        if (!save.locations[HOME_LOCATION_ID]) {
            save.locations[HOME_LOCATION_ID] = createHomeLocation(this.getElapsedTurns());
        }
        if (!save.currentLocationId || !save.locations[save.currentLocationId]) {
            save.currentLocationId = HOME_LOCATION_ID;
        }
        return save.locations;
    }

    getCurrentLocationId(): string {
        this.getLocations();
        return this.getSave().currentLocationId || HOME_LOCATION_ID;
    }

    getCurrentLocation(): GameLocation {
        const locations = this.getLocations();
        return locations[this.getCurrentLocationId()] || locations[HOME_LOCATION_ID];
    }

    /** Move to a location: mark it visited, run the archive sweep, generate its background if needed. */
    travelToLocation(id: string): void {
        const locations = this.getLocations();
        const dest = locations[id];
        if (!dest) return;
        dest.archived = false;
        dest.lastVisitedTurn = this.getElapsedTurns();
        this.getSave().currentLocationId = id;
        this.archiveStaleLocations();
        this.saveGame();
        void this.ensureLocationBackground(dest);
    }

    /**
     * Create a sub-location under a parent and attach it. This is the hook skit outcomes will call
     * to birth discovered places (once Skit.ts is converted); the location screen's Explore action
     * uses it now with curated placeholders.
     */
    spawnSubLocation(parentId: string, spec: { name: string; description: string; population?: string; tags?: string[] }): GameLocation {
        const locations = this.getLocations();
        const parent = locations[parentId] || locations[HOME_LOCATION_ID];
        const loc = createLocation({ ...spec, parentId: parent.id, turn: this.getElapsedTurns() });
        locations[loc.id] = loc;
        if (!parent.childIds.includes(loc.id)) parent.childIds.push(loc.id);
        this.saveGame();
        return loc;
    }

    /**
     * On a new game, seed at least three non-Home locations the player can travel to right away.
     * These are top-level places out in the world. If the player's profile or world details give
     * something to work with, they're generated to fit; otherwise three generic modern spots are
     * drawn from the curated pool. Always yields three, and never blocks the game if generation fails.
     */
    async seedStartingLocations(): Promise<void> {
        const save = this.getSave();
        const existingNonHome = Object.values(this.getLocations()).filter(l => !l.isHome);
        if (existingNonHome.length >= 3) return;

        type Spec = { name: string; description: string; population?: string; tags?: string[] };
        let specs: Spec[] = [];

        const profile = (save.player?.description || '').trim();
        const world = `${save.cityName ? `City/Setting: ${save.cityName}. ` : ''}${save.worldDetails || ''}`.trim();
        const hasBackstory = profile.length > 40 || world.length > 0;

        if (hasBackstory) {
            try {
                const prompt = `{{messages}}You are generating starting locations for a grounded, modern-day narrative game. ` +
                    `Based on the player's profile and world details below, invent exactly THREE ordinary real-world places (NOT the player's home) that fit their life and setting - places they plausibly frequent or could wander into. ` +
                    `Return ONLY three lines, no preamble, each formatted exactly as:\nNAME | one-sentence description | who is typically found there\n\n` +
                    (world ? `World details: ${world}\n` : '') +
                    (profile ? `Player profile: ${profile}\n` : '');
                const text = await this.makeText({ prompt, max_tokens: 220, min_tokens: 20, include_history: false });
                for (const line of (text || '').split('\n')) {
                    const parts = line.split('|').map(p => p.trim());
                    if (parts.length >= 2 && parts[0] && !/^name$/i.test(parts[0])) {
                        specs.push({ name: parts[0].replace(/^[-*\d.\s]+/, ''), description: parts[1], population: parts[2] || undefined });
                    }
                    if (specs.length >= 3) break;
                }
            } catch (e) {
                console.warn('Starting-location generation failed; using generic places.', e);
            }
        }

        // Fill any shortfall (or the whole set) from the curated generic pool.
        if (specs.length < 3) {
            const pool = [...DISCOVERABLE_PLACES].sort(() => Math.random() - 0.5);
            for (const p of pool) {
                if (specs.length >= 3) break;
                if (!specs.some(s => s.name.toLowerCase() === p.name.toLowerCase())) specs.push(p);
            }
        }

        const locations = this.getLocations();
        for (const spec of specs.slice(0, 3)) {
            const loc = createLocation({ name: spec.name, description: spec.description, population: spec.population, tags: spec.tags, parentId: null, turn: this.getElapsedTurns() });
            locations[loc.id] = loc; // top-level: reachable from Home via the "Elsewhere" travel list
        }
        this.saveGame();
    }

    /** Home never archives; any other location unvisited for ARCHIVE_AFTER_TURNS turns is archived. */
    archiveStaleLocations(): void {
        const turn = this.getElapsedTurns();
        for (const loc of Object.values(this.getLocations())) {
            if (loc.isHome) { loc.archived = false; continue; }
            loc.archived = (turn - loc.lastVisitedTurn) >= ARCHIVE_AFTER_TURNS;
        }
    }

    /** Lazily generate a location background once, caching it on the location. Best-effort. */
    async ensureLocationBackground(loc: GameLocation): Promise<void> {
        if (loc.backgroundUrl || loc.backgroundPending) return;
        if (this.getSave().disableDecorImages) return;
        loc.backgroundPending = true;
        try {
            const url = await this.makeImage({
                prompt: `A modern-world location background with no people in it: ${loc.name}. ${loc.description} ` +
                    `Rendered as an atmospheric visual-novel background, empty of characters.`,
                aspect_ratio: AspectRatio.WIDESCREEN_HORIZONTAL
            }, '');
            if (url) loc.backgroundUrl = url;
        } catch (e) {
            console.warn('Location background generation failed', e);
        } finally {
            loc.backgroundPending = false;
            this.saveGame();
        }
    }

    // ---- The void & active summon --------------------------------------------------------------

    /** Monotonic elapsed-turn count (day*4 + turn). Used for archiving and recovery timers, since
     *  save.turn alone only cycles 0-3 within a day. */
    getElapsedTurns(): number {
        const save = this.getSave();
        return (save.day || 1) * 4 + (save.turn || 0);
    }

    /** The player's summons (origin 'patient'), across both the world and the void. */
    getRosterSummons(): Actor[] {
        return Object.values(this.getSave().actors).filter(a => a && a.origin === 'patient');
    }

    /** Self-healing list of active summon ids: migrates the legacy single field, drops invalid ids, trims to cap. */
    getActiveIds(): string[] {
        const save = this.getSave();
        if (!save.activeActorIds) {
            save.activeActorIds = save.activeActorId ? [save.activeActorId] : [];
            save.activeActorId = undefined;
        }
        save.activeActorIds = save.activeActorIds.filter(id => save.actors[id] && save.actors[id].origin === 'patient');
        const cap = this.getActiveSummonCap();
        while (save.activeActorIds.length > cap) {
            const removed = save.activeActorIds.shift();
            if (removed && save.actors[removed]) {
                this.stripTemporaryEquipment(save.actors[removed]);
                save.actors[removed].locationId = 'cryo';
            }
        }
        return save.activeActorIds;
    }

    getActiveSummonCap(): number {
        return Math.min(3, Math.max(1, this.getSave().activeSummonCap || 1));
    }

    getActiveSummons(): Actor[] {
        const save = this.getSave();
        return this.getActiveIds().map(id => save.actors[id]).filter(Boolean);
    }

    /** First active summon (or null) - convenience for single-summon UI paths. */
    getActiveSummon(): Actor | null {
        return this.getActiveSummons()[0] || null;
    }

    /** Summons currently in the void (stored, unaware, no passage of time). */
    getVoidSummons(): Actor[] {
        const activeIds = new Set(this.getActiveIds());
        return this.getRosterSummons().filter(a => !activeIds.has(a.id));
    }

    isSummonRecovering(actor: Actor): boolean {
        return actor.isRecovering(this.getElapsedTurns());
    }

    /** Turns of recovery a summon still has left (0 if available). */
    recoveryTurnsLeft(actor: Actor): number {
        if (actor.recoveryUntilTurn == null) return 0;
        return Math.max(0, actor.recoveryUntilTurn - this.getElapsedTurns());
    }

    /**
     * Bring a summon into the world. If there's room under the active cap, they join the actives;
     * if the cap is full, the longest-active summon steps back into the void to make room. A summon
     * still recovering can't be summoned. The void is timeless: a stored summon simply steps back
     * out, unaware of any gap.
     */
    setActiveSummon(actorId: string): boolean {
        const save = this.getSave();
        const target = save.actors[actorId];
        if (!target || target.origin !== 'patient') return false;
        if (this.isSummonRecovering(target)) return false;
        const activeIds = this.getActiveIds();
        if (activeIds.includes(actorId)) return true;
        if (activeIds.length >= this.getActiveSummonCap()) {
            const removed = activeIds.shift();
            if (removed && save.actors[removed]) {
                this.stripTemporaryEquipment(save.actors[removed]);
                save.actors[removed].locationId = 'cryo';
            }
        }
        target.locationId = this.getCurrentLocationId();
        target.recoveryUntilTurn = undefined; // fully recovered by the time it's re-summoned
        activeIds.push(actorId);
        this.saveGame();
        return true;
    }

    getEquipmentArchive(): EquipmentItem[] {
        const save = this.getSave();
        if (!save.equipmentArchive) save.equipmentArchive = [];
        return save.equipmentArchive;
    }

    /**
     * Desummoning strips ALL Temporary equipment (it drops where they stood / vanishes into the
     * void) into the archive, durability reset. System equipment stays with them - that's what
     * permanence means.
     */
    stripTemporaryEquipment(actor: Actor): void {
        if (!actor?.equipped) return;
        const archive = this.getEquipmentArchive();
        for (const slot of Object.keys(actor.equipped)) {
            const item = actor.equipped[slot];
            if (item && item.kind === 'temporary') {
                archiveEquipmentItem(archive, item);
                delete actor.equipped[slot];
            }
        }
    }

    /** Move an archived item onto a summon (into the item's own slot); any displaced item is archived. */
    equipFromArchive(actorId: string, itemId: string): boolean {
        const save = this.getSave();
        const actor = save.actors[actorId];
        const archive = this.getEquipmentArchive();
        const idx = archive.findIndex(i => i.id === itemId);
        if (!actor || idx < 0) return false;
        const item = archive.splice(idx, 1)[0];
        const displaced = actor.equipped[item.slot];
        if (displaced) archiveEquipmentItem(archive, displaced);
        actor.equipped[item.slot] = item;
        this.saveGame();
        return true;
    }

    /** Take an item off a summon into the archive. */
    unequipToArchive(actorId: string, slot: string): boolean {
        const save = this.getSave();
        const actor = save.actors[actorId];
        const item = actor?.equipped?.[slot];
        if (!item) return false;
        archiveEquipmentItem(this.getEquipmentArchive(), item);
        delete actor.equipped[slot];
        this.saveGame();
        return true;
    }

    /** Voluntarily send a summon back into the void. */
    desummonToVoid(actorId: string): void {
        const save = this.getSave();
        const actor = save.actors[actorId];
        if (!actor) return;
        this.stripTemporaryEquipment(actor);
        actor.locationId = 'cryo';
        save.activeActorIds = this.getActiveIds().filter(id => id !== actorId);
        this.saveGame();
    }

    /**
     * Defeat handling: the summon is desummoned into the void and benched for a rank-scaled number
     * of turns. It is NOT killed (summons are effectively immortal) - only the Summoner's defeat is
     * permanent. Event resolution (Pass 7) calls this; exposed now so recovery is testable.
     */
    defeatSummon(actorId: string): void {
        const save = this.getSave();
        const actor = save.actors[actorId];
        if (!actor) return;
        this.stripTemporaryEquipment(actor);
        actor.locationId = 'cryo';
        actor.recoveryUntilTurn = this.getElapsedTurns() + actor.getRecoveryDuration();
        save.activeActorIds = this.getActiveIds().filter(id => id !== actorId);
        this.saveGame();
    }

    async loadReserveFactions() {
        // If a load is already in-flight, return the existing promise to dedupe concurrent calls
        if (this.reserveFactionsLoadPromise) return this.reserveFactionsLoadPromise;

        this.reserveFactionsLoadPromise = (async () => {
            try {
                console.log('Loading additional factions...');
                const eligibleFactions = Object.values(this.getSave().factions).filter(faction => faction.reputation > 0);
                while (eligibleFactions.length < this.MAX_FACTIONS) {
                    const needed = this.MAX_FACTIONS - eligibleFactions.length;
                    // Populate reserveFactions; this is loaded with data from a service, calling the characterSearchQuery URL:
                    const exclusions = (this.getSave().bannedTags || []).concat(this.bannedTagsDefault).map(tag => encodeURIComponent(tag)).join('%2C');
                    const response = await fetch(this.characterSearchQuery
                        .replace('{{PAGE_NUMBER}}', this.factionPageNumber.toString())
                        .replace('{{EXCLUSIONS}}', exclusions ? exclusions + '%2C' : '')
                        .replace('{{SEARCH_TAGS}}', this.factionTags.concat(this.factionTags).join('%2C')));
                    const searchResults = await response.json();
                    console.log(searchResults);
                    // Need to do a secondary lookup for each faction in searchResults, to get the details we actually care about:
                    const basicFactionData = searchResults.data?.nodes.filter((item: string, index: number) => index < needed).map((item: any) => item.fullPath) || [];
                    this.factionPageNumber = (this.factionPageNumber % this.MAX_PAGES) + 1;
                    console.log(basicFactionData);
                    // Do these in series instead of parallel to reduce load on the service:
                    const newFactions: Faction[] = [];
                    for (const fullPath of basicFactionData) {
                        const faction = await loadReserveFaction(fullPath, this);
                        if (faction !== null) {
                            newFactions.push(faction);
                        }
                    }
                    newFactions.forEach(faction => {if (faction != null) {eligibleFactions.push(faction); this.getSave().factions[faction.id] = faction;}});
                }
            } catch (err) {
                console.error('Error loading reserve factions', err);
            }
        })();

        this.reserveFactionsLoadPromise?.then(() => {
            this.reserveFactionsLoadPromise = undefined;
        });

        return this.reserveFactionsLoadPromise;
    }

    getLayout(): Layout {
        return this.getSave().layout;
    }

    // ===== Multi-floor management =====

    /** The cost to build the next floor, or null if already at max floors. */
    getNextFloorCost(): Partial<Record<StationStat, number>> | null {
        const layout = this.getLayout();
        const nextFloorNumber = layout.floorCount + 1; // 1-indexed floor being built
        if (nextFloorNumber > MAX_FLOORS) return null;
        return FLOOR_BUILD_COSTS[nextFloorNumber] || null;
    }

    /** True if the current top floor is fully built out (all footprint cells filled). */
    isTopFloorFull(): boolean {
        const layout = this.getLayout();
        return layout.isFloorFull(layout.floorCount - 1);
    }

    /** True if the player can currently build the next floor: not at max, top floor full, and affordable. */
    canBuildNextFloor(): boolean {
        const layout = this.getLayout();
        if (layout.floorCount >= MAX_FLOORS) return false;
        if (!this.isTopFloorFull()) return false;
        const cost = this.getNextFloorCost();
        if (!cost) return false;
        const stats = this.getSave().stationStats;
        if (!stats) return false;
        for (const [stat, amount] of Object.entries(cost)) {
            if ((stats[stat as StationStat] ?? 1) - (amount as number) < 1) return false;
        }
        return true;
    }

    /**
     * Charges the cost and adds a new floor, switching the view to it.
     * Returns the new floor index, or -1 if it could not be built.
     */
    buildNextFloor(): number {
        if (!this.canBuildNextFloor()) return -1;
        const save = this.getSave();
        const cost = this.getNextFloorCost();
        if (!cost || !save.stationStats) return -1;
        for (const [stat, amount] of Object.entries(cost)) {
            save.stationStats[stat as StationStat] = Math.max(1, (save.stationStats[stat as StationStat] ?? 1) - (amount as number));
        }
        const newIndex = save.layout.addFloor();
        save.layout.setCurrentFloor(newIndex);
        this.pushToTimeline(save, `The Magus raised a new floor of the Spire (floor ${newIndex + 1}).`);
        this.saveGame();
        return newIndex;
    }

    /** Switch the displayed floor. */
    setCurrentFloor(index: number): void {
        this.getLayout().setCurrentFloor(index);
        this.saveGame();
    }

    getCurrentFloor(): number {
        return this.getLayout().currentFloor;
    }

    async setState(state: MessageStateType): Promise<void> {
    }

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {

        return {
            stageDirections: null,
            messageState: {},
            modifiedMessage: null,
            systemMessage: null,
            error: null,
            chatState: null,
        };
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {

        return {
            stageDirections: null,
            messageState: {},
            modifiedMessage: null,
            error: null,
            systemMessage: null,
            chatState: null
        };
    }

    async makeText(textRequest: Object): Promise<string> {
        const response = await this.generator.textGen(textRequest);
        if (response?.result) {
        // The response may begin with thinking text in <thinking> tags; remove that.
            let resultText = response.result;
            // Strip double-asterisks. TODO: Remove this once other model issue is resolved.
            resultText = resultText.replace(/\*\*/g, '');
            const thinkingTagPattern = /<thinking>(.*?)<\/thinking>/gs;
            resultText = resultText.replace(thinkingTagPattern, '').trim();
            // The response may have "System:" in it, which indicates the location of the text we actually want to return; anything before and including "System:" should be removed.
            const systemTagIndex = resultText.indexOf('System:');
            if (systemTagIndex !== -1) {
                resultText = resultText.substring(systemTagIndex + 'System:'.length).trim();
            }

            return resultText;
        }
        return '';
    }

    async makeImage(imageRequest: Object, defaultUrl: string): Promise<string> {
        return (await this.generator.makeImage(imageRequest))?.url ?? defaultUrl;
    }

    async makeImageFromImage(imageToImageRequest: any, defaultUrl: string): Promise<string> {

        const imageUrl = (await this.generator.imageToImage(imageToImageRequest))?.url ?? defaultUrl;
        if (imageToImageRequest.remove_background && imageUrl != defaultUrl) {
            try {
                return this.removeBackground(imageUrl);
            } catch (exception: any) {
                console.error(`Error removing background from image, error`, exception);
                return imageUrl;
            }
        }
        return imageUrl;
    }

    async removeBackground(imageUrl: string) {
        if (!imageUrl) return imageUrl;
        try {
            const response = await this.generator.removeBackground({image: imageUrl});
            return response?.url ?? imageUrl;
        } catch (error) {
            console.error(`Error removing background`, error);
            return imageUrl;
        }
    }

    async commitActorToEcho(actorId: string, slotIndex: number): Promise<void> {
        const actor = (this.getSave().reserveActors || []).find(a => a.id === actorId) || this.getSave().echoes.find(a => a?.id === actorId);
        if (actor) {
            const save = this.getSave();
            // Ensure echoes array has 3 slots
            if (save.echoes.length < 3) {
                save.echoes = [...save.echoes, ...Array(3 - save.echoes.length).fill(null)];
            }
            // Remove from any existing slot
            save.echoes = save.echoes.map(slot => slot?.id === actorId ? null : slot);
            // Place in new slot
            save.echoes[slotIndex] = actor;
            console.log('Committing actor to echo slot:', actor, slotIndex);
            commitActorToEcho(actor, this);
            
            this.saveGame();
        }
    }

    removeActorFromEcho(actorId: string, thenSave: boolean): void {
        const save = this.getSave();
        save.echoes = save.echoes.map(slot => slot?.id === actorId ? null : slot);
        if (thenSave) {
            this.saveGame();
        }
    }

    getEchoSlots(): (Actor | null)[] {
        const save = this.getSave();
        // Ensure we always return an array of 3 slots
        const echoes = save.echoes || [];
        return [...echoes, ...Array(Math.max(0, 3 - echoes.length)).fill(null)].slice(0, 3);
    }

    setSkit(skit: SkitData) {
        const module = this.getSave().layout.getModuleById(skit.moduleId);
        if (module && module.ownerId) {
            generateActorDecor(this.getSave().actors[module.ownerId], module, this);
        }
        const save = this.getSave() as any;
        save.currentSkit = skit;
    }

    // For logging skit outcomes without actually executing them.
    testEndSkit() {
        const save = this.getSave();
        if (!save.currentSkit) {
            console.warn('End Test: No active skit to end.');
            return;
        }
        // Handle all outcomes:
        const endedOnCurrentFinalEntry = (save.currentSkit.currentIndex ?? (save.currentSkit.script.length - 1)) >= (save.currentSkit.script.length - 1);
        const outcomeEntries: ScriptEntry[] = [...save.currentSkit.script];
        if (endedOnCurrentFinalEntry && (save.currentSkit.outcomes?.length || 0) > 0) {
            outcomeEntries.push({
                speaker: 'NARRATOR',
                message: '',
                speechUrl: '',
                outcomes: save.currentSkit.outcomes
            });
        }
        const outcomes = accumulateOutcomes(outcomeEntries, this) || [];
        for (const outcome of outcomes) {
            console.log('End Test: Processing outcome:', outcome);
            if (outcome.type === 'actorStat' && outcome.actorId && outcome.stat && Object.values(Stat).includes(outcome.stat as Stat) && outcome.amount) {
                console.log('End Test: Processing actor stat outcome for actorId:', outcome.actorId, 'stat:', outcome.stat, 'amount:', outcome.amount);
                
            } else if (outcome.type === 'stationStat' && outcome.stat && Object.values(StationStat).includes(outcome.stat as StationStat) && outcome.amount) {
                console.log('End Test: Processing station stat outcome for stat:', outcome.stat, 'amount:', outcome.amount);
                // Handle station stat changes here if needed
                if (save.stationStats && outcome.stat in save.stationStats) {
                    console.log('End Test: Current station stat value:', save.stationStats[outcome.stat as StationStat]);
                }
            } else if (outcome.type === 'factionReputation' && outcome.factionId && outcome.amount) {
                if (save.factions[outcome.factionId]) {
                    const faction = this.getSave().factions[outcome.factionId];
                    if (!faction) return;

                    const newReputation = Math.max(0, Math.min(10, faction.reputation + outcome.amount));
                
                    // If reputation reaches 0, deactivate faction
                    if (newReputation <= 0 && faction.active) {
                        console.log(`End Test: Deactivating faction ${faction.name} due to reputation reaching 0.`);
                    } else if (newReputation >= 5 && !faction.module) {
                        console.log(`End Test: Generating module for faction ${faction.name} due to reputation reaching ${newReputation}.`);
                    } else {
                        console.log(`End Test: Updated reputation for faction ${faction.name} to ${newReputation}.`);
                    }
                }
            } else if (outcome.type === 'factionChange' && outcome.actorId && outcome.factionId !== undefined) {
                const actor = save.actors[outcome.actorId];
                const newFactionId = outcome.factionId;
                if (actor && actor.factionId != newFactionId) {
                    console.log(`End Test: Changing ${actor.name}'s faction from ${actor.factionId || 'PARC'} to ${newFactionId || 'PARC'}`);
                }
            } else if (outcome.type === 'roleChange' && outcome.actorId) {
                const actor = save.actors[outcome.actorId];
                const newRole = outcome.role || '';
                console.log(`End Test: Changing ${actor?.name}'s role to ${newRole}`);
            } else if (outcome.type === 'newModule' && outcome.module) {
                const moduleData = outcome.module;
                // Kick off module generation
                console.log(`End Test: Generating new module "${moduleData.moduleName}" due to skit outcome.`);
            } else if (outcome.type === 'equipGain' && outcome.actorId && outcome.equip?.slot && outcome.equip.itemName) {
                const actor = save.actors[outcome.actorId];
                if (actor) {
                    const archive = this.getEquipmentArchive();
                    // Dedup: a similar archived item is RESTORED (durability already reset on archive)
                    // instead of minting a near-duplicate.
                    const match = findArchiveMatch(archive, outcome.equip.itemName);
                    let item: EquipmentItem;
                    if (match) {
                        archive.splice(archive.indexOf(match), 1);
                        item = match;
                        item.slot = outcome.equip.slot;
                    } else {
                        item = createTemporaryItem(outcome.equip.itemName, outcome.equip.itemDescription || '', outcome.equip.slot);
                    }
                    const displaced = actor.equipped[outcome.equip.slot];
                    if (displaced) archiveEquipmentItem(archive, displaced);
                    actor.equipped[outcome.equip.slot] = item;
                }
            } else if (outcome.type === 'equipLoss' && outcome.actorId && outcome.equip?.slot) {
                const actor = save.actors[outcome.actorId];
                const item = actor?.equipped?.[outcome.equip.slot];
                if (actor && item) {
                    archiveEquipmentItem(this.getEquipmentArchive(), item);
                    delete actor.equipped[outcome.equip.slot];
                }
            } else if (outcome.type === 'equipDamage' && outcome.actorId && outcome.equip?.slot) {
                const actor = save.actors[outcome.actorId];
                const item = actor?.equipped?.[outcome.equip.slot];
                if (actor && item) {
                    item.durability = Math.max(0, item.durability - (outcome.equip.amount || 1));
                    if (item.durability <= 0) {
                        // Broken: removed from the slot; waits whole in the archive (durability resets there).
                        archiveEquipmentItem(this.getEquipmentArchive(), item);
                        delete actor.equipped[outcome.equip.slot];
                    }
                }
            } else if (outcome.type === 'newOutfit' && outcome.actorId && outcome.outfit && outcome.outfit.outfitName) {
                const actor = save.actors[outcome.actorId];
                const outfit = outcome.outfit;
                console.log(`End Test: Generating new outfit "${outfit.outfitName}" for ${actor?.name} due to skit outcome.`);
            } else if (outcome.type === 'movement' && outcome.actorId && (outcome.factionId || outcome.moduleId)) {
                const actor = save.actors[outcome.actorId];
                console.log(`End Test: Moving ${actor?.name} to ${outcome.moduleId ? `module ${outcome.moduleId}` : `faction ${outcome.factionId}` } due to skit outcome.`);
            } else if (outcome.type === 'newActor' && outcome.actor) {
                console.log(`End Test: Adding new actor ${outcome.actor.name} due to skit outcome.`);    
            }
        }

    }

    /**
     * Rewind the current skit to the given section index: the selected section is KEPT, everything
     * after it is deleted and discarded, and the implied outcomes are regenerated for the new
     * endpoint. The SP bonus multiplier is reset and re-judged by that regeneration, so a bonus
     * earned only by discarded content doesn't survive the rewind.
     */
    async rewindSkit(index: number): Promise<void> {
        const save = this.getSave();
        const skit = save.currentSkit;
        if (!skit || skit.generating) return;
        if (index < 0 || index >= skit.script.length - 1) return; // nothing after this point - no-op

        // Truncate IN PLACE: the NovelVisualizer captures a reference to this array internally,
        // so replacing it with a slice() left the component rendering the old, full script - the
        // discarded messages visibly reappeared. Splice mutates the array everyone is holding.
        skit.script.splice(index + 1);
        skit.currentIndex = index;
        skit.outcomes = [];            // stale - they described the discarded ending
        skit.spMultiplier = undefined; // re-earned by the regeneration below if still warranted
        this.saveGame();

        skit.generating = true;
        try {
            await regenerateOutcomesForEnd(skit, this);
        } catch (e) {
            console.warn('Outcome regeneration after rewind failed; continuing without implied outcomes.', e);
        } finally {
            skit.generating = false;
            this.saveGame();
        }
    }

    endSkit(setScreenType: (type: ScreenType) => void) {
        const save = this.getSave();
        if (save.currentSkit) {
            if (save.currentSkit.type === SkitType.EXIT_CRYO) {
                this.pushToTimeline(save, `${save.actors[save.currentSkit.actorId ?? '']?.name || 'An unknown individual'} returned through the Homeward Gate.`);
            } else if (save.currentSkit.type === SkitType.INTRO_CHARACTER) {
                this.pushToTimeline(save, `New resident, ${save.actors[save.currentSkit.actorId ?? '']?.name || 'An unknown individual'}, summoned to the Spire.`);
            }
            // Save skit to timeline first, so (most) outcomes save afterward.
            this.pushToTimeline(save, `${save.currentSkit.type} skit.`, save.currentSkit);




            // Handle all outcomes:
            const endedOnCurrentFinalEntry = (save.currentSkit.currentIndex ?? (save.currentSkit.script.length - 1)) >= (save.currentSkit.script.length - 1);
            const outcomeEntries: ScriptEntry[] = [...save.currentSkit.script];
            if (endedOnCurrentFinalEntry && (save.currentSkit.outcomes?.length || 0) > 0) {
                outcomeEntries.push({
                    speaker: 'NARRATOR',
                    message: '',
                    speechUrl: '',
                    outcomes: save.currentSkit.outcomes
                });
            }
            const outcomes = accumulateOutcomes(outcomeEntries, this) || [];
            for (const outcome of outcomes) {
                console.log('Processing outcome:', outcome);
                if (outcome.type === 'actorStat' && outcome.actorId && outcome.stat && Object.values(Stat).includes(outcome.stat as Stat) && outcome.amount) {
                    console.log('Processing actor stat outcome for actorId:', outcome.actorId, 'stat:', outcome.stat, 'amount:', outcome.amount);
                    if (save.actors[outcome.actorId]) {
                        const actor = save.actors[outcome.actorId];
                        actor.stats[outcome.stat as Stat] += outcome.amount;
                        this.showPriorityMessage(`${actor.name}'s ${outcome.stat} ${outcome.amount >= 0 ? 'increased' : 'decreased'} by ${Math.abs(outcome.amount)}.`);
                        // A change to Skill in a skit trains (or dulls) the resident's hidden proficiency in their current role.
                        if ((outcome.stat as Stat) === Stat.Skill) {
                            const role = getRole(actor, save);
                            if (role) actor.adjustRoleProficiency(role, outcome.amount > 0 ? 1 : -1);
                        }
                    }
                } else if (outcome.type === 'stationStat' && outcome.stat && Object.values(StationStat).includes(outcome.stat as StationStat) && outcome.amount) {
                    console.log('Processing station stat outcome for stat:', outcome.stat, 'amount:', outcome.amount);
                    // Handle station stat changes here if needed
                    if (save.stationStats && outcome.stat in save.stationStats) {
                        save.stationStats[outcome.stat as StationStat] += outcome.amount;
                        this.showPriorityMessage(`The Spire's ${outcome.stat} ${outcome.amount >= 0 ? 'increased' : 'decreased'} by ${Math.abs(outcome.amount)}.`);
                    }
                } else if (outcome.type === 'factionReputation' && outcome.factionId && outcome.amount) {
                    if (save.factions[outcome.factionId]) {
                        const faction = this.getSave().factions[outcome.factionId];
                        if (!faction) return;

                        const newReputation = Math.max(0, Math.min(10, faction.reputation + outcome.amount));

                        faction.reputation = newReputation;
                    
                        // If reputation reaches 0, deactivate faction
                        if (newReputation <= 0 && faction.active) {
                            faction.active = false;
                            this.pushToTimeline(save, `The ${faction.name} cut ties with the Spire.`);
                            // Remove any actors belonging to this faction from the PARC:
                            Object.values(save.actors).forEach(actor => {
                                if (actor.factionId === faction.id) {
                                    actor.locationId = faction.id; // move to faction location
                                }
                            });
                        } else if (newReputation >= 5 && !faction.module) {
                            // Generate a faction module, if not present
                            generateFactionModule(faction, this).then(moduleName => {
                                if (moduleName) {
                                    this.showPriorityMessage(`New module "${moduleName}" now available!`);
                                }
                            });
                        }
                    }
                } else if (outcome.type === 'factionChange' && outcome.actorId && outcome.factionId !== undefined) {
                    const actor = save.actors[outcome.actorId];
                    const newFactionId = outcome.factionId;
                    if (actor && actor.factionId != newFactionId) {
                        console.log(`Changing ${actor.name}'s faction from ${actor.factionId || 'PARC'} to ${newFactionId || 'PARC'}`);
                        
                        // If currently a faction rep and joining PARC (factionId = ''), need to generate a new faction rep:
                        if (newFactionId === '') {
                            const currentFaction = Object.values(save.factions).find(faction => faction.representativeId === actor.id);
                            this.pushToTimeline(save, `${actor.name}, formerly of the ${currentFaction?.name || 'unknown faction'} joined the ${newFactionId ? save.factions[newFactionId]?.name || 'unknown faction' : 'PARC'}.`);
                            if (currentFaction) {
                                console.log(`Generating new representative for faction ${currentFaction.name} as ${actor.name} is leaving.`);
                                generateFactionRepresentative(currentFaction, this).then(() => {
                                    console.log(`Generated new faction representative for ${currentFaction.name}`);
                                })
                            }
                            // Clear locationId if it was set to a faction
                            if (actor.locationId && !save.layout.getModuleById(actor.locationId)) {
                                actor.locationId = '';
                            }
                        } else {
                            // If joining a faction, set locationId to the factionId
                            this.pushToTimeline(save, `${actor.name} left the ${actor.factionId ? save.factions[actor.factionId]?.name || 'unknown faction' : 'PARC'} to join the ${newFactionId ? save.factions[newFactionId]?.name || 'unknown faction' : 'PARC'}.`);
                            actor.locationId = newFactionId;
                            // Free up rooms owned by this actor
                            save.layout.getModulesWhere(m => m.ownerId === actor.id).forEach(module => {
                                module.ownerId = '';
                            });
                        }
                        actor.factionId = newFactionId;
                    }
                } else if (outcome.type === 'roleChange' && outcome.actorId) {
                    const actor = save.actors[outcome.actorId];
                    const newRole = outcome.role || '';
                    if (newRole) {
                        // Find module with matching role
                        const roleModules = save.layout.getModulesWhere(m => {
                            const moduleRole = m.getAttribute('role');
                            return !!(moduleRole && moduleRole.toLowerCase() === newRole.toLowerCase());
                        });

                        if (roleModules.length > 0) {
                            const targetModule = roleModules[0];
                            // Clear any existing owner
                            if (targetModule.ownerId) {
                                console.log(`Removing previous owner from ${targetModule.getAttribute('name')} role`);
                            }
                            
                            // Use centralized role assignment logic
                            assignActorToRole(this, actor, targetModule, save.layout);
                            console.log(`Assigned ${actor.name} to ${newRole} role in ${targetModule.getAttribute('name')} module`);
                        } else {
                            console.warn(`No module found with role: ${newRole}`);
                        }
                    } else {
                        // If newRole is empty, just clear any current role assignments
                        const currentRoleModules = save.layout.getModulesWhere(m => m.type !== 'quarters' && m.ownerId === actor.id);
                        currentRoleModules.forEach(module => {
                            console.log(`Removing ${actor.name} from ${module.getAttribute('name')} role`);
                            module.ownerId = '';
                        });
                    }
                } else if (outcome.type === 'newModule' && outcome.module) {
                    // Kick off module generation in the background.
                    void this.generateModuleFromOutcome(outcome);
                } else if (outcome.type === 'newOutfit' && outcome.actorId && outcome.outfit && outcome.outfit.outfitName) {
                    const actor = save.actors[outcome.actorId];
                    const outfit = outcome.outfit;
                    if (actor) {
                        const alreadyExists = actor.outfits.some(o => namesMatch(o.name, outfit.outfitName));
                        if (!alreadyExists) {
                            const newOutfitId = outfit.id || generateUuid();
                            actor.outfits.push({
                                id: newOutfitId,
                                name: outfit.outfitName,
                                description: outfit.description,
                                prompts: {},
                                emotionPack: {},
                            });

                            // Kick off outfit portrait generation in the background.
                            generateBaseActorImage(actor, this, false, true, newOutfitId).then(() => {
                                this.showPriorityMessage(`New appearance for ${actor.name}: "${outfit.outfitName}"`);
                                this.saveGame();
                                return generateAdditionalActorImages(actor, this, newOutfitId);
                            }).catch((err) => {
                                console.error('Error generating images for new appearance outcome:', err);
                            });
                        }
                    }
                } else if (outcome.type === 'movement' && outcome.actorId && (outcome.factionId || outcome.moduleId)) {
                    const actor = save.actors[outcome.actorId];
                    if (actor) {
                        const newLocationId = outcome.moduleId || outcome.factionId || actor.locationId;
                        actor.locationId = newLocationId;
                    }
                } else if (outcome.type === 'newActor' && outcome.actor) {
                    // Kick off actor generation in the background.
                    void this.generateActorFromOutcome(outcome);
                } else if (outcome.type === 'towerActivity' && outcome.actorId && outcome.activityLine) {
                    const actor = save.actors[outcome.actorId];
                    // Validate the line; discard silently if it's gibberish/malformed.
                    const validatedLine = actor ? this.validateActivityLine(outcome.activityLine) : null;
                    if (actor && validatedLine) {
                        // Append to the Tower Activity Log (kept separate from the player-facing stat list).
                        if (!save.activityLog) save.activityLog = [];
                        const entry: ActivityEntry = {
                            id: generateUuid(),
                            day: save.day,
                            turn: save.turn,
                            actorId: actor.id,
                            actorName: actor.name,
                            line: validatedLine,
                        };
                        // Apply the optional clamped tower-stat nudge silently (no player-facing toast).
                        if (outcome.activityStat && outcome.activityAmount && save.stationStats && outcome.activityStat in save.stationStats) {
                            const delta = outcome.activityAmount > 0 ? 1 : -1;
                            save.stationStats[outcome.activityStat] = Math.max(1, Math.min(10, save.stationStats[outcome.activityStat] + delta));
                            entry.stat = String(outcome.activityStat);
                            entry.amount = delta;
                            // Nudge the resident's hidden proficiency in their current role toward the activity's direction.
                            // (The tower spirit has no room-role, so skip proficiency for it.)
                            const role = getRole(actor, save);
                            if (role && actor.id !== save.aide.actorId) actor.adjustRoleProficiency(role, delta);
                        }
                        save.activityLog.push(entry);
                        // Cap the log so it doesn't grow without bound.
                        if (save.activityLog.length > 100) {
                            save.activityLog = save.activityLog.slice(-100);
                        }
                    } else if (outcome.activityLine) {
                        console.warn('Skit activity discarded by validation:', outcome.activityLine);
                    }
                }
            }

            // Look at all actors involved in the skit, and run updateCharacterArc on them:
            console.log(save.currentSkit.script);
            for (const actor of Object.values(save.actors)) {
                if (save.currentSkit?.script.some(entry => entry.speaker && namesMatch(entry.speaker, actor.name) || entry.speakerId === actor.id)) {
                    console.log(save.currentSkit.script.filter(entry => entry.speaker && namesMatch(entry.speaker, actor.name) || entry.speakerId === actor.id).map(entry => `'${entry.speaker}' was matched to '${actor.name}'?`));
                    console.log(`Need to update this character arc: ${actor.name}/${actor.id}`);
                    updateCharacterArc(this, save.currentSkit ?? {}, actor);
                }
                // Apply last location from skit movements:
                const lastMovementEntry = [...(save.currentSkit?.script || [])].reverse().find(entry => entry.movements && Object.keys(entry.movements).some(moverId => moverId === actor.id));
                if (lastMovementEntry && lastMovementEntry.movements) {
                    const newLocationId = lastMovementEntry.movements[actor.id];
                    if (newLocationId) {
                        actor.locationId = newLocationId;
                    }
                }

                const lastOutfitEntry = [...(save.currentSkit?.script || [])].reverse().find(entry => entry.outfitChanges && Object.keys(entry.outfitChanges).some(changerId => changerId === actor.id));
                if (lastOutfitEntry && lastOutfitEntry.outfitChanges) {
                    const newOutfitId = lastOutfitEntry.outfitChanges[actor.id];
                    if (newOutfitId && actor.outfits.some(outfit => outfit.id === newOutfitId)) {
                        actor.outfitId = newOutfitId;
                    }
                }
            }

            this.summaryCheck();

            // SP: meaningful interaction pays. 1 SP per section, times any locked-in bonus
            // multiplier the LLM awarded for significant accomplishments (ratchets up only, 1-4x).
            const spBase = save.currentSkit.script?.length || 0;
            const spMult = Math.max(1, Math.min(4, save.currentSkit.spMultiplier || 1));
            const spEarned = spBase * spMult;
            if (spEarned > 0) {
                save.sp = (save.sp || 0) + spEarned;
                this.pushToTimeline(save, spMult > 1
                    ? `Earned ${spEarned} SP (${spBase} × ${spMult} bonus).`
                    : `Earned ${spEarned} SP.`);
            }

            save.currentSkit = undefined;
            this.incTurn(1, setScreenType);
        }
    }

    async summaryCheck() {
        const save = this.getSave();
        // Look at past skits (starting from the beginning), and find one that doesn't have a summary, to generate:
        const skitToSummarize = (save.timeline || []).find(entry => entry.skit && !entry.skit.summary)?.skit;
        if (skitToSummarize) {
            console.log(`Summarizing an old skit.`);
            generateSkitSummary(skitToSummarize, this).then(summary => {
                if (summary) {
                    this.saveGame();
                }
            });
        }
    }

    async continueSkit(): Promise<void> {
        const skit = (this.getSave() as any).currentSkit as SkitData;
        if (!skit) return;
        skit.generating = true;
        try {
            const entries = await generateSkitScript(skit, this);
            skit.script.push(...entries);
            this.saveGame();
        } catch (err) {
            console.error('Error continuing skit script', err);
        } finally {
            skit.generating = false;
        }
        return;
    }

    async uploadBlob(fileName: string, blob: Blob, propertyBag: BlobPropertyBag): Promise<string> {
        // Depth URL is the HF URL; back it up to Chub by creating a File from the image data:
        const file: File = new File([blob], fileName, propertyBag);
        return this.uploadFile(fileName, file);
    }

    async uploadFile(fileName: string, file: File): Promise<string> {
        // Don't honor file's name; want to overwrite existing content that may have had a different actual name.
        const updateResponse = await this.storage.set(fileName, file).forUser();
        if (!updateResponse.data || updateResponse.data.length == 0) {
            throw new Error('Failed to upload file to storage.');
        }
        return updateResponse.data[0].value;
    }

    // ---- SP & Shop -----------------------------------------------------------------------------

    getSp(): number { return this.getSave().sp || 0; }

    /** Spend SP if affordable. Returns true on success. */
    spendSp(amount: number): boolean {
        const save = this.getSave();
        if ((save.sp || 0) < amount) return false;
        save.sp = (save.sp || 0) - amount;
        this.saveGame();
        return true;
    }

    /** Cost to raise a capability stat TO the given rank (2-13). Doubles per letter tier. */
    static statUpgradeCost(targetRank: number): number {
        const costs: {[rank: number]: number} = { 2: 5, 3: 10, 4: 10, 5: 20, 6: 20, 7: 20, 8: 40, 9: 40, 10: 40, 11: 80, 12: 160, 13: 320 };
        return costs[targetRank] ?? 0;
    }

    /** Buy a +1 upgrade to one of a summon's capability stats. */
    buyStatUpgrade(actorId: string, stat: Stat): boolean {
        const save = this.getSave();
        const actor = save.actors[actorId];
        if (!actor || !CAPABILITY_STATS.includes(stat)) return false;
        const current = actor.stats[stat] ?? 3;
        if (current >= RANK_MAX) return false;
        const cost = Stage.statUpgradeCost(current + 1);
        if (!this.spendSp(cost)) return false;
        actor.stats[stat] = current + 1;
        this.saveGame();
        return true;
    }

    buyAestheticToken(): boolean {
        if (!this.spendSp(5)) return false;
        const save = this.getSave();
        save.aestheticTokens = (save.aestheticTokens || 0) + 1;
        this.saveGame();
        return true;
    }

    buyNewSummonToken(): boolean {
        if (!this.spendSp(50)) return false;
        const save = this.getSave();
        save.newSummonTokens = (save.newSummonTokens || 0) + 1;
        this.saveGame();
        return true;
    }

    buyMultiSummonToken(): boolean {
        if (this.getActiveSummonCap() >= 3) return false;
        if (!this.spendSp(100)) return false;
        const save = this.getSave();
        save.activeSummonCap = this.getActiveSummonCap() + 1;
        this.saveGame();
        return true;
    }

    buyRepairToken(): boolean {
        if (!this.spendSp(10)) return false; // [PROPOSED price - not in the spec]
        const save = this.getSave();
        save.repairTokens = (save.repairTokens || 0) + 1;
        this.saveGame();
        return true;
    }

    /** Instantly repair a System item with a Repair Token. Temporary gear can't be repaired this way. */
    repairEquippedItem(actorId: string, slot: string): boolean {
        const save = this.getSave();
        const item = save.actors[actorId]?.equipped?.[slot];
        if (!item || item.kind !== 'system' || item.durability >= item.maxDurability) return false;
        if ((save.repairTokens || 0) < 1) return false;
        save.repairTokens = (save.repairTokens || 0) - 1;
        item.durability = item.maxDurability;
        this.saveGame();
        return true;
    }

    /** Temp->System conversion: permanence only - no bonuses. [PROPOSED price 25 SP - not in the spec] */
    convertTempToSystem(actorId: string, slot: string): boolean {
        const save = this.getSave();
        const item = save.actors[actorId]?.equipped?.[slot];
        if (!item || item.kind !== 'temporary') return false;
        if (!this.spendSp(25)) return false;
        item.kind = 'system';
        item.maxDurability = SYSTEM_MAX_DURABILITY;
        this.saveGame();
        return true;
    }

    /**
     * Use a consumable on a summon. Starter effect tags (assigned by the GM at purchase):
     *  BOND:<lust|joy|trust>:<+/-n>  - shift a bond meter (clamped to the human band, 1-7)
     *  STAT:<capability>:<+/-n>      - shift a capability stat (clamped 1-13)
     *  HEAL:<n>                      - reserved until Health lands as a trackable pool (no-op now)
     *  NONE                          - purely narrative
     */
    useConsumable(consumableId: string, actorId: string): boolean {
        const save = this.getSave();
        const list = save.consumables || [];
        const idx = list.findIndex(c => c.id === consumableId);
        const actor = save.actors[actorId];
        if (idx < 0 || !actor) return false;
        const effect = (list[idx].effect || 'NONE').toUpperCase();
        const bondMatch = /^BOND:(LUST|JOY|TRUST):([+-]?\d+)$/.exec(effect);
        const statMatch = /^STAT:(BRAWN|SKILL|NERVE|WITS|CHARM|REFLEX):([+-]?\d+)$/.exec(effect);
        if (bondMatch) {
            const stat = bondMatch[1].toLowerCase() as Stat;
            actor.stats[stat] = Math.max(1, Math.min(7, (actor.stats[stat] ?? 3) + parseInt(bondMatch[2])));
        } else if (statMatch) {
            const stat = statMatch[1].toLowerCase() as Stat;
            actor.stats[stat] = Math.max(1, Math.min(RANK_MAX, (actor.stats[stat] ?? 3) + parseInt(statMatch[2])));
        }
        // HEAL / NONE / unparsable: consumed with narrative effect only.
        list.splice(idx, 1);
        this.saveGame();
        return true;
    }

    /**
     * The Game Master prices a custom request from the shop's prompt box, based on how useful it
     * would be in the current situation and how entertaining the GM finds the idea. Returns a price
     * and an in-character remark, or null if pricing failed.
     */
    async priceCustomRequest(request: string): Promise<{ price: number; remark: string; itemType: 'EQUIPMENT' | 'CONSUMABLE' | 'POWER' | 'OTHER'; slot?: string; bonusStat?: string; bonusAmount?: number; effect?: string } | null> {
        const save = this.getSave();
        const activeNames = this.getActiveSummons().map(a => a.name).join(', ') || 'none';
        const prompt = `{{messages}}You are the mysterious, unseen GAME MASTER of a hidden game in a modern world. ` +
            `A player (the Summoner) is at your shop and requests: "${request}"\n` +
            `Assign an SP price by your whims: weigh how USEFUL it is in their current situation and how ENTERTAINING you'd find them having it. ` +
            `Scale: trivial/cosmetic 5-50; useful mundane items 50-300; minor powers or skills 500-2000; strong powers several thousand; game-breaking power tens of thousands. Amusing requests earn discounts; boring safety earns markups.\n` +
            `Current situation: the Summoner has ${this.getSp()} SP, ${this.getRosterSummons().length} summon(s) (active: ${activeNames}), at ${this.getCurrentLocation().name}.\n` +
            `Also CLASSIFY the request. TYPE is one of: EQUIPMENT (a wearable/holdable item), CONSUMABLE (a single-use item like a potion), POWER (an ability, skill, or superpower granted to a specific summon), OTHER (anything else - services, changes to the world, etc).\n` +
            `If EQUIPMENT: include SLOT (one of: head, torso, underwear, hands, legs, feet, left hand, right hand, accessory) and optionally BONUS as <BRAWN|SKILL|NERVE|WITS|CHARM|REFLEX>:<+1 to +3> if the gear should carry a stat bonus.\n` +
            `If CONSUMABLE: include EFFECT as one of BOND:<LUST|JOY|TRUST>:<+/-n> (e.g. a love potion is BOND:LUST:+2), STAT:<capability>:<+/-n>, HEAL:<n>, or NONE.\n` +
            `Respond with ONLY these lines (omit inapplicable ones):\nPRICE: <integer>\nREMARK: <one short in-character sentence>\nTYPE: <EQUIPMENT|CONSUMABLE|POWER|OTHER>\nSLOT: <slot>\nBONUS: <stat>:<+n>\nEFFECT: <effect tag>`;
        try {
            const text = await this.makeText({ prompt, max_tokens: 160, min_tokens: 5, include_history: false });
            const priceMatch = (text || '').match(/PRICE:\s*([0-9,]+)/i);
            const remarkMatch = (text || '').match(/REMARK:\s*(.+)/i);
            if (!priceMatch) return null;
            const price = parseInt(priceMatch[1].replace(/,/g, ''));
            if (isNaN(price) || price <= 0) return null;
            const typeMatch = (text || '').match(/TYPE:\s*(EQUIPMENT|CONSUMABLE|POWER|OTHER)/i);
            const slotMatch = (text || '').match(/SLOT:\s*([a-z ]+)/i);
            const bonusMatch = (text || '').match(/BONUS:\s*(BRAWN|SKILL|NERVE|WITS|CHARM|REFLEX)\s*:\s*([+-]?\d+)/i);
            const effectMatch = (text || '').match(/EFFECT:\s*([A-Z]+(?::[A-Z]+)?(?::[+-]?\d+)?)/i);
            return {
                price,
                remark: (remarkMatch?.[1] || '').trim() || 'The Game Master names its price without comment.',
                itemType: (typeMatch?.[1] || 'OTHER').toUpperCase() as 'EQUIPMENT' | 'CONSUMABLE' | 'POWER' | 'OTHER',
                slot: (slotMatch?.[1] || '').trim().toLowerCase() || undefined,
                bonusStat: bonusMatch ? bonusMatch[1].toLowerCase() : undefined,
                bonusAmount: bonusMatch ? Math.max(1, Math.min(3, Math.abs(parseInt(bonusMatch[2])))) : undefined,
                effect: (effectMatch?.[1] || '').toUpperCase() || undefined,
            };
        } catch (e) {
            console.warn('GM pricing failed', e);
            return null;
        }
    }

    /**
     * Complete a priced custom purchase: deduct SP and MATERIALIZE the grant by its classification.
     * EQUIPMENT -> a System item in the archive (equip it from Summon Management). CONSUMABLE -> the
     * usable-items list. POWER -> attached to the chosen summon (narrative until traits land). OTHER
     * -> the narrative acquisitions list injected into scenes.
     */
    buyCustomRequest(request: string, offer: { price: number; remark: string; itemType?: string; slot?: string; bonusStat?: string; bonusAmount?: number; effect?: string }, targetActorId?: string): boolean {
        if (!this.spendSp(offer.price)) return false;
        const save = this.getSave();
        const type = offer.itemType || 'OTHER';
        if (type === 'EQUIPMENT') {
            const slot = (EQUIP_SLOTS as string[]).includes(offer.slot || '') ? offer.slot! : EquipSlot.ACCESSORY;
            const item: EquipmentItem = {
                id: generateUuid(), name: request, description: offer.remark, slot,
                kind: 'system', durability: SYSTEM_MAX_DURABILITY, maxDurability: SYSTEM_MAX_DURABILITY,
                bonuses: (offer.bonusStat && offer.bonusAmount) ? { [offer.bonusStat]: offer.bonusAmount } : undefined,
            };
            this.getEquipmentArchive().push(item);
        } else if (type === 'CONSUMABLE') {
            if (!save.consumables) save.consumables = [];
            save.consumables.push({ id: generateUuid(), name: request, effect: offer.effect || 'NONE', remark: offer.remark });
        } else if (type === 'POWER' && targetActorId && save.actors[targetActorId]) {
            const actor = save.actors[targetActorId];
            if (!actor.purchasedPowers) actor.purchasedPowers = [];
            actor.purchasedPowers.push(request);
        } else {
            if (!save.gmPurchases) save.gmPurchases = [];
            save.gmPurchases.push({ request, price: offer.price, remark: offer.remark });
        }
        this.saveGame();
        return true;
    }

    pushToTimeline(save: SaveType, description: string, skit: SkitData | null = null) {
        if (!save.timeline) {
            save.timeline = [];
        }
        save.timeline.push({
            day: save.day,
            turn: save.turn,
            description: description,
            ...skit ? {skit: skit} : {}
        });
    }


    isVerticalLayout(): boolean {
        // Determine if the layout should be vertical based on window aspect ratio
        // Vertical layout when height > width (portrait orientation)
        return window.innerHeight > window.innerWidth;
    }

    render(): ReactElement {

        return <BaseScreen stage={() => this}/>;
    }

}
