/*
 * Traits - Pass 6. 3-7 traits are assigned to each summon at distillation, chosen by the LLM from
 * the catalog in traitsData.ts (700 entries inherited from a fellow PARC-license game with its
 * creator's blessing; curation for the modern setting is pending - many entries are spaceship-
 * flavored). Traits are the ONLY route past rank 7: capability modifiers apply to EFFECTIVE stats
 * (base + gear + traits, clamped at 13). Bond modifiers (lust/joy/trust) are applied ONCE as
 * baseline shifts at distillation - they describe who the person is on arrival, not a purchasable
 * boost - and Health modifiers add a flat bonus to the derived pool.
 */

export interface TraitDef {
    n: string;                       // name
    r: string;                       // rarity: common | uncommon | rare | legendary
    g: string;                       // magnitude: minor | major | extreme
    d: string;                       // one-line description (shown on hover; stat numbers are NOT)
    m?: { [stat: string]: number };  // capability modifiers -> effective stats
    b?: { [stat: string]: number };  // bond baseline shifts -> applied once at distillation
    h?: number;                      // health modifier -> flat max-health bonus (x5 per point)
}

import { TRAIT_CATALOG } from './traitsData';

export const TRAIT_RARITY_COLORS: { [rarity: string]: string } = {
    common: '#b8c0cc',
    uncommon: '#57e08a',
    rare: '#4da3ff',
    legendary: '#ffb14d',
};

export const HEALTH_PER_TRAIT_POINT = 5; // one trait Health point = +5 max health (same weight as +1 Brawn)

function normalizeTraitName(name: string): string {
    return (name || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
}

const TRAIT_INDEX: Map<string, TraitDef> = new Map(TRAIT_CATALOG.map(t => [normalizeTraitName(t.n), t]));

export function getTraitByName(name: string): TraitDef | undefined {
    return TRAIT_INDEX.get(normalizeTraitName(name));
}

/** Resolve a list of LLM-proposed names against the catalog; unknowns are dropped, capped at 7. */
export function resolveTraits(names: string[]): TraitDef[] {
    const seen = new Set<string>();
    const out: TraitDef[] = [];
    for (const raw of names) {
        const t = getTraitByName(raw);
        if (t && !seen.has(t.n)) {
            seen.add(t.n);
            out.push(t);
            if (out.length >= 7) break;
        }
    }
    return out;
}

/** The full catalog as a compact name list for the distillation prompt. */
export function traitCatalogNames(): string {
    return TRAIT_CATALOG.map(t => t.n).join(', ');
}
