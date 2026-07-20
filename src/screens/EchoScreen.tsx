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
import { TRAIT_RARITY_COLORS } from '../Traits';
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
	const [showTraits, setShowTraits] = React.useState(false);
	const [leaving, setLeaving] = React.useState<null | 'accept' | 'reject'>(null);

	const candidates = stage().getSave().reserveActors || [];
	const candidate: Actor | null = candidates[0] || null;

	// Swipe motion.
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-260, 260], [-14, 14]);
	const acceptGlow = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
	const rejectGlow = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

	const refresh = () => setRefreshKey(k => k + 1);

	// Hidden debug attenuator: double-click the lower-left corner to open a URL box that
	// hand-curates the reserve. Not user-facing; a dev tool for testing specific characters.
	const [debugOpen, setDebugOpen] = React.useState(false);
	const [debugUrl, setDebugUrl] = React.useState('');
	const [debugBusy, setDebugBusy] = React.useState(false);
	const [debugMsg, setDebugMsg] = React.useState('');
	const lastCornerClick = React.useRef(0);

	const onCornerClick = () => {
		const now = Date.now();
		if (now - lastCornerClick.current < 400) {
			// Second click within 400ms: activate. Discards the random reserve and pauses auto-fill.
			stage().setDebugCurate(true);
			setDebugOpen(true);
			setDebugMsg('');
			refresh();
			lastCornerClick.current = 0;
		} else {
			lastCornerClick.current = now;
		}
	};

	const submitDebugUrl = async () => {
		if (!debugUrl.trim() || debugBusy) return;
		setDebugBusy(true);
		setDebugMsg('Distilling…');
		const ok = await stage().debugSummonFromUrl(debugUrl);
		setDebugBusy(false);
		setDebugMsg(ok ? 'Added to reserve.' : 'Failed — check the URL/path.');
		if (ok) setDebugUrl('');
		refresh();
	};

	const exitDebug = () => {
		stage().setDebugCurate(false);
		setDebugOpen(false);
		refresh();
	};

	// Keep a candidate on deck: if the pool is empty, ask the app to serve one up.
	React.useEffect(() => {
		// Don't auto-fill while curating: debugCurate makes loadReserveActors a synchronous no-op,
		// and with refresh() in .finally() + refreshKey in deps this became an infinite render loop
		// that froze the stage the moment the debug panel emptied the reserve.
		if (!candidate && !loading && !stage().debugCurate) {
			setLoading(true);
			stage().loadReserveActors().finally(() => {
				setLoading(false);
				refresh();
			});
		}
	}, [candidate, loading]);

	// Kick the background trait pass and poll lightly: assignments land async, and without a
	// re-render the chips would never appear on a card the player is already looking at. Paused
	// during debug curation (nothing to backfill, and needless refreshes churn the panel).
	React.useEffect(() => {
		if (stage().debugCurate) return;
		void stage().ensureReserveTraits();
		const interval = setInterval(() => {
			if (stage().debugCurate) return;
			void stage().ensureReserveTraits();
			refresh();
		}, 2000);
		return () => clearInterval(interval);
	}, []);

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setScreenType(ScreenType.STATION); };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	const gate = stage().canAcceptSummon();

	const doAccept = () => {
		if (!candidate || leaving) return;
		if (!gate.allowed) {
			// Spring the card back; the banner explains why.
			animate(x, 0, { type: 'spring', stiffness: 550, damping: 40 });
			return;
		}
		setLeaving('accept');
		const id = stage().acceptSummon(candidate);
		animate(x, 700, {
			duration: 0.25, ease: 'easeIn',
			onComplete: () => { if (id) setScreenType(ScreenType.SKIT); }
		});
	};

	const doReject = () => {
		if (!candidate || leaving) return;
		setLeaving('reject');
		const rejected = candidate;
		animate(x, -700, {
			duration: 0.25, ease: 'easeIn',
			onComplete: () => {
				stage().rejectSummon(rejected);
				// Reset AFTER the fling has fully finished - resetting mid-animation left the card
				// parked off-screen (the animation's final frames overwrote the reset).
				x.stop();
				x.set(0);
				setLeaving(null);
				refresh();
			}
		});
	};

	const onDragEnd = (_e: any, info: { offset?: { x: number }; velocity?: { x: number } }) => {
		const dx = info?.offset?.x ?? 0;
		const vx = info?.velocity?.x ?? 0;
		if (dx > SWIPE_THRESHOLD || (dx > 40 && vx > 600)) { doAccept(); return; }
		if (dx < -SWIPE_THRESHOLD || (dx < -40 && vx < -600)) { doReject(); return; }
		// Not far enough - spring the card firmly back to center.
		animate(x, 0, { type: 'spring', stiffness: 550, damping: 40 });
	};

	// Show the bot card's own image directly (like SPIRE/PARC preview cards) - no generation,
	// no "manifesting" placeholder. A game sprite is only made later, manually, from the detail view.
	const portraitUrl = candidate ? (candidate.avatarImageUrl || candidate.getEmotionImage('neutral', stage())) : '';
	const themeColor = candidate?.themeColor || '#b066ff';

	return (
		<div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
			{/* Background layer: absolutely positioned BEHIND all content and click-through. Used
			    self-closing (not as a wrapper), so it must not sit in the flex flow or intercept
			    pointer events - otherwise it covers the card and every button stops responding. */}
			<div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
				<BlurredBackground imageUrl={portraitUrl} />
			</div>

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
						dragMomentum={false}
						dragElastic={1}
						style={{ x, rotate, cursor: 'grab', touchAction: 'none' }}
						onDragEnd={onDragEnd}
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ type: 'spring', stiffness: 260, damping: 26 }}
					>
						{/* The phone */}
						<div
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

							{/* portrait - the bot card's own image, rendered as a real <img> (CSS
							    background url() breaks silently on URLs with spaces/special chars) */}
							<div style={{ position: 'relative', height: '58%', overflow: 'hidden', background: `linear-gradient(160deg, ${themeColor}44, #0b0712)` }}>
								{portraitUrl && (
									<img
										src={portraitUrl}
										alt={candidate.name}
										draggable={false}
										style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
									/>
								)}
								{/* swipe intent glows */}
								<motion.div style={{ position: 'absolute', top: 14, left: 14, padding: '4px 10px', borderRadius: 8, border: '2px solid #ff5a7a', color: '#ff5a7a', fontWeight: 700, transform: 'rotate(-12deg)', opacity: rejectGlow }}>PASS</motion.div>
								<motion.div style={{ position: 'absolute', top: 14, right: 14, padding: '4px 10px', borderRadius: 8, border: '2px solid #57e08a', color: '#57e08a', fontWeight: 700, transform: 'rotate(12deg)', opacity: acceptGlow }}>SUMMON</motion.div>
							</div>

							{/* info */}
							<div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: 'linear-gradient(to bottom, #120a20, #0b0712)' }}>
								<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
									<span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', background: themeColor, padding: '3px 12px', borderRadius: 999, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>{candidate.name}</span>
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
												<span style={{ fontWeight: 700 }}>{scoreToGrade(candidate.getEffectiveStat(stat))}</span>
											</div>
										);
									})}
								</div>

								{/* Traits: stripped-down chips, color-coded by rarity; hover/tap for descriptions (no stat numbers - those are already baked into the grades above) */}
								{(candidate.traits?.length || 0) > 0 && (
									<div
										style={{ position: 'relative', marginTop: 8 }}
										onMouseEnter={() => setShowTraits(true)}
										onMouseLeave={() => setShowTraits(false)}
										onClick={(e) => { e.stopPropagation(); setShowTraits(v => !v); }}
									>
										<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
											{candidate.getTraitDefs().map(t => (
												<span key={t.n} style={{
													fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
													color: TRAIT_RARITY_COLORS[t.r] || '#b8c0cc',
													border: `1px solid ${TRAIT_RARITY_COLORS[t.r] || '#b8c0cc'}66`,
													background: 'rgba(11,7,18,0.6)',
												}}>{t.n}</span>
											))}
										</div>
										{showTraits && (
											<div style={{
												position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
												width: 'min(300px, 76vw)', marginBottom: 6, padding: '8px 10px', borderRadius: 10,
												background: 'rgba(11,7,18,0.96)', border: '1px solid rgba(176,102,255,0.35)',
												fontSize: '0.68rem', lineHeight: 1.45, zIndex: 4, textAlign: 'left',
												boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
											}}>
												{candidate.getTraitDefs().map(t => (
													<div key={t.n}>
														<b style={{ color: TRAIT_RARITY_COLORS[t.r] || '#b8c0cc' }}>{t.n}:</b> {t.d}
													</div>
												))}
											</div>
										)}
									</div>
								)}
								<div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.7rem', opacity: 0.4 }}>swipe to choose</div>
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

			{/* token-gate banner */}
			{candidate && !gate.allowed && (
				<div style={{ textAlign: 'center', padding: '0 16px 6px', color: '#ffd453', fontSize: '0.85rem', zIndex: 2 }}>
					{gate.reason}
				</div>
			)}

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
					disabled={!candidate || !!leaving || !gate.allowed}
					aria-label="Summon"
					style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid #57e08a', background: 'rgba(87,224,138,0.14)', color: '#57e08a', fontSize: '1.7rem', cursor: candidate ? 'pointer' : 'default' }}
				>&#10003;</button>
			</div>

			{/* details button - separate from the draggable phone so dragging never opens it */}
			<div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 22, zIndex: 2 }}>
				<Button onClick={() => setShowDetail(true)} disabled={!candidate}>View details</Button>
			</div>

			{/* detail overlay - the "look before you decide" view */}
			{showDetail && candidate && (
				<ActorDetailScreen actor={candidate} stage={stage} onClose={() => setShowDetail(false)} />
			)}

			{/* hidden debug hotspot: lower-left corner, double-click to open the curation box.
			    A faint dot marks it so it's findable during playtesting without being obtrusive. */}
			<div
				onClick={onCornerClick}
				title="Debug: double-click to curate reserve"
				style={{ position: 'absolute', left: 0, bottom: 0, width: 56, height: 56, zIndex: 6, cursor: 'default', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 6, boxSizing: 'border-box' }}
			>
				<div style={{ width: 7, height: 7, borderRadius: '50%', background: debugOpen ? '#b066ff' : 'rgba(176,102,255,0.28)' }} />
			</div>

			{/* debug curation panel */}
			{debugOpen && (
				<div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 30, width: 'min(360px, 88vw)', padding: 14, borderRadius: 12, background: 'rgba(6,4,12,0.96)', border: '1px solid rgba(176,102,255,0.5)', boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
						<b style={{ fontSize: '0.85rem', letterSpacing: '0.04em', color: '#b066ff' }}>DEBUG · CURATE RESERVE</b>
						<button onClick={exitDebug} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}>&#10005;</button>
					</div>
					<div style={{ fontSize: '0.72rem', opacity: 0.7, marginBottom: 8 }}>
						Random fill is paused. Paste a Chub character URL (or author/slug) to distill it straight into the reserve.
					</div>
					<input
						value={debugUrl}
						onChange={e => setDebugUrl(e.target.value)}
						onKeyDown={e => { if (e.key === 'Enter') submitDebugUrl(); }}
						placeholder="https://chub.ai/characters/author/slug"
						style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'rgba(11,7,18,0.8)', color: 'inherit', border: '1px solid rgba(176,102,255,0.35)', boxSizing: 'border-box', fontSize: '0.8rem' }}
					/>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
						<Button onClick={submitDebugUrl} disabled={!debugUrl.trim() || debugBusy}>{debugBusy ? 'Working…' : 'Distill'}</Button>
						<Button onClick={exitDebug}>Exit (resume randoms)</Button>
						{debugMsg && <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>{debugMsg}</span>}
					</div>
					<div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: 8 }}>In reserve: {(stage().getSave().reserveActors || []).length}</div>
				</div>
			)}
		</div>
	);
};
