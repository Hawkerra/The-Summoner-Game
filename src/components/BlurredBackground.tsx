import React, { FC, useEffect, useState } from 'react';

interface BlurredBackgroundProps {
    imageUrl: string;
    brightness?: number;
    contrast?: number;
    blur?: number;
    scale?: number;
    overlay?: string;
    transitionMs?: number;
    children?: React.ReactNode;
}

/**
 * A reusable component that provides a blurred background image with consistent styling
 * across all screens in the application.
 */
export const BlurredBackground: FC<BlurredBackgroundProps> = ({
    imageUrl,
    brightness = 0.6,
    contrast = 1.05,
    blur = 6,
    scale = 1.03,
    overlay,
    transitionMs = 700,
    children
}) => {
    const [displayedImage, setDisplayedImage] = useState<string>(imageUrl);
    const [incomingImage, setIncomingImage] = useState<string | null>(null);
    const [isWiping, setIsWiping] = useState<boolean>(false);

    useEffect(() => {
        if (!imageUrl || imageUrl === displayedImage) return;

        setIncomingImage(imageUrl);
        setIsWiping(true);

        const finishTimer = window.setTimeout(() => {
            setDisplayedImage(imageUrl);
            setIncomingImage(null);
            setIsWiping(false);
        }, transitionMs);

        return () => {
            window.clearTimeout(finishTimer);
        };
    }, [imageUrl, displayedImage, transitionMs]);

    const baseImageStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: `blur(${blur}px) brightness(${brightness}) contrast(${contrast})`,
        transform: `scale(${scale})`
    };

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden'
        }}>
            {/* Current background image */}
            <div
                style={{
                    ...baseImageStyle,
                    backgroundImage: `url(${displayedImage})`,
                    opacity: isWiping ? 0.85 : 1,
                    transition: `opacity ${Math.max(120, Math.round(transitionMs * 0.55))}ms ease-out`
                }}
            />

            {/* Incoming background image with left-to-right wipe */}
            {incomingImage && (
                <div
                    style={{
                        ...baseImageStyle,
                        backgroundImage: `url(${incomingImage})`,
                        clipPath: isWiping ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
                        opacity: isWiping ? 1 : 0.6,
                        transition: `clip-path ${transitionMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${transitionMs}ms ease-out`,
                        willChange: 'clip-path, opacity'
                    }}
                />
            )}

            {/* Optional overlay */}
            {overlay && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: overlay,
                    zIndex: 1
                }} />
            )}

            {/* Content */}
            <div style={{
                position: 'relative',
                zIndex: 2,
                width: '100%',
                height: '100%'
            }}>
                {children}
            </div>
        </div>
    );
};

export default BlurredBackground;