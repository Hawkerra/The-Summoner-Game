import React, { FC } from 'react';
import { motion } from 'framer-motion';
import Actor, { Stat, ACTOR_STAT_ICONS } from '../actors/Actor';
import Nameplate from './Nameplate';
import AuthorLink from './AuthorLink';
import { scoreToGrade } from '../utils';
import Faction from '../factions/Faction';
import { AccessTime } from '@mui/icons-material';

export enum ActorCardSection {
    STATS = 'stats',
    PORTRAIT = 'portrait',
}

interface ActorCardProps {
    actor: Actor;
    role?: string;
    collapsedSections?: ActorCardSection[];
    expandedSections?: ActorCardSection[];
    layout?: 'horizontal' | 'vertical';
    /** Whether the card is currently expanded (only used when forceExpanded is false) */
    isExpanded?: boolean;
    /** Callback when the card is clicked (only used when forceExpanded is false) */
    onClick?: () => void;
    /** Whether the card is being dragged */
    isDragging?: boolean;
    /** Whether the card is draggable */
    draggable?: boolean;
    /** Drag handlers */
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    /** Custom hover animation properties */
    whileHover?: any;
    /** Additional styles */
    style?: React.CSSProperties;
    /** Additional class name */
    className?: string;
    /** The faction the actor is visiting (when away from station) */
    visitingFaction?: Faction;
    /** The actor is present on station but belongs to this faction */
    visitingFromFaction?: Faction;
}

/**
 * Reusable actor card component that displays actor information.
 * Can be in collapsed state (portrait + nameplate) or expanded state (adds stats).
 */
export const ActorCard: FC<ActorCardProps> = ({
    actor,
    role,
    collapsedSections = [ActorCardSection.STATS, ActorCardSection.PORTRAIT],
    expandedSections = [],
    layout = 'horizontal',
    isExpanded = false,
    onClick,
    isDragging = false,
    draggable = false,
    onDragStart,
    onDragEnd,
    whileHover,
    style,
    className,
    visitingFaction,
    visitingFromFaction
}) => {
    const isAway = !!visitingFaction;
    const visitingStatusFaction = visitingFaction || visitingFromFaction;
    const currentSections = (isExpanded && expandedSections?.length > 0) ? expandedSections : collapsedSections;
    const clickable = !!onClick;

    // Default hover behavior
    const defaultWhileHover = {
        backgroundColor: (clickable || draggable) ? 'rgba(176, 102, 255, 0.15)' : undefined,
        borderColor: (clickable || draggable) ? 'rgba(176, 102, 255, 0.5)' : undefined,
    };

    // Create the wrapper element conditionally based on whether draggable or not
    const wrapperProps: any = {
        onClick: clickable ? onClick : undefined,
        animate: {
            opacity: isDragging ? 0.4 : (isAway ? 0.5 : 1),
            scale: isDragging ? 0.95 : 1,
        },
        whileHover: whileHover || defaultWhileHover,
        transition: {
            duration: 0.2
        },
        style: {
            padding: '12px',
            border: `3px solid ${isAway ? '#ffa726' : '#b066ff'}`,
            borderRadius: '8px',
            background: isAway ? 'rgba(255, 167, 38, 0.1)' : 'rgba(0, 10, 20, 0.5)',
            cursor: isDragging ? 'grabbing' : (draggable ? 'grab' : (clickable ? 'pointer' : 'default')),
            ...style
        },
        className
    };

    // Add HTML5 drag attributes if draggable
    if (draggable) {
        wrapperProps.draggable = true;
        wrapperProps.onDragStart = onDragStart;
        wrapperProps.onDragEnd = onDragEnd;
    }

    return (
        <motion.div {...wrapperProps}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Away Status Indicator */}
                {visitingStatusFaction && (
                    <div style={{
                        fontSize: 'clamp(0.65rem, 1.8vmin, 0.85rem)',
                        color: '#ffa726',
                        fontWeight: 700,
                        marginBottom: '8px',
                        padding: '4px 8px',
                        background: 'rgba(255, 167, 38, 0.2)',
                        borderRadius: '4px',
                        textAlign: 'center',
                        textShadow: '0 0 8px #ffa726',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                    }}>
                        <AccessTime style={{ fontSize: 'clamp(0.7rem, 1.8vmin, 0.9rem)' }} />
                        {visitingFaction ? 'Visiting ' : 'Visiting from '}
                        {visitingStatusFaction.name}
                    </div>
                )}
                
                {/* Nameplate at the top - takes minimum height needed */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', flexShrink: 0 }}>
                    <Nameplate 
                        actor={actor} 
                        size="small"
                        role={role}
                        layout="stacked"
                    />
                </div>
                
                {/* Sections row - takes remaining space */}
                <div style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden', flex: 1, minHeight: 0 }}>
                    {currentSections.map(section => {
                        if (section === ActorCardSection.STATS) {
                            return <div key="stats" className="stat-list" style={{ 
                                    flex: '1', 
                                    background: 'rgba(0,0,0,0.8)', 
                                    borderRadius: '6px',
                                    padding: '8px 10px',
                                    overflow: 'visible',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-start',
                                    height: '100%'
                                }}>
                                    {/* Stats with letter grades. Each row here should be 1/8th of the container height. */}
                                    {Object.values(Stat).map((stat) => {
                                        const grade = scoreToGrade(actor.stats[stat]);
                                        const StatIcon = ACTOR_STAT_ICONS[stat];
                                        return (
                                            <div className="stat-row" key={`${actor.id}_${stat}`} style={{
                                                height: '12.5%',
                                                maxHeight: '12.5%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '4px'
                                            }}>
                                                {StatIcon && (
                                                    <StatIcon style={{
                                                        fontSize: 'clamp(0.7rem, 1.8vmin, 1rem)',
                                                        opacity: 0.8,
                                                        flexShrink: 0
                                                    }} />
                                                )}
                                                <span className="stat-label" style={{
                                                    textShadow: 'clamp(1px, 0.3vmin, 2px) clamp(1px, 0.3vmin, 2px) 0 rgba(0,0,0,0.88)',
                                                    flex: '1'
                                                }}>{stat}</span>
                                                <span className="stat-grade" data-grade={grade}>{grade}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                        } else if (section === ActorCardSection.PORTRAIT) {
                            return <div key="portrait" style={{
                                width: '100%',
                                flex: 1,
                                borderRadius: '6px',
                                overflow: 'hidden',
                                border: `2px solid ${actor.themeColor || '#b066ff'}`,
                                backgroundImage: `url(${actor.getEmotionImage(actor.getDefaultEmotion())})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'top center',
                                backgroundRepeat: 'no-repeat',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center'
                            }}>
                            </div>
                        }
                    })}
                </div>

                {/* Author link at bottom - takes minimum height needed */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '8px', flexShrink: 0, overflow: 'hidden', minWidth: 0, width: '100%' }}>
                    <AuthorLink actor={actor} />
                </div>
            </div>
        </motion.div>
    );
};

export default ActorCard;
