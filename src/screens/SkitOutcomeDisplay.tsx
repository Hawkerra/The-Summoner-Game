import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { Paper, Typography, Box } from '@mui/material';
import { TrendingUp, Handshake, TrendingDown, ContentCut, Work, DomainAdd, Output, Input, PersonAdd } from '@mui/icons-material';
import Actor, { Stat, ACTOR_STAT_ICONS, getRole } from '../actors/Actor';
import Nameplate from '../components/Nameplate';
import { scoreToGrade } from '../utils';
import { StationStat, STATION_STAT_ICONS } from '../Module';
import { Outcome } from '../Skit';
import { Stage } from '../Stage';

const outcomeCardSx = {
    background: 'var(--bg-darker-blue)',
    border: 'var(--border-primary)',
    borderRadius: '12px',
    p: 2,
    backdropFilter: 'var(--backdrop-blur)',
    textAlign: 'center' as const,
    color: 'var(--text-primary)',
    boxShadow: 'var(--glow-primary)'
};

const outcomeHeaderCardSx = {
    ...outcomeCardSx,
    background: 'linear-gradient(135deg, var(--color-primary-20) 0%, rgba(0, 180, 100, 0.25) 50%, var(--color-primary-15) 100%)',
    border: 'var(--border-primary-bright)',
    p: 1.5
};

const outcomeContentCardSx = {
    px: 1.5,
    py: 1.25,
    background: 'color-mix(in srgb, var(--bg-glass-darker) 68%, transparent)',
    borderRadius: '8px',
    border: '1px solid var(--color-primary-20)',
    textAlign: 'left' as const,
    color: 'var(--text-primary)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)'
};

const outcomeMicroLabelSx = {
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    mb: 0.4
};

const outcomeBodyTextSx = {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    textShadow: '0 1px 2px rgba(0,0,0,0.6)'
};

const outcomeDetailTextSx = {
    fontSize: '0.88rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    textShadow: '0 1px 2px rgba(0,0,0,0.6)'
};

const outcomeStatLabelSx = {
    ...outcomeBodyTextSx,
    fontSize: '0.9rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--color-primary)'
};

const gradeTransitionSx = (isIncrease: boolean, isDecrease: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    background: isDecrease
        ? 'rgba(255,80,80,0.08)'
        : isIncrease
            ? 'var(--color-primary-08)'
            : 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    border: isDecrease
        ? '1px solid rgba(255,80,80,0.3)'
        : isIncrease
            ? '1px solid var(--color-primary-30)'
            : '1px solid rgba(255,255,255,0.1)'
});


interface SkitOutcomeDisplayProps {
    outcomes: Outcome[];
    stage: Stage;
    layout?: any;
    isOutcomeTransient?: boolean;
}

interface OutcomePortraitBoxProps {
    border: string;
    baseImageUrl?: string;
    overlayImageUrl?: string;
    height?: string;
    basePosition?: string;
    overlayPosition?: string;
    filter?: string;
    boxShadow?: string;
    showGradient?: boolean;
    mb?: number;
}

const OutcomePortraitBox: FC<OutcomePortraitBoxProps> = ({
    border,
    baseImageUrl,
    overlayImageUrl,
    height = '160px',
    basePosition = 'center',
    overlayPosition = '50% 10%',
    filter,
    boxShadow = '0 8px 24px rgba(0,0,0,0.5)',
    showGradient = false,
    mb
}) => (
    <Box
        sx={{
            width: '100%',
            height,
            borderRadius: '12px',
            overflow: 'hidden',
            border,
            backgroundImage: baseImageUrl ? `url(${baseImageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: basePosition,
            backgroundRepeat: 'no-repeat',
            filter,
            boxShadow,
            position: overlayImageUrl || showGradient ? 'relative' : undefined,
            mb
        }}
    >
        {overlayImageUrl && (
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${overlayImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: overlayPosition,
                    backgroundRepeat: 'no-repeat'
                }}
            />
        )}
        {showGradient && (
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.55) 100%)'
                }}
            />
        )}
    </Box>
);

const SkitOutcomeDisplay: FC<SkitOutcomeDisplayProps> = ({ outcomes, stage, layout, isOutcomeTransient }) => {
    // Calculate bottom position based on message box top

    // Tower Activity outcomes are surfaced only in the Activity Log tab, never in the in-skit stat display.
    const currentOutcomes: Outcome[] = (outcomes || []).filter(o => o.type !== 'towerActivity');
    const save = stage.getSave();
    const mappedOutcomeOrders = new Set<number>();

    // --- Actor and stat grouping ---
    interface StatEntry { stat: Stat | StationStat; oldValue: number; newValue: number; }
    interface ActorOutcomeGroup {
        actorId: string;
        actor: Actor | undefined;
        entries: StatEntry[];
        outcomes: Array<{ outcome: Outcome; order: number }>;
        firstOrder: number;
    }

    interface FactionOutcomeGroup {
        factionId: string;
        faction: any;
        reputationOutcomes: Array<{ outcome: Outcome; order: number }>;
        newActorOutcomes: Array<{ outcome: Outcome; order: number }>;
        firstOrder: number;
    }

    const actorOutcomeGroups: ActorOutcomeGroup[] = (() => {
        const map = new Map<string, ActorOutcomeGroup>();
        const ensureGroup = (actorId: string, order: number): ActorOutcomeGroup => {
            if (!map.has(actorId)) {
                map.set(actorId, {
                    actorId,
                    actor: save.actors[actorId],
                    entries: [],
                    outcomes: [],
                    firstOrder: order
                });
            }
            const group = map.get(actorId)!;
            group.firstOrder = Math.min(group.firstOrder, order);
            return group;
        };

        currentOutcomes.forEach((outcome, order) => {
            if (outcome.type === 'actorStat' && outcome.actorId && outcome.stat != null) {
                const group = ensureGroup(outcome.actorId, order);
                const currentValue: number = group.actor?.stats?.[outcome.stat as Stat] ?? 5;
                const newValue = Math.max(1, Math.min(10, currentValue + (outcome.amount ?? 0)));
                if (newValue !== currentValue) {
                    group.entries.push({ stat: outcome.stat, oldValue: currentValue, newValue });
                }
                mappedOutcomeOrders.add(order);
                return;
            }

            const actorId = outcome.actorId || outcome.outfit?.actorId;
            if (!actorId) {
                return;
            }

            if (outcome.type === 'roleChange' || outcome.type === 'factionChange' || outcome.type === 'movement' || outcome.type === 'newOutfit') {
                const group = ensureGroup(actorId, order);
                group.outcomes.push({ outcome, order });
                mappedOutcomeOrders.add(order);
            }
        });

        return Array.from(map.values())
            .filter(group => group.entries.length > 0 || group.outcomes.length > 0)
            .sort((left, right) => left.firstOrder - right.firstOrder);
    })();

    const factionOutcomeGroups: FactionOutcomeGroup[] = (() => {
        const map = new Map<string, FactionOutcomeGroup>();

        const ensureGroup = (factionId: string, order: number): FactionOutcomeGroup => {
            if (!map.has(factionId)) {
                map.set(factionId, {
                    factionId,
                    faction: save.factions[factionId],
                    reputationOutcomes: [],
                    newActorOutcomes: [],
                    firstOrder: order
                });
            }
            const group = map.get(factionId)!;
            group.firstOrder = Math.min(group.firstOrder, order);
            return group;
        };

        currentOutcomes.forEach((outcome, order) => {
            if (outcome.type === 'factionReputation' && outcome.factionId) {
                const group = ensureGroup(outcome.factionId, order);
                group.reputationOutcomes.push({ outcome, order });
                mappedOutcomeOrders.add(order);
                return;
            }

            if (outcome.type === 'newActor' && outcome.actor?.locationId && save.factions[outcome.actor.locationId]) {
                const group = ensureGroup(outcome.actor.locationId, order);
                group.newActorOutcomes.push({ outcome, order });
                mappedOutcomeOrders.add(order);
            }
        });

        return Array.from(map.values())
            .filter(group => group.reputationOutcomes.length > 0 || group.newActorOutcomes.length > 0)
            .sort((left, right) => left.firstOrder - right.firstOrder);
    })();

    const stationStatEntries: StatEntry[] = (() => {
        const entries: StatEntry[] = [];

        currentOutcomes.forEach((outcome, order) => {
            if (outcome.type !== 'stationStat' || outcome.stat == null) {
                return;
            }

            const currentValue: number = save.stationStats?.[outcome.stat as StationStat] ?? 5;
            const newValue = Math.max(1, Math.min(10, currentValue + (outcome.amount ?? 0)));
            if (newValue !== currentValue) {
                entries.push({ stat: outcome.stat, oldValue: currentValue, newValue });
            }

            mappedOutcomeOrders.add(order);
        });

        return entries;
    })();

    const parcModuleEntries: Outcome[] = [];
    const parcNewActorEntries: Outcome[] = [];

    currentOutcomes.forEach((outcome, order) => {
        if (outcome.type === 'newModule' && outcome.module) {
            parcModuleEntries.push(outcome);
            mappedOutcomeOrders.add(order);
            return;
        }

        if (outcome.type === 'newActor' && outcome.actor?.name) {
            const locationId = outcome.actor.locationId;
            const isFactionLocation = !!locationId && !!save.factions[locationId];
            if (!isFactionLocation) {
                parcNewActorEntries.push(outcome);
                mappedOutcomeOrders.add(order);
            }
        }
    });

    const parcFallbackOutcomes = currentOutcomes.filter((_, order) => !mappedOutcomeOrders.has(order));

    const resolveActorName = (actorId?: string): string => {
        if (!actorId) return 'Unknown';
        if (actorId === 'player') return save.player.name;
        if (actorId === 'STATION') return 'The Spire';
        return save.actors[actorId]?.name || actorId;
    };

    const resolveFactionName = (factionId?: string): string => {
        if (!factionId) return 'The Spire';
        return save.factions[factionId]?.name || factionId;
    };

    const PARC_BACKGROUND_IMAGE = 'https://media.charhub.io/41b7b65d-839b-4d31-8c11-64ee50e817df/0fc1e223-ad07-41c4-bdae-c9545d5c5e34.png';

    const getAccent = (outcome: Outcome) => {
        switch (outcome.type) {
            case 'actorStat':
            case 'stationStat':
                return (outcome.amount || 0) < 0
                    ? { border: 'rgba(255,80,80,0.32)', background: 'rgba(255,80,80,0.10)', color: '#ff7b7b' }
                    : { border: 'rgba(176,102,255,0.32)', background: 'rgba(176,102,255,0.10)', color: '#b066ff' };
            case 'roleChange':
                return { border: 'rgba(100,180,255,0.32)', background: 'rgba(100,180,255,0.10)', color: '#64b4ff' };
            case 'factionChange':
                return { border: 'rgba(255,200,0,0.32)', background: 'rgba(255,200,0,0.10)', color: '#ffc800' };
            case 'factionReputation':
                return (outcome.amount || 0) < 0
                    ? { border: 'rgba(255,80,80,0.32)', background: 'rgba(255,80,80,0.10)', color: '#ff5050' }
                    : { border: 'rgba(176,102,255,0.32)', background: 'rgba(176,102,255,0.10)', color: '#b066ff' };
            case 'newModule':
                return { border: 'rgba(99,102,241,0.32)', background: 'linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(99,102,241,0.22) 50%, rgba(139,92,246,0.12) 100%)', color: '#a5b4fc' };
            case 'newOutfit':
                return { border: 'rgba(16,185,129,0.32)', background: 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(6,182,212,0.20) 50%, rgba(14,165,233,0.12) 100%)', color: '#10b981' };
            case 'newActor':
                return { border: 'rgba(255,200,0,0.32)', background: 'rgba(255,200,0,0.10)', color: '#ffc800' };
            case 'movement':
                return { border: 'rgba(56,189,248,0.32)', background: 'linear-gradient(135deg, rgba(14,165,233,0.16) 0%, rgba(59,130,246,0.20) 50%, rgba(30,64,175,0.14) 100%)', color: '#38bdf8' };
            default:
                return { border: 'rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)', color: '#fff' };
        }
    };

    const getOutcomeIcon = (outcome: Outcome) => {
        switch (outcome.type) {
            case 'actorStat': {
                const statIcon = outcome.stat ? ACTOR_STAT_ICONS[outcome.stat as Stat] : undefined;
                return statIcon || ((outcome.amount || 0) < 0 ? TrendingDown : TrendingUp);
            }
            case 'stationStat': {
                const statIcon = outcome.stat ? STATION_STAT_ICONS[outcome.stat as StationStat] : undefined;
                return statIcon || ((outcome.amount || 0) < 0 ? TrendingDown : TrendingUp);
            }
            case 'roleChange':
                return Work;
            case 'factionChange':
            case 'factionReputation':
                return Handshake;
            case 'newModule':
                return DomainAdd;
            case 'newOutfit':
                return ContentCut;
            case 'newActor':
                return PersonAdd;
            case 'movement':
                return outcome.factionId ? Output : Input;
            default:
                return TrendingUp;
        }
    };

    const getOutcomeTitle = (outcome: Outcome) => {
        switch (outcome.type) {
            case 'actorStat':
            case 'stationStat':
                return outcome.stat ? String(outcome.stat).charAt(0).toUpperCase() + String(outcome.stat).slice(1) : 'Stat Change';
            case 'roleChange':
                return 'Role Change';
            case 'factionChange':
                return 'Faction Change';
            case 'factionReputation':
                return 'Reputation';
            case 'newModule':
                return 'New Module';
            case 'newOutfit':
                return 'New Outfit';
            case 'newActor':
                return 'New Character';
            case 'movement':
                return outcome.factionId ? `Leaving` : 'Returning';
        }
    }

    const getOutcomeSummary = (outcome: Outcome) => {
        switch (outcome.type) {
            case 'actorStat':
                return `${resolveActorName(outcome.actorId)}: ${String(outcome.stat || 'Stat')} ${(outcome.amount || 0) >= 0 ? '+' : ''}${outcome.amount || 0}`;
            case 'stationStat':
                return `${String(outcome.stat || 'Tower Stat')}: ${(outcome.amount || 0) >= 0 ? '+' : ''}${outcome.amount || 0}`;
            case 'roleChange':
                return `${resolveActorName(outcome.actorId)} is now ${outcome.role && outcome.role.trim().length > 0 ? outcome.role : 'Patient'}`;
            case 'factionChange':
                return `${resolveActorName(outcome.actorId)} changed faction to ${resolveFactionName(outcome.factionId)}`;
            case 'factionReputation':
                return `${resolveFactionName(outcome.factionId)} reputation ${(outcome.amount || 0) >= 0 ? '+' : ''}${outcome.amount || 0}`;
            case 'newModule':
                return outcome.module?.moduleName || 'New module unlocked';
            case 'newOutfit':
                return outcome.outfit?.outfitName
                    ? `${resolveActorName(outcome.outfit.actorId)} unlocked ${outcome.outfit.outfitName}`
                    : 'New outfit unlocked';
            case 'newActor':
                return outcome.actor?.name
                    ? `New character: ${outcome.actor.name}`
                    : 'New character joined the Spire';
            case 'movement': {
                const movement = getMovementPresentation(outcome);
                if (movement) {
                    return movement.message;
                }
                return ''; // Don't display a message for non station to faction or faction to station transfers.
            }
            default:
                return 'Outcome updated';
        }
    };

    const getMovementPresentation = (outcome: Outcome) => {
        const actor = outcome.actorId ? save.actors[outcome.actorId] : undefined;
        if (!actor) {
            return null;
        }

        const actorIsAtFaction = !!save.factions[actor.locationId];
        const actorIsNotAtFaction = !actorIsAtFaction;
        const isReturnToParc = actorIsAtFaction && !!outcome.moduleId;
        const isLeavingForFaction = actorIsNotAtFaction && !!outcome.factionId;

        if (!isReturnToParc && !isLeavingForFaction) {
            return null;
        }

        const currentFaction = save.factions[actor.locationId];
        const destinationFaction = outcome.factionId ? save.factions[outcome.factionId] : undefined;
        const message = isReturnToParc
            ? `${actor.name} returns from ${currentFaction?.name || 'Unknown Faction'}`
            : `${actor.name} leaves for ${destinationFaction?.name || resolveFactionName(outcome.factionId)}`;

        const backgroundImage = isReturnToParc
            ? PARC_BACKGROUND_IMAGE
            : destinationFaction?.backgroundImageUrl || PARC_BACKGROUND_IMAGE;

        return {
            actor,
            message,
            backgroundImage,
            isLeavingForFaction,
            isReturnToParc
        };
    };

    if (currentOutcomes.length === 0) {
        return null;
    }

    const renderStatEntries = (entries: Array<{ stat: Stat | StationStat; oldValue: number; newValue: number }>, cardIndex: number, isStation: boolean) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {entries.map((entry, statIndex) => {
                const isIncrease = entry.newValue > entry.oldValue;
                const isDecrease = entry.newValue < entry.oldValue;
                const StatIcon = isStation
                    ? STATION_STAT_ICONS[entry.stat as StationStat]
                    : ACTOR_STAT_ICONS[entry.stat as Stat];
                return (
                    <motion.div
                        key={String(entry.stat)}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.8 + cardIndex * 0.2 + statIndex * 0.1 }}
                        style={{
                            ...gradeTransitionSx(isIncrease, isDecrease),
                            padding: '8px 4px'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {StatIcon && <StatIcon sx={{ fontSize: '1.2rem', color: isIncrease ? 'var(--color-primary)' : isDecrease ? '#ff6b6b' : 'var(--text-primary)', opacity: 0.9 }} />}
                            <Typography sx={{ ...outcomeStatLabelSx, textTransform: 'capitalize' }}>
                                {String(entry.stat)}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <span className="stat-grade" data-grade={scoreToGrade(entry.oldValue)} style={{ fontSize: '2rem', opacity: 0.6, filter: 'grayscale(0.5)' }}>
                                {scoreToGrade(entry.oldValue)}
                            </span>
                            <Typography sx={{ color: isDecrease ? '#ff5050' : isIncrease ? 'var(--color-primary)' : 'var(--text-primary)', fontWeight: 900, fontSize: '1.4rem', mx: 0.5, textShadow: isDecrease ? '0 2px 4px rgba(255,0,0,0.6)' : isIncrease ? '0 2px 4px rgba(0,255,0,0.6)' : '0 2px 4px rgba(0,0,0,0.6)' }}>
                                {isDecrease ? '↓' : isIncrease ? '↑' : '→'}
                            </Typography>
                            <motion.span
                                className="stat-grade"
                                data-grade={scoreToGrade(entry.newValue)}
                                style={{ fontSize: '2rem' }}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.9 + cardIndex * 0.2 + statIndex * 0.1 }}
                            >
                                {scoreToGrade(entry.newValue)}
                            </motion.span>
                        </Box>
                    </motion.div>
                );
            })}
        </Box>
    );

    const renderNewActorEntry = (outcome: Outcome, accentColor: string, key: string) => {
        if (!outcome.actor?.name) {
            return null;
        }

        return (
            <Box
                key={key}
                sx={{
                    ...gradeTransitionSx(false, false),
                    gap: 1,
                    border: `1px solid ${accentColor}55`,
                    background: `color-mix(in srgb, ${accentColor} 12%, rgba(255,255,255,0.05))`
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonAdd sx={{ fontSize: '1.2rem', color: accentColor, opacity: 0.9, flexShrink: 0 }} />
                    <Typography sx={outcomeStatLabelSx}>
                        New Character
                    </Typography>
                </Box>
                <Typography sx={{ ...outcomeBodyTextSx, fontWeight: 800, color: accentColor, lineHeight: 1.2 }}>
                    {outcome.actor.name}
                </Typography>
            </Box>
        );
    };

    const renderFactionReputationEntry = (outcome: Outcome, accentColor: string, key: string) => {
        const faction = outcome.factionId ? save.factions[outcome.factionId] : undefined;
        const oldReputation = Math.max(0, Math.min(10, faction?.reputation ?? 3));
        const newReputation = Math.max(0, Math.min(10, oldReputation + (outcome.amount ?? 0)));
        const isIncrease = newReputation > oldReputation;
        const isDecrease = newReputation < oldReputation;
        const OutcomeIcon = getOutcomeIcon(outcome);

        return (
            <Box
                key={key}
                sx={gradeTransitionSx(isIncrease, isDecrease)}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <OutcomeIcon sx={{ fontSize: '1.2rem', color: accentColor, opacity: 0.9 }} />
                    <Typography sx={outcomeStatLabelSx}>
                        Reputation
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <span className="stat-grade" data-grade={scoreToGrade(oldReputation)} style={{ fontSize: '2rem', opacity: 0.6, filter: 'grayscale(0.5)' }}>
                        {scoreToGrade(oldReputation)}
                    </span>
                    <Typography sx={{ color: isDecrease ? '#ff5050' : isIncrease ? 'var(--color-primary)' : 'var(--text-primary)', fontWeight: 900, fontSize: '1.4rem', mx: 0.5, textShadow: isDecrease ? '0 2px 4px rgba(255,0,0,0.6)' : isIncrease ? '0 2px 4px rgba(0,255,0,0.6)' : '0 2px 4px rgba(0,0,0,0.6)' }}>
                        {isDecrease ? '↓' : isIncrease ? '↑' : '→'}
                    </Typography>
                    <span className="stat-grade" data-grade={scoreToGrade(newReputation)} style={{ fontSize: '2rem' }}>
                        {scoreToGrade(newReputation)}
                    </span>
                </Box>
            </Box>
        );
    };

    const renderActorOutcomeEntries = (group: ActorOutcomeGroup) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: group.entries.length > 0 ? 1 : 0 }}>
            {group.outcomes.map(({ outcome }, index) => {
                switch (outcome.type) {
                    case 'roleChange': {
                        const previousRole = group.actor ? getRole(group.actor, save).trim() : '';
                        const previousRoleLabel = previousRole.length > 0 ? previousRole : 'Patient';
                        const newRoleLabel = outcome.role && outcome.role.trim().length > 0 ? outcome.role : 'Patient';
                        return (
                            <Box
                                key={`role_${index}`}
                                sx={{
                                    ...outcomeContentCardSx,
                                    background: 'rgba(100,180,255,0.12)',
                                    border: '1px solid rgba(100,180,255,0.35)',
                                    textAlign: 'left'
                                }}
                            >
                                <Typography sx={{ ...outcomeMicroLabelSx, color: '#64b4ff' }}>
                                    Role
                                </Typography>
                                <Typography sx={{ ...outcomeBodyTextSx, fontWeight: 700 }}>
                                    <Box component="span" sx={{ textDecoration: 'line-through', textDecorationThickness: '2px', opacity: 0.75 }}>
                                        {previousRoleLabel}
                                    </Box>
                                    <Box component="span" sx={{ mx: 1, color: '#64b4ff', fontWeight: 900 }}>
                                        {'→'}
                                    </Box>
                                    <Box component="span" sx={{ color: '#64b4ff', fontWeight: 900 }}>
                                        {newRoleLabel}
                                    </Box>
                                </Typography>
                            </Box>
                        );
                    }
                    case 'factionChange':
                        return (
                            <Box
                                key={`faction_${index}`}
                                sx={{
                                    ...outcomeContentCardSx,
                                    background: 'rgba(255,200,0,0.10)',
                                    border: '1px solid rgba(255,200,0,0.35)',
                                    textAlign: 'left'
                                }}
                            >
                                <Typography sx={{ ...outcomeMicroLabelSx, color: '#ffc800' }}>
                                    Faction
                                </Typography>
                                <Typography sx={{ ...outcomeBodyTextSx, fontWeight: 700 }}>
                                    Changed to {resolveFactionName(outcome.factionId)}
                                </Typography>
                            </Box>
                        );
                    case 'newOutfit':
                        return outcome.outfit ? (
                            <Box
                                key={`outfit_${index}`}
                                sx={{
                                    ...outcomeContentCardSx,
                                    background: 'rgba(16,185,129,0.10)',
                                    border: '1px solid rgba(16,185,129,0.35)',
                                    textAlign: 'left'
                                }}
                            >
                                <Typography sx={{ ...outcomeMicroLabelSx, color: '#10b981' }}>
                                    New Outfit
                                </Typography>
                                <Typography sx={{ ...outcomeBodyTextSx, fontWeight: 800, color: '#d1fae5', lineHeight: 1.35, mb: 0.2 }}>
                                    {outcome.outfit.outfitName}
                                </Typography>
                                <Typography sx={outcomeDetailTextSx}>
                                    {outcome.outfit.description}
                                </Typography>
                            </Box>
                        ) : null;
                    case 'movement': {
                        const movement = getMovementPresentation(outcome);
                        if (!movement) {
                            return <></>;
                        }
                        return (
                            <Box
                                key={`movement_${index}`}
                                sx={{
                                    ...outcomeContentCardSx,
                                    background: 'rgba(56,189,248,0.10)',
                                    border: '1px solid rgba(56,189,248,0.35)',
                                    textAlign: 'left'
                                }}
                            >
                                <Typography sx={{ ...outcomeMicroLabelSx, color: '#38bdf8' }}>
                                    Movement
                                </Typography>
                                <Typography sx={{ ...outcomeBodyTextSx, fontWeight: 700, lineHeight: 1.45 }}>
                                    {movement.message}
                                </Typography>
                            </Box>
                        );
                    }
                    default:
                        return null;
                }
            })}
        </Box>
    );

    const renderParcModuleEntries = (entries: Outcome[]) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: stationStatEntries.length > 0 ? 1 : 0 }}>
            {entries.map((entry, index) => (
                entry.module ? (
                    <Box
                        key={`parc_module_${entry.module.id || index}`}
                        sx={{
                            ...outcomeContentCardSx,
                            background: 'rgba(99,102,241,0.10)',
                            border: '1px solid rgba(99,102,241,0.35)',
                            textAlign: 'left'
                        }}
                    >
                        <Typography sx={{ ...outcomeMicroLabelSx, color: '#a5b4fc' }}>
                            New Module
                        </Typography>
                        <Typography sx={{ ...outcomeBodyTextSx, fontWeight: 800, color: '#e0e7ff', lineHeight: 1.35, mb: 0.2 }}>
                            {entry.module.moduleName}
                        </Typography>
                        <Typography sx={{ ...outcomeDetailTextSx, fontWeight: 600, color: '#bfdbfe', lineHeight: 1.35, mb: 0.25 }}>
                            Role: {entry.module.roleName}
                        </Typography>
                        <Typography sx={outcomeDetailTextSx}>
                            {entry.module.description}
                        </Typography>
                    </Box>
                ) : null
            ))}
        </Box>
    );

    const renderParcFallbackEntries = (entries: Outcome[]) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: (stationStatEntries.length > 0 || parcModuleEntries.length > 0 || parcNewActorEntries.length > 0) ? 1 : 0 }}>
            {entries.map((entry, index) => {
                const accent = getAccent(entry);
                const OutcomeIcon = getOutcomeIcon(entry);
                const message = getOutcomeSummary(entry);
                if (!message) {
                    return null;
                }
                return (
                    <Box
                        key={`parc_fallback_${index}`}
                        sx={{
                            ...outcomeContentCardSx,
                            border: `1px solid ${accent.border}`,
                            background: accent.background,
                            textAlign: 'left'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                            <OutcomeIcon sx={{ fontSize: '1.05rem', color: accent.color }} />
                            <Typography sx={{ ...outcomeMicroLabelSx, color: accent.color, mb: 0 }}>
                                {getOutcomeTitle(entry)}
                            </Typography>
                        </Box>
                        <Typography sx={{ ...outcomeBodyTextSx, fontWeight: 700, lineHeight: 1.4 }}>
                            {message}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: 64 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 64 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{
                position: 'absolute',
                top: '0',
                right: '0',
                bottom: `1rem`,
                zIndex: 3,
                display: 'flex',
                flexDirection: 'row-reverse',
                alignItems: 'flex-start',
                gap: '20px',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: '0 20px'
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    width: '30vmin',
                    height: '100%',
                    overflowY: 'auto'
                }}
            >
                <div>
                    <Paper
                        elevation={8}
                        className="glass-panel-bright"
                        sx={outcomeHeaderCardSx}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <TrendingUp sx={{ color: 'var(--color-primary)', fontSize: '1.5rem' }} />
                            <Typography
                                variant="h6"
                                className="section-header"
                                sx={{
                                    fontWeight: 800,
                                    color: 'var(--text-primary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                                }}
                            >
                                Outcome{currentOutcomes.length === 1 ? '' : 's'}
                            </Typography>
                        </Box>
                        <Typography
                            variant="caption"
                            sx={{
                                fontSize: '0.7rem',
                                color: 'var(--text-very-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.5,
                                mt: 0.5
                            }}
                        >
                            {isOutcomeTransient && (
                            <span 
                                style={{ 
                                    color: '#ffaa00',
                                    fontSize: '1.1em',
                                    fontWeight: 900
                                }}
                                title="Submitting input will discard these outcomes"
                            >
                                ⚠
                            </span>
                            )}
                            {isOutcomeTransient ? 'Continuing may forfeit some outcomes.' : 'Closing the skit will accept these outcomes.'}
                        </Typography>
                    </Paper>
                </div>

                {/* Actor outcome groups — one card per actor */}
                {actorOutcomeGroups.map((group, groupIndex) => {
                    const movementForPortrait = [...group.outcomes]
                        .reverse()
                        .map(({ outcome }) => outcome)
                        .find(outcome => outcome.type === 'movement');
                    const movementPresentation = movementForPortrait ? getMovementPresentation(movementForPortrait) : null;

                    return (
                    <div key={`actorOutcome_${group.actorId}`}>
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.5 + groupIndex * 0.2 }}
                        >
                            <Paper elevation={6} className="glass-panel" sx={outcomeCardSx}>
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.6 + groupIndex * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <OutcomePortraitBox
                                        border="2px solid rgba(176,102,255,0.4)"
                                        baseImageUrl={movementPresentation?.backgroundImage || (group.actor ? group.actor.getEmotionImage(group.actor.getDefaultEmotion()) : undefined)}
                                        overlayImageUrl={movementPresentation ? group.actor?.getEmotionImage(group.actor.getDefaultEmotion()) : undefined}
                                        height="150px"
                                        basePosition={movementPresentation ? 'center' : '50% 10%'}
                                        overlayPosition="50% 10%"
                                        filter="brightness(1.1)"
                                        boxShadow="0 8px 24px rgba(0,0,0,0.6)"
                                        showGradient={!!movementPresentation}
                                    />
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.7 + groupIndex * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Nameplate
                                        actor={group.actor}
                                        name={group.actor ? undefined : resolveActorName(group.actorId)}
                                        size="large"
                                        role={group.actor && layout ? (() => {
                                            const roleModules = layout.getModulesWhere((m: any) => m && m.type !== 'quarters' && m.ownerId === group.actor?.id);
                                            return roleModules.length > 0 ? roleModules[0].getAttribute('role') : undefined;
                                        })() : undefined}
                                        layout="inline"
                                    />
                                </motion.div>
                                {group.entries.length > 0 && renderStatEntries(group.entries, groupIndex, false)}
                                {group.outcomes.length > 0 && renderActorOutcomeEntries(group)}
                            </Paper>
                        </motion.div>
                    </div>
                    );
                })}

                {/* PARC group — station stats, new modules, and station-bound new characters */}
                {(stationStatEntries.length > 0 || parcModuleEntries.length > 0 || parcNewActorEntries.length > 0 || parcFallbackOutcomes.length > 0) && (
                    <div key="stationStats">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.5 + actorOutcomeGroups.length * 0.2 }}
                        >
                            <Paper elevation={6} className="glass-panel" sx={outcomeCardSx}>
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.6 + actorOutcomeGroups.length * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <OutcomePortraitBox
                                        border="2px solid rgba(176,102,255,0.4)"
                                        baseImageUrl={PARC_BACKGROUND_IMAGE}
                                        height="150px"
                                        basePosition="50% 15%"
                                        filter="brightness(1.1)"
                                        boxShadow="0 8px 24px rgba(0,0,0,0.6)"
                                    />
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.7 + actorOutcomeGroups.length * 0.2 }}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <Nameplate name="The Spire" size="large" layout="inline" />
                                </motion.div>
                                {stationStatEntries.length > 0 && renderStatEntries(stationStatEntries, actorOutcomeGroups.length, true)}
                                {parcModuleEntries.length > 0 && renderParcModuleEntries(parcModuleEntries)}
                                {parcNewActorEntries.length > 0 && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: (stationStatEntries.length > 0 || parcModuleEntries.length > 0) ? 1 : 0 }}>
                                        {parcNewActorEntries.map((entry, index) => renderNewActorEntry(entry, '#ffc800', `parc_new_actor_${entry.actor?.name || index}`))}
                                    </Box>
                                )}
                                {parcFallbackOutcomes.length > 0 && renderParcFallbackEntries(parcFallbackOutcomes)}
                            </Paper>
                        </motion.div>
                    </div>
                )}

                {/* Faction groups — reputation changes and faction-bound new characters */}
                {factionOutcomeGroups.map((group, groupIndex) => {
                    const accentColor = group.reputationOutcomes.length > 0
                        ? ((group.reputationOutcomes[0].outcome.amount || 0) < 0 ? '#ff5050' : '#b066ff')
                        : '#ffc800';
                    const representative = group.faction?.representativeId
                        ? save.actors[group.faction.representativeId]
                        : undefined;

                    return (
                        <div key={`factionOutcome_${group.factionId}`}>
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.5 + (actorOutcomeGroups.length + (stationStatEntries.length > 0 || parcModuleEntries.length > 0 || parcNewActorEntries.length > 0 || parcFallbackOutcomes.length > 0 ? 1 : 0) + groupIndex) * 0.2 }}
                            >
                                <Paper elevation={6} className="glass-panel" sx={{ ...outcomeCardSx, border: '2px solid rgba(255,200,0,0.2)' }}>
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.5, delay: 0.6 + (actorOutcomeGroups.length + (stationStatEntries.length > 0 || parcModuleEntries.length > 0 || parcNewActorEntries.length > 0 || parcFallbackOutcomes.length > 0 ? 1 : 0) + groupIndex) * 0.2 }}
                                        style={{ marginBottom: '12px' }}
                                    >
                                        <OutcomePortraitBox
                                            border="2px solid rgba(255,200,0,0.4)"
                                            baseImageUrl={group.faction?.backgroundImageUrl || PARC_BACKGROUND_IMAGE}
                                            overlayImageUrl={representative ? representative.getEmotionImage(representative.getDefaultEmotion()) : undefined}
                                            height="150px"
                                            basePosition="center"
                                            overlayPosition="50% 15%"
                                            filter="brightness(1.1)"
                                            showGradient
                                            boxShadow="0 8px 24px rgba(0,0,0,0.6)"
                                        />
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: 0.7 + (actorOutcomeGroups.length + (stationStatEntries.length > 0 || parcModuleEntries.length > 0 || parcNewActorEntries.length > 0 || parcFallbackOutcomes.length > 0 ? 1 : 0) + groupIndex) * 0.2 }}
                                        style={{ marginBottom: '12px' }}
                                    >
                                        <Nameplate name={resolveFactionName(group.factionId)} size="large" layout="inline" />
                                    </motion.div>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {group.reputationOutcomes.map(({ outcome }, index) => renderFactionReputationEntry(outcome, accentColor, `${group.factionId}_rep_${index}`))}
                                        {group.newActorOutcomes.map(({ outcome }, index) => renderNewActorEntry(outcome, '#ffc800', `${group.factionId}_new_actor_${index}`))}
                                    </Box>
                                </Paper>
                            </motion.div>
                        </div>
                    );
                })}
            </Box>
        </motion.div>
    );
    
};

export default SkitOutcomeDisplay;
