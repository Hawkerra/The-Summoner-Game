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

    const menuButtons = [
        ...(saveExists() ? [{ 
            key: 'continue', 
            label: 'Continue', 
            onClick: handleContinue,
            enabled: !disableAllButtons,
            tooltip: disableAllButtons ? 'Currently unavailable' : 'Resume your current game',
            icon: PlayArrow
        }] : []),
        { 
            key: 'new', 
            label: 'New Game', 
            onClick: handleNewGame,
            enabled: !disableAllButtons && !noSaveSlotsAvailable(),
            tooltip: disableAllButtons ? 'Currently unavailable' : (noSaveSlotsAvailable() ? 'No save slots remaining; delete a save to start a new game' : 'Start a fresh playthrough'),
            icon: FiberNew
        },
        ...(saveExists() && stage().initialized ? [{
            key: 'quicksave',
            label: 'Quick Save',
            onClick: () => {
                stage().saveGame();
                setTooltip('Game saved!', Save, undefined, 2000);
            },
            enabled: !disableAllButtons,
            tooltip: disableAllButtons ? 'Currently unavailable' : 'Quickly save your current progress',
            icon: Save,
        }] : []),
        {
            key: 'save',
            label: 'Save Game',
            onClick: handleSave,
            enabled: !disableAllButtons && stage().initialized,
            tooltip: disableAllButtons ? 'Currently unavailable' : 'Save progress to a specific slot',
            icon: SaveAlt
        },
        { 
            key: 'load', 
            label: 'Load Game', 
            onClick: handleLoad,
            enabled: !disableAllButtons,
            tooltip: disableAllButtons ? 'Currently unavailable' : 'Load a previously saved game',
            icon: Folder
        },
        { 
            key: 'settings', 
            label: 'Settings', 
            onClick: handleSettings,
            enabled: !disableAllButtons,
            tooltip: disableAllButtons ? 'Currently unavailable' : 'Adjust game settings and preferences',
            icon: Settings
        }
    ];

    return (
        <BlurredBackground
            imageUrl="https://i.imgur.com/9hF0qda.gif" //https://media.charhub.io/41b7b65d-839b-4d31-8c11-64ee50e817df/0fc1e223-ad07-41c4-bdae-c9545d5c5e34.png"
            overlay="linear-gradient(45deg, rgba(0,17,34,0.3) 0%, rgba(0,34,68,0.3) 100%)"
        >
            <div 
                className="menu-screen" 
                style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh', 
                    width: '100vw'
                }}
            >
            {/* Background grid effect */}
            <GridOverlay />

            {/* Main menu container */}
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="glass-panel-bright"
                style={{
                    padding: 'clamp(20px, 5vh, 40px) clamp(20px, 5vw, 40px)',
                    minWidth: '300px',
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    boxSizing: 'border-box',
                }}
            >
                {/* Title */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                >
                    <Title variant="glow" style={{ textAlign: 'center', marginBottom: 'clamp(20px, 5vh, 40px)', fontSize: 'clamp(18px, 5vw, 28px)' }}>
                        The Spire
                    </Title>
                </motion.div>

                {/* Menu buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 2vh, 15px)' }}>
                    {menuButtons.map((button, index) => (
                        <motion.div
                            key={button.key}
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ 
                                opacity: 1, 
                                x: hoveredButton === button.key && button.enabled ? 10 : 0
                            }}
                            transition={{ 
                                opacity: { delay: 0.4 + (index * 0.1), duration: 0.4, ease: 'easeOut' },
                                x: { duration: 0.2, ease: 'easeOut' }
                            }}
                            onMouseEnter={() => {
                                setHoveredButton(button.enabled ? button.key : null);
                                setTooltip(button.tooltip, button.icon);
                            }}
                            onMouseLeave={() => {
                                setHoveredButton(null);
                                clearTooltip();
                            }}
                        >
                            <Button
                                variant="menu"
                                whileTap={{ scale: button.enabled ? 0.95 : 1 }}
                                onClick={button.enabled ? button.onClick : undefined}
                                disabled={!button.enabled}
                                style={{
                                    width: '100%',
                                    fontSize: 'clamp(12px, 2.5vw, 16px)',
                                    padding: 'clamp(8px, 1.5vh, 12px) clamp(16px, 3vw, 24px)',
                                    background: button.enabled && hoveredButton === button.key 
                                        ? 'rgba(176, 102, 255, 0.2)' 
                                        : button.enabled ? 'transparent' : 'rgba(18, 8, 32, 0.5)'
                                }}
                            >
                                {button.label}
                            </Button>
                        </motion.div>
                    ))}
                </div>

                {/* Subtitle/version info */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    style={{
                        textAlign: 'center',
                        marginTop: 'clamp(20px, 4vh, 30px)',
                        color: 'rgba(176, 102, 255, 0.6)',
                        fontSize: 'clamp(10px, 1.5vw, 12px)',
                    }}
                >
                    {stage().isAuthenticated 
                        ? 'v2026.06.10 - Experimenting with skit-generated characters. Still some issues with Soji.'
                        : (
                            <>
                                This is a private fantasy rework of PARC; for the original, visit:{' '}
                                <a 
                                    href="https://chub.ai/characters/JakeH/post-apocalypse-rehabilitation-center-20622f03e7a4" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: 'rgba(176, 102, 255, 0.8)', textDecoration: 'underline' }}
                                >
                                    chub.ai
                                </a>
                            </>
                        )
                    }
                </motion.div>
            </motion.div>
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
        </BlurredBackground>
    );
};