import React, { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stage } from '../Stage';
import Actor, { getRole } from '../actors/Actor';
import { GameLocation } from '../Location';
import { GlassPanel, Title, Button } from '../components/UIComponents';
import { Close, Person, Place } from '@mui/icons-material';
import { ActorDetailScreen } from './ActorDetailScreen';


interface ContentManagementScreenProps {
    stage: () => Stage;
    onClose: () => void;
}

type TabType = 'actors' | 'locations';

export const ContentManagementScreen: FC<ContentManagementScreenProps> = ({ stage, onClose }) => {
    const [activeTab, setActiveTab] = useState<TabType>('actors');
    const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
    const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [, setRefreshKey] = useState(0);
    const refresh = () => setRefreshKey(k => k + 1);

    // Get all actors from the save
    const actors = Object.values(stage().getSave().actors);

    // Get all locations from the save (Home first, then the rest; archived shown but marked).
    const locations = Object.values(stage().getLocations()) as GameLocation[];

    const handleActorClick = (actor: Actor) => {
        setSelectedActor(actor);
    };

    const beginEditLocation = (loc: GameLocation) => {
        setEditingLocationId(loc.id);
        setEditName(loc.name);
        setEditDescription(loc.description);
    };

    const saveLocationEdit = () => {
        const loc = stage().getLocations()[editingLocationId || ''];
        if (loc) {
            loc.name = editName.trim() || loc.name;
            loc.description = editDescription.trim();
            stage().saveGame();
        }
        setEditingLocationId(null);
        refresh();
    };

    const handleCloseDetail = () => {
        setSelectedActor(null);
    };

    return (
        <>
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
                        if (e.target === e.currentTarget) {
                            onClose();
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
                                overflow: 'hidden',
                                position: 'relative',
                                padding: '30px',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {/* Header with close button */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '20px',
                            }}>
                                <Title variant="glow" style={{ fontSize: '24px', margin: 0 }}>
                                    Content Management
                                </Title>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onClose}
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

                            {/* Tab Navigation */}
                            <div style={{
                                display: 'flex',
                                gap: '10px',
                                marginBottom: '20px',
                                borderBottom: '2px solid rgba(176, 102, 255, 0.3)',
                                paddingBottom: '10px',
                            }}>
                                <Button
                                    onClick={() => setActiveTab('actors')}
                                    variant={activeTab === 'actors' ? 'primary' : 'secondary'}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        opacity: activeTab === 'actors' ? 1 : 0.6,
                                    }}
                                >
                                    <Person />
                                    Actors ({actors.length})
                                </Button>
                                <Button
                                    onClick={() => setActiveTab('locations')}
                                    variant={activeTab === 'locations' ? 'primary' : 'secondary'}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        opacity: activeTab === 'locations' ? 1 : 0.6,
                                    }}
                                >
                                    <Place />
                                    Locations ({locations.length})
                                </Button>
                            </div>

                            {/* Content Area */}
                            <div style={{
                                flex: 1,
                                overflow: 'auto',
                                paddingRight: '10px',
                            }}>
                                {/* Actors Tab */}
                                {activeTab === 'actors' && (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                        gap: '15px',
                                        padding: '10px',
                                    }}>
                                        {actors.length === 0 ? (
                                            <div style={{
                                                gridColumn: '1 / -1',
                                                textAlign: 'center',
                                                padding: '40px',
                                                color: 'rgba(224, 240, 255, 0.6)',
                                                fontSize: '16px',
                                            }}>
                                                No actors found in the current save.
                                            </div>
                                        ) : (
                                            actors.map(actor => (
                                                <motion.div
                                                    key={actor.id}
                                                    whileHover={{ scale: 1.05, y: -5 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleActorClick(actor)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        backgroundColor: 'rgba(18, 8, 32, 0.6)',
                                                        border: '2px solid rgba(176, 102, 255, 0.3)',
                                                        borderRadius: '8px',
                                                        padding: '15px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        transition: 'border-color 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = 'rgba(176, 102, 255, 0.6)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = 'rgba(176, 102, 255, 0.3)';
                                                    }}
                                                >
                                                    {/* Actor Avatar */}
                                                    <div
                                                        style={{
                                                            width: '120px',
                                                            height: '120px',
                                                            borderRadius: '50%',
                                                            backgroundColor: 'rgba(18, 8, 32, 0.8)',
                                                            border: `3px solid ${actor.themeColor}`,
                                                            backgroundImage: actor.getEmotionImageUrl('neutral') || actor.getEmotionImageUrl('base') || actor.avatarImageUrl 
                                                                ? `url(${actor.getEmotionImageUrl('neutral') || actor.getEmotionImageUrl('base') || actor.avatarImageUrl})` 
                                                                : 'none',
                                                            backgroundSize: 'cover',
                                                            backgroundPosition: 'top center',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    >
                                                        {!actor.getEmotionImageUrl('neutral') && !actor.getEmotionImageUrl('base') && !actor.avatarImageUrl && (
                                                            <Person style={{ fontSize: '50px', color: 'rgba(176, 102, 255, 0.3)' }} />
                                                        )}
                                                    </div>
                                                    
                                                    {/* Actor Name */}
                                                    <div
                                                        style={{
                                                            color: '#b066ff',
                                                            fontSize: '16px',
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            fontFamily: actor.themeFontFamily,
                                                        }}
                                                    >
                                                        {actor.name}
                                                    </div>
                                                    
                                                    {/* Actor Role/Origin */}
                                                    <div
                                                        style={{
                                                            color: 'rgba(224, 240, 255, 0.6)',
                                                            fontSize: '12px',
                                                            textAlign: 'center',
                                                            textTransform: 'capitalize',
                                                        }}
                                                    >
                                                        {getRole(actor, stage().getSave()) || actor.origin}
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* Factions Tab */}
                                {/* Locations Tab - view and edit existing locations */}
                                {activeTab === 'locations' && (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                        gap: '15px',
                                        padding: '10px',
                                    }}>
                                        {locations.length === 0 ? (
                                            <div style={{
                                                gridColumn: '1 / -1',
                                                textAlign: 'center',
                                                padding: '40px',
                                                color: 'rgba(224, 240, 255, 0.6)',
                                                fontSize: '16px',
                                            }}>
                                                No locations yet.
                                            </div>
                                        ) : (
                                            locations.map((loc) => (
                                                <motion.div
                                                    key={loc.id}
                                                    whileHover={{ scale: 1.02 }}
                                                    style={{
                                                        background: 'rgba(20, 12, 32, 0.6)',
                                                        border: '1px solid rgba(176, 102, 255, 0.3)',
                                                        borderRadius: '12px',
                                                        padding: '16px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '8px',
                                                        opacity: loc.archived ? 0.6 : 1,
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                        <span style={{ color: '#b066ff', fontSize: '16px', fontWeight: 'bold' }}>
                                                            {loc.name}{loc.isHome ? ' ⌂' : ''}
                                                        </span>
                                                        {loc.archived && <span style={{ fontSize: '11px', opacity: 0.7 }}>archived</span>}
                                                    </div>
                                                    <div style={{ color: 'rgba(224, 240, 255, 0.75)', fontSize: '13px', lineHeight: 1.4 }}>
                                                        {loc.description || 'No description.'}
                                                    </div>
                                                    <Button onClick={() => beginEditLocation(loc)} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
                                                        Edit
                                                    </Button>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </GlassPanel>
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* Actor Detail Modal */}
            {selectedActor && (
                <ActorDetailScreen
                    actor={selectedActor}
                    stage={stage}
                    onClose={handleCloseDetail}
                />
            )}

            {/* Location Edit Modal */}
            {editingLocationId && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: '20px',
                }}>
                    <div style={{
                        width: 'min(520px, 92vw)', background: 'rgba(14, 9, 24, 0.98)',
                        border: '1px solid rgba(176, 102, 255, 0.5)', borderRadius: '14px', padding: '20px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                    }}>
                        <h2 style={{ color: '#b066ff', fontSize: '18px', fontWeight: 'bold', marginBottom: '14px' }}>Edit Location</h2>
                        <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>Name</label>
                        <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 10px', borderRadius: '8px', marginBottom: '14px',
                                background: 'rgba(11,7,18,0.8)', color: 'inherit',
                                border: '1px solid rgba(176,102,255,0.35)', boxSizing: 'border-box', fontSize: '14px',
                            }}
                        />
                        <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>Description</label>
                        <textarea
                            value={editDescription}
                            onChange={e => setEditDescription(e.target.value)}
                            rows={5}
                            style={{
                                width: '100%', padding: '8px 10px', borderRadius: '8px', marginBottom: '8px',
                                background: 'rgba(11,7,18,0.8)', color: 'inherit', resize: 'vertical',
                                border: '1px solid rgba(176,102,255,0.35)', boxSizing: 'border-box', fontSize: '14px', lineHeight: 1.4,
                            }}
                        />
                        <div style={{ fontSize: '11px', opacity: 0.55, marginBottom: '14px' }}>
                            The description shapes how scenes and backgrounds at this location are generated. Editing the name or description does not regenerate an existing background image.
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setEditingLocationId(null)} variant="secondary">Cancel</Button>
                            <Button onClick={saveLocationEdit}>Save</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
