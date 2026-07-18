/*
 * The Shop - the strange app's storefront, run by the unseen Game Master. Spends SP on:
 *  - Capability stat upgrades (price scales by the letter grade being purchased)
 *  - Aesthetic Tokens (5), New Summon Tokens (50), Multi-Summon Tokens (100, cap 3)
 *  - Anything: a prompt box where the Game Master prices whatever the player asks for,
 *    by its usefulness and by how entertaining the GM finds the idea.
 */
import React, { FC } from 'react';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';
import Actor, { Stat, CAPABILITY_STATS, ACTOR_STAT_ICONS, RANK_MAX } from '../actors/Actor';
import { scoreToGrade } from '../utils';
import { Button } from '../components/UIComponents';

interface ShopScreenProps {
	stage: () => Stage;
	setScreenType: (type: ScreenType) => void;
	isVerticalLayout: boolean;
}

export const ShopScreen: FC<ShopScreenProps> = ({ stage, setScreenType }) => {
	const [, setRefreshKey] = React.useState(0);
	const refresh = () => setRefreshKey(k => k + 1);

	const save = stage().getSave();
	const sp = stage().getSp();
	const roster = stage().getRosterSummons();
	const [selectedId, setSelectedId] = React.useState<string>(roster[0]?.id || '');
	const selected: Actor | null = save.actors[selectedId] || roster[0] || null;

	// Custom request state
	const [request, setRequest] = React.useState('');
	const [pricing, setPricing] = React.useState(false);
	const [offer, setOffer] = React.useState<{ request: string; price: number; remark: string } | null>(null);

	const askGm = async () => {
		const req = request.trim();
		if (!req || pricing) return;
		setPricing(true);
		setOffer(null);
		const result = await stage().priceCustomRequest(req);
		setPricing(false);
		if (result) setOffer({ request: req, ...result });
		else setOffer({ request: req, price: -1, remark: 'The Game Master does not deign to answer. Try again.' });
	};

	const buyOffer = () => {
		if (!offer || offer.price <= 0) return;
		if (stage().buyCustomRequest(offer.request, offer.price, offer.remark)) {
			setOffer(null);
			setRequest('');
			refresh();
		}
	};

	const sectionStyle: React.CSSProperties = { background: 'rgba(18,10,32,0.75)', border: '1px solid rgba(176,102,255,0.25)', borderRadius: 12, padding: 14, marginBottom: 14 };
	const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0' };

	return (
		<div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at 50% 20%, #1a1030, #0b0712)' }}>
			{/* header */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
				<Button onClick={() => setScreenType(ScreenType.STATION)}>Back</Button>
				<span style={{ letterSpacing: '0.08em', opacity: 0.85 }}>SHOP</span>
				<span style={{ fontWeight: 700, color: '#ffd453' }}>{sp} SP</span>
			</div>

			<div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px', maxWidth: 680, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

				{/* Tokens */}
				<div style={sectionStyle}>
					<div style={{ fontWeight: 700, marginBottom: 6 }}>Tokens</div>
					<div style={rowStyle}>
						<div style={{ minWidth: 0 }}>
							<b>Aesthetic Token</b> <span style={{ opacity: 0.6 }}>(owned: {save.aestheticTokens || 0})</span>
							<div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Change one physical thing about a summon's appearance, chosen upon use.</div>
						</div>
						<Button onClick={() => { if (stage().buyAestheticToken()) refresh(); }} disabled={sp < 5}>5 SP</Button>
					</div>
					<div style={rowStyle}>
						<div style={{ minWidth: 0 }}>
							<b>New Summon Token</b> <span style={{ opacity: 0.6 }}>(owned: {save.newSummonTokens || 0})</span>
							<div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Required for each summon beyond the first.</div>
						</div>
						<Button onClick={() => { if (stage().buyNewSummonToken()) refresh(); }} disabled={sp < 50}>50 SP</Button>
					</div>
					<div style={rowStyle}>
						<div style={{ minWidth: 0 }}>
							<b>Multi-Summon Token</b> <span style={{ opacity: 0.6 }}>(active cap: {stage().getActiveSummonCap()}/3)</span>
							<div style={{ fontSize: '0.8rem', opacity: 0.7 }}>One extra summon active at a time, up to three.</div>
						</div>
						<Button onClick={() => { if (stage().buyMultiSummonToken()) refresh(); }} disabled={sp < 100 || stage().getActiveSummonCap() >= 3}>100 SP</Button>
					</div>
				</div>

				{/* Stat upgrades */}
				<div style={sectionStyle}>
					<div style={{ fontWeight: 700, marginBottom: 6 }}>Stat Upgrades</div>
					{roster.length === 0 ? (
						<div style={{ opacity: 0.6, fontSize: '0.9rem' }}>No summons yet - the app awaits.</div>
					) : (
						<>
							<select
								value={selected?.id || ''}
								onChange={e => setSelectedId(e.target.value)}
								style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'rgba(11,7,18,0.8)', color: 'inherit', border: '1px solid rgba(176,102,255,0.3)', marginBottom: 8 }}
							>
								{roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
							</select>
							{selected && CAPABILITY_STATS.map(stat => {
								const Icon = ACTOR_STAT_ICONS[stat];
								const current = selected.stats[stat] ?? 3;
								const atCap = current >= RANK_MAX;
								const cost = atCap ? 0 : Stage.statUpgradeCost(current + 1);
								return (
									<div key={stat} style={rowStyle}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
											{Icon && <Icon style={{ fontSize: '1rem', opacity: 0.75 }} />}
											<span style={{ textTransform: 'capitalize' }}>{stat}</span>
											<b>{scoreToGrade(current)}</b>
											{!atCap && <span style={{ opacity: 0.6 }}>&rarr; {scoreToGrade(current + 1)}</span>}
										</div>
										<Button
											onClick={() => { if (stage().buyStatUpgrade(selected.id, stat)) refresh(); }}
											disabled={atCap || sp < cost}
										>
											{atCap ? 'MAX' : `${cost} SP`}
										</Button>
									</div>
								);
							})}
						</>
					)}
				</div>

				{/* The Game Master's counter */}
				<div style={sectionStyle}>
					<div style={{ fontWeight: 700, marginBottom: 6 }}>Ask the Game Master</div>
					<div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: 8 }}>
						Request anything. The Game Master will name a price - by how useful it is, and by how much it would amuse them to watch you have it.
					</div>
					<textarea
						value={request}
						onChange={e => setRequest(e.target.value)}
						placeholder="e.g. a katana, a working motorcycle, the ability to breathe underwater..."
						rows={3}
						style={{ width: '100%', padding: 10, borderRadius: 8, background: 'rgba(11,7,18,0.8)', color: 'inherit', border: '1px solid rgba(176,102,255,0.3)', resize: 'vertical', boxSizing: 'border-box' }}
					/>
					<div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
						<Button onClick={askGm} disabled={!request.trim() || pricing}>{pricing ? 'Consulting\u2026' : 'Ask'}</Button>
						{offer && offer.price > 0 && (
							<Button onClick={buyOffer} disabled={sp < offer.price}>Buy for {offer.price} SP</Button>
						)}
					</div>
					{offer && (
						<div style={{ marginTop: 10, fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.85 }}>
							{offer.price > 0 ? <><b>{offer.price} SP</b> &mdash; </> : null}&ldquo;{offer.remark}&rdquo;
						</div>
					)}
					{(save.gmPurchases?.length || 0) > 0 && (
						<details style={{ marginTop: 12 }}>
							<summary style={{ cursor: 'pointer', fontSize: '0.8rem', opacity: 0.7 }}>Past acquisitions ({save.gmPurchases!.length})</summary>
							<div style={{ marginTop: 6 }}>
								{save.gmPurchases!.map((p, i) => (
									<div key={i} style={{ fontSize: '0.8rem', opacity: 0.8, padding: '3px 0' }}>
										<b>{p.request}</b> &mdash; {p.price} SP
									</div>
								))}
							</div>
						</details>
					)}
				</div>
			</div>
		</div>
	);
};
