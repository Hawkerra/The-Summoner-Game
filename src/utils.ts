import { Stage } from "./Stage";

/**
 * Converts a numeric score (1-10) to a letter grade
 * @param score - The score to convert (will be clamped between 1 and 10)
 * @returns A letter grade string (F, D, C, C+, B-, B, B+, A-, A, A+)
 */
export function scoreToGrade(score: number): string {
    const scoreClamped = Math.max(1, Math.min(10, score));
    const scoreArray = ['F', 'D', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
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
        'A+': 10
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
