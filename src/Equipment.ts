/*
 * Equipment - Pass A (data layer).
 *
 * All clothes, weapons, and held objects are equipment: individual items with simple descriptions,
 * placed into common RPG slots. This replaces the combinatorial outfit model as the NARRATIVE source
 * of truth for what a character is wearing/holding - the LLM reads clothing from these slots and
 * ONLY these slots (the legacy outfit blurb is image-gen-only and never shown to the LLM).
 *
 * Two kinds:
 *  - 'temporary': emergent gear (including whatever a summon arrived in). Lost on desummon,
 *    naturally low durability, not easily repaired. (Loss/archive mechanics land in Pass B.)
 *  - 'system': bought from the Game Master's shop. Permanent, repairable, may carry stat bonuses.
 *
 * Durability influences the narrative DESCRIPTION only - never the portrait.
 */
import { v4 as generateUuid } from 'uuid';

export enum EquipSlot {
    HEAD = 'head',
    TORSO = 'torso',
    HANDS = 'hands',        // worn on the hands (gloves, rings)
    LEGS = 'legs',
    FEET = 'feet',
    LEFT_HAND = 'left hand',   // held
    RIGHT_HAND = 'right hand', // held
    ACCESSORY = 'accessory',   // one flex slot: necklace, bag, watch, etc.
}

/** Display order for UI and prompt lines. */
export const EQUIP_SLOTS: EquipSlot[] = [
    EquipSlot.HEAD, EquipSlot.TORSO, EquipSlot.HANDS, EquipSlot.LEGS, EquipSlot.FEET,
    EquipSlot.LEFT_HAND, EquipSlot.RIGHT_HAND, EquipSlot.ACCESSORY,
];

export interface EquipmentItem {
    id: string;
    name: string;               // "faded band tee", "chipped kitchen knife"
    description: string;        // one simple sentence at most
    slot: EquipSlot | string;
    kind: 'temporary' | 'system';
    durability: number;         // current
    maxDurability: number;
    bonuses?: { [stat: string]: number }; // System gear may carry capability-stat bonuses (applied via Actor.getEffectiveStat, clamped at the rank cap).
}

// Tunable: temporary gear is naturally flimsier than system gear.
export const TEMP_MAX_DURABILITY = 3;
export const SYSTEM_MAX_DURABILITY = 5;

export function createTemporaryItem(name: string, description: string, slot: EquipSlot | string): EquipmentItem {
    return {
        id: generateUuid(),
        name: name.trim(),
        description: (description || '').trim(),
        slot,
        kind: 'temporary',
        durability: TEMP_MAX_DURABILITY,
        maxDurability: TEMP_MAX_DURABILITY,
    };
}

/** Durability as narrative wording. Text-only by design - wear never touches the portrait. */
export function describeDurability(item: EquipmentItem): string {
    const ratio = item.maxDurability > 0 ? item.durability / item.maxDurability : 0;
    if (ratio >= 1) return 'pristine';
    if (ratio >= 0.75) return 'good condition';
    if (ratio >= 0.5) return 'worn';
    if (ratio > 0.25) return 'tattered';
    return 'barely holding together';
}

/**
 * The slot list handed to the LLM: simple descriptions plus numbers where applicable.
 * e.g. "torso: faded band tee (worn, 2/3); right hand: chipped kitchen knife (pristine, 3/3)"
 */
export function formatEquipmentLine(equipped: { [slot: string]: EquipmentItem } | undefined): string {
    if (!equipped) return 'nothing tracked';
    const parts: string[] = [];
    for (const slot of EQUIP_SLOTS) {
        const item = equipped[slot];
        if (!item) continue;
        parts.push(`${slot}: ${item.name} (${describeDurability(item)}, ${item.durability}/${item.maxDurability})`);
    }
    return parts.length > 0 ? parts.join('; ') : 'nothing tracked';
}
