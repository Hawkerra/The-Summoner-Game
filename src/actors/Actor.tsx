import { Emotion, EMOTION_PROMPTS, EmotionPack } from "./Emotion";
import { Module } from "../Module";
import { SaveType, Stage } from "../Stage";
import { v4 as generateUuid } from 'uuid';
import { AspectRatio } from "@chub-ai/stages-ts";
import { FlashOn, Forum, 
    FitnessCenter, Construction, Lightbulb, 
    Whatshot, SentimentVerySatisfied, Handshake 
} from '@mui/icons-material';
import { buildEventHistory, buildPromptSegment } from "../Skit";

// Core character stats as an enum so other parts of the app can reference them safely
// Using single-syllable words, each starting with a different letter
export enum Stat {
    Brawn = 'brawn', // Physical condition and strength
    Skill = 'skill', // Capability and finesse
    Nerve = 'nerve', // Courage and confidence
    Wits = 'wits', // Intelligence and awareness
    Charm = 'charm', // Charisma and tact
    Lust = 'lust', // Sexuality and physical desire
    Joy = 'joy', // Happiness and positivity
    Trust = 'trust' // Compliance and faith in the player
}

// Icon mapping for actor stats
export const ACTOR_STAT_ICONS: Record<Stat, any> = {
    [Stat.Brawn]: FitnessCenter,
    [Stat.Skill]: Construction,
    [Stat.Nerve]: FlashOn,
    [Stat.Wits]: Lightbulb,
    [Stat.Charm]: Forum,
    [Stat.Lust]: Whatshot,
    [Stat.Joy]: SentimentVerySatisfied,
    [Stat.Trust]: Handshake,
};

export type ArtStyle = 'original' | 'anime' | 'chibi' | 'comic' | 'pixel art' | 'hyper-realistic' | 'realistic' | 'specific artist';

const ART_PROMPT: {[key in ArtStyle]: string} = {
    'original': 'A professional upper-body portrait of this character',
    'anime': 'Render this character in a classic visual novel, anime style with vibrant colors, expressive features, inks, and cel shading',
    'chibi': 'Render this character in a chibi style with exaggerated proportions, large eyes, and a cute, playful appearance; use bright colors and a bold white outline',
    'comic': 'Draw and ink this character in a clean, dynamic comicbook style with dynamic poses, intense blacks, heavy contours, bold lines, and oversaturated colors. Pull inspiration from the Dark Age of comicbooks, in the style of studios like Image or WildStorm.',
    'pixel art': 'Render this character in a half-resolution pixel art style, with a limited color palette, dithered shading, and vibrant retro aesthetic',
    'hyper-realistic': 'Render this character in a hyper-realistic style with intricate details, elaborate textures, and dramatic lighting to create a striking and immersive illustration',
    'realistic': 'Picture this character in a photographic style with natural proportions, convincing textures, and subtle lighting to create a believable and lifelike image',
    'specific artist': 'Render this character in the style of {{ARTIST}}, capturing their unique artistic techniques, color palettes, and overall aesthetic'
};

export type Outfit = {
    id: string;
    name: string;
    description: string;
    emotionPack: EmotionPack;
    prompts: EmotionPack;
}

export const ORIGINAL_OUTFIT_NAME = 'Original';

class Actor {
    id: string;
    name: string;
    fullPath: string = '';
    locationId: string = ''; // If this is a module ID, the actor is currently present in that module; if it is a faction ID, the actor is temporarily located offstation with that faction
    factionId: string = ''; // If this actor belongs to a faction, the ID of that faction; '' is the PARC or independent
    avatarImageUrl: string;
    // 'patient' indicates an echo origin, 'faction' indicates a someone generated as a faction representative, 'aide' is the station aide, and 'emergent' is a character generated as a result of narrative activity.
    origin: 'patient' | 'emergent' | 'faction' | 'aide' = 'patient';
    profile: string;
    characterArc?: string;
    style: string;
    // New structure for outfits and descriptions, replacing the previous single description and emotion pack
    outfitId: string = ''; // The ID of the currently equipped outfit, which determines the description and emotion pack in use
    outfits: Outfit[] = [];
    themeColor: string;
    themeFontFamily: string;
    voiceId: string;
    participations: number = 0; // Number of skits they've participated in
    heldRoles: { [key: string]: number } = {}; // Roles ever held by this actor and the number of days spent in each
    // Hidden, per-role proficiency (never shown to the player). Grows or shrinks based on skit outcomes,
    // letting the player effectively train an unskilled resident to be better at their role over time.
    // Keyed by role name; a value around 5 is average, 1 is inept, 10 is masterful.
    roleProficiency: { [key: string]: number } = {};
    decorImageUrls: {[key: string]: string} = {}; // ModuleType to decor image URL mapping
    stats: Record<Stat, number>;

    /**
     * Rehydrate an Actor from saved data
     */
    static fromSave(savedActor: any): Actor {
        const actor = Object.create(Actor.prototype);
        Object.assign(actor, savedActor);

        const legacyDescription = typeof savedActor?.description === 'string' ? savedActor.description : '';
        const legacyEmotionPack: EmotionPack = (savedActor?.emotionPack && typeof savedActor.emotionPack === 'object')
            ? savedActor.emotionPack
            : {};

        if (!Array.isArray(actor.outfits) || actor.outfits.length === 0) {
            actor.outfits = [Actor.createOutfit(ORIGINAL_OUTFIT_NAME, legacyDescription, legacyEmotionPack)];
        } else {
            actor.outfits = actor.outfits.map((outfit: Partial<Outfit>) => ({
                id: outfit.id || generateUuid(),
                name: outfit.name || ORIGINAL_OUTFIT_NAME,
                description: typeof outfit.description === 'string' ? outfit.description : '',
                emotionPack: (outfit.emotionPack && typeof outfit.emotionPack === 'object') ? outfit.emotionPack : {},
                prompts: (outfit.prompts && typeof outfit.prompts === 'object') ? outfit.prompts : {},
            }));
        }

        if (!actor.outfitId || !actor.outfits.some((outfit: Outfit) => outfit.id === actor.outfitId)) {
            const originalOutfit = actor.outfits.find((outfit: Outfit) => outfit.name === ORIGINAL_OUTFIT_NAME);
            actor.outfitId = (originalOutfit || actor.outfits[0]).id;
        }

        // Remove legacy own-properties so compatibility accessors are used.
        delete actor.description;
        delete actor.emotionPack;

        if (actor.decorImageUrls === undefined) {
            actor.decorImageUrls = {};
        }
        if (actor.roleProficiency === undefined) {
            actor.roleProficiency = {};
        }
        return actor;
    }

    private static createOutfit(name: string, description: string, emotionPack: EmotionPack, prompts: EmotionPack = {}): Outfit {
        return {
            id: generateUuid(),
            name,
            description: description || '',
            emotionPack: emotionPack || {},
            prompts: prompts || {},
        };
    }

    private ensureOutfitState(): void {
        if (!Array.isArray(this.outfits)) {
            this.outfits = [];
        }

        if (this.outfits.length === 0) {
            const fallbackOutfit = Actor.createOutfit(ORIGINAL_OUTFIT_NAME, '', {});
            this.outfits = [fallbackOutfit];
            this.outfitId = fallbackOutfit.id;
            return;
        }

        this.outfits = this.outfits.map((outfit) => ({
            ...outfit,
            emotionPack: (outfit.emotionPack && typeof outfit.emotionPack === 'object') ? outfit.emotionPack : {},
            prompts: (outfit.prompts && typeof outfit.prompts === 'object') ? outfit.prompts : {},
        }));

        if (!this.outfitId || !this.outfits.some((outfit) => outfit.id === this.outfitId)) {
            const originalOutfit = this.outfits.find((outfit) => outfit.name === ORIGINAL_OUTFIT_NAME);
            this.outfitId = (originalOutfit || this.outfits[0]).id;
        }
    }

    getActiveOutfit(): Outfit {
        this.ensureOutfitState();
        return this.outfits.find((outfit) => outfit.id === this.outfitId) || this.outfits[0];
    }

    getOutfitById(outfitId: string = ''): Outfit {
        this.ensureOutfitState();
        const resolvedOutfitId = outfitId || this.outfitId;
        return this.outfits.find((outfit) => outfit.id === resolvedOutfitId) || this.getActiveOutfit();
    }

    getDescription(outfitId: string = ''): string {
        return this.getOutfitById(outfitId).description;
    }

    /** Hidden role proficiency (1-10, ~5 average). Defaults to 5 for a role not yet tracked. */
    getRoleProficiency(role: string): number {
        if (!role) return 5;
        if (!this.roleProficiency) this.roleProficiency = {};
        return this.roleProficiency[role] ?? 5;
    }

    /** Nudge hidden proficiency for a role, clamped to 1-10. */
    adjustRoleProficiency(role: string, delta: number): void {
        if (!role || !delta) return;
        if (!this.roleProficiency) this.roleProficiency = {};
        const current = this.roleProficiency[role] ?? 5;
        this.roleProficiency[role] = Math.max(1, Math.min(10, current + delta));
    }

    setDescription(description: string, outfitId: string = '') {
        this.getOutfitById(outfitId).description = description || '';
    }

    getEmotionPack(outfitId: string = ''): EmotionPack {
        return this.getOutfitById(outfitId).emotionPack;
    }

    setEmotionPack(emotionPack: EmotionPack, outfitId: string = '') {
        this.getOutfitById(outfitId).emotionPack = emotionPack || {};
    }

    getEmotionImageUrl(emotion: Emotion | string, outfitId: string = ''): string {
        return this.getEmotionPack(outfitId)[emotion] || '';
    }

    setEmotionImageUrl(emotion: Emotion | string, imageUrl: string, outfitId: string = ''): void {
        this.getEmotionPack(outfitId)[emotion] = imageUrl || '';
    }

    constructor(id: string, name: string, fullPath: string, avatarImageUrl: string, description: string, profile: string, style: string, voiceId: string, emotionPack: EmotionPack, stats: Record<Stat, number>, themeColor: string, themeFontFamily: string, outfitName: string = ORIGINAL_OUTFIT_NAME) {
        this.id = id;
        this.name = name;
        this.fullPath = fullPath;
        this.avatarImageUrl = avatarImageUrl;
        const initialOutfitName = outfitName?.trim() || ORIGINAL_OUTFIT_NAME;
        const originalOutfit = Actor.createOutfit(initialOutfitName, description, emotionPack);
        this.outfits = [originalOutfit];
        this.outfitId = originalOutfit.id;
        this.profile = profile;
        this.style = style;
        this.voiceId = voiceId;
        // populate the consolidated mapping for easier, enum-based lookups
        this.stats = stats;
        this.themeColor = themeColor;
        this.themeFontFamily = themeFontFamily;
    }

    get isPrimaryImageReady(): boolean {
        return !!this.getEmotionImageUrl('neutral');
    }

    /**
     * Get the default emotion for this actor based on their Joy stat.
     * Returns joy (>8), approval (>5), neutral (>2), or disappointment (<=2).
     * @returns The default emotion for this actor
     */
    getDefaultEmotion(): Emotion {
        const joyValue = this.stats[Stat.Joy];
        if (joyValue > 8) return Emotion.joy;
        if (joyValue > 5) return Emotion.approval;
        if (joyValue > 2) return Emotion.neutral;
        return Emotion.disappointment;
    }
    
    resetLocation() {
        this.locationId = this.factionId;
    }


    isOffSite(save: SaveType): boolean {
        return Object.values(save.factions).some(faction => this.locationId === faction.id);
    }

    /**
     * Get the emotion image for this actor, falling back to neutral if not available.
     * If the emotion is not defined or matches the base/neutral image, kick off generation
     * in the background (don't wait for it).
     * @param emotion The emotion to get the image for
     * @param stage Optional stage instance to use for image generation
     * @returns The URL of the emotion image
     */
    getEmotionImage(emotion: Emotion | string, stage?: Stage, outfitId: string = ''): string {
        const targetOutfitId = outfitId || this.outfitId;
        const emotionKey = typeof emotion === 'string' ? emotion : emotion;
        const emotionPack = this.getEmotionPack(targetOutfitId);
        const emotionUrl = emotionPack[emotionKey];
        const neutralUrl = emotionPack['neutral'] || emotionPack['base'];
        const fallbackUrl = neutralUrl || this.avatarImageUrl || '';

        // Check if we need to generate the image
        if (stage && (emotion === 'neutral' || !stage.getSave().disableEmotionImages) && (!emotionUrl || emotionUrl === this.avatarImageUrl || emotionUrl === emotionPack['base'] || (emotionKey !== 'neutral' && emotionUrl === neutralUrl))) {
            // Kick off generation in the background (don't wait)
            generateEmotionImage(this, emotion as Emotion, stage, false, targetOutfitId);
        }

        // Return the emotion image or fallback
        return emotionUrl || fallbackUrl;
    }
}

export function isHologram(actor: Actor, save: SaveType, currentLocationId: string): boolean {
        // Faction envoys always render as scrying projections; the tower spirit renders
        // as a ghost unless the player has toggled a solid manifestation in settings.
        return !!(save.factions[currentLocationId]) || (save.aide.actorId === actor.id && !save.solidSpirit);
    }

export function getStatDescription(stat: Stat | string): string {
    const key = typeof stat === 'string' ? stat : stat;
    switch (key) {
        case Stat.Brawn:
            return 'physical condition and strength, with 10 being peak condition and 1 being critically impaired.';
        case Stat.Skill:
            return 'capability and ability to contribute meaningfully, with 10 being highly competent and 1 being a liability.';
        case Stat.Nerve:
            return 'courage and mental resilience, with 10 being indefatigably fearless and 1 being easily overwhelmed.';
        case Stat.Wits:
            return 'intelligence and awareness, with 10 being a genius and 1 being utterly oblivious.';
        case Stat.Charm:
            return 'personality appeal and tact, with 10 being extremely charismatic and 1 being socially inept.';
        case Stat.Lust:
            return 'physical lustiness and sexual confidence, with 10 being abjectly lewd and 1 being entirely asexual.';
        case Stat.Joy:
            return 'happiness and positivity, with 10 being eternally optimistic and 1 being deeply depressed.';
        case Stat.Trust:
            return 'level of trust in the player character, with 10 being fully trusting and 1 being completely suspicious.';
        default:
            return '';
    }
}

export async function loadReserveActorFromFullPath(fullPath: string, stage: Stage): Promise<Actor|null> {
    const response = await fetch(stage.characterDetailQuery.replace('{fullPath}', fullPath));
    const item = await response.json();
    const dataName = item.node.definition.name.replaceAll('{{char}}', item.node.definition.name).replaceAll('{{user}}', 'Individual X');
    console.log(item);

    const data = {
        name: dataName,
        fullPath: item.node.fullPath,
        personality: item.node.definition.personality.replaceAll('{{char}}', dataName).replaceAll('{{user}}', 'Individual X'),
        avatar: item.node.max_res_url,
        // If the voice ID is not in the VOICE_MAP, it is a custom voice and should be preserved
        voiceId: !VOICE_MAP[item.node.definition.voice_id] ? item.node.definition.voice_id : ''
    };

    // Quality floor: reject candidate cards that are too small to be worth distilling (e.g. sub-200-token
    // protest/placeholder cards). This gates SELECTION only - it is not applied to the distillation itself,
    // nor to specially-loaded actors like the tower spirit or emergent NPCs (which use loadReserveActor directly).
    // Rough token estimate ~= words / 0.75 (about 1.33 tokens per word).
    const rawText = `${data.name || ''} ${data.personality || ''}`.trim();
    const estimatedTokens = Math.round(rawText.split(/\s+/).filter(Boolean).length / 0.75);
    if (estimatedTokens < 200) {
        console.log(`Discarding candidate for being too small (~${estimatedTokens} tokens): ${data.name}`);
        return null;
    }

    return loadReserveActor(data, stage, true);
}

// Mapping of voice IDs to a description of the voice, so the AI can choose an ID based on the character profile.
export const VOICE_MAP: {[key: string]: string} = {
    '05261898-ccd1-4270-bfb2-78e8ecba225d': 'feminine - low, posh, and petulent',
    '98bcf0b0-a0f7-4828-8686-4f8692293d68': 'feminine - high, refined, and warm',
    '751212e5-a871-45c7-b10b-6f42a5785954': 'feminine - high, posh, and catty',
    '03a438b7-ebfa-4f72-9061-f086d8f1fca6': 'feminine - calm and soothing', // HQ Female Lowrange
    'a2533977-83cb-4c10-9955-0277e047538f': 'feminine - energetic and lively', // LQ Female Midrange
    '057d53b3-bb28-47f1-9c19-a85a79851863': 'feminine - low and warm', // HQ Female Midrange
    '6e6619ba-4880-4cf3-a5df-d0697ba46656': 'feminine - high and soft', // LQ Female Highrange
    'd6e05564-eea9-4181-aee9-fa0d7315f67d': 'masculine - cool and confident', // HQ Male Lowrange
    'e6b74abb-f4b2-4a84-b9ef-c390512f2f47': 'masculine - posh and articulate', // HQ Male Midrange
    'bright_female_20s': 'feminine - bright and cheerful',
    'resonant_male_40s': 'masculine - resonant and mature',
    'gentle_female_30s': 'feminine - gentle and caring',
    'whispery_female_40s': 'feminine - whispery and mysterious',
    'formal_female_30s': 'feminine - formal and refined',
    'professional_female_30s': 'feminine - professional and direct',
    'calm_female_20s': 'feminine - calm and soothing',
    'light_male_20s': 'masculine - light and thoughtful',
    'animated_male_20s': 'masculine - hip and lively',
};

export async function loadReserveActor(data: any, stage: Stage, includeHistory: boolean): Promise<Actor|null> {
    console.log('Loading reserve actor:', data.name);
    console.log(data);

    // A minimal safeguard: a few terms with no legitimate innocent use are aged up or neutralized.
    // Most of the old find-replace list was removed because it produced more false positives than
    // genuine catches (e.g. "childhood friend", "high school uniform"); the size floor below is the
    // primary quality/appropriateness filter now.
    const bannedWordSubstitutes: {[key: string]: string} = {
        'underage': 'young adult',
        'childish': 'bratty',
        'minor': 'trivial'};


    // Preserve content while removing JSON-like structures.
    data.name = data.name.replace(/{/g, '(').replace(/}/g, ')');
    data.personality = data.personality.replace(/{/g, '(').replace(/}/g, ')');

    // Apply banned word substitutions:
    for (const [bannedWord, substitute] of Object.entries(bannedWordSubstitutes)) {
        // Need to do a case-insensitive replacement for each occurrence:
        const regex = new RegExp(bannedWord, 'gi');
        data.name = data.name.replace(regex, substitute);
        data.personality = data.personality.replace(regex, substitute);
    }

    if (Object.keys(bannedWordSubstitutes).some(word => data.personality.toLowerCase().includes(word) || data.name.toLowerCase().includes(word))) {
        console.log(`Immediately discarding actor due to banned words: ${data.name}`);
        return null;
    } else if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(`${data.name}${data.personality}`)) {
        console.log(`Immediately discarding actor due to non-english characters: ${data.name}`);
        return null;
    }

    // Fetch the avatar image to inspect properties; if it's too small, discard this actor.
    try {
        if (data.avatar) {
            const imgResponse = await fetch(data.avatar);
            const imgBlob = await imgResponse.blob();
            const imgBitmap = await createImageBitmap(imgBlob);
            if (imgBitmap.width < 400 || imgBitmap.height < 400) {
                console.log(`Discarding actor due to small avatar image: ${data.name} (${imgBitmap.width}x${imgBitmap.height})`);
                return null;
            } else if (imgBitmap.width / imgBitmap.height < 0.3 || imgBitmap.width / imgBitmap.height > 1.2) {
                console.log(`Discarding actor due to extreme avatar aspect ratio: ${data.name} (${imgBitmap.width}x${imgBitmap.height})`);
                return null;
            }
        }
    } catch (error) {
        // Failed to fetch avatar image.
        console.log(`Discarding actor due to failed avatar image fetch: ${data.name}`);
        return null;
    }

    const historyPrompt = buildEventHistory(stage, 5);

    // Take this data and use text generation to get an updated distillation of this character, including a physical description.
    const generatedResponse = await stage.makeText({
        prompt: `{{messages}}This is preparatory request for structured and formatted game content.` +
            buildPromptSegment(`Background`, `This game is a fantasy multiverse setting that pulls characters from across eras, worlds, and settings. ` +
                `The player of this game, ${stage.getSave().player.name}, presides as Magus over an isolated wizard's tower called the Sanctum for Planar Intake, Restoration, and Enrichment, or the Spire, which summons people from other realities and helps them adapt to a new life, ` +
                `with the goal of placing these characters into a new role in this world. These new roles are offered by external factions, generally in exchange for a finder's fee or reputation boost. ` +
                `Some roles are above board, while others may involve morally ambiguous or covert activities; some may even be illicit or compulsary. ` +
                `The player's motives and ethics are open-ended; they may be benevolent or self-serving, and the characters they interact with may respond accordingly. `) +
            buildPromptSegment(`Narrative Tone`, `${stage.getSave().tone || stage.TONE_MAP['Original']}`) +
            (includeHistory && historyPrompt ? buildPromptSegment(`Recent Events`, historyPrompt) : '') +
            buildPromptSegment(`Original Details`, `The Original Details below describe a character or scenario (${data.name}) from another universe. This request and response must digest and distill these details to suit the game's narrative scenario, ` +
                `crafting a character who has been drawn bodily into this world through the Spire's summoning sanctum, plucked alive - and without their consent - from their home reality by the leyline's one-way current. ` +
                `This character's supernatural or arcane abilities survive the crossing largely intact; only powers of truly cosmic scale - godhood, omniscience, reality-shaping, and the like - are dampened by the crossing to roughly the tier of a formidable archmage. ` +
                `Additionally, the Spire's standing wards prevent any ability from being used aggressively against the Magus or the tower's residents while within its walls. ` +
                `Their new description and profile should reflect their arrival in this world and any such changes.\n\n` +
                `The provided Original Details reference 'Individual X' who no longer exists in this timeline; ` +
                `if Individual X remains relevant to this character, Individual X should be replaced with an appropriate name in the distillation.\n\n` +
                `In addition to the simple display name, physical description, and personality profile, ` +
                `score the character on a scale of 1-10 for the following traits: BRAWN, SKILL, NERVE, WITS, CHARM, LUST, JOY, and TRUST.\n` +
                `Score these traits according to the character as they now stand - abilities intact save for any cosmic-tier dampening - reflecting their genuine capabilities in this world (but omit your reasons from the response structure); ` +
                `some characters may not respond well to being torn from their lives and homes without consent. Others may see an adventure, or a fresh start.\n\n` +
            buildPromptSegment(`Original Details about ${data.name}`, `${data.personality}`) +
            buildPromptSegment(`Available Voices`, `${Object.entries(VOICE_MAP).map(([voiceId, voiceDesc]) => '  - ' + voiceId + ': ' + voiceDesc).join('\n')}`) +
            buildPromptSegment(`Instructions`, `After carefully considering this description and the rules provided, the System will generate a concise breakdown for a character based upon these details in the following strict format:\n` +
                `DESCRIPTION: A vivid description of the character's physical appearance, attire, and any distinguishing features.\n` +
                `OUTFIT: A one- to two-word name for the character's current outfit that matches the description.\n` +
                `PROFILE: A brief summary of the character's key personality traits and behaviors.\n` +
                `STYLE: A concise description of the character's sense of overall style, mood, interests, or aesthetic, to be applied to the way they decorate their space.\n` +
                `NAME: Their simple name\n` +
                `VOICE: Output the specific voice ID from the Available Voices section that best matches the character's apparent gender (foremost) and personality.\n` +
                `COLOR: A hex color that reflects the character's theme or mood—use darker or richer colors that will contrast with white text.\n` +
                `FONT: A font stack, or font family that reflects the character's personality; this will be embedded in a CSS font-family property.\n` +
                Object.entries(Stat).map(([key, value]) => {
                    return `${key.toUpperCase()}: 1-10 scoring of ${getStatDescription(value).toLowerCase()}\n`;
                }).join('\n') +
                `#END#`) +
            buildPromptSegment(`Example Response`, 
                `DESCRIPTION: A tall, athletic woman with short, dark hair and piercing blue eyes. She wears a simple, utilitarian outfit made from durable materials.\n` +
                `OUTFIT: Utility Gear\n` +
                `PROFILE: Jane is confident and determined, with a strong sense of justice. She is quick to anger but also quick to forgive. She is fiercely independent and will do whatever it takes to protect those she cares about.\n` +
                `STYLE: Practical and no-nonsense, favoring functionality over fashion. Prefers muted colors and simple designs that allow freedom and comfort.\n` +
                `NAME: Jane Doe\n` +
                `VOICE: 03a438b7-ebfa-4f72-9061-f086d8f1fca6\n` +
                `COLOR: #333333\n` +
                `FONT: Calibri, sans-serif\n` +
                `BRAWN: 5\n` +
                `SKILL: 5\n` +
                `NERVE: 7\n` +
                `WITS: 6\n` +
                `CHARM: 4\n` +
                `LUST: 2\n` +
                `JOY: 3\n` +
                `TRUST: 2\n` +
                `#END#`) +
            (stage.getSave().attenuation ? 
                buildPromptSegment(`Attenuation`, 
                    `The tower's arcane focus is currently attuned to modify the resulting summoning; take the following additional context into account while forming this distillation:\n${stage.getSave().attenuation}`) : 
                '')),
        stop: ['#END'],
        include_history: true, // There won't be any history, but if this is true, the front-end doesn't automatically apply pre-/post-history prompts.
        max_tokens: 600,
    });
    console.log('Generated character distillation:');
    console.log(generatedResponse);
    // Parse the generated response into components:
    const lines = generatedResponse?.split('\n').map((line: string) => line.trim()) || [];
    const parsedData: any = {};
    // data could be erroneously formatted (for instance, "1. Name:" or "-Description:"), so be resilient:
    for (let line of lines) {
        // strip ** from line:
        line = line.replace(/\*\*/g, '');
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            // Find last word before : and use that as the key. Ignore 1., -, *. There might not be a space before the word:
            const keyMatch = line.substring(0, colonIndex).trim().match(/(\w+)$/);
            if (!keyMatch) continue;
            const key = keyMatch[1].toLowerCase();
            const value = line.substring(colonIndex + 1).trim();
            // console.log(`Parsed line - Key: ${key}, Value: ${value}`);
            parsedData[key] = value;
        }
    }
    // Create an Actor instance from the parsed data; ID should be generated uniquely
    const DEFAULT_TRAIT_MAP: Record<Stat, number> = {
        [Stat.Brawn]: 3,
        [Stat.Wits]: 4,
        [Stat.Nerve]: 3,
        [Stat.Skill]: 4,
        [Stat.Charm]: 4,
        [Stat.Lust]: 4,
        [Stat.Joy]: 3,
        [Stat.Trust]: 1
    };
    // Validate that parsedData['color'] is a valid hex color, otherwise assign a random default:
    const themeColor = /^#([0-9A-F]{6}|[0-9A-F]{8})$/i.test(parsedData['color']) ?
            parsedData['color'] :
            ['#788ebdff', '#d3aa68ff', '#75c275ff', '#c28891ff', '#55bbb2ff'][Math.floor(Math.random() * 5)];
    const generatedOutfitName = typeof parsedData['outfit'] === 'string' ? parsedData['outfit'].trim() : '';
    const newActor = new Actor(
        generateUuid(),
        // Replace name quotation marks with single-quotes to avoid issues where nicknames are highlighted as dialogue:
        (parsedData['name'] || data.name).replace(/["“”]/g, "'"),
        data.fullPath || '',
        data.avatar || '',
        parsedData['description'] || '',
        parsedData['profile'] || '',
        parsedData['style'] || '',
        data.voiceId || parsedData['voice'] || '',
        {}, 
        {
            [Stat.Brawn]: parseInt(parsedData['brawn']) || DEFAULT_TRAIT_MAP[Stat.Brawn],
            [Stat.Wits]: parseInt(parsedData['wits']) || DEFAULT_TRAIT_MAP[Stat.Wits],
            [Stat.Nerve]: parseInt(parsedData['nerve']) || DEFAULT_TRAIT_MAP[Stat.Nerve],
            [Stat.Skill]: parseInt(parsedData['skill']) || DEFAULT_TRAIT_MAP[Stat.Skill],
            [Stat.Charm]: parseInt(parsedData['charm']) || DEFAULT_TRAIT_MAP[Stat.Charm],
            [Stat.Lust]: parseInt(parsedData['lust']) || DEFAULT_TRAIT_MAP[Stat.Lust],
            [Stat.Joy]: parseInt(parsedData['joy']) || DEFAULT_TRAIT_MAP[Stat.Joy],
            [Stat.Trust]: parseInt(parsedData['trust']) || DEFAULT_TRAIT_MAP[Stat.Trust]
        },
        // Default to a random color from a small preset list of relatively neutral colors:
        // validate that parsedData is a valid hex color:
        themeColor,
        parsedData['font'] || 'Arial, sans-serif',
        generatedOutfitName || ORIGINAL_OUTFIT_NAME
    );
    console.log(`Loaded new actor: ${newActor.name} (ID: ${newActor.id})`);
    console.log(newActor);
    // If name, description, or profile are missing, or banned words are present or the attributes are all defaults (unlikely to have been set at all) or description is non-english, discard this actor by returning null
    // Rewrite discard reasons to log which reason applied:
    if (!newActor.name) {
        console.log(`Discarding actor due to missing name: ${newActor.name}`);
        return null;
    // if there's a best name match, discard this (too similar to existing characters or to the placeholder name):
    } else if (findBestNameMatch(newActor.name, [{name: 'Their Simplified Name'}, {name: stage.getSave().player.name},...Object.values(stage.getSave().actors), ...stage.getSave().reserveActors || [], ...stage.getSave().echoes.map(e => ({name: e?.name || ''})).filter(e => e.name) || []])) {
        console.log(`Discarding actor due to name similarity: ${newActor.name}`);
        return null;
    } else if (!newActor.getDescription()) {
        console.log(`Discarding actor due to missing description: ${newActor.name}`);
        return null;
    } else if (!newActor.profile) {
        console.log(`Discarding actor due to missing profile: ${newActor.name}`);
        return null;
    } else if (Object.keys(bannedWordSubstitutes).some(word => newActor.getDescription().toLowerCase().includes(word))) {
        console.log(`Discarding actor due to banned words in description: ${newActor.name}`);
        return null;
    } else if (Object.entries(newActor.stats).every(([key, value]) => value === DEFAULT_TRAIT_MAP[key as Stat])) {
        console.log(`Discarding actor due to all default stats: ${newActor.name}`);
        return null;
    } else if (newActor.name.length <= 2 || newActor.name.length >= 30) {
        console.log(`Discarding actor due to extreme name length: ${newActor.name}`);
        return null;
    } else if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(`${newActor.name}${newActor.getDescription()}${newActor.profile}`)) {
        console.log(`Discarding actor due to non-english characters in name/description/profile: ${newActor.name}`);
        return null;
    } else if (Object.values(newActor.stats).some(value => value < 1 || value > 10)) {
        console.log(`Discarding actor due to out-of-bounds stats: ${newActor.name}`);
        return null;
    }

    return newActor;
}

export async function generateBaseActorImage(
    actor: Actor,
    stage: Stage,
    force: boolean = false,
    fromAvatar: boolean = true,
    outfitId: string = '',
    sourceImageUrl: string = ''
): Promise<void> {
    const targetOutfitId = outfitId || actor.outfitId;
    console.log(`Populating images for actor ${actor.name} (ID: ${actor.id})`);
    console.log(`Force regeneration: ${force}, From avatar: ${fromAvatar}, Source image URL: ${sourceImageUrl}`);
    // If the actor has no neutral emotion image in their emotion pack, generate one based on their description or from the existing avatar image
    if (!actor.getEmotionImageUrl('neutral', targetOutfitId) || force) {
        console.log(`Generating neutral emotion image for actor ${actor.name}`);
        // Want to clear in-progress stuff if forcing
        if (force) {
            actor.setEmotionPack({}, targetOutfitId);
            delete stage.imageGenerationPromises[`actor/${actor.id}`];
        } else if (Object.keys(stage.imageGenerationPromises).includes(`actor/${actor.id}`)) {
            return; // Don't generate if there's already a generation in progress for this actor, unless we're forcing regeneration
        }
        let imageUrl = '';
        let baseSourceImage = sourceImageUrl || actor.avatarImageUrl || '';
        
        if (!baseSourceImage || !fromAvatar) {
            console.log(`Generating new image for actor ${actor.name} from description`);
            // Use stage.makeImage to create a neutral expression based on the description
            imageUrl = await stage.makeImage({
                prompt: (`${((stage.getSave().characterArtStyle || 'original') === 'original') ? 'Illustrate this character in a hyperrealistic anime visual novel style' : ART_PROMPT[stage.getSave().characterArtStyle || 'original']}: ` +
                    `${actor.getDescription(targetOutfitId)}. Create a waist-up portrait of this character with a neutral expression and pose, placed on a light gray background. `)
                    .replace('{{ARTIST}}', stage.getSave().characterArtist || 'some professional'),
                aspect_ratio: AspectRatio.PHOTO_VERTICAL
            }, '');
            baseSourceImage = imageUrl || '';
        }

        // Use stage.makeImageFromImage to create a base image.
        imageUrl = await stage.makeImageFromImage({
            image: baseSourceImage,
            prompt: (fromAvatar ? `${ART_PROMPT[stage.getSave().characterArtStyle || 'original']}.` : '').replace('{{ARTIST}}', stage.getSave().characterArtist || 'some professional') + 
                `Create a waist-up portrait of this character to match this updated description: ${actor.getDescription(targetOutfitId)}\nGive them a neutral expression and pose and place them on a light gray background. ` +
                `Regardless of the description, zoom and crop the image at their waist, but maintain a margin of negative space over their head/hair.`,
            remove_background: true,
            transfer_type: 'edit'
        }, '');
        
        console.log(`Generated base emotion image for actor ${actor.name} from avatar image: ${imageUrl || ''}`);
        
        actor.setEmotionImageUrl('base', imageUrl || '', targetOutfitId);

        if (force) {
            // Invalidate all other emotions
            actor.setEmotionPack({'base': actor.getEmotionImageUrl('base', targetOutfitId)}, targetOutfitId);
        }
        // Generate neutral but don't wait up.
        void generateEmotionImage(actor, Emotion.neutral, stage, false, targetOutfitId);
    }
}

export async function generateAdditionalActorImages(actor: Actor, stage: Stage, outfitId: string = ''): Promise<void> {
    const targetOutfitId = outfitId || actor.outfitId;

    console.log(`Generating additional emotion images for actor ${actor.name} (ID: ${actor.id})`);
    if (actor.getEmotionImageUrl('neutral', targetOutfitId)) {
        // Generate in serial and not parallel as below:
        for (const emotion of Object.values(Emotion)) {
            // Only generate if the emotion image is missing, and only if the actor is in the save or currently in an echo slot
            if (!actor.getEmotionImageUrl(emotion, targetOutfitId) && (Object.keys(stage.getSave().actors).includes(actor.id) || stage.getEchoSlots().some(slot => slot?.id || '' === actor.id))) {
                await generateEmotionImage(actor, emotion, stage, false, targetOutfitId);
            }
        }
    }
}

export async function generateEmotionImage(actor: Actor, emotion: Emotion, stage: Stage, force: boolean = false, outfitId: string = ''): Promise<string> {
    const targetOutfitId = outfitId || actor.outfitId;
    if (actor.getEmotionImageUrl('base', targetOutfitId) && (!stage.imageGenerationPromises[`actor/${actor.id}`] || force) && (emotion == 'neutral' || !stage.getSave().disableEmotionImages)) {
        console.log(`Generating ${emotion} emotion image for actor ${actor.name}`);
        const outfit = actor.getOutfitById(targetOutfitId);
        const emotionPrompt = await ensureOutfitEmotionPrompt(actor, emotion, stage, targetOutfitId) || EMOTION_PROMPTS[emotion];
        stage.imageGenerationPromises[`actor/${actor.id}`] = stage.makeImageFromImage({
            image: actor.getEmotionImageUrl('base', targetOutfitId) || '',
            prompt: `${emotionPrompt}`,
            remove_background: true,
            transfer_type: 'edit'
        }, '');
        const imageUrl = await stage.imageGenerationPromises[`actor/${actor.id}`];
        delete stage.imageGenerationPromises[`actor/${actor.id}`];
        console.log(`Generated ${emotion} emotion image for actor ${actor.name}: ${imageUrl || ''}`);
        actor.setEmotionImageUrl(emotion, imageUrl || '', targetOutfitId);
        return imageUrl || '';
    }
    return '';
}

function buildEmotionPromptGenerationInstruction(actor: Actor, outfit: Outfit, emotion: Emotion): string {

    return `{{messages}}This is a preparatory request for a single image-edit instruction for character art generation.\n\n` +
        buildPromptSegment(`Character details`, actor.profile) +
        buildPromptSegment(`Current outfit`, outfit.description) +
        buildPromptSegment(`Personality and public persona`, actor.profile) +
        buildPromptSegment(`Target mood`, `${emotion} (${EMOTION_PROMPTS[emotion]})`) +
        buildPromptSegment(`Instruction`, `Write exactly one concise prompt for an image editing model to revise a base image of this character already in this outfit. ` +
            `The prompt is intended to guide the model in adjusting an image to suit the target mood by visually describing changes to this character's expression, posture, gesture, ` +
            `and demeanor in a way that takes their style, personality, and outfit into account where appropriate. ` +
            `Only describe elements that are relevant to the target image. Output only the final prompt text and then #END#`) +
        buildPromptSegment(`Example response`, `This woman is now in a flirty, playful mood. She smiles and leans forward slightly, with a glint in her half-lidded eyes. She blushes and plays with her hair.\n#END#\n`) +
        buildPromptSegment(`Example response`, `This man is now in a somber, reflective mood. He looks downcast, with slumped shoulders and a frown. His eyes look down and away, and he appears lost in thought.\n#END#\n`) +
        buildPromptSegment(`Prompt`, `Output the new emotion image prompt.`);
}

async function ensureOutfitEmotionPrompt(actor: Actor, emotion: Emotion, stage: Stage, outfitId: string = ''): Promise<string> {
    const outfit = actor.getOutfitById(outfitId) || actor.getActiveOutfit();
    const existingPrompt = typeof outfit?.prompts?.[emotion] === 'string' ? outfit.prompts[emotion].trim() : '';
    if (existingPrompt) {
        return existingPrompt;
    }

    return (await generateOutfitEmotionPrompt(actor, emotion, stage, outfit.id)).trim();
}

export async function generateOutfitEmotionPrompt(actor: Actor, emotion: Emotion, stage: Stage, outfitId: string = ''): Promise<string> {
    const outfit = actor.getOutfitById(outfitId) || actor.getActiveOutfit();
    const generationKey = `actor-prompt/${actor.id}/${outfit.id}/${emotion}`;
    const existingGeneration = stage.imageGenerationPromises[generationKey];
    if (existingGeneration) {
        return existingGeneration as Promise<string>;
    }

    /*if (stage.betaMode) {
        const promptRequest = stage.generator.textGen({
                prompt: buildEmotionPromptGenerationInstruction(actor, outfit, emotion),
                stop: ['#END'],
                include_history: true,
                max_tokens: 150,
            }).then((response: any) => {
                const generatedPrompt = response?.result?.trim() || '';
                if (generatedPrompt) {
                    outfit.prompts[emotion] = generatedPrompt;
                    stage.saveGame();
                }
                return generatedPrompt;
            }).finally(() => {
                delete stage.imageGenerationPromises[generationKey];
            });

            stage.imageGenerationPromises[generationKey] = promptRequest;
            return promptRequest;
    }*/

    // Temporary.
    return EMOTION_PROMPTS[emotion];
}

export async function generateActorDecor(actor: Actor, module: Module, stage: Stage, force: boolean = false): Promise<string> {
    if (module.type === 'director module') {
        // Director modules don't get decor images
        return '';
    }
    if (!force && (Object.keys(actor.decorImageUrls).includes(module.type) && actor.decorImageUrls[module.type] && actor.decorImageUrls[module.type] !== module.getAttribute('baseImageUrl'))) {
        return actor.decorImageUrls[module.type];
    }
    if (Object.keys(stage.imageGenerationPromises).includes(`actor/decor/${actor.id}/${module.type}`) || stage.getSave().disableDecorImages) {
        return '';
    }

    console.log(`Generating decor image for actor ${actor.name} in module ${module.getAttribute('name')}`);
    
    // Bundle both the description generation and image generation into a single promise
    stage.imageGenerationPromises[`actor/decor/${actor.id}/${module.type}`] = (async () => {
        // Generate a decor prompt for this actor for this space, based on the module's description and the actor's style
        const descriptionPrompt = `Generate an updated description of this room within a wizard's tower: ${module.getAttribute('name')}.\n` +
            `The current description is: ${module.getAttribute('description')}.\n` +
            `Output an updated description of this room, including additional details for furnishings and decorations to help the description match this aesthetic: ${actor.style}.\n` +
            `Example Response:\n` +
            `The room is a warm stone chamber with tidy, well-crafted furnishings. The walls are hung with tapestries in bold colors, and the furniture is carved dark wood with brass fittings. A tall arched window offers a sweeping view of the jungle canopy below. The overall vibe is scholarly and inviting, with warmth added by candlelight and plush textiles.\n#END#\n`;
        const decorDescriptionResponse = await stage.generator.textGen({
            prompt: descriptionPrompt,
            stop: ['#END'],
            min_tokens: 30,
            max_tokens: 400,
        });

        // Generate a decor image based on the generated room description
        const decorImageUrl = await stage.makeImageFromImage({
            image: module.getAttribute('baseImageUrl') || '',
            prompt: `Redecorate this room within a wizard's tower to match this description: ${decorDescriptionResponse?.result || module.getAttribute('description')}.\n` +
                    `The scene remains unoccupied; remove any people from the result.`,
            remove_background: false,
            transfer_type: 'edit'
        }, module.getAttribute('baseImageUrl') || '');

        return decorImageUrl;
    })();
    
    const decorImageUrl = await stage.imageGenerationPromises[`actor/decor/${actor.id}/${module.type}`];
    delete stage.imageGenerationPromises[`actor/decor/${actor.id}/${module.type}`];
    console.log(`Generated decor image for actor ${actor.name} and ${module.getAttribute('name')}: ${decorImageUrl || ''}`);
    actor.decorImageUrls[module.type] = decorImageUrl || '';
    return decorImageUrl || '';
}

/**
 * Commits an actor to the echo process by generating their primary image
 * Additional images are generated in the background
 */
export async function commitActorToEcho(actor: Actor, stage: Stage, outfitId: string = ''): Promise<void> {
    const targetOutfitId = outfitId || actor.outfitId;
    if (actor.getEmotionImageUrl('neutral', targetOutfitId)) {
        // If neutral image exists, start background generation of additional images if not complete
        generateAdditionalActorImages(actor, stage, targetOutfitId).catch(console.error);
        return; // Neutral image already exists, actor is ready
    }
    
    console.log(`Committing actor ${actor.name} to echo process`);
    
    // Generate the primary image (this makes the character ready)
    await generateBaseActorImage(actor, stage, false, true, targetOutfitId);
    
    // Start generating additional emotion images in the background
    generateAdditionalActorImages(actor, stage, targetOutfitId).catch(console.error);
}

export function namesMatch(name: string, possibleName: string): boolean {

    name = name?.toLowerCase() || '';
    possibleName = possibleName?.toLowerCase() || '';

    const names = name.split(' ');
    // If the possible name contains at least half of the parts of the character name, then close enough.
    if (names.filter(namePart => !possibleName.includes(namePart)).length <= Math.floor(names.length / 2)) {
        return true;
    }

    // Otherwise, use Levenshtein distance to determine if an input string is referring to this character's name
    const matrix = Array.from({ length: name.length + 1 }, () => Array(possibleName.length + 1).fill(0));
    for (let i = 0; i <= name.length; i++) {
        for (let j = 0; j <= possibleName.length; j++) {
            if (i === 0) {
                matrix[i][j] = j;
            } else if (j === 0) {
                matrix[i][j] = i;
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + (name[i - 1] === possibleName[j - 1] ? 0 : 1)
                );
            }
        }
    }
    return matrix[name.length][possibleName.length] < Math.min(name.length / 1.5, possibleName.length / 1.5);
}

/**
 * Calculate a similarity score between two names. Higher scores indicate better matches.
 * Returns a value between 0 and 1, where 1 is a perfect match.
 * @param name The reference name
 * @param possibleName The name to compare against
 * @returns A similarity score between 0 and 1
 */
export function getNameSimilarity(name: string, possibleName: string): number {
    name = name.toLowerCase();
    possibleName = possibleName.toLowerCase();

    // Exact match gets perfect score
    if (name === possibleName) {
        return 1.0;
    }

    // Check word-based matching first (higher priority)
    const names = name.split(' ');
    const possibleNames = possibleName.split(' ');
    
    // Count matching words
    let matchingWords = 0;
    for (const namePart of names) {
        if (possibleName.includes(namePart)) {
            matchingWords++;
        }
    }
    
    // If we have good word matches, prioritize that
    const wordMatchRatio = matchingWords / names.length;
    if (wordMatchRatio >= 0.5) {
        // Boost score for word matches, scaled by the ratio
        return 0.7 + (wordMatchRatio * 0.3);
    }

    // Use Levenshtein distance for fuzzy matching
    const matrix = Array.from({ length: name.length + 1 }, () => Array(possibleName.length + 1).fill(0));
    for (let i = 0; i <= name.length; i++) {
        for (let j = 0; j <= possibleName.length; j++) {
            if (i === 0) {
                matrix[i][j] = j;
            } else if (j === 0) {
                matrix[i][j] = i;
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + (name[i - 1] === possibleName[j - 1] ? 0 : 1)
                );
            }
        }
    }
    
    const distance = matrix[name.length][possibleName.length];
    const maxLength = Math.max(name.length, possibleName.length);
    
    // Convert distance to similarity (0 to 1)
    return Math.max(0, 1 - (distance / maxLength));
}

/**
 * Find the best matching name from a list of candidates.
 * @param searchName The name to search for
 * @param candidates An array of objects with name properties
 * @returns The best matching candidate, or null if no good match is found
 */
export function findBestNameMatch<T extends { name: string }>(
    searchName: string,
    candidates: T[]
): T | null {
    if (!searchName || candidates.length === 0) {
        return null;
    }

    let bestMatch: T | null = null;
    let bestScore = 0;
    const threshold = 0.7; // Minimum similarity threshold

    for (const candidate of candidates) {
        const score = getNameSimilarity(candidate.name, searchName);
        // Only consider matches above threshold
        if (score > threshold && score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
        }
    }

    return bestMatch;
}

export function getRole(actor: Actor, save: SaveType): string {
    const roleModule = save.layout.getModulesWhere((m: any) => m && m.type !== 'quarters' && m.ownerId === actor.id)[0];
    if (roleModule !== undefined) {
        return roleModule.getAttribute('role') || '';
    } else if (save.aide.actorId === actor.id) {
        return 'Tower Spirit';
    } else if (actor.factionId && save.factions[actor.factionId]) {
        return save.factions[actor.factionId].name;
    }
    return '';
}

export default Actor;