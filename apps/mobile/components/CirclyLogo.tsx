import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg'
import { useColors } from '../hooks/useColors'

interface CirclyLogoProps {
  size?: number
  showText?: boolean
}

export function CirclyLogo({ size = 100, showText = true }: CirclyLogoProps) {
  const colors = useColors()
  const color = colors.accent

  const cx = 50
  const cy = 50
  const r = 38
  const strokeW = 4.5
  const dotR = 5.5

  // Angle helper: 0°=right, clockwise in screen coords
  const pt = (deg: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  // Dot positions — diagonal from upper-left to lower-right
  const dot1 = pt(225) // upper-left (10:30 o'clock)
  const dot2 = pt(45)  // lower-right (4:30 o'clock)

  // Arc endpoints (12° gap on each side of dot)
  const a1Start = pt(237) // just past upper-left dot
  const a1End = pt(33)    // just before lower-right dot
  const a2Start = pt(57)  // just past lower-right dot
  const a2End = pt(213)   // just before upper-left dot

  // Both arcs are ~156° (< 180°), clockwise → sweep=1, large-arc=0
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Arc over the top: upper-left → top → right → lower-right */}
      <Path
        d={`M ${a1Start.x} ${a1Start.y} A ${r} ${r} 0 0 1 ${a1End.x} ${a1End.y}`}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
      />
      {/* Arc under the bottom: lower-right → bottom → left → upper-left */}
      <Path
        d={`M ${a2Start.x} ${a2Start.y} A ${r} ${r} 0 0 1 ${a2End.x} ${a2End.y}`}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
      />
      {/* Connection dots */}
      <Circle cx={dot1.x} cy={dot1.y} r={dotR} fill={color} />
      <Circle cx={dot2.x} cy={dot2.y} r={dotR} fill={color} />

      {showText && (
        <SvgText
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={19}
          fontWeight="800"
          fill={color}
          letterSpacing={-0.5}
        >
          circly
        </SvgText>
      )}
    </Svg>
  )
}
