import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { theme } from '../theme';

const { width: SW, height: SH } = Dimensions.get('window');

/**
 * Crypto-themed SVG wallpaper for chat screens
 * Renders ~15 crypto-themed icons scattered at low opacity
 */
export default function ChatBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={SW} height={SH}>
        {ICON_PLACEMENTS.map((placement, index) => {
          const IconComponent = CRYPTO_ICONS[placement.icon];
          const color = placement.color === 'primary' ? theme.colors.primary : theme.colors.secondary;

          return (
            <G
              key={index}
              transform={`translate(${placement.x}, ${placement.y}) rotate(${placement.rotation}) scale(${placement.scale})`}
              opacity={placement.opacity}
            >
              <IconComponent color={color} />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

// SVG Icon Components (simplified paths)

const WalletIcon = ({ color }: { color: string }) => (
  <Path
    d="M2 6 C2 4 4 2 6 2 L18 2 C20 2 22 4 22 6 L22 18 C22 20 20 22 18 22 L6 22 C4 22 2 20 2 18 Z M17 10 L20 10 C21 10 22 11 22 12 L22 14 C22 15 21 16 20 16 L17 16 C16 16 15 15 15 14 L15 12 C15 11 16 10 17 10 Z M17 12 L17 14 L20 14 L20 12 Z"
    fill={color}
  />
);

const KeyIcon = ({ color }: { color: string }) => (
  <Path
    d="M7 12 C7 9 9 7 12 7 C15 7 17 9 17 12 C17 13 16.5 14 16 14.5 L22 20.5 L22 22 L20 22 L18.5 20.5 L17 22 L15 20 L16.5 18.5 L14.5 16.5 C14 17 13 17 12 17 C9 17 7 15 7 12 Z M12 10 C10 10 9 11 9 12 C9 13 10 14 12 14 C13 14 14 13 14 12 C14 11 13 10 12 10 Z"
    fill={color}
  />
);

const ShieldIcon = ({ color }: { color: string }) => (
  <Path
    d="M12 2 L4 6 L4 12 C4 18 8 21 12 22 C16 21 20 18 20 12 L20 6 Z M12 5 L6 8 L6 12 C6 16 9 18.5 12 19.5 C15 18.5 18 16 18 12 L18 8 Z"
    fill={color}
  />
);

const ChainLinkIcon = ({ color }: { color: string }) => (
  <Path
    d="M10 8 L14 8 C16 8 18 10 18 12 C18 14 16 16 14 16 L12 16 M14 16 L10 16 C8 16 6 14 6 12 C6 10 8 8 10 8 L12 8 M8 12 L16 12"
    stroke={color}
    strokeWidth="2"
    fill="none"
  />
);

const CoinIcon = ({ color }: { color: string }) => (
  <>
    <Path
      d="M12 2 C6 2 2 6 2 12 C2 18 6 22 12 22 C18 22 22 18 22 12 C22 6 18 2 12 2 Z"
      fill={color}
    />
    <Path
      d="M12 7 L12 9 M12 15 L12 17 M10 10 L14 10 C15 10 15 11 15 11.5 C15 12 14.5 12.5 14 12.5 L10 12.5 L14 12.5 C14.5 12.5 15 13 15 13.5 C15 14 14.5 14.5 14 14.5 L10 14.5"
      stroke="#000"
      strokeWidth="1.5"
      fill="none"
    />
  </>
);

const HexNodeIcon = ({ color }: { color: string }) => (
  <Path
    d="M12 3 L19 7 L19 17 L12 21 L5 17 L5 7 Z M12 8 L15.5 10 L15.5 14 L12 16 L8.5 14 L8.5 10 Z"
    fill={color}
  />
);

const SolanaSwooshIcon = ({ color }: { color: string }) => (
  <>
    <Path d="M4 8 L20 8 L18 10 L6 10 Z" fill={color} />
    <Path d="M4 12 L20 12 L18 14 L6 14 Z" fill={color} />
    <Path d="M4 16 L20 16 L18 18 L6 18 Z" fill={color} />
  </>
);

// Icon registry
const CRYPTO_ICONS: Record<string, React.FC<{ color: string }>> = {
  wallet: WalletIcon,
  key: KeyIcon,
  shield: ShieldIcon,
  chainLink: ChainLinkIcon,
  coin: CoinIcon,
  hexNode: HexNodeIcon,
  solanaSwoosh: SolanaSwooshIcon,
};

// Icon placement data (15 icons scattered across screen)
interface IconPlacement {
  icon: keyof typeof CRYPTO_ICONS;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: 'primary' | 'secondary';
  opacity: number;
}

const ICON_PLACEMENTS: IconPlacement[] = [
  // Top left cluster
  { icon: 'wallet', x: SW * 0.05, y: SH * 0.08, rotation: -15, scale: 3, color: 'primary', opacity: 0.04 },
  { icon: 'key', x: SW * 0.15, y: SH * 0.15, rotation: 25, scale: 2.5, color: 'secondary', opacity: 0.03 },

  // Top right
  { icon: 'shield', x: SW * 0.75, y: SH * 0.1, rotation: 10, scale: 3, color: 'secondary', opacity: 0.035 },
  { icon: 'chainLink', x: SW * 0.85, y: SH * 0.18, rotation: -20, scale: 2.5, color: 'primary', opacity: 0.03 },

  // Middle left
  { icon: 'coin', x: SW * 0.08, y: SH * 0.35, rotation: 0, scale: 3.5, color: 'primary', opacity: 0.04 },
  { icon: 'hexNode', x: SW * 0.12, y: SH * 0.45, rotation: 30, scale: 2.8, color: 'secondary', opacity: 0.03 },

  // Middle center
  { icon: 'solanaSwoosh', x: SW * 0.4, y: SH * 0.4, rotation: -10, scale: 3, color: 'secondary', opacity: 0.035 },
  { icon: 'wallet', x: SW * 0.55, y: SH * 0.48, rotation: 20, scale: 2.5, color: 'primary', opacity: 0.03 },

  // Middle right
  { icon: 'key', x: SW * 0.8, y: SH * 0.38, rotation: -25, scale: 3, color: 'primary', opacity: 0.04 },
  { icon: 'shield', x: SW * 0.82, y: SH * 0.52, rotation: 15, scale: 2.5, color: 'secondary', opacity: 0.03 },

  // Bottom left
  { icon: 'hexNode', x: SW * 0.1, y: SH * 0.7, rotation: -15, scale: 3.2, color: 'secondary', opacity: 0.04 },
  { icon: 'chainLink', x: SW * 0.18, y: SH * 0.8, rotation: 25, scale: 2.8, color: 'primary', opacity: 0.03 },

  // Bottom center
  { icon: 'coin', x: SW * 0.45, y: SH * 0.75, rotation: 0, scale: 3, color: 'primary', opacity: 0.035 },

  // Bottom right
  { icon: 'solanaSwoosh', x: SW * 0.75, y: SH * 0.72, rotation: 20, scale: 3.5, color: 'secondary', opacity: 0.04 },
  { icon: 'wallet', x: SW * 0.85, y: SH * 0.85, rotation: -30, scale: 2.5, color: 'primary', opacity: 0.03 },
];

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
