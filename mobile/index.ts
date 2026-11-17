// Must be first: Hermes on some Android builds lacks Intl.PluralRules, which i18next needs.
import 'intl-pluralrules';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
