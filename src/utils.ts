import { Stage } from "./Stage";

/**
 * Converts a numeric score (1-13) to a letter grade on the Summoner Game rank scale.
 * @param score - The score to convert (clamped between 1 and 13)
 * @returns A letter grade string (F, D, C, C+, B-, B, B+, A-, A, A+, S, SS, SSS)
 *
 * 1-7 is the human band (7 = peak human); 8-10 superhuman; 11-13 (S/SS/SSS) divine.
 * Base distillation never exceeds 7 - ranks above that come from traits or SP.
 */
export function scoreToGrade(score: number): string {
    if (typeof score !== 'number' || isNaN(score)) return '-';
    const scoreClamped = Math.max(1, Math.min(13, Math.round(score)));
    const scoreArray = ['F', 'D', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S', 'SS', 'SSS'];
    return scoreArray[scoreClamped - 1];
}

export function gradeToScore(grade: string): number {
    const gradeMap: { [key: string]: number } = {
        'F': 1,
        'D': 2,
        'C': 3,
        'C+': 4,
        'B-': 5,
        'B': 6,
        'B+': 7,
        'A-': 8,
        'A': 9,
        'A+': 10,
        'S': 11,
        'SS': 12,
        'SSS': 13
    };
    return gradeMap[grade] || 1; // Default to 1 if grade not found
}

/**
 * Assigns an actor to a role (non-quarters module), handling all necessary state updates:
 * - Clears any previous role assignment for this actor
 * - Assigns the actor as owner of the target module
 * - Initializes heldRoles tracking if this is a new role for the actor
 * 
 * @param actor - The actor to assign to the role
 * @param targetModule - The module (with a 'role' attribute) to assign the actor to
 * @param layout - The station layout
 */
export function assignActorToRole(stage: Stage,
    actor: any, 
    targetModule: any, 
    layout: any
): void {
    let previousRoleName = '';
    let previousRoleHolder = '';
    // Clear any previous role assignment for this actor (non-quarters modules only)
    layout.getLayout().flat().forEach((module: any) => {
        if (module && module.type !== 'quarters' && module.ownerId === actor.id) {
            previousRoleName = module.getAttribute('role') || '';
            module.ownerId = undefined;
        }
    });

    if (targetModule.ownerId && targetModule.ownerId !== actor.id) {
        previousRoleHolder = stage.getSave().actors[targetModule.ownerId]?.name || '';
    }
    // Assign the actor to this module as their role
    targetModule.ownerId = actor.id;

    // Initialize heldRoles if it doesn't exist
    if (!actor.heldRoles) {
        actor.heldRoles = {};
    }

    // Initialize the role's day count if this is a new role
    const roleName = targetModule.getAttribute('role') || '';
    if (roleName && actor.heldRoles[roleName] === undefined) {
    stage.pushToTimeline(stage.getSave(), `${actor.name} assigned to role: ${roleName}` + (previousRoleHolder ? ` (replacing ${previousRoleHolder})` : '') + '.');
        actor.heldRoles[roleName] = 0;
    } else if (previousRoleName) {
        stage.pushToTimeline(stage.getSave(), `${actor.name} removed from role: ${previousRoleName}.`);
    }

}
