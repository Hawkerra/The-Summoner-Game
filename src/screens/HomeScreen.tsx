/*
 * The location view - the game's default screen and the successor to the tower hub. Shows where the
 * player currently is (Home by default), the active summon present with them, and a dropdown to
 * travel: into child locations, back to the parent, across to other discovered places, or into the
 * archive of spots gone quiet. "Explore" discovers a new sub-location; "Spend time" starts a
 * slice-of-life skit with the active summon here.
 *
 * Exported as HomeScreen so BaseScreen's routing is unchanged; it renders whatever location is current.
 */
import React, { FC } from 'react';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';
import { SkitType } from '../Skit';
import { GameLocation, DISCOVERABLE_PLACES } from '../Location';
import { Button } from '../components/UIComponents';

interface HomeScreenProps {
    stage: () => Stage;
    setScreenType: (screenType: ScreenType) => void;
    isVerticalLayout: boolean;
}

export const HomeScreen: FC<HomeScreenProps> = ({ stage, setScreenType }) => {
    const [, setRefreshKey] = React.useState(0);
    const refresh = () => setRefreshKey(k => k + 1);

    // On mount, land in the current location (marks it visited, runs the archive sweep, gens bg).
    React.useEffect(() => {
        stage().travelToLocation(stage().getCurrentLocationId());
        refresh();
    }, []);

    const locations = stage().getLocations();
    const current = stage().getCurrentLocation();
    const parent = current.parentId ? locations[current.parentId] : null;
    const children = current.childIds.map(id => locations[id]).filter(Boolean) as GameLocation[];

    // Other places you can jump straight to: discovered, not archived, not here or already listed.
    const listedIds = new Set<string>([current.id, ...(parent ? [parent.id] : []), ...children.map(c => c.id)]);
    const elsewhere = Object.values(locations).filter(l => !l.archived && !listedIds.has(l.id));
    const archived = Object.values(locations).filter(l => l.archived);

    const activeId = stage().getSave().activeActorId;
    const activeSummon = activeId ? stage().getSave().actors[activeId] : null;

    const travel = (id: string) => { stage().travelToLocation(id); refresh(); };

    const explore = () => {
        // Discover a curated place not already hanging off here (stand-in until skits generate them).
        const existingNames = new Set(children.map(c => c.name));
        const options = DISCOVERABLE_PLACES.filter(p => !existingNames.has(p.name));
        if (options.length === 0) return;
        const pick = options[Math.floor(Math.random() * options.length)];
        const loc = stage().spawnSubLocation(current.id, pick);
        stage().travelToLocation(loc.id);
        refresh();
    };

    const spendTime = () => {
        if (!activeSummon) return;
        stage().setSkit({
            type: SkitType.VISIT_CHARACTER,
            actorId: activeSummon.id,
            moduleId: current.id,
            script: [],
            generating: true,
            context: {},
        });
        setScreenType(ScreenType.SKIT);
    };

    const bg = current.backgroundUrl;
    const summonPortrait = activeSummon ? activeSummon.getEmotionImage('neutral', stage()) : '';

    const navBtn: React.CSSProperties = { textAlign: 'left', width: '100%', padding: '9px 12px', marginBottom: 6, borderRadius: 8, border: '1px solid rgba(176,102,255,0.3)', background: 'rgba(18,10,32,0.7)', color: 'inherit', cursor: 'pointer' };

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            {/* background */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: bg ? `url(${bg})` : undefined,
                background: bg ? undefined : 'radial-gradient(circle at 50% 30%, #1a1030, #0b0712)',
                backgroundSize: 'cover', backgroundPosition: 'center',
            }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(11,7,18,0.25), rgba(11,7,18,0.85))' }} />

            {/* content */}
            <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box' }}>
                {/* top bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{current.name}{current.isHome ? '' : ''}</div>
                        <div style={{ opacity: 0.75, fontSize: '0.85rem', maxWidth: '48ch' }}>{current.description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <Button onClick={() => setScreenType(ScreenType.ECHO)}>Summon</Button>
                        <Button onClick={() => setScreenType(ScreenType.CRYO)}>Void</Button>
                        <Button onClick={() => setScreenType(ScreenType.MENU)}>Menu</Button>
                    </div>
                </div>

                {/* present summon */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', minHeight: 0 }}>
                    {activeSummon ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                            <div style={{
                                width: 'min(240px, 60vw)', height: 'min(320px, 46vh)', borderRadius: 16,
                                backgroundImage: summonPortrait ? `url(${summonPortrait})` : undefined,
                                background: summonPortrait ? undefined : `linear-gradient(160deg, ${activeSummon.themeColor}55, transparent)`,
                                backgroundSize: 'cover', backgroundPosition: 'center top',
                                border: `2px solid ${activeSummon.themeColor || '#b066ff'}`,
                            }} />
                            <div style={{ fontWeight: 600, color: activeSummon.themeColor || '#b066ff' }}>{activeSummon.name}</div>
                        </div>
                    ) : (
                        <div style={{ opacity: 0.6, marginBottom: 24, textAlign: 'center' }}>
                            No summon is with you.<br />
                            <span style={{ fontSize: '0.85rem' }}>Open the app and summon someone.</span>
                        </div>
                    )}
                </div>

                {/* actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                    <Button onClick={spendTime} disabled={!activeSummon}>Spend time</Button>
                    <Button onClick={explore}>Explore</Button>
                </div>

                {/* travel dropdown */}
                <details style={{ background: 'rgba(11,7,18,0.7)', borderRadius: 10, padding: '10px 12px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Travel</summary>
                    <div style={{ marginTop: 10 }}>
                        {parent && (
                            <button style={navBtn} onClick={() => travel(parent.id)}>&larr; Back to {parent.name}</button>
                        )}
                        {children.map(c => (
                            <button style={navBtn} key={c.id} onClick={() => travel(c.id)}>&rarr; {c.name}</button>
                        ))}
                        {elsewhere.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: '0.75rem', opacity: 0.6 }}>Elsewhere</div>
                        )}
                        {elsewhere.map(l => (
                            <button style={navBtn} key={l.id} onClick={() => travel(l.id)}>{l.name}</button>
                        ))}
                        {archived.length > 0 && (
                            <details style={{ marginTop: 8 }}>
                                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', opacity: 0.7 }}>Archived ({archived.length})</summary>
                                <div style={{ marginTop: 8 }}>
                                    {archived.map(l => (
                                        <button style={{ ...navBtn, opacity: 0.7 }} key={l.id} onClick={() => travel(l.id)}>{l.name}</button>
                                    ))}
                                </div>
                            </details>
                        )}
                        {children.length === 0 && elsewhere.length === 0 && !parent && (
                            <div style={{ opacity: 0.6, fontSize: '0.85rem' }}>Nowhere to go yet. Try exploring.</div>
                        )}
                    </div>
                </details>
            </div>
        </div>
    );
};
