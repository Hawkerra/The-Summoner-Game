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

/**
 * Second-pass trait assignment: runs on a candidate while they wait in the reserve (or as a
 * backfill on accept). A small dedicated LLM call - the 700-name catalog rides THIS call, not the
 * big distillation. Guarantees 3-7 traits: unknown names are dropped, and a shortfall below 3 is
 * padded from the common-rarity pool so no card ships traitless. Bond baseline shifts (who they
 * are on arrival) apply exactly once, guarded by actor.traitsAssigned.
 */
export async function assignTraitsToActor(actor: any, stage: any): Promise<void> {
    if (actor.traitsAssigned) return;
    let picked: TraitDef[] = [];
    try {
        const prompt = `{{messages}}Choose the defining traits for this character.\n` +
            `Character: ${actor.name}\nDescription: ${String(actor.description || (actor.getDescription ? actor.getDescription() : '') || '').slice(0, 600)}\nProfile: ${String(actor.profile || '').slice(0, 600)}\n\n` +
            `Pick EXACTLY 3 to 7 trait names from the catalog below that best capture who this character is. ` +
            `Copy the names exactly as written; do not invent traits.\n` +
            `Respond with ONLY one line:\nTRAITS: <comma-separated names>\n\n` +
            `Catalog: ${traitCatalogNames()}`;
        // Race the LLM call against a timeout: a hung generation must NOT freeze the whole
        // reserve pass (its dedup guard would then block every future kick - zero traits forever).
        const text = await Promise.race([
            stage.makeText({ prompt, max_tokens: 120, min_tokens: 3, include_history: false }),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('trait call timeout (45s)')), 45_000)),
        ]);
        console.log(`[traits] raw response for ${actor.name}:`, (text || '').slice(0, 200));
        const m = (text || '').match(/TRAITS:\s*(.+)/i);
        picked = resolveTraits((m ? m[1] : text || '').split(',').map((t: string) => t.trim()).filter(Boolean));
    } catch (e) {
        console.warn(`[traits] LLM assignment failed for ${actor.name}; padding from commons.`, e);
    }
    try {
        if (picked.length < 3) {
            const commons = TRAIT_CATALOG.filter(t => t.r === 'common' && !picked.some(p => p.n === t.n));
            while (picked.length < 3 && commons.length > 0) {
                picked.push(commons.splice(Math.floor(Math.random() * commons.length), 1)[0]);
            }
        }
        actor.traits = picked.map(t => t.n);
        if (!actor.stats) actor.stats = {};
        for (const trait of picked) {
            for (const [stat, amt] of Object.entries(trait.b || {})) {
                actor.stats[stat] = Math.max(1, Math.min(7, (actor.stats[stat] ?? 3) + (amt as number)));
            }
        }
        actor.traitsAssigned = true;
        console.log(`[traits] ${actor.name} assigned: ${actor.traits.join(', ')}`);
    } catch (e) {
        console.warn(`[traits] apply step failed for ${actor.name}`, e);
    }
}
