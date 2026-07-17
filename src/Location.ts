import { v4 as generateUuid } from 'uuid';

/*
 * The Location graph. Replaces SPIRE's tower grid: no spatial layout, no build costs, no rooms to
 * staff. A location is just a node in a tree - Home is the root, discovered places hang off it, and
 * skits (later) can birth sub-locations that attach to wherever they happened. Navigation is a
 * dropdown, so the only image a location needs is one background, generated lazily on first visit.
 *
 * Named GameLocation to avoid colliding with the DOM's global `Location`.
 */
export interface GameLocation {
    id: string;
    name: string;
    description: string;
    parentId: string | null;      // null = top-level; Home is the root
    childIds: string[];
    backgroundUrl?: string;       // lazy - generated on first visit, then cached here
    backgroundPending?: boolean;  // a generation is in flight
    population?: string;          // what kind of people tend to be here (drives NPC selection later)
    tags?: string[];              // gates which skits/events can fire here
    discoveredOnTurn: number;
    lastVisitedTurn: number;
    archived?: boolean;           // unvisited 10+ turns -> tucked into the archive submenu, never deleted
    isHome?: boolean;             // the root; peaceful, slice-of-life, never archived
}

export const HOME_LOCATION_ID = 'home';
export const ARCHIVE_AFTER_TURNS = 10;

export function createHomeLocation(turn: number): GameLocation {
    return {
        id: HOME_LOCATION_ID,
        name: 'Home',
        description: "Your apartment. Small, familiar, and - for now - the one place the game hasn't reached into. A safe place to simply be with whoever you've summoned.",
        parentId: null,
        childIds: [],
        population: 'no one but you and your summon',
        tags: ['home', 'safe', 'slice-of-life'],
        discoveredOnTurn: turn,
        lastVisitedTurn: turn,
        isHome: true,
    };
}

export function createLocation(params: {
    name: string;
    description: string;
    parentId: string | null;
    population?: string;
    tags?: string[];
    turn: number;
}): GameLocation {
    return {
        id: generateUuid(),
        name: params.name,
        description: params.description,
        parentId: params.parentId,
        childIds: [],
        population: params.population,
        tags: params.tags,
        discoveredOnTurn: params.turn,
        lastVisitedTurn: params.turn,
    };
}

/**
 * A small curated pool of places the player can stumble onto while exploring, as a self-contained
 * stand-in until skit outcomes generate location specifics via the LLM (that arrives with the
 * Skit.ts conversion). Each is an ordinary modern-world spot - the mundane backdrop the game's
 * strangeness intrudes upon.
 */
export const DISCOVERABLE_PLACES: Array<{ name: string; description: string; population: string; tags: string[] }> = [
    { name: 'The Corner Store', description: 'A cramped convenience store, fluorescent-lit and always open. The clerk barely looks up.', population: 'a bored clerk, the occasional late-night customer', tags: ['urban', 'mundane'] },
    { name: 'Riverside Park', description: 'A strip of green along the water, benches and a jogging path. Quiet enough to think, public enough to be seen.', population: 'joggers, dog-walkers, people avoiding home', tags: ['outdoor', 'public'] },
    { name: 'The Third Rail', description: 'A dim basement bar that smells of old beer and older regrets. Nobody asks questions here.', population: 'night-shift drinkers, a taciturn bartender', tags: ['urban', 'nightlife'] },
    { name: 'Underpass Market', description: 'A sprawl of stalls beneath the overpass - cheap electronics, stranger goods, cash only.', population: 'hawkers, hagglers, people who deal in things that fell off trucks', tags: ['urban', 'market', 'shady'] },
    { name: 'Rooftop Access', description: 'A gravel rooftop with a chained door someone left unlocked. The whole city laid out and indifferent below.', population: 'no one, usually', tags: ['outdoor', 'isolated', 'high'] },
    { name: 'All-Night Diner', description: 'Vinyl booths, bottomless coffee, and the particular loneliness of 3 a.m. food.', population: 'insomniacs, truckers, a tired waitress', tags: ['urban', 'mundane', 'refuge'] },
];
