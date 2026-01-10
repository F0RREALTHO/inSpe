import { View, StyleSheet, TextStyle } from 'react-native';
import { AnimatedSingleNumber } from './AnimatedSingleNumber';

interface AnimatedNumberDisplayProps {
  value: string;
  style?: TextStyle | TextStyle[];
}

export const AnimatedNumberDisplay: React.FC<AnimatedNumberDisplayProps> = ({ value, style }) => {
  const characters = value.toString().split('');

  return (
    <View style={styles.row}>
      {characters.map((char: string, index: number) => {
        // Unique key based on index and value to force re-render/animation on change
        const key = `${index}-${char}`; 
        return (
          <AnimatedSingleNumber 
            key={key} 
            index={index} 
            value={char} 
            style={style} 
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
  },
});