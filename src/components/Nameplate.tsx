import React, { FC, useRef, useEffect, useState } from 'react';
import { Chip, Box } from '@mui/material';
import Actor from '../actors/Actor';

export interface NameplateProps {
    actor?: Actor;
    name?: string;
    role?: string;
    size?: 'small' | 'medium' | 'large';
    layout?: 'inline' | 'stacked';
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Reusable character nameplate component that displays character names
 * with consistent styling based on their theme colors and fonts.
 * Can optionally display a role below or inline with the name.
 */
export const Nameplate: FC<NameplateProps> = ({ 
    actor,
    name,
    role,
    size = 'medium',
    layout = 'stacked',
    className,
    style 
}) => {
    const chipRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [fontScale, setFontScale] = useState(1);

    const getSizeStyles = () => {
        switch (size) {
            case 'small':
                return {
                    fontSize: 'clamp(0.5rem, 1.8vmin, 1rem)',
                    roleFontSize: 'clamp(0.4rem, 1.4vmin, 0.8rem)',
                    borderWidth: 'clamp(1px, 0.3vmin, 2.5px)',
                };
            case 'large':
                return {
                    fontSize: 'clamp(0.8rem, 3vmin, 1.8rem)',
                    roleFontSize: 'clamp(0.6rem, 2vmin, 1.2rem)',
                    borderWidth: 'clamp(2px, 0.6vmin, 5px)',
                };
            default: // medium
                return {
                    fontSize: 'clamp(0.65rem, 2.2vmin, 1.4rem)',
                    roleFontSize: 'clamp(0.5rem, 1.6vmin, 1rem)',
                    borderWidth: 'clamp(1.5px, 0.4vmin, 4px)',
                };
        }
    };

    const sizeStyles = getSizeStyles();
    const displayName = actor?.name || name || '';
    const displayRole = role || 'Resident';

    // Measure and scale font based on available container width
    useEffect(() => {
        const measureAndScale = () => {
            if (!chipRef.current || !textRef.current) return;

            // Get the chip's parent container width (accounting for maxWidth: 100%)
            const parentWidth = chipRef.current.parentElement?.offsetWidth || chipRef.current.offsetWidth;
            
            // Account for padding (2 * 16px from px: 2)
            const horizontalPadding = 16;
            const availableWidth = parentWidth - horizontalPadding;
            
            // Reset scale to measure at full size
            setFontScale(1);
            
            // Use requestAnimationFrame to ensure DOM has updated
            requestAnimationFrame(() => {
                if (!textRef.current) return;
                
                const textWidth = textRef.current.scrollWidth;
                
                if (textWidth > availableWidth && availableWidth > 0) {
                    // Scale down, but not below 0.4 (40%) for better fitting
                    // Add a small buffer to prevent just-barely-too-wide text
                    const scale = Math.max(0.4, (availableWidth * 0.98) / textWidth);
                    setFontScale(scale);
                }
            });
        };

        measureAndScale();

        // Re-measure on window resize
        const resizeObserver = new ResizeObserver(measureAndScale);
        if (chipRef.current?.parentElement) {
            resizeObserver.observe(chipRef.current.parentElement);
        }

        return () => resizeObserver.disconnect();
    }, [displayName, displayRole, size, layout, role]);

    const renderLabel = () => {
        const nameStyle: React.CSSProperties = {
            fontSize: `calc(${sizeStyles.fontSize} * ${fontScale})`,
            transition: 'font-size 0.2s ease-out',
        };

        const roleStyle: React.CSSProperties = {
            fontSize: `calc(${sizeStyles.roleFontSize} * ${fontScale})`,
            opacity: 0.75,
            fontWeight: 600,
            textTransform: 'capitalize',
            transition: 'font-size 0.2s ease-out',
        };

        if (!role) {
            return <span ref={textRef} style={nameStyle}>{displayName}</span>;
        }

        if (layout === 'inline') {
            return (
                <span ref={textRef} style={nameStyle}>
                    {displayName}
                    <span style={{ ...roleStyle, marginLeft: '0.5em' }}>
                        ({displayRole})
                    </span>
                </span>
            );
        } else {
            return (
                <Box ref={textRef} sx={{ textAlign: 'center', lineHeight: 1.2 }}>
                    <div style={nameStyle}>{displayName}</div>
                    <div style={{ ...roleStyle, marginTop: '0.15em' }}>
                        {displayRole}
                    </div>
                </Box>
            );
        }
    };

    return (
        <Chip
            ref={chipRef}
            label={renderLabel()}
            variant="filled"
            className={className}
            sx={{ 
                px: 2,
                py: 0.5,
                fontSize: sizeStyles.fontSize,
                fontWeight: 900, 
                color: '#fff', 
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                background: actor?.themeColor || '#4a5568',
                border: actor?.themeColor ? `${sizeStyles.borderWidth} solid ${actor.themeColor}CC` : `${sizeStyles.borderWidth} solid #718096`,
                borderRadius: '25px',
                textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(0,0,0,0.9)',
                boxShadow: `0 6px 20px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.15), inset 0 -2px 0 rgba(0,0,0,0.2)`,
                backdropFilter: 'blur(6px)',
                position: 'relative',
                overflow: 'visible',
                // Width should be content-based by default, but respect parent constraints
                width: 'fit-content',
                maxWidth: '100%',
                // Center the nameplate when not in a flex container
                mx: 'auto',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-2px',
                    left: '-2px',
                    right: '-2px',
                    bottom: '-2px',
                    background: actor?.themeColor ? `${actor.themeColor}33` : 'rgba(113, 128, 150, 0.2)',
                    borderRadius: '27px',
                    zIndex: -1,
                    filter: 'blur(3px)',
                },
                '& .MuiChip-label': {
                    padding: role ? (layout === 'stacked' ? '0.2em 0' : 0) : 0,
                    fontFamily: actor?.themeFontFamily || '"Arial Black", "Helvetica Neue", Arial, sans-serif',
                    position: 'relative',
                    zIndex: 1,
                    whiteSpace: 'nowrap',
                },
                ...style
            }}
        />
    );
};

/**
 * Helper function to get an actor's role from the layout.
 * Returns the role name from their assigned role module, or 'Resident' if none.
 */
export const getActorRole = (actorId: string, layout: any): string => {
    const roleModules = layout.getModulesWhere((m: any) => 
        m && m.type !== 'quarters' && m.ownerId === actorId
    );
    
    if (roleModules.length > 0) {
        const roleModule = roleModules[0];
        // Get the role from MODULE_DEFAULTS
        return roleModule.getAttribute('role') || 'Resident';
    }
    
    return 'Resident';
};

export default Nameplate;