import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';
import { BlurredBackground } from '../components/BlurredBackground';
import { GridOverlay, Title, Button } from '../components/UIComponents';
import { SettingsScreen } from './SettingsScreen';
import { SaveLoadScreen } from './SaveLoadScreen';
import { ContentManagementScreen } from './ContentManagementScreen';
import { useTooltip } from '../contexts/TooltipContext';
import { Save, SaveAlt, PlayArrow, FiberNew, Folder, Settings, EditNote } from '@mui/icons-material';

/*
 * This screen represents both the start-up and in-game menu screen. It should present basic options: new game, load game, settings.
 */

interface MenuScreenProps {
    stage: () => Stage;
    setScreenType: (type: ScreenType) => void;
}

export const MenuScreen: FC<MenuScreenProps> = ({ stage, setScreenType }) => {
    const [hoveredButton, setHoveredButton] = React.useState<string | null>(null);
    const [showSettings, setShowSettings] = React.useState(false);
    const [isNewGameSettings, setIsNewGameSettings] = React.useState(false);
    const [showSaveLoad, setShowSaveLoad] = React.useState(false);
    const [saveLoadMode, setSaveLoadMode] = React.useState<'save' | 'load'>('save');
    const [showContentManagement, setShowContentManagement] = React.useState(false);
    const { setTooltip, clearTooltip } = useTooltip();
    const disableAllButtons = false; // When true, disable all options on this menu, including escape to continue; this is being used to effectively shut down the game at the moment.
    
    // Check if a save exists (if there are any actors or the layout has been modified)
    const saveExists = () => {
        return stage().getSave() && Object.keys(stage().getSave().actors).length > 0;
    };

    // Handle escape key to continue game if available
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !disableAllButtons) {
                if (showSettings) {
                    console.log('close settings');
                    handleSettingsCancel();
                } else if (showSaveLoad) {
                    console.log('close save/load');
                    setShowSaveLoad(false);
                } else if (showContentManagement) {
                    console.log('close content management');
                    setShowContentManagement(false);
                } else if (saveExists() && !showSettings) {
                    console.log('continue');
                    handleContinue();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showSettings]);

    const handleContinue = () => {
        stage().startGame();
        // Check if aide is still being generated
        if (stage().getGenerateAidePromise()) {
            setScreenType(ScreenType.LOADING);
        } else if (stage().getSave().currentSkit) {
            setScreenType(ScreenType.SKIT);
        } else {
            setScreenType(ScreenType.STATION);
        }
    };

    const handleNewGame = () => {
        // Show settings screen for new game setup
        setIsNewGameSettings(true);
        setShowSettings(true);
    };

    const handleLoad = () => {
        setSaveLoadMode('load');
        setShowSaveLoad(true);
    };

    const handleSave = () => {
        if (stage().initialized) {
            setSaveLoadMode('save');
            setShowSaveLoad(true);
        }
    };

    const handleSettings = () => {
        // Show settings screen
        setIsNewGameSettings(false);
        setShowSettings(true);
    };

    const handleSettingsCancel = () => {
        setShowSettings(false);
        setIsNewGameSettings(false);
    };

    const handleSettingsConfirm = () => {
        setShowSettings(false);
        
        // If this was new game settings, start the game
        if (isNewGameSettings) {
            stage().initialized = false;
            stage().startGame();
            // Check if aide is still being generated
            console.log(`Starting new game from settings: ${stage().getGenerateAidePromise() ? "loading aide" : "entering station"}`);
            if (stage().getGenerateAidePromise()) {
                setScreenType(ScreenType.LOADING);
            } else if (stage().getSave().currentSkit) {
                setScreenType(ScreenType.SKIT);
            } else {
                setScreenType(ScreenType.STATION);
            }
            setIsNewGameSettings(false);
        }
    };

    const noSaveSlotsAvailable = () => {
        return stage().getAllSaves().every(save => save);
    }


    // Title-screen art (hosted). The hand+phone is the stage; logo sits at the top of the screen,
    // menu buttons stack below it, all within the phone's bezel.
    const ART = {
        logo: 'https://cdn.imgchest.com/files/d667a55d5ea5.png',
        button: 'https://cdn.imgchest.com/files/83288ab7c48e.png',
        hand: 'https://cdn.imgchest.com/files/f17e0d8d37d4.png',
        background: 'https://cdn.imgchest.com/files/58d55f085879.png',
    };

    // Only the four title-screen actions Joseph specified (no Save Game from the title).
    const titleButtons = [
        ...(saveExists() ? [{ key: 'continue', label: 'Continue', onClick: handleContinue }] : []),
        { key: 'new', label: 'New Game', onClick: handleNewGame },
        { key: 'load', label: 'Load Game', onClick: handleLoad },
        { key: 'settings', label: 'Settings', onClick: handleSettings },
    ];

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            {/* Slightly blurry city-at-night background */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${ART.background})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                filter: 'blur(4px)', transform: 'scale(1.06)', // scale hides blur edge-bleed
                zIndex: 0,
            }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,6,16,0.35)', zIndex: 0 }} />

            {/* The hand + phone group, gently wobbling as if held. The buttons live INSIDE this group
                so they wobble in lockstep with the phone (they never drift relative to the bezel).
                Anchored to the bottom and oversized so the wrist/arm bleeds off the bottom edge. */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1, overflow: 'hidden' }}>
                <motion.div
                    style={{ position: 'relative', height: 'min(150vh, 1320px)', aspectRatio: '1024 / 1536', marginBottom: '-16vh', marginRight: '14vw' }}
                    animate={{
                        // Very slight, slow, irregular drift + rotation - a held-hand idle, not a shake.
                        x: [0, 3, -2, 2, -3, 0],
                        y: [0, -3, 2, -2, 3, 0],
                        rotate: [0, 0.5, -0.4, 0.3, -0.5, 0],
                    }}
                    transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                >
                    {/* Hand holding the phone (fills the group) */}
                    <img src={ART.hand} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} />

                    {/* Phone screen content, positioned within the black glass of the phone.
                        ===== TUNING: these four values place the content box over the phone's screen.
                        If the logo/buttons sit too high/low or off the glass, nudge these. They are
                        percentages of the hand-image box. ===== */}
                    <div style={{
                        position: 'absolute',
                        top: '10.5%', left: '33.5%', width: '43%', height: '42%',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 'clamp(3px, 0.8vh, 8px)',
                    }}>
                        {/* Logo at the top of the phone, fit within the screen width */}
                        <motion.img
                            src={ART.logo}
                            alt="The Summoner Game"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            style={{ width: '82%', maxHeight: '24%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
                        />

                        {/* Menu buttons: green button art with text overlaid */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(2px, 0.6vh, 6px)', marginTop: 'clamp(1px, 0.5vh, 4px)' }}>
                            {titleButtons.map((button, index) => (
                                <motion.button
                                    key={button.key}
                                    onClick={button.onClick}
                                    onMouseEnter={() => setHoveredButton(button.key)}
                                    onMouseLeave={() => setHoveredButton(null)}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0, scale: hoveredButton === button.key ? 1.04 : 1 }}
                                    whileTap={{ scale: 0.96 }}
                                    transition={{ opacity: { delay: 0.3 + index * 0.1, duration: 0.4 }, scale: { duration: 0.15 } }}
                                    style={{
                                        position: 'relative',
                                        width: '82%',
                                        aspectRatio: '1512 / 470',
                                        border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        filter: hoveredButton === button.key ? 'brightness(1.15) drop-shadow(0 0 6px rgba(80,255,80,0.5))' : 'none',
                                    }}
                                >
                                    <img src={ART.button} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none', userSelect: 'none' }} />
                                    <span style={{
                                        position: 'relative', zIndex: 1,
                                        color: '#fff', fontWeight: 800,
                                        fontSize: 'clamp(9px, 1.5vw, 16px)',
                                        letterSpacing: '0.03em',
                                        textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                                        whiteSpace: 'nowrap',
                                    }}>{button.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Version tag, bottom corner, outside the phone */}
            <div style={{ position: 'absolute', bottom: 10, right: 14, zIndex: 2, color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(9px, 1.2vw, 12px)' }}>
                The Summoner Game - alpha
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <SettingsScreen
                    stage={stage}
                    onCancel={handleSettingsCancel}
                    onConfirm={handleSettingsConfirm}
                    isNewGame={isNewGameSettings}
                />
            )}

            {/* Save/Load Modal */}
            {showSaveLoad && (
                <SaveLoadScreen
                    stage={stage}
                    mode={saveLoadMode}
                    onClose={() => setShowSaveLoad(false)}
                    setScreenType={setScreenType}
                />
            )}

            {/* Content Management Modal */}
            {showContentManagement && (
                <ContentManagementScreen
                    stage={stage}
                    onClose={() => setShowContentManagement(false)}
                />
            )}
        </div>
    );
};