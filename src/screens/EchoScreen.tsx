/*
 * This is the screen where the player can view available echo pods and choose to wake a character.
 */
import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { ScreenType } from './BaseScreen';
import { Stage } from '../Stage';
import { SkitType } from '../Skit';
import Nameplate from '../components/Nameplate';
import Actor, { generateActorDecor, Stat, ACTOR_STAT_ICONS } from '../actors/Actor';
import { scoreToGrade } from '../utils';
import { BlurredBackground } from '../components/BlurredBackground';
import { ActorCarousel } from '../components/ActorCarousel';
import AuthorLink from '../components/AuthorLink';
import { RemoveButton } from '../components/RemoveButton';
import { Button } from '../components/UIComponents';

interface EchoScreenProps {
	stage: () => Stage;
	setScreenType: (type: ScreenType) => void;
	isVerticalLayout: boolean;
}

export const EchoScreen: FC<EchoScreenProps> = ({stage, setScreenType, isVerticalLayout}) => {

	const [selectedSlotIndex, setSelectedSlotIndex] = React.useState<number | null>(null);
	const [expandedCandidateId, setExpandedCandidateId] = React.useState<string | null>(null);
	const [refreshKey, setRefreshKey] = React.useState(0); // Force re-renders when data changes
	const [selectedReserveActorId, setSelectedReserveActorId] = React.useState<string | null>(null); // For tap-to-select on mobile
	const reserveActors = stage().getSave().reserveActors || [];
	const echoSlots = stage().getEchoSlots();

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

	const removeReserveActor = (actorId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		stage().getSave().reserveActors = (stage().getSave().reserveActors || []).filter(a => a.id !== actorId);
		stage().saveGame();
		stage().loadReserveActors();
		setRefreshKey(prev => prev + 1); // Force re-render
	};

	const removeEchoActor = (actorId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		// Find the actor in echo slots
		const actor = echoSlots.find(a => a?.id === actorId);
		if (actor) {
			// Remove from echo slot
			stage().removeActorFromEcho(actorId, true);
			// Add back to reserve actors if not already there
			const reserveActors = stage().getSave().reserveActors || [];
			if (!reserveActors.find(a => a.id === actorId)) {
				stage().getSave().reserveActors = [...reserveActors, actor];
				stage().saveGame();
			}
			setRefreshKey(prev => prev + 1); // Force re-render
		}
	};

	const accept = () => {
		const selected = selectedSlotIndex != null ? echoSlots[selectedSlotIndex] : null;
		const firstRoom = stage().getSave().layout.getModulesWhere(m => m?.type === 'quarters' && !m?.ownerId)[0] || null;
		if (selected && firstRoom && selected.isPrimaryImageReady) {
			// Assign the selected actor to the first available room
			firstRoom.ownerId = selected.id;
			generateActorDecor(selected, firstRoom, stage());
			// Set the actor's location to the echo room:
			const sceneRoom = stage().getSave().layout.getModulesWhere(m => m.type === 'echo chamber')[0] || firstRoom;
			selected.locationId = sceneRoom?.id || '';
			stage().getSave().actors[selected.id] = selected;
			// Remove from reserve actors and echo slots
			stage().getSave().reserveActors = (stage().getSave().reserveActors || []).filter(a => a.id !== selected.id);
			stage().removeActorFromEcho(selected.id, false);
            stage().setSkit({
                    type: SkitType.INTRO_CHARACTER,
                    actorId: selected.id,
                    moduleId: sceneRoom?.id,
                    script: [],
                    generating: true,
                    context: {}
			});
			setScreenType(ScreenType.SKIT);
		}
	};

	const handleDragStart = (e: React.DragEvent, actor: Actor) => {
		e.dataTransfer.setData('application/json', JSON.stringify({
			actorId: actor.id,
			source: 'reserve'
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

	const handleDropOnEchoSlot = async (e: React.DragEvent, slotIndex: number) => {
		e.preventDefault();
		const data = JSON.parse(e.dataTransfer.getData('application/json'));
		console.log('Dropping echo onto slot');
		console.log(data);
		const actor = reserveActors.find(a => a.id === data.actorId) || echoSlots.find(a => a?.id === data.actorId);
		console.log(actor);
		if (actor) {
			// Check if slot is occupied
			const existingActor = echoSlots[slotIndex];
			if (existingActor && existingActor.id !== actor.id) {
				// Move existing actor back to reserves
				const reserveActors = stage().getSave().reserveActors || [];
				if (!reserveActors.find(a => a.id === existingActor.id)) {
					stage().getSave().reserveActors = [...reserveActors, existingActor];
				}
			}
			await stage().commitActorToEcho(actor.id, slotIndex);
			// Remove dragged actor from reserves if they came from there
			if (data.source === 'reserve') {
				stage().getSave().reserveActors = (stage().getSave().reserveActors || []).filter(a => a.id !== actor.id);
				stage().saveGame();
			}
			// Use Stage method to manage echo slots
			setRefreshKey(prev => prev + 1); // Force re-render
		}
	};

	const handleDropOnReserve = (e: React.DragEvent) => {
		e.preventDefault();
		const data = JSON.parse(e.dataTransfer.getData('application/json'));
		if (data.source === 'echo') {
			// Remove from echo slot using Stage method
			stage().removeActorFromEcho(data.actorId, true);
			setRefreshKey(prev => prev + 1); // Force re-render
		}
	};

	// Tap-to-select handler for mobile
	const handleReserveActorClick = (actorId: string) => {
		if (selectedReserveActorId === actorId) {
			// Deselect if already selected
			setSelectedReserveActorId(null);
		} else {
			// Select the actor
			setSelectedReserveActorId(actorId);
		}
	};

	// Handler for clicking an echo slot with a reserve actor selected
	const handleEchoSlotClick = async (slotIndex: number) => {
		if (selectedReserveActorId) {
			// Place the selected reserve actor in this slot
			const actor = reserveActors.find(a => a.id === selectedReserveActorId) || echoSlots.find(a => a?.id === selectedReserveActorId);
			if (actor) {
				// Check if slot is occupied
				const existingActor = echoSlots[slotIndex];
				if (existingActor && existingActor.id !== actor.id) {
					// Move existing actor back to reserves
					const reserveActors = stage().getSave().reserveActors || [];
					if (!reserveActors.find(a => a.id === existingActor.id)) {
						stage().getSave().reserveActors = [...reserveActors, existingActor];
					}
				}
				await stage().commitActorToEcho(actor.id, slotIndex);
				// Remove from reserves if they came from there
				const wasInReserve = reserveActors.find(a => a.id === actor.id);
				if (wasInReserve) {
					stage().getSave().reserveActors = (stage().getSave().reserveActors || []).filter(a => a.id !== actor.id);
					stage().saveGame();
				}
				setSelectedReserveActorId(null);
				setRefreshKey(prev => prev + 1);
			}
		} else {
			// No reserve actor selected, handle normal slot selection
			const actor = echoSlots[slotIndex];
			setSelectedSlotIndex(actor ? slotIndex : null);
		}
	};

	const module = stage().getSave().layout.getModulesWhere(m => m?.type === 'echo chamber')[0]!;
	const availableRooms = stage().getSave().layout.getModulesWhere(m => m?.type === 'quarters' && !m?.ownerId) || [];
	const selectedActor = selectedSlotIndex != null ? echoSlots[selectedSlotIndex] : null;
	const acceptable = selectedActor && selectedActor.isPrimaryImageReady && availableRooms.length > 0;
	const background = stage().getSave().actors[module.ownerId || '']?.decorImageUrls[module.type] || module.getAttribute('defaultImageUrl')

	return (
		<BlurredBackground imageUrl={background}>
			<div style={{ 
				display: 'flex', 
				flexDirection: 'column', 
				height: '100vh', 
				width: '100vw'
			}}>
			{/* Reserve carousel at top */}
			<ActorCarousel
				actors={reserveActors}
				stage={stage()}
				isVerticalLayout={isVerticalLayout}
				expandedActorId={selectedReserveActorId || expandedCandidateId}
				onExpandActor={setExpandedCandidateId}
				showRemoveButton={true}
				onRemoveActor={removeReserveActor}
				draggable={true}
				onDragStart={handleDragStart}
				onDrop={handleDropOnReserve}
				onDragOver={handleDragOver}
				selectedActorId={selectedReserveActorId}
				onActorClick={handleReserveActorClick}
			/>
			{/* Echo slots in center with buttons on sides or bottom */}
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

				{/* Echo slots container */}
				<div style={{ display: 'flex', gap: isVerticalLayout ? '20px' : '40px', alignItems: 'flex-end', justifyContent: 'center', flex: 1 }}>
					{echoSlots.map((actor, slotIndex) => {
						const isSelected = selectedSlotIndex === slotIndex;

						return (
							<motion.div
								key={`echo_slot_${slotIndex}`}
							onClick={() => handleEchoSlotClick(slotIndex)}
								onDrop={(e) => handleDropOnEchoSlot(e, slotIndex)}
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
									scale: actor ? (isSelected ? 1.05 : 1.02) : 1,
									filter: 'brightness(1.1)',
									transition: {
										type: "spring",
										stiffness: 150,
										damping: 15
									}
								}}
								whileTap={{ scale: actor ? (isSelected ? 1.03 : 1) : 0.98 }}
								className={actor && !actor.isPrimaryImageReady ? 'loading-echo-slot' : ''}
								style={{
									...((actor && !actor.isPrimaryImageReady && actor.themeColor) && {
										'--shimmer-color': actor.themeColor
									} as React.CSSProperties),
									animationDelay: `${slotIndex * 0.7}s`,
									cursor: actor ? 'pointer' : 'default',
									height: isVerticalLayout ? '50vh' : '65vh',
									width: isVerticalLayout ? '28vw' : '18vw',
									display: 'flex',
									flexDirection: 'column',
									justifyContent: actor ? 'flex-end' : 'center',
									alignItems: actor ? 'stretch' : 'center',
									borderRadius: 12,
									overflow: 'hidden',
									background: actor ? undefined : 'linear-gradient(135deg, rgba(176,102,255,0.15), rgba(0,200,255,0.1))',
									border: isSelected
										? `5px solid ${actor?.themeColor || '#ffffff'}` 
										: selectedReserveActorId
											? '4px solid rgba(255,215,0,0.8)' // Gold border when ready to place
											: actor 
												? `4px solid ${actor.themeColor || '#b066ff'}`
												: '3px dashed rgba(176,102,255,0.5)',
									boxShadow: isSelected
										? `0 12px 40px ${actor?.themeColor ? actor.themeColor + '40' : 'rgba(176,102,255,0.25)'}, inset 0 0 50px ${actor?.themeColor ? actor.themeColor + '20' : 'rgba(176,102,255,0.1)'}` 
										: actor
											? `0 8px 25px rgba(0,0,0,0.4), inset 0 0 30px ${actor.themeColor ? actor.themeColor + '15' : 'rgba(176,102,255,0.05)'}, 0 0 20px ${actor.themeColor ? actor.themeColor + '30' : 'rgba(176,102,255,0.1)'}`
											: '0 8px 25px rgba(0,0,0,0.4), inset 0 0 30px rgba(176,102,255,0.05)',
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
													rgba(176, 102, 255, 0.15) 0%, 
													rgba(0, 200, 255, 0.1) 50%, 
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
									<RemoveButton
										onClick={(e: React.MouseEvent) => removeEchoActor(actor.id, e)}
										title="Move to reserves"
										variant="topRightInset"
										size="medium"
									/>
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
									color: selectedReserveActorId ? 'rgba(255,215,0,0.9)' : 'rgba(176,102,255,0.7)', 
									fontSize: 'clamp(14px, 2.2vmin, 20px)', 
									textAlign: 'center',
									padding: 'clamp(12px, 2.5vmin, 24px)',
									transition: 'color 0.3s ease'
								}}>
									{selectedReserveActorId ? 'Tap here to place the selected soul' : 'Drag or tap a soul above, then tap here to place'}
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
						onClick={accept}
						disabled={!acceptable}
						style={{
							background: acceptable ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
							color: acceptable ? '#1a0533' : '#9aa0a6'
						}}
					>
						{availableRooms.length === 0 
							? 'No Available Quarters' 
							: selectedActor 
								? (selectedActor.isPrimaryImageReady ? 'Complete Summoning' : 'Still Taking Form')
								: 'Select a Candidate'
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
							onClick={accept}
							disabled={!acceptable}
							style={{
								background: acceptable ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
								color: acceptable ? '#1a0533' : '#9aa0a6'
							}}
						>
							{availableRooms.length === 0 
								? 'No Available Quarters' 
								: selectedActor 
									? (selectedActor.isPrimaryImageReady ? 'Complete Summoning' : 'Still Taking Form')
									: 'Select a Candidate'
							}
						</Button>
					</div>
				)}
			</div>
			</div>
		</BlurredBackground>
	);
}
