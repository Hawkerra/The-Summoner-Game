import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';
import { GridOverlay, Title, Button } from '../components/UIComponents';
import { SettingsScreen } from './SettingsScreen';
import { SaveLoadScreen } from './SaveLoadScreen';
import { useTooltip } from '../contexts/TooltipContext';
import { Save } from '@mui/icons-material';

/*
 * The IN-GAME menu, reached from the Home screen's Menu button. This is the plain typeset menu that
 * the old main menu used to be - distinct from the composited phone title screen (MenuScreen), which
 * is now only the boot screen. This is where the player actually saves: it carries Save (pick a slot)
 * and Quick Save (write to the last-used slot) in addition to Continue / New Game / Load / Settings.
 */

interface GameMenuScreenProps {
    stage: () => Stage;
    setScreenType: (type: ScreenType) => void;
}

export const GameMenuScreen: FC<GameMenuScreenProps> = ({ stage, setScreenType }) => {
    const [hoveredButton, setHoveredButton] = React.useState<string | null>(null);
    const [showSettings, setShowSettings] = React.useState(false);
    const [isNewGameSettings, setIsNewGameSettings] = React.useState(false);
    const [showSaveLoad, setShowSaveLoad] = React.useState(false);
    const [saveLoadMode, setSaveLoadMode] = React.useState<'save' | 'load'>('save');
    const [quickSaved, setQuickSaved] = React.useState(false);
    const { setTooltip } = useTooltip();

    const saveExists = () => {
        return stage().getSave() && Object.keys(stage().getSave().actors).length > 0;
    };

    // Escape returns to the game (this menu is only reachable mid-game, so "continue" always applies
    // unless a modal is open).
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (showSettings) {
                handleSettingsCancel();
            } else if (showSaveLoad) {
                setShowSaveLoad(false);
            } else {
                handleContinue();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showSettings, showSaveLoad]);

    // Return to the game where the player left off.
    const handleContinue = () => {
        if (stage().getGenerateAidePromise()) {
            setScreenType(ScreenType.LOADING);
        } else if (stage().getSave().currentSkit) {
            setScreenType(ScreenType.SKIT);
        } else {
            setScreenType(ScreenType.STATION);
        }
    };

    const handleNewGame = () => {
        setIsNewGameSettings(true);
        setShowSettings(true);
    };

    const handleLoad = () => {
        setSaveLoadMode('load');
        setShowSaveLoad(true);
    };

    // Open the slot picker to save to a chosen file.
    const handleSave = () => {
        setSaveLoadMode('save');
        setShowSaveLoad(true);
    };

    // Write straight to the last-used slot - no picker. saveGame() targets this.saveSlot, which
    // saveToSlot() keeps in sync with the most recent manual save.
    const handleQuickSave = () => {
        stage().saveGame();
        setQuickSaved(true);
        setTooltip('Game saved.', Save, undefined, 2000);
        window.setTimeout(() => setQuickSaved(false), 2000);
    };

    const handleSettings = () => {
        setIsNewGameSettings(false);
        setShowSettings(true);
    };

    const handleSettingsCancel = () => {
        setShowSettings(false);
        setIsNewGameSettings(false);
    };

    const handleSettingsConfirm = () => {
        setShowSettings(false);
        if (isNewGameSettings) {
            stage().initialized = false;
            stage().startGame();
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

    const menuButtons = [
        { key: 'continue', label: 'Continue', onClick: handleContinue },
        { key: 'quicksave', label: quickSaved ? 'Saved!' : 'Quick Save', onClick: handleQuickSave },
        { key: 'save', label: 'Save', onClick: handleSave },
        { key: 'new', label: 'New Game', onClick: handleNewGame },
        { key: 'load', label: 'Load Game', onClick: handleLoad },
        { key: 'settings', label: 'Settings', onClick: handleSettings },
    ];

    return (
        <div style={{
            position: 'relative', width: '100vw', height: '100vh',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(160deg, #05070f 0%, #0b1024 60%, #05070f 100%)',
        }}>
            <GridOverlay />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="glass-panel"
                style={{
                    padding: 'clamp(24px, 5vh, 44px) clamp(28px, 6vw, 52px)',
                    minWidth: 'min(340px, 88vw)',
                    maxWidth: '90vw',
                    boxSizing: 'border-box',
                    zIndex: 1,
                }}
            >
                <Title variant="glow" style={{ textAlign: 'center', marginBottom: 'clamp(18px, 4vh, 32px)', fontSize: 'clamp(20px, 4vw, 30px)' }}>
                    Menu
                </Title>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 2vh, 15px)' }}>
                    {menuButtons.map((button, index) => (
                        <motion.div
                            key={button.key}
                            initial={{ opacity: 0, x: -24 }}
                            animate={{ opacity: 1, x: hoveredButton === button.key ? 8 : 0 }}
                            transition={{
                                opacity: { delay: 0.15 + index * 0.07, duration: 0.35 },
                                x: { duration: 0.18 },
                            }}
                            onMouseEnter={() => setHoveredButton(button.key)}
                            onMouseLeave={() => setHoveredButton(null)}
                        >
                            <Button
                                variant="menu"
                                onClick={button.onClick}
                                style={{
                                    width: '100%',
                                    fontSize: 'clamp(13px, 2.4vw, 16px)',
                                    padding: 'clamp(9px, 1.6vh, 13px) clamp(16px, 3vw, 24px)',
                                    background: hoveredButton === button.key ? 'rgba(176, 102, 255, 0.2)' : 'transparent',
                                }}
                            >
                                {button.label}
                            </Button>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {showSettings && (
                <SettingsScreen
                    stage={stage}
                    onCancel={handleSettingsCancel}
                    onConfirm={handleSettingsConfirm}
                    isNewGame={isNewGameSettings}
                />
            )}

            {showSaveLoad && (
                <SaveLoadScreen
                    stage={stage}
                    mode={saveLoadMode}
                    onClose={() => setShowSaveLoad(false)}
                    setScreenType={setScreenType}
                />
            )}
        </div>
    );
};
