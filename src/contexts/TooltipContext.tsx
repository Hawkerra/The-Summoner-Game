import React, { createContext, useContext, useState, useRef, ReactNode, FC } from 'react';
import { SvgIconComponent } from '@mui/icons-material';

interface TooltipContextValue {
    message: string | null;
    icon: SvgIconComponent | undefined;
    actionCost: number | undefined;
    setTooltip: (message: string | null, icon?: SvgIconComponent, actionCost?: number, expiryMs?: number) => void;
    setPriorityMessage: (message: string, icon?: SvgIconComponent, durationMs?: number) => void;
    clearTooltip: () => void;
}

const TooltipContext = createContext<TooltipContextValue | undefined>(undefined);

interface TooltipProviderProps {
    children: ReactNode;
}

/**
 * Provider for managing tooltip state across all screens
 */
export const TooltipProvider: FC<TooltipProviderProps> = ({ children }) => {
    const [message, setMessage] = useState<string | null>(null);
    const [icon, setIcon] = useState<SvgIconComponent | undefined>(undefined);
    const [actionCost, setActionCost] = useState<number | undefined>(undefined);
    const [isPriority, setIsPriority] = useState<boolean>(false);
    const savedTooltipRef = useRef<{message: string | null, icon?: SvgIconComponent, actionCost?: number}>({message: null});
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const setTooltip = (newMessage: string | null, newIcon?: SvgIconComponent, newActionCost?: number, expiryMs?: number) => {
        // Don't update if a priority message is active
        if (isPriority) {
            return;
        }

        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        setMessage(newMessage);
        setIcon(newIcon);
        setActionCost(newActionCost);

        // Set up auto-expiry if specified
        if (expiryMs && expiryMs > 0 && newMessage) {
            timeoutRef.current = setTimeout(() => {
                // Only clear if the message hasn't changed
                setMessage((currentMessage) => {
                    if (currentMessage === newMessage) {
                        setIcon(undefined);
                        setActionCost(undefined);
                        return null;
                    }
                    return currentMessage;
                });
                timeoutRef.current = null;
            }, expiryMs);
        }
    };

    const setPriorityMessage = (priorityMessage: string, priorityIcon?: SvgIconComponent, durationMs: number = 5000) => {
        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        // Save the current tooltip state
        savedTooltipRef.current = {
            message,
            icon,
            actionCost
        };

        // Set priority message
        setIsPriority(true);
        setMessage(priorityMessage);
        setIcon(priorityIcon);
        setActionCost(undefined);

        // Set up auto-revert after duration
        timeoutRef.current = setTimeout(() => {
            setIsPriority(false);
            // Restore previous tooltip if it existed
            const saved = savedTooltipRef.current;
            setMessage(saved.message);
            setIcon(saved.icon);
            setActionCost(saved.actionCost);
            timeoutRef.current = null;
        }, durationMs);
    };

    const clearTooltip = () => {
        // Don't clear if a priority message is active
        if (isPriority) {
            return;
        }

        // Clear any pending timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        
        setMessage(null);
        setIcon(undefined);
        setActionCost(undefined);
    };

    return (
        <TooltipContext.Provider value={{ message, icon, actionCost, setTooltip, setPriorityMessage, clearTooltip }}>
            {children}
        </TooltipContext.Provider>
    );
};

/**
 * Hook to access tooltip context in any component
 */
export const useTooltip = (): TooltipContextValue => {
    const context = useContext(TooltipContext);
    if (!context) {
        throw new Error('useTooltip must be used within a TooltipProvider');
    }
    return context;
};
