import {motion, Variants, easeOut, easeIn, AnimatePresence} from "framer-motion";
import {FC, useState, useEffect, useRef, useMemo, memo} from "react";
import Actor from "./Actor";
import { Emotion } from "./Emotion";

const IDLE_HEIGHT: number = 80;
const SPEAKING_HEIGHT: number = 90;

interface ActorImageProps {
    actor: Actor;
    emotion: Emotion;
    imageUrl: string;
    xPosition: number;
    yPosition: number;
    zIndex: number;
    heightMultiplier: number;
    // 'speaker' indicates whether this actor is currently speaking and should be emphasized
    speaker?: boolean;
    hologram?: boolean;
    highlightColor: string;
    panX: number;
    panY: number;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

const ActorImage: FC<ActorImageProps> = ({
    actor,
    emotion,
    imageUrl,
    xPosition,
    yPosition,
    zIndex,
    heightMultiplier,
    speaker,
    hologram,
    highlightColor,
    panX,
    panY,
    onMouseEnter,
    onMouseLeave
}) => {
    const [processedImageUrl, setProcessedImageUrl] = useState<string>('');
    const [prevImageUrl, setPrevImageUrl] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<string>('9 / 16');
    const prevRawImageUrl = useRef<string>(imageUrl);

    // Process image with color multiplication
    useEffect(() => {
        if (!imageUrl) {
            setProcessedImageUrl(imageUrl);
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
                // Set aspect ratio based on image dimensions
                if (img.naturalWidth && img.naturalHeight) {
                    setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
                }
            const result = multiplyImageByColor(img, hologram ? "#99ccff" : highlightColor);
            if (result) {
                setProcessedImageUrl(result);
            }
        };
        img.src = imageUrl;
    }, [imageUrl, highlightColor]);

    // Track previous processed image for fade transition
    useEffect(() => {
        if (prevRawImageUrl.current !== imageUrl) {
            setPrevImageUrl(processedImageUrl);
            prevRawImageUrl.current = imageUrl;
        }
    }, [imageUrl, processedImageUrl]);

    // Calculate final parallax position
    const baseX = speaker ? 50 : xPosition;
    const baseY = yPosition;
    const depth = (50 - baseY) / 50;
    const modX = ((panX * depth * 1.8) * 100);
    const modY = ((panY * depth * 1.8) * 100);

    const variants: Variants = useMemo(() => ({
        absent: {
            opacity: 0,
            x: `150vw`,
            bottom: `${baseY}vh`,
            height: `${IDLE_HEIGHT * heightMultiplier}vh`,
            filter: 'brightness(0.8)',
            transition: { x: { ease: easeIn, duration: 0.5 }, bottom: { duration: 0.5 }, opacity: { ease: easeOut, duration: 0.5 } }
        },
        talking: {
            opacity: 1,
            x: `${baseX}vw`,
            bottom: `${baseY}vh`,
            height: `${(SPEAKING_HEIGHT * heightMultiplier)}vh`,
            filter: 'brightness(1)',
            transition: { x: { ease: easeIn, duration: 0.3 }, bottom: { duration: 0.3 }, opacity: { ease: easeOut, duration: 0.3 } }
        },
        idle: {
            opacity: 1,
            x: `${baseX}vw`,
            bottom: `${baseY}vh`,
            height: `${(IDLE_HEIGHT * heightMultiplier)}vh`,
            filter: 'brightness(0.8)',
            transition: { x: { ease: easeIn, duration: 0.3 }, bottom: { duration: 0.3 }, opacity: { ease: easeOut, duration: 0.3 } }
        }
    }), [baseX, baseY, yPosition, zIndex, heightMultiplier]);

    return processedImageUrl ? (
        <motion.div
            key={`actor_motion_div_${actor.id}`}
            variants={variants}
            // Prevent automatic initial animation on remounts/refreshes; rely on animate to move between states
            initial={'absent'}
            exit='absent'
            animate={speaker ? 'talking' : 'idle'}
            style={{position: 'absolute', width: 'auto', aspectRatio, overflow: 'visible', zIndex: speaker ? 100 : zIndex}}>
            <AnimatePresence>
                {/* Previous image layer for crossfade */}
                {prevImageUrl && prevImageUrl !== processedImageUrl && (
                    <motion.img
                        key={`${actor.id}_${prevImageUrl}_prev`}
                        src={prevImageUrl}
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            width: '100%',
                            height: '100%',
                            filter: 'blur(2.5px)',
                            zIndex: 3,
                            transform: `translate(calc(${modX}vw - 50%), ${modY}vh)`,
                            pointerEvents: 'none'
                        }}
                        alt={`${actor.name} (${emotion}) previous`}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {/* Backing image layer - solid but blurry. */}
                {processedImageUrl && !hologram && (
                    <motion.img
                        key={`${actor.id}_${imageUrl}_bg`}
                        src={processedImageUrl}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, filter: 'blur(2.5px)' }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            width: '100%',
                            height: '100%',
                            zIndex: 4,
                            transform: `translate(calc(${modX}vw - 50%), ${modY}vh)`,
                            pointerEvents: 'none'
                        }}
                        alt={`${actor.name} (${emotion}) background`}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {/* Main image layer - semi transparent, but crisp. */}
                {processedImageUrl && (
                    <motion.img
                        key={`${actor.id}_${imageUrl}_main`}
                        src={processedImageUrl}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.75 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            width: '100%',
                            height: '100%',
                            zIndex: 5,
                            transform: `translate(calc(${modX}vw - 50%), ${modY}vh)`,
                        }}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        alt={`${actor.name} (${emotion})`}
                    />
                )}
            </AnimatePresence>
            {/* Rolling scanline effect for remote actors */}
            {hologram && (
                <AnimatePresence>
                    {processedImageUrl && (
                        <motion.img
                            key={`${actor.id}_${imageUrl}_scanline`}
                            src={processedImageUrl}
                            initial={{ 
                                opacity: 0,
                            }}
                            animate={{ 
                                opacity: 1,
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ 
                                opacity: { duration: 0.5 },
                            }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                width: '100%',
                                height: '100%',
                                opacity: 0.6,
                                zIndex: 6,
                                transform: `translate(calc(${modX}vw - 50%), ${modY}vh)`,
                                filter: 'blur(0.5px) brightness(1.5)',
                                maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.8) 98%, black 99%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.8) 98%, black 99%, transparent 100%)',
                                maskSize: '100% 200%',
                                WebkitMaskSize: '100% 200%',
                                maskPosition: '0% -100%',
                                WebkitMaskPosition: '0% -100%',
                                animation: 'scanlineMove 5s linear infinite',
                                pointerEvents: 'none'
                            }}
                            alt={`${actor.name} (${emotion}) scanline`}
                        />
                    )}
                </AnimatePresence>
            )}
        </motion.div>
    ) : <></>;
};

const multiplyImageByColor = (img: HTMLImageElement, hex: string): string | null => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Apply color multiplication
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hex.toUpperCase();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Preserve original alpha channel
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, 0, 0);

    return canvas.toDataURL();
};

export default memo(ActorImage);