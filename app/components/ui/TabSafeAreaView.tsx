import type { Edge } from "react-native-safe-area-context"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { ReactNode } from "react"
import { View, type StyleProp, type ViewStyle } from "react-native"

type TabSafeAreaViewProps = {
  children: ReactNode
  edges?: Edge[]
  style?: StyleProp<ViewStyle>
}

/**
 * Applies the already-known window insets as regular layout padding.
 * The native SafeAreaView can measure once at zero and then add the status
 * bar inset, which makes a newly mounted tab visibly jump downward.
 */
export function TabSafeAreaView({
  children,
  edges = ["top", "right", "bottom", "left"],
  style,
}: TabSafeAreaViewProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        style,
        {
          paddingTop: edges.includes("top") ? insets.top : 0,
          paddingRight: edges.includes("right") ? insets.right : 0,
          paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
          paddingLeft: edges.includes("left") ? insets.left : 0,
        },
      ]}
    >
      {children}
    </View>
  )
}
