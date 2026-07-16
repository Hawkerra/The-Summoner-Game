/**
 * Generic save rehydration system for restoring class instances from plain objects
 */

import { Layout } from './Module';
import Actor from './actors/Actor';
import Faction from './factions/Faction';

// Registry of classes that can be rehydrated
type RehydratableClass = {
    new (...args: any[]): any;
    fromSave?: (data: any) => any;
};

const CLASS_REGISTRY: Record<string, RehydratableClass> = {
    'Layout': Layout,
    'Actor': Actor,
    'Faction': Faction,
    'Request': Request,
};

/**
 * Register a class for automatic rehydration
 */
export function registerRehydratableClass(className: string, classConstructor: RehydratableClass) {
    CLASS_REGISTRY[className] = classConstructor;
}

/**
 * Automatically rehydrate an object by detecting its class type and calling the appropriate fromSave method
 */
export function rehydrateObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(rehydrateObject);
    }

    // Check if this object has a class identifier
    const className = obj.__className || obj.constructor?.name;
    
    // Try to find the class in our registry
    if (className && CLASS_REGISTRY[className]) {
        const ClassConstructor = CLASS_REGISTRY[className];
        
        // If the class has a fromSave method, use it
        if (ClassConstructor.fromSave) {
            return ClassConstructor.fromSave(obj);
        }
        
        // Otherwise, create an instance and copy properties
        const instance = Object.create(ClassConstructor.prototype);
        return Object.assign(instance, rehydrateNestedObjects(obj));
    }

    // For plain objects, recursively rehydrate nested properties
    return rehydrateNestedObjects(obj);
}

/**
 * Recursively rehydrate nested objects in a plain object
 */
function rehydrateNestedObjects(obj: any): any {
    const result: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
        result[key] = rehydrateObject(value);
    }
    
    return result;
}

/**
 * Enhanced rehydration that tries to detect class types by structure/properties
 */
export function smartRehydrate(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(smartRehydrate);
    }

    // Try to detect Layout by structure. Supports both the legacy single-grid shape (obj.grid)
    // and the multi-floor shape (obj.floors), which serializes without a top-level `grid` key
    // because `grid` is a getter over the current floor.
    const looksDimensioned = (obj.gridSize && typeof obj.gridSize === 'number') ||
        (obj.gridWidth && obj.gridHeight && typeof obj.gridWidth === 'number' && typeof obj.gridHeight === 'number');
    if ((Array.isArray(obj.floors) || obj.grid) && looksDimensioned) {
        return Layout.fromSave(obj);
    }

    // Try to detect Actor by structure
    if (obj.id && obj.name && obj.stats && (obj.emotionPack || obj.outfits)) {
        return Actor.fromSave(obj);
    }

    // Try to detect Faction by structure
    if (obj.id && obj.name && obj.reputation !== undefined && obj.visualStyle && obj.themeColor) {
        return Faction.fromSave(obj);
    }

    // For plain objects, recursively rehydrate nested properties
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = smartRehydrate(value);
    }
    
    return result;
}