import { StyleSheet, Text, View } from 'react-native';

export default function Income() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Income</Text>
      <Text>Income list will go here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});

