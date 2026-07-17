/*
 * The summoning screen. The strange app presents one candidate at a time on a phone the summoner
 * holds - a "person" the game claims it can pull into the real world. The player swipes it away to
 * draw someone new, or accepts to bind them. Dating-app framing, one card at a time, no reserve list.
 *
 * Pass 3 build. Accept works WITHOUT a finished portrait (it backfills). Tapping the card opens a
 * full detail view before deciding. The first summon is chosen via attenuation targeting; every
 * summon after is whatever the app serves up.
 */
import React, { FC } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';
import Actor, { Stat, ACTOR_STAT_ICONS, CAPABILITY_STATS, isCapabilityStat } from '../actors/Actor';
import { scoreToGrade } from '../utils';
import { BlurredBackground } from '../components/BlurredBackground';
import { Button } from '../components/UIComponents';
import { ActorDetailScreen } from './ActorDetailScreen';

interface EchoScreenProps {
	stage: () => Stage;
	setScreenType: (type: ScreenType) => void;
	isVerticalLayout: boolean;
}

const SWIPE_THRESHOLD = 120;

export const EchoScreen: FC<EchoScreenProps> = ({ stage, setScreenType }) => {
	const [refreshKey, setRefreshKey] = React.useState(0);
	const [loading, setLoading] = React.useState(false);
	const [showDetail, setShowDetail] = React.useState(false);
	const [leaving, setLeaving] = React.useState<null | 'accept' | 'reject'>(null);

	const candidates = stage().getSave().reserveActors || [];
	const candidate: Actor | null = candidates[0] || null;

	// Swipe motion.
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-260, 260], [-14, 14]);
	const acceptGlow = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
	const rejectGlow = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

	const refresh = () => setRefreshKey(k => k + 1);

	// Keep a candidate on deck: if the pool is empty, ask the app to serve one up.
	React.useEffect(() => {
		if (!candidate && !loading) {
			setLoading(true);
			stage().loadReserveActors().finally(() => {
				setLoading(false);
				refresh();
			});
		}
	}, [candidate, loading, refreshKey]);

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setScreenType(ScreenType.STATION); };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	const doAccept = () => {
		if (!candidate) return;
		setLeaving('accept');
		const id = stage().acceptSummon(candidate);
		// Route into the intro skit for the freshly bound summon.
		setTimeout(() => { if (id) setScreenType(ScreenType.SKIT); }, 220);
	};

	const doReject = () => {
		if (!candidate) return;
		setLeaving('reject');
		const rejected = candidate;
		setTimeout(() => {
			stage().rejectSummon(rejected);
			x.set(0);
			setLeaving(null);
			refresh();
		}, 220);
	};

	const onDragEnd = () => {
		const dx = x.get();
		if (dx > SWIPE_THRESHOLD) { doAccept(); return; }
		if (dx < -SWIPE_THRESHOLD) { doReject(); return; }
		animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
	};

	const portraitUrl = candidate ? candidate.getEmotionImage('neutral', stage()) : '';
	const imageReady = candidate ? candidate.isPrimaryImageReady : false;
	const themeColor = candidate?.themeColor || '#b066ff';

	return (
		<div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
			<BlurredBackground imageUrl={candidate ? candidate.getEmotionImage('neutral', stage()) : ''} />

			{/* Header */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', zIndex: 2 }}>
				<Button onClick={() => setScreenType(ScreenType.STATION)}>Back</Button>
				<span style={{ opacity: 0.85, fontSize: '0.95rem', letterSpacing: '0.05em' }}>SUMMON</span>
				<span style={{ width: 64 }} />
			</div>

			{/* Phone + hand */}
			<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
				{candidate ? (
					<motion.div
						key={candidate.id}
						drag="x"
						dragConstraints={{ left: 0, right: 0 }}
						style={{ x, rotate, cursor: 'grab', touchAction: 'none' }}
						onDragEnd={onDragEnd}
						initial={{ scale: 0.9, opacity: 0 }}
						animate={leaving
							? { x: leaving === 'accept' ? 600 : -600, opacity: 0, rotate: leaving === 'accept' ? 20 : -20 }
							: { scale: 1, opacity: 1 }}
						transition={{ type: 'spring', stiffness: 260, damping: 26 }}
					>
						{/* The phone */}
						<div
							onClick={() => setShowDetail(true)}
							style={{
								position: 'relative',
								width: 'min(340px, 82vw)',
								height: 'min(620px, 74vh)',
								borderRadius: 34,
								background: '#0b0712',
								border: '3px solid #1c1430',
								boxShadow: `0 24px 60px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.03) inset`,
								overflow: 'hidden',
								display: 'flex',
								flexDirection: 'column',
							}}
						>
							{/* notch */}
							<div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 90, height: 18, borderRadius: 12, background: '#000', zIndex: 3 }} />

							{/* portrait */}
							<div style={{
								position: 'relative',
								height: '58%',
								backgroundImage: portraitUrl ? `url(${portraitUrl})` : undefined,
								background: portraitUrl ? undefined : `linear-gradient(160deg, ${themeColor}44, #0b0712)`,
								backgroundSize: 'cover',
								backgroundPosition: 'center top',
							}}>
								{!imageReady && (
									<div style={{
										position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
										paddingBottom: 12, background: 'linear-gradient(to top, rgba(11,7,18,0.85), transparent 45%)',
									}}>
										<motion.span
											style={{ fontSize: '0.8rem', opacity: 0.85 }}
											animate={{ opacity: [0.4, 1, 0.4] }}
											transition={{ duration: 1.4, repeat: Infinity }}
										>
											materializing&hellip;
										</motion.span>
									</div>
								)}
								{/* swipe intent glows */}
								<motion.div style={{ position: 'absolute', top: 14, left: 14, padding: '4px 10px', borderRadius: 8, border: '2px solid #ff5a7a', color: '#ff5a7a', fontWeight: 700, transform: 'rotate(-12deg)', opacity: rejectGlow }}>PASS</motion.div>
								<motion.div style={{ position: 'absolute', top: 14, right: 14, padding: '4px 10px', borderRadius: 8, border: '2px solid #57e08a', color: '#57e08a', fontWeight: 700, transform: 'rotate(12deg)', opacity: acceptGlow }}>SUMMON</motion.div>
							</div>

							{/* info */}
							<div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: 'linear-gradient(to bottom, #120a20, #0b0712)' }}>
								<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
									<span style={{ fontSize: '1.15rem', fontWeight: 700, color: themeColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.name}</span>
									<span style={{ color: '#ffd453', letterSpacing: 1, flexShrink: 0 }} title={`${candidate.getStarRating()} stars`}>
										{'\u2605'.repeat(candidate.getStarRating())}{'\u2606'.repeat(5 - candidate.getStarRating())}
									</span>
								</div>

								{/* capability grades */}
								<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 10px' }}>
									{CAPABILITY_STATS.map(stat => {
										const Icon = ACTOR_STAT_ICONS[stat];
										return (
											<div key={stat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
												{Icon && <Icon style={{ fontSize: '0.95rem', opacity: 0.75 }} />}
												<span style={{ fontWeight: 700 }}>{scoreToGrade(candidate.stats[stat])}</span>
											</div>
										);
									})}
								</div>

								<div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.7rem', opacity: 0.5 }}>tap for details</div>
							</div>
						</div>

						{/* simple hand cradling the phone */}
						<div style={{ position: 'relative', height: 26, marginTop: -14 }}>
							<div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: '70%', height: 40, background: 'linear-gradient(to top, #d9a97e, #c99167)', borderRadius: '40% 40% 20% 20%', filter: 'blur(0.3px)', opacity: 0.9 }} />
						</div>
					</motion.div>
				) : (
					<div style={{ textAlign: 'center', opacity: 0.7 }}>
						<motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
							The app is searching for a signal&hellip;
						</motion.div>
					</div>
				)}
			</div>

			{/* action buttons */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '14px 0 26px', zIndex: 2 }}>
				<button
					onClick={doReject}
					disabled={!candidate || !!leaving}
					aria-label="Pass"
					style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid #ff5a7a', background: 'rgba(255,90,122,0.12)', color: '#ff5a7a', fontSize: '1.5rem', cursor: candidate ? 'pointer' : 'default' }}
				>&#10005;</button>
				<button
					onClick={doAccept}
					disabled={!candidate || !!leaving}
					aria-label="Summon"
					style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid #57e08a', background: 'rgba(87,224,138,0.14)', color: '#57e08a', fontSize: '1.7rem', cursor: candidate ? 'pointer' : 'default' }}
				>&#10003;</button>
			</div>

			{/* detail overlay - the "look before you decide" view */}
			{showDetail && candidate && (
				<ActorDetailScreen actor={candidate} stage={stage} onClose={() => setShowDetail(false)} />
			)}
		</div>
	);
};
