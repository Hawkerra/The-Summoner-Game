import { FC, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from '@mui/material';
import { Stage } from '../Stage';
import { v4 as generateUuid } from 'uuid';
import Actor, { Stat, ACTOR_STAT_ICONS, generateBaseActorImage, generateEmotionImage, generateActorDecor, generateOutfitEmotionPrompt, VOICE_MAP, Outfit, ORIGINAL_OUTFIT_NAME } from '../actors/Actor';
import { Emotion } from '../actors/Emotion';
import { GlassPanel, Title, Button, TextInput, Chip } from '../components/UIComponents';
import { Close, Save, Image as ImageIcon, PlayArrow } from '@mui/icons-material';
import { scoreToGrade } from '../utils';

interface ActorDetailScreenProps {
    actor: Actor;
    stage: () => Stage;
    onClose: () => void;
}

const voiceSampleCache = new Map<string, string>();

export const ActorDetailScreen: FC<ActorDetailScreenProps> = ({ actor, stage, onClose }) => {
    type ImageTarget = 'base' | Emotion;
    type BaseRegenSource = 'description' | 'avatar' | `outfit:${string}`;
    const initialOutfitIdRef = useRef(actor.outfitId);

    const getClonedOutfits = (): Outfit[] => {
        const sourceOutfits = Array.isArray(actor.outfits) && actor.outfits.length > 0
            ? actor.outfits
            : [{
                id: actor.outfitId || generateUuid(),
                name: ORIGINAL_OUTFIT_NAME,
                description: actor.getDescription(),
                prompts: {},
                emotionPack: { ...actor.getEmotionPack() },
            }];

        return sourceOutfits.map((outfit) => ({
            ...outfit,
            prompts: { ...(outfit.prompts || {}) },
            emotionPack: { ...(outfit.emotionPack || {}) },
        }));
    };

    // Local state for editable fields
    const [editedActor, setEditedActor] = useState<{
        name: string;
        profile: string;
        characterArc: string;
        style: string;
        voiceId: string;
        themeColor: string;
        themeFontFamily: string;
        locationId: string;
    }>({
        name: actor.name,
        profile: actor.profile,
        characterArc: actor.characterArc || '',
        style: actor.style,
        voiceId: actor.voiceId,
        themeColor: actor.themeColor,
        themeFontFamily: actor.themeFontFamily,
        locationId: actor.locationId || '',
    });
    const [editedOutfits, setEditedOutfits] = useState<Outfit[]>(() => getClonedOutfits());
    const [selectedOutfitId, setSelectedOutfitId] = useState<string>(() => {
        const outfits = getClonedOutfits();
        if (actor.outfitId && outfits.some((outfit) => outfit.id === actor.outfitId)) {
            return actor.outfitId;
        }
        return outfits[0]?.id || '';
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingDemoSpeech, setIsGeneratingDemoSpeech] = useState(false);
    const [regeneratingImages, setRegeneratingImages] = useState<Set<string>>(new Set());
    const [, forceUpdate] = useState({});
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const imageUploadInputRef = useRef<HTMLInputElement>(null);
    const [imageDialog, setImageDialog] = useState<{
        open: boolean;
        target: ImageTarget | null;
    }>({ open: false, target: null });
    const [baseRegenSource, setBaseRegenSource] = useState<BaseRegenSource>(() => (actor.avatarImageUrl ? 'avatar' : 'description'));
    const [emotionPromptDraft, setEmotionPromptDraft] = useState('');
    const [isImageDropActive, setIsImageDropActive] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        actions?: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'secondary' }>;
        onConfirm?: () => void;
    }>({ open: false, title: '', message: '' });
    const initialOutfitsRef = useRef<Outfit[]>(getClonedOutfits());

    useEffect(() => {
        actor.outfits = editedOutfits;
    }, [actor, editedOutfits]);

    const selectedOutfit = editedOutfits.find((outfit) => outfit.id === selectedOutfitId) || editedOutfits[0] || null;
    const getSelectedOutfitImageUrl = (emotion: Emotion | 'base'): string => selectedOutfit?.emotionPack?.[emotion] || '';

    const syncEditedOutfitsFromActor = () => {
        setEditedOutfits(actor.outfits.map((outfit) => ({
            ...outfit,
            prompts: { ...(outfit.prompts || {}) },
            emotionPack: { ...(outfit.emotionPack || {}) },
        })));
    };

    const ensureEmotionPromptForSelectedOutfit = async (emotion: Emotion): Promise<string> => {
        const outfit = actor.getOutfitById(selectedOutfitId);
        const existingPrompt = typeof outfit?.prompts?.[emotion] === 'string' ? outfit.prompts[emotion].trim() : '';
        if (existingPrompt) {
            return existingPrompt;
        }

        const generatedPrompt = (await generateOutfitEmotionPrompt(actor, emotion, stage(), selectedOutfitId)).trim();
        if (generatedPrompt) {
            syncEditedOutfitsFromActor();
            setEmotionPromptDraft(generatedPrompt);
        }
        return generatedPrompt;
    };

    async function generateDemoSpeech(voiceId: string, transcript: string) {
        const ttsResponse = await stage().generator.speak({
            transcript,
            voice_id: voiceId || undefined
        });
        if (ttsResponse && ttsResponse.url) {
            return ttsResponse.url;
        } else {
            return '';
        }
    }

    const getVoiceSampleCacheKey = (actorId: string, voiceId: string): string => `${actorId}:${voiceId}`;

    const playSampleUrl = async (sampleUrl: string) => {
        if (!sampleUrl) {
            return;
        }

        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }

            const audio = new Audio(sampleUrl);
            audioRef.current = audio;
            await audio.play();
        } catch (error) {
            console.error('Failed to play demo speech sample:', error);
            stage().showPriorityMessage('Unable to play voice sample. Please try again.');
        }
    };

    const handlePlayDemoSpeech = async () => {
        if (isGeneratingDemoSpeech) {
            return;
        }

        const selectedVoiceId = editedActor.voiceId?.trim();
        if (!selectedVoiceId) {
            stage().showPriorityMessage('Please select a voice ID first.');
            return;
        }

        const cacheKey = getVoiceSampleCacheKey(actor.id, selectedVoiceId);
        const cachedSampleUrl = voiceSampleCache.get(cacheKey);
        if (cachedSampleUrl) {
            await playSampleUrl(cachedSampleUrl);
            return;
        }

        setIsGeneratingDemoSpeech(true);
        try {
            const sampleUrl = await generateDemoSpeech(selectedVoiceId, editedActor.profile || actor.profile || actor.name);
            if (!sampleUrl) {
                stage().showPriorityMessage('Voice sample generation returned no audio URL.');
                return;
            }

            voiceSampleCache.set(cacheKey, sampleUrl);
            await playSampleUrl(sampleUrl);
        } catch (error) {
            console.error('Failed to generate demo speech sample:', error);
            stage().showPriorityMessage('Failed to generate voice sample. Please try again.');
        } finally {
            setIsGeneratingDemoSpeech(false);
        }
    };

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
        };
    }, []);

    const handleCloseDetail = () => {
        actor.outfits = initialOutfitsRef.current.map((outfit) => ({
            ...outfit,
            emotionPack: { ...(outfit.emotionPack || {}) },
        }));
        actor.outfitId = initialOutfitIdRef.current;
        onClose();
    };

    const handleSave = () => {
        setIsSaving(true);

        const nextOutfits = editedOutfits.length > 0
            ? editedOutfits
            : [{
                id: generateUuid(),
                name: ORIGINAL_OUTFIT_NAME,
                description: '',
                prompts: {},
                emotionPack: {},
            }];

        // Update the actor in the save
        actor.name = editedActor.name;
        actor.profile = editedActor.profile;
        actor.characterArc = editedActor.characterArc;
        actor.style = editedActor.style;
        actor.voiceId = editedActor.voiceId;
        actor.themeColor = editedActor.themeColor;
        actor.themeFontFamily = editedActor.themeFontFamily;
        actor.locationId = editedActor.locationId;
        actor.outfits = nextOutfits.map((outfit) => ({
            ...outfit,
            prompts: { ...(outfit.prompts || {}) },
            emotionPack: { ...(outfit.emotionPack || {}) },
        }));
        initialOutfitsRef.current = actor.outfits.map((outfit) => ({
            ...outfit,
            prompts: { ...(outfit.prompts || {}) },
            emotionPack: { ...(outfit.emotionPack || {}) },
        }));

        // Save the game
        stage().saveGame();
        
        setTimeout(() => {
            setIsSaving(false);
            onClose();
        }, 500);
    };

    const handleInputChange = (field: string, value: string | number) => {
        setEditedActor(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleOutfitChange = (field: 'name' | 'description', value: string) => {
        if (!selectedOutfitId) return;
        setEditedOutfits((prev) => prev.map((outfit) => (
            outfit.id === selectedOutfitId
                ? { ...outfit, [field]: value }
                : outfit
        )));
    };

    const handleSelectOutfit = (outfitId: string) => {
        setSelectedOutfitId(outfitId);
    };

    const getNextOutfitName = (): string => {
        let nextIndex = editedOutfits.length + 1;
        let candidate = `Outfit ${nextIndex}`;
        const usedNames = new Set(editedOutfits.map((outfit) => outfit.name.toLowerCase()));
        while (usedNames.has(candidate.toLowerCase())) {
            nextIndex += 1;
            candidate = `Outfit ${nextIndex}`;
        }
        return candidate;
    };

    const handleCreateOutfit = () => {
        const newOutfit: Outfit = {
            id: generateUuid(),
            name: getNextOutfitName(),
            description: '',
            prompts: {},
            emotionPack: {},
        };
        setEditedOutfits((prev) => [...prev, newOutfit]);
        setSelectedOutfitId(newOutfit.id);
    };

    // Immediately make the selected outfit the one the character is wearing, and persist it
    // so it isn't reverted when the detail screen closes. Lets the player dress characters between skits.
    const handleWearOutfit = () => {
        if (!selectedOutfit) return;
        actor.outfitId = selectedOutfit.id;
        // Update the ref so handleCloseDetail's revert keeps this choice.
        initialOutfitIdRef.current = selectedOutfit.id;
        stage().saveGame();
        // Force a re-render so the "worn" state (and disabled states) update immediately.
        setSelectedOutfitId(selectedOutfit.id);
        setEditedOutfits((prev) => [...prev]);
    };

    const handleDeleteOutfit = () => {
        if (!selectedOutfit || editedOutfits.length <= 1) {
            return;
        }

        if (selectedOutfit.id === actor.outfitId) {
            console.warn('Cannot delete the actor\'s currently selected outfit.');
            return;
        }

        setConfirmDialog({
            open: true,
            title: `Delete Outfit: ${selectedOutfit.name}`,
            message: 'This will remove the selected outfit and all of its emotion images. This cannot be undone. Continue?',
            actions: [
                {
                    label: 'Delete Outfit',
                    onClick: () => {
                        setConfirmDialog((prev) => ({ ...prev, open: false }));
                        setEditedOutfits((prev) => {
                            const next = prev.filter((outfit) => outfit.id !== selectedOutfit.id);
                            const replacement = next[0]?.id || '';
                            setSelectedOutfitId(replacement);
                            return next;
                        });
                    },
                    variant: 'primary',
                },
            ],
        });
    };

    const handleRegenerateEmotion = async (emotion: Emotion) => {
        if (regeneratingImages.has(emotion)) return;
        
        setConfirmDialog({
            open: true,
            title: `Regenerate ${emotion} Image`,
            message: `This will regenerate the ${emotion} emotion image and replace the existing one. Continue?`,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setRegeneratingImages(prev => new Set(prev).add(emotion));
                
                try {
                    await ensureEmotionPromptForSelectedOutfit(emotion);
                    await generateEmotionImage(actor, emotion, stage(), true, selectedOutfitId);
                    syncEditedOutfitsFromActor();
                    // Force a re-render to show the new image
                    forceUpdate({});
                } catch (error) {
                    console.error(`Failed to regenerate ${emotion} emotion:`, error);
                    stage().showPriorityMessage(`Failed to regenerate ${emotion} emotion. Check console for details.`);
                } finally {
                    setRegeneratingImages(prev => {
                        const next = new Set(prev);
                        next.delete(emotion);
                        return next;
                    });
                }
            }
        });
    };

    const getEmotionPrompt = (emotion: Emotion): string => {
        const outfit = actor.getOutfitById(selectedOutfitId);
        return outfit?.prompts[emotion] || '';
    };

    const persistEmotionPrompt = (emotion: Emotion, prompt: string) => {
        const trimmedPrompt = prompt.trim();

        const outfit = actor.getOutfitById(selectedOutfitId);
        if (outfit) {
            console.log(`Saving prompt for emotion "${emotion}" on outfit "${outfit.name}":`, trimmedPrompt);
            outfit.prompts[emotion] = trimmedPrompt;
            stage().saveGame();
            return true;
        }
        return false;
    };

    const persistOrGenerateEmotionPrompt = async (emotion: Emotion, promptDraft: string): Promise<boolean> => {
        const trimmedPrompt = promptDraft.trim();
        if (trimmedPrompt) {
            return persistEmotionPrompt(emotion, trimmedPrompt);
        }

        const generatedPrompt = (await generateOutfitEmotionPrompt(actor, emotion, stage(), selectedOutfitId)).trim();

        syncEditedOutfitsFromActor();
        setEmotionPromptDraft(generatedPrompt);
        return true;
    };

    const handleOpenImageDialog = (target: ImageTarget) => {
        setImageDialog({ open: true, target });
        if (target === 'base') {
            setBaseRegenSource(actor.avatarImageUrl ? 'avatar' : 'description');
            setEmotionPromptDraft('');
        } else {
            setEmotionPromptDraft(getEmotionPrompt(target));
        }
        setIsImageDropActive(false);
    };

    const persistEmotionPromptDraftForTarget = (target: ImageTarget | null) => {
        if (!target || target === 'base' || !selectedOutfitId) {
            return;
        }

        const trimmedPrompt = emotionPromptDraft.trim();
        setEditedOutfits((prev) => prev.map((outfit) => (
            outfit.id === selectedOutfitId
                ? {
                    ...outfit,
                    prompts: {
                        ...(outfit.prompts || {}),
                        [target]: trimmedPrompt,
                    },
                }
                : outfit
        )));
    };

    const handleCloseImageDialog = () => {
        persistEmotionPromptDraftForTarget(imageDialog.target);
        setImageDialog({ open: false, target: null });
        setIsImageDropActive(false);
    };

    const handleImageFile = async (file: File, target: ImageTarget) => {
        if (!file.type.startsWith('image/')) {
            stage().showPriorityMessage('Please select a valid image file.');
            return;
        }

        if (!selectedOutfitId) {
            stage().showPriorityMessage('Select an outfit before uploading images.');
            return;
        }

        setIsUploadingImage(true);
        try {
            const uploadedUrl = await stage().uploadFile(`${actor.id}-${selectedOutfitId}-${target}.png`, file);
            const nextOutfits = editedOutfits.map((outfit) => (
                outfit.id === selectedOutfitId
                    ? {
                        ...outfit,
                        emotionPack: {
                            ...(outfit.emotionPack || {}),
                            [target]: uploadedUrl,
                        },
                    }
                    : outfit
            ));
            setEditedOutfits(nextOutfits);
            actor.outfits = nextOutfits.map((outfit) => ({
                ...outfit,
                prompts: { ...(outfit.prompts || {}) },
                emotionPack: { ...(outfit.emotionPack || {}) },
            }));
            stage().saveGame();
            forceUpdate({});
        } catch (error) {
            console.error(`Failed to upload ${target} image:`, error);
            stage().showPriorityMessage(`Failed to upload ${target} image. Check console for details.`);
        } finally {
            setIsUploadingImage(false);
            if (imageUploadInputRef.current) {
                imageUploadInputRef.current.value = '';
            }
        }
    };

    const handleRegenerateBase = async (source: BaseRegenSource) => {
        if (regeneratingImages.has('base')) return;

        const hasAvatarUrl = !!actor.avatarImageUrl;
        const sourceOutfitId = source.startsWith('outfit:') ? source.slice('outfit:'.length) : '';
        const sourceOutfit = editedOutfits.find((outfit) => outfit.id === sourceOutfitId);
        const sourceImageUrl = sourceOutfit?.emotionPack?.base || '';
        const selectedLabel = source === 'avatar'
            ? 'Original Avatar'
            : source === 'description'
                ? 'Description Only'
                : `Outfit: ${sourceOutfit?.name || 'Unknown Outfit'}`;

        if (source === 'avatar' && !hasAvatarUrl) {
            stage().showPriorityMessage('Original avatar image is not available for this actor.');
            return;
        }

        if (source.startsWith('outfit:') && !sourceImageUrl) {
            stage().showPriorityMessage('The selected outfit does not have a base image.');
            return;
        }

        const regenerateBase = async () => {
            setConfirmDialog(prev => ({ ...prev, open: false }));
            setRegeneratingImages(prev => new Set(prev).add('base'));
            
            try {
                await generateBaseActorImage(
                    actor,
                    stage(),
                    true,
                    source !== 'description',
                    selectedOutfitId,
                    source.startsWith('outfit:') ? sourceImageUrl : ''
                );
                syncEditedOutfitsFromActor();
                // Force a re-render to show the new image
                forceUpdate({});
            } catch (error) {
                console.error('Failed to regenerate base image:', error);
                stage().showPriorityMessage('Failed to regenerate base image. Check console for details.');
            } finally {
                setRegeneratingImages(prev => {
                    const next = new Set(prev);
                    next.delete('base');
                    return next;
                });
            }
        };

        setConfirmDialog({
            open: true,
            title: 'Regenerate Base Image',
            message: `This will regenerate the base image from ${selectedLabel} and may affect all emotion variations. Continue?`,
            actions: [
                {
                    label: 'Regenerate',
                    onClick: regenerateBase,
                    variant: 'primary'
                }
            ]
        });
    };

    const handleRegenerateDecor = async (moduleType: string) => {
        if (regeneratingImages.has(`decor-${moduleType}`)) return;
        
        setConfirmDialog({
            open: true,
            title: `Regenerate ${moduleType} Decor`,
            message: `This will regenerate the decor image for this ${moduleType} module. Continue?`,
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setRegeneratingImages(prev => new Set(prev).add(`decor-${moduleType}`));
                
                try {
                    // Find the module by type
                    const module = stage().getSave().layout.getModulesWhere((m: any) => m?.type === moduleType)[0];
                    if (!module) {
                        throw new Error(`No module found with type: ${moduleType}`);
                    }
                    
                    await generateActorDecor(actor, module, stage(), true);
                    // Force a re-render to show the new image
                    forceUpdate({});
                } catch (error) {
                    console.error(`Failed to regenerate ${moduleType} decor:`, error);
                    stage().showPriorityMessage(`Failed to regenerate ${moduleType} decor. Check console for details.`);
                } finally {
                    setRegeneratingImages(prev => {
                        const next = new Set(prev);
                        next.delete(`decor-${moduleType}`);
                        return next;
                    });
                }
            }
        });
    };

    // Get all emotions for the grid
    const allEmotions = Object.values(Emotion);
    
    // Get decor images
    const decorImages = Object.entries(actor.decorImageUrls).filter(([_, url]) => url);

    const currentImageUrl = imageDialog.target ? getSelectedOutfitImageUrl(imageDialog.target as Emotion | 'base') : '';
    const isCurrentImageRegenerating = imageDialog.target ? regeneratingImages.has(imageDialog.target) : false;
    const imageTargetLabel = imageDialog.target || '';
    const imageTargetOutfitName = selectedOutfit?.name || 'Outfit';
    const baseRegenOutfitOptions = editedOutfits.filter((outfit) => !!outfit.emotionPack?.base);
    const baseRegenOptions: Array<{ value: BaseRegenSource; label: string }> = [
        ...(actor.avatarImageUrl ? [{ value: 'avatar' as BaseRegenSource, label: 'Original Avatar' }] : []),
        { value: 'description' as BaseRegenSource, label: 'Description Only' },
        ...baseRegenOutfitOptions.map((outfit) => ({
            value: `outfit:${outfit.id}` as BaseRegenSource,
            label: `Outfit: ${outfit.name}`,
        })),
    ];

    // Get all available locations for the dropdown
    const getLocationOptions = (): Array<{ value: string; label: string }> => {
        const save = stage().getSave();
        const options: Array<{ value: string; label: string }> = [];

        // Add all modules with their names
        const allModules = save.layout.getModulesWhere((_: any) => true);
        allModules.forEach((module: any) => {
            if (module && module.id && module.getAttribute('name')) {
                // if module.type is 'quarters', label it as "Quarters: {owner name}" if it has an owner
                if (module.type === 'quarters' && module.ownerId) {
                    const owner = save.actors[module.ownerId];
                    if (owner) {
                        options.push({ value: module.id, label: `Quarters: ${owner.name}` });
                        return;
                    }
                }
                options.push({ value: module.id, label: `Module: ${module.getAttribute('name')}` });
            }
        });

        // Add all factions with their names
        Object.values(save.factions).forEach((faction: any) => {
            if (faction && faction.id && faction.name) {
                options.push({ value: faction.id, label: `Faction: ${faction.name}` });
            }
        });

        // Add special locations
        options.push({ value: 'cryo', label: 'Home' });
        options.push({ value: 'dead', label: 'Dead' });

        return options;
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 10, 20, 0.85)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px',
                }}
                onClick={(e) => {
                    // Close if clicking backdrop
                    // Don't close if user is selecting text
                    const selection = window.getSelection();
                    const hasSelection = selection && selection.toString().length > 0;
                    
                    if (e.target === e.currentTarget && !hasSelection) {
                        handleCloseDetail();
                    }
                }}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 50 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: '90vw',
                        maxWidth: '1400px',
                        maxHeight: '90vh',
                    }}
                >
                    <GlassPanel 
                        variant="bright"
                        style={{
                            height: '90vh',
                            overflow: 'auto',
                            position: 'relative',
                            padding: '30px',
                        }}
                    >
                        {/* Header with close button */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '20px',
                            position: 'sticky',
                            top: 0,
                            background: 'rgba(18, 8, 32, 0.95)',
                            backdropFilter: 'blur(8px)',
                            padding: '10px 0',
                            zIndex: 10,
                        }}>
                            <Title variant="glow" style={{ fontSize: '24px', margin: 0 }}>
                                Actor Details: {editedActor.name}
                            </Title>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Save style={{ fontSize: '20px' }} />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={handleCloseDetail}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(176, 102, 255, 0.7)',
                                        cursor: 'pointer',
                                        fontSize: '24px',
                                        padding: '5px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Close />
                                </motion.button>
                            </div>
                        </div>

                        {/* Form Content */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            
                            {/* Basic Info Section */}
                            <section>
                                <h2 style={{ 
                                    color: '#b066ff', 
                                    fontSize: '18px', 
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px'
                                }}>
                                    Basic Information
                                </h2>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {/* Name */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Name
                                        </label>
                                        <TextInput
                                            fullWidth
                                            value={editedActor.name}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            placeholder="Character name"
                                        />
                                    </div>

                                    {/* Location/State */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Location / State
                                        </label>
                                        <select
                                            value={editedActor.locationId}
                                            onChange={(e) => handleInputChange('locationId', e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                fontSize: '14px',
                                                backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                borderRadius: '5px',
                                                color: '#e0f0ff',
                                                fontFamily: 'inherit',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <option value="">-- Select Location --</option>
                                            {getLocationOptions().map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Profile/Personality */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Personality Profile
                                        </label>
                                        <textarea
                                            value={editedActor.profile}
                                            onChange={(e) => handleInputChange('profile', e.target.value)}
                                            placeholder="Key personality traits and behaviors"
                                            style={{
                                                width: '100%',
                                                minHeight: '100px',
                                                padding: '12px',
                                                fontSize: '14px',
                                                backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                borderRadius: '5px',
                                                color: '#e0f0ff',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                            }}
                                        />
                                    </div>

                                    {/* Character Arc */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Character Arc
                                        </label>
                                        <textarea
                                            value={editedActor.characterArc}
                                            onChange={(e) => handleInputChange('characterArc', e.target.value)}
                                            placeholder="Character arc over this narrative"
                                            style={{
                                                width: '100%',
                                                minHeight: '80px',
                                                padding: '12px',
                                                fontSize: '14px',
                                                backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                borderRadius: '5px',
                                                color: '#e0f0ff',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                            }}
                                        />
                                    </div>

                                    {/* Style */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Style & Aesthetic
                                        </label>
                                        <textarea
                                            value={editedActor.style}
                                            onChange={(e) => handleInputChange('style', e.target.value)}
                                            placeholder="Overall style, mood, interests, or aesthetic for decorating spaces"
                                            style={{
                                                width: '100%',
                                                minHeight: '60px',
                                                padding: '12px',
                                                fontSize: '14px',
                                                backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                borderRadius: '5px',
                                                color: '#e0f0ff',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                            }}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Theme & Voice Section */}
                            <section>
                                <h2 style={{ 
                                    color: '#b066ff', 
                                    fontSize: '18px', 
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px'
                                }}>
                                    Theme & Voice
                                </h2>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    {/* Voice ID */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Voice ID
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                                            <select
                                                value={editedActor.voiceId}
                                                onChange={(e) => handleInputChange('voiceId', e.target.value)}
                                                style={{
                                                    flex: 1,
                                                    padding: '12px',
                                                    fontSize: '14px',
                                                    backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                    border: '2px solid rgba(176, 102, 255, 0.3)',
                                                    borderRadius: '5px',
                                                    color: '#e0f0ff',
                                                    fontFamily: 'inherit',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {Object.entries(VOICE_MAP).map(([id, description]) => (
                                                    <option key={id} value={id}>
                                                        {description}
                                                    </option>
                                                ))}
                                            </select>
                                            <Button
                                                onClick={handlePlayDemoSpeech}
                                                disabled={isGeneratingDemoSpeech || !editedActor.voiceId}
                                                style={{
                                                    alignSelf: 'stretch',
                                                    minWidth: '120px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                }}
                                            >
                                                {isGeneratingDemoSpeech ? (
                                                    <CircularProgress size={14} style={{ color: '#b066ff' }} />
                                                ) : (
                                                    <PlayArrow style={{ fontSize: '18px' }} />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Theme Color */}
                                    <div>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Theme Color
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <TextInput
                                                value={editedActor.themeColor}
                                                onChange={(e) => handleInputChange('themeColor', e.target.value)}
                                                placeholder="#RRGGBB"
                                                style={{ flex: 1 }}
                                            />
                                            <div
                                                style={{
                                                    width: '50px',
                                                    height: '38px',
                                                    backgroundColor: editedActor.themeColor,
                                                    border: '2px solid rgba(176, 102, 255, 0.3)',
                                                    borderRadius: '5px',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Font Family */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label 
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Font Family
                                        </label>
                                        <TextInput
                                            fullWidth
                                            value={editedActor.themeFontFamily}
                                            onChange={(e) => handleInputChange('themeFontFamily', e.target.value)}
                                            placeholder="Font stack (e.g., Arial, sans-serif)"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Stats Section */}
                            <section>
                                <h2 style={{ 
                                    color: '#b066ff', 
                                    fontSize: '18px', 
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px'
                                }}>
                                    Character Stats
                                </h2>
                                
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                                    gap: '15px' 
                                }}>
                                    {Object.values(Stat).map(stat => {
                                        const StatIcon = ACTOR_STAT_ICONS[stat];
                                        return (
                                            <div 
                                                key={stat}
                                                style={{
                                                    backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                    border: '2px solid rgba(176, 102, 255, 0.3)',
                                                    borderRadius: '5px',
                                                    padding: '12px',
                                                }}
                                            >
                                                <div style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between',
                                                    gap: '8px',
                                                    marginBottom: '8px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <StatIcon style={{ color: '#b066ff', fontSize: '20px' }} />
                                                        <span
                                                            style={{
                                                                color: '#b066ff',
                                                                fontSize: '14px',
                                                                fontWeight: 'bold',
                                                                textTransform: 'capitalize',
                                                            }}
                                                        >
                                                            {stat}
                                                        </span>
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: '24px',
                                                            fontWeight: 'bold',
                                                            color: '#b066ff',
                                                        }}
                                                    >
                                                        {scoreToGrade(actor.stats[stat])}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Outfit Section */}
                            <section>
                                <h2 style={{
                                    color: '#b066ff',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px'
                                }}>
                                    Outfit
                                </h2>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '15px' }}>
                                        <div>
                                            <label
                                                style={{
                                                    display: 'block',
                                                    color: '#b066ff',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '8px',
                                                }}
                                            >
                                                Selected Outfit
                                            </label>
                                            <select
                                                value={selectedOutfit?.id || ''}
                                                onChange={(e) => handleSelectOutfit(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    fontSize: '14px',
                                                    backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                    border: '2px solid rgba(176, 102, 255, 0.3)',
                                                    borderRadius: '5px',
                                                    color: '#e0f0ff',
                                                    fontFamily: 'inherit',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {editedOutfits.map((outfit) => (
                                                    <option key={outfit.id} value={outfit.id}>
                                                        {outfit.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label
                                                style={{
                                                    display: 'block',
                                                    color: '#b066ff',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '8px',
                                                }}
                                            >
                                                Outfit Name
                                            </label>
                                            <TextInput
                                                fullWidth
                                                value={selectedOutfit?.name || ''}
                                                onChange={(e) => handleOutfitChange('name', e.target.value)}
                                                placeholder="Outfit name"
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Button onClick={handleCreateOutfit}>
                                            New Outfit
                                        </Button>
                                        <Button
                                            onClick={handleWearOutfit}
                                            disabled={selectedOutfit?.id === actor.outfitId}
                                        >
                                            {selectedOutfit?.id === actor.outfitId ? 'Currently Worn' : 'Wear This Outfit'}
                                        </Button>
                                        <Button
                                            onClick={handleDeleteOutfit}
                                            variant="secondary"
                                            disabled={editedOutfits.length <= 1 || selectedOutfit?.id === actor.outfitId}
                                        >
                                            Delete Outfit
                                        </Button>
                                    </div>

                                    <div>
                                        <label
                                            style={{
                                                display: 'block',
                                                color: '#b066ff',
                                                fontSize: '14px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            Outfit Description
                                        </label>
                                        <textarea
                                            value={selectedOutfit?.description || ''}
                                            onChange={(e) => handleOutfitChange('description', e.target.value)}
                                            placeholder="Physical appearance, attire, and distinguishing features for this outfit"
                                            style={{
                                                width: '100%',
                                                minHeight: '100px',
                                                padding: '12px',
                                                fontSize: '14px',
                                                backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                borderRadius: '5px',
                                                color: '#e0f0ff',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                            }}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Emotion Images Section */}
                            <section>
                                <h2 style={{ 
                                    color: '#b066ff', 
                                    fontSize: '18px', 
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <ImageIcon />
                                    Emotion Images ({selectedOutfit?.name || 'Outfit'})
                                </h2>
                                
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
                                    gap: '15px' 
                                }}>
                                    {/* Base Image */}
                                    <motion.div
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleOpenImageDialog('base')}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '120px',
                                                height: '120px',
                                                backgroundColor: getSelectedOutfitImageUrl('base') ? 'transparent' : 'rgba(18, 8, 32, 0.6)',
                                                border: `2px solid ${getSelectedOutfitImageUrl('base') ? 'rgba(255, 136, 0, 0.5)' : 'rgba(176, 102, 255, 0.2)'}`,
                                                borderRadius: '8px',
                                                backgroundImage: getSelectedOutfitImageUrl('base') ? `url(${getSelectedOutfitImageUrl('base')})` : 'none',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center top',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                position: 'relative',
                                            }}
                                        >
                                            {!getSelectedOutfitImageUrl('base') && (
                                                <div style={{
                                                    color: 'rgba(176, 102, 255, 0.3)',
                                                    fontSize: '12px',
                                                    textAlign: 'center',
                                                    padding: '10px'
                                                }}>
                                                    Not Generated
                                                </div>
                                            )}
                                            {regeneratingImages.has('base') && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#b066ff',
                                                    fontSize: '12px',
                                                }}>
                                                    Generating...
                                                </div>
                                            )}
                                        </div>
                                        <Chip style={{
                                            fontSize: '11px',
                                            textTransform: 'capitalize',
                                            backgroundColor: 'rgba(255, 136, 0, 0.2)',
                                        }}>
                                            Base
                                        </Chip>
                                    </motion.div>

                                    {/* Emotion Images */}
                                    {allEmotions.map(emotion => {
                                        const imageUrl = getSelectedOutfitImageUrl(emotion);
                                        const hasImage = !!imageUrl;
                                        const isRegenerating = regeneratingImages.has(emotion);
                                        
                                        return (
                                            <motion.div
                                                key={emotion}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleOpenImageDialog(emotion)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '120px',
                                                        height: '120px',
                                                        backgroundColor: hasImage ? 'transparent' : 'rgba(18, 8, 32, 0.6)',
                                                        border: `2px solid ${hasImage ? 'rgba(176, 102, 255, 0.5)' : 'rgba(176, 102, 255, 0.2)'}`,
                                                        borderRadius: '8px',
                                                        backgroundImage: hasImage ? `url(${imageUrl})` : 'none',
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center top',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        overflow: 'hidden',
                                                        position: 'relative',
                                                    }}
                                                >
                                                    {!hasImage && (
                                                        <div style={{
                                                            color: 'rgba(176, 102, 255, 0.3)',
                                                            fontSize: '12px',
                                                            textAlign: 'center',
                                                            padding: '10px'
                                                        }}>
                                                            Not Generated
                                                        </div>
                                                    )}
                                                    {isRegenerating && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            right: 0,
                                                            bottom: 0,
                                                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#b066ff',
                                                            fontSize: '12px',
                                                        }}>
                                                            Generating...
                                                        </div>
                                                    )}
                                                </div>
                                                <Chip style={{
                                                    fontSize: '11px',
                                                    textTransform: 'capitalize',
                                                    backgroundColor: hasImage ? 'rgba(176, 102, 255, 0.2)' : 'rgba(18, 8, 32, 0.6)',
                                                }}>
                                                    {emotion}
                                                </Chip>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Decor Images Section */}
                            {decorImages.length > 0 && (
                                <section>
                                    <h2 style={{ 
                                        color: '#b066ff', 
                                        fontSize: '18px', 
                                        fontWeight: 'bold',
                                        marginBottom: '15px',
                                        borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                        paddingBottom: '5px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <ImageIcon />
                                        Module Decor Images
                                    </h2>
                                    
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                                        gap: '15px' 
                                    }}>
                                        {decorImages.map(([moduleType, imageUrl]) => {
                                            const isRegenerating = regeneratingImages.has(`decor-${moduleType}`);
                                            return (
                                                <motion.div
                                                    key={moduleType}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleRegenerateDecor(moduleType)}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: '200px',
                                                            height: '150px',
                                                            backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                            border: '2px solid rgba(176, 102, 255, 0.5)',
                                                            borderRadius: '8px',
                                                            backgroundImage: `url(${imageUrl})`,
                                                            backgroundSize: 'cover',
                                                            backgroundPosition: 'center',
                                                            overflow: 'hidden',
                                                            position: 'relative',
                                                        }}
                                                    >
                                                        {isRegenerating && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: 0,
                                                                left: 0,
                                                                right: 0,
                                                                bottom: 0,
                                                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: '#b066ff',
                                                                fontSize: '12px',
                                                            }}>
                                                                Generating...
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Chip style={{
                                                        fontSize: '11px',
                                                        textTransform: 'capitalize',
                                                    }}>
                                                        {moduleType}
                                                    </Chip>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Read-only Info Section */}
                            <section>
                                <h2 style={{ 
                                    color: '#b066ff', 
                                    fontSize: '18px', 
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                    paddingBottom: '5px'
                                }}>
                                    Additional Information
                                </h2>
                                
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                                    gap: '15px',
                                    backgroundColor: 'rgba(18, 8, 32, 0.4)',
                                    padding: '15px',
                                    borderRadius: '5px',
                                    border: '1px solid rgba(176, 102, 255, 0.2)',
                                }}>
                                    <div>
                                        <div style={{ color: 'rgba(176, 102, 255, 0.7)', fontSize: '12px', marginBottom: '4px' }}>
                                            Actor ID
                                        </div>
                                        <div style={{ color: '#e0f0ff', fontSize: '14px', fontFamily: 'monospace' }}>
                                            {actor.id}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'rgba(176, 102, 255, 0.7)', fontSize: '12px', marginBottom: '4px' }}>
                                            Participations
                                        </div>
                                        <div style={{ color: '#e0f0ff', fontSize: '14px' }}>
                                            {actor.participations}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'rgba(176, 102, 255, 0.7)', fontSize: '12px', marginBottom: '4px' }}>
                                            Origin
                                        </div>
                                        <div style={{ color: '#e0f0ff', fontSize: '14px', textTransform: 'capitalize' }}>
                                            {actor.origin}
                                        </div>
                                    </div>
                                    {actor.fullPath && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <div style={{ color: 'rgba(176, 102, 255, 0.7)', fontSize: '12px', marginBottom: '4px' }}>
                                                Source Path
                                            </div>
                                            <div style={{ 
                                                color: '#e0f0ff', 
                                                fontSize: '12px', 
                                                fontFamily: 'monospace',
                                                wordBreak: 'break-all'
                                            }}>
                                                {actor.fullPath}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                        </div>
                    </GlassPanel>
                </motion.div>
            </motion.div>

            {/* Confirmation Dialog */}
            <Dialog
                open={imageDialog.open}
                onClose={handleCloseImageDialog}
                slotProps={{
                    paper: {
                        style: {
                            backgroundColor: 'rgba(18, 8, 32, 0.95)',
                            backdropFilter: 'blur(10px)',
                            border: '2px solid rgba(176, 102, 255, 0.3)',
                            borderRadius: '8px',
                            color: '#e0f0ff',
                            minWidth: '700px',
                            maxWidth: '900px',
                        }
                    }
                }}
            >
                <DialogTitle style={{
                    color: '#b066ff',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                    paddingBottom: '10px',
                    textTransform: 'capitalize',
                }}>
                    Manage {imageTargetLabel} Image - {imageTargetOutfitName}
                </DialogTitle>
                <DialogContent style={{ paddingTop: '20px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '20px',
                        alignItems: 'stretch'
                    }}>
                        <div style={{ display: 'flex' }}>
                            <input
                                ref={imageUploadInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const target = imageDialog.target;
                                    const file = e.target.files?.[0];
                                    if (!target || !file) return;
                                    handleImageFile(file, target);
                                }}
                            />
                            <div
                                onClick={() => imageUploadInputRef.current?.click()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsImageDropActive(true);
                                }}
                                onDragEnter={(e) => {
                                    e.preventDefault();
                                    setIsImageDropActive(true);
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    setIsImageDropActive(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsImageDropActive(false);
                                    const target = imageDialog.target;
                                    const file = e.dataTransfer.files?.[0];
                                    if (!target || !file) return;
                                    handleImageFile(file, target);
                                }}
                                style={{
                                    width: '100%',
                                    minHeight: '360px',
                                    height: '100%',
                                    backgroundColor: currentImageUrl ? 'transparent' : 'rgba(18, 8, 32, 0.6)',
                                    border: `2px dashed ${isImageDropActive ? 'rgba(176, 102, 255, 0.8)' : 'rgba(176, 102, 255, 0.35)'}`,
                                    borderRadius: '8px',
                                    backgroundImage: currentImageUrl ? `url(${currentImageUrl})` : 'none',
                                    backgroundSize: 'contain',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                {!currentImageUrl && (
                                    <div style={{
                                        color: 'rgba(176, 102, 255, 0.5)',
                                        fontSize: '14px',
                                        textAlign: 'center',
                                        padding: '16px',
                                        lineHeight: 1.5,
                                    }}>
                                        Click to upload image
                                        <br />
                                        or drag and drop here
                                    </div>
                                )}

                                {isImageDropActive && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: 'rgba(176, 102, 255, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#b066ff',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                    }}>
                                        Drop to Replace
                                    </div>
                                )}

                                {isUploadingImage && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#b066ff',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                    }}>
                                        Uploading...
                                    </div>
                                )}

                                {isCurrentImageRegenerating && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#b066ff',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                    }}>
                                        Generating...
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '360px' }}>
                            <div style={{
                                color: '#e0f0ff',
                                fontSize: '14px',
                                lineHeight: 1.6,
                            }}>
                                Click the image area to select a file, or drag and drop an image to replace the current {String(imageTargetLabel).toLowerCase()} image for {imageTargetOutfitName}.
                            </div>
                            {imageDialog.target === 'base' && (
                                <div>
                                    <label
                                        style={{
                                            display: 'block',
                                            color: '#b066ff',
                                            fontSize: '13px',
                                            fontWeight: 'bold',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        Regenerate Source
                                    </label>
                                    <select
                                        value={baseRegenSource}
                                        onChange={(e) => setBaseRegenSource(e.target.value as BaseRegenSource)}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            fontSize: '14px',
                                            backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                            border: '2px solid rgba(176, 102, 255, 0.3)',
                                            borderRadius: '5px',
                                            color: '#e0f0ff',
                                            fontFamily: 'inherit',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {baseRegenOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {imageDialog.target && imageDialog.target !== 'base' && (
                                <div>
                                    <label
                                        style={{
                                            display: 'block',
                                            color: '#b066ff',
                                            fontSize: '13px',
                                            fontWeight: 'bold',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        Emotion Prompt
                                    </label>
                                    <textarea
                                        value={emotionPromptDraft}
                                        onChange={(e) => setEmotionPromptDraft(e.target.value)}
                                        placeholder="Give this character ..."
                                        style={{
                                            width: '100%',
                                            minHeight: '120px',
                                            padding: '12px',
                                            fontSize: '13px',
                                            backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                            border: '2px solid rgba(176, 102, 255, 0.3)',
                                            borderRadius: '5px',
                                            color: '#e0f0ff',
                                            fontFamily: 'inherit',
                                            resize: 'vertical',
                                            lineHeight: 1.5,
                                        }}
                                    />
                                </div>
                            )}
                            <Button
                                onClick={async () => {
                                    const target = imageDialog.target;
                                    if (!target) return;
                                    if (target === 'base') {
                                        handleRegenerateBase(baseRegenSource);
                                    } else {
                                        if (!await persistOrGenerateEmotionPrompt(target, emotionPromptDraft)) {
                                            return;
                                        }
                                        handleRegenerateEmotion(target);
                                    }
                                }}
                                disabled={!imageDialog.target || isCurrentImageRegenerating}
                                style={{ alignSelf: 'flex-start' }}
                            >
                                {isCurrentImageRegenerating ? 'Generating...' : 'Regenerate Image'}
                            </Button>
                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                                <Button onClick={handleCloseImageDialog} variant="secondary">
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
                slotProps={{
                    paper: {
                        style: {
                            backgroundColor: 'rgba(18, 8, 32, 0.95)',
                            backdropFilter: 'blur(10px)',
                            border: '2px solid rgba(176, 102, 255, 0.3)',
                            borderRadius: '8px',
                            color: '#e0f0ff',
                            minWidth: '400px',
                        }
                    }
                }}
            >
                <DialogTitle style={{
                    color: '#b066ff',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                    paddingBottom: '10px',
                }}>
                    {confirmDialog.title}
                </DialogTitle>
                <DialogContent style={{ paddingTop: '20px' }}>
                    <div style={{
                        color: '#e0f0ff',
                        fontSize: '14px',
                        lineHeight: '1.6',
                    }}>
                        {confirmDialog.message}
                    </div>
                </DialogContent>
                <DialogActions style={{ padding: '15px 20px', display: 'flex', gap: '10px' }}>
                    <Button
                        onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                    {confirmDialog.actions ? (
                        confirmDialog.actions.map((action, index) => (
                            <Button
                                key={index}
                                onClick={action.onClick}
                                variant={action.variant || 'primary'}
                            >
                                {action.label}
                            </Button>
                        ))
                    ) : (
                        <Button
                            onClick={confirmDialog.onConfirm}
                            variant="primary"
                        >
                            Regenerate
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </AnimatePresence>
    );
};
