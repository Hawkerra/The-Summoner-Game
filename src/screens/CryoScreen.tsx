/*
 * SUMMON MANAGEMENT (formerly "The Void" screen; export/route names kept for BaseScreen).
 * List-first layout - no giant blurred portrait eating the screen. Manages:
 *  - Active summons (Desummon) and the void roster (Summon, with rank-scaled recovery timers)
 *  - Per-summon equipment: unequip to storage, equip from storage, repair (System, uses a token),
 *    Temp->System conversion (25 SP)
 *  - Usable items from the Game Master (consumables), applied to a chosen summon
 */
import React, { FC } from 'react';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';
import Actor, { CAPABILITY_STATS, ACTOR_STAT_ICONS } from '../actors/Actor';
import { EQUIP_SLOTS, describeDurability } from '../Equipment';
import { scoreToGrade } from '../utils';
import { Button } from '../components/UIComponents';
import { ActorDetailScreen } from './ActorDetailScreen';

interface CryoScreenProps {
	stage: () => Stage;
	setScreenType: (type: ScreenType) => void;
	isVerticalLayout: boolean;
}

const Portrait: FC<{ actor: Actor; stage: () => Stage; size: number; onClick?: () => void }> = ({ actor, stage, size, onClick }) => {
	const url = actor.getEmotionImage('neutral', stage());
	return (
		<div onClick={onClick} title="View details" style={{
			width: size, height: size, borderRadius: 10, flexShrink: 0, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
			background: `linear-gradient(160deg, ${actor.themeColor || '#b066ff'}55, transparent)`,
			border: `2px solid ${actor.themeColor || '#b066ff'}`,
		}}>
			{url && <img src={url} alt={actor.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block', pointerEvents: 'none' }} />}
		</div>
	);
};

export const CryoScreen: FC<CryoScreenProps> = ({ stage, setScreenType }) => {
	const [, setRefreshKey] = React.useState(0);
	const [detailActor, setDetailActor] = React.useState<Actor | null>(null);
	const [openEquipId, setOpenEquipId] = React.useState<string | null>(null);
	const refresh = () => setRefreshKey(k => k + 1);

	const save = stage().getSave();
	const actives = stage().getActiveSummons();
	const voidSummons = stage().getVoidSummons();
	const cap = stage().getActiveSummonCap();
	const storage = stage().getEquipmentArchive();
	const consumables = save.consumables || [];
	const sp = stage().getSp();

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setScreenType(ScreenType.STATION); };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	const rowStyle: React.CSSProperties = {
		display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12,
		background: 'rgba(18,10,32,0.7)', border: '1px solid rgba(176,102,255,0.25)', marginBottom: 8,
	};
	const subStyle: React.CSSProperties = { fontSize: '0.72rem', opacity: 0.75 };

	const statChips = (actor: Actor) => (
		<div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px', fontSize: '0.72rem', opacity: 0.85 }}>
			{CAPABILITY_STATS.map(stat => {
				const Icon = ACTOR_STAT_ICONS[stat];
				return (
					<span key={stat} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
						{Icon && <Icon style={{ fontSize: '0.8rem', opacity: 0.7 }} />}
						<b>{scoreToGrade(actor.getEffectiveStat(stat))}</b>
					</span>
				);
			})}
		</div>
	);

	// The per-summon equipment management panel.
	const equipPanel = (actor: Actor) => (
		<div style={{ margin: '2px 0 10px', padding: 10, borderRadius: 10, background: 'rgba(11,7,18,0.6)', border: '1px solid rgba(176,102,255,0.15)' }}>
			{EQUIP_SLOTS.map(slot => {
				const item = actor.equipped?.[slot];
				return (
					<div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: item ? 1 : 0.45 }}>
						<span style={{ minWidth: 86, textTransform: 'capitalize', fontSize: '0.75rem', opacity: 0.7 }}>{slot}</span>
						{item ? (
							<>
								<div style={{ flex: 1, minWidth: 0, fontSize: '0.8rem' }}>
									<b>{item.name}</b>
									<span style={{ marginLeft: 6, fontSize: '0.68rem', color: item.kind === 'system' ? '#57e08a' : '#ffd453' }}>
										{item.kind === 'system' ? 'System' : 'Temp'}
									</span>
									<span style={{ marginLeft: 6, ...subStyle }}>{describeDurability(item)} ({item.durability}/{item.maxDurability})</span>
									{item.bonuses && <span style={{ marginLeft: 6, ...subStyle }}>{Object.entries(item.bonuses).map(([k, v]) => `+${v} ${k}`).join(', ')}</span>}
								</div>
								{item.kind === 'temporary' && (
									<Button onClick={() => { if (stage().convertTempToSystem(actor.id, slot)) refresh(); }} disabled={sp < 25}>Make System (25)</Button>
								)}
								{item.kind === 'system' && item.durability < item.maxDurability && (
									<Button onClick={() => { if (stage().repairEquippedItem(actor.id, slot)) refresh(); }} disabled={(save.repairTokens || 0) < 1}>Repair</Button>
								)}
								<Button onClick={() => { if (stage().unequipToArchive(actor.id, slot)) refresh(); }}>Unequip</Button>
							</>
						) : (
							<span style={{ fontSize: '0.8rem' }}>&mdash;</span>
						)}
					</div>
				);
			})}
			{/* Equip from storage */}
			{storage.length > 0 && (
				<div style={{ marginTop: 8 }}>
					<span style={{ ...subStyle }}>Equip from storage:</span>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
						{storage.map(i => (
							<button key={i.id}
								onClick={() => { if (stage().equipFromArchive(actor.id, i.id)) refresh(); }}
								style={{ padding: '4px 8px', borderRadius: 8, fontSize: '0.72rem', cursor: 'pointer', background: 'rgba(176,102,255,0.12)', border: '1px solid rgba(176,102,255,0.4)', color: 'inherit' }}
								title={`${i.slot} \u00b7 ${i.kind}${i.description ? ` \u00b7 ${i.description}` : ''}`}
							>
								{i.name} ({i.slot})
							</button>
						))}
					</div>
				</div>
			)}
			{/* Usable items */}
			{consumables.length > 0 && (
				<div style={{ marginTop: 8 }}>
					<span style={{ ...subStyle }}>Use an item on {actor.name}:</span>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
						{consumables.map(c => (
							<button key={c.id}
								onClick={() => { if (stage().useConsumable(c.id, actor.id)) refresh(); }}
								style={{ padding: '4px 8px', borderRadius: 8, fontSize: '0.72rem', cursor: 'pointer', background: 'rgba(87,224,138,0.10)', border: '1px solid rgba(87,224,138,0.45)', color: 'inherit' }}
								title={`${c.remark}${c.effect && c.effect !== 'NONE' ? ` \u00b7 ${c.effect}` : ''}`}
							>
								{c.name}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);

	const summonRow = (actor: Actor, isActive: boolean) => {
		const recovering = stage().isSummonRecovering(actor);
		const left = stage().recoveryTurnsLeft(actor);
		return (
			<React.Fragment key={actor.id}>
				<div style={{ ...rowStyle, opacity: recovering ? 0.75 : 1 }}>
					<Portrait actor={actor} stage={stage} size={56} onClick={() => setDetailActor(actor)} />
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
							<b style={{ color: actor.themeColor || '#b066ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actor.name}</b>
							<span style={{ color: '#ffd453', letterSpacing: 1, flexShrink: 0 }}>{'\u2605'.repeat(actor.getStarRating())}{'\u2606'.repeat(5 - actor.getStarRating())}</span>
						</div>
						{statChips(actor)}
						{recovering && <div style={{ fontSize: '0.72rem', color: '#ff9a6a' }}>Recovering &mdash; {left} turn{left === 1 ? '' : 's'} left</div>}
					</div>
					<Button onClick={() => setOpenEquipId(openEquipId === actor.id ? null : actor.id)}>Gear</Button>
					{isActive
						? <Button onClick={() => { stage().desummonToVoid(actor.id); refresh(); }}>Desummon</Button>
						: <Button onClick={() => { if (stage().setActiveSummon(actor.id)) refresh(); }} disabled={recovering}>{recovering ? 'Resting' : 'Summon'}</Button>}
				</div>
				{openEquipId === actor.id && equipPanel(actor)}
			</React.Fragment>
		);
	};

	return (
		<div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at 50% 15%, #1a1030, #0b0712)' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
				<Button onClick={() => setScreenType(ScreenType.STATION)}>Back</Button>
				<span style={{ letterSpacing: '0.08em', opacity: 0.85 }}>SUMMON MANAGEMENT</span>
				<span style={{ fontWeight: 700, color: '#ffd453' }}>{sp} SP</span>
			</div>

			<div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px', maxWidth: 680, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
				<div style={{ fontSize: '0.8rem', opacity: 0.6, margin: '4px 0 8px' }}>ACTIVE ({actives.length}/{cap})</div>
				{actives.length > 0 ? actives.map(a => summonRow(a, true)) : (
					<div style={{ ...rowStyle, opacity: 0.6, justifyContent: 'center' }}>No summon is active.</div>
				)}

				<div style={{ fontSize: '0.8rem', opacity: 0.6, margin: '16px 0 8px' }}>IN THE VOID ({voidSummons.length})</div>
				{voidSummons.length > 0 ? voidSummons.map(a => summonRow(a, false)) : (
					<div style={{ ...rowStyle, opacity: 0.6, justifyContent: 'center' }}>The void is empty. Summon more people from the app.</div>
				)}
			</div>

			{detailActor && (
				<ActorDetailScreen actor={detailActor} stage={stage} onClose={() => setDetailActor(null)} />
			)}
		</div>
	);
};
