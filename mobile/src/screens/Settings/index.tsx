/**
 * Settings Screen — Premium redesign
 * Dark green header · Profile card · Grouped menu with avatars · Styled logout
 */

import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Alert, StatusBar, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';

const G_DARK = '#1B5E20';
const G_MED  = '#2E7D32';

interface MenuItem {
  id: string; icon: string; label: string; sub: string;
  iconBg: string; iconColor: string; badge?: string;
}

const MENU_GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Business',
    items: [
      { id: 'biz',     icon: '🏢', label: 'Business Profile',   sub: 'Name, GSTIN, Address',   iconBg: '#E3F2FD', iconColor: '#1E88E5' },
      { id: 'gst',     icon: '🏛️', label: 'GST Settings',       sub: 'Tax rates, State code',  iconBg: '#F3E5F5', iconColor: '#8E24AA' },
    ],
  },
  {
    title: 'Hardware',
    items: [
      { id: 'printer', icon: '🖨️', label: 'Printer Settings',   sub: 'Bluetooth ESC/POS',      iconBg: '#FFF3E0', iconColor: '#FB8C00' },
      { id: 'voice',   icon: '🎙️', label: 'Voice Settings',     sub: 'Tamil (Offline STT)',    iconBg: '#E8F5E9', iconColor: '#43A047' },
    ],
  },
  {
    title: 'Data',
    items: [
      { id: 'backup',  icon: '☁️', label: 'Backup & Restore',   sub: 'Cloud sync settings',    iconBg: '#E0F2F1', iconColor: '#00897B' },
      { id: 'data',    icon: '📊', label: 'Data Management',    sub: 'Export, import data',    iconBg: '#FDE8E8', iconColor: '#E53935' },
    ],
  },
  {
    title: 'Info',
    items: [
      { id: 'about',   icon: 'ℹ️', label: 'About App',          sub: 'Version 1.0.0',          iconBg: '#F5F5F5', iconColor: '#757575' },
    ],
  },
];

export default function SettingsScreen() {
  const router       = useRouter();
  const language     = useAppStore(s => s.language);
  const setLanguage  = useAppStore(s => s.setLanguage);
  const clearSession = useAppStore(s => s.clearSession);
  const business     = useAppStore(s => s.business);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: clearSession },
    ]);
  };

  const handleItem = (id: string) => {
    const msgs: Record<string, string> = {
      biz:     `Business: ${business?.businessName ?? 'Demo Store'}\nGSTIN: ${business?.gstin ?? 'Not set'}`,
      gst:     'GST Settings\nInter-state IGST · Intra-state CGST+SGST',
      printer: 'Connect a Bluetooth ESC/POS thermal printer.\nBT pairing coming in next update.',
      voice:   'Voice Language: Tamil\nSTT Engine: On-device (offline)',
      backup:  'Cloud backup coming in v1.1',
      data:    'Export your data as JSON or CSV',
      about:   'Compliance One — GST Voice Billing\nVersion 1.0.0\n© 2025 Compliance One',
    };
    Alert.alert(MENU_GROUPS.flatMap(g => g.items).find(i => i.id === id)?.label ?? '', msgs[id] ?? '');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={G_DARK} />

      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Settings</Text>
        <Text style={styles.topSub}>Compliance One</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCardWrap}>
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(business?.businessName ?? 'D').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{business?.businessName ?? 'Demo Store'}</Text>
            <Text style={styles.profileGstin}>
              GSTIN: {business?.gstin ?? '33ABCDE1234F1Z5'}
            </Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => handleItem('biz')}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Language Toggle */}
        <View style={styles.langCard}>
          <Text style={styles.langTitle}>Language / மொழி</Text>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langBtn, language === 'ta' && styles.langBtnActive]}
              onPress={() => setLanguage('ta')}
              activeOpacity={0.8}
            >
              <Text style={styles.langFlag}>🇮🇳</Text>
              <Text style={[styles.langText, language === 'ta' && styles.langTextActive]} numberOfLines={1}>தமிழ்</Text>
              {language === 'ta' && <View style={styles.langCheck}><Text style={styles.langCheckText}>✓</Text></View>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langBtn, language === 'tanglish' && styles.langBtnActive]}
              onPress={() => setLanguage('tanglish')}
              activeOpacity={0.8}
            >
              <Text style={styles.langFlag}>🔤</Text>
              <Text style={[styles.langText, language === 'tanglish' && styles.langTextActive]} numberOfLines={1}>Tanglish</Text>
              {language === 'tanglish' && <View style={styles.langCheck}><Text style={styles.langCheckText}>✓</Text></View>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
              onPress={() => setLanguage('en')}
              activeOpacity={0.8}
            >
              <Text style={styles.langFlag}>🇬🇧</Text>
              <Text style={[styles.langText, language === 'en' && styles.langTextActive]} numberOfLines={1}>English</Text>
              {language === 'en' && <View style={styles.langCheck}><Text style={styles.langCheckText}>✓</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Groups */}
        {MENU_GROUPS.map((group) => (
          <View key={group.title} style={styles.menuGroup}>
            <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
            <View style={styles.menuCard}>
              {group.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.menuItem, idx === group.items.length - 1 && styles.menuItemLast]}
                  onPress={() => handleItem(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: item.iconBg }]}>
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSub}>{item.sub}</Text>
                  </View>
                  <Text style={styles.menuChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <View style={styles.logoutIconWrap}>
            <Text style={styles.logoutIcon}>🚪</Text>
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Compliance One v1.0.0</Text>
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F4F7F4' },
  topBar:       { backgroundColor: G_DARK, paddingHorizontal: 20, paddingVertical: 16, paddingTop: 20 },
  topTitle:     { fontSize: 22, fontWeight: '900', color: '#fff' },
  topSub:       { fontSize: 12, color: '#A5D6A7', marginTop: 2 },
  profileCardWrap: { backgroundColor: G_DARK, paddingHorizontal: 16, paddingBottom: 20 },
  profileCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  profileAvatar:{ width: 50, height: 50, borderRadius: 25, backgroundColor: G_DARK, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  profileAvatarText:{ fontSize: 22, fontWeight: '900', color: '#fff' },
  profileInfo:  { flex: 1 },
  profileName:  { fontSize: 16, fontWeight: '800', color: '#212121' },
  profileGstin: { fontSize: 12, color: '#9E9E9E', marginTop: 3 },
  editBtn:      { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  editBtnText:  { fontSize: 13, fontWeight: '800', color: G_DARK },
  scroll:       { flex: 1 },
  content:      { padding: 16 },
  langCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  langTitle:    { fontSize: 13, fontWeight: '700', color: '#757575', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  langRow:      { flexDirection: 'row', gap: 8 },
  langBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4 },
  langBtnActive:{ backgroundColor: '#E8F5E9', borderColor: G_MED },
  langFlag:     { fontSize: 16 },
  langText:     { fontSize: 13, fontWeight: '700', color: '#616161' },
  langTextActive:{ color: G_DARK },
  langCheck:    { width: 16, height: 16, borderRadius: 8, backgroundColor: G_MED, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  langCheckText:{ fontSize: 9, color: '#fff', fontWeight: '900' },
  menuGroup:    { marginBottom: 12 },
  groupTitle:   { fontSize: 11, fontWeight: '800', color: '#9E9E9E', marginBottom: 8, letterSpacing: 0.8, marginLeft: 2 },
  menuCard:     { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  menuItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8F8F8' },
  menuItemLast: { borderBottomWidth: 0 },
  menuIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  menuIcon:     { fontSize: 18 },
  menuText:     { flex: 1 },
  menuLabel:    { fontSize: 15, fontWeight: '700', color: '#212121' },
  menuSub:      { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  menuChevron:  { fontSize: 22, color: '#BDBDBD' },
  logoutBtn:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, marginBottom: 16, borderWidth: 1.5, borderColor: '#FFCDD2' },
  logoutIconWrap:{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFF3F3', alignItems: 'center', justifyContent: 'center' },
  logoutIcon:   { fontSize: 18 },
  logoutText:   { fontSize: 16, fontWeight: '800', color: '#C62828', flex: 1 },
  versionText:  { textAlign: 'center', fontSize: 12, color: '#BDBDBD', marginBottom: 8 },
});
