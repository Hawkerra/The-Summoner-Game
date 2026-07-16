import React, { FC, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import { SvgIconComponent, HourglassEmpty } from '@mui/icons-material';

interface TooltipBarProps {
    message: string | null;
    Icon?: SvgIconComponent;
    visible?: boolean;
    actionCost?: number; // Number of turns this action costs
    onDismiss?: () => void; // Callback when tooltip is dismissed
    autoDismissMs?: number; // Time in ms before auto-dismissing (default: 3000)
}

/**
 * A unified tooltip/message bar that appears at the bottom center of the screen.
 * Displays a message with an optional Material UI icon.
 * Auto-dismisses on mobile/touch devices after a delay, unless actively hovered on desktop.
 */
export const TooltipBar: FC<TooltipBarProps> = ({ 
    message, 
    Icon, 
    visible = true, 
    actionCost,
    onDismiss,
    autoDismissMs = 3000
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
    const messageRef = useRef<string | null>(null);

    // Clear timer helper
    const clearDismissTimer = () => {
        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = null;
        }
    };

    // Set up auto-dismiss timer
    useEffect(() => {
        // If message changed, update ref
        if (message !== messageRef.current) {
            messageRef.current = message;
            clearDismissTimer();
            
            // Only set up auto-dismiss if there's a message and we're not hovering
            if (message && !isHovered && autoDismissMs > 0) {
                dismissTimerRef.current = setTimeout(() => {
                    if (onDismiss && !isHovered) {
                        onDismiss();
                    }
                }, autoDismissMs);
            }
        }

        // Clean up on unmount
        return () => clearDismissTimer();
    }, [message, isHovered, autoDismissMs, onDismiss]);

    // Handle hover state changes - restart timer when hover ends
    useEffect(() => {
        if (!isHovered && message) {
            // When hover ends, restart the auto-dismiss timer
            clearDismissTimer();
            if (autoDismissMs > 0 && onDismiss) {
                dismissTimerRef.current = setTimeout(() => {
                    if (!isHovered) {
                        onDismiss();
                    }
                }, autoDismissMs);
            }
        } else if (isHovered) {
            // When hovering, cancel any pending dismissal
            clearDismissTimer();
        }
    }, [isHovered, message, autoDismissMs, onDismiss]);

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    return (
        <AnimatePresence>
            {message && visible && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    style={{
                        position: 'fixed',
                        bottom: '40px',
                        left: '50%',
                        zIndex: 9999,
                        pointerEvents: 'auto', // Changed from 'none' to allow hover detection
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            padding: '16px 24px',
                            background: 'linear-gradient(135deg, rgba(0, 30, 60, 0.95) 0%, rgba(18, 8, 32, 0.95) 100%)',
                            border: '2px solid #b066ff',
                            borderRadius: '12px',
                            boxShadow: '0 8px 32px rgba(176, 102, 255, 0.3), 0 0 20px rgba(176, 102, 255, 0.2)',
                            backdropFilter: 'blur(10px)',
                            maxWidth: '50vw',
                            minWidth: 'fit-content',
                            transform: 'translateX(-50%)',
                        }}
                    >
                        {Icon && (
                            <Icon
                                sx={{
                                    color: '#b066ff',
                                    fontSize: '28px',
                                    filter: 'drop-shadow(0 0 8px rgba(176, 102, 255, 0.5))',
                                    flexShrink: 0,
                                }}
                            />
                        )}
                        <Typography
                            variant="body1"
                            sx={{
                                color: '#b066ff',
                                fontSize: '16px',
                                fontWeight: 600,
                                textShadow: '0 0 10px rgba(176, 102, 255, 0.3)',
                                textAlign: 'center',
                            }}
                        >
                            {message}
                        </Typography>
                        {actionCost && actionCost > 0 && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    marginLeft: '8px',
                                    paddingLeft: '12px',
                                    borderLeft: '2px solid rgba(176, 102, 255, 0.3)',
                                }}
                            >
                                {Array.from({ length: actionCost }).map((_, i) => (
                                    <HourglassEmpty
                                        key={i}
                                        sx={{
                                            color: '#b066ff',
                                            fontSize: '20px',
                                            filter: 'drop-shadow(0 0 6px rgba(176, 102, 255, 0.4))',
                                        }}
                                    />
                                ))}
                            </Box>
                        )}
                    </Box>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TooltipBar;
