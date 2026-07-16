/*
 * This is the screen where the player can manage characters in cryostasis.
 * Characters can be placed into cryo (locationId set to "cryo") or woken up.
 */
import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';
import Nameplate from '../components/Nameplate';
import Actor, { Stat, ACTOR_STAT_ICONS } from '../actors/Actor';
import { scoreToGrade } from '../utils';
import { BlurredBackground } from '../components/BlurredBackground';
import { ActorCarousel } from '../components/ActorCarousel';
import AuthorLink from '../components/AuthorLink';
import { Button } from '../components/UIComponents';
import { SkitType } from '../Skit';

interface CryoScreenProps {
	stage: () => Stage;
	setScreenType: (type: ScreenType) => void;
	isVerticalLayout: boolean;
}

export const CryoScreen: FC<CryoScreenProps> = ({stage, setScreenType, isVerticalLayout}) => {

	const [selectedSlotIndex, setSelectedSlotIndex] = React.useState<number | null>(null);
	const [expandedCandidateId, setExpandedCandidateId] = React.useState<string | null>(null);
	const [selectedStationActorId, setSelectedStationActorId] = React.useState<string | null>(null); // For tap-to-select on mobile
	const [, forceUpdate] = React.useReducer(x => x + 1, 0);
	
	// Get actors present on the station (locationId is '' or matches a module ID in the layout)
	const stationActors = Object.values(stage().getSave().actors).filter(actor => {
		if (['cryo', 'dead'].includes(actor.locationId)) return false;
		if (actor.origin === 'aide') return false;
		if (actor.factionId) return false;
		if (actor.locationId === '') return true;
		// Check if locationId matches a module ID
		return stage().getSave().layout.getModuleById(actor.locationId) !== null;
	});

	// Get actors in cryo (locationId === 'cryo'), max 3 slots
	const cryoSlots: (Actor | null)[] = [null, null, null];
	const cryoActors = Object.values(stage().getSave().actors).filter(actor => actor.locationId === 'cryo');
	cryoActors.slice(0, 3).forEach((actor, index) => {
		cryoSlots[index] = actor;
	});

	const cancel = () => {
		setScreenType(ScreenType.STATION);
	};

	// Handle Escape key to close the screen
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				cancel();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, []);

	// Characters in cryo cannot be dragged out - they must be awakened using the Wake button

	// Wake a character from cryo
	const wake = () => {
		const selected = selectedSlotIndex != null ? cryoSlots[selectedSlotIndex] : null;
		const availableQuarters = stage().getSave().layout.getModulesWhere(m => m?.type === 'quarters' && !m?.ownerId);
		
		if (selected && availableQuarters.length > 0) {
			const firstRoom = availableQuarters[0];
			// Assign the selected actor to the first available quarters
			firstRoom.ownerId = selected.id;
            setSelectedSlotIndex(null);
            // Move actor to cryo module
            const cryoModule = stage().getSave().layout.getModulesWhere(m => m?.type === 'cryo bank')[0];
            if (cryoModule) {
                // Set the actor's last known module to the cryo module
                selected.locationId = cryoModule.id;
            }
			// Remove actor from cryo slot:
			cryoSlots[selectedSlotIndex!] = null;
			// find the last skit where they entered cryo to get the date
			const entranceEvent = stage().getSave().timeline?.reverse().find(event => event.skit?.actorId === selected.id && event.skit?.type === SkitType.ENTER_CRYO);
			const entranceDate = entranceEvent ? entranceEvent.day : stage().getSave().day;
            // Have a skit to debrief the actor
            stage().setSkit({
                actorId: selected.id,
                type: SkitType.EXIT_CRYO,
                moduleId: cryoModule.id,
                context: {days: stage().getSave().day - entranceDate},
                script: []
            });
            setScreenType(ScreenType.SKIT);
		}
	};

	const handleDragStart = (e: React.DragEvent, actor: Actor) => {
		e.dataTransfer.setData('application/json', JSON.stringify({
			actorId: actor.id,
			source: 'station'
		}));

		// Create custom drag image to show only the current card
		const dragElement = e.currentTarget as HTMLElement;
		const dragImage = dragElement.cloneNode(true) as HTMLElement;
		dragImage.style.position = 'absolute';
		dragImage.style.top = '-9999px';
		dragImage.style.width = dragElement.offsetWidth + 'px';
		dragImage.style.height = dragElement.offsetHeight + 'px';
		document.body.appendChild(dragImage);
		
		e.dataTransfer.setDragImage(dragImage, dragElement.offsetWidth / 2, dragElement.offsetHeight / 2);
		
		// Clean up the temporary drag image after a short delay
		setTimeout(() => {
			document.body.removeChild(dragImage);
		}, 0);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	// Common function to place an actor into a cryo slot
	const placeActorInCryo = (actor: Actor, slotIndex: number) => {
		// Don't allow placement in occupied slots
		const existingActor = cryoSlots[slotIndex];
		if (existingActor) {
			return false; // Slot is occupied
		}
		
		// Move actor into cryo
		actor.locationId = 'cryo';
		
		// Clear actor from ownership on their quarters
		const quarters = stage().getSave().layout.getModulesWhere(m => m?.type === 'quarters' && m?.ownerId === actor.id);
		quarters.forEach(q => {
			q.ownerId = '';
		});
		
		// Clear actor from any module where they hold a role
		const roleModules = stage().getSave().layout.getModulesWhere(m => m?.type !== 'quarters' && m?.ownerId === actor.id);
		roleModules.forEach(m => {
			m.ownerId = '';
		});

		// Add timeline event
		stage().pushToTimeline(stage().getSave(), `${actor.name} sent home through the Homeward Gate.`, 
			{
				actorId: actor.id,
				type: SkitType.ENTER_CRYO,
				moduleId: stage().getSave().layout.getModulesWhere(m => m?.type === 'cryo bank')[0]?.id || '',
				summary: `${actor.name} was sent home through the Homeward Gate.`,
				script: [],
				context: {}
			}
		);
		
		forceUpdate();
		return true;
	};

	// Tap-to-select handler for mobile
	const handleStationActorClick = (actorId: string) => {
		if (selectedStationActorId === actorId) {
			// Deselect if already selected
			setSelectedStationActorId(null);
		} else {
			// Select the actor
			setSelectedStationActorId(actorId);
		}
	};

	// Handler for clicking a cryo slot with a station actor selected
	const handleCryoSlotClick = (slotIndex: number) => {
		if (selectedStationActorId) {
			// Place the selected station actor in this slot
			const actor = stage().getSave().actors[selectedStationActorId];
			
			if (actor && placeActorInCryo(actor, slotIndex)) {
				setSelectedStationActorId(null);
			}
			// If placement failed (slot occupied), keep actor selected
		} else {
			// No station actor selected, handle normal slot selection
			const actor = cryoSlots[slotIndex];
			setSelectedSlotIndex(actor ? slotIndex : null);
		}
	};

	const handleDropOnCryoSlot = (e: React.DragEvent, slotIndex: number) => {
		e.preventDefault();
		const data = JSON.parse(e.dataTransfer.getData('application/json'));
		const actor = stage().getSave().actors[data.actorId];
		
		if (actor && data.source === 'station') {
			placeActorInCryo(actor, slotIndex);
		}
	};

	// Characters in cryo cannot be dragged back to station - they must be awakened using the Wake button

	const module = stage().getSave().layout.getModulesWhere(m => m?.type === 'cryo bank')[0]!;
	const availableQuarters = stage().getSave().layout.getModulesWhere(m => m?.type === 'quarters' && !m?.ownerId) || [];
	const selectedActor = selectedSlotIndex != null ? cryoSlots[selectedSlotIndex] : null;
	const acceptable = selectedActor && availableQuarters.length > 0;
	const allCryoSlotsFull = cryoSlots.every(slot => slot !== null);
	const background = stage().getSave().actors[module.ownerId || '']?.decorImageUrls[module.type] || module.getAttribute('defaultImageUrl')


	return (
		<BlurredBackground imageUrl={background}>
			<div style={{ 
				display: 'flex', 
				flexDirection: 'column', 
				height: '100vh', 
				width: '100vw'
			}}>
			{/* Station actors carousel at top */}
			<ActorCarousel
				actors={stationActors}
				stage={stage()}
				isVerticalLayout={isVerticalLayout}
				expandedActorId={expandedCandidateId}
				onExpandActor={setExpandedCandidateId}
				borderColor="rgba(0,200,255,0.2)"
				glowColor="rgba(0, 200, 255, 0.4)"
				showRemoveButton={false}
				draggable={!allCryoSlotsFull}
				onDragStart={handleDragStart}
				selectedActorId={selectedStationActorId}
				onActorClick={allCryoSlotsFull ? undefined : handleStationActorClick}
			/>
			{/* Cryo slots in center with buttons on sides or bottom */}
			<div style={{ 
				flex: '1 1 auto', 
				display: 'flex', 
				flexDirection: isVerticalLayout ? 'column' : 'row',
				alignItems: 'center', 
				justifyContent: 'center', 
				padding: isVerticalLayout ? '20px' : '40px',
				gap: isVerticalLayout ? '20px' : '40px'
			}}>
				{/* Cancel button on the left (or in button row below if vertical) */}
				{!isVerticalLayout && (
					<Button
						variant="secondary"
						onClick={cancel}
					>
						Back
					</Button>
				)}

				{/* Cryo slots container */}
				<div style={{ display: 'flex', gap: isVerticalLayout ? '20px' : '40px', alignItems: 'flex-end', justifyContent: 'center', flex: 1 }}>
					{cryoSlots.map((actor, slotIndex) => {
						const isSelected = selectedSlotIndex === slotIndex;

						return (
							<motion.div
								key={`cryo_slot_${slotIndex}`}
							onClick={() => handleCryoSlotClick(slotIndex)}
								onDrop={(e) => handleDropOnCryoSlot(e, slotIndex)}
								onDragOver={handleDragOver}
								animate={{
									scale: (actor && isSelected) ? 1.05 : 1,
									y: [0, -3, -1, -4, 0],
									x: [0, 1, -1, 0.5, 0],
									rotate: [0, 0.5, -0.3, 0.2, 0],
									transition: {
										scale: {
											type: "spring",
											stiffness: 150,
											damping: 15
										},
										y: {
											duration: 6,
											repeat: Infinity,
											ease: "easeInOut",
											delay: slotIndex * 0.7
										},
										x: {
											duration: 6,
											repeat: Infinity,
											ease: "easeInOut",
											delay: slotIndex * 0.7
										},
										rotate: {
											duration: 6,
											repeat: Infinity,
											ease: "easeInOut",
											delay: slotIndex * 0.7
										}
									}
								}}
								whileHover={{ 
									scale: actor ? (isSelected ? 1.1 : 1.05) : 1,
									filter: 'brightness(1.1)',
									transition: {
										type: "spring",
										stiffness: 150,
										damping: 15
									}
								}}
								whileTap={{ scale: actor ? 0.98 : 1 }}
								style={{
									cursor: actor ? 'pointer' : 'default',
									height: isVerticalLayout ? '50vh' : '65vh',
									width: isVerticalLayout ? '28vw' : '18vw',
									display: 'flex',
									flexDirection: 'column',
									justifyContent: actor ? 'flex-end' : 'center',
									alignItems: actor ? 'stretch' : 'center',
									borderRadius: 12,
									overflow: 'hidden',
									background: actor ? undefined : 'linear-gradient(135deg, rgba(0,200,255,0.15), rgba(100,150,255,0.1))',
									border: isSelected
										? `5px solid ${actor?.themeColor || '#ffffff'}` 
										: selectedStationActorId
											? '4px solid rgba(255,215,0,0.8)' // Gold border when ready to place
											: actor 
												? `4px solid ${actor.themeColor || '#00c8ff'}`
												: '3px dashed rgba(0,200,255,0.5)',
									boxShadow: isSelected
										? `0 12px 40px ${actor?.themeColor ? actor.themeColor + '40' : 'rgba(0,200,255,0.25)'}, inset 0 0 50px ${actor?.themeColor ? actor.themeColor + '20' : 'rgba(0,200,255,0.1)'}` 
										: actor
											? `0 8px 25px rgba(0,0,0,0.4), inset 0 0 30px ${actor.themeColor ? actor.themeColor + '15' : 'rgba(0,200,255,0.05)'}, 0 0 20px ${actor.themeColor ? actor.themeColor + '30' : 'rgba(0,200,255,0.1)'}`
											: '0 8px 25px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,200,255,0.05)',
									position: 'relative',
								}}
							>
								{/* Background layers for actor slots */}
								{actor && (
									<>
										{/* Actor portrait image layer */}
										<div 
											style={{
												position: 'absolute',
												top: 0,
												left: 0,
												width: '100%',
												height: '100%',
												backgroundImage: `url(${actor.getEmotionImage('neutral', stage())})`,
												backgroundSize: 'cover',
												backgroundPosition: 'center top',
												backgroundRepeat: 'no-repeat',
												zIndex: 0,
											}}
										/>
										{/* Gradient overlay layer */}
										<div 
											style={{
												position: 'absolute',
												top: 0,
												left: 0,
												width: '100%',
												height: '100%',
												background: `linear-gradient(
													135deg, 
													rgba(0, 200, 255, 0.15) 0%, 
													rgba(100, 150, 255, 0.1) 50%, 
													rgba(109, 87, 131, 0.15) 100%
												)`,
												mixBlendMode: 'overlay',
												zIndex: 1,
											}}
										/>
									</>
								)}
							{actor ? (
								<>
									{/* Spacer to push the nameplate and stats down about 30vh */}
									<div style={{ flex: '0 0 30vh', position: 'relative', zIndex: 2 }}></div>
									{/* Actor nameplate */}
									<Nameplate 
										actor={actor} 
										size="medium"
										role={(() => {
											const roleModules = stage().getSave().layout.getModulesWhere((m: any) => 
												m && m.type !== 'quarters' && m.ownerId === actor.id
											);
											return roleModules.length > 0 ? roleModules[0].getAttribute('role') : undefined;
										})()}
										layout="stacked"
										style={{
											padding: 'clamp(8px, 1.5vmin, 16px) clamp(10px, 2vmin, 20px)',
											fontSize: 'clamp(14px, 2.2vmin, 20px)',
											position: 'relative',
											zIndex: 2
										}}
									/>
								{/* Stats */}
								<div className="stat-list" style={{ padding: 'clamp(6px, 1vmin, 10px) clamp(8px, 1.5vmin, 14px)', background: 'rgba(0,0,0,0.8)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', position: 'relative', zIndex: 2 }}>
										{Object.values(Stat).map((stat) => {
											const grade = scoreToGrade(actor.stats[stat]);
											const StatIcon = ACTOR_STAT_ICONS[stat];
											return (
												<div className="stat-row" key={`${actor.id}_${stat}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
													<div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 0.8vmin, 8px)' }}>
														{StatIcon && <StatIcon style={{ fontSize: 'clamp(0.8rem, 2vmin, 1.2rem)', opacity: 0.8, flexShrink: 0 }} />}
														<span className="stat-label">{stat}</span>
													</div>
													<span className="stat-grade" data-grade={grade}>{grade}</span>
												</div>
												);
										})}
										{/* Author link */}
										<AuthorLink actor={actor} />
									</div>
								</>
							) : (
								<div style={{ 
									color: selectedStationActorId ? 'rgba(255,215,0,0.9)' : 'rgba(0,200,255,0.7)', 
									fontSize: 'clamp(14px, 2.2vmin, 20px)', 
									textAlign: 'center',
									padding: 'clamp(12px, 2.5vmin, 24px)',
									transition: 'color 0.3s ease'
								}}>
									{selectedStationActorId ? 'Tap here to send this character home' : 'Drag or tap a character above, then tap a slot to send them home'}
								</div>
							)}
								</motion.div>
						);
					})}
				</div>

				{/* Wake button on the right (or in button row below if vertical) */}
				{!isVerticalLayout && (
					<Button
						variant="primary"
						onClick={wake}
						disabled={!acceptable}
						style={{
							background: acceptable ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
							color: acceptable ? '#1a0533' : '#9aa0a6'
						}}
					>
						{availableQuarters.length === 0 
							? 'No Available Quarters' 
							: selectedActor 
								? 'Recall Character'
								: 'Select a Character'
						}
					</Button>
				)}

				{/* Button row for vertical layout */}
				{isVerticalLayout && (
					<div style={{ display: 'flex', gap: '20px', justifyContent: 'center', width: '100%' }}>
						<Button
							variant="secondary"
							onClick={cancel}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={wake}
							disabled={!acceptable}
							style={{
								background: acceptable ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
								color: acceptable ? '#1a0533' : '#9aa0a6'
							}}
						>
							{availableQuarters.length === 0 
								? 'No Available Quarters' 
								: selectedActor 
									? 'Recall Character'
									: 'Select a Character'
							}
						</Button>
					</div>
				)}
			</div>
			</div>
		</BlurredBackground>
	);
}
