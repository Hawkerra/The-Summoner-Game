import { FC } from 'react';

/**
 * Pass 1 placeholder for the removed ActorCarousel.
 *
 * The reserve-of-5 carousel is gone for good; summoning becomes a one-card,
 * swipe-style phone UI in Pass 3. Until then this stub renders a simple list of
 * whatever actors it's handed so EchoScreen / CryoScreen / AttenuationScreen
 * compile and remain usable. It deliberately accepts loose props so existing
 * call sites don't need rewriting yet.
 */
interface CarouselStubProps {
    actors?: any[];
    onActorClick?: (id: string) => void;
    onExpandActor?: (id: string) => void;
    [key: string]: any;
}

export const CarouselStub: FC<CarouselStubProps> = ({ actors = [], onActorClick, onExpandActor }) => {
    if (!actors || actors.length === 0) {
        return (
            <div style={{ padding: '12px', opacity: 0.6, fontSize: '0.9em' }}>
                (No candidates - swipe summoning arrives in a later pass.)
            </div>
        );
    }
    return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '12px' }}>
            {actors.map((a: any, i: number) => {
                const id = a?.actorId ?? a?.id ?? String(i);
                const name = a?.name ?? a?.actorId ?? `Candidate ${i + 1}`;
                return (
                    <button
                        key={id}
                        onClick={() => { onActorClick?.(id); onExpandActor?.(id); }}
                        style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        {name}
                    </button>
                );
            })}
        </div>
    );
};

// Back-compat alias so call sites can keep importing the old name if desired.
export const ActorCarousel = CarouselStub;
