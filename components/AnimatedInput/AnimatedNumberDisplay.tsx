import { StyleSheet, TextStyle, View } from 'react-native';
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