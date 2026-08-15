import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { useTheme } from "@/context/ThemeContext"

interface DateBubbleProps {
  date: string
}

const DateBubble: React.FC<DateBubbleProps> = ({ date }) => {
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      <View style={[styles.pill, { backgroundColor: colors.card }]}>
        <Text style={[styles.text, { color: colors.mutedForeground }]}>
          {date}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
})

export default React.memo(DateBubble)
