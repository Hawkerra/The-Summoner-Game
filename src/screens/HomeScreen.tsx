import { FC } from 'react';
import { Stage } from '../Stage';
import { ScreenType } from './BaseScreen';

/**
 * Pass 1 stub - the app's default in-game screen.
 *
 * This is a placeholder that replaces the old tower StationScreen so the app
 * boots to a real "Home" root. It will grow into the Location-graph Home view
 * (dropdown nav, present summons, background) in Pass 4. For now it just proves
 * the app loads and lets you reach the other screens.
 */
interface HomeScreenProps {
    stage: () => Stage;
    setScreenType: (screenType: ScreenType) => void;
    isVerticalLayout: boolean;
}

export const HomeScreen: FC<HomeScreenProps> = ({ setScreenType }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            gap: '16px',
            textAlign: 'center',
            padding: '24px',
            boxSizing: 'border-box',
        }}>
            <h1 style={{ margin: 0 }}>The Summoner Game</h1>
            <p style={{ opacity: 0.7, maxWidth: '32ch' }}>
                Home. This is the alpha skeleton - the Location view lands in a later pass.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => setScreenType(ScreenType.ECHO)}>Summon (Echo)</button>
                <button onClick={() => setScreenType(ScreenType.CRYO)}>The Void (Cryo)</button>
                <button onClick={() => setScreenType(ScreenType.MENU)}>Menu</button>
            </div>
        </div>
    );
};
