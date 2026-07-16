import React, { FC } from 'react';
import { motion } from 'framer-motion';
import Actor from '../actors/Actor';

interface AuthorLinkProps {
	actor: Actor;
	style?: React.CSSProperties;
}

/**
 * Displays a link icon to the character's ChUB page with optional author name
 * Shows author name if the first segment of fullPath is not "Anonymous"
 */
export const AuthorLink: FC<AuthorLinkProps> = ({ actor, style }) => {
	if (!actor.fullPath) return null;

	const pathSegments = actor.fullPath.split('/');
	const author = pathSegments[0];
	const showAuthor = author && author.toLowerCase() !== 'anonymous';
	const chubUrl = `https://chub.ai/characters/${actor.fullPath}`;

	return (
		<motion.a
			href={chubUrl}
			target="_blank"
			rel="noopener noreferrer"
			whileHover={{ scale: 1.05, opacity: 0.8 }}
			whileTap={{ scale: 0.95 }}
			onClick={(e) => e.stopPropagation()}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '6px',
				padding: '4px 8px',
				borderRadius: '4px',
				background: 'rgba(0, 0, 0, 0.6)',
				border: '1px solid rgba(255, 255, 255, 0.2)',
				color: '#b066ff',
				fontSize: '11px',
				textDecoration: 'none',
				cursor: 'pointer',
				minWidth: 0,
				maxWidth: '100%',
				...style
			}}
		>
			{showAuthor && <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>@{author}</span>}
			{!showAuthor && <span style={{ fontWeight: 500 }}>Anonymous</span>}
			{/* Link icon */}
			<svg 
				width="14" 
				height="14" 
				viewBox="0 0 24 24" 
				fill="none" 
				stroke="currentColor" 
				strokeWidth="2" 
				strokeLinecap="round" 
				strokeLinejoin="round"
			>
				<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
				<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
			</svg>
		</motion.a>
	);
};

export default AuthorLink;
