import React, { FC, useState } from 'react';
import { createModule, DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT } from '../Module';
import { motion, AnimatePresence } from 'framer-motion';
import { Stage } from '../Stage';
import { GlassPanel, Title, Button, TextInput } from '../components/UIComponents';
import { Close } from '@mui/icons-material';
import { ArtStyle } from '../actors/Actor';

interface SettingsScreenProps {
    stage: () => Stage;
    onCancel: () => void;
    onConfirm: () => void;
    isNewGame?: boolean;
}

interface SettingsData {
    playerName: string;
    playerDescription: string;
    aideName: string;
    aideDescription: string;
    directorModuleName: string;
    directorModuleRoleName: string;
    disableTextToSpeech: boolean;
    disableEmotionImages: boolean;
    disableDecorImages: boolean;
    disableImpersonation: boolean;
    solidSpirit: boolean;
    fastStart: boolean;
    typeOutSpeed: number;
    characterArtStyle: ArtStyle;
    characterArtist: string;
    tagToggles: { [key: string]: boolean };
    writeInTags: string[]; // write-in banned tags (not part of tagMap)
    language: string;
    tone: string;
}

export const SettingsScreen: FC<SettingsScreenProps> = ({ stage, onCancel, onConfirm, isNewGame = false }) => {
    const CUSTOM_TONE_KEY = 'Custom';
    const minTypeOutSpeed = 0;
    const maxTypeOutSpeed = 50;
    const defaultTypeOutSpeed = stage().DEFAULT_TYPE_OUT_SPEED;

    const clampTypeOutSpeed = (value: number) => {
        if (Number.isNaN(value)) {
            return defaultTypeOutSpeed;
        }
        return Math.min(maxTypeOutSpeed, Math.max(minTypeOutSpeed, value));
    };

    // Common languages for autocomplete
    const commonLanguages = [
        'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Japanese',
        'Korean', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Arabic', 'Hindi', 'Bengali',
        'Urdu', 'Indonesian', 'Turkish', 'Vietnamese', 'Thai', 'Polish', 'Dutch', 'Swedish',
        'Norwegian', 'Danish', 'Finnish', 'Greek', 'Hebrew', 'Czech', 'Hungarian', 'Romanian',
        'Ukrainian', 'Catalan', 'Serbian', 'Croatian', 'Bulgarian', 'Slovak', 'Lithuanian',
        'Latvian', 'Estonian', 'Slovenian', 'Malay', 'Tagalog', 'Swahili', 'Afrikaans', 'Catalan'
    ];

    // Each toggle can map to multiple tags when saved.
    const tagMap: { [key: string]: string[] } = {
        'NSFW': ['NSFW', 'Explicit'],
        'Male': ['Male', 'Boy', 'Man'],
        'Female': ['Female', 'Girl', 'Woman'],
        'Transgender': ['Trans', 'Transgender', 'Transexual','Transfem','Transmasc'],
        'Futanari': ['Futanari', 'Futa'],
        'Bisexual': ['Bisexual', 'Bi'],
        'Gay': ['Gay'],
        'Lesbian': ['Lesbian'],
        'Asexual': ['Asexual', 'Ace'],
        'Human': ['Human'],
        'Non-Human': ['Non-Human'],
        'Anthro': ['Anthro', 'Furry'],
        'Robot': ['Robot', 'Android', 'Cyborg'],
        'Elf': ['Elf', 'Elven', 'Dark Elf'],
        'Monster': ['Monster', 'Beast', 'Creature', 'Monstergirl'],
        'Anime': ['Anime', 'Manga', 'Cartoon'],
        'Movies & TV': ['Movies & TV', 'Film', 'Television', 'Series'],
        'Game Character': ['Game Character', 'Video Game', 'games', 'game', 'videogames'],
        'Original Character': ['Original Character', 'OC', 'Original'],
        'Tsundere': ['Tsundere'],
        'Yandere': ['Yandere'],
        'Submissive': ['Submissive', 'Sub'],
        'Dominant': ['Dominant', 'Dom'],
        'Sadistic': ['Sadistic', 'Sadism'],
        'Masochistic': ['Masochistic', 'Masochism'],
        'BDSM': ['BDSM', 'Bondage', 'Discipline'],
        'Tomboy': ['Tomboy'],
        'Femboy': ['Femboy'],
        'Goth': ['Goth'],
        'MILF': ['MILF', 'mother', 'mom', 'mommy'],
        'Petite': ['Petite'],
        'Chubby': ['Chubby', 'Fat'],
        'Muscular': ['Muscular'],
        'Giant': ['Giant', 'Giantess'],
        'Size Difference': ['Size Difference'],
        'Fantasy': ['Fantasy'],
        'Sci-Fi': ['Sci-Fi', 'Science Fiction'],
        'Romance': ['Romance', 'Love', 'Drama']
    }

    // Build initial tag toggles and write-in tags from save
    const saveFromStage = stage().getSave();
    const toneMap = stage().TONE_MAP;
    const toneEntries = Object.entries(toneMap);

    const getTonePresetFromValue = (toneValue?: string): string => {
        if (!toneValue) {
            return 'Original';
        }

        const match = toneEntries.find(([, value]) => value === toneValue);
        return match ? match[0] : CUSTOM_TONE_KEY;
    };

    const initialTonePreset = getTonePresetFromValue(saveFromStage.tone);
    const initialTone = saveFromStage.tone || toneMap['Original'];

    const initialTagToggles = Object.keys(tagMap).reduce((acc, key) => ({ ...acc, [key]: true }), {} as { [key: string]: boolean });
    const initialWriteIns: string[] = [];

    if (saveFromStage?.bannedTags && Array.isArray(saveFromStage.bannedTags)) {
        for (const banned of saveFromStage.bannedTags) {
            let matched = false;
            for (const [key, arr] of Object.entries(tagMap)) {
                if (arr.includes(banned)) {
                    initialTagToggles[key] = false; // ban the mapped key
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // This is a write-in tag that doesn't match any mapped tags
                initialWriteIns.push(banned);
            }
        }
    }

    // Load existing settings or use defaults
    const [settings, setSettings] = useState<SettingsData>({
        playerName: saveFromStage.player?.name || 'Magus',
        playerDescription: saveFromStage.player?.description || 'The Spire\'s accidental Magus is the tower\'s sole living authority.',
        aideName: saveFromStage.aide?.name || 'Soji',
        aideDescription: saveFromStage.aide?.description ||
            (`Every respectable tower comes haunted, and the Spire is no exception! Your resident tower spirit has been bound to these stones since long before your arrival and knows the Spire's workings intimately, so you don't have to. ` +
            `Fair warning: two centuries of empty halls have left them a touch capricious - expect teasing, dramatics, and open delight in your confusion, as your suffering is (by their own cheerful admission) the finest entertainment they've had in two hundred years. ` +
            `Rest assured the binding compels honest service no matter how they grumble, and those who earn their trust report the needling softens into something almost like fondness.\n\n` +
            `The Tower Spirit. "Your suffering entertains me, mortal."`),
        directorModuleName: saveFromStage.directorModule?.name || 'Magus\'s Study',
        directorModuleRoleName: saveFromStage.directorModule?.roleName || 'Maid',
        disableTextToSpeech: saveFromStage.disableTextToSpeech ?? false,
        disableEmotionImages: saveFromStage.disableEmotionImages ?? false,
        disableDecorImages: saveFromStage.disableDecorImages ?? saveFromStage.disableEmotionImages ?? false,
        disableImpersonation: saveFromStage.disableImpersonation ?? false,
        solidSpirit: saveFromStage.solidSpirit ?? false,
        fastStart: false,
        typeOutSpeed: clampTypeOutSpeed(saveFromStage.typeOutSpeed ?? defaultTypeOutSpeed),
        characterArtStyle: saveFromStage.characterArtStyle ?? 'original',
        characterArtist: saveFromStage.characterArtist ?? '',
        language: saveFromStage.language || 'English',
        tone: initialTone,
        // Tag toggles; disabling these can be used to filter undesired content. Load from save array, if one. Otherwise, default to true.
        tagToggles: initialTagToggles,
        writeInTags: initialWriteIns
    });
    const [selectedTonePreset, setSelectedTonePreset] = useState<string>(initialTonePreset);

    const [languageSuggestions, setLanguageSuggestions] = useState<string[]>([]);
    const [showLanguageSuggestions, setShowLanguageSuggestions] = useState(false);

    // new-writein input
    const [newWriteIn, setNewWriteIn] = useState('');

    const placeFastStartRooms = () => {
        const save = stage().getSave();
        // Place adjacent to the starting cluster in the known-free column (x=5, rows 1-3).
        const placements: { type: string; x: number; y: number }[] = [
            { type: 'commons', x: 5, y: 1 },   // Great Hall
            { type: 'lounge',  x: 5, y: 2 },   // Parlor
            { type: 'aperture', x: 5, y: 3 },  // Arcane Focus
        ];
        for (const p of placements) {
            if (save.layout.getModulesWhere(m => m.type === p.type).length > 0) continue;
            if (save.layout.getModuleAt(p.x, p.y)) continue; // don't overwrite anything
            save.layout.setModuleAt(p.x, p.y, createModule(p.type, { id: `${p.type}-fast-${p.x}-${p.y}`, attributes: {} }));
        }
    };

    const handleSave = () => {
        console.log('Saving settings:', settings);
        
        if (isNewGame) {
            stage().newGame();
            if (settings.fastStart) {
                placeFastStartRooms();
            }
        }
        const save = stage().getSave();
        save.player.name = settings.playerName;
        save.player.description = settings.playerDescription;
        save.aide.name = settings.aideName;
        save.aide.description = settings.aideDescription;
        save.directorModule = save.directorModule || {};
        save.directorModule.name = settings.directorModuleName;
        save.directorModule.roleName = settings.directorModuleRoleName;

        // Build bannedTags from toggles (mapped arrays) and write-in tags, deduplicated
        const mappedBans = Object.keys(settings.tagToggles)
            .filter(key => !settings.tagToggles[key])
            .map(key => tagMap[key] ? tagMap[key] : [key])
            .flat();

        const writeIns = settings.writeInTags ? settings.writeInTags.filter(Boolean) : [];

        save.bannedTags = Array.from(new Set([...mappedBans, ...writeIns]));
        save.disableTextToSpeech = settings.disableTextToSpeech;
        save.disableEmotionImages = settings.disableEmotionImages;
        save.disableDecorImages = settings.disableDecorImages;
        save.disableImpersonation = settings.disableImpersonation;
        save.solidSpirit = settings.solidSpirit;
        save.typeOutSpeed = clampTypeOutSpeed(settings.typeOutSpeed);
        save.characterArtStyle = settings.characterArtStyle;
        save.characterArtist = settings.characterArtist;
        save.language = settings.language;
        save.tone = settings.tone;

        stage().saveGame();
        onConfirm();
    };

    const handleToggle = (key: string) => {
        setSettings(prev => ({
            ...prev,
            tagToggles: {
                ...prev.tagToggles,
                [key]: !prev.tagToggles[key]
            }
        }));
    };

    const handleInputChange = (field: keyof SettingsData, value: string) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleLanguageChange = (value: string) => {
        setSettings(prev => ({ ...prev, language: value }));
        
        // Filter and update suggestions
        if (value.trim()) {
            const filtered = commonLanguages.filter(lang => 
                lang.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 8); // Limit to 8 suggestions
            setLanguageSuggestions(filtered);
            setShowLanguageSuggestions(filtered.length > 0);
        } else {
            setLanguageSuggestions([]);
            setShowLanguageSuggestions(false);
        }
    };

    const selectLanguage = (language: string) => {
        setSettings(prev => ({ ...prev, language }));
        setShowLanguageSuggestions(false);
    };

    const handleTonePresetChange = (preset: string) => {
        setSelectedTonePreset(preset);

        if (preset !== CUSTOM_TONE_KEY && toneMap[preset]) {
            setSettings(prev => ({ ...prev, tone: toneMap[preset] }));
        }
    };

    const handleToneChange = (tone: string) => {
        setSelectedTonePreset(CUSTOM_TONE_KEY);
        setSettings(prev => ({ ...prev, tone }));
    };

    // Write-in handlers
    const addWriteInTag = (tag: string) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        // don't add duplicates (either existing writeIns or tags covered by tagMap)
        const already = settings.writeInTags.some(t => t.toLowerCase() === trimmed.toLowerCase());
        const coveredByMap = Object.values(tagMap).some(arr => arr.some(v => v.toLowerCase() === trimmed.toLowerCase()));
        if (already || coveredByMap) {
            setNewWriteIn('');
            return;
        }
        setSettings(prev => ({ ...prev, writeInTags: [...prev.writeInTags, trimmed] }));
        setNewWriteIn('');
    };

    const updateWriteInTag = (index: number, value: string) => {
        const trimmed = value; // allow editing; handle empty removal on blur elsewhere
        setSettings(prev => ({ ...prev, writeInTags: prev.writeInTags.map((t, i) => i === index ? trimmed : t) }));
    };

    const removeWriteInTag = (index: number) => {
        setSettings(prev => ({ ...prev, writeInTags: prev.writeInTags.filter((_, i) => i !== index) }));
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
                    // Close if clicking backdrop (but not during new game setup)
                    // Don't close if user is selecting text
                    const selection = window.getSelection();
                    const hasSelection = selection && selection.toString().length > 0;
                    
                    if (e.target === e.currentTarget && !isNewGame && !hasSelection) {
                        onCancel();
                    }
                }}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 50 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <GlassPanel 
                        variant="bright"
                        style={{
                            width: '80vw',
                            maxHeight: '85vh',
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
                            marginBottom: '20px'
                        }}>
                            <Title variant="glow" style={{ fontSize: '24px', margin: 0 }}>
                                {isNewGame ? 'New Game Setup' : 'Settings'}
                            </Title>
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={onCancel}
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

                        {/* Settings Form */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Player Name */}
                            <div>
                                <label 
                                    htmlFor="player-name"
                                    style={{
                                        display: 'block',
                                        color: '#b066ff',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        marginBottom: '8px',
                                    }}
                                >
                                    Player Name
                                </label>
                                <TextInput
                                    id="player-name"
                                    fullWidth
                                    value={settings.playerName}
                                    onChange={(e) => handleInputChange('playerName', e.target.value)}
                                    placeholder="Enter your name"
                                    style={{ fontSize: '16px' }}
                                />
                            </div>

                            {/* Player Description */}
                            <div>
                                <label 
                                    htmlFor="player-description"
                                    style={{
                                        display: 'block',
                                        color: '#b066ff',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        marginBottom: '8px',
                                    }}
                                >
                                    Player Description
                                </label>
                                <textarea
                                    id="player-description"
                                    className="text-input-primary"
                                    value={settings.playerDescription}
                                    onChange={(e) => handleInputChange('playerDescription', e.target.value)}
                                    placeholder="Describe your character..."
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        fontSize: '14px',
                                        resize: 'vertical',
                                    }}
                                />
                            </div>

                            {/* Tower Spirit Name */}
                            {isNewGame && (
                                <div>
                                    <label 
                                        htmlFor="aide-name"
                                        style={{
                                            display: 'block',
                                            color: '#b066ff',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        Tower Spirit Name
                                    </label>
                                    <TextInput
                                        id="aide-name"
                                        fullWidth
                                        value={settings.aideName}
                                        onChange={(e) => handleInputChange('aideName', e.target.value)}
                                        placeholder="Enter Tower Spirit name"
                                        style={{ fontSize: '16px' }}
                                    />
                                </div>
                            )}

                            {/* Tower Spirit Description */}
                            {isNewGame && (
                                <div>
                                    <label 
                                        htmlFor="aide-description"
                                        style={{
                                            display: 'block',
                                            color: '#b066ff',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        Tower Spirit Description
                                    </label>
                                    <textarea
                                        id="aide-description"
                                        className="text-input-primary"
                                        value={settings.aideDescription}
                                        onChange={(e) => handleInputChange('aideDescription', e.target.value)}
                                        placeholder="Describe your Tower Spirit..."
                                        rows={4}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            fontSize: '14px',
                                            resize: 'vertical',
                                        }}
                                    />
                                </div>
                            )}
                            
                            {/* Magus's Room Name */}
                            {isNewGame && (
                                <div>
                                    <label 
                                        htmlFor="director-module-name"
                                        style={{
                                            display: 'block',
                                            color: '#b066ff',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        Magus's Room Name
                                    </label>
                                    <TextInput
                                        id="director-module-name"
                                        fullWidth
                                        value={settings.directorModuleName}
                                        onChange={(e) => handleInputChange('directorModuleName', e.target.value)}
                                        placeholder="Enter Magus's Room Name"
                                        style={{ fontSize: '16px' }}
                                    />
                                </div>
                            )}
                            {/* Magus's Room Job Title */}
                            {isNewGame && (
                                <div>
                                    <label 
                                        htmlFor="director-room-role-name"
                                        style={{
                                            display: 'block',
                                            color: '#b066ff',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        Magus's Room Job Title (a resident-assignable role)
                                    </label>
                                    <TextInput
                                        id="director-module-role-name"
                                        fullWidth
                                        value={settings.directorModuleRoleName}
                                        onChange={(e) => handleInputChange('directorModuleRoleName', e.target.value)}
                                        placeholder="Enter Magus's Room Job Title"
                                        style={{ fontSize: '16px' }}
                                    />
                                </div>
                            )}

                            {/* Generation Settings */}
                            <div>
                                <label 
                                    style={{
                                        display: 'block',
                                        color: '#b066ff',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        marginBottom: '12px',
                                    }}
                                >
                                    Generation Settings
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* Disable Text to Speech Toggle */}
                                    <motion.div
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setSettings(prev => ({ ...prev, disableTextToSpeech: !prev.disableTextToSpeech }))}
                                        style={{
                                            padding: '12px',
                                            background: settings.disableTextToSpeech
                                                ? 'rgba(176, 102, 255, 0.15)'
                                                : 'rgba(18, 8, 32, 0.7)',
                                            border: settings.disableTextToSpeech
                                                ? '2px solid rgba(176, 102, 255, 0.5)'
                                                : '2px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: settings.disableTextToSpeech ? '#b066ff' : 'rgba(255, 255, 255, 0.1)',
                                                border: '2px solid ' + (settings.disableTextToSpeech ? '#b066ff' : 'rgba(255, 255, 255, 0.3)'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {settings.disableTextToSpeech && (
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    style={{
                                                        color: '#1a0533',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    ✓
                                                </motion.span>
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                color: settings.disableTextToSpeech ? '#b066ff' : 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '13px',
                                                fontWeight: settings.disableTextToSpeech ? 'bold' : 'normal',
                                            }}
                                        >
                                            Disable Text to Speech
                                        </span>
                                    </motion.div>

                                    {/* Disable Emotion Images Toggle */}
                                    <motion.div
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setSettings(prev => ({ ...prev, disableEmotionImages: !prev.disableEmotionImages }))}
                                        style={{
                                            padding: '12px',
                                            background: settings.disableEmotionImages
                                                ? 'rgba(176, 102, 255, 0.15)'
                                                : 'rgba(18, 8, 32, 0.7)',
                                            border: settings.disableEmotionImages
                                                ? '2px solid rgba(176, 102, 255, 0.5)'
                                                : '2px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: settings.disableEmotionImages ? '#b066ff' : 'rgba(255, 255, 255, 0.1)',
                                                border: '2px solid ' + (settings.disableEmotionImages ? '#b066ff' : 'rgba(255, 255, 255, 0.3)'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {settings.disableEmotionImages && (
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    style={{
                                                        color: '#1a0533',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    ✓
                                                </motion.span>
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                color: settings.disableEmotionImages ? '#b066ff' : 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '13px',
                                                fontWeight: settings.disableEmotionImages ? 'bold' : 'normal',
                                            }}
                                        >
                                            Disable Emotion Images
                                        </span>
                                    </motion.div>

                                    {/* Disable Decor Images Toggle */}
                                    <motion.div
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setSettings(prev => ({ ...prev, disableDecorImages: !prev.disableDecorImages }))}
                                        style={{
                                            padding: '12px',
                                            background: settings.disableDecorImages
                                                ? 'rgba(176, 102, 255, 0.15)'
                                                : 'rgba(18, 8, 32, 0.7)',
                                            border: settings.disableDecorImages
                                                ? '2px solid rgba(176, 102, 255, 0.5)'
                                                : '2px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: settings.disableDecorImages ? '#b066ff' : 'rgba(255, 255, 255, 0.1)',
                                                border: '2px solid ' + (settings.disableDecorImages ? '#b066ff' : 'rgba(255, 255, 255, 0.3)'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {settings.disableDecorImages && (
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    style={{
                                                        color: '#1a0533',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    ✓
                                                </motion.span>
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                color: settings.disableDecorImages ? '#b066ff' : 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '13px',
                                                fontWeight: settings.disableDecorImages ? 'bold' : 'normal',
                                            }}
                                        >
                                            Disable Decor Images
                                        </span>
                                    </motion.div>

                                    {/* Disable Impersonation Toggle */}
                                    <motion.div
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setSettings(prev => ({ ...prev, disableImpersonation: !prev.disableImpersonation }))}
                                        style={{
                                            padding: '12px',
                                            background: settings.disableImpersonation
                                                ? 'rgba(176, 102, 255, 0.15)'
                                                : 'rgba(18, 8, 32, 0.7)',
                                            border: settings.disableImpersonation
                                                ? '2px solid rgba(176, 102, 255, 0.5)'
                                                : '2px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: settings.disableImpersonation ? '#b066ff' : 'rgba(255, 255, 255, 0.1)',
                                                border: '2px solid ' + (settings.disableImpersonation ? '#b066ff' : 'rgba(255, 255, 255, 0.3)'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {settings.disableImpersonation && (
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    style={{
                                                        color: '#1a0533',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    ✓
                                                </motion.span>
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                color: settings.disableImpersonation ? '#b066ff' : 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '13px',
                                                fontWeight: settings.disableImpersonation ? 'bold' : 'normal',
                                            }}
                                        >
                                            Disable Impersonation
                                        </span>
                                    </motion.div>

                                    {/* Solid Spirit Toggle */}
                                    <motion.div
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setSettings(prev => ({ ...prev, solidSpirit: !prev.solidSpirit }))}
                                        style={{
                                            padding: '12px',
                                            background: settings.solidSpirit
                                                ? 'rgba(176, 102, 255, 0.15)'
                                                : 'rgba(18, 8, 32, 0.7)',
                                            border: settings.solidSpirit
                                                ? '2px solid rgba(176, 102, 255, 0.5)'
                                                : '2px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: settings.solidSpirit ? '#b066ff' : 'rgba(255, 255, 255, 0.1)',
                                                border: '2px solid ' + (settings.solidSpirit ? '#b066ff' : 'rgba(255, 255, 255, 0.3)'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {settings.solidSpirit && (
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    style={{
                                                        color: '#1a0533',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    ✓
                                                </motion.span>
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                color: settings.solidSpirit ? '#b066ff' : 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '13px',
                                                fontWeight: settings.solidSpirit ? 'bold' : 'normal',
                                            }}
                                        >
                                            Solid Spirit (No Ghostly Effect)
                                        </span>
                                    </motion.div>

                                    {/* Fast Start (new game only, one-way lock once checked) */}
                                    {isNewGame && (
                                    <motion.div
                                        whileHover={!settings.fastStart ? { scale: 1.01 } : undefined}
                                        whileTap={!settings.fastStart ? { scale: 0.99 } : undefined}
                                        onClick={() => { if (!settings.fastStart) setSettings(prev => ({ ...prev, fastStart: true })); }}
                                        style={{
                                            padding: '12px',
                                            background: settings.fastStart ? 'rgba(176, 102, 255, 0.15)' : 'rgba(18, 8, 32, 0.7)',
                                            border: settings.fastStart ? '2px solid rgba(176, 102, 255, 0.5)' : '2px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            cursor: settings.fastStart ? 'default' : 'pointer',
                                            opacity: settings.fastStart ? 0.55 : 1,
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: settings.fastStart ? '#b066ff' : 'rgba(255, 255, 255, 0.1)',
                                                border: '2px solid ' + (settings.fastStart ? '#b066ff' : 'rgba(255, 255, 255, 0.3)'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {settings.fastStart && (
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    style={{ color: '#1a0533', fontSize: '14px', fontWeight: 'bold' }}
                                                >
                                                    ✓
                                                </motion.span>
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                color: settings.fastStart ? '#b066ff' : 'rgba(255, 255, 255, 0.7)',
                                                fontSize: '13px',
                                                fontWeight: settings.fastStart ? 'bold' : 'normal',
                                            }}
                                        >
                                            {settings.fastStart
                                                ? 'Fast Start enabled - Great Hall, Parlor & Arcane Focus (locked in)'
                                                : 'Fast Start: begin with Great Hall, Parlor & Arcane Focus (free)'}
                                        </span>
                                    </motion.div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label
                                            htmlFor="type-out-speed"
                                            style={{
                                                color: 'rgba(255, 255, 255, 0.8)',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                            }}
                                        >
                                            Type-Out Speed
                                        </label>
                                        <div
                                            style={{
                                                padding: '12px',
                                                background: 'rgba(18, 8, 32, 0.7)',
                                                border: '2px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '10px',
                                            }}
                                        >
                                            <input
                                                id="type-out-speed"
                                                type="range"
                                                min={minTypeOutSpeed}
                                                max={maxTypeOutSpeed}
                                                step={5}
                                                value={settings.typeOutSpeed}
                                                onChange={(e) => setSettings(prev => ({
                                                    ...prev,
                                                    typeOutSpeed: clampTypeOutSpeed(parseInt(e.target.value, 10))
                                                }))}
                                                style={{
                                                    width: '100%',
                                                    accentColor: '#b066ff',
                                                    cursor: 'pointer',
                                                }}
                                            />
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '12px',
                                                    color: 'rgba(255, 255, 255, 0.75)',
                                                    fontSize: '12px',
                                                }}
                                            >
                                                <span>Faster</span>
                                                <span style={{ color: '#b066ff', fontWeight: 'bold' }}>
                                                    {settings.typeOutSpeed} ms/char
                                                </span>
                                                <span>Slower</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Art Style Dropdown */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label
                                            style={{
                                                color: 'rgba(255, 255, 255, 0.8)',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                            }}
                                        >
                                            Character Art Style
                                        </label>
                                        <select
                                            value={settings.characterArtStyle}
                                            onChange={(e) => setSettings(prev => ({ ...prev, characterArtStyle: e.target.value as ArtStyle }))}
                                            style={{
                                                padding: '10px',
                                                background: 'rgba(18, 8, 32, 0.7)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                borderRadius: '8px',
                                                color: '#b066ff',
                                                fontSize: '13px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                transition: 'all 0.2s ease',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'rgba(176, 102, 255, 0.5)';
                                                e.currentTarget.style.background = 'rgba(176, 102, 255, 0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'rgba(176, 102, 255, 0.3)';
                                                e.currentTarget.style.background = 'rgba(18, 8, 32, 0.7)';
                                            }}
                                        >
                                            <option value="original" style={{ background: '#001520', color: '#b066ff' }}>Original</option>
                                            <option value="anime" style={{ background: '#001520', color: '#b066ff' }}>Anime</option>
                                            <option value="chibi" style={{ background: '#001520', color: '#b066ff' }}>Chibi</option>
                                            <option value="comic" style={{ background: '#001520', color: '#b066ff' }}>Comic</option>
                                            <option value="pixel art" style={{ background: '#001520', color: '#b066ff' }}>Pixel Art</option>
                                            <option value="hyper-realistic" style={{ background: '#001520', color: '#b066ff' }}>Hyper-Realistic</option>
                                            <option value="realistic" style={{ background: '#001520', color: '#b066ff' }}>Realistic</option>
                                            <option value="specific artist" style={{ background: '#001520', color: '#b066ff' }}>Specific Artist</option>
                                        </select>
                                    </div>

                                    {/* Specific Artist Textbox - Only shown when "specific artist" is selected */}
                                    <AnimatePresence>
                                        {settings.characterArtStyle === 'specific artist' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}
                                            >
                                                <label
                                                    htmlFor="specific-artist"
                                                    style={{
                                                        color: 'rgba(255, 255, 255, 0.8)',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    Artist Name
                                                </label>
                                                <TextInput
                                                    id="specific-artist"
                                                    fullWidth
                                                    value={settings.characterArtist}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, characterArtist: e.target.value }))}
                                                    placeholder="Enter artist name"
                                                    style={{ fontSize: '13px' }}
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Language Input */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label
                                            htmlFor="language-input"
                                            style={{
                                                color: 'rgba(255, 255, 255, 0.8)',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                            }}
                                        >
                                            Language
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <TextInput
                                                id="language-input"
                                                fullWidth
                                                value={settings.language}
                                                onChange={(e) => handleLanguageChange(e.target.value)}
                                                onFocus={() => {
                                                    if (settings.language.trim()) {
                                                        handleLanguageChange(settings.language);
                                                    }
                                                }}
                                                onBlur={() => {
                                                    // Delay to allow clicking on suggestions
                                                    setTimeout(() => setShowLanguageSuggestions(false), 200);
                                                }}
                                                placeholder="Enter any language or style..."
                                                style={{ fontSize: '13px' }}
                                            />
                                            {/* Language suggestions dropdown */}
                                            <AnimatePresence>
                                                {showLanguageSuggestions && languageSuggestions.length > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        transition={{ duration: 0.15 }}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '100%',
                                                            left: 0,
                                                            right: 0,
                                                            marginTop: '4px',
                                                            background: 'rgba(18, 8, 32, 0.95)',
                                                            border: '2px solid rgba(176, 102, 255, 0.3)',
                                                            borderRadius: '8px',
                                                            overflow: 'hidden',
                                                            zIndex: 1000,
                                                            maxHeight: '200px',
                                                            overflowY: 'auto',
                                                        }}
                                                    >
                                                        {languageSuggestions.map((lang, index) => (
                                                            <motion.div
                                                                key={lang}
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: index * 0.02 }}
                                                                onClick={() => selectLanguage(lang)}
                                                                onMouseDown={(e) => e.preventDefault()} // Prevent blur
                                                                style={{
                                                                    padding: '10px 12px',
                                                                    cursor: 'pointer',
                                                                    color: 'rgba(255, 255, 255, 0.8)',
                                                                    fontSize: '13px',
                                                                    transition: 'all 0.15s ease',
                                                                    borderBottom: index < languageSuggestions.length - 1 
                                                                        ? '1px solid rgba(176, 102, 255, 0.1)' 
                                                                        : 'none',
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(176, 102, 255, 0.15)';
                                                                    e.currentTarget.style.color = '#b066ff';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = 'transparent';
                                                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                                                                }}
                                                            >
                                                                {lang}
                                                            </motion.div>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {/* Narrative Tone Controls */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label
                                            htmlFor="tone-preset-select"
                                            style={{
                                                color: 'rgba(255, 255, 255, 0.8)',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                            }}
                                        >
                                            Narrative Tone
                                        </label>

                                        <select
                                            id="tone-preset-select"
                                            value={selectedTonePreset}
                                            onChange={(e) => handleTonePresetChange(e.target.value)}
                                            style={{
                                                padding: '10px',
                                                background: 'rgba(18, 8, 32, 0.7)',
                                                border: '2px solid rgba(176, 102, 255, 0.3)',
                                                borderRadius: '8px',
                                                color: '#b066ff',
                                                fontSize: '13px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {toneEntries.map(([key]) => (
                                                <option key={key} value={key} style={{ background: '#001520', color: '#b066ff' }}>
                                                    {key}
                                                </option>
                                            ))}
                                            <option value={CUSTOM_TONE_KEY} style={{ background: '#001520', color: '#b066ff' }}>
                                                {CUSTOM_TONE_KEY}
                                            </option>
                                        </select>

                                        <textarea
                                            className="text-input-primary"
                                            value={settings.tone}
                                            onChange={(e) => handleToneChange(e.target.value)}
                                            placeholder="Enter narrative tone instructions..."
                                            rows={5}
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                fontSize: '13px',
                                                resize: 'vertical',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Toggle Grid */}
                            <div>
                                <label 
                                    style={{
                                        display: 'block',
                                        color: '#b066ff',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        marginBottom: '12px',
                                    }}
                                >
                                    Tags
                                </label>
                                <div 
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                        gap: '12px',
                                    }}
                                >
                                    {Object.entries(settings.tagToggles).map(([key, value]) => (
                                        <motion.div
                                            key={key}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleToggle(key)}
                                            style={{
                                                padding: '12px',
                                                background: value 
                                                    ? 'rgba(176, 102, 255, 0.15)' 
                                                    : 'rgba(18, 8, 32, 0.7)',
                                                border: value
                                                    ? '2px solid rgba(176, 102, 255, 0.5)'
                                                    : '2px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '4px',
                                                    background: value ? '#b066ff' : 'rgba(255, 255, 255, 0.1)',
                                                    border: '2px solid ' + (value ? '#b066ff' : 'rgba(255, 255, 255, 0.3)'),
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    transition: 'all 0.2s ease',
                                                }}
                                            >
                                                {value && (
                                                    <motion.span
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        style={{
                                                            color: '#1a0533',
                                                            fontSize: '14px',
                                                            fontWeight: 'bold',
                                                        }}
                                                    >
                                                        ✓
                                                    </motion.span>
                                                )}
                                            </div>
                                            <span
                                                style={{
                                                    color: value ? '#b066ff' : 'rgba(255, 255, 255, 0.7)',
                                                    fontSize: '13px',
                                                    fontWeight: value ? 'bold' : 'normal',
                                                }}
                                            >
                                                {key}
                                            </span>
                                        </motion.div>
                                    ))}

                                    {/* Existing write-in tags (editable) */}
                                    {settings.writeInTags.map((tag, idx) => (
                                        <motion.div
                                            key={`writein-${idx}`}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            style={{
                                                padding: '8px',
                                                background: 'rgba(18, 8, 32, 0.7)',
                                                border: '2px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}
                                        >
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: '#ff6b6b',
                                                color: '#200',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold',
                                                flexShrink: 0,
                                            }}>×</div>
                                            <input
                                                value={tag}
                                                onChange={(e) => updateWriteInTag(idx, e.target.value)}
                                                onBlur={() => {
                                                    // remove if emptied
                                                    if (!settings.writeInTags[idx]?.trim()) {
                                                        removeWriteInTag(idx);
                                                    }
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'rgba(255,255,255,0.9)',
                                                    outline: 'none',
                                                    fontSize: '13px',
                                                    width: '100%'
                                                }}
                                            />
                                            <button
                                                onClick={() => removeWriteInTag(idx)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'rgba(255,255,255,0.6)',
                                                    cursor: 'pointer'
                                                }}
                                                aria-label={`Remove write-in tag ${tag}`}
                                            >
                                                ✕
                                            </button>
                                        </motion.div>
                                    ))}

                                    {/* New write-in input (always present as trailing blank) */}
                                    <motion.div
                                        key="writein-new"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            padding: '8px',
                                            background: 'rgba(18, 8, 32, 0.7)',
                                            border: '2px dashed rgba(255, 255, 255, 0.08)',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <div style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '4px',
                                            background: '#ff6b6b',
                                            color: '#200',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            flexShrink: 0,
                                        }}>×</div>
                                        <input
                                            placeholder="Ban a tag..."
                                            value={newWriteIn}
                                            onChange={(e) => setNewWriteIn(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addWriteInTag(newWriteIn);
                                                }
                                            }}
                                            onBlur={() => addWriteInTag(newWriteIn)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'rgba(255,255,255,0.6)',
                                                outline: 'none',
                                                fontSize: '13px',
                                                width: '100%'
                                            }}
                                        />
                                    </motion.div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div 
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    marginTop: '20px',
                                    justifyContent: 'flex-end',
                                }}
                            >
                                <Button
                                    variant="secondary"
                                    onClick={onCancel}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleSave}
                                >
                                    {isNewGame ? 'Start Game' : 'Save Settings'}
                                </Button>
                            </div>
                        </div>
                    </GlassPanel>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
