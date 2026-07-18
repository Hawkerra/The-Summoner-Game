/*
 * The Void - where inactive summons are stored, unaware of anything and untouched by time until they
 * are called back out. Only one summon may be active in the world at once; the rest wait here. A
 * summon defeated in an event is benched in the void for a rank-scaled number of turns before it can
 * be summoned again (low-rarity recovers fast, high-rarity slowly).
 *
 * Exported as CryoScreen so BaseScreen routing is unchanged.
 */
import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';
import Actor, { CAPABILITY_STATS, ACTOR_STAT_ICONS } from '../actors/Actor';
import { scoreToGrade } from '../utils';
import { BlurredBackground } from '../components/BlurredBackground';
import { Button } from '../components/UIComponents';
import { ActorDetailScreen } from './ActorDetailScreen';

interface CryoScreenProps {
	stage: () => Stage;
	setScreenType: (type: ScreenType) => void;
	isVerticalLayout: boolean;
}

const StarRow: FC<{ actor: Actor }> = ({ actor }) => {
	const s = actor.getStarRating();
	return <span style={{ color: '#ffd453', letterSpacing: 1 }}>{'\u2605'.repeat(s)}{'\u2606'.repeat(5 - s)}</span>;
};

const SummonPortrait: FC<{ actor: Actor; stage: () => Stage; size: number }> = ({ actor, stage, size }) => {
	const url = actor.getEmotionImage('neutral', stage());
	return (
		<div style={{
			width: size, height: size, borderRadius: 12, flexShrink: 0,
			backgroundImage: url ? `url(${url})` : undefined,
			background: url ? undefined : `linear-gradient(160deg, ${actor.themeColor}55, transparent)`,
			backgroundSize: 'cover', backgroundPosition: 'center top',
			border: `2px solid ${actor.themeColor || '#b066ff'}`,
		}} />
	);
};

export const CryoScreen: FC<CryoScreenProps> = ({ stage, setScreenType }) => {
	const [, setRefreshKey] = React.useState(0);
	const [detailActor, setDetailActor] = React.useState<Actor | null>(null);
	const refresh = () => setRefreshKey(k => k + 1);

	const actives = stage().getActiveSummons();
	const active = actives[0] || null;
	const voidSummons = stage().getVoidSummons();
	const cap = stage().getActiveSummonCap();

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setScreenType(ScreenType.STATION); };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	const summon = (actor: Actor) => { if (stage().setActiveSummon(actor.id)) refresh(); };
	const banish = (actor: Actor) => { stage().desummonToVoid(actor.id); refresh(); };

	const cardStyle: React.CSSProperties = {
		display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12,
		background: 'rgba(18,10,32,0.7)', border: '1px solid rgba(176,102,255,0.25)', marginBottom: 10,
	};

	const statChips = (actor: Actor) => (
		<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: '0.72rem', opacity: 0.85 }}>
			{CAPABILITY_STATS.map(stat => {
				const Icon = ACTOR_STAT_ICONS[stat];
				return (
					<span key={stat} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
						{Icon && <Icon style={{ fontSize: '0.8rem', opacity: 0.7 }} />}
						<b>{scoreToGrade(actor.stats[stat])}</b>
					</span>
				);
			})}
		</div>
	);

	return (
		<div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
			<BlurredBackground imageUrl={active ? active.getEmotionImage('neutral', stage()) : ''} />
			<div style={{ position: 'absolute', inset: 0, background: 'rgba(6,4,12,0.72)' }} />

			<div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
				<Button onClick={() => setScreenType(ScreenType.STATION)}>Back</Button>
				<span style={{ letterSpacing: '0.08em', opacity: 0.85 }}>THE VOID</span>
				<span style={{ width: 64 }} />
			</div>

			<div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '4px 16px 24px', maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
				{/* Active summon */}
				<div style={{ fontSize: '0.8rem', opacity: 0.6, margin: '4px 0 8px' }}>IN THE WORLD ({actives.length}/{cap})</div>
				{actives.length > 0 ? actives.map(a => (
					<div style={cardStyle} key={a.id}>
						<div onClick={() => setDetailActor(a)} style={{ cursor: 'pointer' }}><SummonPortrait actor={a} stage={stage} size={72} /></div>
						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
								<b style={{ color: a.themeColor || '#b066ff' }}>{a.name}</b>
								<StarRow actor={a} />
							</div>
							{statChips(a)}
						</div>
						<Button onClick={() => banish(a)}>To void</Button>
					</div>
				)) : (
					<div style={{ ...cardStyle, opacity: 0.6, justifyContent: 'center' }}>No summon is active.</div>
				)}

				{/* Void roster */}
				<div style={{ fontSize: '0.8rem', opacity: 0.6, margin: '18px 0 8px' }}>IN THE VOID ({voidSummons.length})</div>
				{voidSummons.length === 0 && (
					<div style={{ ...cardStyle, opacity: 0.6, justifyContent: 'center' }}>The void is empty. Summon more people from the app.</div>
				)}
				{voidSummons.map(actor => {
					const recovering = stage().isSummonRecovering(actor);
					const left = stage().recoveryTurnsLeft(actor);
					return (
						<motion.div key={actor.id} style={cardStyle} initial={{ opacity: 0, y: 6 }} animate={{ opacity: recovering ? 0.7 : 1, y: 0 }}>
							<div onClick={() => setDetailActor(actor)} style={{ cursor: 'pointer', filter: recovering ? 'grayscale(0.6)' : 'none' }}>
								<SummonPortrait actor={actor} stage={stage} size={64} />
							</div>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
									<b style={{ color: actor.themeColor || '#b066ff' }}>{actor.name}</b>
									<StarRow actor={actor} />
								</div>
								{statChips(actor)}
								{recovering && (
									<div style={{ fontSize: '0.72rem', color: '#ff9a6a', marginTop: 4 }}>
										Recovering &mdash; {left} turn{left === 1 ? '' : 's'} left
									</div>
								)}
							</div>
							<Button onClick={() => summon(actor)} disabled={recovering}>
								{recovering ? 'Resting' : 'Summon'}
							</Button>
						</motion.div>
					);
				})}
			</div>

			{detailActor && (
				<ActorDetailScreen actor={detailActor} stage={stage} onClose={() => setDetailActor(null)} />
			)}
		</div>
	);
};
