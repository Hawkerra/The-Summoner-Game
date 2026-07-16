import React, { FC, useState, useEffect } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';

/*
 * Loading screen that displays while the StationAide is being generated.
 * Monitors the generateAidePromise and automatically transitions to the Station screen when complete.
 */

interface LoadingScreenProps {
    stage: () => Stage;
    setScreenType: (type: ScreenType) => void;
}

const LOADING_PHASES = [
    { message: "Generating content (this may take a while)", duration: 15000, progress: 20 },
    { message: "Expanding Tower Spirit details.", duration: 15000, progress: 50 },
    { message: "Visualizing Tower Spirit.", duration: 30000, progress: 75 },
    { message: "Wrapping up", duration: Infinity, progress: 90 },
];

export const LoadingScreen: FC<LoadingScreenProps> = ({ stage, setScreenType }) => {
    const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    // Poll for completion of aide generation
    useEffect(() => {
        const interval = setInterval(() => {
            const aidePromise = stage().getGenerateAidePromise();
            
            // If aide promise has completed, transition to station screen
            if (!aidePromise) {
                setScreenType(ScreenType.STATION);
            }
        }, 100);
        
        return () => clearInterval(interval);
    }, [stage, setScreenType]);

    // Handle phase transitions and progress animation
    useEffect(() => {
        const currentPhase = LOADING_PHASES[currentPhaseIndex];
        const targetProgress = currentPhase.progress;
        
        // Smoothly animate progress to target
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev < targetProgress) {
                    return Math.min(prev + 0.5, targetProgress);
                }
                return prev;
            });
        }, 50);

        // Move to next phase after duration (if not the last phase)
        let phaseTimeout: NodeJS.Timeout | null = null;
        if (currentPhaseIndex < LOADING_PHASES.length - 1) {
            phaseTimeout = setTimeout(() => {
                setCurrentPhaseIndex(prev => Math.min(prev + 1, LOADING_PHASES.length - 1));
            }, currentPhase.duration);
        }

        return () => {
            clearInterval(progressInterval);
            if (phaseTimeout) clearTimeout(phaseTimeout);
        };
    }, [currentPhaseIndex]);

    const currentPhase = LOADING_PHASES[currentPhaseIndex];

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                width: '100vw',
                background: 'linear-gradient(45deg, #140a20 0%, #002244 100%)',
            }}
        >
            <Box
                sx={{
                    width: '500px',
                    maxWidth: '80%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Typography
                    variant="h5"
                    sx={{
                        color: '#b066ff',
                        fontWeight: 700,
                        textShadow: '0 0 20px rgba(176, 102, 255, 0.5)',
                        marginBottom: 4,
                        textAlign: 'center',
                    }}
                >
                    Awakening the Tower Spirit
                </Typography>

                <Box sx={{ width: '100%', marginBottom: 2 }}>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: 'rgba(176, 102, 255, 0.1)',
                            '& .MuiLinearProgress-bar': {
                                backgroundColor: '#b066ff',
                                boxShadow: '0 0 10px rgba(176, 102, 255, 0.5)',
                                borderRadius: 5,
                            },
                        }}
                    />
                </Box>

                <Typography
                    variant="body1"
                    sx={{
                        color: '#9440e8',
                        fontWeight: 500,
                        textAlign: 'center',
                        minHeight: '24px',
                    }}
                >
                    {currentPhase.message}
                </Typography>
            </Box>
        </Box>
    );
};
