import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, G, Circle, Rect, Line, Ellipse } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');

/**
 * White doodle-style line art wallpaper for chat screens
 * Renders 18 stroke-only icons scattered at low opacity
 */
export default function ChatBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={SW} height={SH}>
        {ICON_PLACEMENTS.map((placement, index) => {
          const IconComponent = DOODLE_ICONS[placement.icon];

          return (
            <G
              key={index}
              transform={`translate(${placement.x}, ${placement.y}) rotate(${placement.rotation}) scale(${placement.scale})`}
              opacity={placement.opacity}
            >
              <IconComponent />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

// White doodle-style stroke-only icon components

const ChatBubbleIcon = () => (
  <Path
    d="M4 4 L20 4 C21 4 22 5 22 6 L22 16 C22 17 21 18 20 18 L8 18 L4 22 L4 4 Z"
    stroke="#FFF"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

const PaperPlaneIcon = () => (
  <Path
    d="M3 3 L22 12 L3 21 L7 12 L3 3 Z M7 12 L15 12"
    stroke="#FFF"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

const EnvelopeIcon = () => (
  <>
    <Rect x="3" y="6" width="18" height="12" rx="2" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M3 8 L12 13 L21 8" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);

const SmartphoneIcon = () => (
  <>
    <Rect x="6" y="2" width="12" height="20" rx="2" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Line x1="12" y1="18" x2="12" y2="18" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
  </>
);

const BellIcon = () => (
  <>
    <Path d="M18 8 C18 6 17 4 15 3 C14 2 13 2 12 2 C11 2 10 2 9 3 C7 4 6 6 6 8 C6 12 4 14 4 14 L20 14 C20 14 18 12 18 8 Z" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M10 18 C10 19 11 20 12 20 C13 20 14 19 14 18" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);

const SmileyIcon = () => (
  <>
    <Circle cx="12" cy="12" r="10" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M8 14 C8 14 9.5 16 12 16 C14.5 16 16 14 16 14" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Circle cx="9" cy="9" r="1" fill="#FFF" />
    <Circle cx="15" cy="9" r="1" fill="#FFF" />
  </>
);

const CameraIcon = () => (
  <>
    <Path d="M3 8 L5 6 L8 6 L10 4 L14 4 L16 6 L19 6 L21 8 L21 18 C21 19 20 20 19 20 L5 20 C4 20 3 19 3 18 Z" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Circle cx="12" cy="13" r="3" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);

const MagnifyingGlassIcon = () => (
  <>
    <Circle cx="10" cy="10" r="7" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Line x1="15" y1="15" x2="21" y2="21" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const LockIcon = () => (
  <>
    <Rect x="5" y="11" width="14" height="11" rx="2" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M8 11 L8 7 C8 5 10 3 12 3 C14 3 16 5 16 7 L16 11" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);

const KeyIcon = () => (
  <>
    <Circle cx="8" cy="12" r="4" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M11 14 L20 5 M17 5 L20 5 L20 8 M14 8 L16 6" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);

const ShieldIcon = () => (
  <Path
    d="M12 2 L4 6 L4 12 C4 18 8 21 12 22 C16 21 20 18 20 12 L20 6 Z"
    stroke="#FFF"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

const LinkChainIcon = () => (
  <Path
    d="M10 8 L14 8 C16 8 18 10 18 12 C18 14 16 16 14 16 L10 16 C8 16 6 14 6 12 C6 10 8 8 10 8 M8 12 L16 12"
    stroke="#FFF"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

const FingerprintIcon = () => (
  <>
    <Path d="M12 6 C9 6 7 8 7 11 L7 14" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M10 11 C10 9.5 11 8 12 8 C13 8 14 9.5 14 11 L14 16" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M17 11 C17 7 15 4 12 4 C9 4 7 7 7 11" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M12 12 L12 18" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);

const GlobeIcon = () => (
  <>
    <Circle cx="12" cy="12" r="10" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Ellipse cx="12" cy="12" rx="4" ry="10" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Line x1="2" y1="12" x2="22" y2="12" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const WiFiIcon = () => (
  <>
    <Path d="M5 12 C7 10 9 9 12 9 C15 9 17 10 19 12" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M8 15 C9 14 10 13 12 13 C14 13 15 14 16 15" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Circle cx="12" cy="18" r="1" fill="#FFF" />
  </>
);

const StarIcon = () => (
  <Path
    d="M12 2 L14 9 L22 9 L16 14 L18 22 L12 17 L6 22 L8 14 L2 9 L10 9 Z"
    stroke="#FFF"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

const HeartIcon = () => (
  <Path
    d="M12 21 L3 12 C1 10 1 7 3 5 C5 3 8 3 10 5 L12 7 L14 5 C16 3 19 3 21 5 C23 7 23 10 21 12 Z"
    stroke="#FFF"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
);

const LightbulbIcon = () => (
  <>
    <Path d="M9 18 L15 18 M10 21 L14 21 M12 3 C9 3 7 5 7 8 C7 10 8 11 9 13 L15 13 C16 11 17 10 17 8 C17 5 15 3 12 3 Z" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);

// Icon registry
const DOODLE_ICONS: Record<string, React.FC> = {
  chatBubble: ChatBubbleIcon,
  paperPlane: PaperPlaneIcon,
  envelope: EnvelopeIcon,
  smartphone: SmartphoneIcon,
  bell: BellIcon,
  smiley: SmileyIcon,
  camera: CameraIcon,
  magnifyingGlass: MagnifyingGlassIcon,
  lock: LockIcon,
  key: KeyIcon,
  shield: ShieldIcon,
  linkChain: LinkChainIcon,
  fingerprint: FingerprintIcon,
  globe: GlobeIcon,
  wifi: WiFiIcon,
  star: StarIcon,
  heart: HeartIcon,
  lightbulb: LightbulbIcon,
};

// Icon placement data (~32 icons scattered across screen)
interface IconPlacement {
  icon: keyof typeof DOODLE_ICONS;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
}

const ICON_PLACEMENTS: IconPlacement[] = [
  // Row 1 - Top
  { icon: 'chatBubble', x: SW * 0.05, y: SH * 0.06, rotation: -12, scale: 2.8, opacity: 0.06 },
  { icon: 'lock', x: SW * 0.22, y: SH * 0.08, rotation: 8, scale: 2.5, opacity: 0.07 },
  { icon: 'star', x: SW * 0.38, y: SH * 0.05, rotation: -18, scale: 2.3, opacity: 0.06 },
  { icon: 'envelope', x: SW * 0.55, y: SH * 0.09, rotation: 15, scale: 2.6, opacity: 0.07 },
  { icon: 'shield', x: SW * 0.72, y: SH * 0.07, rotation: -8, scale: 2.7, opacity: 0.06 },
  { icon: 'heart', x: SW * 0.88, y: SH * 0.06, rotation: 12, scale: 2.4, opacity: 0.08 },

  // Row 2
  { icon: 'key', x: SW * 0.08, y: SH * 0.18, rotation: 22, scale: 2.4, opacity: 0.07 },
  { icon: 'paperPlane', x: SW * 0.28, y: SH * 0.2, rotation: -15, scale: 2.6, opacity: 0.06 },
  { icon: 'wifi', x: SW * 0.45, y: SH * 0.19, rotation: 5, scale: 2.3, opacity: 0.08 },
  { icon: 'smartphone', x: SW * 0.63, y: SH * 0.21, rotation: -20, scale: 2.5, opacity: 0.06 },
  { icon: 'globe', x: SW * 0.82, y: SH * 0.18, rotation: 10, scale: 2.7, opacity: 0.07 },

  // Row 3
  { icon: 'fingerprint', x: SW * 0.12, y: SH * 0.32, rotation: -8, scale: 2.5, opacity: 0.06 },
  { icon: 'bell', x: SW * 0.32, y: SH * 0.33, rotation: 18, scale: 2.4, opacity: 0.08 },
  { icon: 'linkChain', x: SW * 0.5, y: SH * 0.31, rotation: -12, scale: 2.6, opacity: 0.06 },
  { icon: 'lightbulb', x: SW * 0.68, y: SH * 0.34, rotation: 8, scale: 2.3, opacity: 0.07 },
  { icon: 'camera', x: SW * 0.85, y: SH * 0.32, rotation: -16, scale: 2.5, opacity: 0.06 },

  // Row 4 - Middle
  { icon: 'smiley', x: SW * 0.06, y: SH * 0.45, rotation: 12, scale: 2.7, opacity: 0.07 },
  { icon: 'magnifyingGlass', x: SW * 0.25, y: SH * 0.47, rotation: -10, scale: 2.4, opacity: 0.06 },
  { icon: 'chatBubble', x: SW * 0.43, y: SH * 0.46, rotation: 20, scale: 2.5, opacity: 0.08 },
  { icon: 'lock', x: SW * 0.6, y: SH * 0.48, rotation: -14, scale: 2.6, opacity: 0.06 },
  { icon: 'star', x: SW * 0.78, y: SH * 0.45, rotation: 6, scale: 2.3, opacity: 0.07 },

  // Row 5
  { icon: 'envelope', x: SW * 0.15, y: SH * 0.6, rotation: -18, scale: 2.4, opacity: 0.06 },
  { icon: 'shield', x: SW * 0.35, y: SH * 0.62, rotation: 14, scale: 2.7, opacity: 0.07 },
  { icon: 'heart', x: SW * 0.52, y: SH * 0.59, rotation: -8, scale: 2.5, opacity: 0.08 },
  { icon: 'key', x: SW * 0.7, y: SH * 0.61, rotation: 16, scale: 2.4, opacity: 0.06 },
  { icon: 'paperPlane', x: SW * 0.88, y: SH * 0.6, rotation: -12, scale: 2.6, opacity: 0.07 },

  // Row 6
  { icon: 'wifi', x: SW * 0.1, y: SH * 0.74, rotation: 10, scale: 2.3, opacity: 0.06 },
  { icon: 'smartphone', x: SW * 0.3, y: SH * 0.76, rotation: -16, scale: 2.5, opacity: 0.08 },
  { icon: 'globe', x: SW * 0.48, y: SH * 0.73, rotation: 8, scale: 2.7, opacity: 0.06 },
  { icon: 'fingerprint', x: SW * 0.65, y: SH * 0.77, rotation: -20, scale: 2.4, opacity: 0.07 },
  { icon: 'bell', x: SW * 0.83, y: SH * 0.74, rotation: 12, scale: 2.6, opacity: 0.06 },

  // Row 7 - Bottom
  { icon: 'linkChain', x: SW * 0.18, y: SH * 0.88, rotation: -14, scale: 2.5, opacity: 0.07 },
  { icon: 'lightbulb', x: SW * 0.4, y: SH * 0.9, rotation: 18, scale: 2.3, opacity: 0.06 },
];

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
