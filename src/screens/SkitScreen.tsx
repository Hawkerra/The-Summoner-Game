/*
 * This screen displays Visual Novel skit scenes, displaying dialogue and characters as they interact with the player and each other.
 */
import React, { FC, useCallback, useEffect } from 'react';
import { ScreenType } from './BaseScreen';
import Actor, { getRole, isHologram } from '../actors/Actor';
import { SaveType, Stage } from '../Stage';
import { accumulateOutcomes, generateSkitScript, Outcome, SkitData } from '../Skit';
import { Emotion } from '../actors/Emotion';
import SkitOutcomeDisplay from './SkitOutcomeDisplay';
import Nameplate from '../components/Nameplate';
import { BlurredBackground } from '../components/BlurredBackground';
import { useTooltip } from '../contexts/TooltipContext';
import ActorCard, { ActorCardSection } from '../components/ActorCard';
import { ContentManagementScreen } from './ContentManagementScreen';
import { colors } from './Theme';

import {
    Send,
    LastPage,
    PlayArrow,
    Menu as MenuIcon,
    EditNote,
    Close,
    Warning,
    VolumeUp,
    VolumeOff
} from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { NovelVisualizer } from '@lord-raven/novel-visualizer';
import { AnimatePresence, motion } from 'framer-motion';

interface SkitScreenProps {
    stage: () => Stage;
    setScreenType: (type: ScreenType) => void;
    isVerticalLayout: boolean;
}

/**
 * Helper function to get the active scene module ID at a given script index.
 * Applies scene-level module transitions up to and including the index.
 */
const getSceneModuleIdAtIndex = (skit: SkitData, scriptIndex: number): string => {
    let sceneModuleId = skit.moduleId;

    for (let i = 0; i <= scriptIndex && i < skit.script.length; i++) {
        const entry = skit.script[i];
        if (entry.moveToModuleId) {
            sceneModuleId = entry.moveToModuleId;
        }
    }

    return sceneModuleId;
};

/**
 * Helper function to get the actors present in the scene at a given script index.
 * Walks through movements from initialActorLocations, filtering by scene module at index.
 */
const getActorsAtIndex = (skit: SkitData, scriptIndex: number, allActors: {[key: string]: Actor}, save: SaveType): Actor[] => {
    // Start with initial actor locations
    const currentLocations = {...(skit.initialActorLocations || {})};
    const movedActorIds = new Set<string>();
    
    // Apply movements up to and including the current index
    for (let i = 0; i <= scriptIndex && i < skit.script.length; i++) {
        const entry = skit.script[i];
        if (entry.movements) {
            Object.entries(entry.movements).forEach(([actorId, newLocationId]) => {
                movedActorIds.add(actorId);
                currentLocations[actorId] = newLocationId;
            });
        }
    }
    
    const sceneModuleId = getSceneModuleIdAtIndex(skit, scriptIndex);
    const sceneModuleType = save.layout.getModuleById(sceneModuleId || '')?.type;

    if (sceneModuleType === 'comms') {
        const commsVisitors = save.commsVisitors || [];
        commsVisitors.forEach(actorId => {
            if (allActors[actorId] && !movedActorIds.has(actorId)) {
                currentLocations[actorId] = sceneModuleId;
            }
        });
    }

    // Filter actors who are at the skit's module
    const actorsAtModule: Actor[] = [];
    Object.entries(currentLocations).forEach(([actorId, locationId]) => {
        if (locationId === sceneModuleId && allActors[actorId]) {
            actorsAtModule.push(allActors[actorId]);
        }
    });
    
    return actorsAtModule;
};

/**
 * Helper function to get actor outfit IDs at a given script index.
 * Walks from initialActorOutfits and applies per-entry outfitChanges.
 */
const getActorOutfitsAtIndex = (skit: SkitData, scriptIndex: number, allActors: {[key: string]: Actor}): {[actorId: string]: string} => {
    const currentOutfits = {
        ...Object.values(allActors).reduce((acc, actor) => {
            acc[actor.id] = actor.outfitId;
            return acc;
        }, {} as {[actorId: string]: string}),
        ...(skit.initialActorOutfits || {})
    };

    for (let i = 0; i <= scriptIndex && i < skit.script.length; i++) {
        const entry = skit.script[i];
        if (entry.outfitChanges) {
            Object.entries(entry.outfitChanges).forEach(([actorId, newOutfitId]) => {
                currentOutfits[actorId] = newOutfitId;
            });
        }
    }

    return currentOutfits;
};

const clampHexColor = (color: string, minBrightness: number = 0.3, maxBrightness: number = 0.6): string => {
    const match = /^#([0-9A-F]{6})([0-9A-F]{2})?$/i.exec(color);
    if (!match) {
        return color;
    }

    const hex = match[1];
    const alpha = match[2] || '';
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);

    const brightness = (red + green + blue) / (255 * 3);
    if (brightness >= minBrightness && brightness <= maxBrightness) {
        return color;
    }

    const targetBrightness = brightness > maxBrightness ? maxBrightness : minBrightness;
    if (brightness === 0) {
        const channel = Math.round(targetBrightness * 255).toString(16).padStart(2, '0');
        return `#${channel}${channel}${channel}${alpha}`;
    }

    const scale = targetBrightness / brightness;
    const adjustChannel = (channel: number): string =>
        Math.max(0, Math.min(255, Math.round(channel * scale))).toString(16).padStart(2, '0');

    const dimmedRed = adjustChannel(red);
    const dimmedGreen = adjustChannel(green);
    const dimmedBlue = adjustChannel(blue);

    return `#${dimmedRed}${dimmedGreen}${dimmedBlue}${alpha}`;
};

export const SkitScreen: FC<SkitScreenProps> = ({ stage, setScreenType, isVerticalLayout }) => {
    const { setTooltip, clearTooltip } = useTooltip();
    const [skit, setSkit] = React.useState<SkitData>(stage().getSave().currentSkit as SkitData);
    const [, setSkitRevision] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [accumulatedOutcomes, setAccumulatedOutcomes] = React.useState<Outcome[]>([]);
    const [showContentManagement, setShowContentManagement] = React.useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = React.useState<boolean>(!stage().getSave().disableTextToSpeech);
    const isTextToSpeechEnabled = !stage().getSave().disableTextToSpeech;
    const currentScriptIndex = Math.min(Math.max(skit.currentIndex || 0, 0), Math.max(skit.script.length - 1, 0));
    const shouldHighlightCloseButton = !isLoading && skit.script.length >= 3 && currentScriptIndex >= skit.script.length - 1;

    const currentSceneModuleId = getSceneModuleIdAtIndex(skit, skit.currentIndex || 0);
    const module = stage().getSave().layout.getModuleById(currentSceneModuleId || '');
    const decorImageUrl = module ? stage().getSave().actors[module.ownerId || '']?.decorImageUrls[module.type] || module.getAttribute('defaultImageUrl') : '';
    const cornerButtonSx = {
        color: colors.primary.main,
        opacity: 0.8,
        '&:hover': {
            color: colors.primary.light,
            backgroundColor: 'rgba(176, 102, 255, 0.12)'
        }
    };
    
    const actors = {...stage().getSave().actors, 'player': {
        id: 'player',
        name: stage().getSave().player.name,
        decorImageUrls: {},
        outfitId: '',
        getEmotionImage: () => '', // Player doesn't have an image, but this prevents errors when trying to access it.
        themeColor: '#718096',
        themeFontFamily: `'Geologica', sans-serif`, // Player needs some nice default font.
    }};

    
    const onSkitChange = useCallback((newSkit: SkitData) => {
        // Keep skit object identity stable, but force this component to re-render.
        setSkitRevision(prev => prev + 1);
    }, [stage]);

    useEffect(() => {
        setSkitRevision(prev => prev + 1);
    }, [isLoading]);

    const handleClose = useCallback(() => {
        const clampedCurrentIndex = Math.min(Math.max(skit.currentIndex || 0, 0), Math.max(skit.script.length - 1, 0));
        const endedEarly = clampedCurrentIndex < skit.script.length - 1;
        const finalizedSkit: SkitData = {
            ...skit,
            script: skit.script.slice(0, clampedCurrentIndex + 1),
            outcomes: endedEarly ? [] : [...(skit.outcomes || [])]
        };

        setSkit(finalizedSkit);
        stage().setSkit(finalizedSkit);
        stage().endSkit(setScreenType);
    }, [stage, setScreenType]);

	const handleSkitSubmit = useCallback(async (input: string, skitArg: any, index: number) => {
		index = Math.max(0, index);
        setIsLoading(true);
        const nextEntries = await generateSkitScript(skitArg, stage());
        setIsLoading(false);
        skitArg.script.push(...nextEntries);
        // Update skit to match skitArg, which was updated in the generation.
        skit.outcomes = skitArg.outcomes;
        stage().saveGame();

        return skitArg;
	}, [stage]);

    useEffect(() => {
        if (skit.script.length == 0 && !isLoading) {
            setIsLoading(true);
            stage().continueSkit().then(() => {
                setIsLoading(false);
                stage().saveGame();
            });
        }
        const visibleScriptEntries = skit.script.slice(0, Math.min((skit.currentIndex || 0) + 1, skit.script.length));
        const isOnCurrentFinalEntry = skit.script.length > 0 && (skit.currentIndex || 0) >= skit.script.length - 1;
        const visibleEntries = isOnCurrentFinalEntry && !isLoading && (skit.outcomes?.length || 0) > 0
            ? [...visibleScriptEntries, { speaker: 'NARRATOR', message: '', speechUrl: '', outcomes: skit.outcomes }]
            : visibleScriptEntries;

        const outcomes = accumulateOutcomes(visibleEntries, stage()) || [];
        console.log('Skit outcomes:', skit.outcomes);
        setAccumulatedOutcomes(outcomes);
        stage().testEndSkit();

    }, [skit, skit.currentIndex, isLoading]);

    // Handle Escape key to open menu
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !showContentManagement) {
                setScreenType(ScreenType.MENU);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setScreenType, showContentManagement]);

    const outcomesAnimationKey = React.useMemo(() => {
        if (accumulatedOutcomes.length === 0) {
            return 'no-outcomes';
        }

        return accumulatedOutcomes
            .map((outcome, index) => JSON.stringify({ ...outcome, index }))
            .join('|');
    }, [accumulatedOutcomes]);

    return (
        <BlurredBackground
            imageUrl={decorImageUrl}
            // overlay="linear-gradient(130deg, rgba(5, 24, 34, 0.78) 0%, rgba(18, 47, 32, 0.72) 50%, rgba(37, 24, 57, 0.78) 100%)"
        >
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Top right control buttons */}
                <div style={{
                    width: '100%',
                    justifyContent: 'flex-end',
                    padding: '1rem',
                    display: 'flex',
                    gap: '0.5rem',
                    zIndex: 10
                }}>
                    {isTextToSpeechEnabled && (
                        <IconButton
                            onClick={() => setIsAudioEnabled(prev => !prev)}
                            onMouseEnter={() => setTooltip(isAudioEnabled ? 'Mute Audio' : 'Enable Audio', isAudioEnabled ? VolumeUp : VolumeOff)}
                            onMouseLeave={() => clearTooltip()}
                            sx={{
                                ...cornerButtonSx,
                                opacity: isAudioEnabled ? 0.95 : 0.55,
                            }}
                        >
                            {isAudioEnabled ? <VolumeUp /> : <VolumeOff />}
                        </IconButton>
                    )}
                    <IconButton
                        onClick={() => setShowContentManagement(true)}
                        onMouseEnter={() => setTooltip('Content Management', EditNote)}
                        onMouseLeave={() => clearTooltip()}
                        sx={cornerButtonSx}
                    >
                        <EditNote />
                    </IconButton>
                    <IconButton
                        onClick={() => setScreenType(ScreenType.MENU)}
                        onMouseEnter={() => setTooltip('Main Menu', MenuIcon)}
                        onMouseLeave={() => clearTooltip()}
                        sx={cornerButtonSx}
                    >
                        <MenuIcon />
                    </IconButton>
                    <IconButton
                        onClick={handleClose}
                        onMouseEnter={() => setTooltip(isLoading ? 'Cannot close while content is generating' : ((accumulatedOutcomes.length > 0 ? 'Accept Outcomes and ' : '') + (shouldHighlightCloseButton ? 'End Scene Here' : 'End Scene Here (Discard Remaining Entries)')), shouldHighlightCloseButton ? Close : Warning)}
                        onMouseLeave={() => clearTooltip()}
                        disabled={isLoading || skit.script.length < 3}
                        sx={{
                            ...cornerButtonSx,
                            ...(!isLoading && shouldHighlightCloseButton ? {
                                color: colors.accent.warning,
                                backgroundColor: 'rgba(255, 170, 0, 0.12)',
                                animation: 'closeButtonPulse 1.6s ease-in-out infinite',
                                '@keyframes closeButtonPulse': {
                                    '0%, 100%': {
                                        transform: 'scale(1)',
                                        boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.35)'
                                    },
                                    '50%': {
                                        transform: 'scale(1.08)',
                                        boxShadow: '0 0 0 8px rgba(255, 255, 255, 0)'
                                    }
                                }
                            } : {}),
                            '&.Mui-disabled': {
                                color: 'rgba(255, 255, 255, 0.25)'
                            }
                        }}
                    >
                        <Close />
                    </IconButton>
                </div>
                    <NovelVisualizer
                        skit={skit}
                        loading={isLoading}
                        renderNameplate={(actor: any) => {
                            if (!actor || !actor.name) return null;
                            return <Nameplate
                                actor={actor}
                                size={isVerticalLayout ? 'medium' : 'large'}
                                style={{
                                    position: 'absolute',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 5
                                }}
                                role={(() => {
                                    const roleModules = stage().getSave().layout.getModulesWhere((m: any) =>
                                        m && m.type !== 'quarters' && m.ownerId === actor.id
                                    );
                                    return roleModules.length > 0 ? roleModules[0].getAttribute('role') : undefined;
                                })()}
                                layout="inline"
                            />;
                        }}
                        setTooltip={setTooltip}
                        isVerticalLayout={isVerticalLayout}
                        actors={actors}
                        playerActorId={'player'}
                        getPresentActors={(_script, _index) =>
                            getActorsAtIndex(_script, _index, stage().getSave().actors, stage().getSave()) || []
                        }
                        getActorImageUrl={(actor, _script, index) => {
                            let emotion = Emotion.neutral;

                            if (skit.script && skit.script.length > 0 && index < skit.script.length) {
                                for (let j = index; j >= 0; j--) {
                                    const entry = skit.script[j];
                                    if (entry.actorEmotions && entry.actorEmotions[actor.name]) {
                                        emotion = entry.actorEmotions[actor.name];
                                        break;
                                    }
                                }
                            }

                            const outfitId = getActorOutfitsAtIndex(_script, index, stage().getSave().actors)[actor.id] || actor.outfitId;
                            return actor.getEmotionImage(emotion, stage(), outfitId);
                        }}
                        getActorFilter={(actor, _script, index) => {
                            const actorLocationId = (() => {
                                const locations = _script.initialActorLocations || {};
                                let currentLocationId = locations[actor.id] || '';
                                for (let i = 0; i <= index && i < _script.script.length; i++) {
                                    const entry = _script.script[i];
                                    if (entry.movements && entry.movements[actor.id]) {
                                        currentLocationId = entry.movements[actor.id];
                                    }
                                }
                                return currentLocationId;
                            })();

                            const useHoloFilter = isHologram(actor, stage().getSave(), actorLocationId);

                            return {
                                filter: useHoloFilter ? 'ghost' : undefined,
                                filterColor: useHoloFilter ? clampHexColor(actor.themeColor) : undefined,
                            };
                        }}
                        onSubmitInput={handleSkitSubmit}
                        onSkitChange={onSkitChange}
                        getSubmitButtonConfig={(_script, index, inputText) => {
                            return {
                                label: inputText.trim().length > 0 ? 'Send' : 'Continue',
                                enabled: true,
                                colorScheme: inputText.trim().length > 0 ? 'secondary' : 'primary',
                                icon: inputText.trim().length > 0 ? <Send /> : <PlayArrow />,
                            };
                        }}
                        enableAudio={isTextToSpeechEnabled && isAudioEnabled}
                        enablePopInSpeakers={true}
                        enableTalkingAnimation={true}
                        responsiveOverlay={(skit, actor) => {
                            return (
                                <div>
                                    <AnimatePresence mode="wait">
                                        {actor && actor.id != 'player' && (
                                            <motion.div
                                                key={`actor-card-${actor.id}`}
                                                initial={{ opacity: 0, x: -100 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -100 }}
                                                transition={{ duration: 0.28, ease: 'easeInOut' }}
                                            >
                                                <div style={{
                                                    position: 'relative',
                                                    maxWidth: isVerticalLayout ? '30vw' : '15vw',
                                                    right: 0,
                                                    top: 0
                                                }}>
                                                    <ActorCard
                                                        actor={actor}
                                                        visitingFaction={undefined}
                                                        role={getRole(actor, stage().getSave())}
                                                        collapsedSections={[ActorCardSection.STATS]}
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <AnimatePresence mode="wait">
                                        {accumulatedOutcomes.length > 0 && (
                                            <SkitOutcomeDisplay
                                                key={outcomesAnimationKey}
                                                outcomes={accumulatedOutcomes}
                                                stage={stage()}
                                                layout={stage().getSave().layout}
                                                isOutcomeTransient={(skit && skit.script && skit.currentIndex === skit.script.length - 1 && skit.outcomes && skit.outcomes.length > 0) || false}
                                            />
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        }}
                    />
            </div>

            {/* Content Management Modal */}
            {showContentManagement && (
                <ContentManagementScreen
                    stage={stage}
                    onClose={() => setShowContentManagement(false)}
                />
            )}
        </BlurredBackground>
    );

}

export default SkitScreen;
