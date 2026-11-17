import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ROUTE_MAP, type RootStackParamList, type ScreenProps } from './types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useScreenNav(): ScreenProps {
  const navigation = useNavigation<Nav>();
  return {
    navigate: (route) => {
      const target = ROUTE_MAP[route];
      if (typeof target === 'object' && 'tab' in target) {
        navigation.navigate('MainTabs', { screen: target.tab });
        return;
      }
      navigation.navigate(target);
    },
    back: () => {
      if (navigation.canGoBack()) navigation.goBack();
    },
    canGoBack: navigation.canGoBack(),
  };
}
