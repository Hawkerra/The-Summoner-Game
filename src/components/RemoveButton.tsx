import React, { FC } from 'react';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface RemoveButtonProps {
    onClick: (e: React.MouseEvent) => void;
    title?: string;
    /** Position variant: 'topRight' (default) or 'topRightInset' */
    variant?: 'topRight' | 'topRightInset';
    /** Size of the button: 'small' (28px) or 'medium' (32px) */
    size?: 'small' | 'medium';
}

/**
 * Reusable remove/close button component with Material UI styling.
 * Displays as a circular button with a close icon that turns red on hover.
 */
export const RemoveButton: FC<RemoveButtonProps> = ({
    onClick,
    title = 'Remove',
    variant = 'topRight',
    size = 'small'
}) => {
    const buttonSize = size === 'small' ? 28 : 32;
    const iconSize = size === 'small' ? 'small' : 'medium';
    
    const position = variant === 'topRightInset' 
        ? { top: '8px', right: '8px' }
        : { top: '-8px', right: '-8px' };

    return (
        <IconButton
            onClick={onClick}
            title={title}
            size={iconSize}
            sx={{
                position: 'absolute',
                ...position,
                width: `${buttonSize}px`,
                height: `${buttonSize}px`,
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                zIndex: 10,
                border: '2px solid rgba(255, 255, 255, 0.3)',
                boxShadow: variant === 'topRightInset' 
                    ? '0 2px 8px rgba(0,0,0,0.5)' 
                    : '0 2px 8px rgba(0,0,0,0.3)',
                '&:hover': {
                    background: 'rgba(255, 0, 0, 0.9)'
                },
                transition: 'all 0.2s ease'
            }}
        >
            <CloseIcon fontSize="small" />
        </IconButton>
    );
};

export default RemoveButton;
